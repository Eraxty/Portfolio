import { PerspectiveCamera, useFBX, useTexture } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { cursorStore } from '../systems/cursor/cursorStore.js';

const orange = '#f17322';
const blue = '#2b8cff';
const paper = '#eee8d9';

function damp(current, target, lambda, delta) {
  return THREE.MathUtils.damp(current, target, lambda, delta);
}

function getScrollProgress() {
  return Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
}

function fitToSize(object, targetHeight) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.x, size.y, size.z);
  object.scale.setScalar(scale);
  const newBox = new THREE.Box3().setFromObject(object);
  const newCenter = newBox.getCenter(new THREE.Vector3());
  object.position.sub(newCenter);
}

function GLaDOSModel() {
  const fbx = useFBX('/models/glados/source/GLaDOS.fbx');
  const model = useMemo(() => clone(fbx), [fbx]);
  const ref = useRef();

  useEffect(() => {
    if (!model) return;
    fitToSize(model, 3.4);
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        const hasMaterialArray = Array.isArray(child.material);
        const materials = hasMaterialArray ? child.material : [child.material];
        const nextMaterials = materials.map((material) => {
          const nextMaterial = material.clone();
          nextMaterial.roughness = Math.max(nextMaterial.roughness || 0.4, 0.46);
          nextMaterial.metalness = Math.min(nextMaterial.metalness || 0.2, 0.55);
          return nextMaterial;
        });
        child.material = hasMaterialArray ? nextMaterials : nextMaterials[0];
      }
    });
  }, [model]);

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const portalKick = cursorStore.portalEvent ? Math.max(0, 1 - (performance.now() - cursorStore.portalEvent.at) / 900) : 0;
    ref.current.rotation.y = damp(ref.current.rotation.y, cursorStore.world.x * 0.24 + portalKick * 0.18, 3, delta);
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.15) * 0.08 + portalKick * 0.12;
  });

  return (
    <group ref={ref} position={[0.5, 3.5, -5]}>
      <primitive object={model} />
    </group>
  );
}

function WheatleyModel() {
  const fbx = useFBX('/models/wheatley/source/personality_sphere_model.fbx');
  const model = useMemo(() => clone(fbx), [fbx]);
  const ref = useRef();

  useEffect(() => {
    if (!model) return;
    fitToSize(model, 0.75);
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, [model]);

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const portalKick = cursorStore.portalEvent ? Math.max(0, 1 - (performance.now() - cursorStore.portalEvent.at) / 760) : 0;
    ref.current.rotation.y += delta * (0.6 + portalKick * 3.2);
    ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.7) * 0.2;
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, cursorStore.world.x * 1.5, delta * 1.5);
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, 0.5 + cursorStore.world.y * 0.8 + portalKick * 0.25, delta * 1.5);
  });

  return (
    <group ref={ref} position={[0, 0.5, -3]}>
      <primitive object={model} />
      <pointLight color={blue} intensity={0.6} distance={2.5} decay={2} />
    </group>
  );
}

function CompanionCubeModel() {
  const fbx = useFBX('/models/companion-cube/source/CCP2.fbx');
  const model = useMemo(() => clone(fbx), [fbx]);
  const [albedo, normal, roughness, metallic] = useTexture([
    '/models/companion-cube/textures/CCP2_AlbedoTransparency.png',
    '/models/companion-cube/textures/CCP2_Normal.png',
    '/models/companion-cube/textures/CCP2_Roughness.png',
    '/models/companion-cube/textures/CCP2_MetallicSmoothness.png',
  ]);
  const ref = useRef();

  useEffect(() => {
    if (!model) return;
    fitToSize(model, 0.95);
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = new THREE.MeshStandardMaterial({
          map: albedo,
          normalMap: normal,
          roughnessMap: roughness,
          metalnessMap: metallic,
          roughness: 0.7,
          metalness: 0.3,
        });
      }
    });
  }, [model, albedo, normal, roughness, metallic]);

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const portalKick = cursorStore.portalEvent ? Math.max(0, 1 - (performance.now() - cursorStore.portalEvent.at) / 800) : 0;
    ref.current.rotation.y += delta * (0.2 + portalKick * 2);
    ref.current.rotation.x += delta * 0.08;
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.45) * 0.08 - portalKick * 0.16;
  });

  return (
    <group ref={ref} position={[3.5, -2, -3.5]}>
      <primitive object={model} />
    </group>
  );
}

