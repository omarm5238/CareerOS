"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { CareerCore } from "@/components/core/CareerCore";

type AuthMode = "sign-in" | "sign-up";

type AuthFormProps = {
  mode: AuthMode;
};

const copy = {
  "sign-in": {
    title: "Welcome back",
    description: "Sign in to continue to your CareerOS workspace.",
    action: "Sign in",
    endpoint: "/api/auth/sign-in/email",
    alternateHref: "/sign-up",
    alternateText: "Need an account? Sign up",
  },
  "sign-up": {
    title: "Create your account",
    description: "Start with a minimal CareerOS account.",
    action: "Create account",
    endpoint: "/api/auth/sign-up/email",
    alternateHref: "/sign-in",
    alternateText: "Already have an account? Sign in",
  },
} as const;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const content = copy[mode];
  const coreMode = mode === "sign-in" ? "signin" : "signup";
  const postAuthDestination = mode === "sign-up" ? "/onboarding" : "/workspace";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");

    const response = await fetch(content.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        ...(mode === "sign-up" ? { name } : {}),
        email,
        password,
        callbackURL: postAuthDestination,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Authentication failed. Please try again.");
      setIsSubmitting(false);
      return;
    }

    router.push(postAuthDestination);
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen overflow-x-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <div className="pointer-events-none absolute inset-0 app-atmosphere opacity-90" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.28] lg:hidden">
        <CareerCore
          animated
          className="h-full w-full"
          density="medium"
          interactive={false}
          mode={coreMode}
          pulse
        />
      </div>

      <div className="absolute inset-y-0 left-0 hidden w-[60%] lg:block">
        <CareerCore
          animated
          className="h-full w-full"
          density="medium"
          interactive
          mode={coreMode}
          pulse
        />
      </div>

      <div aria-hidden="true" className="hidden w-[60%] shrink-0 lg:block" />

      <div className="relative z-10 flex min-h-screen w-full flex-1 items-center justify-center px-6 py-12 lg:justify-start lg:px-10 lg:pr-[8vw]">
        <section className="surface-elevated w-full max-w-[440px] p-8">
          <div className="mb-8 space-y-3">
            <p className="section-eyebrow text-[var(--color-accent-soft)]">CareerOS</p>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{content.title}</h1>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                {content.description}
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            {mode === "sign-up" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Name</span>
                <input
                  required
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="input-field"
                  placeholder="Omar"
                />
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">Email</span>
              <input
                required
                name="email"
                type="email"
                autoComplete="email"
                className="input-field"
                placeholder="you@example.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">Password</span>
              <input
                required
                name="password"
                type="password"
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                className="input-field"
                placeholder="Password"
              />
            </label>

            {error ? (
              <p className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? "Please wait..." : content.action}
            </button>
          </form>

          <Link
            href={content.alternateHref}
            className="mt-6 block text-center text-sm text-[var(--color-text-secondary)] [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)]"
          >
            {content.alternateText}
          </Link>
        </section>
      </div>
    </main>
  );
}
