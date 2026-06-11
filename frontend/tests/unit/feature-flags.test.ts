import { FEATURE_FLAGS, isStudioEnabled } from "@/lib/feature-flags";

describe("feature-flags", () => {
  const original = process.env.NEXT_PUBLIC_STUDIO_ENABLED;

  afterEach(() => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = original;
  });

  it("returns false when NEXT_PUBLIC_STUDIO_ENABLED is unset", () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
    expect(isStudioEnabled()).toBe(false);
    expect(FEATURE_FLAGS.studio.isEnabled()).toBe(false);
  });

  it("returns true only when NEXT_PUBLIC_STUDIO_ENABLED is 'true'", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    expect(isStudioEnabled()).toBe(true);
  });

  it("returns false for non-true values", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "false";
    expect(isStudioEnabled()).toBe(false);
  });
});
