/// <reference types="@wdio/globals/types" />

/**
 * End-to-end smoke test: drives the real built app through WebView2.
 * Exercises the core prototype loop — create a node, see it selected, draw a
 * stroke on the canvas, and confirm Undo becomes enabled (a stroke recorded).
 */
describe("InkFiler smoke", () => {
  it("starts with an empty tree (proves the isolated test data dir is used)", async () => {
    await expect($(".tree-empty")).toBeExisting();
    await expect($(".tree-empty")).toHaveText(expect.stringContaining("No nodes yet"));
    await expect($$(".tree-row")).toBeElementsArrayOfSize(0);
  });

  it("creates a node and selects it", async () => {
    await $("button.new-root").click();
    const row = await $(".tree-row.selected");
    await expect(row).toBeExisting();
  });

  it("records a stroke on the canvas (Undo becomes enabled)", async () => {
    const undo = await $("button[title='Undo (Ctrl+Z)']");
    await expect(undo).toBeDisabled();

    // Draw a stroke across the canvas. Coordinates are relative to the canvas
    // element's centre (origin) so the pointer events land on the canvas itself
    // rather than the surrounding chrome (the sidebar/toolbar).
    const canvas = await $("canvas.ink-canvas");
    await browser
      .action("pointer", { parameters: { pointerType: "pen" } })
      .move({ origin: canvas, x: -120, y: -40 })
      .down()
      .move({ origin: canvas, x: 0, y: 30, duration: 60 })
      .move({ origin: canvas, x: 120, y: -20, duration: 60 })
      .up()
      .perform();

    await expect(undo).toBeEnabled();
  });
});
