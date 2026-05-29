import { useCallback, useEffect, useRef } from "react";
import Atrament from "atrament";
import { api } from "../api";
import { useStore } from "../store";
import { useTools } from "../tools";
import { StrokeHistory } from "../strokeHistory";
import type { Stroke } from "../types";
import { TextLayer } from "./TextLayer";

const CANVAS_W = 1600;
const CANVAS_H = 1200;
const BOUNDS = { w: CANVAS_W, h: CANVAS_H };
const SAVE_DEBOUNCE_MS = 600;

/**
 * Fallback re-draw for canvases saved before raster snapshots existed.
 * atrament's renderer is stateful, so this is only approximate — once a raster
 * snapshot is saved, that is used for display instead.
 */
function replay(at: Atrament, strokes: Stroke[]) {
  at.recordStrokes = false;
  const saved = {
    color: at.color,
    weight: at.weight,
    mode: at.mode,
    smoothing: at.smoothing,
    adaptiveStroke: at.adaptiveStroke,
  };
  for (const stroke of strokes) {
    const segs = stroke.segments;
    if (!segs || segs.length === 0) continue;
    at.mode = stroke.mode === "erase" ? "erase" : "draw";
    at.weight = stroke.weight;
    at.smoothing = stroke.smoothing;
    at.color = stroke.color;
    at.adaptiveStroke = stroke.adaptiveStroke;
    let prev = segs[0].point;
    at.beginStroke(prev.x, prev.y);
    if (segs.length === 1) {
      at.draw(prev.x, prev.y, prev.x, prev.y, segs[0].pressure ?? 0.5);
    } else {
      for (let i = 1; i < segs.length; i++) {
        const s = segs[i];
        prev = at.draw(s.point.x, s.point.y, prev.x, prev.y, s.pressure ?? 0.5);
      }
    }
    at.endStroke(prev.x, prev.y);
  }
  at.color = saved.color;
  at.weight = saved.weight;
  at.mode = saved.mode;
  at.smoothing = saved.smoothing;
  at.adaptiveStroke = saved.adaptiveStroke;
  at.recordStrokes = true;
}

