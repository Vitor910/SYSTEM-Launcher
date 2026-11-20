const fs = require("node:fs/promises");
const path = require("node:path");

const WINDOWS_VERSIONS_PATH = path.join(
  process.env.LOCALAPPDATA || "",
  "Roblox",
  "Versions"
);

async function findRobloxInstallation(versionsPath = WINDOWS_VERSIONS_PATH) {
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA) {
    return { installed: false, executablePath: null, build: null };
  }

  let entries;
  try {
    entries = await fs.readdir(versionsPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return { installed: false, executablePath: null, build: null };
    }
    throw error;
  }

  const candidates = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("version-"))
    .map(async (entry) => {
      const executablePath = path.join(versionsPath, entry.name, "RobloxPlayerBeta.exe");
      try {
        const stats = await fs.stat(executablePath);
        return { executablePath, build: entry.name, modifiedAt: stats.mtimeMs };
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        return null;
      }
    }));

  const installation = candidates
    .filter(Boolean)
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0];

  return installation
    ? { installed: true, executablePath: installation.executablePath, build: installation.build }
    : { installed: false, executablePath: null, build: null };
}

async function launchRoblox(shell, versionsPath = WINDOWS_VERSIONS_PATH) {
  const installation = await findRobloxInstallation(versionsPath);
  if (!installation.installed) {
    throw new Error("Roblox não foi encontrado. Instale o aplicativo pelo site oficial e tente novamente.");
  }

  try {
    await shell.openExternal("roblox-player:1+launchmode:app");
  } catch (error) {
    throw new Error(`Não foi possível abrir o Roblox pelo protocolo oficial: ${error.message}`);
  }

  return installation;
}

module.exports = { findRobloxInstallation, launchRoblox };
