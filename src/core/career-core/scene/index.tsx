"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { careerCoreModeVisualConfig } from "../config";
import { useCareerCoreMotionStore } from "../motion/context";
import { syncMotionCssProperties } from "../motion/shared";
import type {
  CareerCoreEngineState,
  CareerCoreModeVisualConfig,
  CareerCoreModuleId,
} from "../types";

type NetworkNode = {
  id: number;
  connections: Array<{
    id: number;
    strength: number;
  }>;
  distanceFromRoot: number;
  level: number;
  position: THREE.Vector3;
  phase: number;
  size: number;
  type: "root" | "branch" | "leaf";
};

type NetworkConnection = {
  from: number;
  to: number;
  strength: number;
};

type ModuleAnchor = {
  id: "resume" | "jobs" | "skills" | "analytics";
  label: "Resume" | "Jobs" | "Skills" | "Analytics";
  nodeId: number;
};

const LAYERS = 6;
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const moduleAnchorIds = ["resume", "jobs", "skills", "analytics"] as const;
const moduleAnchorLabels = ["Resume", "Jobs", "Skills", "Analytics"] as const;

type CareerCoreSceneProps = {
  state: CareerCoreEngineState;
};

export function CareerCoreScene({ state }: CareerCoreSceneProps) {
  const visualConfig =
    state.mode === "signin" ||
    state.mode === "signup" ||
    state.mode === "workspace" ||
    state.mode === "presentation"
      ? careerCoreModeVisualConfig[state.mode]
      : careerCoreModeVisualConfig.presentation;

  return (
    <section style={{ position: "relative", height: "100%", width: "100%", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 44%, rgb(99 102 241 / 16%), transparent 36%), linear-gradient(180deg, rgb(17 17 17 / 10%), rgb(5 5 5 / 28%))",
          pointerEvents: "none",
        }}
      />
      <Canvas
        camera={{
          position: [0, 0, visualConfig.cameraDistance],
          fov: visualConfig.cameraFov,
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <fog attach="fog" args={["#050505", visualConfig.fogNear, visualConfig.fogFar]} />
        <ambientLight intensity={0.5} />
        <pointLight color="#5B5698" intensity={1.55} position={[3.2, 3.6, 5]} />
        <pointLight color="#f5f5f5" intensity={0.14} position={[-4, -3, 5]} />
        <MotionBridge reducedMotion={state.reducedMotion} />
        <NetworkScene
          highlightedModule={state.highlightedModule}
          visualConfig={visualConfig}
        />
      </Canvas>
    </section>
  );
}

function MotionBridge({ reducedMotion }: { reducedMotion: boolean }) {
  const motionStore = useCareerCoreMotionStore();

  useFrame((state) => {
    if (!motionStore) return;

    motionStore.snapshot.pointerX = state.pointer.x;
    motionStore.snapshot.pointerY = state.pointer.y;
    motionStore.snapshot.pulsePhase = state.clock.elapsedTime * 1.85;
    motionStore.snapshot.reducedMotion = reducedMotion;

    const container = motionStore.containerRef.current;
    if (container) {
      syncMotionCssProperties(container, motionStore.snapshot);
    }
  });

  return null;
}

function NetworkScene({
  highlightedModule,
  visualConfig,
}: {
  highlightedModule: CareerCoreModuleId | null;
  visualConfig: CareerCoreModeVisualConfig;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { nodes, connections, rootNode, moduleAnchors } = useMemo(
    () => createCrystallineNetwork(visualConfig.densityFactor),
    [visualConfig.densityFactor],
  );
  const bounds = useMemo(() => calculateNetworkBounds(nodes), [nodes]);
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.viewport);
  const velocityRef = useRef({ x: 0, y: 0, z: 0 });
  const hoveredModule = highlightedModule;
  const frameScale = useMemo(() => {
    const targetHeight = viewport.height * visualConfig.targetHeightRatio;
    const targetWidth = viewport.width * visualConfig.targetWidthRatio;
    const scale = Math.min(targetHeight / bounds.height, targetWidth / bounds.width);

    return THREE.MathUtils.clamp(scale, 0.32, 2.4);
  }, [
    bounds.height,
    bounds.width,
    viewport.height,
    viewport.width,
    visualConfig.targetHeightRatio,
    visualConfig.targetWidthRatio,
  ]);

  useFrame((state) => {
    if (!groupRef.current) return;

    camera.position.set(0, 0, visualConfig.cameraDistance);
    camera.lookAt(0, 0, 0);

    const targetY = state.pointer.x * 0.58 + Math.sin(state.clock.elapsedTime * 0.12) * 0.06;
    const targetX = -state.pointer.y * 0.38 + Math.sin(state.clock.elapsedTime * 0.09) * 0.04;
    const targetZ = state.pointer.x * 0.08 + Math.sin(state.clock.elapsedTime * 0.16) * 0.045;
    const velocity = velocityRef.current;

    velocity.y += (targetY - groupRef.current.rotation.y) * 0.032;
    velocity.x += (targetX - groupRef.current.rotation.x) * 0.032;
    velocity.z += (targetZ - groupRef.current.rotation.z) * 0.026;

    velocity.y *= 0.88;
    velocity.x *= 0.88;
    velocity.z *= 0.9;

    groupRef.current.rotation.y += velocity.y;
    groupRef.current.rotation.x += velocity.x;
    groupRef.current.rotation.z += velocity.z;
  });

  return (
    <group ref={groupRef} scale={frameScale}>
      <PulseWaves />
      <CentralNeuralMesh rootNode={rootNode} rootIntensity={visualConfig.rootIntensity} />
      <ConnectionField
        connections={connections}
        hoveredModule={hoveredModule}
        moduleAnchors={moduleAnchors}
        nodes={nodes}
        visualConfig={visualConfig}
      />
      <NodeField nodes={nodes} visualConfig={visualConfig} />
    </group>
  );
}

function CentralNeuralMesh({
  rootIntensity,
  rootNode,
}: {
  rootIntensity: number;
  rootNode: NetworkNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const meshPoints = useMemo(
    () => [
      new THREE.Vector3(-0.55, 0.28, 0.22),
      new THREE.Vector3(0.02, 0.62, -0.16),
      new THREE.Vector3(0.58, 0.18, 0.18),
      new THREE.Vector3(-0.32, -0.46, 0.2),
      new THREE.Vector3(0.42, -0.5, -0.14),
      new THREE.Vector3(0, 0, 0.46),
      new THREE.Vector3(0.18, -0.02, -0.42),
    ],
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    const wave = Math.sin(state.clock.elapsedTime * 1.55);
    groupRef.current.scale.setScalar(1 + Math.max(wave, 0) * 0.035);
    groupRef.current.rotation.z = state.clock.elapsedTime * 0.035;

    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = rootIntensity + Math.max(wave, 0) * 0.24;
    }

    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = 0.12 + Math.max(wave, 0) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={rootNode.position} scale={[1.18, 0.68, 0.96]}>
      <mesh>
        <sphereGeometry args={[0.74, 48, 48]} />
        <meshStandardMaterial
          ref={coreMaterialRef}
          color="#171717"
          emissive="#5B5698"
          emissiveIntensity={rootIntensity}
          metalness={0.08}
          roughness={0.62}
        />
      </mesh>
      <mesh rotation={[1.24, 0.16, 0.28]}>
        <torusGeometry args={[1.18, 0.007, 8, 160]} />
        <meshBasicMaterial ref={ringMaterialRef} color="#5B5698" transparent opacity={0.12} />
      </mesh>
      <mesh rotation={[1.52, -0.38, -0.5]}>
        <torusGeometry args={[1.48, 0.005, 8, 160]} />
        <meshBasicMaterial color="#f5f5f5" transparent opacity={0.05} />
      </mesh>
      {meshPoints.slice(0, 4).map((point, index) => (
        <mesh key={`mesh-point-${index}`} position={point}>
          <sphereGeometry args={[0.036, 16, 16]} />
          <meshBasicMaterial color="#5B5698" transparent opacity={0.72} />
        </mesh>
      ))}
      {meshPoints.slice(1, 4).map((point, index) => (
        <TubeConnection key={`core-link-${index}`} from={new THREE.Vector3(0, 0, 0)} opacity={0.22} to={point} />
      ))}
    </group>
  );
}

function NodeField({
  nodes,
  visualConfig,
}: {
  nodes: NetworkNode[];
  visualConfig: CareerCoreModeVisualConfig;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const sizes: number[] = [];
    const phases: number[] = [];
    const levels: number[] = [];

    for (const node of nodes) {
      if (node.type === "root") continue;

      positions.push(node.position.x, node.position.y, node.position.z);
      sizes.push(node.size);
      phases.push(node.phase);
      levels.push(node.level);
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    buffer.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    buffer.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
    buffer.setAttribute("aLevel", new THREE.Float32BufferAttribute(levels, 1));

    return buffer;
  }, [nodes]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fragmentShader: `
          uniform vec3 uColor;
          uniform vec3 uSoftWhite;
          uniform float uNodeOpacity;
          varying float vPulse;
          varying float vAlpha;

          void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            float alpha = smoothstep(0.5, 0.16, dist) * vAlpha * uNodeOpacity;
            vec3 color = mix(uColor, uSoftWhite, vPulse * 0.45);
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        uniforms: {
          uColor: { value: new THREE.Color("#5B5698") },
          uNodeOpacity: { value: visualConfig.nodeOpacity },
          uPointScale: { value: visualConfig.pointScale },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uSoftWhite: { value: new THREE.Color("#f5f5f5") },
          uTime: { value: 0 },
        },
        vertexShader: `
          attribute float aSize;
          attribute float aPhase;
          attribute float aLevel;
          uniform float uPointScale;
          uniform float uTime;
          uniform vec2 uPointer;
          varying float vPulse;
          varying float vAlpha;

          void main() {
            vec3 pos = position;
            float dist = length(pos);
            float breathe = sin(uTime * 1.15 + aPhase) * 0.16;
            float orbit = cos(uTime * 0.55 + aPhase * 0.7) * 0.07;
            pos += normalize(pos + vec3(0.0001)) * breathe;
            pos.x += sin(uTime * 0.42 + aPhase) * 0.05 * aLevel;
            pos.y += cos(uTime * 0.36 + aPhase) * 0.04 * aLevel;
            pos.z += orbit;

            vec2 pointerWorld = vec2(uPointer.x * 7.5, uPointer.y * 5.2);
            vec2 away = pos.xy - pointerWorld;
            float pointerDistance = length(away);
            float influence = smoothstep(4.2, 0.0, pointerDistance);
            pos.xy += normalize(away + vec2(0.0001)) * influence * 0.52;
            pos.z += influence * 0.42;

            float pulseRadius = mod(uTime * 1.85, 7.4);
            float wave = smoothstep(0.42, 0.0, abs(dist - pulseRadius));
            vPulse = wave;
            vAlpha = 0.46 + wave * 0.34;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = (aSize * (1.0 + wave * 2.8)) * (uPointScale / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
      }),
    [visualConfig.nodeOpacity, visualConfig.pointScale],
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uPointer.value.set(state.pointer.x, -state.pointer.y);
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.08) * 0.1;
      pointsRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.07) * 0.045;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <primitive ref={materialRef} object={material} attach="material" />
    </points>
  );
}

