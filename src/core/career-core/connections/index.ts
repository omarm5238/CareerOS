import type { CareerCoreConnection, CareerCoreNode } from "../types";

export function getCareerCoreConnections(nodes: CareerCoreNode[]) {
  return nodes.map((node) => ({
    id: `core-to-${node.id}`,
    from: "core",
    to: node.id,
    strength: node.state === "focused" ? 1 : node.state === "active" ? 0.72 : 0.38,
  })) satisfies CareerCoreConnection[];
}

export function getConnectionStyle({
  node,
  strength,
  opacity,
}: {
  node: CareerCoreNode;
  strength: number;
  opacity: number;
}) {
  const core = { x: 50, y: 50 };
  const deltaX = node.position.x - core.x;
  const deltaY = node.position.y - core.y;
  const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  return {
    left: `${core.x}%`,
    top: `${core.y}%`,
    width: `${length}%`,
    opacity: Math.min(opacity * strength, 0.72),
    transform: `rotate(${angle}deg)`,
  };
}
