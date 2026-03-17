import { getBackendUrl } from "@/lib/backend-url";

describe("getBackendUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns the API_INTERNAL_URL when set", () => {
    process.env.API_INTERNAL_URL = "http://internal-api.example.com";
    delete process.env.NEXT_PUBLIC_API_URL;
    const url = getBackendUrl();
    expect(url).toBe("http://internal-api.example.com");
  });

  it("returns NEXT_PUBLIC_API_URL when API_INTERNAL_URL is not set", () => {
    delete process.env.API_INTERNAL_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.com";
    const url = getBackendUrl();
    expect(url).toBe("http://api.example.com");
  });

  it("returns localhost:8000/v1 as default when env vars are not set", () => {
    delete process.env.API_INTERNAL_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    const url = getBackendUrl();
    expect(url).toBe("http://localhost:8000/v1");
  });

  it("prioritizes API_INTERNAL_URL over NEXT_PUBLIC_API_URL", () => {
    process.env.API_INTERNAL_URL = "http://internal.com";
    process.env.NEXT_PUBLIC_API_URL = "http://public.com";
    const url = getBackendUrl();
    expect(url).toBe("http://internal.com");
  });

  it("handles https URLs", () => {
    process.env.API_INTERNAL_URL = "https://api.production.com";
    delete process.env.NEXT_PUBLIC_API_URL;
    const url = getBackendUrl();
    expect(url).toBe("https://api.production.com");
  });
});