function ConnectionField({
  connections,
  hoveredModule,
  moduleAnchors,
  nodes,
  visualConfig,
}: {
  connections: NetworkConnection[];
  hoveredModule: ModuleAnchor["id"] | null;
  moduleAnchors: ModuleAnchor[];
  nodes: NetworkNode[];
  visualConfig: CareerCoreModeVisualConfig;
}) {
  const lineSegments = useMemo(() => {
    const points: number[] = [];
    const strengths: number[] = [];
    const highlight: number[] = [];
    const hoveredAnchor = moduleAnchors.find((anchor) => anchor.id === hoveredModule);

    for (const connection of connections) {
      const from = nodes[connection.from]?.position;
      const to = nodes[connection.to]?.position;
      if (!from || !to) continue;

      const isHighlighted =
        hoveredAnchor?.nodeId === connection.from || hoveredAnchor?.nodeId === connection.to;

      points.push(from.x, from.y, from.z, to.x, to.y, to.z);
      strengths.push(connection.strength, connection.strength);
      highlight.push(isHighlighted ? 1 : 0, isHighlighted ? 1 : 0);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute("aStrength", new THREE.Float32BufferAttribute(strengths, 1));
    geometry.setAttribute("aHighlight", new THREE.Float32BufferAttribute(highlight, 1));

    return geometry;
  }, [connections, hoveredModule, moduleAnchors, nodes]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fragmentShader: `
          uniform float uBaseOpacity;
          uniform float uConnectionPulse;
          uniform float uTime;
          uniform vec3 uColor;
          varying float vDistance;
          varying float vHighlight;
          varying float vStrength;

          void main() {
            float pulseRadius = mod(uTime * 1.85, 7.4);
            float wave = smoothstep(0.55, 0.0, abs(vDistance - pulseRadius));
            float alpha = uBaseOpacity + vStrength * 0.22 + wave * uConnectionPulse + vHighlight * 0.22;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
        transparent: true,
        uniforms: {
          uBaseOpacity: { value: visualConfig.connectionOpacity },
          uColor: { value: new THREE.Color("#5B5698") },
          uConnectionPulse: { value: visualConfig.connectionPulse },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uTime: { value: 0 },
        },
        vertexShader: `
          attribute float aHighlight;
          attribute float aStrength;
          uniform float uTime;
          uniform vec2 uPointer;
          varying float vDistance;
          varying float vHighlight;
          varying float vStrength;

          void main() {
            vHighlight = aHighlight;
            vStrength = aStrength;
            vec3 pos = position;
            vDistance = length(pos);

            vec2 pointerWorld = vec2(uPointer.x * 7.5, uPointer.y * 5.2);
            vec2 away = pos.xy - pointerWorld;
            float pointerDistance = length(away);
            float influence = smoothstep(4.2, 0.0, pointerDistance);
            pos.xy += normalize(away + vec2(0.0001)) * influence * 0.42;
            pos.z += influence * 0.32;
            pos += normalize(pos + vec3(0.0001)) * sin(uTime * 0.5 + vDistance) * 0.035;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
      }),
    [visualConfig.connectionOpacity, visualConfig.connectionPulse],
  );
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (!materialRef.current) return;

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uPointer.value.set(state.pointer.x, -state.pointer.y);
  });

  return (
    <lineSegments geometry={lineSegments}>
      <primitive ref={materialRef} object={material} attach="material" />
    </lineSegments>
  );
}