export function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const atRef = useRef<Atrament | null>(null);
  // Vector strokes drawn this session (the DB also keeps the loaded base set).
  const historyRef = useRef(new StrokeHistory());
  const baseStrokesRef = useRef<Stroke[]>([]);
  // PNG snapshots for pixel-faithful undo/redo: snaps[0] is the loaded baseline,
  // snaps[k] is the canvas after the k-th stroke drawn this session.
  const snapsRef = useRef<string[]>([]);
  const snapIdxRef = useRef(0);
  const restoreTokenRef = useRef(0);
  const nodeIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const loaded = useStore((s) => s.loaded);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const loadedId = loaded?.node.id ?? null;

  const setActions = useTools((s) => s.setActions);

  const captureSnapshot = useCallback(
    () => canvasRef.current?.toDataURL("image/png") ?? "",
    [],
  );

  // Async because decoding a data URL goes through an Image; a monotonic token
  // discards stale restores if the node is switched mid-decode.
  const restoreSnapshot = useCallback((dataURL: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !dataURL) return Promise.resolve();
    const token = ++restoreTokenRef.current;
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (token === restoreTokenRef.current) {
          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = dataURL;
    });
  }, []);

  const saveNow = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current || !nodeIdRef.current) return;
    const strokes = [...baseStrokesRef.current, ...historyRef.current.list];
    api.saveCanvas(nodeIdRef.current, strokes, BOUNDS, captureSnapshot());
    dirtyRef.current = false;
  }, [captureSnapshot]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }, [saveNow]);

  const refreshUndoState = useCallback(() => {
    setActions({
      canUndo: snapIdxRef.current > 0,
      canRedo: snapIdxRef.current < snapsRef.current.length - 1,
    });
  }, [setActions]);

  const doUndo = useCallback(async () => {
    if (snapIdxRef.current <= 0) return;
    snapIdxRef.current -= 1;
    historyRef.current.undo();
    await restoreSnapshot(snapsRef.current[snapIdxRef.current]);
    scheduleSave();
    refreshUndoState();
  }, [restoreSnapshot, scheduleSave, refreshUndoState]);

  const doRedo = useCallback(async () => {
    if (snapIdxRef.current >= snapsRef.current.length - 1) return;
    snapIdxRef.current += 1;
    historyRef.current.redo();
    await restoreSnapshot(snapsRef.current[snapIdxRef.current]);
    scheduleSave();
    refreshUndoState();
  }, [restoreSnapshot, scheduleSave, refreshUndoState]);

  const doClear = useCallback(() => {
    if (!nodeIdRef.current) return;
    if (baseStrokesRef.current.length === 0 && historyRef.current.list.length === 0) return;
    baseStrokesRef.current = [];
    historyRef.current.reset([]);
    atRef.current?.clear();
    snapsRef.current = [captureSnapshot()];
    snapIdxRef.current = 0;
    scheduleSave();
    refreshUndoState();
  }, [captureSnapshot, scheduleSave, refreshUndoState]);

  // Load a node's canvas: draw its raster (faithful) or replay its vectors
  // (fallback), then establish the undo baseline.
  const loadIntoCanvas = useCallback(async () => {
    const at = atRef.current;
    if (!at) return;
    const cur = loadedRef.current;
    nodeIdRef.current = cur?.node.id ?? null;
    baseStrokesRef.current = cur ? [...cur.canvas.strokes] : [];
    historyRef.current.reset([]);
    at.clear();

    let needsRasterBackfill = false;
    if (cur?.canvas.raster) {
      await restoreSnapshot(cur.canvas.raster);
    } else if (cur && cur.canvas.strokes.length > 0) {
      replay(at, cur.canvas.strokes);
      needsRasterBackfill = true;
    }

    snapsRef.current = [captureSnapshot()];
    snapIdxRef.current = 0;
    refreshUndoState();

    // Persist a raster for legacy (vector-only) canvases so future loads and
    // undo/redo are pixel-stable.
    if (needsRasterBackfill) {
      dirtyRef.current = true;
      saveNow();
    }
  }, [restoreSnapshot, captureSnapshot, refreshUndoState, saveNow]);

  // Create the atrament instance once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const at = new Atrament(canvas, { width: CANVAS_W, height: CANVAS_H });
    at.recordStrokes = true;
    atRef.current = at;

    const t = useTools.getState();
    at.color = t.color;
    at.weight = t.weight;
    at.mode = t.mode;

    const onRecorded = (e: { stroke: Stroke }) => {
      historyRef.current.push(e.stroke);
      snapsRef.current = snapsRef.current.slice(0, snapIdxRef.current + 1);
      snapsRef.current.push(captureSnapshot());
      snapIdxRef.current = snapsRef.current.length - 1;
      scheduleSave();
      refreshUndoState();
    };
    at.addEventListener("strokerecorded", onRecorded);

    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        void doUndo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        void doRedo();
      }
    };
    window.addEventListener("keydown", onKey);

    setActions({
      undo: () => void doUndo(),
      redo: () => void doRedo(),
      clearCanvas: doClear,
      addTextbox: useStore.getState().addTextbox,
    });

    void loadIntoCanvas();

    return () => {
      saveNow();
      window.removeEventListener("keydown", onKey);
      at.removeEventListener("strokerecorded", onRecorded);
      at.destroy();
      atRef.current = null;
      setActions({ undo: null, redo: null, clearCanvas: null, addTextbox: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep atrament's live drawing settings in sync with the toolbar.
  const color = useTools((s) => s.color);
  const weight = useTools((s) => s.weight);
  const mode = useTools((s) => s.mode);
  useEffect(() => {
    const at = atRef.current;
    if (!at) return;
    at.color = color;
    at.weight = weight;
    at.mode = mode;
  }, [color, weight, mode]);

  // Switch canvases when the selected node changes (flush previous first).
  useEffect(() => {
    if (!atRef.current) return;
    saveNow();
    void loadIntoCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId]);

  // The canvas is always mounted so atrament can attach on first render; the
  // "no selection" state is an overlay rather than an unmount.
  return (
    <div className="canvas-scroll">
      <div className="canvas-stage" style={{ width: CANVAS_W, height: CANVAS_H }}>
        <canvas ref={canvasRef} className="ink-canvas" width={CANVAS_W} height={CANVAS_H} />
        <TextLayer />
        {!loaded && (
          <div className="canvas-overlay">
            <p>Select or create a node to start drawing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
