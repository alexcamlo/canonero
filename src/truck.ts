import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Input } from './input';
import { GEARBOX, shift } from './gearbox';
import { drag, stepSinkage, traction, wheelSpin } from './sinkage';
import { createTruckModel } from './truckModel';

// Truck faces +x (Rapier's default vehicle forward axis), y is up, +z is the right side.
export const TRUCK = {
  mass: 2000, // kg
  halfExtents: { x: 2.3, y: 0.45, z: 0.95 }, // chassis collider
  centerOfMassY: -0.35, // low enough that cornering load doesn't bottom the outer springs and trip the truck on flat ground; steep sidehills can still roll it
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
  frictionSlip: 0.75, // Rapier allows twice this longitudinal force / wheel load
  sideFrictionStiffness: 0.9,
  engineForce: 2000, // N per wheel, all four driven, before the gearbox multiplier; fades out (quadratically) to zero at top speed
  reverseSpeed: 8, // m/s
  brakeForce: 50, // per wheel
  idleBrake: 2, // engine braking when no pedal is pressed
  maxSteer: 0.55, // rad
  steerRate: 1.6, // rad/s, how fast the wheel turns toward the target
  flipLift: 1.5, // m, how far flip/reset drop the truck from
  steerFalloff: 18, // m/s; steering lock halves at this speed
  sinkDepth: 0.2, // m, how far a fully sunk wheel sits into the sand (suspension rest shortens by the same)
  sandPressure: 0.4, // fixed normalized sand-tyre setup, not a real-world pressure prescription
  airedTopSpeed: 0.6, // top speed fraction at zero pressure
  airedSideGrip: 0.6, // cornering grip fraction at zero pressure
  airedSteerRate: 0.6, // steering speed fraction at zero pressure
  headlightIntensity: 60, // per lamp at full dark; falls off with distance (decay 1, for a longer throw than physical)
  headlightAngle: 0.5, // rad, beam half-angle
};

const T = TRUCK;

