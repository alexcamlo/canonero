import * as THREE from 'three';

const DISTANCE = 9;
const HEIGHT = 3.5;
const FOLLOW = 4; // 1/s, position damping
const LOOK = 10; // 1/s, aim damping

const heading = new THREE.Vector3(1, 0, 0);
const desired = new THREE.Vector3();
const aim = new THREE.Vector3();
const lookAt = new THREE.Vector3();

// Follow the interpolated truck mesh with frame-rate independent damping.
export function updateChaseCamera(
  camera: THREE.Camera,
  target: THREE.Object3D,
  dt: number,
  ground: (x: number, z: number) => number,
) {
  const fwd = desired.set(1, 0, 0).applyQuaternion(target.quaternion).setY(0);
  if (fwd.lengthSq() > 0.01) heading.lerp(fwd.normalize(), 1 - Math.exp(-FOLLOW * dt)).normalize(); // yaw only: roll/pitch don't swing the camera

  desired.copy(target.position).addScaledVector(heading, -DISTANCE).setY(target.position.y + HEIGHT);
  camera.position.lerp(desired, 1 - Math.exp(-FOLLOW * dt));
  camera.position.y = Math.max(camera.position.y, ground(camera.position.x, camera.position.z) + 1); // stay out of dunes behind us
  aim.copy(target.position).setY(target.position.y + 1.2);
  lookAt.lerp(aim, 1 - Math.exp(-LOOK * dt));
  camera.lookAt(lookAt);
}
