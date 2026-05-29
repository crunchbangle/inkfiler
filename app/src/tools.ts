import { create } from "zustand";

export type DrawMode = "draw" | "erase";

interface ToolState {
  color: string;
  weight: number;
  mode: DrawMode;
  setColor: (c: string) => void;
  setWeight: (w: number) => void;
  setMode: (m: DrawMode) => void;

  // Canvas actions are published by CanvasView so the Toolbar can call them.
  undo: (() => void) | null;
  redo: (() => void) | null;
  clearCanvas: (() => void) | null;
  addTextbox: (() => void) | null;
  canUndo: boolean;
  canRedo: boolean;
  setActions: (a: Partial<ToolState>) => void;
}

export const PALETTE = [
  "#1a1a1a",
  "#e03131",
  "#1971c2",
  "#2f9e44",
  "#f08c00",
  "#9c36b5",
  "#ffffff",
];

export const useTools = create<ToolState>((set) => ({
  color: PALETTE[0],
  weight: 3,
  mode: "draw",
  setColor: (color) => set({ color }),
  setWeight: (weight) => set({ weight }),
  setMode: (mode) => set({ mode }),

  undo: null,
  redo: null,
  clearCanvas: null,
  addTextbox: null,
  canUndo: false,
  canRedo: false,
  setActions: (a) => set(a),
}));
