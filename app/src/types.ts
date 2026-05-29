// Mirrors the Rust models in src-tauri/src/models.rs and the atrament stroke shape.

export interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  sort_order: number;
  caption: string;
  created_at: number;
  updated_at: number;
}

export interface Textbox {
  id: string;
  node_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  updated_at: number;
}

export interface Canvas {
  node_id: string;
  bounds: { w: number; h: number } | null;
  strokes: Stroke[];
  updated_at: number;
}

export interface LoadedNode {
  node: Node;
  canvas: Canvas;
  textboxes: Textbox[];
  tags: string[];
}

// ---- atrament stroke shape (atrament 5.1.0) ----

export type StrokeMode = "draw" | "erase" | "fill" | "disabled";

export interface StrokeSegment {
  point: { x: number; y: number };
  time: number;
  pressure: number;
}

export interface Stroke {
  segments: StrokeSegment[];
  mode: StrokeMode;
  weight: number;
  smoothing: number;
  color: string;
  adaptiveStroke: boolean;
}

/** A node plus its nested children, built client-side from the flat list. */
export interface TreeNode extends Node {
  children: TreeNode[];
}
