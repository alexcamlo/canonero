import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { updateChaseCamera } from './camera';
import { readInput } from './input';
import { createScene } from './scene';
import { createTruck } from './truck';

const STEP = 1 / 60;

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;

const { renderer, scene, camera, follow } = createScene();

// Flat ground
world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0));
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ color: 0xe2a96c }),
);
ground.receiveShadow = true;
scene.add(ground);

const truck = createTruck(world, scene, new THREE.Vector3(0, 1.5, 0));
camera.position.set(-10, 4, 0);

let acc = 0;
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.25); // clamp so a stalled tab doesn't spiral
  last = now;
  acc += dt;
  const input = readInput();
  while (acc >= STEP) {
    truck.update(input, STEP);
    world.step();
    acc -= STEP;
  }

  truck.render(acc / STEP);
  updateChaseCamera(camera, truck.mesh, dt);
  follow(truck.mesh.position);
  renderer.render(scene, camera);
});
