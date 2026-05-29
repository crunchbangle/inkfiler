import { create } from "zustand";
import { api } from "./api";
import type { LoadedNode, Node, Textbox } from "./types";
import { withAncestors } from "./tree";

interface State {
  nodes: Node[];
  selectedId: string | null;
  loaded: LoadedNode | null;
  searchQuery: string;
  /** null = no active search; otherwise ids to show (matches + ancestors). */
  visibleIds: Set<string> | null;

  refreshTree: () => Promise<void>;
  select: (id: string | null) => Promise<void>;
  addNode: (parentId: string | null) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  move: (id: string, parentId: string | null, sortOrder: number) => Promise<void>;
  setCaption: (caption: string) => Promise<void>;
  setTags: (names: string[]) => Promise<void>;
  runSearch: (query: string) => Promise<void>;

  addTextbox: () => Promise<void>;
  updateTextbox: (tb: Textbox) => Promise<void>;
  removeTextbox: (id: string) => Promise<void>;
}

export const useStore = create<State>((set, get) => ({
  nodes: [],
  selectedId: null,
  loaded: null,
  searchQuery: "",
  visibleIds: null,

  refreshTree: async () => {
    const nodes = await api.getTree();
    set({ nodes });
  },

  select: async (id) => {
    if (id === null) {
      set({ selectedId: null, loaded: null });
      return;
    }
    const loaded = await api.loadNode(id);
    set({ selectedId: id, loaded });
  },

  addNode: async (parentId) => {
    const node = await api.createNode(parentId);
    await get().refreshTree();
    await get().select(node.id);
  },

  rename: async (id, title) => {
    await api.renameNode(id, title);
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, title } : n)),
      loaded:
        s.loaded && s.loaded.node.id === id
          ? { ...s.loaded, node: { ...s.loaded.node, title } }
          : s.loaded,
    }));
  },

  remove: async (id) => {
    await api.deleteNode(id);
    await get().refreshTree();
    if (!get().nodes.some((n) => n.id === get().selectedId)) {
      await get().select(null);
    }
  },

  move: async (id, parentId, sortOrder) => {
    await api.moveNode(id, parentId, sortOrder);
    await get().refreshTree();
  },

  setCaption: async (caption) => {
    const id = get().selectedId;
    if (!id) return;
    await api.saveCaption(id, caption);
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, caption } : n)),
      loaded: s.loaded ? { ...s.loaded, node: { ...s.loaded.node, caption } } : s.loaded,
    }));
  },

  setTags: async (names) => {
    const id = get().selectedId;
    if (!id) return;
    await api.setNodeTags(id, names);
    set((s) => ({
      loaded: s.loaded ? { ...s.loaded, tags: [...names] } : s.loaded,
    }));
  },

  runSearch: async (query) => {
    set({ searchQuery: query });
    if (query.trim() === "") {
      set({ visibleIds: null });
      return;
    }
    const matches = await api.search(query);
    set({ visibleIds: withAncestors(get().nodes, new Set(matches)) });
  },

  addTextbox: async () => {
    const id = get().selectedId;
    const loaded = get().loaded;
    if (!id || !loaded) return;
    const tb: Textbox = {
      id: crypto.randomUUID(),
      node_id: id,
      x: 40,
      y: 40,
      w: 220,
      h: 90,
      content: "",
      updated_at: Date.now(),
    };
    await api.upsertTextbox(tb);
    set((s) => ({
      loaded: s.loaded ? { ...s.loaded, textboxes: [...s.loaded.textboxes, tb] } : s.loaded,
    }));
  },

  updateTextbox: async (tb) => {
    set((s) => ({
      loaded: s.loaded
        ? { ...s.loaded, textboxes: s.loaded.textboxes.map((t) => (t.id === tb.id ? tb : t)) }
        : s.loaded,
    }));
    await api.upsertTextbox(tb);
  },

  removeTextbox: async (id) => {
    await api.deleteTextbox(id);
    set((s) => ({
      loaded: s.loaded
        ? { ...s.loaded, textboxes: s.loaded.textboxes.filter((t) => t.id !== id) }
        : s.loaded,
    }));
  },
}));
