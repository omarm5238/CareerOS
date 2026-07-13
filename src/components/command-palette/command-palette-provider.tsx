"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CommandPalette } from "./command-palette";
import { detectMacPlatform } from "./use-platform-shortcut-label";

type CommandPaletteContextValue = {
  isOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  setTriggerElement: (element: HTMLButtonElement | null) => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

function isCommandPaletteShortcut(event: KeyboardEvent): boolean {
  const isMac = detectMacPlatform();

  if (isMac) {
    return event.metaKey && event.key.toLowerCase() === "k";
  }

  return event.ctrlKey && (event.key === "/" || event.code === "Slash");
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isOpenRef = useRef(isOpen);

  isOpenRef.current = isOpen;

  const openPalette = useCallback(() => setIsOpen(true), []);
  const closePalette = useCallback(() => setIsOpen(false), []);

  const setTriggerElement = useCallback((element: HTMLButtonElement | null) => {
    triggerRef.current = element;
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isCommandPaletteShortcut(event)) return;

      event.preventDefault();
      event.stopPropagation();

      if (!isOpenRef.current) {
        openPalette();
      }
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [openPalette]);

  const value = useMemo(
    () => ({
      isOpen,
      openPalette,
      closePalette,
      setTriggerElement,
    }),
    [closePalette, isOpen, openPalette, setTriggerElement],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {isOpen ? (
        <CommandPalette
          onClose={closePalette}
          triggerElement={triggerRef.current}
        />
      ) : null}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return context;
}
