import { useEffect } from "react";
import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { CanvasView } from "./components/CanvasView";
import { CaptionPanel } from "./components/CaptionPanel";
import "./App.css";

export default function App() {
  const refreshTree = useStore((s) => s.refreshTree);
  const selectedTitle = useStore((s) => s.loaded?.node.title ?? null);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  return (
    <div className="app">
      <Sidebar />
      <main className="workspace">
        <header className="workspace-head">
          <h1 className="node-title">{selectedTitle ?? "No node selected"}</h1>
          <Toolbar />
        </header>
        <div className="workspace-body">
          <CanvasView />
          <CaptionPanel />
        </div>
      </main>
    </div>
  );
}
