import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { createAudio } from './audio';
import { setHoodView, updateChaseCamera, updateHoodCamera } from './camera';
import { createChunks } from './chunks';
import { createHud } from './hud';
import { readInput } from './input';
import { createScene } from './scene';
import { createGroundColor, createHeight, createSoftness, findFlatSpot, seedFromUrl } from './terrain';
import { createTouchControls } from './touch';
import { createTracks } from './tracks';
import { createTruck, TRUCK } from './truck';

const STEP = 1 / 60;

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;

const { renderer, scene, camera, update } = createScene();

const seed = seedFromUrl();
const height = createHeight(seed);
const softness = createSoftness(height);
const chunks = createChunks(world, scene, height, createGroundColor(seed));
chunks.update(new THREE.Vector3(), Infinity);

const spawn = findFlatSpot(height, softness, 0, 0, 150, 10); // the origin can sit on a mega-dune's face
const truck = createTruck(world, scene, new THREE.Vector3(spawn.x, height(spawn.x, spawn.z) + 1.5, spawn.z), softness);
const tracks = createTracks(scene, truck);
const hud = createHud();
createTouchControls();
const audio = createAudio();
const fwd = new THREE.Vector3();
camera.position.set(spawn.x - 10, height(spawn.x - 10, spawn.z) + 4, spawn.z);
let hood = false;
const toggleView = () => setHoodView(camera, (hood = !hood));

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyF') truck.flip();
  if (e.code === 'KeyC') toggleView();
  if (e.code === 'KeyT') {
    const p = truck.body.translation();
    const spot = findFlatSpot(height, softness, p.x, p.z);
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
  if (input.viewToggle) toggleView();
  while (acc >= STEP) {
    truck.update(input, STEP);
    world.step();
    acc -= STEP;
  }

  truck.render(acc / STEP);
  fwd.set(1, 0, 0).applyQuaternion(truck.body.rotation()); // truck forward is +x
  const state = truck.state();
  hud.update(state, fwd.x, fwd.z, dt);
  const speed = truck.vehicle.currentVehicleSpeed();
  const throttle = speed > 0.5 ? input.throttle : speed < -0.5 ? input.brake : Math.max(input.throttle, input.brake);
  let wheelSpeed = 0;
  let sinkage = 0;
  let contacts = 0;
  for (let i = 0; i < 4; i++) {
    const contact = truck.vehicle.wheelIsInContact(i) && truck.vehicle.wheelContactPoint(i);
    if (!contact) continue;
    const v = truck.body.velocityAtPoint(contact);
    // Raycast wheels use the same slow-speed spin approximation as the sinkage model.
    wheelSpeed += Math.hypot(v.x, v.z) + throttle * Math.max(0, TRUCK.spinSpeed - Math.abs(speed));
    sinkage += state.sinkage[i];
    contacts++;
  }
  audio.update({ rpm: state.rpm, throttle, speed, wheelSpeed: wheelSpeed / 4, sinkage: contacts ? sinkage / contacts : 0 });
  tracks.update(now / 1000);
  chunks.update(truck.mesh.position);
  if (hood) updateHoodCamera(camera, truck.mesh, dt);
  else updateChaseCamera(camera, truck.mesh, dt, height);
  truck.headlights(update(dt, truck.mesh.position));
  renderer.render(scene, camera);
});
