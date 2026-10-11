import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Input } from './input';
import { GEARBOX, shift, type Range } from './gearbox';
import { drag, plough, SINKAGE, stepSinkage, traction } from './sinkage';
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
  sinkDepth: 0.2, // m, how far a fully sunk wheel sits into the sand (suspension rest shortens by the same)
  spinSpeed: 2, // m/s; below this, throttle counts as wheelspin (fully at standstill)
  minPressure: 0.4, // fully aired down
  airDownRate: 0.3, // pressure per second; letting air out is quick
  compressorRate: 0.05, // pressure per second; a full re-inflate takes ~12 s
  airedTopSpeed: 0.6, // top speed fraction at zero pressure
  airedSideGrip: 0.6, // cornering grip fraction at zero pressure
  airedSteerRate: 0.6, // steering speed fraction at zero pressure
  rockSpeed: 0.1, // m/s the truck must move each way for a direction change to count as rocking; a bogged truck only shuffles
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
  let range: Range = 'high';
  let gear = 1;
  let rpm = 0;
  const sinkage = [0, 0, 0, 0];
  let pressure = 1;
  let dir = 0; // last direction of travel, for rocking
  // Scratch objects: update() runs every physics step, so don't allocate there.
  const fwd = new THREE.Vector3();
  const upward = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const slide = new THREE.Vector3();
  const forward = () => {
    const q = body.rotation();
    return fwd.set(1, 0, 0).applyQuaternion(rot.set(q.x, q.y, q.z, q.w));
  };

  // Call once per fixed physics step, before world.step().
  function update(input: Input, dt: number) {
    prevPos.copy(body.translation());
    prevRot.copy(body.rotation());

    pressure = THREE.MathUtils.clamp(
      pressure + ((input.compressor ? T.compressorRate : 0) - (input.airDown ? T.airDownRate : 0)) * dt,
      T.minPressure,
      1,
    );
    const speed = vehicle.currentVehicleSpeed();
    const box = shift(speed, range, gear);
    gear = box.gear;
    rpm = box.rpm;
    const topSpeed = GEARBOX.topSpeed[range] * THREE.MathUtils.lerp(T.airedTopSpeed, 1, pressure);
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

    // Rolling forward, nose down a steep face, brake hard on: the front tyres plough in. Pitch, not velocity, so landings don't count.
    const dig = plough(speed > 0 ? brake / T.brakeForce : 0, -forward().y);
    for (let i = 0; i < 4; i++) {
      vehicle.setWheelEngineForce(i, engine);
      vehicle.setWheelBrake(i, brake);
      // While the nose ploughs, the light, locked rear wheels slide on the loose face; anchored at the front, the tail swings round (broach).
      const skid = i < 2 ? 1 : 1 - SINKAGE.ploughSkid * dig;
      vehicle.setWheelFrictionSlip(i, skid * T.frictionSlip * traction(sinkage[i], pressure));
      vehicle.setWheelSideFrictionStiffness(i, T.sideFrictionStiffness * THREE.MathUtils.lerp(T.airedSideGrip, 1, pressure));
      vehicle.setWheelSuspensionRestLength(i, T.suspensionRest - sinkage[i] * T.sinkDepth);
      if (i < 2) vehicle.setWheelSteering(i, steer);
    }
    vehicle.updateVehicle(dt);

    // Raycast wheels never really spin, so wheelspin = throttle without the truck moving; feathering it spins less.
    const wheelSpin = engine ? Math.max(input.throttle, input.brake) * Math.max(0, 1 - Math.abs(speed) / T.spinSpeed) : 0;
    const moving = Math.abs(speed) > T.rockSpeed ? Math.sign(speed) : 0;
    const dirChanged = moving !== 0 && dir !== 0 && moving !== dir && engine !== 0; // driven, so settling jitter doesn't count
    if (moving) dir = moving;
    const up = upward.set(0, 1, 0).applyQuaternion(rot); // rot was set by forward() above
    for (let i = 0; i < 4; i++) {
      const p = vehicle.wheelIsInContact(i) && vehicle.wheelContactPoint(i);
      if (!p) continue; // airborne wheels keep their sinkage
      // Drag acts like friction against the wheel's slide over the ground, so it can stop motion but never push back.
      // A nose dug in deeper than the tail then swings the tail round, as a broach does.
      const soft = softnessAt(p.x, p.z);
      const vp = body.velocityAtPoint(p);
      slide.set(vp.x, vp.y, vp.z).addScaledVector(up, -(vp.x * up.x + vp.y * up.y + vp.z * up.z)); // ignore suspension bounce
      const vs = slide.length();
      if (vs > 1e-3) body.applyImpulseAtPoint(slide.multiplyScalar(-Math.min((vs * T.mass) / 4, drag(sinkage[i], soft) * dt) / vs), p, true);
      sinkage[i] = stepSinkage(
        sinkage[i],
        { softness: soft, groundSpeed: speed, wheelSpin, pressure, steerRate: steerDelta / dt, isFront: i < 2, dirChanged, plough: dig },
        dt,
      );
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

  function toggleRange() {
    range = range === 'high' ? 'low' : 'high';
  }

  return { body, vehicle, mesh, update, render, flip, reset, toggleRange, headlights, state: () => ({ range, gear, rpm, pressure, sinkage: [...sinkage] }) };
}
