const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

const MAX_HISTORY = 20;

const DEFAULT_SETTINGS = Object.freeze({
  launchAtLogin: false,
  animations: true,
  notifications: true,
  youtubeChannelId: "",
  youtubeApiKey: "",
  discordClientId: "",
  discordPresenceEnabled: false,
  launchHistory: []
});

function normalizeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    launchAtLogin: source.launchAtLogin === true,
    animations: source.animations !== false,
    notifications: source.notifications !== false,
    youtubeChannelId: typeof source.youtubeChannelId === "string" ? source.youtubeChannelId.slice(0, 100) : "",
    youtubeApiKey: "",
    discordClientId: typeof source.discordClientId === "string" ? source.discordClientId.slice(0, 32) : "",
    discordPresenceEnabled: source.discordPresenceEnabled === true,
    launchHistory: Array.isArray(source.launchHistory)
      ? source.launchHistory
        .filter((entry) => entry && typeof entry.date === "string" && typeof entry.success === "boolean")
        .slice(0, MAX_HISTORY)
      : []
  };
}

class SettingsStore {
  constructor(userDataPath, credentialVault) {
    this.filePath = path.join(userDataPath, "settings.json");
    this.credentialVault = credentialVault;
    this.writeQueue = Promise.resolve();
    this.settings = { ...DEFAULT_SETTINGS, launchHistory: [] };
    this.loadWarning = "";
  }

  async load() {
    try {
      const contents = await fs.readFile(this.filePath, "utf8");
      const saved = JSON.parse(contents);
      this.settings = normalizeSettings(saved);
      if (saved.youtubeApiKeyEncrypted) {
        this.settings.youtubeApiKey = this.credentialVault.decrypt(saved.youtubeApiKeyEncrypted);
      }
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      if (error instanceof SyntaxError) {
        const backupPath = `${this.filePath}.corrupt-${Date.now()}`;
        await fs.rename(this.filePath, backupPath);
        this.loadWarning = `O arquivo de configurações estava inválido e foi preservado em ${backupPath}. Os padrões foram carregados.`;
      }
      this.settings = { ...DEFAULT_SETTINGS, launchHistory: [] };
      await this.save();
    }
    return this.getPublicSettings();
  }

  getPublicSettings() {
    const { youtubeApiKey, ...settings } = this.settings;
    return { ...settings, hasYouTubeApiKey: Boolean(youtubeApiKey), warning: this.loadWarning };
  }

  async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    const { youtubeApiKey, ...settings } = this.settings;
    const persisted = {
      ...settings,
      youtubeApiKeyEncrypted: youtubeApiKey ? this.credentialVault.encrypt(youtubeApiKey) : ""
    };
    const operation = this.writeQueue.then(async () => {
      try {
        await fs.writeFile(temporaryPath, JSON.stringify(persisted, null, 2), { mode: 0o600 });
        await fs.rename(temporaryPath, this.filePath);
      } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
      }
    });
    this.writeQueue = operation.catch(() => {});
    await operation;
  }

  async update(key, value) {
    const allowed = {
      launchAtLogin: (input) => typeof input === "boolean",
      animations: (input) => typeof input === "boolean",
      notifications: (input) => typeof input === "boolean",
      youtubeChannelId: (input) => typeof input === "string" && input.length <= 100
    };
    if (!Object.hasOwn(allowed, key) || !allowed[key](value)) {
      throw new TypeError("Configuração inválida.");
    }
    const previous = this.settings[key];
    this.settings[key] = value;
    try {
      await this.save();
    } catch (error) {
      this.settings[key] = previous;
      throw error;
    }
    return this.getPublicSettings();
  }

  async saveYouTubeSettings(channelId, apiKey) {
    if (typeof channelId !== "string" || channelId.length > 100) {
      throw new TypeError("ID do canal inválido.");
    }
    if (typeof apiKey !== "string" || apiKey.length > 200) {
      throw new TypeError("Chave da API do YouTube inválida.");
    }
    const key = apiKey.trim();
    if (key && !this.credentialVault.isAvailable()) {
      throw new Error("A proteção segura de credenciais do Windows não está disponível.");
    }
    const previousChannelId = this.settings.youtubeChannelId;
    const previousApiKey = this.settings.youtubeApiKey;
    this.settings.youtubeChannelId = channelId.trim();
    if (key) this.settings.youtubeApiKey = key;
    try {
      await this.save();
    } catch (error) {
      this.settings.youtubeChannelId = previousChannelId;
      this.settings.youtubeApiKey = previousApiKey;
      throw error;
    }
    return this.getPublicSettings();
  }

  async clearYouTubeApiKey() {
    const previousApiKey = this.settings.youtubeApiKey;
    this.settings.youtubeApiKey = "";
    try {
      await this.save();
    } catch (error) {
      this.settings.youtubeApiKey = previousApiKey;
      throw error;
    }
    return this.getPublicSettings();
  }

  async configureDiscord(clientId, enabled) {
    if (typeof clientId !== "string" || !/^\d{0,32}$/.test(clientId) || typeof enabled !== "boolean") {
      throw new TypeError("Configuração do Discord inválida.");
    }
    if (enabled && !/^\d{17,20}$/.test(clientId)) {
      throw new TypeError("Application ID inválido para ativar a presença do Discord.");
    }
    const previousClientId = this.settings.discordClientId;
    const previousEnabled = this.settings.discordPresenceEnabled;
    this.settings.discordClientId = clientId;
    this.settings.discordPresenceEnabled = enabled;
    try {
      await this.save();
    } catch (error) {
      this.settings.discordClientId = previousClientId;
      this.settings.discordPresenceEnabled = previousEnabled;
      throw error;
    }
    return this.getPublicSettings();
  }

  getYouTubeCredentials() {
    return {
      channelId: this.settings.youtubeChannelId,
      apiKey: this.settings.youtubeApiKey
    };
  }

  getDiscordSettings() {
    return {
      clientId: this.settings.discordClientId,
      enabled: this.settings.discordPresenceEnabled
    };
  }

  async addLaunchResult(success) {
    const previousHistory = this.settings.launchHistory;
    this.settings.launchHistory = [{ date: new Date().toISOString(), success }, ...previousHistory].slice(0, MAX_HISTORY);
    try {
      await this.save();
    } catch (error) {
      this.settings.launchHistory = previousHistory;
      throw error;
    }
    return this.getPublicSettings().launchHistory;
  }

  async reset() {
    const previousSettings = this.settings;
    const previousWarning = this.loadWarning;
    this.settings = { ...DEFAULT_SETTINGS, launchHistory: [] };
    this.loadWarning = "";
    try {
      await this.save();
    } catch (error) {
      this.settings = previousSettings;
      this.loadWarning = previousWarning;
      throw error;
    }
    return this.getPublicSettings();
  }
}

module.exports = { DEFAULT_SETTINGS, SettingsStore };
