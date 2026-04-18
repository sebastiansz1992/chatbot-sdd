import '@testing-library/jest-dom/vitest'

if (globalThis.HTMLElement !== undefined && !globalThis.HTMLElement.prototype.scrollIntoView) {
  globalThis.HTMLElement.prototype.scrollIntoView = () => {}
}
