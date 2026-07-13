import { careerCoreBaseNodes, careerCoreDensityConfig } from "../config";
import type {
  CareerCoreDensity,
  CareerCoreMode,
  CareerCoreNode,
} from "../types";

export function getCareerCoreNodes({
  density,
  mode,
}: {
  density: CareerCoreDensity;
  mode: CareerCoreMode;
}) {
  const nodeCount = careerCoreDensityConfig[density].nodeCount;
  const nodes = careerCoreBaseNodes.slice(0, nodeCount);

  if (mode === "signin") {
    return nodes.map((node) => ({
      ...node,
      state: node.id === "resume" ? "active" : "dormant",
    })) satisfies CareerCoreNode[];
  }

  if (mode === "signup") {
    return nodes.map((node) => ({
      ...node,
      state: node.id === "skills" ? "active" : node.state,
    })) satisfies CareerCoreNode[];
  }

  if (mode === "loading") {
    return nodes.map((node, index) => ({
      ...node,
      state: index === 0 ? "focused" : "dormant",
    })) satisfies CareerCoreNode[];
  }

  return nodes;
}

export function getNodeTransform({
  node,
  nodeX,
  nodeY,
}: {
  node: CareerCoreNode;
  nodeX: number;
  nodeY: number;
}) {
  const depthOffset = node.depth;

  return `translate(calc(-50% + ${nodeX * depthOffset}px), calc(-50% + ${
    nodeY * depthOffset
  }px))`;
}
