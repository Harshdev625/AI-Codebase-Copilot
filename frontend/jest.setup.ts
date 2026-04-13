import "@testing-library/jest-dom";
import "whatwg-fetch";

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
	writable: true,
	value: jest.fn(),
});
