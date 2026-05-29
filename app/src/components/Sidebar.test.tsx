import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { useStore } from "../store";
import type { Node } from "../types";

function node(id: string, parent_id: string | null = null): Node {
  return { id, parent_id, title: id, sort_order: 0, caption: "", created_at: 0, updated_at: 0 };
}

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(null);
  useStore.setState({
    nodes: [],
    selectedId: null,
    loaded: null,
    searchQuery: "",
    visibleIds: null,
  });
});

describe("Sidebar", () => {
  it("renders nested node titles", () => {
    useStore.setState({ nodes: [node("a"), node("b", "a")] });
    render(<Sidebar />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("shows an empty hint when there are no nodes", () => {
    render(<Sidebar />);
    expect(screen.getByText(/No nodes yet/)).toBeInTheDocument();
  });

  it("hides nodes outside the active search filter", () => {
    useStore.setState({
      nodes: [node("a"), node("b", "a"), node("c")],
      visibleIds: new Set(["a", "b"]),
      searchQuery: "x",
    });
    render(<Sidebar />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.queryByText("c")).not.toBeInTheDocument();
  });

  it("loads a node when its row is clicked", () => {
    useStore.setState({ nodes: [node("a")] });
    render(<Sidebar />);
    fireEvent.click(screen.getByText("a"));
    expect(invokeMock).toHaveBeenCalledWith("load_node", { id: "a" });
  });

  it("runs a search as the user types", () => {
    render(<Sidebar />);
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "foo" } });
    expect(invokeMock).toHaveBeenCalledWith("search", { query: "foo" });
  });
});
