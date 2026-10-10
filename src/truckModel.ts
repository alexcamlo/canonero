import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const MODEL = {
  paint: 0xb4d7f2,
  trim: 0x242727,
  glass: 0x35464e,
  rim: 0x2c363b,
  pinstripe: 0xe2c658,
  tint: 0x17252b,
  lens: 0xc4d9e8,
  rearLens: 0x983c2b,
  halfWidth: 0.85,
  axleX: 1.4,
  archY: -0.445,
  archRadius: 0.48, // Clear the 0.4 m tyre at y = -0.40 under full compression.
};

// Body only, in chassis-local coordinates: +x forward, +y up, +z right.
export function createTruckModel(): THREE.Group {
  const body = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: MODEL.paint });
  const trim = new THREE.MeshLambertMaterial({ color: MODEL.trim });
  const glass = new THREE.MeshLambertMaterial({ color: MODEL.glass, side: THREE.DoubleSide });
  const rim = new THREE.MeshLambertMaterial({ color: MODEL.rim });
  const lens = new THREE.MeshLambertMaterial({ color: MODEL.lens });
  const headlamp = new THREE.MeshLambertMaterial({ color: MODEL.lens, name: 'headlamp' }); // the truck makes these glow at night
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

  const lofted = new Set<THREE.Mesh>();
  // Connect matching profiles; open ends meet the adjacent body panels.
  function loft(profiles: number[][][], material = paint) {
    const width = profiles[0].length;
    const indices = [];
    for (let row = 0; row < profiles.length - 1; row++) {
      for (let col = 0; col < width - 1; col++) {
        const a = row * width + col;
        indices.push(a, a + 1, a + width, a + 1, a + width + 1, a + width);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(profiles.flat(2), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = add(geometry, material);
    lofted.add(mesh);
    return mesh;
  }

  // The silhouette has real openings, so suspension and steering never expose a solid box behind the tyres.
  const sill = [[-2.0, MODEL.archY]];
  for (const axle of [-MODEL.axleX, MODEL.axleX]) {
    for (let i = 0; i <= 12; i++) {
      const angle = Math.PI * (1 - i / 12);
      sill.push([axle + MODEL.archRadius * Math.cos(angle), MODEL.archY + MODEL.archRadius * Math.sin(angle)]);
    }
  }
  sill.push([2.16, MODEL.archY]);
  extrude([...sill, [2.16, -0.085], [1.9, -0.085], [1.9, 0.12], [0.82, 0.12], [0.78, 0.43], [-2.0, 0.43]], MODEL.halfWidth * 2 - 0.02, paint, -MODEL.halfWidth + 0.01, 0.012);

  // x, centre height, wing height, half-width: the last sections roll down into the grille.
  const nose = [
    [0.78, 0.49, 0.43, 0.85],
    [1.05, 0.50, 0.415, 0.87],
    [1.45, 0.48, 0.395, 0.88],
    [1.82, 0.445, 0.36, 0.88],
    [2.02, 0.405, 0.32, 0.845],
    [2.15, 0.35, 0.28, 0.765],
    [2.235, 0.255, 0.23, 0.64],
  ];
  const noseProfiles = nose.map(([x, crown, wing, width]) => [
    [x, x > 1.7 ? -0.085 : 0.10, -width], [x, wing - 0.10, -width], [x, wing, -width * 0.94],
    [x, crown - 0.025, -width * 0.68], [x, crown - 0.005, -width * 0.35], [x, crown, 0],
    [x, crown - 0.005, width * 0.35], [x, crown - 0.025, width * 0.68],
    [x, wing, width * 0.94], [x, wing - 0.10, width], [x, x > 1.7 ? -0.085 : 0.10, width],
  ]);
  loft(noseProfiles);
  const frontLip = noseProfiles[noseProfiles.length - 1].slice(2, -2);
  loft([frontLip, frontLip.map(([x, , z]) => [x, 0.20, z])]);
  for (const side of [-1, 1]) {
    loft(nose.slice(0, -1).map(([x, crown, wing, width]) => {
      const y = THREE.MathUtils.lerp(crown - 0.025, wing, (0.85 - 0.68) / (0.94 - 0.68)) + 0.003;
      return [[x, y, side * width * 0.85 - 0.002], [x, y, side * width * 0.85 + 0.002]];
    }), trim);
  }

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
    const rings = [[MODEL.archRadius, 0.89], [MODEL.archRadius + 0.012, 0.905], [MODEL.archRadius + 0.042, 0.89], [MODEL.archRadius + 0.075, MODEL.halfWidth]];
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
      const edging = new THREE.RingGeometry(MODEL.archRadius, MODEL.archRadius + 0.014, 12, 1, 0, Math.PI);
      if (side < 0) edging.rotateY(Math.PI);
      add(edging, trim, axle, MODEL.archY, side * 0.897);
      const well = [];
      for (let i = 0; i <= 12; i++) {
        const angle = Math.PI * i / 12;
        well.push([axle + (MODEL.archRadius - 0.01) * Math.cos(angle), MODEL.archY + (MODEL.archRadius - 0.01) * Math.sin(angle)]);
      }
      panel((side > 0 ? well : well.reverse()).map(([x, y]) => [x, y, side * 0.6]), trim);
    }

    const sideWindow = (points: number[][], material = glass) => {
      const face = points.map(([x, y]) => [x, y, side * (0.856 - (y - 0.43) * 0.15)]);
      panel(side > 0 ? face : face.reverse(), material);
    };
    sideWindow([[-0.22, 0.49], [0.76, 0.49], [0.27, 1.01], [-0.22, 1.01]]);
    sideWindow([[-1.06, 0.49], [-0.32, 0.49], [-0.32, 1.02], [-1.06, 1.02]], tint);
    sideWindow([[-1.89, 0.60], [-1.76, 0.51], [-1.15, 0.49], [-1.15, 1.02], [-1.79, 1.02], [-1.9, 0.97], [-1.94, 0.81]], tint);

    for (const [left, right] of [[-1.15, -1.06], [-0.32, -0.22]]) {
      sideWindow([[left, 0.49], [right, 0.49], [right, 1.02], [left, 1.02]], trim);
    }

    box(2.6, 0.035, 0.025, -0.62, 0.445, side * 0.882); // window sill
    loft([-0.86, -0.76, 0.76, 0.86].map((x) => {
      const shoulder = Math.abs(x) > 0.8 ? 0.015 : 0;
      const profile = [[-0.40, 0.83], [-0.37, 0.872], [-0.24, 0.895], [-0.21, 0.888], [-0.185, 0.895], [-0.15, 0.89], [-0.12, 0.85]]
        .map(([y, z]) => [x, y, side * (z - shoulder)]);
      return side > 0 ? profile.reverse() : profile;
    }));
    loft([-0.84, 0.84].map((x) => {
      const profile = [[-0.46, 0.81], [-0.46, 1.02], [-0.50, 1.02], [-0.51, 0.99], [-0.51, 0.81], [-0.46, 0.81]]
        .map(([y, z]) => [x, y, side * z]);
      return side > 0 ? profile : profile.reverse();
    }));
    loft([-0.75, 0.75].map((x) => {
      const profile = [[x, -0.454, side * 0.91], [x, -0.454, side * 1.0]];
      return side > 0 ? profile : profile.reverse();
    }), trim);
    box(2.23, 0.035, 0.06, -0.86, 1.025, side * 0.782); // rain visor
    const visor = box(0.52, 0.035, 0.06, 0.5, 0.785, side * 0.817);
    visor.rotation.z = -0.82;
    for (const x of [-0.27, 0.84]) box(0.012, 0.43, 0.012, x, 0.205, side * 0.882);
    box(0.012, 0.16, 0.012, -1.11, 0.35, side * 0.882);
    for (const x of [-0.86, -0.04]) box(0.16, 0.055, 0.025, x, 0.32, side * 0.89);
    for (let i = 0; i < 3; i++) box(0.18 - i * 0.03, 0.018, 0.015, -2.03, 0.49 + i * 0.04, side * 0.85);

    box(0.16, 0.05, 0.2, 0.62, 0.5, side * 0.9);
    extrude([[0.51, 0.52], [0.535, 0.495], [0.72, 0.495], [0.755, 0.525], [0.755, 0.635], [0.725, 0.665], [0.535, 0.665], [0.51, 0.64]],
      0.12, trim, side > 0 ? 0.95 : -1.07);
    box(0.015, 0.12, 0.09, 0.509, 0.58, side * 1.01, glass);
  }

  // Cross-sections keep the glass on the crowned windscreen and rounded rear corners.
  for (let i = 0; i < 4; i++) {
    const left = -1 + i / 2;
    const right = left + 0.5;
    panel([[0.882, 0.49, left * 0.77], [0.882, 0.49, right * 0.77], [0.412, 1.01, right * 0.7], [0.412, 1.01, left * 0.7]]);
    panel([[-2.148, 0.49, left * 0.76], [-2.148, 0.49, right * 0.76], [-2.072, 1.0, right * 0.7], [-2.072, 1.0, left * 0.7]], tint);
  }

  // Bumper sections follow the same rounded plan as the nose, returning into the wings.
  const bumper = [
    [-0.92, 2.00], [-0.89, 2.13], [-0.8, 2.25], [-0.6, 2.30], [0, 2.315],
    [0.6, 2.30], [0.8, 2.25], [0.89, 2.13], [0.92, 2.00],
  ];
  loft(bumper.map(([z, front]) => [
    [1.96, -0.445, z], [front - 0.07, -0.445, z], [front - 0.025, -0.425, z], [front + 0.008, -0.37, z],
    [front + 0.01, -0.235, z], [front - 0.008, -0.222, z], [front + 0.009, -0.209, z],
    [front + 0.004, -0.15, z], [front - 0.02, -0.09, z], [1.96, -0.09, z], [1.96, -0.445, z],
  ]));
  loft(bumper.map(([z, front]) => [[front - 0.006, -0.225, z], [front - 0.006, -0.219, z]]), trim);
  box(0.015, 0.105, 0.83, 2.345, -0.315, 0);
  box(0.035, 0.29, 0.98, 2.207, 0.085, 0, rim); // blank grille
  for (let i = -5; i <= 5; i++) box(0.035, 0.215, 0.027, 2.234, 0.077, i * 0.081, trim);
  for (const side of [-1, 1]) {
    // The lamp follows the wing in plan view, with a narrow dark surround.
    const lamp = [
      [2.248, 0.48, -0.064, 0.238], [2.23, 0.64, -0.064, 0.244],
      [2.17, 0.76, -0.047, 0.26], [2.06, 0.845, 0.0, 0.27], [1.94, 0.868, 0.055, 0.25],
    ];
    for (const [inset, material] of [[0, trim], [0.008, headlamp]] as const) {
      loft([0, 0.5, 1].map((row) => {
        const profile = lamp.map(([x, z, bottom, top], col) => {
          // Shrink along the surface, then lift outwards on both axes around the corner.
          if (col === 0) z += inset;
          if (col === lamp.length - 1) x += inset;
          return [x + inset / 2 + (row === 0.5 ? 0.01 : 0), THREE.MathUtils.lerp(bottom + inset, top - inset, row), side * (z + inset / 2)];
        });
        return side > 0 ? profile.reverse() : profile;
      }), material);
    }
    for (const [inset, material] of [[0, rim], [0.01, lens]] as const) {
      loft([-0.385 + inset, -0.26 - inset].map((y) => {
        const profile = [[2.322 + inset / 2, y, side * (0.52 + inset)], [2.318 + inset / 2, y, side * 0.60], [2.268 + inset / 2, y, side * (0.80 - inset)]];
        return side > 0 ? profile.reverse() : profile;
      }), material);
    }
    box(0.13, 0.08, 0.055, 2.26, -0.075, side * 0.35);
    add(new THREE.CylinderGeometry(0.135, 0.135, 0.075, 12).rotateZ(Math.PI / 2), rim, 2.31, 0.045, side * 0.35);
    add(new THREE.CylinderGeometry(0.113, 0.113, 0.012, 12).rotateZ(Math.PI / 2), headlamp, 2.354, 0.045, side * 0.35);
    // A narrow divider separates the main reflector from the corner lens.
    loft([-0.042, 0.257].map((y) => {
      const profile = [[2.18, y, side * 0.765], [2.172, y, side * 0.773]];
      return side > 0 ? profile.reverse() : profile;
    }), paint);
  }

  const rearProfile = [
    [-1.97, -0.85], [-2.08, -0.83], [-2.16, -0.77], [-2.205, -0.67],
    [-2.22, 0], [-2.205, 0.67], [-2.16, 0.77], [-2.08, 0.83], [-1.97, 0.85],
  ];
  loft([-0.43, 0.05, 0.43].map((y) => rearProfile.map(([x, z]) => [x, y, z])));
  for (const side of [-1, 1]) {
    for (const [bottom, top, material] of [[-0.08, 0.45, trim], [-0.065, 0.23, rearLens], [0.25, 0.435, lens]] as const) {
      loft([bottom, top].map((y) => {
        const offset = material === trim ? 0 : 0.003;
        const profile = [[-2.216, 0.69], [-2.172, 0.77], [-2.092, 0.83]]
          .map(([x, z]) => [x - offset, y, side * (z + offset)]);
        return side > 0 ? profile : profile.reverse();
      }), material);
    }
  }
  extrude([[-2.27, -0.4], [-2.2, -0.48], [-2.03, -0.48], [-2.03, -0.27], [-2.27, -0.27]], 1.7, paint, -0.85, 0.065, 4);
  box(0.035, 0.62, 1.27, -2.22, 0.07, 0, trim);
  box(0.045, 0.59, 1.24, -2.24, 0.07, 0, paint); // inset outline of the single side-hinged door
  box(0.065, 0.065, 0.19, -2.27, 0.21, -0.45, trim);
  for (const y of [-0.15, 0.32]) box(0.07, 0.065, 0.12, -2.27, y, 0.62, rim);

  // The scoop follows the bonnet slope; its forward mouth stays open and dark.
  extrude([[1.03, 0.49], [1.48, 0.48], [1.48, 0.57], [1.15, 0.57]], 0.42, paint, -0.21, 0.012);
  box(0.015, 0.045, 0.33, 1.495, 0.54, 0);
  for (const z of [-0.055, 0.055]) box(0.02, 0.045, 0.012, 1.505, 0.54, z, rim);

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
  const spareVent = new THREE.ShapeGeometry(new THREE.Shape(Array.from({ length: 6 }, (_, i) =>
    new THREE.Vector2(0.032 * Math.cos(i * Math.PI / 3), 0.044 * Math.sin(i * Math.PI / 3)),
  )));
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const vent = add(spareVent.clone(), tint, -2.492, 0.30 + 0.148 * Math.sin(angle), 0.16 + 0.148 * Math.cos(angle));
    vent.rotation.set(0, -Math.PI / 2, angle - Math.PI / 2);
  }
  spareVent.dispose();
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
      if (!isSpare && !lofted.has(object)) { // lofts already have their rounded profiles
        const end = THREE.MathUtils.smoothstep(Math.abs(x), 1.75, 2.3);
        x -= Math.sign(x) * 0.2 * end * (Math.abs(z) / 0.94) ** 4;
        const roof = THREE.MathUtils.smoothstep(y, 0.98, 1.1);
        y += 0.035 * roof * Math.max(0, 1 - (z / 0.9) ** 2);
        z *= 1 - 0.035 * (1 - THREE.MathUtils.smoothstep(y, -0.48, 0.43));
      }
      if (!isSpare && y > 0.43) y = 0.43 + (y - 0.43) * 0.85;
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
