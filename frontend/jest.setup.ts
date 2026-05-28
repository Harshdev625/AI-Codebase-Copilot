import "@testing-library/jest-dom";
import "whatwg-fetch";

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
	writable: true,
	value: jest.fn(),
});

// ---------------------------------------------------------------------------
// Global fetch mock — tests should use jest.spyOn(global, 'fetch') or
// mockImplementation at the service level. This just ensures fetch exists.
// ---------------------------------------------------------------------------

// Do NOT globally mock @tanstack/react-query.
// Instead, each test should wrap its component in a <QueryClientProvider>
// with a dedicated test QueryClient. See test-utils.tsx for helpers.

// ---------------------------------------------------------------------------
// Mock next/navigation (used by many components)
// ---------------------------------------------------------------------------
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// ---------------------------------------------------------------------------
// Mock framer-motion to avoid animation issues in JSDOM
// ---------------------------------------------------------------------------
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_target: any, prop: string) => {
          return React.forwardRef((props: any, ref: any) => {
            const { initial, animate, exit, whileHover, whileTap, whileFocus, variants, transition, layout, layoutId, ...rest } = props;
            return React.createElement(prop, { ...rest, ref });
          });
        },
      }
    ),
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
    useMotionValue: (initial: any) => ({ get: () => initial, set: jest.fn() }),
    useTransform: () => ({ get: () => 0, set: jest.fn() }),
    useSpring: () => ({ get: () => 0, set: jest.fn() }),
    useInView: () => true,
  };
});
