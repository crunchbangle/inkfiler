import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom lacks these; some components/atrament expect them to exist.
if (!("randomUUID" in crypto)) {
  // @ts-expect-error test shim
  crypto.randomUUID = () => "test-" + Math.random().toString(16).slice(2);
}
if (!("PointerEvent" in globalThis)) {
  globalThis.PointerEvent = class extends Event {} as never;
}

// Silence "not implemented" canvas noise under jsdom in case anything touches it.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null as never);
