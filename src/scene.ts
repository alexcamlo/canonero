import * as THREE from 'three';

const HORIZON = new THREE.Color(0xf4b67e);
const ZENITH = new THREE.Color(0x5f78b0);
const SUN_DIR = new THREE.Vector3(-0.6, 0.18, -0.78).normalize(); // low sun = golden hour

export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HORIZON, 50, 240); // haze matches the horizon colour so far terrain melts into the sky
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);

  scene.add(new THREE.HemisphereLight(0xffd2a0, 0xb8703e, 1.4));

  const sun = new THREE.DirectionalLight(0xffb36b, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { horizon: { value: HORIZON }, zenith: { value: ZENITH }, sunDir: { value: SUN_DIR } },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 horizon, zenith, sunDir;
        varying vec3 vDir;
        void main() {
          vec3 col = mix(horizon, zenith, pow(max(vDir.y, 0.0), 0.6));
          float sun = max(dot(normalize(vDir), sunDir), 0.0);
          col += vec3(1.0, 0.6, 0.3) * (pow(sun, 8.0) * 0.35 + pow(sun, 800.0) * 2.0);
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

  // Keep sky and the sun's shadow frustum centred on whatever we're looking at.
  function follow(focus: THREE.Vector3) {
    sky.position.copy(camera.position);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(SUN_DIR, 100);
  }

  return { renderer, scene, camera, follow };
}
