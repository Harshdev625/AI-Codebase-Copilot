import "@testing-library/jest-dom";
import "whatwg-fetch";

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
	writable: true,
	value: jest.fn(),
});

Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: jest.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(),
		removeListener: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	})),
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
  redirect: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock react-markdown
// ---------------------------------------------------------------------------
jest.mock("react-markdown", () => {
  return function MockReactMarkdown({ children }: any) {
    return require("react").createElement("div", { "data-testid": "mock-markdown" }, children);
  };
});
jest.mock("remark-gfm", () => () => {});
jest.mock("react-syntax-highlighter", () => {
  return {
    Prism: ({ children }: any) => require("react").createElement("div", null, children),
    SyntaxHighlighter: ({ children }: any) => require("react").createElement("div", null, children),
  };
});

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