function TubeConnection({
  from,
  opacity,
  to,
}: {
  from: THREE.Vector3;
  opacity: number;
  to: THREE.Vector3;
}) {
  const tube = useMemo(() => {
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    mid.z += 0.28;
    const curve = new THREE.CatmullRomCurve3([from, mid, to]);
    return new THREE.TubeGeometry(curve, 32, 0.006, 8, false);
  }, [from, to]);

  return (
    <mesh geometry={tube}>
      <meshBasicMaterial color="#5B5698" transparent opacity={opacity} />
    </mesh>
  );
}

function PulseWaves() {
  const wavesRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!wavesRef.current) return;

    wavesRef.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      const cycle = (state.clock.elapsedTime * 0.36 + index / 3) % 1;
      const scale = 0.8 + cycle * 6.2;
      mesh.scale.setScalar(scale);
      mesh.material.opacity = (1 - cycle) * 0.16;
    });
  });

  return (
    <group ref={wavesRef}>
      {[0, 1, 2].map((item) => (
        <mesh key={item}>
          <sphereGeometry args={[0.58, 32, 32]} />
          <meshBasicMaterial color="#5B5698" transparent opacity={0.12} wireframe />
        </mesh>
      ))}
    </group>
  );
}

function createCrystallineNetwork(densityFactor: number) {
  const nodes: NetworkNode[] = [];
  const rootNode = createNode({
    id: 0,
    level: 0,
    position: new THREE.Vector3(0, 0, 0),
    type: "root",
  });
  rootNode.size = 1.35;
  nodes.push(rootNode);

  for (let layer = 1; layer <= LAYERS; layer += 1) {
    const radius = layer * 1.34;
    const count = Math.max(6, Math.floor(layer * 18 * densityFactor));
    const layerStart = nodes.length;

    for (let i = 0; i < count; i += 1) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = (2 * Math.PI * i) / GOLDEN_RATIO;
      const drift = deterministicNoise(layer * 100 + i) * 0.42;
      const position = new THREE.Vector3(
        (radius + drift) * Math.sin(phi) * Math.cos(theta) * 1.06,
        (radius + drift) * Math.sin(phi) * Math.sin(theta) * 0.58,
        (radius + drift) * Math.cos(phi) * 0.82,
      );

      nodes.push(
        createNode({
          id: nodes.length,
          level: layer,
          position,
          type: layer === LAYERS || deterministicNoise(layer * 77 + i) < 0.28 ? "leaf" : "branch",
        }),
      );
    }

    const layerNodes = nodes.slice(layerStart);
    const previousLayerNodes =
      layer === 1 ? [rootNode] : nodes.filter((node) => node.level === layer - 1);

    for (const node of layerNodes) {
      const nearestPrevious = previousLayerNodes
        .map((candidate) => ({
          candidate,
          distance: node.position.distanceTo(candidate.position),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, layer === 1 ? 1 : 3);

      for (const item of nearestPrevious) {
        connectNodes(node, item.candidate, Math.max(0.32, 1 - item.distance / (radius * 2.2)));
      }

      const nearestLayer = layerNodes
        .filter((candidate) => candidate !== node)
        .map((candidate) => ({
          candidate,
          distance: node.position.distanceTo(candidate.position),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4);

      for (const item of nearestLayer) {
        if (item.distance < radius * 1.05) {
          connectNodes(node, item.candidate, 0.48);
        }
      }
    }
  }

  const outerNodes = nodes.filter((node) => node.level >= 3);
  const crossLinkCount = Math.floor(72 * densityFactor);
  for (let i = 0; i < crossLinkCount; i += 1) {
    const a = outerNodes[Math.floor(deterministicNoise(i + 400) * outerNodes.length)];
    const b = outerNodes[Math.floor(deterministicNoise(i + 800) * outerNodes.length)];
    if (a && b && a !== b && Math.abs(a.level - b.level) > 1) {
      connectNodes(a, b, 0.28);
    }
  }

  const connections = toConnectionList(nodes);
  const moduleAnchors = pickModuleAnchors(nodes);
  return { nodes, connections, rootNode, moduleAnchors };
}

function createNode({
  id,
  level,
  position,
  type,
}: {
  id: number;
  level: number;
  position: THREE.Vector3;
  type: NetworkNode["type"];
}) {
  return {
    id,
    connections: [],
    distanceFromRoot: position.length(),
    level,
    phase: deterministicNoise(id + 7) * Math.PI * 2,
    position,
    size:
      type === "root"
        ? 1
        : type === "branch"
          ? 0.105 + deterministicNoise(id + 11) * 0.055
          : 0.07 + deterministicNoise(id + 13) * 0.04,
    type,
  } satisfies NetworkNode;
}

function connectNodes(a: NetworkNode, b: NetworkNode, strength: number) {
  if (!a.connections.some((connection) => connection.id === b.id)) {
    a.connections.push({ id: b.id, strength });
  }

  if (!b.connections.some((connection) => connection.id === a.id)) {
    b.connections.push({ id: a.id, strength });
  }
}

function toConnectionList(nodes: NetworkNode[]) {
  const connections: NetworkConnection[] = [];

  for (const node of nodes) {
    for (const connection of node.connections) {
      if (node.id >= connection.id) continue;
      const target = nodes[connection.id];
      if (!target) continue;

      const distance = node.position.distanceTo(target.position);
      connections.push({
        from: node.id,
        to: target.id,
        strength: Math.max(0.2, connection.strength * (1 - distance / 6)),
      });
    }
  }

  return connections;
}

function pickModuleAnchors(nodes: NetworkNode[]) {
  const targets = [
    new THREE.Vector3(-5.2, 2.4, 0),
    new THREE.Vector3(5.2, 2.2, 0),
    new THREE.Vector3(-4.8, -2.7, 0),
    new THREE.Vector3(5.1, -2.5, 0),
  ];

  return targets.map((target, index) => {
    const node = nodes
      .filter((item) => item.type !== "root")
      .sort((a, b) => a.position.distanceTo(target) - b.position.distanceTo(target))[0];

    return {
      id: moduleAnchorIds[index],
      label: moduleAnchorLabels[index],
      nodeId: node?.id ?? 0,
    } satisfies ModuleAnchor;
  });
}

function calculateNetworkBounds(nodes: NetworkNode[]) {
  const box = new THREE.Box3();

  for (const node of nodes) {
    box.expandByPoint(node.position);
  }

  const size = new THREE.Vector3();
  box.getSize(size);

  return {
    height: Math.max(size.y, 1),
    width: Math.max(size.x, 1),
  };
}

function deterministicNoise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
