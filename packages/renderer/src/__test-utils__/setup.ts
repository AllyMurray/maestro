import '@testing-library/jest-dom/vitest';

// Mock window.matchMedia (required by Mantine)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver (required by some Mantine components)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as any;

// Mock getComputedStyle (required by Mantine)
const origGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  const style = origGetComputedStyle(elt, pseudoElt);
  return {
    ...style,
    getPropertyValue: (prop: string) => {
      return style.getPropertyValue(prop) || '';
    },
  } as CSSStyleDeclaration;
};

// Mock window.maestro IPC bridge
Object.defineProperty(window, 'maestro', {
  value: {
    invoke: vi.fn().mockResolvedValue(null),
    on: vi.fn().mockReturnValue(() => {}),
    send: vi.fn(),
  },
  writable: true,
});
