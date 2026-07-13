"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type CareerCoreCanvasProps = {
  variant: "auth" | "workspace";
};

type CoreNode = {
  label: string;
  position: [number, number, number];
  size: number;
};

const workspaceNodes: CoreNode[] = [
  { label: "Resume", position: [-2.9, 1.1, -0.35], size: 0.16 },
  { label: "Jobs", position: [2.75, 1.0, -0.2], size: 0.15 },
  { label: "Skills", position: [-2.35, -1.55, 0.15], size: 0.14 },
  { label: "Analytics", position: [2.5, -1.45, -0.15], size: 0.14 },
];

const authNodes: CoreNode[] = [
  { label: "", position: [-1.9, 0.9, -0.7], size: 0.09 },
  { label: "", position: [1.7, 0.75, -0.5], size: 0.08 },
  { label: "", position: [-1.35, -1.05, -0.35], size: 0.07 },
  { label: "", position: [1.55, -0.95, -0.6], size: 0.075 },
  { label: "", position: [0.1, 1.55, -0.95], size: 0.055 },
];

export function CareerCoreCanvas({ variant }: CareerCoreCanvasProps) {
  const isWorkspace = variant === "workspace";
  const nodes = isWorkspace ? workspaceNodes : authNodes;

  return (
    <div
      className={
        isWorkspace
          ? "absolute inset-0"
          : "pointer-events-none absolute inset-0 opacity-70"
      }
    >
      <Canvas
        camera={{ position: [0, 0, isWorkspace ? 6.8 : 7.6], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.45} />
        <pointLight color="#6366f1" intensity={isWorkspace ? 1.2 : 0.55} position={[2, 2.4, 3]} />
        <pointLight color="#f5f5f5" intensity={0.18} position={[-3, -2, 4]} />
        <CoreScene nodes={nodes} variant={variant} />
      </Canvas>

      {isWorkspace ? (
        <div className="pointer-events-none absolute inset-0">
          {workspaceNodes.map((node) => (
            <NodeLabel key={node.label} node={node} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CoreScene({
  nodes,
  variant,
}: {
  nodes: CoreNode[];
  variant: CareerCoreCanvasProps["variant"];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const isWorkspace = variant === "workspace";

  useFrame((state) => {
    if (!groupRef.current) return;

    const targetY = state.pointer.x * (isWorkspace ? 0.12 : 0.06);
    const targetX = -state.pointer.y * (isWorkspace ? 0.08 : 0.04);

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetY,
      0.035,
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetX,
      0.035,
    );
  });

  return (
    <group ref={groupRef}>
      <Float speed={0.7} rotationIntensity={0.08} floatIntensity={0.14}>
        <CoreOrb variant={variant} />
      </Float>

      <OrbitalRings variant={variant} />

      {nodes.map((node) => (
        <group key={`${node.label}-${node.position.join("-")}`}>
          <Connection to={node.position} variant={variant} />
          <NetworkNode node={node} variant={variant} />
        </group>
      ))}
    </group>
  );
}

function CoreOrb({ variant }: { variant: CareerCoreCanvasProps["variant"] }) {
  const isWorkspace = variant === "workspace";

  return (
    <group>
      <Sphere args={[isWorkspace ? 0.72 : 0.44, 48, 48]}>
        <meshStandardMaterial
          color="#171717"
          emissive="#6366f1"
          emissiveIntensity={isWorkspace ? 0.28 : 0.12}
          roughness={0.62}
          metalness={0.08}
        />
      </Sphere>
      <Sphere args={[isWorkspace ? 0.98 : 0.62, 48, 48]}>
        <meshBasicMaterial
          color="#6366f1"
          transparent
          opacity={isWorkspace ? 0.08 : 0.045}
          wireframe
        />
      </Sphere>
      <Sphere args={[isWorkspace ? 1.22 : 0.86, 48, 48]}>
        <meshBasicMaterial
          color="#f5f5f5"
          transparent
          opacity={isWorkspace ? 0.035 : 0.02}
          wireframe
        />
      </Sphere>
    </group>
  );
}

function OrbitalRings({ variant }: { variant: CareerCoreCanvasProps["variant"] }) {
  const isWorkspace = variant === "workspace";

  return (
    <group>
      <Ring radius={isWorkspace ? 2.05 : 1.42} opacity={isWorkspace ? 0.13 : 0.045} rotation={[1.1, 0.1, 0.35]} />
      <Ring radius={isWorkspace ? 2.95 : 2.0} opacity={isWorkspace ? 0.08 : 0.035} rotation={[1.35, 0.35, -0.28]} />
      <Ring radius={isWorkspace ? 3.75 : 2.65} opacity={isWorkspace ? 0.055 : 0.025} rotation={[1.5, -0.18, 0.75]} />
    </group>
  );
}

function Ring({
  radius,
  opacity,
  rotation,
}: {
  radius: number;
  opacity: number;
  rotation: [number, number, number];
}) {
  return (
    <mesh rotation={rotation}>
      <torusGeometry args={[radius, 0.0035, 8, 160]} />
      <meshBasicMaterial color="#6366f1" transparent opacity={opacity} />
    </mesh>
  );
}

function NetworkNode({
  node,
  variant,
}: {
  node: CoreNode;
  variant: CareerCoreCanvasProps["variant"];
}) {
  const isWorkspace = variant === "workspace";

  return (
    <Float speed={0.55} rotationIntensity={0.05} floatIntensity={0.1}>
      <group position={node.position}>
        <Sphere args={[node.size, 24, 24]}>
          <meshStandardMaterial
            color="#262626"
            emissive="#6366f1"
            emissiveIntensity={isWorkspace ? 0.18 : 0.07}
            roughness={0.72}
            metalness={0.04}
          />
        </Sphere>
        <Sphere args={[node.size * 1.9, 24, 24]}>
          <meshBasicMaterial
            color="#6366f1"
            transparent
            opacity={isWorkspace ? 0.055 : 0.025}
            wireframe
          />
        </Sphere>
      </group>
    </Float>
  );
}

function Connection({
  to,
  variant,
}: {
  to: [number, number, number];
  variant: CareerCoreCanvasProps["variant"];
}) {
  const line = useMemo(() => {
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...to)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: variant === "workspace" ? "#6366f1" : "#f5f5f5",
      transparent: true,
      opacity: variant === "workspace" ? 0.16 : 0.045,
    });

    return new THREE.Line(geometry, material);
  }, [to, variant]);

  return <primitive object={line} />;
}

function NodeLabel({ node }: { node: CoreNode }) {
  const [x, y] = projectNodeToScreen(node.position);

  return (
    <div
      className="absolute rounded-[var(--radius-lg)] border border-[var(--surface-soft-glass-border)] bg-[rgb(17_17_17_/_58%)] px-3 py-2 text-xs text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)] backdrop-blur-xl"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span className="text-[var(--color-text-primary)]">{node.label}</span>
    </div>
  );
}

function projectNodeToScreen(position: [number, number, number]) {
  const [x, y] = position;
  return [50 + x * 11.5, 50 - y * 13.5] as const;
}
