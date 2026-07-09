"use strict";
/**
 * AEVION Council — Electron main process.
 *
 * Shows a small "starting…" splash with live logs while the Orchestrator brings
 * up Ollama + backend + frontend, then loads the offline Council UI. Tears the
 * child processes down on quit so nothing is left running.
 */

const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { Orchestrator } = require("./lib/orchestrator");

let win = null;
let orchestrator = null;
const logs = [];

function pushLog(line) {
  logs.push(line);
  if (logs.length > 400) logs.shift();
  if (win && !win.isDestroyed()) {
    win.webContents.send("aevion:log", line);
  }
  // Also to stdout for `npm start` debugging.
  console.log(line);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#0d0b14",
    title: "AEVION Council",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links (docs, model downloads) in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadFile(path.join(__dirname, "splash.html"));
}

async function boot() {
  orchestrator = new Orchestrator({ onLog: pushLog });
  try {
    const url = await orchestrator.start();
    pushLog(`[app] ready → ${url}`);
    if (win && !win.isDestroyed()) await win.loadURL(url);
  } catch (err) {
    pushLog(`[app] startup failed: ${err && err.message ? err.message : err}`);
    // Leave the splash up so the user can read the logs and the failure reason.
  }
}

app.whenReady().then(() => {
  createWindow();
  boot();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  try { orchestrator?.stop(); } catch { /* ignore */ }
});
