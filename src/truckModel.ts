import * as THREE from 'three';
import type { TRUCK } from './truck';

// Adapt the ground-centered GLB to the chassis and retain each wheel's outward-facing rotation.
export function createTruckModel(body: THREE.Group, dimensions: typeof TRUCK) {
  // Matte, non-metal surfaces take the same diffuse sun and sand bounce as the dunes.
  body.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial)) return;
    const material = node.material;
    material.metalness = 0;
    material.roughness = 1;
    if (material instanceof THREE.MeshPhysicalMaterial) material.clearcoat = 0;
    if (material.name === 'rubber') material.color.set(0x49433b);
    if (material.name === 'glass') material.color.set(0x454a46);
  });

  const names = ['wheel_front_left', 'wheel_front_right', 'wheel_rear_left', 'wheel_rear_right'];
  const wheelMeshes = names.map((name) => {
    const wheel = body.getObjectByName(name);
    if (!wheel) throw new Error(`Truck model is missing ${name}`);
    return wheel;
  });
  const sourceWheel = wheelMeshes[0];
  const size = new THREE.Box3().setFromObject(sourceWheel).getSize(new THREE.Vector3());
  const radiusScale = dimensions.wheelRadius / (Math.max(size.x, size.y) / 2);
  body.scale.z = dimensions.wheelZ / Math.abs(sourceWheel.position.z);
  // Keep the arch centers 5 cm below the fully compressed axles, like the original body.
  body.position.y = dimensions.wheelY - dimensions.suspensionRest + dimensions.suspensionTravel - 0.05 - sourceWheel.position.y;

  const wheels = wheelMeshes.map((wheel, i) => {
    const pivot = new THREE.Group();
    pivot.name = names[i];
    pivot.position.set(i < 2 ? dimensions.wheelX : -dimensions.wheelX, dimensions.wheelY, i % 2 ? dimensions.wheelZ : -dimensions.wheelZ);
    wheel.removeFromParent();
    wheel.name = `${names[i]}_mesh`;
    wheel.position.set(0, 0, 0);
    wheel.scale.setScalar(radiusScale);
    pivot.add(wheel);
    return pivot;
  });
  return { body, wheels };
}
