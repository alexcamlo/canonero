import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export const CHUNK_SIZE = 64; // m
export const CHUNK_CELLS = 32; // grid cells per side (2 m spacing)
const RADIUS = 5; // chunks kept around the truck; scene fog must fully hide this distance

type Height = (x: number, z: number) => number;
type GroundColor = (x: number, z: number) => [number, number, number];

// Heights for chunk (cx, cz), centred at (cx, cz) * CHUNK_SIZE, in Rapier's heightfield layout
// (column-major: consecutive values walk along z). Samples sit on one world-aligned grid, so
// neighbouring chunks share their edge samples exactly: no seams.
export function chunkHeights(height: Height, cx: number, cz: number) {
  const n = CHUNK_CELLS + 1;
  const step = CHUNK_SIZE / CHUNK_CELLS;
  const x0 = (cx - 0.5) * CHUNK_SIZE;
  const z0 = (cz - 0.5) * CHUNK_SIZE;
  const heights = new Float32Array(n * n);
  for (let xi = 0; xi < n; xi++) {
    for (let zi = 0; zi < n; zi++) heights[zi + xi * n] = height(x0 + xi * step, z0 + zi * step);
  }
  return heights;
}

export function createChunks(world: RAPIER.World, scene: THREE.Scene, height: Height, groundColor: GroundColor) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const color = new THREE.Color();
  const chunks = new Map<string, { cx: number; cz: number; mesh: THREE.Mesh; collider: RAPIER.Collider }>();

  function add(cx: number, cz: number) {
    const n = CHUNK_CELLS + 1;
    const heights = chunkHeights(height, cx, cz);
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_CELLS, CHUNK_CELLS).rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    // Plane vertices run x-fastest from -z to +z; heights run z-fastest.
    for (let zi = 0; zi < n; zi++) {
      for (let xi = 0; xi < n; xi++) position.setY(xi + zi * n, heights[zi + xi * n]);
    }
    const colors = new Float32Array(n * n * 3);
    for (let zi = 0; zi < n; zi++) {
      for (let xi = 0; xi < n; xi++) {
        const [r, g, b] = groundColor((cx - 0.5) * CHUNK_SIZE + xi * (CHUNK_SIZE / CHUNK_CELLS), (cz - 0.5) * CHUNK_SIZE + zi * (CHUNK_SIZE / CHUNK_CELLS));
        color.setRGB(r, g, b, THREE.SRGBColorSpace).toArray(colors, (xi + zi * n) * 3); // to linear working space
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    mesh.receiveShadow = true;
    scene.add(mesh);

    const collider = world.createCollider(
      RAPIER.ColliderDesc.heightfield(CHUNK_CELLS, CHUNK_CELLS, heights, { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE })
        .setTranslation(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE),
    );
    chunks.set(`${cx},${cz}`, { cx, cz, mesh, collider });
  }

  // Load chunks within RADIUS of the focus, drop ones beyond RADIUS + 1 (slack so the border doesn't thrash).
  // New chunks appear at the fogged rim, so spreading them over frames (budget) hides the generation cost.
  function update(focus: THREE.Vector3, budget = 2) {
    const fx = Math.round(focus.x / CHUNK_SIZE);
    const fz = Math.round(focus.z / CHUNK_SIZE);
    for (const [key, c] of chunks) {
      if ((c.cx - fx) ** 2 + (c.cz - fz) ** 2 <= (RADIUS + 1) ** 2) continue;
      scene.remove(c.mesh);
      c.mesh.geometry.dispose();
      world.removeCollider(c.collider, false);
      chunks.delete(key);
    }
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      for (let dz = -RADIUS; dz <= RADIUS; dz++) {
        if (budget > 0 && dx * dx + dz * dz <= RADIUS * RADIUS && !chunks.has(`${fx + dx},${fz + dz}`)) {
          add(fx + dx, fz + dz);
          budget--;
        }
      }
    }
  }

  return { update };
}
