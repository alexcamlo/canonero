import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createTruck, TRUCK } from './truck';

test('low-poly body fits the chassis and wheels retain their physics-driven transforms', async () => {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20).setTranslation(0, -0.1, 0));
    const truck = createTruck(world, new THREE.Scene(), new THREE.Vector3(0, 1.5, 0), () => 'soft');
    const [body, ...wheels] = truck.mesh.children;
    let triangles = 0;
    truck.mesh.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry;
      triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
      expect(object.castShadow).toBe(true);
      expect(object.material).toBeInstanceOf(THREE.MeshLambertMaterial);
      expect(object.material.map).toBeNull();
      expect([...geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
    });
    expect(triangles).toBeGreaterThanOrEqual(2000);
    expect(triangles).toBeLessThanOrEqual(5000);
    const bounds = new THREE.Box3().setFromObject(body);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(4.6);
    expect(size.x).toBeLessThan(5);
    expect(size.z).toBeLessThan(2.2); // mirrors included
    expect(bounds.max.y).toBeLessThan(1.25);
    expect(wheels).toHaveLength(4);
    for (const wheel of wheels) {
      expect(Math.abs(wheel.position.x)).toBe(TRUCK.wheelX);
      expect(Math.abs(wheel.position.z)).toBe(TRUCK.wheelZ);
      const geometry = (wheel as THREE.Mesh).geometry;
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.max.x).toBeCloseTo(TRUCK.wheelRadius);
      expect(geometry.boundingBox!.max.y).toBeCloseTo(TRUCK.wheelRadius);
    }

    const input = { throttle: 0, brake: 0, steer: 0, rangeToggle: false, airDown: false, compressor: false };
    const step = () => {
      truck.update(input, 1 / 60);
      world.step();
      truck.render(1);
    };
    for (let i = 0; i < 180; i++) step();
    const atRest = wheels[0].position.y;
    input.throttle = 1;
    input.steer = 0.5;
    input.airDown = true;
    for (let i = 0; i < 60; i++) step();
    const state = truck.state();
    wheels.forEach((wheel, i) => {
      expect(wheel.position.y).toBeCloseTo(TRUCK.wheelY - truck.vehicle.wheelSuspensionLength(i)! - state.sinkage[i] * TRUCK.sinkDepth);
      expect(wheel.rotation.z).toBeCloseTo(truck.vehicle.wheelRotation(i)!);
      expect(wheel.rotation.y).toBeCloseTo(truck.vehicle.wheelSteering(i)!);
      expect(wheel.scale.x).toBeCloseTo(0.9 + 0.1 * state.pressure);
    });
    expect(wheels[0].position.y).not.toBeCloseTo(atRest);
    expect(Math.abs(wheels[0].rotation.y)).toBeGreaterThan(0.1);
    expect(Math.abs(wheels[0].rotation.z)).toBeGreaterThan(0.1);
    expect(wheels[2].rotation.y).toBe(0);
    expect(state.sinkage.some((depth) => depth > 0)).toBe(true);
  } finally {
    world.free();
  }
});
