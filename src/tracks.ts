import * as THREE from 'three';
import type { createGroundColor, createHeight, createSoftness } from './terrain';
import type { createTruck } from './truck';

const TRACKS = {
  segmentsPerWheel: 1024,
  spacing: 0.3, // m
  width: 0.46, // m, footprint plus displaced shoulders
  lift: 0.015, // m above the contact plane
  fade: 15, // seconds
};

export function createTracks(
  scene: THREE.Scene,
  truck: ReturnType<typeof createTruck>,
  height: ReturnType<typeof createHeight>,
  softness: ReturnType<typeof createSoftness>,
  groundColor: ReturnType<typeof createGroundColor>,
) {
  const wheelCount = truck.vehicle.numWheels();
  const count = wheelCount * TRACKS.segmentsPerWheel * 6;
  const geometry = new THREE.BufferGeometry();
  function attribute(name: string, size: number) {
    const a = new THREE.BufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, a);
    return a;
  }
  const position = attribute('position', 3);
  const normal = attribute('normal', 3);
  const color = attribute('color', 3);
  const born = attribute('born', 1);
  born.array.fill(-1e9);
  const groove = attribute('groove', 2); // across (-1..1), along (m)
  const across = attribute('across', 3);
  const depth = attribute('depth', 1);
  const attributes = [position, normal, color, born, groove, across, depth];
  const uTime = { value: 0 };

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    const varying = `
      varying float vBorn, vDepth;
      varying vec2 vGroove;
      varying vec3 vAcross;
    `;
    shader.vertexShader = `
      attribute float born, depth;
      attribute vec2 groove;
      attribute vec3 across;
      ${varying}
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vBorn = born;
      vDepth = depth;
      vGroove = groove;
      vAcross = normalMatrix * across;
    `);
    shader.fragmentShader = `uniform float uTime;\n${varying}` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float age = clamp(1.0 - (uTime - vBorn) / ${TRACKS.fade.toFixed(1)}, 0.0, 1.0);
      float irregular = (sin(vGroove.y * 7.3 + sin(vGroove.y * 2.1)) + 0.4 * sin(vGroove.y * 19.7)) * 0.025;
      float x = abs(vGroove.x + irregular);
      float edge = 1.0 - smoothstep(0.86, 1.0, x);
      diffuseColor.a *= age * edge * smoothstep(0.0, 0.3, vDepth);
    `);
    // shortcut: relief is shading only; deform terrain if ruts must affect driving or silhouettes.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
      #include <normal_fragment_begin>
      float wall = smoothstep(0.28, 0.52, x) * (1.0 - smoothstep(0.52, 0.72, x));
      float berm = smoothstep(0.65, 0.8, x) * (1.0 - smoothstep(0.8, 1.0, x));
      float detail = 1.0 - smoothstep(0.15, 0.7, fwidth(vGroove.x));
      float slope = sign(vGroove.x) * (0.85 * wall - 0.5 * berm) * vDepth * detail;
      normal = normalize(vNormal - normalize(vAcross) * slope);
    `);
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // ring slots can be far apart, so one bounds check cannot cull them safely
  scene.add(mesh);

  const footprint = () => ({
    point: new THREE.Vector3(), side: new THREE.Vector3(), normal: new THREE.Vector3(),
    color: new THREE.Color(), depth: 0, width: 0, along: 0,
  });
  const last = Array.from({ length: wheelCount }, footprint);
  const current = footprint();
  const touching = Array.from({ length: wheelCount }, () => false);
  const next = new Uint16Array(wheelCount);
  const point = new THREE.Vector3();
  const side = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const rgb: [number, number, number] = [0, 0, 0];

  function write(vertex: number, p: typeof current, sign: number, time: number) {
    position.setXYZ(vertex, p.point.x + p.side.x * p.width * sign, p.point.y + p.side.y * p.width * sign + TRACKS.lift, p.point.z + p.side.z * p.width * sign);
    normal.setXYZ(vertex, p.normal.x, p.normal.y, p.normal.z);
    color.setXYZ(vertex, p.color.r, p.color.g, p.color.b);
    born.setX(vertex, time);
    groove.setXY(vertex, sign, p.along);
    across.setXYZ(vertex, p.side.x, p.side.y, p.side.z);
    depth.setX(vertex, p.depth);
  }

  function update(time: number, sinkage: readonly number[]) {
    uTime.value = time;
    rotation.copy(truck.body.rotation());
    side.set(0, 0, 1).applyQuaternion(rotation).setY(0).normalize();

    for (let i = 0; i < wheelCount; i++) {
      const contact = truck.vehicle.wheelIsInContact(i) && truck.vehicle.wheelContactPoint(i);
      if (!contact) {
        touching[i] = false;
        continue;
      }
      point.copy(contact);
      const previous = last[i];
      const distance = point.distanceTo(previous.point);
      if (touching[i] && distance < TRACKS.spacing) continue;
      const soft = softness(point.x, point.z);
      current.point.copy(point);
      current.normal.set(height(point.x - 2, point.z) - height(point.x + 2, point.z), 4, height(point.x, point.z - 2) - height(point.x, point.z + 2)).normalize();
      const contactNormal = truck.vehicle.wheelContactNormal(i)!;
      current.side.copy(side);
      current.side.y = -(contactNormal.x * side.x + contactNormal.z * side.z) / contactNormal.y;
      groundColor(point.x, point.z, soft, rgb);
      current.color.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
      current.depth = 0.08 + soft * (0.55 + 0.65 * sinkage[i]) * (0.9 + 0.1 * Math.sin(point.x * 2.3 + Math.sin(point.z * 1.7)));
      current.width = TRACKS.width / 2 * (1 + 0.025 * Math.sin(point.x * 3.7 + point.z * 2.3) + 0.015 * Math.sin(point.x * 8.1 - point.z));
      current.along = touching[i] ? previous.along + distance : 0;

      if (touching[i]) {
        const slot = (i * TRACKS.segmentsPerWheel + next[i]) * 6;
        write(slot, previous, -1, time);
        write(slot + 1, previous, 1, time);
        write(slot + 2, current, -1, time);
        write(slot + 3, previous, 1, time);
        write(slot + 4, current, 1, time);
        write(slot + 5, current, -1, time);
        for (const a of attributes) {
          a.addUpdateRange(slot * a.itemSize, 6 * a.itemSize);
          a.needsUpdate = true;
        }
        next[i] = (next[i] + 1) % TRACKS.segmentsPerWheel;
      }
      previous.point.copy(current.point);
      previous.side.copy(current.side);
      previous.normal.copy(current.normal);
      previous.color.copy(current.color);
      previous.depth = current.depth;
      previous.width = current.width;
      previous.along = current.along;
      touching[i] = true;
    }
  }

  return { update };
}
