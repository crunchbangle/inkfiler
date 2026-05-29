import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import os from "node:os";

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
  mochaOpts: { ui: "bdd", timeout: 60_000 },

  // Make sure the binary exists before trying to drive it.
  onPrepare: () => {
    const built = spawnSync(appBinary, ["--help"], { stdio: "ignore" });
    if (built.error && (built.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `App binary not found at ${appBinary}.\n` +
          `Build it first:  npm run tauri build -- --debug`,
      );
    }
  },

  beforeSession: () => {
    tauriDriver = spawn("tauri-driver", ["--native-driver", edgedriver], {
      stdio: [null, process.stdout, process.stderr],
    });
  },

  afterSession: () => {
    tauriDriver?.kill();
  },
};
