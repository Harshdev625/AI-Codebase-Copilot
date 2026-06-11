"use client";

import { isStudioEnabled } from "@/lib/feature-flags";

/**
 * Client hook for the Copilot Studio feature flag.
 * Phase 0: gates the /studio route UI; does not affect /workspace.
 */
export function useStudioFeatureFlag(): boolean {
  return isStudioEnabled();
}
