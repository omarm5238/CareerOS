import type { LinkedinConnectionView } from "../connection/types";
import { LinkedinConnectButton } from "./linkedin-connect-button";

const CAPABILITY_LABELS: Record<string, string> = {
  PUBLISH_MEMBER_POST: "Official Publishing",
  POST_ANALYTICS: "Post Analytics",
  PROFILE_ANALYTICS: "Profile Analytics",
  HISTORICAL_POST_READ: "Historical Import",
};

const STATE_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  AVAILABLE_NOT_GRANTED: "Permission needed",
  APPROVAL_REQUIRED: "Requires LinkedIn approval",
  RESTRICTED: "Not available",
  UNSUPPORTED: "Not supported yet",
  TEMPORARILY_UNAVAILABLE: "Temporarily unavailable",
};

export function LinkedinConnectionCard({
  connection,
  compact = false,
}: {
  connection: LinkedinConnectionView;
  compact?: boolean;
}) {
  const statusLabel = connectionStatusLabel(connection.status);
  const highlighted = connection.capabilities.filter((item) => item.capability in CAPABILITY_LABELS);

  return (
    <section className="surface-glass p-5">
      <p className="section-eyebrow">LinkedIn Connection</p>
      <h2 className="mt-2 font-display text-xl">{statusLabel}</h2>
      {connection.status === "DISCONNECTED" ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Connect your LinkedIn account to use official publishing.
        </p>
      ) : null}
      {connection.status === "REAUTH_REQUIRED" ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Your LinkedIn authorization is no longer valid. Reconnect to continue.
        </p>
      ) : null}
      {connection.status === "CONNECTION_ERROR" ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          The LinkedIn connection needs attention. Reconnect or continue with manual publishing.
        </p>
      ) : null}
      {connection.displayName || connection.email ? (
        <div className="mt-3 flex items-center gap-3">
          {connection.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={connection.profileImageUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm">{connection.displayName ?? "Connected LinkedIn account"}</p>
            {connection.email ? (
              <p className="truncate text-xs text-[var(--color-text-secondary)]">{connection.email}</p>
            ) : null}
            {connection.connectedAt ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Connected {new Date(connection.connectedAt).toLocaleDateString()}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {!compact ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {highlighted.map((item) => (
            <li key={item.capability} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
              <p className="text-sm font-medium">{CAPABILITY_LABELS[item.capability]}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {STATE_LABELS[item.state] ?? item.state}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.reason}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid max-w-sm gap-2">
        {connection.status === "DISCONNECTED" || connection.status === "CONNECTION_ERROR" ? (
          <LinkedinConnectButton action="start" label="Connect LinkedIn" />
        ) : null}
        {connection.status === "REAUTH_REQUIRED" || connection.status === "CONNECTED" ? (
          <LinkedinConnectButton
            action="reconnect"
            label={connection.status === "REAUTH_REQUIRED" ? "Reconnect LinkedIn" : "Reconnect"}
          />
        ) : null}
        {connection.status !== "DISCONNECTED" && connection.status !== "CONNECTING" ? (
          <LinkedinConnectButton action="disconnect" label="Disconnect" />
        ) : null}
      </div>
    </section>
  );
}

function connectionStatusLabel(status: string): string {
  switch (status) {
    case "CONNECTED":
      return "LinkedIn connected";
    case "CONNECTING":
      return "Connecting";
    case "REAUTH_REQUIRED":
      return "LinkedIn needs reconnection";
    case "CONNECTION_ERROR":
      return "Connection error";
    case "DISCONNECTING":
      return "Disconnecting";
    default:
      return "LinkedIn not connected";
  }
}
