const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

function getPipePaths() {
  if (process.platform === "win32") {
    return Array.from({ length: 10 }, (_, index) => `\\\\?\\pipe\\discord-ipc-${index}`);
  }
  const runtimeDirectory = process.env.XDG_RUNTIME_DIR || os.tmpdir();
  return Array.from({ length: 10 }, (_, index) => path.join(runtimeDirectory, `discord-ipc-${index}`));
}

function writeFrame(socket, opcode, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const header = Buffer.alloc(8);
  header.writeInt32LE(opcode, 0);
  header.writeInt32LE(body.length, 4);
  socket.write(Buffer.concat([header, body]));
}

async function setDiscordPresence(clientId, enabled) {
  if (!/^\d{17,20}$/.test(clientId)) {
    throw new Error("Informe o ID válido de um aplicativo criado no Discord Developer Portal.");
  }

  for (const pipePath of getPipePaths()) {
    let responseError;
    const connected = await new Promise((resolve) => {
      const socket = net.createConnection(pipePath);
      let settled = false;
      let responseBuffer = Buffer.alloc(0);
      let handshaken = false;
      const settle = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      socket.setTimeout(3000);
      socket.once("connect", () => writeFrame(socket, 0, {
        v: 1,
        client_id: clientId
      }));
      socket.on("data", (chunk) => {
        responseBuffer = Buffer.concat([responseBuffer, chunk]);
        while (responseBuffer.length >= 8) {
          const opcode = responseBuffer.readInt32LE(0);
          const length = responseBuffer.readInt32LE(4);
          if (responseBuffer.length < 8 + length) return;
          let payload;
          try {
            payload = JSON.parse(responseBuffer.subarray(8, 8 + length).toString("utf8"));
          } catch {
            socket.destroy();
            settle(false);
            return;
          }
          responseBuffer = responseBuffer.subarray(8 + length);

          if (opcode === 2 || payload.evt === "ERROR") {
            responseError = payload.data && payload.data.message;
            socket.destroy();
            settle(false);
            return;
          }
          if (opcode === 3) {
            writeFrame(socket, 4, payload);
            continue;
          }
          if (opcode !== 1) continue;

          if (!handshaken && payload.evt === "READY") {
            handshaken = true;
            writeFrame(socket, 1, {
              cmd: "SET_ACTIVITY",
              args: {
                pid: process.pid,
                activity: enabled
                  ? {
                    details: "Usando o SAGA Launcher",
                    state: "Preparando para jogar"
                  }
                  : null
              },
              nonce: `${Date.now()}`
            });
          } else if (handshaken && payload.cmd === "SET_ACTIVITY") {
            socket.end();
            settle(true);
          }
        }
      });
      socket.once("end", () => settle(false));
      socket.once("error", () => settle(false));
      socket.once("timeout", () => {
        socket.destroy();
        settle(false);
      });
      socket.once("close", () => settle(false));
    });

    if (connected) {
      return {
        connected: true,
        message: enabled ? "Presença enviada ao Discord." : "Presença removida do Discord."
      };
    }
    if (responseError) throw new Error(`Discord Rich Presence: ${responseError}`);
  }

  throw new Error("Discord não está aberto ou o Rich Presence local não está disponível.");
}

module.exports = { setDiscordPresence };
