import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

export function CaptionPanel() {
  const loaded = useStore((s) => s.loaded);
  const setCaption = useStore((s) => s.setCaption);
  const setTags = useStore((s) => s.setTags);

  const [caption, setLocalCaption] = useState("");
  const [tagText, setTagText] = useState("");
  const capTimer = useRef<number | null>(null);

  const nodeId = loaded?.node.id ?? null;
  useEffect(() => {
    setLocalCaption(loaded?.node.caption ?? "");
    setTagText((loaded?.tags ?? []).join(", "));
  }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) {
    return <section className="meta-panel meta-empty" />;
  }

  const onCaptionChange = (v: string) => {
    setLocalCaption(v);
    if (capTimer.current) window.clearTimeout(capTimer.current);
    capTimer.current = window.setTimeout(() => setCaption(v), 400);
  };

  const commitTags = () => {
    const names = tagText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setTags(names);
    setTagText(names.join(", "));
  };

  return (
    <section className="meta-panel">
      <label className="meta-label">Caption</label>
      <textarea
        className="caption-area"
        value={caption}
        placeholder="Accompanying text for this canvas…"
        onChange={(e) => onCaptionChange(e.target.value)}
      />

      <label className="meta-label">Tags</label>
      <input
        className="tags-input"
        value={tagText}
        placeholder="comma, separated, tags"
        onChange={(e) => setTagText(e.target.value)}
        onBlur={commitTags}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitTags();
          }
        }}
      />
      {loaded.tags.length > 0 && (
        <div className="tag-chips">
          {loaded.tags.map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
