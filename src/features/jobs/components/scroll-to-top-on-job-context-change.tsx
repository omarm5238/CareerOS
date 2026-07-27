"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Resets window scroll when the target-job query changes.
 * Keeps job-chip navigation from leaving the page mid-viewport.
 */
export function ScrollToTopOnJobContextChange() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? "";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelectorAll("[data-job-context-scroll]").forEach((node) => {
      if (node instanceof HTMLElement) {
        node.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });
  }, [pathname, jobId]);

  return null;
}
