import * as THREE from 'three';

const DISTANCE = 9;
const HEIGHT = 3.5;
const FOLLOW = 4; // 1/s, position damping
const LOOK = 10; // 1/s, aim damping

const COCKPIT = {
  eye: new THREE.Vector3(0.1, 0.84, -0.34), // driver's head in truck-local coordinates: left-hand drive, so -z
  pitch: 0.07, // rad, looking slightly down over the bonnet
  fov: 72,
  near: 0.05, // the dashboard and headliner sit within ~0.1 m of the head
  turn: 14, // 1/s, rotation damping: bumps tilt the view instead of jolting it
};

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

// Camera -z is truck +x, tilted down by the pitch.
const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(-COCKPIT.pitch, -Math.PI / 2, 0, 'YXZ'));
const goal = new THREE.Quaternion();
const chase = { fov: 60, near: 0.1 };

// Swap lens settings with the view; the chase values are whatever the camera was created with.
export function setCockpit(camera: THREE.PerspectiveCamera, on: boolean) {
  if (on) Object.assign(chase, { fov: camera.fov, near: camera.near });
  camera.fov = on ? COCKPIT.fov : chase.fov;
  camera.near = on ? COCKPIT.near : chase.near;
  camera.updateProjectionMatrix();
}

// Sit at the driver's head on the interpolated truck pose; rigid position, smoothed rotation (roll and pitch included).
export function updateCockpitCamera(camera: THREE.Camera, target: THREE.Object3D, dt: number) {
  camera.position.copy(COCKPIT.eye).applyQuaternion(target.quaternion).add(target.position);
  camera.quaternion.slerp(goal.copy(target.quaternion).multiply(look), 1 - Math.exp(-COCKPIT.turn * dt));
}
