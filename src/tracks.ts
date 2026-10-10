import * as THREE from 'three';
import type { createTruck } from './truck';

const TRACKS = {
  segmentsPerWheel: 1024,
  spacing: 0.3, // m
  width: 0.24, // m
  lift: 0.035, // m above the contact point
  fade: 15, // seconds
};

export function createTracks(scene: THREE.Scene, truck: ReturnType<typeof createTruck>) {
  const wheelCount = truck.vehicle.numWheels();
  const positions = new Float32Array(wheelCount * TRACKS.segmentsPerWheel * 6 * 3);
  const spawn = new Float32Array(wheelCount * TRACKS.segmentsPerWheel * 6);
  spawn.fill(-1e9);
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const born = new THREE.BufferAttribute(spawn, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('born', born);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.MultiplyBlending, // darkens whatever light is on the sand, so tracks don't glow at night
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float born;
      varying float vBorn;
      void main() {
        vBorn = born;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying float vBorn;
      void main() {
        float alpha = clamp(1.0 - (uTime - vBorn) / ${TRACKS.fade.toFixed(1)}, 0.0, 1.0);
        gl_FragColor = vec4(mix(vec3(1.0), vec3(0.85, 0.86, 0.9), alpha), 1.0); // multiplier on the sand: fades to 1 (no change), never to 0 (black)
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // ring slots can be far apart, so one bounds check cannot cull them safely
  scene.add(mesh);

  const last = Array.from({ length: wheelCount }, () => new THREE.Vector3());
  const lastSide = Array.from({ length: wheelCount }, () => new THREE.Vector3());
  const touching = Array.from({ length: wheelCount }, () => false);
  const next = new Uint16Array(wheelCount);
  const point = new THREE.Vector3();
  const side = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  function write(vertex: number, p: THREE.Vector3, across: THREE.Vector3, sign: number, time: number) {
    const offset = vertex * 3;
    const half = TRACKS.width / 2;
    positions[offset] = p.x + across.x * half * sign;
    positions[offset + 1] = p.y + TRACKS.lift;
    positions[offset + 2] = p.z + across.z * half * sign;
    spawn[vertex] = time;
  }

  function update(time: number) {
    material.uniforms.uTime.value = time;
    rotation.copy(truck.body.rotation());
    side.set(0, 0, 1).applyQuaternion(rotation);
    side.y = 0;
    side.normalize();

    for (let i = 0; i < wheelCount; i++) {
      const contact = truck.vehicle.wheelIsInContact(i) && truck.vehicle.wheelContactPoint(i);
      if (!contact) {
        touching[i] = false;
        continue;
      }
      point.copy(contact);
      if (!touching[i]) {
        last[i].copy(point);
        lastSide[i].copy(side);
        touching[i] = true;
        continue;
      }
      if (point.distanceToSquared(last[i]) < TRACKS.spacing ** 2) continue;

      const slot = (i * TRACKS.segmentsPerWheel + next[i]) * 6;
      write(slot, last[i], lastSide[i], -1, time);
      write(slot + 1, last[i], lastSide[i], 1, time);
      write(slot + 2, point, side, -1, time);
      write(slot + 3, last[i], lastSide[i], 1, time);
      write(slot + 4, point, side, 1, time);
      write(slot + 5, point, side, -1, time);
      position.addUpdateRange(slot * 3, 18);
      born.addUpdateRange(slot, 6);
      position.needsUpdate = true;
      born.needsUpdate = true;
      next[i] = (next[i] + 1) % TRACKS.segmentsPerWheel;
      last[i].copy(point);
      lastSide[i].copy(side);
    }
  }

  return { update };
}
