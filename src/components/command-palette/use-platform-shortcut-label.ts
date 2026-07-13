"use client";

import { useEffect, useState } from "react";

export function detectMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;

  const platform = navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

export function usePlatformShortcutLabel(): string {
  const [label, setLabel] = useState("Ctrl /");

  useEffect(() => {
    setLabel(detectMacPlatform() ? "⌘ K" : "Ctrl /");
  }, []);

  return label;
}
