const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { SettingsStore } = require("../src/main/settings-store");
const { findRobloxInstallation, launchRoblox } = require("../src/main/roblox-service");
const { getChannelStatus } = require("../src/main/youtube-service");
const { setDiscordPresence } = require("../src/main/discord-rpc");

async function createTemporaryDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), "saga-launcher-test-"));
}

test("settings persist, validate keys, and keep the API credential out of public data", async (t) => {
  const directory = await createTemporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const vault = {
    isAvailable: () => true,
    encrypt: (value) => Buffer.from(value).toString("base64"),
    decrypt: (value) => Buffer.from(value, "base64").toString()
  };
  const store = new SettingsStore(directory, vault);
  await store.load();
  await store.update("animations", false);
  await store.saveYouTubeSettings("UC123", "test-key");
  const publicSettings = store.getPublicSettings();
  assert.equal(publicSettings.animations, false);
  assert.equal(publicSettings.hasYouTubeApiKey, true);
  assert.equal(Object.hasOwn(publicSettings, "youtubeApiKey"), false);
  assert.deepEqual(store.getYouTubeCredentials(), { channelId: "UC123", apiKey: "test-key" });

  const saved = await fs.readFile(path.join(directory, "settings.json"), "utf8");
  assert.equal(saved.includes("test-key"), false);
  const reloaded = new SettingsStore(directory, vault);
  await reloaded.load();
  assert.equal(reloaded.getPublicSettings().animations, false);
  assert.equal(reloaded.getYouTubeCredentials().apiKey, "test-key");
  await assert.rejects(reloaded.update("unknown", true), /Configuração inválida/);
  const cleared = await reloaded.clearYouTubeApiKey();
  assert.equal(cleared.hasYouTubeApiKey, false);
  assert.equal(reloaded.getYouTubeCredentials().channelId, "UC123");
});

test("settings history is bounded and reset clears saved preferences", async (t) => {
  const directory = await createTemporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new SettingsStore(directory, {
    isAvailable: () => true,
    encrypt: (value) => value,
    decrypt: (value) => value
  });
  await store.load();
  for (let index = 0; index < 23; index += 1) await store.addLaunchResult(index % 2 === 0);
  assert.equal(store.getPublicSettings().launchHistory.length, 20);
  const reset = await store.reset();
  assert.equal(reset.launchHistory.length, 0);
  assert.equal(reset.animations, true);
});

test("concurrent preference writes preserve the final complete settings file", async (t) => {
  const directory = await createTemporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new SettingsStore(directory, {
    isAvailable: () => true,
    encrypt: (value) => value,
    decrypt: (value) => value
  });
  await store.load();
  await Promise.all([
    store.update("animations", false),
    store.update("notifications", false),
    store.update("launchAtLogin", true)
  ]);
  const reloaded = new SettingsStore(directory, {
    isAvailable: () => true,
    encrypt: (value) => value,
    decrypt: (value) => value
  });
  const settings = await reloaded.load();
  assert.equal(settings.animations, false);
  assert.equal(settings.notifications, false);
  assert.equal(settings.launchAtLogin, true);
});

test("Roblox detection finds the newest local player build and launch uses the official protocol", async (t) => {
  const directory = await createTemporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  for (const [build, modifiedAt] of [["version-old", 1000000000], ["version-new", 2000000000]]) {
    const buildPath = path.join(directory, build);
    await fs.mkdir(buildPath);
    const executable = path.join(buildPath, "RobloxPlayerBeta.exe");
    await fs.writeFile(executable, "");
    await fs.utimes(executable, new Date(modifiedAt), new Date(modifiedAt));
  }
  const found = await findRobloxInstallation(directory);
  assert.equal(found.installed, true);
  assert.equal(found.build, "version-new");
  let openedUrl;
  const launched = await launchRoblox({
    openExternal: async (url) => { openedUrl = url; }
  }, directory);
  assert.equal(launched.installed, true);
  assert.equal(openedUrl, "roblox-player:1+launchmode:app");

  await assert.rejects(launchRoblox({
    openExternal: async () => {}
  }, path.join(directory, "missing")), /Roblox não foi encontrado/);
});

test("YouTube channel and live status uses actual API responses", async (t) => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(new URL(url));
    if (requestedUrls.length === 1) {
      return Response.json({ items: [{
        snippet: { title: "Canal público" },
        statistics: { hiddenSubscriberCount: false, subscriberCount: "42" }
      }] });
    }
    return Response.json({ items: [{
      id: { videoId: "video123" },
      snippet: { title: "Transmissão real" }
    }] });
  };
  t.after(() => { global.fetch = originalFetch; });

  const result = await getChannelStatus({ channelId: "UC123", apiKey: "test-key" });
  assert.equal(result.channelName, "Canal público");
  assert.equal(result.subscriberCount, "42");
  assert.equal(result.live.title, "Transmissão real");
  assert.equal(requestedUrls.length, 2);
  assert.equal(requestedUrls[0].searchParams.get("key"), "test-key");
  assert.equal(requestedUrls[1].searchParams.get("eventType"), "live");
});

test("Discord integration rejects invalid application IDs without connecting", async () => {
  await assert.rejects(setDiscordPresence("not-an-id", true), /ID válido/);
});
