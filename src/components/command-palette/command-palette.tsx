"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  COMMAND_PALETTE_COMMANDS,
  filterCommandPaletteCommands,
  type CommandPaletteCommand,
  type CommandPaletteGroup,
} from "./command-palette-commands";
import { usePlatformShortcutLabel } from "./use-platform-shortcut-label";

type CommandPaletteProps = {
  onClose: () => void;
  triggerElement: HTMLButtonElement | null;
};

const GROUP_ORDER: CommandPaletteGroup[] = ["Navigation", "Actions"];

export function CommandPalette({ onClose, triggerElement }: CommandPaletteProps) {
  const router = useRouter();
  const shortcutLabel = usePlatformShortcutLabel();
  const titleId = useId();
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredCommands = useMemo(
    () => filterCommandPaletteCommands(COMMAND_PALETTE_COMMANDS, query),
    [query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    return () => {
      triggerElement?.focus();
    };
  }, [triggerElement]);

  const executeCommand = useCallback(
    (command: CommandPaletteCommand) => {
      onClose();
      router.push(command.href);
    },
    [onClose, router],
  );

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (filteredCommands.length === 0) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current + 1 >= filteredCommands.length ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current - 1 < 0 ? filteredCommands.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const command = filteredCommands[activeIndex];
      if (command) executeCommand(command);
    }
  }

  const groupedCommands = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      commands: filteredCommands.filter((command) => command.group === group),
    })).filter((section) => section.commands.length > 0);
  }, [filteredCommands]);

  let runningIndex = -1;
  const activeCommand = filteredCommands[activeIndex];
  const activeOptionId = activeCommand
    ? `${listboxId}-option-${activeCommand.id}`
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[min(18vh,8rem)] sm:px-6">
      <button
        aria-label="Close command palette"
        className="absolute inset-0 bg-[rgb(0_0_0_/_56%)] backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />

      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="surface-elevated relative z-10 w-full max-w-lg overflow-hidden border-[var(--color-border)]"
        role="dialog"
      >
        <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
          <h2 className="sr-only" id={titleId}>
            Command palette
          </h2>
          <label className="sr-only" htmlFor={inputId}>
            Search commands
          </label>
          <input
            ref={inputRef}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-controls={listboxId}
            autoComplete="off"
            className="w-full bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[rgb(156_163_175_/_68%)]"
            id={inputId}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search commands…"
            spellCheck={false}
            type="search"
            value={query}
          />
        </div>

        <div
          aria-label="Commands"
          className="command-palette-list max-h-[min(46vh,16rem)] overflow-x-hidden overflow-y-auto px-2 py-2"
          id={listboxId}
          role="listbox"
        >
          {filteredCommands.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              No commands match your search.
            </p>
          ) : (
            groupedCommands.map((section) => (
              <div className="mb-1 last:mb-0" key={section.group}>
                <p className="section-eyebrow px-3 py-1.5">
                  {section.group}
                </p>
                <ul className="space-y-0.5">
                  {section.commands.map((command) => {
                    runningIndex += 1;
                    const commandIndex = runningIndex;
                    const isActive = commandIndex === activeIndex;

                    return (
                      <li key={command.id}>
                        <button
                          aria-selected={isActive}
                          className={`flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-left text-sm [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                            isActive
                              ? "selected-row border text-[var(--color-text-primary)]"
                              : "border border-transparent text-[var(--color-text-primary)] hover:bg-[var(--surface-inset)]"
                          }`}
                          id={`${listboxId}-option-${command.id}`}
                          onClick={() => executeCommand(command)}
                          onMouseEnter={() => setActiveIndex(commandIndex)}
                          role="option"
                          type="button"
                        >
                          <span>{command.title}</span>
                          {isActive ? (
                            <span
                              aria-hidden="true"
                              className="font-mono-meta text-[10px] uppercase tracking-[0.14em] text-[var(--color-intelligence-soft)]"
                            >
                              Enter
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[var(--color-border-subtle)] px-4 py-2">
          <p className="font-mono-meta text-[10px] text-[var(--color-text-secondary)]">
            Shortcut: {shortcutLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
