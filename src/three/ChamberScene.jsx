import { Float, MeshDistortMaterial, PerspectiveCamera, Text } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';

function Architecture() {
  const group = useRef();
  const planes = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      x: (i % 3 - 1) * 5.8,
      y: -1.2 - i * 0.75,
      z: -4 - (i % 6) * 1.2,
      r: (i % 2 ? 0.16 : -0.12) + i * 0.03,
      w: 2.2 + (i % 4) * 0.8,
      h: 0.1 + (i % 3) * 0.22,
    }));
  }, []);

  useFrame(({ clock, pointer }) => {
    group.current.rotation.y = pointer.x * 0.035;
    group.current.position.x = pointer.x * 0.2;
    group.current.position.y = pointer.y * 0.08 + Math.sin(clock.elapsedTime * 0.2) * 0.05;
  });

  return (
    <group ref={group}>
      <mesh position={[0, -3.4, -7]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 46, 1, 1]} />
        <meshStandardMaterial color="#10100e" roughness={0.92} metalness={0.15} />
      </mesh>
      {planes.map((plane, index) => (
        <mesh key={index} position={[plane.x, plane.y, plane.z]} rotation={[0.03, plane.r, 0]} castShadow>
          <boxGeometry args={[plane.w, plane.h, 4.4]} />
          <meshStandardMaterial color={index % 4 === 0 ? '#252522' : '#151513'} roughness={0.86} metalness={0.42} />
        </mesh>
      ))}
      <mesh position={[-4.2, 0.1, -5.6]} rotation={[0.05, 0.55, -0.1]}>
        <torusGeometry args={[1.05, 0.035, 16, 96]} />
        <meshBasicMaterial color="#f17322" transparent opacity={0.58} />
      </mesh>
      <mesh position={[4.1, -1.5, -5.8]} rotation={[0.1, -0.48, 0.18]}>
        <torusGeometry args={[1.05, 0.035, 16, 96]} />
        <meshBasicMaterial color="#2b8cff" transparent opacity={0.58} />
      </mesh>
    </group>
  );
}

function ProjectArtifacts() {
  const group = useRef();
  useFrame(({ clock }) => {
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.18) * 0.08;
  });
  return (
    <group ref={group} position={[0, -5.2, -4.4]}>
      {[-2.8, -1.4, 0, 1.4, 2.8].map((x, index) => (
        <Float key={x} speed={1.2 + index * 0.1} floatIntensity={0.25} rotationIntensity={0.2}>
          <mesh position={[x, index % 2 ? 0.3 : -0.2, -index * 0.25]} rotation={[0.3, index * 0.4, 0.1]}>
            <boxGeometry args={[0.9, 0.55, 0.12]} />
            <meshStandardMaterial color={index % 2 ? '#1d1d1a' : '#2b2a25'} roughness={0.55} metalness={0.72} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function Overseer() {
  const eye = useRef();
  useFrame(({ pointer, clock }) => {
    eye.current.rotation.y = pointer.x * 0.22;
    eye.current.rotation.x = -pointer.y * 0.12 + Math.sin(clock.elapsedTime * 0.4) * 0.03;
  });
  return (
    <group position={[3.25, -8.2, -4.8]} ref={eye}>
      <mesh>
        <sphereGeometry args={[0.52, 32, 16]} />
        <meshStandardMaterial color="#171716" metalness={0.8} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0, 0.48]}>
        <sphereGeometry args={[0.12, 24, 12]} />
        <meshBasicMaterial color="#f4eee2" />
      </mesh>
      <mesh position={[0, 0.78, -0.08]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 2.2, 12]} />
        <meshStandardMaterial color="#3b3932" metalness={0.8} />
      </mesh>
      <Text
        position={[-1.6, -0.7, 0.2]}
        fontSize={0.16}
        color="#d8d0bf"
        anchorX="left"
        anchorY="middle"
        maxWidth={2.2}
      >
        SUBJECT IDENTIFIED
      </Text>
    </group>
  );
}

function CompanionCubeMesh() {
  const group = useRef();
  useFrame(({ clock }) => {
    group.current.rotation.x = -0.22 + Math.sin(clock.elapsedTime * 0.4) * 0.04;
    group.current.rotation.y += 0.004;
  });
  const pads = [
    [0, 0, 0.531, 0, 0, 0],
    [0, 0, -0.531, 0, Math.PI, 0],
    [0.531, 0, 0, 0, Math.PI / 2, 0],
    [-0.531, 0, 0, 0, -Math.PI / 2, 0],
    [0, 0.531, 0, -Math.PI / 2, 0, 0],
    [0, -0.531, 0, Math.PI / 2, 0, 0],
  ];
  return (
    <group ref={group} position={[-2.8, -11.2, -4.1]} scale={0.85}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <MeshDistortMaterial color="#8a8780" roughness={0.72} metalness={0.42} distort={0.05} speed={0.8} />
      </mesh>
      {pads.map((pad, index) => (
        <mesh key={index} position={pad.slice(0, 3)} rotation={pad.slice(3)}>
          <boxGeometry args={[0.52, 0.52, 0.028]} />
          <meshStandardMaterial color="#c8c1b7" roughness={0.62} metalness={0.34} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.565]}>
        <ringGeometry args={[0.12, 0.22, 5]} />
        <meshBasicMaterial color="#d4899c" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.5, 5.5]} fov={45} />
      <color attach="background" args={['#050504']} />
      <fog attach="fog" args={['#050504', 6, 18]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[-3, 5, 4]} intensity={1.1} castShadow />
      <pointLight position={[-3.6, 0.5, -3.5]} color="#f17322" intensity={3.2} distance={6} />
      <pointLight position={[3.6, -1.2, -3.5]} color="#2b8cff" intensity={2.8} distance={6} />
      <Architecture />
      <ProjectArtifacts />
      <CompanionCubeMesh />
      <Overseer />
    </>
  );
}

export function ChamberScene({ reducedMotion }) {
  return (
    <div className="chamber-canvas" aria-hidden="true">
      <Canvas
        shadows={!reducedMotion}
        dpr={reducedMotion ? [1, 1.2] : [1, 1.8]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
