import * as THREE from 'three';

// t = time of day 0..1: 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset.
export const DAY = {
  length: 1200, // s for a full cycle
  start: 0.3018, // morning golden hour: puts the sun where #17's fixed sun was, low behind-left of the start heading
  tilt: Math.PI / 6, // sun path tilted 30° off vertical, so noon is 60° up, not overhead
  yaw: 2.3404, // turns the sun path so the start sun matches #17's
};

// Looks keyed by sun elevation (sin), so dawn mirrors dusk; light is the moon below y = 0.
const KEYS = [
  { y: -0.5, light: 0x8ea6d8, lightIntensity: 0.7, hemiSky: 0x3c5078, hemiGround: 0x2a2630, hemiIntensity: 0.9, horizon: 0x101a2e, zenith: 0x03060f, stars: 1, lamps: 1 },
  { y: -0.12, light: 0x9aa8d0, lightIntensity: 0.25, hemiSky: 0x6c6c98, hemiGround: 0x4a3438, hemiIntensity: 0.7, horizon: 0x4a3c58, zenith: 0x16223e, stars: 0.4, lamps: 1 },
  { y: 0, light: 0xff9050, lightIntensity: 0, hemiSky: 0xffb890, hemiGround: 0x985a44, hemiIntensity: 0.65, horizon: 0xf0905c, zenith: 0x5a78a8, stars: 0, lamps: 0.6 },
  { y: 0.276, light: 0xffd0a0, lightIntensity: 3.2, hemiSky: 0xffd8b8, hemiGround: 0xc07848, hemiIntensity: 0.8, horizon: 0xf8c487, zenith: 0x8fb4de, stars: 0, lamps: 0 }, // #17's golden hour
  { y: 0.75, light: 0xfff2e0, lightIntensity: 3, hemiSky: 0xe0ecff, hemiGround: 0xc89468, hemiIntensity: 0.9, horizon: 0xdfe4e2, zenith: 0x4f88c8, stars: 0, lamps: 0 },
];

const UP = new THREE.Vector3(0, 1, 0);

export function skyAt(t: number) {
  const a = 2 * Math.PI * (t - 0.25);
  const sunDir = new THREE.Vector3(Math.cos(a), Math.sin(a) * Math.cos(DAY.tilt), Math.sin(a) * Math.sin(DAY.tilt)).applyAxisAngle(UP, DAY.yaw);
  const i = THREE.MathUtils.clamp(KEYS.filter((k) => k.y <= sunDir.y).length, 1, KEYS.length - 1);
  const [k0, k1] = [KEYS[i - 1], KEYS[i]];
  const f = THREE.MathUtils.clamp((sunDir.y - k0.y) / (k1.y - k0.y), 0, 1);
  const color = (key: 'light' | 'hemiSky' | 'hemiGround' | 'horizon' | 'zenith') => new THREE.Color(k0[key]).lerp(new THREE.Color(k1[key]), f);
  const lerp = (key: 'lightIntensity' | 'hemiIntensity' | 'stars' | 'lamps') => THREE.MathUtils.lerp(k0[key], k1[key], f);
  return {
    sunDir,
    lightDir: sunDir.y >= 0 ? sunDir.clone() : sunDir.clone().negate(), // the moon sits opposite the sun
    light: color('light'),
    lightIntensity: lerp('lightIntensity'),
    hemiSky: color('hemiSky'),
    hemiGround: color('hemiGround'),
    hemiIntensity: lerp('hemiIntensity'),
    horizon: color('horizon'), // also the fog colour, so terrain always melts into the sky
    zenith: color('zenith'),
    stars: lerp('stars'),
    lamps: lerp('lamps'), // headlight level, 0 by day
  };
}

export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0, 250, 650); // haze only toward the far chunk ring's edge (~680 m), in the horizon colour so terrain melts into the sky
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);

  const hemi = new THREE.HemisphereLight();
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(); // the moon too, at night: still the only shadow caster
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const uniforms = { horizon: { value: new THREE.Color() }, zenith: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, stars: { value: 0 } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 horizon, zenith, sunDir;
        uniform float stars;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          vec3 col = mix(horizon, zenith, pow(max(dir.y, 0.0), 0.8));
          float sun = max(dot(dir, sunDir), 0.0);
          col += vec3(1.0, 0.6, 0.3) * (pow(sun, 8.0) * 0.35 + pow(sun, 800.0) * 2.0);
          // Stars: a sparse hash over direction cells; the moon: a pale disc opposite the sun.
          float star = step(0.9985, fract(sin(dot(floor(dir * 300.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453));
          col += stars * (star * smoothstep(0.0, 0.2, dir.y) * 0.8 + smoothstep(0.99996, 0.99998, dot(dir, -sunDir)) * vec3(0.8, 0.85, 0.95));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const param = Number(new URL(location.href).searchParams.get('time') ?? NaN); // ?time=0.x starts elsewhere in the cycle
  let t = Number.isFinite(param) ? ((param % 1) + 1) % 1 : DAY.start;

  // Advance the clock, light the scene for it, and keep sky and the shadow frustum centred on whatever we're looking at.
  // Returns the headlight level.
  function update(dt: number, focus: THREE.Vector3) {
    t = (t + dt / DAY.length) % 1;
    const s = skyAt(t);
    sun.color.copy(s.light);
    sun.intensity = s.lightIntensity;
    hemi.color.copy(s.hemiSky);
    hemi.groundColor.copy(s.hemiGround);
    hemi.intensity = s.hemiIntensity;
    fog.color.copy(s.horizon);
    uniforms.horizon.value.copy(s.horizon);
    uniforms.zenith.value.copy(s.zenith);
    uniforms.sunDir.value.copy(s.sunDir);
    uniforms.stars.value = s.stars;
    scene.environmentIntensity = THREE.MathUtils.lerp(0.12, 0.8, 1 - s.lamps);
    sky.position.copy(camera.position);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(s.lightDir, 100);
    return s.lamps;
  }

  // Capture the existing sky once; its reflection gives paint and glass a readable horizon.
  update(0.5, new THREE.Vector3());
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(scene, 0.04, 0.1, 1000, { size: 128 }).texture;
  pmrem.dispose();

  return { renderer, scene, camera, update };
}
