import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Toolbar } from "./Toolbar";
import { PALETTE, useTools } from "../tools";

beforeEach(() => {
  useTools.setState({
    color: PALETTE[0],
    weight: 3,
    mode: "draw",
    undo: null,
    redo: null,
    clearCanvas: null,
    addTextbox: null,
    canUndo: false,
    canRedo: false,
  });
});

describe("Toolbar", () => {
  it("disables canvas actions when no canvas is mounted", () => {
    render(<Toolbar />);
    expect(screen.getByTitle("Undo (Ctrl+Z)")).toBeDisabled();
    expect(screen.getByTitle("Add text box")).toBeDisabled();
    expect(screen.getByTitle("Clear canvas")).toBeDisabled();
  });

  it("enables and fires undo when available", () => {
    const undo = vi.fn();
    useTools.setState({ undo, canUndo: true });
    render(<Toolbar />);
    const btn = screen.getByTitle("Undo (Ctrl+Z)");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("keeps undo disabled when there is nothing to undo", () => {
    useTools.setState({ undo: vi.fn(), canUndo: false });
    render(<Toolbar />);
    expect(screen.getByTitle("Undo (Ctrl+Z)")).toBeDisabled();
  });

  it("switches draw/erase mode", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByText("⌫ Erase"));
    expect(useTools.getState().mode).toBe("erase");
    fireEvent.click(screen.getByText("✏ Draw"));
    expect(useTools.getState().mode).toBe("draw");
  });

  it("selecting a palette swatch updates the colour", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByLabelText(`Colour ${PALETTE[1]}`));
    expect(useTools.getState().color).toBe(PALETTE[1]);
  });

  it("updates weight from the slider", () => {
    render(<Toolbar />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    expect(useTools.getState().weight).toBe(12);
  });
});
