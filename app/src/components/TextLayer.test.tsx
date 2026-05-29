import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { fireEvent, render, screen } from "@testing-library/react";
import { TextLayer } from "./TextLayer";
import { useStore } from "../store";
import type { LoadedNode, Node, Textbox } from "../types";

function node(id: string): Node {
  return { id, parent_id: null, title: id, sort_order: 0, caption: "", created_at: 0, updated_at: 0 };
}

function textbox(id: string, content: string): Textbox {
  return { id, node_id: "a", x: 10, y: 20, w: 200, h: 80, content, updated_at: 0 };
}

function loadedWith(boxes: Textbox[]): LoadedNode {
  return {
    node: node("a"),
    canvas: { node_id: "a", bounds: null, strokes: [], raster: null, updated_at: 0 },
    textboxes: boxes,
    tags: [],
  };
}

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(undefined);
  useStore.setState({ selectedId: "a", loaded: loadedWith([]) });
});

describe("TextLayer", () => {
  it("renders existing textboxes", () => {
    useStore.setState({ loaded: loadedWith([textbox("t1", "hello")]) });
    render(<TextLayer />);
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("renders nothing when there are no textboxes", () => {
    render(<TextLayer />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders without an infinite loop when no node is loaded", () => {
    // Regression: a `?? []` in the selector returned a fresh array each render
    // and drove Zustand into "Maximum update depth exceeded".
    useStore.setState({ selectedId: null, loaded: null });
    expect(() => render(<TextLayer />)).not.toThrow();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("deletes a textbox via its delete button", () => {
    useStore.setState({ loaded: loadedWith([textbox("t1", "bye")]) });
    render(<TextLayer />);
    fireEvent.click(screen.getByTitle("Delete text box"));
    expect(invokeMock).toHaveBeenCalledWith("delete_textbox", { id: "t1" });
  });

  it("persists edits to a textbox (debounced)", () => {
    vi.useFakeTimers();
    try {
      useStore.setState({ loaded: loadedWith([textbox("t1", "")]) });
      render(<TextLayer />);
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "typed" } });
      vi.advanceTimersByTime(400);
      expect(invokeMock).toHaveBeenCalledWith(
        "upsert_textbox",
        expect.objectContaining({ textbox: expect.objectContaining({ content: "typed" }) }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
