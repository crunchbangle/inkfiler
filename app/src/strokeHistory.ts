import type { Stroke } from "./types";

/**
 * Pure undo/redo stack for recorded strokes. Kept free of any canvas/DOM
 * dependency so the history semantics can be unit-tested in isolation —
 * the actual re-draw is the caller's responsibility.
 */
export class StrokeHistory {
  private strokes: Stroke[];
  private redoStack: Stroke[] = [];

  constructor(initial: Stroke[] = []) {
    this.strokes = [...initial];
  }

  /** Current strokes, in draw order. */
  get list(): Stroke[] {
    return this.strokes;
  }

  get canUndo(): boolean {
    return this.strokes.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Record a new stroke; clears the redo stack. */
  push(stroke: Stroke): void {
    this.strokes.push(stroke);
    this.redoStack = [];
  }

  /** Returns true if a stroke was undone. */
  undo(): boolean {
    const s = this.strokes.pop();
    if (s === undefined) return false;
    this.redoStack.push(s);
    return true;
  }

  /** Returns true if a stroke was redone. */
  redo(): boolean {
    const s = this.redoStack.pop();
    if (s === undefined) return false;
    this.strokes.push(s);
    return true;
  }

  /** Clears all strokes; returns true if there was anything to clear. */
  clear(): boolean {
    if (this.strokes.length === 0) return false;
    this.strokes = [];
    this.redoStack = [];
    return true;
  }

  /** Replace contents (e.g. when switching to a different node's canvas). */
  reset(initial: Stroke[] = []): void {
    this.strokes = [...initial];
    this.redoStack = [];
  }
}
