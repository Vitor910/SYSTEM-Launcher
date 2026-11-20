const fs = require("node:fs");
const path = require("node:path");
const electron = path.join(__dirname, "..", "node_modules", "electron", "dist", "electron.exe");
if (!fs.existsSync(electron)) {
  console.log("Electron ainda não foi instalado. Execute: npm install");
}
