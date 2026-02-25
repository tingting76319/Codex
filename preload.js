const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gameBridge", {
  readSave: (key) => ipcRenderer.invoke("save:read", key),
  writeSave: (key, data) => ipcRenderer.invoke("save:write", key, data)
});
