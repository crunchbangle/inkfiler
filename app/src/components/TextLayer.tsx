import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { Textbox } from "../types";

function TextboxItem({ tb }: { tb: Textbox }) {
  const update = useStore((s) => s.updateTextbox);
  const remove = useStore((s) => s.removeTextbox);

  const [pos, setPos] = useState({ x: tb.x, y: tb.y });
  const [content, setContent] = useState(tb.content);
  const saveTimer = useRef<number | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Re-sync when a different textbox object is bound to this slot.
  useEffect(() => {
    setPos({ x: tb.x, y: tb.y });
    setContent(tb.content);
  }, [tb.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (next: Partial<Textbox>) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const merged: Textbox = {
      ...tb,
      x: pos.x,
      y: pos.y,
      content,
      ...next,
    };
    saveTimer.current = window.setTimeout(() => update(merged), 350);
  };

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
  };
  const onHeaderPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    drag.current = null;
    persist({ x: pos.x, y: pos.y });
  };

  return (
    <div
      className="textbox"
      style={{ left: pos.x, top: pos.y, width: tb.w, height: tb.h }}
    >
      <div
        className="textbox-header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        title="Drag to move"
      >
        <span className="textbox-grip">⠿</span>
        <button
          className="textbox-del"
          onClick={() => remove(tb.id)}
          title="Delete text box"
        >
          ×
        </button>
      </div>
      <textarea
        className="textbox-area"
        value={content}
        placeholder="Type…"
        // Release any pointer capture the textarea gains — including the
        // implicit capture the Windows handwriting panel sets when a pen writes
        // into it via the OS path (which never fires a normal pointerdown). If
        // left captured, the pen's events stay routed to the textarea and the
        // canvas never receives them again until a reload (mouse is unaffected,
        // being a separate uncaptured pointer). gotpointercapture catches it
        // however the capture was acquired.
        onGotPointerCapture={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onChange={(e) => {
          setContent(e.target.value);
          persist({ content: e.target.value });
        }}
      />
    </div>
  );
}

export function TextLayer() {
  // Select a stable reference (the array itself or undefined) — returning a
  // fresh `?? []` from the selector would change identity every render and
  // drive Zustand into an infinite update loop.
  const textboxes = useStore((s) => s.loaded?.textboxes);
  return (
    <div className="text-layer">
      {(textboxes ?? []).map((tb) => (
        <TextboxItem key={tb.id} tb={tb} />
      ))}
    </div>
  );
}
