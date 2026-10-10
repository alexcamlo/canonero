import * as THREE from 'three';

const MODEL = {
  paint: 0xe8e2d4,
  trim: 0x302e2b,
  glass: 0x253b43,
  rim: 0xaaa89f,
  lens: 0xf4e8c9,
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

  function extrude(points: number[][], depth: number, material: THREE.Material, z: number, bevel = 0) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    return add(new THREE.ExtrudeGeometry(shape, {
      depth, steps: 1, bevelEnabled: bevel > 0, bevelSegments: 1, bevelSize: bevel, bevelThickness: bevel,
    }), material, 0, 0, z);
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
  extrude([...sill, [2.16, 0.26], [0.88, 0.43], [-2.15, 0.43]], MODEL.halfWidth * 2, paint, -MODEL.halfWidth, 0.025);

  const cabin = extrude([
    [-2.15, 0.42], [0.9, 0.42], [0.32, 1.06], [0.2, 1.1], [-1.95, 1.1], [-2.06, 1.03],
  ], MODEL.halfWidth * 2, paint, -MODEL.halfWidth);
  const vertices = cabin.geometry.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    const inset = Math.max(0, vertices.getY(i) - 0.43) * 0.15;
    vertices.setZ(i, vertices.getZ(i) + (vertices.getZ(i) > MODEL.halfWidth ? -inset : inset));
  }
  cabin.geometry.computeVertexNormals();

  // Three facets across each flare soften the wide, rounded arches without smoothing the body panels.
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
    const faceted = geometry.toNonIndexed();
    geometry.dispose();
    faceted.computeVertexNormals();
    add(faceted, paint);
  }

  for (const side of [-1, 1]) {
    extrude([...sill, [2.16, 0.08], [-2.15, 0.08]], 0.025, trim, side > 0 ? 0.851 : -0.876);
    for (const axle of [-MODEL.axleX, MODEL.axleX]) {
      flare(axle, side);
      const well = [];
      for (let i = 0; i <= 12; i++) {
        const angle = Math.PI * i / 12;
        well.push([axle + 0.53 * Math.cos(angle), MODEL.archY + 0.53 * Math.sin(angle)]);
      }
      extrude(well, 0.025, trim, side > 0 ? 0.58 : -0.605);
    }

    const sideWindow = (points: number[][], material = glass) => {
      const face = points.map(([x, y]) => [x, y, side * (0.856 - (y - 0.43) * 0.15)]);
      panel(side > 0 ? face : face.reverse(), material);
    };
    sideWindow([[-0.22, 0.49], [0.76, 0.49], [0.27, 1.01], [-0.22, 1.01]]);
    sideWindow([[-1.06, 0.49], [-0.32, 0.49], [-0.32, 1.02], [-1.06, 1.02]]);
    sideWindow([[-1.94, 0.59], [-1.82, 0.49], [-1.15, 0.49], [-1.15, 1.02], [-1.96, 1.02], [-2.02, 0.94]]);

    for (const [left, right] of [[-1.15, -1.06], [-0.32, -0.22]]) {
      sideWindow([[left, 0.49], [right, 0.49], [right, 1.02], [left, 1.02]], trim);
    }

    box(2.6, 0.035, 0.025, -0.62, 0.445, side * 0.882); // window sill
    box(1.45, 0.075, 0.23, 0, -0.48, side * 0.9); // side step
    for (const x of [-0.27, 0.84]) box(0.012, 0.43, 0.012, x, 0.205, side * 0.882);
    box(0.012, 0.16, 0.012, -1.11, 0.35, side * 0.882);
    for (const x of [-0.86, -0.04]) box(0.16, 0.055, 0.025, x, 0.32, side * 0.89);
    for (let i = 0; i < 3; i++) box(0.18 - i * 0.03, 0.018, 0.015, -2.03, 0.49 + i * 0.04, side * 0.85);

    box(0.16, 0.05, 0.2, 0.62, 0.5, side * 0.9);
    box(0.23, 0.17, 0.12, 0.63, 0.58, side * 1.01);
    box(0.015, 0.12, 0.09, 0.509, 0.58, side * 1.01, glass);
    for (const x of [-1.67, 0.04]) box(0.13, 0.09, 0.07, x, 1.12, side * 0.65);
    box(1.97, 0.045, 0.065, -0.81, 1.18, side * 0.65); // raised roof rail
  }

  panel([[0.852, 0.49, -0.77], [0.852, 0.49, 0.77], [0.382, 1.01, 0.7], [0.382, 1.01, -0.7]]);
  panel([[-2.148, 0.49, -0.76], [-2.148, 0.49, 0.76], [-2.072, 1.0, 0.7], [-2.072, 1.0, -0.7]]);

  box(0.21, 0.24, 1.84, 2.16, -0.26, 0);
  box(0.08, 0.14, 0.87, 2.28, -0.28, 0);
  box(0.035, 0.29, 0.98, 2.178, 0.085, 0); // blank grille
  for (const y of [-0.015, 0.07, 0.155]) box(0.025, 0.027, 0.9, 2.202, y, 0, rim);
  for (const side of [-1, 1]) {
    box(0.045, 0.29, 0.39, 2.19, 0.095, side * 0.68);
    const headlamp = extrude([
      [-0.175, -0.09], [-0.14, -0.12], [0.14, -0.12], [0.175, -0.07], [0.175, 0.095], [-0.175, 0.095],
    ], 0.018, lens, 0, 0.012);
    headlamp.rotation.y = Math.PI / 2;
    headlamp.position.set(2.217, 0.105, side * 0.68);
    box(0.22, 0.23, 0.055, 2.06, 0.095, side * 0.859, lens);
    box(0.025, 0.075, 0.19, 2.275, -0.26, side * 0.65, lens);
    box(0.085, 0.45, 0.18, -2.17, 0.18, side * 0.758);
    box(0.09, 0.23, 0.15, -2.18, 0.07, side * 0.758, rearLens);
    box(0.09, 0.17, 0.15, -2.18, 0.29, side * 0.758, lens);
  }

  box(0.24, 0.2, 1.85, -2.15, -0.38, 0);
  box(0.035, 0.62, 1.27, -2.173, 0.07, 0, trim);
  box(0.045, 0.59, 1.24, -2.196, 0.07, 0, paint); // inset outline of the single side-hinged door
  box(0.065, 0.065, 0.19, -2.23, 0.21, -0.45, trim);
  for (const y of [-0.15, 0.32]) box(0.07, 0.065, 0.12, -2.23, y, 0.62, rim);

  const spare = new THREE.TorusGeometry(0.29, 0.11, 6, 20).rotateY(Math.PI / 2);
  add(spare, trim, -2.37, 0.30, 0.16);
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.075, 16).rotateZ(Math.PI / 2), rim, -2.45, 0.30, 0.16);
  add(new THREE.CylinderGeometry(0.08, 0.08, 0.085, 8).rotateZ(Math.PI / 2), trim, -2.49, 0.30, 0.16);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const slot = box(0.014, 0.075, 0.045, -2.493, 0.30 + Math.cos(angle) * 0.145, 0.16 + Math.sin(angle) * 0.145);
    slot.rotation.x = angle;
  }

  return body;
}
