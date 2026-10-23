'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type View = 'perspective' | 'top';

type Props = {
  view: View;
  onReady: () => void;
  onError: () => void;
};

type Rig = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  manual: { current: boolean };
};

// Dimensions in metres: doubles court 6.10 x 13.40; net at z=0.
// Entire scene is composed of lightweight geometry; no GLB/model downloads.
function buildCourt(scene: THREE.Scene) {
  const court = new THREE.Group();
  scene.add(court);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(6.75, 0.28, 14.05),
    new THREE.MeshStandardMaterial({ color: '#0b3f34', roughness: 0.35, metalness: 0.36 }),
  );
  deck.position.y = -0.20;
  court.add(deck);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.34, 0.045, 13.64),
    new THREE.MeshStandardMaterial({ color: '#116f59', roughness: 0.75, metalness: 0.07 }),
  );
  base.position.y = -0.035;
  court.add(base);

  const bright = new THREE.MeshStandardMaterial({
    color: '#e7ffdf', emissive: '#b5ff81', emissiveIntensity: 0.65,
    roughness: 0.5, metalness: 0.03,
  });
  const dim = new THREE.MeshStandardMaterial({ color: '#619a82', transparent: true, opacity: 0.21 });
  const thick = 0.049;
  const addLine = (x1: number, z1: number, x2: number, z2: number, mat = bright, w = thick) => {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.011, length), mat);
    bar.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2);
    bar.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    court.add(bar);
  };

  // Subtle floor plank geometry, visually below court markings.
  for (let x = -2.9; x <= 3; x += 0.58) {
    addLine(x, -6.55, x, 6.55, dim, 0.015);
  }
  for (const x of [-3.05, 3.05, -2.59, 2.59]) addLine(x, -6.7, x, 6.7);
  for (const z of [-6.7, 6.7]) addLine(-3.05, z, 3.05, z);
  for (const z of [-5.94, -1.98, 1.98, 5.94]) addLine(-3.05, z, 3.05, z);
  addLine(0, -6.7, 0, -1.98);
  addLine(0, 1.98, 0, 6.7);

  // Full-height badminton net with posts, grid and white tape.
  const net = new THREE.Group();
  court.add(net);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#bce5d4', metalness: 0.7, roughness: 0.27 });
  for (const x of [-3.11, 3.11]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 1.62, 8), poleMat);
    pole.position.set(x, 0.78, 0);
    net.add(pole);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 12), poleMat);
    foot.position.set(x, 0.03, 0);
    net.add(foot);
  }
  const netMeshMat = new THREE.LineBasicMaterial({ color: '#d6f2e9', transparent: true, opacity: 0.36 });
  const gridPositions: number[] = [];
  for (let i = 0; i <= 38; i++) {
    const x = -3.06 + (6.12 * i) / 38;
    gridPositions.push(x, 0.16, 0, x, 1.51, 0);
  }
  for (let i = 0; i <= 11; i++) {
    const y = 0.16 + (1.35 * i) / 11;
    gridPositions.push(-3.06, y, 0, 3.06, y, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
  net.add(new THREE.LineSegments(geo, netMeshMat));
  const tape = new THREE.Mesh(
    new THREE.BoxGeometry(6.20, 0.048, 0.035),
    new THREE.MeshStandardMaterial({ color: '#f5fff0', emissive: '#efffc9', emissiveIntensity: 0.26 }),
  );
  tape.position.set(0, 1.53, 0);
  net.add(tape);

  // Elevated halo lines frame the miniature court without bloom/postprocessing.
  const accent = new THREE.MeshBasicMaterial({ color: '#8aff69', transparent: true, opacity: 0.22 });
  for (const [x, z, w, d] of [
    [0, -7.0, 7.1, 0.025], [0, 7.0, 7.1, 0.025],
    [-3.45, 0, 0.025, 14.0], [3.45, 0, 0.025, 14.0],
  ] as number[][]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), accent);
    edge.position.set(x, -0.19, z);
    court.add(edge);
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(11.2, 19.3),
    new THREE.MeshBasicMaterial({ color: '#000e0b', transparent: true, opacity: 0.17, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.39;
  scene.add(shadow);

  // Floating sculptural shuttlecock, assembled from reusable primitives.
  const shuttle = new THREE.Group();
  shuttle.position.set(0, 2.65, 1.2);
  shuttle.rotation.z = 0.28;
  shuttle.scale.setScalar(1.45);
  scene.add(shuttle);
  const quills = new THREE.Mesh(
    new THREE.CylinderGeometry(0.37, 0.11, 0.60, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: '#f3fff2', transparent: true, opacity: 0.91, side: THREE.DoubleSide, roughness: 0.92 }),
  );
  quills.position.y = 0.16;
  shuttle.add(quills);
  const spineMat = new THREE.LineBasicMaterial({ color: '#93c8af', transparent: true, opacity: 0.7 });
  const shafts: number[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    shafts.push(Math.cos(a) * 0.11, -0.12, Math.sin(a) * 0.11);
    shafts.push(Math.cos(a) * 0.37, 0.47, Math.sin(a) * 0.37);
  }
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute(shafts, 3));
  shuttle.add(new THREE.LineSegments(shaftGeo, spineMat));
  const cork = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.16, 0.22, 14),
    new THREE.MeshStandardMaterial({ color: '#f3e6c8', roughness: 0.9 }),
  );
  cork.position.y = -0.25;
  shuttle.add(cork);

  // Small court-position markers give the visual context without fake player data.
  const marker = (x: number, z: number, hex: string) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.023, 6, 32),
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.95 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.044, z);
    court.add(ring);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 7), new THREE.MeshBasicMaterial({ color: hex }));
    core.position.set(x, 0.11, z);
    court.add(core);
  };
  marker(-1.3, -3.3, '#c7ff83');
  marker(1.4, 3.1, '#fff5b0');

  // Large, faint rings anchored to the stage, with no high-cost shadows.
  for (const r of [8.6, 10.2]) {
    const circle = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.012, 3, 100),
      new THREE.MeshBasicMaterial({ color: '#5eb28d', transparent: true, opacity: 0.12 }),
    );
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = -0.34;
    scene.add(circle);
  }
  return shuttle;
}

