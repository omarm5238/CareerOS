import { LinkedinSubNav } from "../../components/linkedin-sub-nav";
import type { LinkedinConnectionView } from "../connection/types";
import { LinkedinConnectionCard } from "./linkedin-connection-card";
import { LinkedinConnectButton } from "./linkedin-connect-button";

export function LinkedinSettingsPage({ connection }: { connection: LinkedinConnectionView }) {
  const tokenLabel =
    connection.tokenState === "VALID" || connection.tokenState === "EXPIRING_SOON"
      ? "Authorization is valid"
      : connection.tokenState === "EXPIRED" || connection.tokenState === "REVOKED"
        ? "Authorization is no longer valid"
        : "Not authorized";

  return (
    <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
      <LinkedinSubNav />
      <div className="mt-6 grid gap-4">
        <LinkedinConnectionCard connection={connection} />
        <section className="surface-glass p-5">
          <p className="section-eyebrow">Authorization</p>
          <p className="mt-2 text-sm">{tokenLabel}</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            CareerOS never sees your LinkedIn password. Sign-in and MFA happen on LinkedIn.
          </p>
          <div className="mt-4 grid max-w-sm gap-2">
            {connection.status === "CONNECTED" ? (
              <LinkedinConnectButton action="reconnect" label="Reconnect LinkedIn" />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
