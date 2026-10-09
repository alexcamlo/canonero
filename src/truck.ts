import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Input } from './input';
import { GEARBOX, shift, type Range } from './gearbox';

// Truck faces +x (Rapier's default vehicle forward axis), y is up, +z is the right side.
export const TRUCK = {
  mass: 2000, // kg
  halfExtents: { x: 2.3, y: 0.45, z: 0.95 }, // chassis collider
  centerOfMassY: -0.1, // a bit below the box centre: visible roll without tipping in normal turns
  wheelX: 1.4, // half wheelbase
  wheelZ: 0.82, // half track
  wheelY: -0.25, // suspension mount, relative to chassis centre
  wheelRadius: 0.4,
  suspensionRest: 0.5,
  suspensionTravel: 0.35,
  suspensionStiffness: 12, // per unit chassis mass (Bullet-style); lower = softer, more sag
  suspensionCompression: 1.2, // damping while compressing
  suspensionRelaxation: 1.6, // damping while extending
  maxSuspensionForce: 40000, // N per wheel
  frictionSlip: 2.2,
  sideFrictionStiffness: 0.9,
  engineForce: 2000, // N per wheel, all four driven, before the gearbox multiplier; fades out (quadratically) to zero at the range's top speed
  reverseSpeed: 8, // m/s
  brakeForce: 50, // per wheel
  idleBrake: 2, // engine braking when no pedal is pressed
  maxSteer: 0.55, // rad
  steerRate: 1.6, // rad/s, how fast the wheel turns toward the target
  flipLift: 1.5, // m, how far flip/reset drop the truck from
  steerFalloff: 18, // m/s; steering lock halves at this speed
};

const T = TRUCK;

