# End-to-end tests

Drives the **real built app** through WebView2 using
[`tauri-driver`](https://v2.tauri.app/develop/tests/webdriver/) + WebdriverIO.
This is the heaviest, most environment-specific test layer — the unit, store,
component (Vitest) and Rust (`cargo test`) layers cover most logic far faster.

## Prerequisites (Windows)

1. **tauri-driver** on PATH:
   ```
   cargo install tauri-driver --locked
   ```
2. **Microsoft Edge WebDriver** matching the installed WebView2 runtime, at
   `e2e/drivers/msedgedriver.exe`. Check your runtime version:
   ```powershell
   (Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}").pv
   ```
   then download the matching driver from
   `https://msedgedriver.microsoft.com/<version>/edgedriver_win64.zip`.
   (The driver currently checked in matches WebView2 148.0.3967.83 — re-download
   if your runtime updates, since versions must match.)

## Running

The binary must have the frontend **baked in**, so build a debug bundle first
(a plain `cargo build` produces a binary that expects the dev server):

```
npm run tauri build -- --debug
npm run test:e2e
```

`wdio.conf.ts` launches `tauri-driver` (which spawns msedgedriver), starts the
app binary at `src-tauri/target/debug/app.exe`, and runs the specs in
`e2e/specs/`.

## Notes

- `drivers/` is git-ignored except for this README; don't commit the binary.
- Edge WebDriver pointer actions of `pointerType: "pen"` exercise the pressure
  path; mouse fallback also works.

## CI is the primary home for E2E

These tests run in CI on **Linux** (`.github/workflows/ci.yml`), which avoids the
Windows pain entirely: tauri-driver uses `WebKitWebDriver` (shipped matched to
`webkit2gtk`), so there's no evergreen version-drift to chase, and `xvfb`
provides the headless display.

**Local Windows status:** the full stack is verified working — tauri-driver +
msedgedriver + WebView2 attach and create a session against the built app (with
isolated data). The remaining local hurdle is a WebdriverIO v9 runner quirk
(getting from "session created" to "run the specs"); the canonical Linux config
in CI sidesteps it. The driver version **must** match the (auto-updating)
WebView2 runtime — re-download `msedgedriver` if a run suddenly stops connecting.
