import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createTruckModel } from './truckModel';

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