export function CommunityThreeScene({ view, onReady, onError }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const rig = useRef<Rig | null>(null);
  const propsRef = useRef({ onReady, onError });
  const viewRef = useRef(view);
  // Cập nhật sau mỗi lần render (không ghi ref trong lúc render).
  useEffect(() => {
    propsRef.current = { onReady, onError };
  });

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer | null = null;
    let observer: ResizeObserver | undefined;
    let resizeFallback: (() => void) | undefined;
    let visibility: IntersectionObserver | undefined;
    let controls: OrbitControls | undefined;
    let scene: THREE.Scene | undefined;
    let contextLost: ((event: Event) => void) | undefined;
    let canceled = false;

    try {
      const mobile = window.matchMedia('(pointer: coarse)').matches;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !mobile, powerPreference: mobile ? 'low-power' : 'high-performance' });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.65));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.45;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'pan-y';
      host.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xe7ffee, 1.6));
      const hemisphere = new THREE.HemisphereLight(0xd9f6ff, 0x123a20, 2);
      scene.add(hemisphere);
      const key = new THREE.DirectionalLight(0xffffff, 3.5);
      key.position.set(-8, 13, 11);
      scene.add(key);
      const rim = new THREE.PointLight(0x95ff5a, 30, 30);
      rim.position.set(4, 8, -5);
      scene.add(rim);
      const shuttle = buildCourt(scene);

      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
      camera.position.set(13.6, 18.0, 23.5);
      camera.lookAt(0, 0.3, 0);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.065;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = !mobile; // let one-finger mobile swipes scroll the page
      controls.minPolarAngle = 0.18;
      controls.maxPolarAngle = 1.36;
      controls.minAzimuthAngle = -Math.PI;
      controls.maxAzimuthAngle = Math.PI;
      controls.target.set(0, 0.3, 0);
      controls.update();
      const manual = { current: false };
      controls.addEventListener('start', () => { manual.current = true; });
      rig.current = { camera, controls, manual };

      const resize = () => {
        if (!renderer || canceled) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        camera.aspect = width / height;
        camera.fov = width < 430 ? 43 : width < 640 ? 39 : 36;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        renderer.render(scene!, camera);
      };
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize);
        observer.observe(host);
      } else {
        resizeFallback = resize;
        window.addEventListener('resize', resizeFallback);
      }
      resize();

      let visible = true;
      if (typeof IntersectionObserver !== 'undefined') {
        visibility = new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting ?? false; }, { threshold: 0.02 });
        visibility.observe(host);
      }
      let last = 0;
      const clock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        if (!renderer || canceled || !visible || document.hidden) return;
        const now = performance.now();
        if (now - last < (mobile || reduced ? 45 : 22)) return;
        last = now;
        const t = clock.getElapsedTime();
        if (!reduced) {
          shuttle.position.y = 2.65 + Math.sin(t * 1.05) * 0.17;
          shuttle.rotation.y = Math.sin(t * 0.5) * 0.30;
        }
        const desired = viewRef.current === 'top'
          ? new THREE.Vector3(0.01, 25.5, 0.02)
          : new THREE.Vector3(13.6, 18.0, 23.5);
        if (!manual.current) {
          camera.position.lerp(desired, reduced ? 1 : 0.085);
        }
        controls!.update();
        renderer.render(scene!, camera);
      });
      propsRef.current.onReady();
      contextLost = (event) => { event.preventDefault(); propsRef.current.onError(); };
      renderer.domElement.addEventListener('webglcontextlost', contextLost, false);
    } catch (err) {
      console.warn('Rally 3D: fallback to static court.', err);
      propsRef.current.onError();
    }

    return () => {
      canceled = true;
      rig.current = null;
      observer?.disconnect();
      if (resizeFallback) window.removeEventListener('resize', resizeFallback);
      visibility?.disconnect();
      if (renderer) {
        renderer.setAnimationLoop(null);
        if (contextLost) renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      }
      controls?.dispose();
      scene?.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer?.dispose();
      if (renderer?.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    viewRef.current = view;
    if (rig.current) rig.current.manual.current = false;
  }, [view]);

  return <div ref={mount} className="r3d-webgl-canvas absolute inset-0" aria-hidden="true" />;
}
