import { invoke } from "@tauri-apps/api/core";
import type { LoadedNode, Node, Stroke, Textbox } from "./types";

// Thin typed wrappers around the Rust commands registered in lib.rs.

export const api = {
  getTree: () => invoke<Node[]>("get_tree"),

  createNode: (parent_id: string | null, title?: string) =>
    invoke<Node>("create_node", { parentId: parent_id, title: title ?? null }),

  renameNode: (id: string, title: string) =>
    invoke<void>("rename_node", { id, title }),

  moveNode: (id: string, new_parent_id: string | null, sort_order: number) =>
    invoke<void>("move_node", { id, newParentId: new_parent_id, sortOrder: sort_order }),

  deleteNode: (id: string) => invoke<void>("delete_node", { id }),

  loadNode: (id: string) => invoke<LoadedNode | null>("load_node", { id }),

  saveCanvas: (
    node_id: string,
    strokes: Stroke[],
    bounds: { w: number; h: number } | null,
    raster: string | null,
  ) => invoke<void>("save_canvas", { nodeId: node_id, strokes, bounds, raster }),

  saveCaption: (id: string, caption: string) =>
    invoke<void>("save_caption", { id, caption }),

  upsertTextbox: (textbox: Textbox) => invoke<void>("upsert_textbox", { textbox }),

  deleteTextbox: (id: string) => invoke<void>("delete_textbox", { id }),

  setNodeTags: (node_id: string, names: string[]) =>
    invoke<void>("set_node_tags", { nodeId: node_id, names }),

  search: (query: string) => invoke<string[]>("search", { query }),
};
