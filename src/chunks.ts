import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { softness } from './terrain';

export const CHUNK_SIZE = 64; // m
export const CHUNK_CELLS = 32; // grid cells per side (2 m spacing)
const RADIUS = 5; // drivable chunks (mesh + collider) kept around the truck
const FAR_RADIUS = 12; // render-only coarse chunks out to here; scene fog must fully hide this distance
const FAR_CELLS = CHUNK_CELLS / 4; // 8 m spacing is plenty under the haze
const SKIRT = 8; // m a coarse chunk's edge hangs down, hiding cracks where it meets finer neighbours

type Height = (x: number, z: number) => number;
type GroundColor = (x: number, z: number, soft: number) => [number, number, number];

// Heights for chunk (cx, cz), centred at (cx, cz) * CHUNK_SIZE, in Rapier's heightfield layout
// (column-major: consecutive values walk along z). Samples sit on one world-aligned grid, so
// neighbouring chunks share their edge samples exactly: no seams.
export function chunkHeights(height: Height, cx: number, cz: number, cells = CHUNK_CELLS) {
  const n = cells + 1;
  const step = CHUNK_SIZE / cells;
  const x0 = (cx - 0.5) * CHUNK_SIZE;
  const z0 = (cz - 0.5) * CHUNK_SIZE;
  const heights = new Float32Array(n * n);
  for (let xi = 0; xi < n; xi++) {
    for (let zi = 0; zi < n; zi++) heights[zi + xi * n] = height(x0 + xi * step, z0 + zi * step);
  }
  return heights;
}

export function createChunks(world: RAPIER.World, scene: THREE.Scene, height: Height, groundColor: GroundColor) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const color = new THREE.Color();
  const chunks = new Map<string, { cx: number; cz: number; mesh: THREE.Mesh; collider: RAPIER.Collider }>();
  const far = new Map<string, { cx: number; cz: number; mesh: THREE.Mesh }>();

  function surface(cx: number, cz: number, heights: Float32Array, cells: number, skirt: boolean) {
    const n = cells + 1;
    const step = CHUNK_SIZE / cells;
    const x0 = (cx - 0.5) * CHUNK_SIZE;
    const z0 = (cz - 0.5) * CHUNK_SIZE;
    const at = (xi: number, zi: number) => xi >= 0 && xi < n && zi >= 0 && zi < n ? heights[zi + xi * n] : height(x0 + xi * step, z0 + zi * step);
    const s = skirt ? 1 : 0; // the skirt is one extra ring of vertices folded straight down
    const m = n + 2 * s;
    const geometry = new THREE.PlaneGeometry(1, 1, m - 1, m - 1).rotateX(-Math.PI / 2);
    const { position, normal } = geometry.attributes;
    const colors = new Float32Array(m * m * 3);
    // Plane vertices run x-fastest from -z to +z; heights run z-fastest.
    for (let zi = 0; zi < m; zi++) {
      for (let xi = 0; xi < m; xi++) {
        const i = Math.min(Math.max(xi - s, 0), cells);
        const j = Math.min(Math.max(zi - s, 0), cells);
        const v = xi + zi * m;
        const sag = i === xi - s && j === zi - s ? 0 : SKIRT;
        position.setXYZ(v, i * step - CHUNK_SIZE / 2, heights[j + i * n] - sag, j * step - CHUNK_SIZE / 2);
        // Smooth normals from central differences on the world grid, so neighbours agree at shared edges.
        normal.setXYZ(v, at(i - 1, j) - at(i + 1, j), 2 * step, at(i, j - 1) - at(i, j + 1));
        const soft = softness(heights[j + i * n], at(i + 1, j), at(i - 1, j), at(i, j + 1), at(i, j - 1), step); // reuses the grid's heights
        const [r, g, b] = groundColor(x0 + i * step, z0 + j * step, soft);
        color.setRGB(r, g, b, THREE.SRGBColorSpace).toArray(colors, v * 3); // to linear working space
      }
    }
    geometry.normalizeNormals();
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    scene.add(mesh);
    return mesh;
  }

  function remove(mesh: THREE.Mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }

  function add(cx: number, cz: number) {
    const heights = chunkHeights(height, cx, cz);
    const mesh = surface(cx, cz, heights, CHUNK_CELLS, false);
    mesh.receiveShadow = true;
    const collider = world.createCollider(
      RAPIER.ColliderDesc.heightfield(CHUNK_CELLS, CHUNK_CELLS, heights, { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE })
        .setTranslation(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE),
    );
    chunks.set(`${cx},${cz}`, { cx, cz, mesh, collider });
  }

  function addFar(cx: number, cz: number) {
    far.set(`${cx},${cz}`, { cx, cz, mesh: surface(cx, cz, chunkHeights(height, cx, cz, FAR_CELLS), FAR_CELLS, true) });
  }

  // Load chunks within RADIUS of the focus, drop ones beyond RADIUS + 1 (slack so the border doesn't thrash).
  // Coarse chunks fill every other spot out to FAR_RADIUS and never overlap a drivable one. New chunks
  // appear at the fogged rim, so spreading them over frames (budget) hides the generation cost.
  function update(focus: THREE.Vector3, budget = 2) {
    const fx = Math.round(focus.x / CHUNK_SIZE);
    const fz = Math.round(focus.z / CHUNK_SIZE);
    for (const [key, c] of chunks) {
      if ((c.cx - fx) ** 2 + (c.cz - fz) ** 2 <= (RADIUS + 1) ** 2) continue;
      remove(c.mesh);
      world.removeCollider(c.collider, false);
      chunks.delete(key);
      addFar(c.cx, c.cz); // straight away, so no hole opens; a coarse chunk is ~1/15 the work
    }
    for (const [key, c] of far) {
      if ((c.cx - fx) ** 2 + (c.cz - fz) ** 2 <= (FAR_RADIUS + 1) ** 2) continue;
      remove(c.mesh);
      far.delete(key);
    }
    let farBudget = budget * 4;
    for (let dx = -FAR_RADIUS; dx <= FAR_RADIUS; dx++) {
      for (let dz = -FAR_RADIUS; dz <= FAR_RADIUS; dz++) {
        const key = `${fx + dx},${fz + dz}`;
        const d2 = dx * dx + dz * dz;
        if (budget > 0 && d2 <= RADIUS * RADIUS && !chunks.has(key)) {
          if (far.has(key)) remove(far.get(key)!.mesh);
          far.delete(key);
          add(fx + dx, fz + dz);
          budget--;
        } else if (farBudget > 0 && d2 <= FAR_RADIUS * FAR_RADIUS && !chunks.has(key) && !far.has(key)) {
          addFar(fx + dx, fz + dz);
          farBudget--;
        }
      }
    }
  }

  return { update };
}
