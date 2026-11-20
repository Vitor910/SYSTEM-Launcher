const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("saga", {
  info: () => ipcRenderer.invoke("app:info"),
  getPreferences: () => ipcRenderer.invoke("settings:read"),
  savePreferences: value => ipcRenderer.invoke("settings:save", value),
  robloxStatus: () => ipcRenderer.invoke("roblox:status"),
  launchRoblox: () => ipcRenderer.invoke("roblox:launch"),
  closeRoblox: () => ipcRenderer.invoke("roblox:close"),
  readFlags: () => ipcRenderer.invoke("flags:read"),
  writeFlags: value => ipcRenderer.invoke("flags:write", value),
  listBackups: () => ipcRenderer.invoke("flags:backups"),
  restoreBackup: () => ipcRenderer.invoke("flags:restore"),
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  saveProfile: (name, flags) => ipcRenderer.invoke("profiles:save", name, flags),
  deleteProfile: name => ipcRenderer.invoke("profiles:delete", name),
  applyProfile: name => ipcRenderer.invoke("profiles:apply", name),
  importFlags: () => ipcRenderer.invoke("flags:import"),
  exportFlags: flags => ipcRenderer.invoke("flags:export", flags),
  openRobloxFolder: () => ipcRenderer.invoke("system:openRobloxFolder"),
  openBackups: () => ipcRenderer.invoke("system:openBackups")
});
