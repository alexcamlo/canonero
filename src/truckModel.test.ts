/// <reference types="node" />
import { readFileSync } from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, test } from 'vitest';
import { createTruckModel } from './truckModel';
import { createTruck, TRUCK } from './truck';

async function readModel() {
  const bytes = readFileSync(new URL('../public/models/prado-j90.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return scene;
}

test('GLB wheels match physics mounts, radius and outward orientation', async () => {
  const { body, wheels } = createTruckModel(await readModel(), TRUCK);
  expect(wheels).toHaveLength(4);
  for (const [i, wheel] of wheels.entries()) {
    expect(body.getObjectByName(wheel.name)).toBeUndefined();
    expect(wheel.position.toArray()).toEqual([i < 2 ? TRUCK.wheelX : -TRUCK.wheelX, TRUCK.wheelY, i % 2 ? TRUCK.wheelZ : -TRUCK.wheelZ]);
    const bounds = new THREE.Box3().setFromObject(wheel);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x / 2).toBeCloseTo(TRUCK.wheelRadius, 2);
    expect(size.y / 2).toBeCloseTo(TRUCK.wheelRadius, 2);
    const outward = new THREE.Vector3(0, 0, -1).applyQuaternion(wheel.children[0].quaternion);
    expect(outward.z).toBeCloseTo(i % 2 ? 1 : -1);
    const orientation = wheel.children[0].quaternion.clone();
    wheel.rotation.set(0, 0.4, 1.2, 'YXZ');
    wheel.scale.set(0.94, 0.94, 1);
    expect(wheel.children[0].quaternion.equals(orientation)).toBe(true);
  }
  expect(new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3()).x).toBeLessThan(5.2);
});

test('imported arches clear the tyre crown at full suspension compression', async () => {
  const { body } = createTruckModel(await readModel(), TRUCK);
  body.updateMatrixWorld(true);
  const wheelY = TRUCK.wheelY - (TRUCK.suspensionRest - TRUCK.suspensionTravel);
  const ray = new THREE.Raycaster();
  for (const axle of [-TRUCK.wheelX, TRUCK.wheelX]) {
    for (const side of [-1, 1]) {
      for (let i = 0; i <= 24; i++) {
        const angle = Math.PI * i / 24;
        const x = axle + TRUCK.wheelRadius * Math.cos(angle);
        const y = wheelY + TRUCK.wheelRadius * Math.sin(angle);
        ray.set(new THREE.Vector3(x, y, side * 2), new THREE.Vector3(0, 0, -side));
        ray.far = 2 - (TRUCK.wheelZ - 0.12);
        expect(ray.intersectObject(body, true), `axle ${axle}, side ${side}, angle ${angle}`).toHaveLength(0);
      }
    }
  }
}, 120000);

test('imported truck drives, steers, deflates and lights the road', async () => {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.1, 100).setTranslation(0, -0.1, 0));
    const truck = createTruck(world, new THREE.Scene(), new THREE.Vector3(0, 1.5, 0), () => 0, await readModel());
    const input = { throttle: 0, brake: 0, steer: 0, rangeToggle: false, viewToggle: false, airDown: false, compressor: false };
    for (let i = 0; i < 120; i++) {
      truck.update(input, 1 / 60);
      world.step();
    }
    const start = truck.body.translation();
    input.throttle = 1;
    input.steer = 0.5;
    input.airDown = true;
    for (let i = 0; i < 120; i++) {
      truck.update(input, 1 / 60);
      world.step();
      truck.render(1);
    }
    expect(new THREE.Vector3().copy(truck.body.translation()).distanceTo(start)).toBeGreaterThan(1);
    const front = truck.mesh.getObjectByName('wheel_front_left')!;
    const rear = truck.mesh.getObjectByName('wheel_rear_left')!;
    expect(front.rotation.y).toBeCloseTo(truck.vehicle.wheelSteering(0)!);
    expect(rear.rotation.y).toBe(0);
    expect(Math.abs(front.rotation.z)).toBeGreaterThan(0.1);
    expect(front.scale.y).toBeLessThan(1);
    truck.headlights(1);
    const spots = truck.mesh.children.filter((child) => child instanceof THREE.SpotLight);
    const lamps = spots.filter((child) => !child.name.startsWith('driving_'));
    const driving = spots.filter((child) => child.name.startsWith('driving_'));
    expect(driving).toHaveLength(4);
    expect(driving.every((lamp) => lamp.intensity > 0 && lamp.target.position.x > lamp.position.x)).toBe(true);
    expect(driving.filter((lamp) => lamp.angle < 0.2)).toHaveLength(2);
    truck.mesh.updateMatrixWorld(true);
    for (const side of ['left', 'right']) {
      const mount = truck.mesh.getObjectByName(`driving_light_${side}`)!;
      const position = mount.getWorldPosition(new THREE.Vector3());
      for (const kind of ['flood', 'long']) {
        const beam = truck.mesh.getObjectByName(`driving_${kind}_${side}`)!;
        expect(beam.getWorldPosition(new THREE.Vector3()).distanceTo(position)).toBeCloseTo(0.05, 3);
        expect(beam.castShadow).toBe(false);
      }
    }
    expect(truck.mesh.getObjectByName('hood_scoop')).toBeDefined();
    expect(lamps).toHaveLength(2);
    expect(lamps.every((lamp) => lamp.intensity === TRUCK.headlightIntensity)).toBe(true);
    const lenses: THREE.MeshStandardMaterial[] = [];
    truck.mesh.traverse((node) => { if (node instanceof THREE.Mesh && node.material.name === 'headlamp') lenses.push(node.material); });
    expect(lenses.length).toBeGreaterThan(0);
    expect(lenses.every((material) => material.emissive.r === 1)).toBe(true);
    truck.headlights(0);
    expect(driving.every((lamp) => lamp.intensity === 0)).toBe(true);
    expect(lenses.every((material) => material.emissive.r === 0)).toBe(true);
  } finally {
    world.free();
  }
}, 120000);


test('glazing covers upper and lower window edges on both sides, front and rear', async () => {
  const model = await readModel();
  model.updateMatrixWorld(true);
  const glass = model.getObjectByName('glass')!;
  const ray = new THREE.Raycaster();
  for (const side of [-1, 1]) {
    for (const [x, y] of [[-1.5, 1.90], [-0.5, 1.85], [0.3, 1.76], [-1.5, 1.45], [-0.5, 1.40], [0.3, 1.38]]) {
      ray.set(new THREE.Vector3(x, y, side * 2), new THREE.Vector3(0, 0, -side));
      ray.far = 1.4;
      expect(ray.intersectObject(glass).length, `side ${side}, window edge ${x}, ${y}`).toBeGreaterThan(0);
    }
  }
  for (const end of [-1, 1]) {
    for (const y of [1.45, 1.80]) {
      for (const z of [-0.5, 0, 0.5]) {
        ray.set(new THREE.Vector3(end * 3, y, z), new THREE.Vector3(-end, 0, 0));
        ray.far = end > 0 ? 3.2 : 1.2;
        expect(ray.intersectObject(glass).length, `end ${end}, window edge ${y}, ${z}`).toBeGreaterThan(0);
      }
    }
  }
});
