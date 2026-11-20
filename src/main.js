const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const os = require("node:os");
const { spawn, execFile } = require("node:child_process");

let mainWindow;
let previousCpu = null;
const APP_NAME = "SYSTEM";

function userFile(...parts) {
  return path.join(app.getPath("userData"), ...parts);
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}
function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), "utf8");
  JSON.parse(fs.readFileSync(temp, "utf8"));
  fs.renameSync(temp, file);
}
function getRobloxVersions() {
  const root = path.join(process.env.LOCALAPPDATA || "", "Roblox", "Versions");
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(x => x.isDirectory())
    .map(x => path.join(root, x.name))
    .filter(p => fs.existsSync(path.join(p, "RobloxPlayerBeta.exe")))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}
function findRoblox() { return getRobloxVersions()[0] || null; }
function robloxFile() {
  const version = findRoblox();
  return version ? path.join(version, "ClientSettings", "ClientAppSettings.json") : null;
}
function readFlags() {
  const file = robloxFile();
  if (!file) return { installed: false, path: null, flags: {} };
  if (!fs.existsSync(file)) return { installed: true, path: file, flags: {} };
  try {
    const flags = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!flags || Array.isArray(flags) || typeof flags !== "object") throw new Error("A raiz do JSON precisa ser um objeto.");
    return { installed: true, path: file, flags };
  } catch (e) {
    return { installed: true, path: file, flags: {}, error: "JSON inválido: " + e.message };
  }
}
function backupCurrentFlags() {
  const file = robloxFile();
  if (!file || !fs.existsSync(file)) return null;
  const dir = userFile("backups");
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, "ClientAppSettings-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json");
  fs.copyFileSync(file, dest);
  return dest;
}
function writeFlags(flags) {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) throw new Error("As configuraÃ§Ãµes precisam ser um objeto JSON.");
  const file = robloxFile();
  if (!file) throw new Error("Roblox Player nÃ£o encontrado.");
  for (const key of Object.keys(flags)) {
    if (!key.trim() || key.length > 200) throw new Error("Existe uma chave vazia ou longa demais.");
    const type = typeof flags[key];
    if (flags[key] === undefined || type === "function" || type === "symbol") throw new Error("Valor invÃ¡lido em " + key);
  }
  const backup = backupCurrentFlags();
  writeJsonAtomic(file, flags);
  return { path: file, count: Object.keys(flags).length, backup };
}
function listBackups() {
  const dir = userFile("backups");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(x => /^ClientAppSettings-.*\.json$/i.test(x))
    .map(name => ({ name, path: path.join(dir, name), date: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.date - a.date);
}
function restoreLatestBackup() {
  const file = robloxFile();
  if (!file) throw new Error("Roblox Player nÃ£o encontrado.");
  const latest = listBackups()[0];
  if (!latest) throw new Error("Nenhum backup do SAGA foi encontrado.");
  const parsed = JSON.parse(fs.readFileSync(latest.path, "utf8"));
  backupCurrentFlags();
  writeJsonAtomic(file, parsed);
  return { count: Object.keys(parsed).length, name: latest.name };
}
function profileDir() { return userFile("profiles"); }
function safeProfileName(name) {
  const clean = String(name || "").trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").slice(0, 40);
  if (!clean) throw new Error("Digite um nome vÃ¡lido para o perfil.");
  return clean;
}
function listProfiles() {
  const dir = profileDir();
  fs.mkdirSync(dir, { recursive: true });
  return fs.readdirSync(dir).filter(x => x.endsWith(".json")).map(file => {
    const data = readJson(path.join(dir, file), {});
    return { name: path.basename(file, ".json"), count: data.flags && typeof data.flags === "object" ? Object.keys(data.flags).length : 0, updatedAt: data.updatedAt || null };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
function saveProfile(name, flags) {
  const clean = safeProfileName(name);
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) throw new Error("Perfil invÃ¡lido.");
  const file = path.join(profileDir(), clean + ".json");
  writeJsonAtomic(file, { name: clean, flags, updatedAt: new Date().toISOString() });
  return { name: clean, count: Object.keys(flags).length };
}
function deleteProfile(name) {
  const clean = safeProfileName(name);
  const file = path.join(profileDir(), clean + ".json");
  if (!fs.existsSync(file)) throw new Error("Perfil nÃ£o encontrado.");
  fs.unlinkSync(file);
  return true;
}
function getSystemInfo() {
  const cpus = os.cpus();
  const total = os.totalmem();
  const free = os.freemem();
  const now = cpus.map(c => ({ ...c.times }));

  let cpuPerCore = now.map(() => null);
  let cpuPercent = null;

  if (previousCpu && previousCpu.length === now.length) {
    let totalIdle = 0;
    let totalTime = 0;

    cpuPerCore = now.map((current, index) => {
      const old = previousCpu[index];
      const idle = current.idle - old.idle;
      const delta = Object.keys(current).reduce(
        (sum, key) => sum + current[key] - old[key], 0
      );

      if (delta <= 0) return null;

      totalIdle += idle;
      totalTime += delta;

      return Math.max(0, Math.min(100, (1 - idle / delta) * 100));
    });

    if (totalTime > 0) {
      cpuPercent = Math.max(0, Math.min(100, (1 - totalIdle / totalTime) * 100));
    }
  }

  previousCpu = now;

  return {
    version: app.getVersion(),
    platform: process.platform,
    osType: os.type(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpu: cpus[0]?.model || "NÃ£o identificado",
    cores: cpus.length,
    cpuPerCore,
    cpuPercent,
    memoryTotal: total,
    memoryFree: free,
    memoryUsed: total - free,
    memoryPercent: total ? ((total - free) / total) * 100 : 0,
    processMemory: process.memoryUsage().rss,
    uptime: os.uptime(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node
  };
}

function readPreferences() {
  const defaults = {
    refreshMs: 5000,
    accent: "#FF1744",
    reduceMotion: false
  };

  const saved = readJson(userFile("preferences.json"), {});
  const interval = Number(saved.refreshMs);
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(saved.accent || ""))
    ? String(saved.accent).toUpperCase()
    : defaults.accent;

  return {
    refreshMs: Number.isFinite(interval)
      ? Math.max(2000, Math.min(30000, interval))
      : defaults.refreshMs,
    accent,
    reduceMotion: saved.reduceMotion === true
  };
}

function savePreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PreferÃªncias invÃ¡lidas.");
  }

  const refreshMs = Number(value.refreshMs);
  const accent = String(value.accent || "#FF1744").toUpperCase();

  if (!Number.isFinite(refreshMs) || refreshMs < 2000 || refreshMs > 30000) {
    throw new Error("Intervalo de atualizaÃ§Ã£o invÃ¡lido.");
  }

  if (!/^#[0-9A-F]{6}$/.test(accent)) {
    throw new Error("CÃ³digo de cor invÃ¡lido.");
  }

  const preferences = {
    refreshMs: Math.round(refreshMs),
    accent,
    reduceMotion: value.reduceMotion === true
  };

  writeJsonAtomic(userFile("preferences.json"), preferences);
  return preferences;
}
function isRobloxRunning() {
  if (process.platform !== "win32") return false;
  return new Promise(resolve => execFile("tasklist", ["/FI", "IMAGENAME eq RobloxPlayerBeta.exe", "/FO", "CSV", "/NH"], { windowsHide: true }, (_e, out) => resolve(String(out || "").toLowerCase().includes("robloxplayerbeta.exe"))));
}

function assertTrustedSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Janela principal indisponível.");
  }

  if (event.sender !== mainWindow.webContents) {
    throw new Error("IPC bloqueado: remetente não confiável.");
  }

  const frame = event.senderFrame;
  const expectedUrl = pathToFileURL(
    path.join(__dirname, "index.html")
  ).href;

  if (
    !frame ||
    frame !== event.sender.mainFrame ||
    frame.url !== expectedUrl
  ) {
    throw new Error("IPC bloqueado: origem não confiável.");
  }
}

function handleTrusted(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event);
    return handler(event, ...args);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 980, minHeight: 680,
    backgroundColor: "#090a10", title: APP_NAME, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const localFile = path.join(__dirname, "index.html");
    if (url !== "file://" + localFile.replace(/\\/g, "/")) {
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}
app.whenReady().then(() => {
  handleTrusted("app:info", () => getSystemInfo());
  handleTrusted("settings:read", () => readPreferences());
  handleTrusted("settings:save", (_e, value) => savePreferences(value));
  handleTrusted("roblox:status", async () => {
    const version = findRoblox();
    return { installed: !!version, versionPath: version, running: await isRobloxRunning() };
  });
  handleTrusted("roblox:launch", () => {
    const version = findRoblox();
    if (!version) throw new Error("Roblox Player nÃ£o encontrado. Abra o Roblox uma vez pelo site.");
    const child = spawn(path.join(version, "RobloxPlayerBeta.exe"), [], { detached: true, stdio: "ignore", windowsHide: false });
    child.unref(); return true;
  });
  handleTrusted("roblox:close", () => new Promise((resolve, reject) => {
    if (process.platform !== "win32") return reject(new Error("DisponÃ­vel apenas no Windows."));
    execFile("taskkill", ["/IM", "RobloxPlayerBeta.exe", "/T", "/F"], { windowsHide: true }, (e) => e ? reject(new Error("Roblox nÃ£o estava aberto ou nÃ£o foi possÃ­vel fechÃ¡-lo.")) : resolve(true));
  }));
  handleTrusted("flags:read", () => readFlags());
  handleTrusted("flags:write", (_e, flags) => writeFlags(flags));
  handleTrusted("flags:backups", () => listBackups().map(x => ({ name: x.name, date: x.date })));
  handleTrusted("flags:restore", () => restoreLatestBackup());
  handleTrusted("profiles:list", () => listProfiles());
  handleTrusted("profiles:save", (_e, name, flags) => saveProfile(name, flags));
  handleTrusted("profiles:delete", (_e, name) => deleteProfile(name));
  handleTrusted("profiles:apply", (_e, name) => {
    const clean = safeProfileName(name);
    const data = readJson(path.join(profileDir(), clean + ".json"), null);
    if (!data) throw new Error("Perfil nÃ£o encontrado.");
    return writeFlags(data.flags);
  });
  handleTrusted("flags:import", async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: "Importar configuraÃ§Ãµes", properties: ["openFile"], filters: [{ name: "JSON", extensions: ["json"] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const data = JSON.parse(fs.readFileSync(result.filePaths[0], "utf8"));
    if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("O arquivo precisa conter um objeto JSON.");
    return data;
  });
  handleTrusted("flags:export", async (_e, flags) => {
    const result = await dialog.showSaveDialog(mainWindow, { title: "Exportar configuraÃ§Ãµes", defaultPath: "SAGA-FastFlags.json", filters: [{ name: "JSON", extensions: ["json"] }] });
    if (result.canceled || !result.filePath) return false;
    writeJsonAtomic(result.filePath, flags); return true;
  });
  handleTrusted("system:openRobloxFolder", async () => {
    const version = findRoblox();
    if (!version) throw new Error("Pasta do Roblox nÃ£o encontrada.");
    const error = await shell.openPath(version);
    if (error) throw new Error(error);
    return true;
  });
  handleTrusted("system:openBackups", async () => {
    const dir = userFile("backups"); fs.mkdirSync(dir, { recursive: true });
    const error = await shell.openPath(dir); if (error) throw new Error(error); return true;
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });



// SAGA_LANGUAGE_CLOCK_STORAGE_V1
(() => {
  const originalRead = readPreferences;
  const originalSave = savePreferences;

  const supported = new Set([
    "pt-BR", "en-US", "es-ES", "fr-FR",
    "de-DE", "it-IT", "ja-JP", "ko-KR",
    "zh-CN", "ru-RU", "nl-NL", "hi-IN",
    "ar", "tr-TR"
  ]);

  function normalizeLanguage(value) {
    return supported.has(value) ? value : "pt-BR";
  }

  readPreferences = function () {
    const base = originalRead();
    const saved = readJson(userFile("preferences.json"), {});

    return {
      ...base,
      language: normalizeLanguage(saved.language),
      clock24h: saved.clock24h !== false,
      showClock: saved.showClock !== false
    };
  };

  savePreferences = function (value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Preferências inválidas.");
    }

    const previous = readPreferences();

    const base = originalSave({
      ...value,
      refreshMs: value.refreshMs ?? previous.refreshMs,
      accent: value.accent ?? previous.accent,
      reduceMotion: value.reduceMotion ?? previous.reduceMotion
    });

    const result = {
      ...base,
      language: normalizeLanguage(value.language ?? previous.language),
      clock24h: typeof value.clock24h === "boolean"
        ? value.clock24h : previous.clock24h,
      showClock: typeof value.showClock === "boolean"
        ? value.showClock : previous.showClock
    };

    writeJsonAtomic(userFile("preferences.json"), result);
    return result;
  };
})();
