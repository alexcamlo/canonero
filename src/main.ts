import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { updateChaseCamera } from './camera';
import { createChunks } from './chunks';
import { createHud } from './hud';
import { readInput } from './input';
import { createScene } from './scene';
import { createHeight, findFlatSpot, seedFromUrl, SOFT_PATCHES } from './terrain';
import { createTracks } from './tracks';
import { createTruck } from './truck';

const STEP = 1 / 60;

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;

const { renderer, scene, camera, follow } = createScene();

const height = createHeight(seedFromUrl());
const chunks = createChunks(world, scene, height);
chunks.update(new THREE.Vector3(), Infinity);

// Soft patches as darker discs draped over the dunes (#12 replaces this with real materials).
const softMaterial = new THREE.MeshLambertMaterial({ color: 0xb98450, polygonOffset: true, polygonOffsetFactor: -2 });
for (const p of SOFT_PATCHES) {
  const geometry = new THREE.RingGeometry(0, p.r, 48, 24).rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(p.x + pos.getX(i), p.z + pos.getZ(i)) + 0.05);
  geometry.computeVertexNormals();
  const disc = new THREE.Mesh(geometry, softMaterial);
  disc.position.set(p.x, 0, p.z);
  disc.receiveShadow = true;
  scene.add(disc);
}

const truck = createTruck(world, scene, new THREE.Vector3(0, height(0, 0) + 1.5, 0));
const tracks = createTracks(scene, truck);
const hud = createHud();
const fwd = new THREE.Vector3();
camera.position.set(-10, height(-10, 0) + 4, 0);

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyF') truck.flip();
  if (e.code === 'KeyT') {
    const p = truck.body.translation();
    const spot = findFlatSpot(height, p.x, p.z);
    truck.reset(spot.x, spot.z, height(spot.x, spot.z));
  }
});

let acc = 0;
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.25); // clamp so a stalled tab doesn't spiral
  last = now;
  acc += dt;
  const input = readInput();
  if (input.rangeToggle) truck.toggleRange(); // once per frame, not per physics step
  while (acc >= STEP) {
    truck.update(input, STEP);
    world.step();
    acc -= STEP;
  }

  truck.render(acc / STEP);
  fwd.set(1, 0, 0).applyQuaternion(truck.body.rotation()); // truck forward is +x
  hud.update(truck.state(), fwd.x, fwd.z, dt);
  tracks.update(now / 1000);
  chunks.update(truck.mesh.position);
  updateChaseCamera(camera, truck.mesh, dt, height);
  follow(truck.mesh.position);
  renderer.render(scene, camera);
});
