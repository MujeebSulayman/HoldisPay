'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

const ORBIT_COUNT = 3;
const PARTICLE_COUNT = 160;

export function ThreeHeroScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [threeReady, setThreeReady] = useState(() => typeof window !== 'undefined' && 'THREE' in window);

  useEffect(() => {
    const threeWindow = window as Window & { THREE?: unknown };
    if (!threeReady || !mountRef.current || !threeWindow.THREE) return;

    const mount = mountRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const THREE = threeWindow.THREE as any;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#020617', 0.11);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.4, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const ambient = new THREE.AmbientLight('#67e8f9', 1.3);
    scene.add(ambient);

    const keyLight = new THREE.PointLight('#14b8a6', 20, 30, 2);
    keyLight.position.set(6, 4, 8);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight('#818cf8', 16, 35, 2);
    rimLight.position.set(-7, -3, 6);
    scene.add(rimLight);

    const escrowCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.45, 1),
      new THREE.MeshPhysicalMaterial({
        color: '#14b8a6',
        emissive: '#0f766e',
        emissiveIntensity: 1.5,
        roughness: 0.22,
        metalness: 0.15,
        transmission: 0.15,
        transparent: true,
        opacity: 0.92,
      }),
    );
    root.add(escrowCore);

    const coreWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.72, 1)),
      new THREE.LineBasicMaterial({ color: '#99f6e4', transparent: true, opacity: 0.5 }),
    );
    root.add(coreWire);

    const rings = Array.from({ length: ORBIT_COUNT }, (_, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.6 + index * 0.7, 0.028, 20, 180),
        new THREE.MeshBasicMaterial({
          color: '#5eead4',
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = index === 0 ? Math.PI / 2.5 : index === 1 ? Math.PI / 1.9 : Math.PI / 3.1;
      ring.rotation.y = index * 0.8;
      root.add(ring);
      return ring;
    });

    const tokenGeometry = new THREE.SphereGeometry(0.12, 18, 18);
    const tokenMaterials = ['#ffffff', '#5eead4', '#818cf8'].map(
      (color) => new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        metalness: 0.15,
      }),
    );

    const tokens = rings.map((_, index) => {
      const token = new THREE.Mesh(tokenGeometry, tokenMaterials[index % tokenMaterials.length]);
      token.userData = {
        radius: 2.6 + index * 0.7,
        speed: 0.45 + index * 0.15,
        tilt: index * 0.9,
        yOffset: index === 1 ? 0.55 : index === 2 ? -0.35 : 0,
      };
      root.add(token);
      return token;
    });

    const shield = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.72, 0),
      new THREE.MeshPhysicalMaterial({
        color: '#f8fafc',
        emissive: '#67e8f9',
        emissiveIntensity: 0.35,
        roughness: 0.18,
        metalness: 0.45,
        transparent: true,
        opacity: 0.8,
      }),
    );
    shield.position.set(0, -0.15, 0);
    root.add(shield);

    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const radius = THREE.MathUtils.randFloat(4.4, 8.8);
      const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
      const phi = THREE.MathUtils.randFloat(0.4, Math.PI - 0.4);
      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.cos(phi) * 0.55;
      particlePositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    const particles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: '#99f6e4',
        size: 0.045,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    particles.geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    scene.add(particles);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    let frameId = 0;

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const motionFactor = reducedMotion ? 0.2 : 1;

      root.rotation.y = elapsed * 0.18 * motionFactor;
      root.rotation.x = Math.sin(elapsed * 0.25) * 0.12 * motionFactor;

      escrowCore.rotation.x += 0.003 * motionFactor;
      escrowCore.rotation.y += 0.0045 * motionFactor;
      coreWire.rotation.x -= 0.0025 * motionFactor;
      coreWire.rotation.y += 0.003 * motionFactor;

      shield.rotation.y -= 0.01 * motionFactor;
      shield.position.y = -0.15 + Math.sin(elapsed * 1.3) * 0.12 * motionFactor;

      rings.forEach((ring, index) => {
        ring.rotation.z += (0.0018 + index * 0.0009) * motionFactor;
        ring.rotation.x += (index % 2 === 0 ? 0.0009 : -0.0011) * motionFactor;
      });

      tokens.forEach((token, index) => {
        const { radius, speed, tilt, yOffset } = token.userData as {
          radius: number;
          speed: number;
          tilt: number;
          yOffset: number;
        };
        const angle = elapsed * speed + index * 2.1;
        token.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle + tilt) * 0.7 + yOffset,
          Math.sin(angle) * radius,
        );
      });

      particles.rotation.y = elapsed * 0.02 * motionFactor;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frameId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }

      escrowCore.geometry.dispose();
      escrowCore.material.dispose();
      coreWire.geometry.dispose();
      coreWire.material.dispose();
      shield.geometry.dispose();
      shield.material.dispose();
      tokenGeometry.dispose();
      tokenMaterials.forEach((material) => material.dispose());
      rings.forEach((ring) => {
        ring.geometry.dispose();
        ring.material.dispose();
      });
      particles.geometry.dispose();
      particles.material.dispose();
      renderer.dispose();
    };
  }, [threeReady]);

  return (
    <>
      <Script
        src="https://unpkg.com/three@0.181.1/build/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setThreeReady(true)}
      />
      <div className="relative isolate w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.16),rgba(2,6,23,0.92)_58%)] shadow-[0_40px_100px_-40px_rgba(20,184,166,0.55)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_28%,transparent_72%,rgba(129,140,248,0.12))]" />
        <div className="pointer-events-none absolute inset-x-6 top-6 flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-teal-200/70 sm:text-xs">
          <span>Protected pay</span>
          <span>Quick pay</span>
        </div>
        <div ref={mountRef} className="h-[340px] w-full sm:h-[420px] lg:h-[520px]" />
        {!threeReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
            <div className="h-14 w-14 animate-spin rounded-full border border-teal-400/30 border-t-teal-300" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#020617] to-transparent" />
        <div className="pointer-events-none absolute left-4 top-16 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 backdrop-blur-md sm:left-6 sm:top-20">
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-400">Escrow core</p>
          <p className="mt-1 text-sm font-semibold text-white sm:text-base">Funds stay protected until both sides are ready.</p>
        </div>
        <div className="pointer-events-none absolute bottom-5 right-4 rounded-2xl border border-teal-400/20 bg-slate-950/70 px-4 py-3 backdrop-blur-md sm:bottom-6 sm:right-6">
          <p className="text-[11px] uppercase tracking-[0.24em] text-teal-300/70">Multi-rail payout</p>
          <p className="mt-1 text-sm font-semibold text-white sm:text-base">Stablecoins in orbit. Fiat withdrawal on demand.</p>
        </div>
      </div>
    </>
  );
}
