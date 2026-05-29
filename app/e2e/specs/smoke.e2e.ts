/// <reference types="@wdio/globals/types" />

/**
 * End-to-end smoke test: drives the real built app through WebView2.
 * Exercises the core prototype loop — create a node, see it selected, draw a
 * stroke on the canvas, and confirm Undo becomes enabled (a stroke recorded).
 */
describe("InkFiler smoke", () => {
  it("creates a node and selects it", async () => {
    await $("button.new-root").click();
    const row = await $(".tree-row.selected");
    await expect(row).toBeExisting();
  });

  it("records a stroke on the canvas (Undo becomes enabled)", async () => {
    const undo = await $("button[title='Undo (Ctrl+Z)']");
    await expect(undo).toBeDisabled();

    // Drag across the canvas to draw a stroke.
    const canvas = await $("canvas.ink-canvas");
    await canvas.moveTo({ xOffset: 80, yOffset: 80 });
    await browser.performActions([
      {
        type: "pointer",
        id: "pen",
        parameters: { pointerType: "pen" },
        actions: [
          { type: "pointerMove", duration: 0, x: 200, y: 200 },
          { type: "pointerDown", button: 0 },
          { type: "pointerMove", duration: 50, x: 320, y: 280 },
          { type: "pointerMove", duration: 50, x: 420, y: 200 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ]);
    await browser.releaseActions();

    await expect(undo).toBeEnabled();
  });
});
