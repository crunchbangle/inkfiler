# InkFiler 🖋

An **ink-first, privacy-focused, self-hosted** hierarchical notebook — a OneNote/Obsidian-style
sidebar tree where every node owns a pressure-sensitive drawing canvas, with text boxes,
captions, tags, and full-text search. Built with Tauri + React + atrament.js, storing everything
locally in a single SQLite file.

[![CI](https://github.com/crunchbangle/inkfiler/actions/workflows/ci.yml/badge.svg)](https://github.com/crunchbangle/inkfiler/actions/workflows/ci.yml)

## Download

Grab the latest build from the **[Releases page](https://github.com/crunchbangle/inkfiler/releases/latest)**:

- **Windows** — `.msi` or `.exe` installer
- **Linux** — `.deb` or `.AppImage`

> ⚠️ Builds are currently **unsigned**, so Windows SmartScreen / Linux may warn on first run.
> Installers are rebuilt automatically on every merge to `main`.

## Features (prototype)

- **Hierarchy** — OneNote/Obsidian-style tree: create nodes & child nodes, rename, reorder, delete.
- **Canvas** — pressure-sensitive stylus drawing (atrament.js), colour palette, weight, draw/erase.
- **Undo/redo** — pixel-faithful, via canvas snapshots.
- **Persistence** — autosaved to SQLite; each canvas reloads exactly as drawn.
- **Text boxes** — movable sticky-note annotations on the canvas (pen handwriting supported).
- **Captions & tags** — per-node accompanying text and tags.
- **Search** — full-text (SQLite FTS5) over titles, captions, text boxes, and tags; filters the sidebar.

See [inkfiler.md](inkfiler.md) for the vision and [inkfiler-plan.md](inkfiler-plan.md) for the architecture.

## Where is my data?

A single SQLite file in your OS app-data directory, e.g. on Windows:

```
%APPDATA%\io.firefinch.inkfiler\inkfiler.db
```

Back it up by copying that file. Set `INKFILER_DATA_DIR` to override the location (used by tests).

## Development

**Prerequisites:** [Rust](https://rustup.rs) (MSVC toolchain on Windows), Node 20+, and the
[Tauri OS prerequisites](https://tauri.app/start/prerequisites/) (WebView2 on Windows — preinstalled
on Win11; `webkit2gtk` on Linux).

```bash
cd app
npm ci
npm run tauri dev      # run the app with hot reload
```

Build installers locally:

```bash
npm run tauri build            # release bundles
npm run tauri build -- --debug # debug bundles
```

## Tests

```bash
cd app
npm test            # frontend unit/component tests (Vitest)
npm run test:e2e    # end-to-end via WebDriver (see e2e/README.md)
cd src-tauri && cargo test   # Rust data-layer tests
```

CI runs unit, Rust, and Linux E2E tests on every pull request (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Tech stack

Tauri 2 · React 19 + TypeScript · Vite · atrament.js · SQLite (rusqlite, FTS5) · Zustand
