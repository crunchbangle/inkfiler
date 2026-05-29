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

/** Re-draw a list of recorded strokes onto an atrament canvas, in order. */
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
  const historyRef = useRef(new StrokeHistory());
  const nodeIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const loaded = useStore((s) => s.loaded);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const loadedId = loaded?.node.id ?? null;

  const setActions = useTools((s) => s.setActions);

  const saveNow = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current || !nodeIdRef.current) return;
    api.saveCanvas(nodeIdRef.current, historyRef.current.list, BOUNDS);
    dirtyRef.current = false;
  }, []);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }, [saveNow]);

  const refreshUndoState = useCallback(() => {
    setActions({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    });
  }, [setActions]);

  const redrawAll = useCallback(() => {
    const at = atRef.current;
    if (!at) return;
    at.clear();
    replay(at, historyRef.current.list);
  }, []);

  const doUndo = useCallback(() => {
    if (!historyRef.current.undo()) return;
    redrawAll();
    scheduleSave();
    refreshUndoState();
  }, [redrawAll, scheduleSave, refreshUndoState]);

  const doRedo = useCallback(() => {
    if (!historyRef.current.redo()) return;
    redrawAll();
    scheduleSave();
    refreshUndoState();
  }, [redrawAll, scheduleSave, refreshUndoState]);

  const doClear = useCallback(() => {
    if (!nodeIdRef.current || !historyRef.current.clear()) return;
    redrawAll();
    scheduleSave();
    refreshUndoState();
  }, [redrawAll, scheduleSave, refreshUndoState]);

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
      scheduleSave();
      refreshUndoState();
    };
    at.addEventListener("strokerecorded", onRecorded);

    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        doRedo();
      }
    };
    window.addEventListener("keydown", onKey);

    setActions({
      undo: doUndo,
      redo: doRedo,
      clearCanvas: doClear,
      addTextbox: useStore.getState().addTextbox,
    });

    // Hydrate whatever node is already selected.
    const cur = loadedRef.current;
    nodeIdRef.current = cur?.node.id ?? null;
    historyRef.current.reset(cur ? cur.canvas.strokes : []);
    redrawAll();
    refreshUndoState();

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
    const cur = loadedRef.current;
    nodeIdRef.current = loadedId;
    historyRef.current.reset(cur ? cur.canvas.strokes : []);
    redrawAll();
    refreshUndoState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId]);

  // The canvas is always mounted so the atrament instance can attach to it on
  // first render; the "no selection" state is shown as an overlay rather than
  // by unmounting the canvas (which would leave atrament with nothing to bind).
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
