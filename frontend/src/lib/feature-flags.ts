/**
 * Central feature flag definitions.
 * Public flags use NEXT_PUBLIC_* and are inlined at build time.
 */
export const FEATURE_FLAGS = {
  studio: {
    envKey: "NEXT_PUBLIC_STUDIO_ENABLED",
    isEnabled(): boolean {
      return process.env.NEXT_PUBLIC_STUDIO_ENABLED === "true";
    },
  },
} as const;

export function isStudioEnabled(): boolean {
  return FEATURE_FLAGS.studio.isEnabled();
}
