import { describe, expect, it } from "vitest";
import { StrokeHistory } from "./strokeHistory";
import type { Stroke } from "./types";

function stroke(color: string): Stroke {
  return {
    segments: [{ point: { x: 0, y: 0 }, time: 0, pressure: 0.5 }],
    mode: "draw",
    weight: 3,
    smoothing: 0.85,
    color,
    adaptiveStroke: true,
  };
}

describe("StrokeHistory", () => {
  it("starts empty unless seeded", () => {
    const h = new StrokeHistory();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.list).toEqual([]);
  });

  it("seeds from initial strokes", () => {
    const h = new StrokeHistory([stroke("a"), stroke("b")]);
    expect(h.list).toHaveLength(2);
    expect(h.canUndo).toBe(true);
  });

  it("push appends and enables undo", () => {
    const h = new StrokeHistory();
    h.push(stroke("a"));
    expect(h.list.map((s) => s.color)).toEqual(["a"]);
    expect(h.canUndo).toBe(true);
  });

  it("undo then redo restores the stroke", () => {
    const h = new StrokeHistory();
    h.push(stroke("a"));
    h.push(stroke("b"));

    expect(h.undo()).toBe(true);
    expect(h.list.map((s) => s.color)).toEqual(["a"]);
    expect(h.canRedo).toBe(true);

    expect(h.redo()).toBe(true);
    expect(h.list.map((s) => s.color)).toEqual(["a", "b"]);
    expect(h.canRedo).toBe(false);
  });

  it("undo on empty returns false", () => {
    const h = new StrokeHistory();
    expect(h.undo()).toBe(false);
  });

  it("redo on empty returns false", () => {
    const h = new StrokeHistory();
    h.push(stroke("a"));
    expect(h.redo()).toBe(false);
  });

  it("a new push clears the redo stack", () => {
    const h = new StrokeHistory();
    h.push(stroke("a"));
    h.undo();
    expect(h.canRedo).toBe(true);
    h.push(stroke("b"));
    expect(h.canRedo).toBe(false);
    expect(h.redo()).toBe(false);
  });

  it("clear empties strokes and redo, reporting whether work was done", () => {
    const h = new StrokeHistory();
    expect(h.clear()).toBe(false); // nothing to clear
    h.push(stroke("a"));
    expect(h.clear()).toBe(true);
    expect(h.list).toEqual([]);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it("reset replaces contents and drops redo", () => {
    const h = new StrokeHistory([stroke("a")]);
    h.undo();
    h.reset([stroke("x"), stroke("y")]);
    expect(h.list.map((s) => s.color)).toEqual(["x", "y"]);
    expect(h.canRedo).toBe(false);
  });
});