export function createTruck(world: RAPIER.World, scene: THREE.Scene, start: THREE.Vector3, softnessAt: (x: number, z: number) => number, model: THREE.Group) {
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

  // Body and physics-driven wheels share the interpolated chassis pose.
  const mesh = new THREE.Group();
  const { body: visualBody, wheels } = createTruckModel(model, T);
  mesh.add(visualBody, ...wheels);
  const headlamps = new Set<THREE.MeshStandardMaterial>();
  mesh.traverse((o) => {
    o.castShadow = true;
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.name === 'headlamp') headlamps.add(o.material);
  });
  scene.add(mesh);

  // Headlights, added after the shadow pass above: the sun/moon stays the only shadow caster.
  const beams = [-0.6, 0.6].map((z) => {
    const beam = new THREE.SpotLight(0xfff0d8, 0, 0, T.headlightAngle, 0.5, 1);
    beam.position.set(2.3, 0.1, z);
    beam.target.position.set(20, -1.3, z * 2); // dipped onto the sand ahead
    mesh.add(beam, beam.target);
    return beam;
  });

  const drivingBeams: THREE.SpotLight[] = [];
  for (const side of ['left', 'right']) {
    const mount = mesh.getObjectByName(`driving_light_${side}`);
    if (!mount) throw new Error(`Truck model is missing driving_light_${side}`);
    for (const [kind, angle, reach] of [['flood', 0.65, 35], ['long', 0.16, 140]] as const) {
      const beam = new THREE.SpotLight(0xfff8e8, 0, reach, angle, 0.6, 1);
      beam.name = `driving_${kind}_${side}`;
      mesh.worldToLocal(mount.getWorldPosition(beam.position));
      beam.position.x += 0.05;
      beam.target.position.copy(beam.position).add(new THREE.Vector3(reach, -1.2, 0));
      mesh.add(beam, beam.target);
      drivingBeams.push(beam);
    }
  }

  // Pose before the latest physics step, so render() can interpolate between it and the current pose.
  const prevPos = new THREE.Vector3().copy(start);
  const prevRot = new THREE.Quaternion();
  const currPos = new THREE.Vector3();
  const currRot = new THREE.Quaternion();
  let steer = 0;
  let gear = 1;
  let rpm = 0;
  const sinkage = [0, 0, 0, 0];
  const pressure = T.sandPressure;
  // Scratch objects: update() runs every physics step, so don't allocate there.
  const fwd = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const rolling = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const axes = [rolling, lateral];
  const contact = new THREE.Vector3();
  const rot = new THREE.Quaternion();

  const forward = () => {
    const q = body.rotation();
    return fwd.set(1, 0, 0).applyQuaternion(rot.set(q.x, q.y, q.z, q.w));
  };

  // Call once per fixed physics step, before world.step().
  function update(input: Input, dt: number) {
    prevPos.copy(body.translation());
    prevRot.copy(body.rotation());

    const speed = vehicle.currentVehicleSpeed();
    const box = shift(speed, gear);
    gear = box.gear;
    rpm = box.rpm;
    const topSpeed = GEARBOX.topSpeed * THREE.MathUtils.lerp(T.airedTopSpeed, 1, pressure);
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
    const steerRate = T.steerRate * THREE.MathUtils.lerp(T.airedSteerRate, 1, pressure);
    const steerDelta = THREE.MathUtils.clamp(target - steer, -steerRate * dt, steerRate * dt);
    steer += steerDelta;

    rot.copy(body.rotation());
    for (let i = 0; i < 4; i++) {
      vehicle.setWheelEngineForce(i, engine);
      vehicle.setWheelBrake(i, brake);
      contact.set(wheelMounts[i][0], T.wheelY, wheelMounts[i][1]).applyQuaternion(rot).add(prevPos);
      vehicle.setWheelFrictionSlip(i, T.frictionSlip * traction(sinkage[i], pressure, softnessAt(contact.x, contact.z)));
      vehicle.setWheelSideFrictionStiffness(i, T.sideFrictionStiffness * THREE.MathUtils.lerp(T.airedSideGrip, 1, pressure));
      vehicle.setWheelSuspensionRestLength(i, T.suspensionRest - sinkage[i] * T.sinkDepth);
      if (i < 2) vehicle.setWheelSteering(i, steer);
    }
    vehicle.updateVehicle(dt);

    for (let i = 0; i < 4; i++) {
      const p = vehicle.wheelIsInContact(i) && vehicle.wheelContactPoint(i);
      const n = p && vehicle.wheelContactNormal(i);
      const load = Math.min(T.maxSuspensionForce, vehicle.wheelSuspensionForce(i) ?? 0);
      if (!p || !n || load <= 0) continue;
      const soft = softnessAt(p.x, p.z);
      normal.copy(n).normalize();
      const angle = vehicle.wheelSteering(i) ?? 0;
      lateral.set(Math.sin(angle), 0, Math.cos(angle)).applyQuaternion(rot);
      lateral.addScaledVector(normal, -lateral.dot(normal)).normalize();
      rolling.crossVectors(normal, lateral).normalize();
      const vp = body.velocityAtPoint(p);
      const along = rolling.dot(vp);
      const across = lateral.dot(vp);
      sinkage[i] = stepSinkage(sinkage[i], {
        softness: soft, groundSpeed: Math.hypot(along, across), pressure, load,
        wheelSpin: wheelSpin(engine, vehicle.wheelForwardImpulse(i) ?? 0, dt),
      }, dt);
      // Separate rolling and sideways ploughing, both tangent to the actual ground.
      for (const axis of axes) {
        const velocity = axis.dot(body.velocityAtPoint(p));
        const resistance = drag(sinkage[i], soft, load, axis === lateral);
        const impulse = -Math.sign(velocity) * Math.min(Math.abs(velocity) * T.mass / 4, resistance * dt);
        body.applyImpulseAtPoint(contact.copy(axis).multiplyScalar(impulse), p, true);
      }
    }
  }

  // Teleport: upright at the given yaw, at rest, with no interpolation across the jump.
  function place(x: number, y: number, z: number, yaw: number) {
    body.setTranslation({ x, y, z }, true);
    body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    sinkage.fill(0); // fresh ground, fresh start
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    prevPos.copy(body.translation());
    prevRot.copy(body.rotation());
  }

  // Put the truck upright at (x, z), dropped from a bit above groundY, facing the way it did.
  function reset(x: number, z: number, groundY: number) {
    const f = forward();
    place(x, groundY + T.flipLift, z, Math.atan2(-f.z, f.x));
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
      w.position.y = T.wheelY - (vehicle.wheelSuspensionLength(i) ?? T.suspensionRest) - sinkage[i] * T.sinkDepth;
      w.scale.set(0.9 + 0.1 * pressure, 0.9 + 0.1 * pressure, 1); // flatter tyre, smaller radius
      w.rotation.set(0, vehicle.wheelSteering(i) ?? 0, vehicle.wheelRotation(i) ?? 0, 'YXZ');
    });
  }

  // level 0..1: off by day, full at night.
  function headlights(level: number) {
    for (const beam of beams) beam.intensity = level * T.headlightIntensity;
    for (const beam of drivingBeams) beam.intensity = level * T.headlightIntensity * (beam.name.startsWith('driving_long') ? 2 : 1);
    for (const lamp of headlamps) lamp.emissive.setRGB(level, level, level * 0.85);
  }

  return { body, vehicle, mesh, update, render, flip, reset, headlights, state: () => ({ gear, rpm, sinkage: [...sinkage] }) };
}
