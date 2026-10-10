import * as THREE from 'three';
import type { createTruck } from './truck';

const TRACKS = {
  segmentsPerWheel: 1024,
  spacing: 0.3, // m
  width: 0.3, // m, about the tyre's footprint
  tread: 3.5, // tread bars per metre
  lift: 0.035, // m above the contact point
  fade: 15, // seconds
};

export function createTracks(scene: THREE.Scene, truck: ReturnType<typeof createTruck>) {
  const wheelCount = truck.vehicle.numWheels();
  const positions = new Float32Array(wheelCount * TRACKS.segmentsPerWheel * 6 * 3);
  const spawn = new Float32Array(wheelCount * TRACKS.segmentsPerWheel * 6);
  spawn.fill(-1e9);
  const grooves = new Float32Array(wheelCount * TRACKS.segmentsPerWheel * 6 * 2); // across (-1..1), along (m)
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const born = new THREE.BufferAttribute(spawn, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  const groove = new THREE.BufferAttribute(grooves, 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('born', born);
  geometry.setAttribute('groove', groove);

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
      attribute vec2 groove;
      varying float vBorn;
      varying vec2 vGroove;
      void main() {
        vBorn = born;
        vGroove = groove;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying float vBorn;
      varying vec2 vGroove;
      void main() {
        float alpha = clamp(1.0 - (uTime - vBorn) / ${TRACKS.fade.toFixed(1)}, 0.0, 1.0);
        // A pressed-in rut, not paint: faint floor, shadowed walls at both edges, light tread bars.
        float wall = smoothstep(0.55, 0.95, abs(vGroove.x)) * (1.0 - smoothstep(0.95, 1.0, abs(vGroove.x)));
        float tread = step(0.6, fract(vGroove.y * ${TRACKS.tread.toFixed(1)})) * (1.0 - wall);
        float dark = 0.04 + 0.16 * wall + 0.04 * tread;
        gl_FragColor = vec4(vec3(1.0 - dark * alpha), 1.0); // multiplier on the sand: fades to 1 (no change), never black
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // ring slots can be far apart, so one bounds check cannot cull them safely
  scene.add(mesh);

  const last = Array.from({ length: wheelCount }, () => new THREE.Vector3());
  const lastSide = Array.from({ length: wheelCount }, () => new THREE.Vector3());
  const touching = Array.from({ length: wheelCount }, () => false);
  const next = new Uint16Array(wheelCount);
  const travelled = new Float32Array(wheelCount); // m along each wheel's track, for the tread pattern
  const point = new THREE.Vector3();
  const side = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  function write(vertex: number, p: THREE.Vector3, across: THREE.Vector3, sign: number, time: number, along: number) {
    const offset = vertex * 3;
    const half = TRACKS.width / 2;
    positions[offset] = p.x + across.x * half * sign;
    positions[offset + 1] = p.y + TRACKS.lift;
    positions[offset + 2] = p.z + across.z * half * sign;
    spawn[vertex] = time;
    grooves[vertex * 2] = sign;
    grooves[vertex * 2 + 1] = along;
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
      const from = travelled[i];
      const to = (travelled[i] += point.distanceTo(last[i]));
      write(slot, last[i], lastSide[i], -1, time, from);
      write(slot + 1, last[i], lastSide[i], 1, time, from);
      write(slot + 2, point, side, -1, time, to);
      write(slot + 3, last[i], lastSide[i], 1, time, from);
      write(slot + 4, point, side, 1, time, to);
      write(slot + 5, point, side, -1, time, to);
      position.addUpdateRange(slot * 3, 18);
      born.addUpdateRange(slot, 6);
      groove.addUpdateRange(slot * 2, 12);
      position.needsUpdate = true;
      born.needsUpdate = true;
      groove.needsUpdate = true;
      next[i] = (next[i] + 1) % TRACKS.segmentsPerWheel;
      last[i].copy(point);
      lastSide[i].copy(side);
    }
  }

  return { update };
}
