"use strict";
/**
 * Preload: exposes a minimal, safe bridge so the splash page can stream startup
 * logs. No Node APIs leak into the renderer (contextIsolation on).
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aevion", {
  onLog: (cb) => {
    const handler = (_event, line) => cb(line);
    ipcRenderer.on("aevion:log", handler);
    return () => ipcRenderer.removeListener("aevion:log", handler);
  },
});
