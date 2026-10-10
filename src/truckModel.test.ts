import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createTruckModel } from './truckModel';
import { TRUCK } from './truck';

test('body stays low-poly and fits a ~4.7 m truck around the chassis', () => {
  const body = createTruckModel();
  let triangles = 0;
  body.traverse((o) => {
    if (o instanceof THREE.Mesh) triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
  });
  expect(triangles).toBeLessThanOrEqual(5000);
  const size = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
  expect(size.x).toBeGreaterThan(4.6);
  expect(size.x).toBeLessThan(5);
  expect(size.z).toBeLessThan(2.2); // mirrors included
});

test('arches clear the tyre crown at full suspension compression', () => {
  const body = createTruckModel();
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
        // Stop at the tyre's inner face, before the recessed wheel-well backing.
        ray.far = 2 - (TRUCK.wheelZ - 0.17);
        expect(ray.intersectObject(body, true), `axle ${axle}, side ${side}, angle ${angle}`).toHaveLength(0);
      }
    }
  }
});
