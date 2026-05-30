import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// The project is an ES module ("type": "module"), so __dirname isn't defined.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Isolated, throwaway data directory so E2E never touches the real notebook.
// The app honours INKFILER_DATA_DIR (see src-tauri/src/lib.rs).
const testDataDir = path.join(os.tmpdir(), "inkfiler-e2e-data");

// Drives the built Tauri binary through tauri-driver, which proxies to the
// Microsoft Edge WebDriver (must match the installed WebView2 runtime).
//
// Prerequisites (see e2e/README.md):
//   - `cargo install tauri-driver --locked`            (on PATH)
//   - msedgedriver.exe matching the WebView2 version   (e2e/drivers/)
//   - a built app binary:  `npm run tauri build --debug`

const projectRoot = path.resolve(__dirname, "..");
const appBinary = path.resolve(
  projectRoot,
  "src-tauri",
  "target",
  "debug",
  os.platform() === "win32" ? "app.exe" : "app",
);
const edgedriver = path.resolve(__dirname, "drivers", "msedgedriver.exe");

let tauriDriver: ChildProcess;

export const config: WebdriverIO.Config = {
  runner: "local",
  framework: "mocha",
  specs: ["./specs/**/*.e2e.ts"],
  maxInstances: 1,
  capabilities: [
    {
      // @ts-expect-error tauri-specific capability
      "tauri:options": { application: appBinary },
      browserName: "wry",
    },
  ],
  reporters: ["spec"],
  hostname: "127.0.0.1",
  port: 4444,
  logLevel: "warn",
  // Safety gate: the first spec asserts an empty tree (read-only). If data
  // isolation ever fails it sees real data and fails here — and bail stops the
  // run before the mutating create/draw specs can touch the real notebook.
  bail: 1,
  mochaOpts: { ui: "bdd", timeout: 60_000 },

  // Make sure the binary exists, then point the app at a clean temp data dir.
  onPrepare: () => {
    const built = spawnSync(appBinary, ["--help"], { stdio: "ignore" });
    if (built.error && (built.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `App binary not found at ${appBinary}.\n` +
          `Build it first:  npm run tauri build -- --debug`,
      );
    }
    fs.rmSync(testDataDir, { recursive: true, force: true });
    fs.mkdirSync(testDataDir, { recursive: true });
    process.env.INKFILER_DATA_DIR = testDataDir;
  },

  beforeSession: () => {
    // Windows drives WebView2 via the bundled Edge WebDriver; Linux (CI) lets
    // tauri-driver use WebKitWebDriver from PATH.
    const args = os.platform() === "win32" ? ["--native-driver", edgedriver] : [];
    tauriDriver = spawn("tauri-driver", args, {
      stdio: [null, process.stdout, process.stderr],
      // Propagate the isolated data dir to the driven app.
      env: { ...process.env, INKFILER_DATA_DIR: testDataDir },
    });
  },

  afterSession: () => {
    tauriDriver?.kill();
  },
};
