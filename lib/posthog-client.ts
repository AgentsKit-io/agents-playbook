"use client";

import posthog from "posthog-js";

let initialized = false;

export function isPostHogConfigured({ enabled, key }: { enabled: string | undefined; key: string | undefined }): boolean {
  return enabled === "true" && Boolean(key && key !== "phc_...");
}

export function initPostHog(): void {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || !isPostHogConfigured({ enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED, key })) return;
  initialized = true;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: "history_change",
    capture_pageleave: true,
    capture_exceptions: true,
    person_profiles: "always",
    // Share the analytics cookie across *.agentskit.io so a visitor stays
    // the same person as they move across the ecosystem.
    cross_subdomain_cookie: true,
    autocapture: true,
  });
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !initialized) return;
  posthog.capture(event, props);
}
