const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("Electron window and preload expose only the hardened application API", () => {
  const main = fs.readFileSync("src/main.js", "utf8");
  const preload = fs.readFileSync("src/preload.js", "utf8");
  const html = fs.readFileSync("src/index.html", "utf8");
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /assertTrustedSender/);
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^,]+,\s*ipcRenderer/);
  assert.match(html, /Content-Security-Policy/);
  const pages = [...html.matchAll(/<section\b(?=[^>]*\bclass="[^"]*\bpage\b[^"]*")(?=[^>]*\bid="page-([^"]+)")[^>]*>/g)]
    .map((match) => match[1]);
  const nav = [...html.matchAll(/data-page=\"([^\"]+)\"/g)].map((match) => match[1]);
  const ids = [...html.matchAll(/\bid=\"([^\"]+)\"/g)].map((match) => match[1]);
  assert.equal(pages.length, 8);
  assert.deepEqual([...pages].sort(), [...nav].sort());
  assert.equal(new Set(ids).size, ids.length);
  assert.doesNotMatch(html, /disabled(?:\s|>|=)/i);
});

test("settings parse failures are backed up and reported instead of silently discarded", async (t) => {
  const fsPromises = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const { SettingsStore } = require("../src/main/settings-store");
  const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), "saga-corrupt-test-"));
  t.after(() => fsPromises.rm(directory, { recursive: true, force: true }));
  await fsPromises.writeFile(path.join(directory, "settings.json"), "{not valid json");
  const store = new SettingsStore(directory, {
    isAvailable: () => true,
    encrypt: (value) => value,
    decrypt: (value) => value
  });
  const settings = await store.load();
  assert.match(settings.warning, /estava inv\u00e1lido/);
  assert.equal(settings.animations, true);
  const files = await fsPromises.readdir(directory);
  assert.equal(files.some((name) => name.startsWith("settings.json.corrupt-")), true);
});