export function createTruck(world: RAPIER.World, scene: THREE.Scene, start: THREE.Vector3) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(start.x, start.y, start.z).setCanSleep(false),
  );
  const { x: hx, y: hy, z: hz } = T.halfExtents;
  const m = T.mass;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(hx, hy, hz).setMassProperties(
      m,
      { x: 0, y: T.centerOfMassY, z: 0 },
      // solid box inertia about roll (x), yaw (y), pitch (z)
      { x: (m / 3) * (hy * hy + hz * hz), y: (m / 3) * (hx * hx + hz * hz), z: (m / 3) * (hx * hx + hy * hy) },
      { x: 0, y: 0, z: 0, w: 1 },
    ),
    body,
  );

  const vehicle = world.createVehicleController(body);
  const wheelMounts = [
    [T.wheelX, -T.wheelZ],
    [T.wheelX, T.wheelZ],
    [-T.wheelX, -T.wheelZ],
    [-T.wheelX, T.wheelZ],
  ];
  for (const [x, z] of wheelMounts) {
    vehicle.addWheel({ x, y: T.wheelY, z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, T.suspensionRest, T.wheelRadius);
  }
  for (let i = 0; i < 4; i++) {
    vehicle.setWheelMaxSuspensionTravel(i, T.suspensionTravel);
    vehicle.setWheelSuspensionStiffness(i, T.suspensionStiffness);
    vehicle.setWheelSuspensionCompression(i, T.suspensionCompression);
    vehicle.setWheelSuspensionRelaxation(i, T.suspensionRelaxation);
    vehicle.setWheelMaxSuspensionForce(i, T.maxSuspensionForce);
    vehicle.setWheelFrictionSlip(i, T.frictionSlip);
    vehicle.setWheelSideFrictionStiffness(i, T.sideFrictionStiffness);
  }

  // Visuals: chassis group carries the body boxes and the wheels, so wheels inherit the interpolated pose.
  const mesh = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: 0xe8e2d4 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), paint);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(hx * 1.3, 0.75, hz * 1.9), paint);
  cabin.position.set(-hx * 0.3, hy + 0.37, 0); // boxy rear, short bonnet
  mesh.add(lower, cabin);
  const tyre = new THREE.MeshLambertMaterial({ color: 0x2b2420 });
  const wheelGeo = new THREE.CylinderGeometry(T.wheelRadius, T.wheelRadius, 0.3, 16).rotateX(Math.PI / 2);
  const wheels = wheelMounts.map(([x, z]) => {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.position.set(x, T.wheelY, z);
    mesh.add(w);
    return w;
  });
  mesh.traverse((o) => (o.castShadow = true));
  scene.add(mesh);

  // Pose before the latest physics step, so render() can interpolate between it and the current pose.
  const prevPos = new THREE.Vector3().copy(start);
  const prevRot = new THREE.Quaternion();
  const currPos = new THREE.Vector3();
  const currRot = new THREE.Quaternion();
  let steer = 0;
  let range: Range = 'high';
  let gear = 1;
  let rpm = 0;

  // Call once per fixed physics step, before world.step().
  function update(input: Input, dt: number) {
    prevPos.copy(body.translation());
    prevRot.copy(body.rotation());

    const speed = vehicle.currentVehicleSpeed();
    const box = shift(speed, range, gear);
    gear = box.gear;
    rpm = box.rpm;
    const topSpeed = GEARBOX.topSpeed[range];
    const force = T.engineForce * box.driveForceMultiplier;
    let engine = 0;
    let brake = input.throttle || input.brake ? 0 : T.idleBrake;
    if (input.throttle > 0) {
      if (speed < -0.5) brake = input.throttle * T.brakeForce;
      else engine = input.throttle * force * Math.max(0, 1 - (speed / topSpeed) ** 2);
    }
    if (input.brake > 0) {
      if (speed > 0.5) brake = input.brake * T.brakeForce;
      else engine = -input.brake * force * Math.max(0, 1 + speed / T.reverseSpeed);
    }

    const target = (input.steer * T.maxSteer) / (1 + Math.abs(speed) / T.steerFalloff);
    steer += THREE.MathUtils.clamp(target - steer, -T.steerRate * dt, T.steerRate * dt);

    for (let i = 0; i < 4; i++) {
      vehicle.setWheelEngineForce(i, engine);
      vehicle.setWheelBrake(i, brake);
      if (i < 2) vehicle.setWheelSteering(i, steer);
    }
    vehicle.updateVehicle(dt);
  }

  // Teleport: upright (keeping yaw if given), at rest, with no interpolation across the jump.
  function place(x: number, y: number, z: number, yaw: number) {
    body.setTranslation({ x, y, z }, true);
    body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    prevPos.copy(body.translation());
    prevRot.copy(body.rotation());
  }

  // Put the truck upright at (x, z), dropped from a bit above groundY, facing the way it did.
  function reset(x: number, z: number, groundY: number) {
    const q = body.rotation();
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    place(x, groundY + T.flipLift, z, Math.atan2(-fwd.z, fwd.x));
  }

  // Right the truck where it is.
  function flip() {
    const p = body.translation();
    reset(p.x, p.z, p.y);
  }

  // Call after the physics steps of a frame; alpha = leftover accumulator / step.
  function render(alpha: number) {
    mesh.position.lerpVectors(prevPos, currPos.copy(body.translation()), alpha);
    mesh.quaternion.slerpQuaternions(prevRot, currRot.copy(body.rotation()), alpha);
    wheels.forEach((w, i) => {
      w.position.y = T.wheelY - (vehicle.wheelSuspensionLength(i) ?? T.suspensionRest);
      w.rotation.set(0, vehicle.wheelSteering(i) ?? 0, vehicle.wheelRotation(i) ?? 0, 'YXZ');
    });
  }

  function toggleRange() {
    range = range === 'high' ? 'low' : 'high';
  }

  // gear/rpm are exposed for the later HUD and audio tickets
  return { body, vehicle, mesh, update, render, flip, reset, toggleRange, state: () => ({ range, gear, rpm }) };
}
