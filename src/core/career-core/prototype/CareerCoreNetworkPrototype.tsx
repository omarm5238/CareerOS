"use client";

import { CareerCore } from "@/components/core/CareerCore";

export function CareerCoreNetworkPrototype() {
  return (
    <main
      style={{
        background: "var(--color-background)",
        height: "100vh",
        overflow: "hidden",
        width: "100vw",
      }}
    >
      <div
        style={{
          background:
            "radial-gradient(circle at 50% 44%, rgb(99 102 241 / 18%), transparent 36%), radial-gradient(circle at 18% 80%, rgb(245 245 245 / 5%), transparent 24%), linear-gradient(180deg, #111111, #050505)",
          inset: 0,
          pointerEvents: "none",
          position: "fixed",
        }}
      />
      <CareerCore
        animated
        className="relative h-full w-full"
        density="high"
        interactive
        mode="presentation"
        pulse
      />
    </main>
  );
}
