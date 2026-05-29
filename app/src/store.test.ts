import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useStore } from "./store";
import type { LoadedNode, Node } from "./types";

function node(id: string, parent_id: string | null = null): Node {
  return { id, parent_id, title: id, sort_order: 0, caption: "", created_at: 0, updated_at: 0 };
}

function loaded(n: Node): LoadedNode {
  return {
    node: n,
    canvas: { node_id: n.id, bounds: null, strokes: [], updated_at: 0 },
    textboxes: [],
    tags: [],
  };
}

beforeEach(() => {
  invokeMock.mockReset();
  useStore.setState({
    nodes: [],
    selectedId: null,
    loaded: null,
    searchQuery: "",
    visibleIds: null,
  });
});

describe("store", () => {
  it("refreshTree loads nodes from the backend", async () => {
    invokeMock.mockResolvedValueOnce([node("a"), node("b")]);
    await useStore.getState().refreshTree();
    expect(invokeMock).toHaveBeenCalledWith("get_tree");
    expect(useStore.getState().nodes.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("addNode creates, refreshes, then selects the new node", async () => {
    const created = node("new");
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "create_node") return Promise.resolve(created);
      if (cmd === "get_tree") return Promise.resolve([created]);
      if (cmd === "load_node") return Promise.resolve(loaded(created));
      return Promise.resolve(null);
    });

    await useStore.getState().addNode(null);

    expect(useStore.getState().selectedId).toBe("new");
    expect(useStore.getState().loaded?.node.id).toBe("new");
  });

  it("runSearch with empty query clears the filter", async () => {
    useStore.setState({ visibleIds: new Set(["x"]) });
    await useStore.getState().runSearch("   ");
    expect(useStore.getState().visibleIds).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("runSearch resolves matches and includes their ancestors", async () => {
    useStore.setState({ nodes: [node("a"), node("b", "a"), node("c", "b")] });
    invokeMock.mockResolvedValueOnce(["c"]); // search returns the deep match only
    await useStore.getState().runSearch("deep");
    expect(invokeMock).toHaveBeenCalledWith("search", { query: "deep" });
    expect([...(useStore.getState().visibleIds ?? [])].sort()).toEqual(["a", "b", "c"]);
  });

  it("rename updates the node locally without a reload", async () => {
    useStore.setState({ nodes: [node("a")], selectedId: "a", loaded: loaded(node("a")) });
    invokeMock.mockResolvedValueOnce(undefined);
    await useStore.getState().rename("a", "Renamed");
    expect(invokeMock).toHaveBeenCalledWith("rename_node", { id: "a", title: "Renamed" });
    expect(useStore.getState().nodes[0].title).toBe("Renamed");
    expect(useStore.getState().loaded?.node.title).toBe("Renamed");
  });

  it("setTags persists and reflects tags on the loaded node", async () => {
    useStore.setState({ selectedId: "a", loaded: loaded(node("a")) });
    invokeMock.mockResolvedValueOnce(undefined);
    await useStore.getState().setTags(["x", "y"]);
    expect(invokeMock).toHaveBeenCalledWith("set_node_tags", { nodeId: "a", names: ["x", "y"] });
    expect(useStore.getState().loaded?.tags).toEqual(["x", "y"]);
  });

  it("addTextbox appends a textbox to the loaded node", async () => {
    useStore.setState({ selectedId: "a", loaded: loaded(node("a")) });
    invokeMock.mockResolvedValue(undefined);
    await useStore.getState().addTextbox();
    expect(invokeMock).toHaveBeenCalledWith("upsert_textbox", expect.anything());
    expect(useStore.getState().loaded?.textboxes).toHaveLength(1);
  });
});
