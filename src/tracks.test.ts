import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createGroundColor, createHeight, createSoftness, regionWeights } from './terrain';
import { createTracks } from './tracks';
import type { createTruck } from './truck';

function setup(soft = 1, slope = 0) {
  const scene = new THREE.Scene();
  const point = new THREE.Vector3();
  let touching = true;
  const truck = {
    body: { rotation: () => new THREE.Quaternion() },
    vehicle: {
      numWheels: () => 1,
      wheelIsInContact: () => touching,
      wheelContactPoint: () => point,
      wheelContactNormal: () => new THREE.Vector3(0, 1, -slope).normalize(),
    },
  } as unknown as ReturnType<typeof createTruck>;
  const tracks = createTracks(scene, truck, (_x, z) => z * slope, () => soft, createGroundColor('dune'));
  const mesh = scene.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  return { tracks, point, mesh, contact: (value: boolean) => { touching = value; } };
}

test('ruts follow cross-slopes, share endpoints, and store local sand colour', () => {
  const { tracks, point, mesh } = setup(1, 0.4);
  tracks.update(0, [0.5]);
  point.x = 1;
  tracks.update(1, [0.5]);
  point.x = 2;
  tracks.update(2, [0.5]);
  const { position, normal, color } = mesh.geometry.attributes;
  for (let i = 0; i < 12; i++) {
    expect(position.getY(i) - position.getZ(i) * 0.4).toBeCloseTo(0.015);
    expect(normal.getY(i)).toBeGreaterThan(0);
    expect(normal.getZ(i) / normal.getY(i)).toBeCloseTo(-0.4);
  }
  for (const a of ['position', 'normal', 'color', 'groove', 'across', 'depth']) {
    const attr = mesh.geometry.getAttribute(a);
    expect(Array.from(attr.array.slice(2 * attr.itemSize, 3 * attr.itemSize)))
      .toEqual(Array.from(attr.array.slice(6 * attr.itemSize, 7 * attr.itemSize)));
  }
  const rgb = createGroundColor('dune')(0, 0, 1);
  const expected = new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace);
  expect(color.getX(0)).toBeCloseTo(expected.r);
  expect(mesh.material.blending).toBe(THREE.NormalBlending);
  expect(mesh.receiveShadow).toBe(true);
});

test('loose sand and sinkage deepen ruts; firm ground stays shallow', () => {
  const depth = (soft: number, sink: number) => {
    const { tracks, point, mesh } = setup(soft);
    tracks.update(0, [sink]);
    point.x = 1;
    tracks.update(1, [sink]);
    return mesh.geometry.getAttribute('depth').getX(0);
  };
  expect(depth(0, 1)).toBeLessThan(0.1);
  expect(depth(1, 0)).toBeGreaterThan(depth(0, 0) * 5);
  expect(depth(1, 1)).toBeGreaterThan(depth(1, 0));
});

test('airborne gaps are not joined and ring storage wraps without growing', () => {
  const { tracks, point, mesh, contact } = setup();
  const born = mesh.geometry.getAttribute('born');
  const position = mesh.geometry.getAttribute('position');
  const capacity = born.count / 6;
  tracks.update(0, [0]);
  point.x = 1;
  tracks.update(1, [0]);
  contact(false);
  tracks.update(2, [0]);
  point.x = 20;
  contact(true);
  tracks.update(3, [0]);
  expect(born.getX(6)).toBeLessThan(0);
  point.x = 21;
  tracks.update(4, [0]);
  expect(position.getX(6)).toBeCloseTo(20);
  for (let i = 0; i < capacity; i++) {
    point.x++;
    tracks.update(i + 5, [0]);
  }
  expect(mesh.geometry.getAttribute('position')).toBe(position);
  expect(born.count).toBe(capacity * 6);
  expect(born.getX(0)).toBe(capacity + 3);
  expect(born.getX(6)).toBe(capacity + 4);
});

test('terrain samplers can reuse output buffers without changing their values', () => {
  const h = createHeight('dune');
  const soft = createSoftness(h);
  const color = createGroundColor('dune');
  const weights = regionWeights('dune');
  const out: [number, number, number] = [0, 0, 0];
  for (const [x, z] of [[0, 0], [180, 120], [-450, 320]]) {
    expect(weights(x, z, out)).toBe(out);
    expect(out).toEqual(weights(x, z));
    expect(color(x, z, soft(x, z), out)).toBe(out);
    expect(out).toEqual(color(x, z, soft(x, z)));
  }
});
