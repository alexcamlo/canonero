import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { createScene } from './scene';

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

// Test box: proves physics drives rendering
const boxBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 6, 0).setRotation({ x: 0.3, y: 0.2, z: 0.1, w: 0.93 }),
);
world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), boxBody);
const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x8a4b2d }));
box.castShadow = true;
scene.add(box);

camera.position.set(6, 4, 8);
camera.lookAt(0, 0.5, 0);

let acc = 0;
let last = performance.now();
renderer.setAnimationLoop((now) => {
  acc += Math.min((now - last) / 1000, 0.25); // clamp so a stalled tab doesn't spiral
  last = now;
  while (acc >= STEP) {
    world.step();
    acc -= STEP;
  }

  box.position.copy(boxBody.translation());
  box.quaternion.copy(boxBody.rotation());

  follow(box.position);
  renderer.render(scene, camera);
});
