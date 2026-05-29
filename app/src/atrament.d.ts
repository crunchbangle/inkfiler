declare module "atrament" {
  export const MODE_DRAW: "draw";
  export const MODE_ERASE: "erase";
  export const MODE_FILL: "fill";
  export const MODE_DISABLED: "disabled";

  export interface AtramentOptions {
    width?: number;
    height?: number;
    color?: string;
    weight?: number;
    smoothing?: number;
    adaptiveStroke?: boolean;
  }

  export default class Atrament {
    constructor(canvas: HTMLCanvasElement | string, opts?: AtramentOptions);
    color: string;
    weight: number;
    mode: "draw" | "erase" | "fill" | "disabled";
    smoothing: number;
    adaptiveStroke: boolean;
    recordStrokes: boolean;
    readonly dirty: boolean;
    readonly currentStroke: import("./types").Stroke;
    beginStroke(x: number, y: number): void;
    draw(
      x: number,
      y: number,
      prevX: number,
      prevY: number,
      pressure?: number,
    ): { x: number; y: number };
    endStroke(x: number, y: number): void;
    clear(): void;
    destroy(): void;
    addEventListener(type: string, cb: (e: any) => void): void;
    removeEventListener(type: string, cb: (e: any) => void): void;
  }
}
