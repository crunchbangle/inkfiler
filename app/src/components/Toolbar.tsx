import { PALETTE, useTools } from "../tools";

export function Toolbar() {
  const { color, weight, mode, setColor, setWeight, setMode } = useTools();
  const undo = useTools((s) => s.undo);
  const redo = useTools((s) => s.redo);
  const clearCanvas = useTools((s) => s.clearCanvas);
  const addTextbox = useTools((s) => s.addTextbox);
  const canUndo = useTools((s) => s.canUndo);
  const canRedo = useTools((s) => s.canRedo);

  const enabled = undo !== null; // a canvas is mounted

  return (
    <div className="toolbar">
      <div className="swatches">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`swatch${color === c ? " active" : ""}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={`Colour ${c}`}
          />
        ))}
        <input
          type="color"
          className="swatch custom"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="Custom colour"
        />
      </div>

      <label className="weight">
        Weight
        <input
          type="range"
          min={1}
          max={40}
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
        />
        <span className="weight-val">{weight}</span>
      </label>

      <div className="mode-toggle">
        <button className={mode === "draw" ? "active" : ""} onClick={() => setMode("draw")}>
          ✏ Draw
        </button>
        <button className={mode === "erase" ? "active" : ""} onClick={() => setMode("erase")}>
          ⌫ Erase
        </button>
      </div>

      <div className="actions">
        <button disabled={!enabled || !canUndo} onClick={() => undo?.()} title="Undo (Ctrl+Z)">
          ↶ Undo
        </button>
        <button disabled={!enabled || !canRedo} onClick={() => redo?.()} title="Redo (Ctrl+Shift+Z)">
          ↷ Redo
        </button>
        <button disabled={!enabled} onClick={() => addTextbox?.()} title="Add text box">
          T+ Text
        </button>
        <button disabled={!enabled} onClick={() => clearCanvas?.()} title="Clear canvas">
          ✕ Clear
        </button>
      </div>
    </div>
  );
}