function ChamberGeometry() {
  const panelMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#161612',
    roughness: 0.82,
    metalness: 0.18,
  }), []);
  const lineMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: paper,
    transparent: true,
    opacity: 0.13,
  }), []);

  return (
    <group position={[0, -2.85, -4.2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={panelMaterial}>
        <planeGeometry args={[12, 16, 1, 1]} />
      </mesh>
      {Array.from({ length: 7 }, (_, index) => (
        <mesh key={`floor-x-${index}`} position={[-6 + index * 2, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={lineMaterial}>
          <planeGeometry args={[0.012, 16]} />
        </mesh>
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <mesh key={`floor-z-${index}`} position={[0, 0.008, -8 + index * 2]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={lineMaterial}>
          <planeGeometry args={[0.012, 12]} />
        </mesh>
      ))}
      <mesh position={[0, 4.1, -7.2]} receiveShadow material={panelMaterial}>
        <boxGeometry args={[12, 0.1, 7]} />
      </mesh>
    </group>
  );
}

function ScrollRig({ children }) {
  const rig = useRef();
  const camera = useThree((state) => state.camera);
  useFrame((_, delta) => {
    const progress = getScrollProgress();
    if (rig.current) {
      rig.current.position.y = damp(rig.current.position.y, progress * 10.2, 2.4, delta);
    }
    const portalKick = cursorStore.portalEvent ? Math.max(0, 1 - (performance.now() - cursorStore.portalEvent.at) / 720) : 0;
    camera.position.y = damp(camera.position.y, 0.5 - progress * 0.6, 1.8, delta);
    camera.rotation.z = damp(camera.rotation.z, cursorStore.world.x * 0.012, 2, delta);
    camera.fov = damp(camera.fov, 43 + portalKick * 3.5, 4, delta);
    camera.updateProjectionMatrix();

    if (cursorStore.anomalyActive) {
      camera.position.x += (Math.random() - 0.5) * 0.15;
      camera.position.y += (Math.random() - 0.5) * 0.15;
      camera.rotation.z += (Math.random() - 0.5) * 0.06;
    } else {
      camera.position.x = damp(camera.position.x, 0, 2.4, delta);
    }
  });
  return <group ref={rig}>{children}</group>;
}

function Scene({ reducedMotion }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.5, 5.5]} fov={43} />
      <color attach="background" args={['#050504']} />
      <fog attach="fog" args={['#050504', 7, 22]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-3, 5, 4]} intensity={1.2} castShadow={!reducedMotion} />
      <pointLight position={[0, 2, -2]} color={paper} intensity={0.4} distance={8} decay={2} />
      <pointLight position={[-2, 0, -3]} color={blue} intensity={0.3} distance={6} decay={2} />
      <pointLight position={[2, 0, -3]} color={orange} intensity={0.3} distance={6} decay={2} />
      <ScrollRig>
        <ChamberGeometry />
        <GLaDOSModel />
        <WheatleyModel />
        <CompanionCubeModel />
      </ScrollRig>
    </>
  );
}

export function ChamberScene({ reducedMotion }) {
  return (
    <div className="chamber-canvas" aria-hidden="true">
      <Canvas
        shadows={!reducedMotion}
        dpr={reducedMotion ? [0.8, 1.1] : [1, 1.45]}
        gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
        frameloop="always"
      >
        <Suspense fallback={null}>
          <Scene reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
