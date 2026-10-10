import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const MODEL = {
  paint: 0xbfc1b9,
  trim: 0x242727,
  glass: 0x35464e,
  rim: 0x141918,
  pinstripe: 0xe2c658,
  tint: 0x17252b,
  lens: 0xdce3de,
  rearLens: 0x983c2b,
  halfWidth: 0.85,
  axleX: 1.4,
  archY: -0.48,
  archRadius: 0.54,
};

// Body only, in chassis-local coordinates: +x forward, +y up, +z right.
export function createTruckModel(): THREE.Group {
  const body = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: MODEL.paint });
  const trim = new THREE.MeshLambertMaterial({ color: MODEL.trim });
  const glass = new THREE.MeshLambertMaterial({ color: MODEL.glass, side: THREE.DoubleSide });
  const rim = new THREE.MeshLambertMaterial({ color: MODEL.rim });
  const lens = new THREE.MeshLambertMaterial({ color: MODEL.lens });
  const pinstripe = new THREE.MeshLambertMaterial({ color: MODEL.pinstripe });
  const tint = new THREE.MeshLambertMaterial({ color: MODEL.tint, side: THREE.DoubleSide });
  const rearLens = new THREE.MeshLambertMaterial({ color: MODEL.rearLens });

  function add(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  }

  function box(w: number, h: number, d: number, x: number, y: number, z: number, material = trim) {
    return add(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }

  function extrude(points: number[][], depth: number, material: THREE.Material, z: number, bevel = 0, steps = 1) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    return add(new THREE.ExtrudeGeometry(shape, {
      depth, steps, bevelEnabled: bevel > 0, bevelSegments: material === paint ? 2 : 1, bevelSize: bevel, bevelThickness: bevel,
    }), material, 0, 0, z);
  }

  function pipe(from: number[], to: number[], radius: number) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const mesh = add(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), trim);
    mesh.position.copy(start.add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  }

  function panel(points: number[][], material = glass) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    const indices = [];
    for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    add(geometry, material);
  }

  // The silhouette has real openings, so suspension and steering never expose a solid box behind the tyres.
  const sill = [[-2.15, MODEL.archY]];
  for (const axle of [-MODEL.axleX, MODEL.axleX]) {
    for (let i = 0; i <= 12; i++) {
      const angle = Math.PI * (1 - i / 12);
      sill.push([axle + MODEL.archRadius * Math.cos(angle), MODEL.archY + MODEL.archRadius * Math.sin(angle)]);
    }
  }
  sill.push([2.16, MODEL.archY]);
  extrude([...sill, [2.16, 0.26], [0.88, 0.43], [-2.15, 0.43]], MODEL.halfWidth * 2 - 0.02, paint, -MODEL.halfWidth + 0.01, 0.035, 4);

  const cabin = extrude([
    [-2.105, 0.42], [0.86, 0.42], [0.28, 1.06], [0.16, 1.1], [-1.905, 1.1], [-2.015, 1.03],
  ], (MODEL.halfWidth - 0.045) * 2, paint, -MODEL.halfWidth + 0.045, 0.045, 2);
  const vertices = cabin.geometry.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    const inset = Math.max(0, vertices.getY(i) - 0.43) * 0.15;
    vertices.setZ(i, vertices.getZ(i) - Math.sign(vertices.getZ(i) + cabin.position.z) * inset);
  }
  cabin.geometry.computeVertexNormals();

  // Shared vertices blend the flares smoothly into their rounded shoulders.
  function flare(axle: number, side: number) {
    const positions = [];
    const indices = [];
    const rings = [[MODEL.archRadius, 0.9], [0.59, 1.0], [0.69, 0.94], [0.72, MODEL.halfWidth]];
    for (const [radius, width] of rings) {
      for (let i = 0; i <= 12; i++) {
        const angle = Math.PI * i / 12;
        positions.push(axle + radius * Math.cos(angle), MODEL.archY + radius * Math.sin(angle), side * width);
      }
    }
    for (let ring = 0; ring < rings.length - 1; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = ring * 13 + i;
        const face = [a, a + 13, a + 1, a + 1, a + 13, a + 14];
        indices.push(...(side > 0 ? face : face.reverse()));
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    add(geometry, paint);
  }

  for (const side of [-1, 1]) {
    for (const axle of [-MODEL.axleX, MODEL.axleX]) {
      flare(axle, side);
      const edging = new THREE.RingGeometry(MODEL.archRadius, MODEL.archRadius + 0.025, 12, 1, 0, Math.PI);
      if (side < 0) edging.rotateY(Math.PI);
      add(edging, trim, axle, MODEL.archY, side * 0.947);
      const well = [];
      for (let i = 0; i <= 12; i++) {
        const angle = Math.PI * i / 12;
        well.push([axle + 0.53 * Math.cos(angle), MODEL.archY + 0.53 * Math.sin(angle)]);
      }
      panel((side > 0 ? well : well.reverse()).map(([x, y]) => [x, y, side * 0.6]), trim);
    }

    const sideWindow = (points: number[][], material = glass) => {
      const face = points.map(([x, y]) => [x, y, side * (0.856 - (y - 0.43) * 0.15)]);
      panel(side > 0 ? face : face.reverse(), material);
    };
    sideWindow([[-0.22, 0.49], [0.76, 0.49], [0.27, 1.01], [-0.22, 1.01]]);
    sideWindow([[-1.06, 0.49], [-0.32, 0.49], [-0.32, 1.02], [-1.06, 1.02]], tint);
    sideWindow([[-1.94, 0.59], [-1.82, 0.49], [-1.15, 0.49], [-1.15, 1.02], [-1.96, 1.02], [-2.02, 0.94]], tint);

    for (const [left, right] of [[-1.15, -1.06], [-0.32, -0.22]]) {
      sideWindow([[left, 0.49], [right, 0.49], [right, 1.02], [left, 1.02]], trim);
    }

    box(2.6, 0.035, 0.025, -0.62, 0.445, side * 0.882); // window sill
    box(1.45, 0.075, 0.23, 0, -0.48, side * 0.9, paint); // silver side step
    box(1.45, 0.025, 0.018, 0, -0.47, side * 1.02);
    for (const y of [-0.13, -0.2]) box(1.45, 0.025, 0.035, 0, y, side * 0.889, paint);
    box(2.23, 0.035, 0.06, -0.86, 1.025, side * 0.782); // rain visor
    const visor = box(0.52, 0.035, 0.06, 0.5, 0.785, side * 0.817);
    visor.rotation.z = -0.82;
    for (const x of [-0.27, 0.84]) box(0.012, 0.43, 0.012, x, 0.205, side * 0.882);
    box(0.012, 0.16, 0.012, -1.11, 0.35, side * 0.882);
    for (const x of [-0.86, -0.04]) box(0.16, 0.055, 0.025, x, 0.32, side * 0.89);
    for (let i = 0; i < 3; i++) box(0.18 - i * 0.03, 0.018, 0.015, -2.03, 0.49 + i * 0.04, side * 0.85);

    box(0.16, 0.05, 0.2, 0.62, 0.5, side * 0.9);
    box(0.23, 0.17, 0.12, 0.63, 0.58, side * 1.01);
    box(0.015, 0.12, 0.09, 0.509, 0.58, side * 1.01, glass);
  }

  // Cross-sections keep the glass on the crowned windscreen and rounded rear corners.
  for (let i = 0; i < 4; i++) {
    const left = -1 + i / 2;
    const right = left + 0.5;
    panel([[0.882, 0.49, left * 0.77], [0.882, 0.49, right * 0.77], [0.412, 1.01, right * 0.7], [0.412, 1.01, left * 0.7]]);
    panel([[-2.148, 0.49, left * 0.76], [-2.148, 0.49, right * 0.76], [-2.072, 1.0, right * 0.7], [-2.072, 1.0, left * 0.7]], tint);
  }

  extrude([[1.98, -0.44], [2.2, -0.4], [2.24, -0.29], [2.22, -0.1], [1.98, -0.1]], 1.7, paint, -0.85, 0.065, 4);
  box(0.015, 0.13, 0.87, 2.313, -0.275, 0);
  box(0.018, 0.025, 0.84, 2.327, -0.275, 0, paint);
  box(0.035, 0.29, 0.98, 2.207, 0.085, 0, rim); // blank grille
  for (let i = -5; i <= 5; i++) box(0.035, 0.245, 0.027, 2.234, 0.085, i * 0.081, trim);
  for (const side of [-1, 1]) {
    box(0.045, 0.32, 0.42, 2.19, 0.095, side * 0.69);
    const headlamp = extrude([
      [-0.19, -0.095], [-0.145, -0.14], [0.145, -0.14], [0.19, -0.085], [0.19, 0.1], [0.155, 0.13], [-0.155, 0.13], [-0.19, 0.1],
    ], 0.018, lens, 0, 0.012);
    headlamp.rotation.y = Math.PI / 2;
    headlamp.position.set(2.217, 0.095, side * 0.69);
    box(0.22, 0.27, 0.055, 2.06, 0.095, side * 0.859, lens);
    box(0.022, 0.16, 0.29, 2.312, -0.265, side * 0.64, rim);
    box(0.028, 0.12, 0.245, 2.33, -0.265, side * 0.64, lens);
    box(0.13, 0.08, 0.055, 2.26, -0.075, side * 0.35);
    add(new THREE.CylinderGeometry(0.135, 0.135, 0.075, 12).rotateZ(Math.PI / 2), rim, 2.31, 0.045, side * 0.35);
    add(new THREE.CylinderGeometry(0.113, 0.113, 0.012, 12).rotateZ(Math.PI / 2), lens, 2.354, 0.045, side * 0.35);
    box(0.085, 0.45, 0.18, -2.17, 0.18, side * 0.758);
    box(0.09, 0.23, 0.15, -2.18, 0.07, side * 0.758, rearLens);
    box(0.09, 0.17, 0.15, -2.18, 0.29, side * 0.758, lens);
  }

  extrude([[-2.27, -0.4], [-2.2, -0.48], [-2.03, -0.48], [-2.03, -0.27], [-2.27, -0.27]], 1.7, paint, -0.85, 0.065, 4);
  box(0.035, 0.62, 1.27, -2.173, 0.07, 0, trim);
  box(0.045, 0.59, 1.24, -2.196, 0.07, 0, paint); // inset outline of the single side-hinged door
  box(0.065, 0.065, 0.19, -2.23, 0.21, -0.45, trim);
  for (const y of [-0.15, 0.32]) box(0.07, 0.065, 0.12, -2.23, y, 0.62, rim);

  // The scoop follows the bonnet slope; its forward mouth stays open and dark.
  extrude([[1.12, 0.41], [1.57, 0.349], [1.57, 0.44], [1.24, 0.46]], 0.42, paint, -0.21, 0.012);
  box(0.015, 0.045, 0.33, 1.59, 0.413, 0);
  for (const z of [-0.055, 0.055]) box(0.02, 0.045, 0.012, 1.6, 0.413, z, rim);

  // Right-side intake runs along the A-pillar, with the mouth facing +x.
  pipe([1.16, 0.3, 0.92], [0.89, 0.46, 0.94], 0.075);
  pipe([0.89, 0.46, 0.94], [0.32, 1.13, 0.83], 0.065);
  pipe([0.32, 1.13, 0.83], [0.32, 1.36, 0.83], 0.065);
  extrude([[0.25, 1.3], [0.5, 1.3], [0.56, 1.43], [0.25, 1.43]], 0.18, trim, 0.74, 0.012);
  box(0.014, 0.085, 0.135, 0.557, 1.38, 0.83, tint);
  box(0.1, 0.04, 0.14, 0.39, 1.015, 0.8);
  pipe([1.02, 0.45, 0.64], [1.02, 0.56, 0.64], 0.022);
  pipe([1.02, 0.56, 0.64], [0.88, 2.15, 0.64], 0.006); // whip antenna

  const spare = new THREE.TorusGeometry(0.29, 0.11, 6, 20).rotateY(Math.PI / 2);
  add(spare, trim, -2.37, 0.30, 0.16);
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.075, 16).rotateZ(Math.PI / 2), rim, -2.45, 0.30, 0.16);
  const spareStripe = new THREE.RingGeometry(0.211, 0.22, 24).rotateY(-Math.PI / 2);
  add(spareStripe, pinstripe, -2.491, 0.30, 0.16);
  add(new THREE.CylinderGeometry(0.08, 0.08, 0.085, 8).rotateZ(Math.PI / 2), trim, -2.49, 0.30, 0.16);

  // Bend the shell and attached details together, keeping lenses and trim on the curved surface.
  body.updateMatrixWorld(true);
  body.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const isSpare = object.position.x < -2.3;
    const geometry = object.geometry;
    geometry.applyMatrix4(object.matrix);
    object.position.set(0, 0, 0);
    object.quaternion.identity();
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);
      if (!isSpare) { // spare stays round and separate from the tailgate corners
        const end = THREE.MathUtils.smoothstep(Math.abs(x), 1.75, 2.3);
        x -= Math.sign(x) * 0.2 * end * (Math.abs(z) / 0.94) ** 4;
        const bonnet = THREE.MathUtils.smoothstep(x, 0.82, 1.02) * THREE.MathUtils.smoothstep(y, 0.2, 0.28);
        const roof = THREE.MathUtils.smoothstep(y, 0.98, 1.1);
        y += (0.075 * bonnet + 0.035 * roof) * Math.max(0, 1 - (z / 0.9) ** 2);
        z *= 1 - 0.035 * (1 - THREE.MathUtils.smoothstep(y, -0.48, 0.43));
      }
      positions.setXYZ(i, x, y, z);
    }
    if (object.material === paint) {
      // Extrusions duplicate edge vertices; weld them so bevel normals can blend across faces.
      geometry.deleteAttribute('normal');
      geometry.deleteAttribute('uv');
      object.geometry = mergeVertices(geometry);
      geometry.dispose();
    }
    object.geometry.computeVertexNormals();
  });

  return body;
}
