const $ = id => document.getElementById(id);
let flags = {};
let flagFilter = "";
let refreshTimer;
let preferences = {
  refreshMs: 5000,
  accent: "#FFFFFF",
  reduceMotion: false
};
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3500);
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function bytes(n) {
  if (!Number.isFinite(n)) return "--";
  const u = ["B","KB","MB","GB","TB"]; let i=0;
  while (n >= 1024 && i < u.length-1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}
function page(name) {
  document.querySelectorAll(".page").forEach(x => x.classList.toggle("active", x.id === `page-${name}`));
  document.querySelectorAll(".nav").forEach(x => x.classList.toggle("active", x.dataset.page === name));
  const labels = {home:["Vis�o geral","OVERVIEW"],roblox:["Roblox","PLAYER CONTROL"],flags:["FastFlags","CLIENT SETTINGS"],profiles:["Perfis","CONFIGURATION PROFILES"],system:["Sistema","DIAGNOSTICS"],settings:["Personaliza��o","APP PREFERENCES"],about:["Sobre","ABOUT"]};
  $("page-title").textContent = labels[name][0]; $("crumb").textContent = labels[name][1];
}
document.querySelectorAll(".nav").forEach(x => x.addEventListener("click", () => page(x.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(x => x.addEventListener("click", () => page(x.dataset.goto)));
async function refresh() {
  try {
    const [info, status] = await Promise.all([window.saga.info(), window.saga.robloxStatus()]);
    $("roblox-state").textContent = status.installed ? (status.running ? "Em execu��o" : "Instalado") : "N�o encontrado";
    $("roblox-detail").textContent = status.running ? "Processo detectado" : "Instala��o desktop";
    $("player-tag").textContent = status.installed ? (status.running ? "EM EXECU��O" : "INSTALADO") : "N�O ENCONTRADO";
    $("roblox-path").textContent = status.versionPath || "N�o encontrada";
    $("cpu-name").textContent = info.cpu;

    const coreGrid = $("cpu-cores-grid");
    if (coreGrid && Array.isArray(info.cpuPerCore)) {
      coreGrid.innerHTML = info.cpuPerCore.map((value, index) => {
        const valid = Number.isFinite(value);
        const percent = valid ? Math.max(0, Math.min(100, value)) : 0;
        const label = valid ? `${percent.toFixed(1)}%` : "Calculando...";

        return `
          <div class="core-item">
            <div><b>Núcleo ${index + 1}</b><span>${label}</span></div>
            <div class="meter"><i style="width:${percent}%"></i></div>
          </div>
        `;
      }).join("");
    }
    const cpuCoresElement = $("cpu-cores"); if (cpuCoresElement) cpuCoresElement.textContent = `${info.cores} núcleos lógicos`;
    $("ram-total").textContent = bytes(info.memoryTotal);
    $("ram-free").textContent = `${bytes(info.memoryFree)} livres`;
    $("cpu-meter").style.width = `${info.cpuPercent ?? 0}%`;
    $("ram-meter").style.width = `${Number(info.memoryPercent || 0)}%`;
    $("cpu-percent").textContent = info.cpuPercent == null ? "Calculando..." : `${info.cpuPercent.toFixed(1)}%`;
    $("ram-percent").textContent = `${Number(info.memoryPercent || 0).toFixed(1)}%`;
    $("last-update").textContent = "Atualizado às " + new Date().toLocaleTimeString("pt-BR");
    const rows = [
      ["Vers�o do SAGA", info.version],
      ["Sistema operacional", `${info.osType} ${info.release}`],
      ["Arquitetura", info.arch],
      ["Computador", info.hostname],
      ["Processador", info.cpu],
      ["Núcleos lógicos", info.cores],
      ["Memória total", bytes(info.memoryTotal)],
      ["Memória em uso", bytes(info.memoryUsed)],
      ["Memória disponível", bytes(info.memoryFree)],
      ["Memória usada pelo SAGA", bytes(info.processMemory)],
      ["Electron", info.electronVersion],
      ["Node.js", info.nodeVersion],
      ["Roblox", status.installed ? "Instalado" : "N�o detectado"],
      ["Tempo ligado", `${Math.floor(info.uptime/3600)} h ${Math.floor((info.uptime%3600)/60)} min`]
    ];
    $("system-info").innerHTML = rows.map(([k,v]) => `<div class="system-item"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("");
  } catch (e) { toast(e.message); }
}
async function action(fn, success) { try { await fn(); toast(success); await refresh(); } catch(e) { toast(e.message || "Ocorreu um erro."); } }
$("launch").onclick = $("launch-main").onclick = () => action(() => window.saga.launchRoblox(), "Roblox iniciado.");
$("close").onclick = () => action(() => window.saga.closeRoblox(), "Roblox fechado.");
$("open-folder").onclick = () => action(() => window.saga.openRobloxFolder(), "Pasta do Roblox aberta.");
$("open-backups").onclick = () => action(() => window.saga.openBackups(), "Pasta de backups aberta.");
$("refresh").onclick = $("refresh-system").onclick = refresh;

function renderFlags() {
  const list = $("flags-list");
  const entries = Object.entries(flags).filter(([k,v]) => (k + " " + JSON.stringify(v)).toLowerCase().includes(flagFilter));
  $("flag-count").textContent = `${Object.keys(flags).length} configura��o(�es)`;
  if (!entries.length) { list.innerHTML = `<div class="empty">${Object.keys(flags).length ? "Nenhum resultado para a pesquisa." : "Nenhuma FastFlag configurada. Adicione uma chave que você já verificou."}</div>`; return; }
  list.innerHTML = "";
  for (const [key, value] of entries) {
    const row = document.createElement("div"); row.className = "flag-row";
    const k = document.createElement("input"); k.className = "field"; k.value = key; k.placeholder = "Nome da FastFlag";
    const v = document.createElement("input"); v.className = "field"; v.value = JSON.stringify(value); v.placeholder = "Valor JSON";
    const del = document.createElement("button"); del.className = "remove"; del.textContent = "×"; del.title = "Remover";
    k.addEventListener("change", () => {
      const next = k.value.trim();
      if (!next || (next !== key && Object.hasOwn(flags, next))) { toast("Nome vazio ou já existente."); k.value = key; return; }
      const val = flags[key]; delete flags[key]; flags[next] = val; renderFlags();
    });
    v.addEventListener("change", () => {
      try { flags[key] = JSON.parse(v.value); v.classList.remove("invalid"); }
      catch { v.classList.add("invalid"); toast(`Valor inválido em ${key}. Use JSON válido: true, 1 ou "texto".`); }
    });
    del.onclick = () => { delete flags[key]; renderFlags(); };
    row.append(k, v, del); list.append(row);
  }
}
$("flag-search").addEventListener("input", e => { flagFilter = e.target.value.toLowerCase(); renderFlags(); });
async function loadFlags(show = true) {
  try {
    const result = await window.saga.readFlags();
    flags = result.flags || {};
    $("flags-path").textContent = result.path || "Roblox n�o encontrado";
    if (result.error) toast(result.error); else if (show) toast(result.installed ? "Configura��es carregadas." : "Roblox n�o encontrado.");
    renderFlags();
  } catch(e) { toast(e.message); }
}
$("load-flags").onclick = () => loadFlags();
$("add-flag").onclick = () => {
  let name = "FFlagNovaConfiguracao", i = 1;
  while (Object.hasOwn(flags, name)) name = `FFlagNovaConfiguracao${i++}`;
  flags[name] = true; renderFlags();
  const inputs = $("flags-list").querySelectorAll("input"); if (inputs.length) inputs[inputs.length-2].focus();
};
$("save-flags").onclick = async () => {
  try {
    const result = await window.saga.writeFlags(flags);
    toast(`${result.count} configura��o(�es) salvas. Backup autom�tico criado.`);
    await loadFlags(false); await loadBackups();
  } catch(e) { toast(e.message); }
};
$("import-flags").onclick = async () => {
  try { const data = await window.saga.importFlags(); if (data) { flags = data; renderFlags(); toast("JSON importado. Revise antes de salvar."); } }
  catch(e) { toast("Falha ao importar: " + e.message); }
};
$("export-flags").onclick = async () => {
  try { if (await window.saga.exportFlags(flags)) toast("Configurações exportadas."); }
  catch(e) { toast(e.message); }
};
async function loadBackups() {
  try {
    const items = await window.saga.listBackups();
    $("backup-count").textContent = `${items.length} backup(s)`;
    $("backup-latest").textContent = items[0] ? `${items[0].name} — ${new Date(items[0].date).toLocaleString("pt-BR")}` : "Nenhum backup disponível";
  } catch(e) { toast(e.message); }
}
$("restore-backup").onclick = async () => {
  if (!confirm("Restaurar o backup mais recente? As configura��es atuais ser�o salvas em outro backup antes da restaura��o.")) return;
  try { const r = await window.saga.restoreBackup(); toast(`Backup restaurado: ${r.name} (${r.count} flags).`); await loadFlags(false); await loadBackups(); }
  catch(e) { toast(e.message); }
};

async function loadProfiles() {
  try {
    const profiles = await window.saga.listProfiles();
    $("profiles-list").innerHTML = profiles.length ? profiles.map(p => `<div class="profile-row"><div><b>${esc(p.name)}</b><small>${p.count} configura��o(�es) � ${p.updatedAt ? new Date(p.updatedAt).toLocaleString("pt-BR") : "Sem data"}</small></div><div class="profile-actions"><button class="btn secondary small" data-apply="${esc(p.name)}">Aplicar</button><button class="btn danger small" data-delete="${esc(p.name)}">Excluir</button></div></div>`).join("") : '<div class="empty">Nenhum perfil salvo. Crie um com as configura��es atuais.</div>';
    $("profiles-list").querySelectorAll("[data-apply]").forEach(b => b.onclick = async () => {
      if (!confirm(`Aplicar o perfil "${b.dataset.apply}" ao Roblox?`)) return;
      try { const r = await window.saga.applyProfile(b.dataset.apply); toast(`Perfil aplicado. ${r.count} configura��o(�es).`); await loadFlags(false); await loadBackups(); }
      catch(e) { toast(e.message); }
    });
    $("profiles-list").querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => {
      if (!confirm(`Excluir o perfil "${b.dataset.delete}"?`)) return;
      try { await window.saga.deleteProfile(b.dataset.delete); toast("Perfil excluído."); await loadProfiles(); }
      catch(e) { toast(e.message); }
    });
  } catch(e) { toast(e.message); }
}
$("save-profile").onclick = async () => {
  const name = $("profile-name").value.trim();
  try { const r = await window.saga.saveProfile(name, flags); $("profile-name").value = ""; toast(`Perfil "${r.name}" salvo.`); await loadProfiles(); }
  catch(e) { toast(e.message); }
};
$("refresh-profiles").onclick = loadProfiles;
function applyPreferences(value) {
  preferences = { ...preferences, ...value };
  const previousAccent = String(preferences.accent || "").toLowerCase();
  if (["purple", "#ff1744", "#9875ff"].includes(previousAccent)) {
    preferences.accent = "#FFFFFF";
  }

  const accent = /^#[0-9a-fA-F]{6}$/.test(String(preferences.accent || ""))
    ? preferences.accent.toUpperCase()
    : "#FFFFFF";

  preferences.accent = accent;

  const root = document.documentElement;
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--purple", accent);
  root.classList.toggle("reduce-motion", preferences.reduceMotion);

  $("refresh-interval").value = String(preferences.refreshMs);
  $("accent-color").value = accent;
  $("accent-hex").textContent = accent;
  $("reduce-motion").checked = preferences.reduceMotion;

  clearInterval(refreshTimer);
  refreshTimer = setInterval(refresh, preferences.refreshMs);
}

async function loadPreferences() {
  try {
    const loaded = await window.saga.getPreferences() || {};

    if (!localStorage.getItem("system-white-default-v1")) {
      loaded.accent = "#FFFFFF";
      await window.saga.savePreferences(loaded);
      localStorage.setItem("system-white-default-v1", "1");
    }

    applyPreferences(loaded);
  } catch (e) {
    toast("Erro ao carregar preferências: " + e.message);
  }
}

async function persistPreferences() {
  try {
    const saved = await window.saga.savePreferences({
      refreshMs: Number($("refresh-interval").value),
      accent: $("accent-color").value,
      reduceMotion: $("reduce-motion").checked
    });
    applyPreferences(saved);
    toast("Preferências salvas.");
  } catch (e) {
    toast(e.message);
  }
}

$("accent-color").addEventListener("input", () => {
  applyPreferences({
    ...preferences,
    accent: $("accent-color").value
  });
});

$("accent-color").addEventListener("change", persistPreferences);
$("save-preferences").onclick = persistPreferences;

$("reset-preferences").onclick = async () => {
  try {
    const saved = await window.saga.savePreferences({
      refreshMs: 5000,
      accent: "#FFFFFF",
      reduceMotion: false
    });
    applyPreferences(saved);
    toast("Branco restaurado.");
  } catch (e) {
    toast(e.message);
  }
};
(async () => {
  await loadPreferences();
  await refresh();
  await loadFlags(false);
  await loadBackups();
  await loadProfiles();
  if (!refreshTimer) refreshTimer = setInterval(refresh, preferences.refreshMs);
})();

window.addEventListener("beforeunload", () => clearInterval(refreshTimer));

// SAGA_JSON_EDITOR_V1
(() => {
  const editor = document.getElementById("saga-json-input");
  const status = document.getElementById("saga-json-status");
  const count = document.getElementById("saga-json-count");

  if (!editor || !status || !count) return;

  const fpsPreset = {
    "DebugForceMSAASamples": "0",
    "DFFlagTextureQualityOverrideEnabled": "True",
    "DFIntTextureQualityOverride": "0",
    "FIntTextureCompositorLowResFactor": "1",
    "FIntFRMMaxGrassDistance": "20",
    "FIntFRMMinGrassDistance": "5",
    "FIntRenderShadowIntensity": "0",
    "DFIntDebugFRMQualityLevelOverride": "1",
    "FIntDebugTextureManagerSkipMips": "0",
    "FFlagDebugDisableTelemetryEphemeralCounter": "True",
    "FFlagDebugDisableTelemetryEphemeralStat": "True",
    "FFlagDebugDisableTelemetryEventIngest": "True",
    "FFlagDebugDisableTelemetryPoint": "True",
    "FFlagDebugDisableTelemetryV2Counter": "True",
    "FFlagDebugDisableTelemetryV2Event": "True",
    "FFlagDebugDisableTelemetryV2Stat": "True"
  };

  function parseEditor() {
    const parsed = JSON.parse(editor.value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("O conteúdo precisa ser um objeto JSON, começando com { e terminando com }.");
    }

    const keys = Object.keys(parsed);
    if (keys.some(key => !key.trim())) {
      throw new Error("Existe uma chave vazia.");
    }

    return parsed;
  }

  function updateCount(data) {
    count.textContent = Object.keys(data).length + " flags";
  }

  function setStatus(message, valid) {
    status.textContent = message;
    status.classList.toggle("success", valid === true);
    status.classList.toggle("error", valid === false);
  }

  const originalLoadFlags = loadFlags;

  loadFlags = async function(show = true) {
    await originalLoadFlags(show);
    editor.value = JSON.stringify(flags, null, 2);
    updateCount(flags);
    setStatus("Configurações carregadas.", true);
  };

  document.getElementById("saga-json-validate").addEventListener("click", () => {
    try {
      const data = parseEditor();
      updateCount(data);
      setStatus("JSON válido. " + Object.keys(data).length + " flags encontradas.", true);
    } catch (error) {
      setStatus("JSON inválido: " + error.message, false);
    }
  });

  document.getElementById("saga-json-apply").addEventListener("click", async () => {
    let data;

    try {
      data = parseEditor();
    } catch (error) {
      setStatus("JSON inválido: " + error.message, false);
      return;
    }

    try {
      const result = await window.saga.writeFlags(data);
      flags = data;
      editor.value = JSON.stringify(data, null, 2);
      updateCount(data);
      setStatus("Configurações salvas. " + result.count + " flags.", true);
      toast("FastFlags salvas. Backup automático criado.");
      await loadBackups();
    } catch (error) {
      setStatus("Falha ao salvar: " + error.message, false);
      toast(error.message);
    }
  });

  // NORMAL: remove as configurações personalizadas.
  document.getElementById("mode-normal").addEventListener("click", async () => {
    if (!confirm("Restaurar as FastFlags padr�o? As configura��es personalizadas ser�o removidas do arquivo do Roblox.")) return;

    try {
      const result = await window.saga.writeFlags({});
      localStorage.removeItem('saga-sharders-previous-flags-v1');
      document.getElementById('mode-sharders').textContent = 'Sharders';
      flags = {};
      editor.value = "{}";
      updateCount({});
      setStatus("Configura��o padr�o restaurada.", true);
      toast("Modo Normal aplicado. Backup criado.");
      await loadBackups();
    } catch (error) {
      toast("N�o foi poss�vel restaurar: " + error.message);
    }
  });

  // FPS: aplica e salva imediatamente no arquivo do Roblox.
  document.getElementById("mode-fps").addEventListener("click", async () => {
    const button = document.getElementById("mode-fps");
    button.disabled = true;

    try {
      const result = await window.saga.writeFlags(fpsPreset);
      localStorage.removeItem('saga-sharders-previous-flags-v1');
      document.getElementById('mode-sharders').textContent = 'Sharders';

      flags = { ...fpsPreset };
      editor.value = JSON.stringify(fpsPreset, null, 2);
      updateCount(fpsPreset);

      setStatus(
        "Modo FPS salvo. " + result.count + " configurações gravadas no Roblox.",
        true
      );

      toast("Modo FPS aplicado e salvo. Abra o Roblox para testar.");
      await loadBackups();
    } catch (error) {
      setStatus("Falha ao aplicar FPS: " + error.message, false);
      toast("Erro ao aplicar FPS: " + error.message);
    } finally {
      button.disabled = false;
    }
  });

  // SYSTEM GRAPHICS LAB
  const graphicsButton = document.getElementById("mode-sharders");
  const modeButtons = document.querySelector(".mode-buttons");

  if (!graphicsButton || !modeButtons) {
    throw new Error("Elementos da p�gina Modos n�o encontrados.");
  }

  graphicsButton.textContent = "Graphics Lab";

  const graphicsStyle = document.createElement("style");
  graphicsStyle.textContent = `
    .graphics-lab { display:grid; gap:16px; margin-top:20px; }
    .graphics-header { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
    .graphics-header h2 { margin:0; font-size:23px; }
    .graphics-subtitle { color:var(--muted); font-size:12px; margin-top:6px; }
    .graphics-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .graphics-card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:19px; min-width:0; }
    .graphics-card h3 { margin:0 0 8px; font-size:15px; }
    .graphics-card p { color:var(--muted); font-size:12px; line-height:1.6; }
    .graphics-metric { font-size:25px; font-weight:800; margin:12px 0 4px; }
    .graphics-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:13px; }
    .graphics-status { color:var(--muted); font-size:11px; margin-top:12px; min-height:16px; }
    .graphics-note { border:1px solid var(--line); background:var(--panel2); padding:13px; border-radius:9px; color:var(--muted); font-size:11px; line-height:1.6; }
    .graphics-backups { display:grid; gap:7px; margin-top:12px; }
    .graphics-backup-row { padding:10px; border:1px solid var(--line); border-radius:7px; font-size:11px; overflow-wrap:anywhere; }
    .graphics-lab[hidden] { display:none !important; }
    @media(max-width:650px) { .graphics-grid { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(graphicsStyle);

  const graphicsPanel = document.createElement("section");
  graphicsPanel.className = "graphics-lab";
  graphicsPanel.hidden = true;

  graphicsPanel.innerHTML = `
    <div class="graphics-header">
      <div>
        <h2>SYSTEM GRAPHICS LAB</h2>
        <div class="graphics-subtitle">Ferramentas gráficas e diagnóstico do Roblox</div>
      </div>
      <button class="btn secondary" id="graphics-back" type="button">Voltar</button>
    </div>

    <div class="graphics-grid">
      <article class="graphics-card">
        <h3>Graphics Profiles</h3>
        <p>Consulte as configurações recomendadas para cada objetivo. A qualidade gráfica é ajustada dentro das configurações oficiais do Roblox.</p>
        <div class="graphics-actions">
          <button class="btn secondary" data-graphics-guide="performance" type="button">Performance</button>
          <button class="btn secondary" data-graphics-guide="balanced" type="button">Balanced</button>
          <button class="btn secondary" data-graphics-guide="quality" type="button">Quality</button>
        </div>
        <div class="graphics-status" id="graphics-guide-status">Selecione um perfil para ver as instruções.</div>
      </article>

      <article class="graphics-card">
        <h3>FPS & System Monitor</h3>
        <p>Dados reais disponibilizados pelo sistema operacional e pelo SAGA.</p>
        <div class="graphics-metric" id="graphics-cpu">--</div>
        <div class="graphics-subtitle">Uso da CPU</div>
        <div class="graphics-metric" id="graphics-ram">--</div>
        <div class="graphics-subtitle">Memória RAM utilizada</div>
        <div class="graphics-status" id="graphics-roblox-status">Verificando Roblox...</div>
        <div class="graphics-actions">
          <button class="btn secondary" id="graphics-refresh" type="button">Atualizar métricas</button>
        </div>
        <div class="graphics-note">FPS interno: n�o dispon�vel pela API atual do SAGA. N�o exibimos estimativas como se fossem medi��es reais.</div>
      </article>

      <article class="graphics-card">
        <h3>Visual Presets</h3>
        <p>Altere a cor de destaque da interface do SAGA. Isso n�o modifica os gr�ficos do Roblox.</p>
        <div class="graphics-actions">
          <button class="btn secondary" data-visual="purple" type="button">Purple</button>
          <button class="btn secondary" data-visual="cyan" type="button">Cyan</button>
          <button class="btn secondary" data-visual="red" type="button">Red</button>
        </div>
        <div class="graphics-status" id="graphics-visual-status">Personaliza��o local do launcher.</div>
      </article>

      <article class="graphics-card">
        <h3>Config Manager</h3>
        <p>Gerencie os backups das configurações locais do Roblox.</p>
        <div class="graphics-actions">
          <button class="btn secondary" id="graphics-list-backups" type="button">Listar backups</button>
          <button class="btn secondary" id="graphics-open-backups" type="button">Abrir pasta</button>
          <button class="btn danger" id="graphics-restore-backup" type="button">Restaurar último backup</button>
        </div>
        <div class="graphics-status" id="graphics-backup-status">Nenhuma consulta realizada.</div>
        <div class="graphics-backups" id="graphics-backups"></div>
      </article>
    </div>

    <div class="graphics-note">
      O Graphics Lab n�o injeta c�digo no Roblox, n�o instala shaders externos e n�o altera arquivos do jogo. As ferramentas dispon�veis usam as APIs locais do SAGA.
    </div>
  `;

  modeButtons.insertAdjacentElement("afterend", graphicsPanel);

  graphicsButton.addEventListener("click", () => {
    modeButtons.hidden = true;
    graphicsPanel.hidden = false;
    refreshGraphicsMetrics();
  });

  document.getElementById("graphics-back").addEventListener("click", () => {
    graphicsPanel.hidden = true;
    modeButtons.hidden = false;
  });

  async function refreshGraphicsMetrics() {
    const cpuElement = document.getElementById("graphics-cpu");
    const ramElement = document.getElementById("graphics-ram");
    const statusElement = document.getElementById("graphics-roblox-status");

    cpuElement.textContent = "Consultando...";
    ramElement.textContent = "Consultando...";

    try {
      const [info, status] = await Promise.all([
        window.saga.info(),
        window.saga.robloxStatus()
      ]);

      cpuElement.textContent = info.cpuPercent == null
        ? "Indisponível"
        : Number(info.cpuPercent).toFixed(1) + "%";

      ramElement.textContent =
        Number(info.memoryPercent || 0).toFixed(1) + "% (" +
        bytes(info.memoryUsed) + " / " + bytes(info.memoryTotal) + ")";

      statusElement.textContent = status.running
        ? "Roblox: em execu��o"
        : status.installed
          ? "Roblox: instalado, mas fechado"
          : "Roblox: n�o encontrado";
    } catch (error) {
      cpuElement.textContent = "Erro";
      ramElement.textContent = "Erro";
      statusElement.textContent = "Falha ao consultar: " + error.message;
    }
  }

  document.getElementById("graphics-refresh").addEventListener(
    "click",
    refreshGraphicsMetrics
  );

  const graphicsGuides = {
    performance: "Roblox: ESC > Settings > Graphics Mode: Manual. Reduza Graphics Quality para priorizar desempenho.",
    balanced: "Roblox: ESC > Settings > Graphics Mode: Manual. Escolha um nível intermediário de Graphics Quality.",
    quality: "Roblox: ESC > Settings > Graphics Mode: Manual. Aumente Graphics Quality para priorizar qualidade visual."
  };

  graphicsPanel.querySelectorAll("[data-graphics-guide]").forEach(button => {
    button.addEventListener("click", () => {
      document.getElementById("graphics-guide-status").textContent =
        graphicsGuides[button.dataset.graphicsGuide];
    });
  });

  const visualPresets = {
    purple: { accent: "#9875ff", glow: "#9875ff44" },
    cyan: { accent: "#36c9df", glow: "#36c9df44" },
    red: { accent: "#ef647b", glow: "#ef647b44" }
  };

  graphicsPanel.querySelectorAll("[data-visual]").forEach(button => {
    button.addEventListener("click", () => {
      const preset = visualPresets[button.dataset.visual];
      document.documentElement.style.setProperty("--accent", preset.accent);
      document.documentElement.style.setProperty("--accent-glow", preset.glow);
      document.documentElement.style.setProperty("--purple", preset.accent);

      document.getElementById("graphics-visual-status").textContent =
        "Tema " + button.dataset.visual + " aplicado ao SAGA.";
    });
  });

  async function showGraphicsBackups() {
    const status = document.getElementById("graphics-backup-status");
    const list = document.getElementById("graphics-backups");
    status.textContent = "Consultando backups...";
    list.replaceChildren();

    try {
      const backups = await window.saga.listBackups();

      if (!Array.isArray(backups) || backups.length === 0) {
        status.textContent = "Nenhum backup encontrado.";
        return;
      }

      status.textContent = backups.length + " backup(s) encontrado(s).";

      backups.forEach(backup => {
        const row = document.createElement("div");
        row.className = "graphics-backup-row";
        row.textContent = backup.name + " — " + (backup.date || "Data indisponível");
        list.appendChild(row);
      });
    } catch (error) {
      status.textContent = "Erro ao listar: " + error.message;
    }
  }

  document.getElementById("graphics-list-backups").addEventListener(
    "click",
    showGraphicsBackups
  );

  document.getElementById("graphics-open-backups").addEventListener(
    "click",
    async () => {
      try {
        await window.saga.openBackups();
        document.getElementById("graphics-backup-status").textContent =
          "Pasta de backups solicitada.";
      } catch (error) {
        document.getElementById("graphics-backup-status").textContent =
          "Erro: " + error.message;
      }
    }
  );

  document.getElementById("graphics-restore-backup").addEventListener(
    "click",
    async event => {
      const button = event.currentTarget;
      const status = document.getElementById("graphics-backup-status");

      if (!confirm("Restaurar o backup mais recente? As configura��es atuais ser�o substitu�das.")) {
        return;
      }

      button.disabled = true;
      status.textContent = "Restaurando backup...";

      try {
        await window.saga.restoreBackup();
        const current = await window.saga.readFlags();

        flags = current.flags || {};
        editor.value = JSON.stringify(flags, null, 2);
        updateCount(flags);
        setStatus("Backup restaurado.", true);

        status.textContent = "Backup restaurado com sucesso.";
        await showGraphicsBackups();
      } catch (error) {
        status.textContent = "Falha ao restaurar: " + error.message;
      } finally {
        button.disabled = false;
      }
    }
  );
    editor.addEventListener("input", () => {
    try {
      const data = parseEditor();
      updateCount(data);
      setStatus("JSON válido.", true);
    } catch {
      setStatus("JSON ainda incompleto ou inválido.", false);
    }
  });

  // Atualiza o editor com as configurações atuais.
  editor.value = JSON.stringify(flags, null, 2);
  updateCount(flags);

  // A nova p�gina precisa ser reconhecida pelo sistema de navega��o.
  const originalPage = page;

  page = function(name) {
    if (name !== "modes") {
      originalPage(name);
      return;
    }

    document.querySelectorAll(".page").forEach(element => {
      element.classList.toggle("active", element.id === "page-modes");
    });

    document.querySelectorAll(".nav").forEach(element => {
      element.classList.toggle("active", element.dataset.page === "modes");
    });

    document.getElementById("page-title").textContent = "Modos";
    document.getElementById("crumb").textContent = "CONFIGURATION MODES";
  };

  document.querySelector('[data-page="modes"]').addEventListener("click", () => page("modes"));
})();

// SAGA_EXTRA_MODULES_V1
(() => {
  const modules = [
    ["command", "Command Center", "⌂"],
    ["auditor", "FastFlag Auditor", "✓"],
    ["diff", "Config Diff", "⇄"],
    ["backups", "Backup Center", "▣"],
    ["performance", "Performance Lab", "◈"],
    ["health", "Roblox Health", "♥"],
    ["history", "Session History", "◷"],
    ["inspector", "File Inspector", "⌕"]
  ];

  const labels = {
    command: ["Command Center", "SAGA CONTROL CENTER"],
    auditor: ["FastFlag Auditor", "CONFIGURATION AUDIT"],
    diff: ["Config Diff", "CONFIGURATION COMPARISON"],
    backups: ["Backup Center", "BACKUP MANAGEMENT"],
    performance: ["Performance Lab", "SYSTEM PERFORMANCE"],
    health: ["Roblox Health", "ROBLOX DIAGNOSTICS"],
    history: ["Session History", "LOCAL ACTIVITY"],
    inspector: ["File Inspector", "CLIENT FILE INSPECTION"]
  };

  const historyKey = "saga-extra-history-v1";
  const snapshotsKey = "saga-config-snapshots-v1";

  function record(message) {
    try {
      const entries = JSON.parse(localStorage.getItem(historyKey) || "[]");
      entries.unshift({ message, date: new Date().toISOString() });
      localStorage.setItem(historyKey, JSON.stringify(entries.slice(0, 100)));
    } catch {}
  }

  function panel(title, description = "") {
    const element = document.createElement("div");
    element.className = "panel";
    const heading = document.createElement("div");
    heading.className = "panel-title";
    const h = document.createElement("h3");
    h.textContent = title;
    heading.appendChild(h);
    element.appendChild(heading);

    if (description) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = description;
      element.appendChild(p);
    }

    return element;
  }

  function button(text, callback, type = "secondary") {
    const b = document.createElement("button");
    b.className = "btn " + type;
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", callback);
    return b;
  }

  function output(parent, text) {
    const element = document.createElement("pre");
    element.className = "saga-extra-output";
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function setOutput(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function createPage(id) {
    const section = document.createElement("section");
    section.id = "page-" + id;
    section.className = "page";
    section.dataset.sagaExtra = id;
    return section;
  }

  const sidebar = document.querySelector(".sidebar");
  const sideBottom = sidebar?.querySelector(".side-bottom");
  const main = document.querySelector(".main");
  const footer = main?.querySelector("footer");

  if (!sidebar || !sideBottom || !main) {
    console.error("SAGA: estrutura principal n�o encontrada.");
    return;
  }

  const originalPage = page;

  modules.forEach(([id, name, symbol]) => {
    const nav = document.createElement("button");
    nav.className = "nav";
    nav.dataset.page = id;

    const icon = document.createElement("span");
    icon.textContent = symbol;
    nav.append(icon, document.createTextNode(" " + name));

    nav.addEventListener("click", () => page(id));
    sidebar.insertBefore(nav, sideBottom);

    const section = createPage(id);
    if (footer) main.insertBefore(section, footer);
    else main.appendChild(section);
  });

  page = function(name) {
    if (!labels[name]) {
      originalPage(name);
      return;
    }

    document.querySelectorAll(".page").forEach(element => {
      element.classList.toggle("active", element.id === "page-" + name);
    });

    document.querySelectorAll(".nav").forEach(element => {
      element.classList.toggle("active", element.dataset.page === name);
    });

    $("page-title").textContent = labels[name][0];
    $("crumb").textContent = labels[name][1];
  };

  document.querySelectorAll("[data-goto]").forEach(element => {
    element.addEventListener("click", () => page(element.dataset.goto));
  });

  // COMMAND CENTER
  {
    const root = document.getElementById("page-command");
    root.appendChild(panel(
      "Central de controle",
      "Resumo do Roblox, do computador e das configurações locais."
    ));

    const summary = panel("Estado atual");
    output(summary, "Carregando informações...");
    const result = summary.querySelector("pre");
    result.id = "saga-command-status";

    summary.appendChild(button("Atualizar central", async () => {
      try {
        const [info, roblox, config, backups, profiles] = await Promise.all([
          window.saga.info(),
          window.saga.robloxStatus(),
          window.saga.readFlags(),
          window.saga.listBackups(),
          window.saga.listProfiles()
        ]);

        result.textContent = [
          "COMPUTADOR",
          "CPU: " + info.cpu,
          "Uso de CPU: " + (info.cpuPercent ?? "Calculando") + "%",
          "RAM: " + (info.memoryPercent ?? "Calculando") + "%",
          "",
          "ROBLOX",
          "Instalado: " + (roblox.installed ? "Sim" : "N�o"),
          "Em execu��o: " + (roblox.running ? "Sim" : "N�o"),
          "",
          "CONFIGURAÇÕES",
          "FastFlags: " + Object.keys(config.flags || {}).length,
          "Backups: " + backups.length,
          "Perfis: " + profiles.length
        ].join("\n");
      } catch (error) {
        result.textContent = "Erro: " + error.message;
      }
    }, "primary"));

    root.appendChild(summary);

    const shortcuts = panel("Acesso rápido");
    [
      ["Abrir Roblox", "roblox"],
      ["Editar FastFlags", "flags"],
      ["Ver perfis", "profiles"],
      ["Ver sistema", "system"],
      ["Abrir Performance Lab", "performance"],
      ["Abrir Backup Center", "backups"]
    ].forEach(([text, target]) => {
      shortcuts.appendChild(button(text, () => page(target)));
    });

    root.appendChild(shortcuts);
  }

  // FASTFLAG AUDITOR
  {
    const root = document.getElementById("page-auditor");
    const box = panel(
      "Auditoria de configura��o",
      "Verifica formato, nomes e valores. N�o confirma a aceita��o de uma FastFlag pelo Roblox."
    );

    const result = output(box, "Clique em Executar auditoria.");
    result.id = "saga-audit-output";

    box.appendChild(button("Executar auditoria", async () => {
      try {
        const data = await window.saga.readFlags();
        const flags = data.flags || {};
        const entries = Object.entries(flags);
        const problems = [];
        const warnings = [];

        for (const [key, value] of entries) {
          if (!key.trim()) {
            problems.push("Chave vazia.");
            continue;
          }

          if (!/^(FFlag|DFFlag|FInt|DFInt|SInt|SFInt|FString|DFString|DString|String|Int|Bool)/.test(key)) {
            warnings.push(key + ": prefixo fora dos padrões comuns.");
          }

          if (typeof value !== "string") {
            warnings.push(key + ": valor n�o est� armazenado como texto.");
          }

          try {
            JSON.stringify(value);
          } catch {
            problems.push(key + ": valor n�o serializ�vel.");
          }
        }

        result.textContent = [
          "AUDITORIA CONCLUÍDA",
          "Total: " + entries.length,
          "Problemas estruturais: " + problems.length,
          "Avisos: " + warnings.length,
          "",
          "PROBLEMAS",
          ...(problems.length ? problems : ["Nenhum problema estrutural encontrado."]),
          "",
          "AVISOS",
          ...(warnings.length ? warnings : ["Nenhum aviso encontrado."]),
          "",
          "Aten��o: esta auditoria n�o consulta a allowlist oficial do Roblox."
        ].join("\n");

        record("Auditoria de FastFlags executada.");
      } catch (error) {
        result.textContent = "Falha: " + error.message;
      }
    }, "primary"));

    root.appendChild(box);
  }

  // CONFIG DIFF
  {
    const root = document.getElementById("page-diff");
    const box = panel(
      "Compara��o de configura��es",
      "Crie uma captura local e compare-a com a configura��o atual."
    );

    const result = output(box, "Nenhuma compara��o executada.");
    result.id = "saga-diff-output";

    box.appendChild(button("Salvar captura atual", async () => {
      try {
        const data = await window.saga.readFlags();
        const snapshots = JSON.parse(localStorage.getItem(snapshotsKey) || "[]");

        snapshots.unshift({
          date: new Date().toISOString(),
          flags: data.flags || {}
        });

        localStorage.setItem(snapshotsKey, JSON.stringify(snapshots.slice(0, 10)));
        result.textContent = "Captura salva. Total de capturas: " + Math.min(snapshots.length, 10);
        record("Captura de configura��o salva.");
      } catch (error) {
        result.textContent = "Erro: " + error.message;
      }
    }, "primary"));

    box.appendChild(button("Comparar com última captura", async () => {
      try {
        const snapshots = JSON.parse(localStorage.getItem(snapshotsKey) || "[]");
        if (!snapshots.length) {
          result.textContent = "Crie uma captura antes de comparar.";
          return;
        }

        const current = (await window.saga.readFlags()).flags || {};
        const previous = snapshots[0].flags || {};
        const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);

        const added = [];
        const removed = [];
        const changed = [];

        keys.forEach(key => {
          const oldExists = Object.hasOwn(previous, key);
          const newExists = Object.hasOwn(current, key);

          if (!oldExists && newExists) added.push(key);
          else if (oldExists && !newExists) removed.push(key);
          else if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) changed.push(key);
        });

        result.textContent = [
          "COMPARA��O",
          "Captura: " + new Date(snapshots[0].date).toLocaleString("pt-BR"),
          "Adicionadas: " + added.length,
          "Removidas: " + removed.length,
          "Alteradas: " + changed.length,
          "",
          "ADICIONADAS",
          ...(added.length ? added : ["Nenhuma"]),
          "",
          "REMOVIDAS",
          ...(removed.length ? removed : ["Nenhuma"]),
          "",
          "ALTERADAS",
          ...(changed.length ? changed : ["Nenhuma"])
        ].join("\n");

        record("Compara��o de configura��es executada.");
      } catch (error) {
        result.textContent = "Erro: " + error.message;
      }
    }));

    root.appendChild(box);
  }

  // BACKUP CENTER
  {
    const root = document.getElementById("page-backups");
    const box = panel(
      "Gerenciador de backups",
      "Consulte os backups disponíveis, abra a pasta ou restaure o mais recente."
    );

    const result = output(box, "Clique em atualizar.");
    result.id = "saga-backup-output";

    box.appendChild(button("Atualizar lista", async () => {
      try {
        const backups = await window.saga.listBackups();

        result.textContent = backups.length
          ? backups.map((item, index) =>
              (index + 1) + ". " + item.name + "\n   " +
              new Date(item.date).toLocaleString("pt-BR")
            ).join("\n\n")
          : "Nenhum backup encontrado.";
      } catch (error) {
        result.textContent = "Erro: " + error.message;
      }
    }, "primary"));

    box.appendChild(button("Abrir pasta de backups", async () => {
      try {
        await window.saga.openBackups();
        record("Pasta de backups aberta.");
      } catch (error) {
        result.textContent = "Erro: " + error.message;
      }
    }));

    box.appendChild(button("Restaurar backup mais recente", async () => {
      if (!confirm("Restaurar o backup mais recente?")) return;

      try {
        const response = await window.saga.restoreBackup();
        await window.saga.readFlags();
        await loadFlags(false);
        await loadBackups();

        result.textContent = "Backup restaurado: " + JSON.stringify(response);
        record("Backup mais recente restaurado.");
      } catch (error) {
        result.textContent = "Falha: " + error.message;
      }
    }, "danger"));

    root.appendChild(box);
  }

  // PERFORMANCE LAB
  {
    const root = document.getElementById("page-performance");
    const box = panel(
      "Monitor de desempenho",
      "Métricas fornecidas pelo sistema operacional e pelo SAGA."
    );

    const result = output(box, "Carregando...");
    result.id = "saga-performance-output";

    box.appendChild(button("Atualizar métricas", async () => {
      try {
        const info = await window.saga.info();

        result.textContent = [
          "PROCESSADOR",
          info.cpu,
          "Núcleos lógicos: " + info.cores,
          "Uso total: " + (info.cpuPercent ?? "Calculando") + "%",
          "",
          "MEMÓRIA",
          "Total: " + bytes(info.memoryTotal),
          "Em uso: " + bytes(info.memoryUsed),
          "Disponível: " + bytes(info.memoryFree),
          "Uso: " + (info.memoryPercent ?? "Calculando") + "%",
          "",
          "SAGA",
          "Memória do processo: " + bytes(info.processMemory)
        ].join("\n");
      } catch (error) {
        result.textContent = "Erro: " + error.message;
      }
    }, "primary"));

    root.appendChild(box);
  }

  // ROBLOX HEALTH
  {
    const root = document.getElementById("page-health");
    const box = panel(
      "Diagnóstico do Roblox",
      "Verifica instala��o, processo e arquivo de configura��o."
    );

    const result = output(box, "Clique em verificar.");
    result.id = "saga-health-output";

    box.appendChild(button("Executar diagnóstico", async () => {
      try {
        const [status, config] = await Promise.all([
          window.saga.robloxStatus(),
          window.saga.readFlags()
        ]);

        result.textContent = [
          "INSTALA��O",
          status.installed ? "Roblox encontrado." : "Roblox n�o encontrado.",
          "PROCESSO",
          status.running ? "Roblox em execu��o." : "Roblox n�o est� em execu��o.",
          "CAMINHO",
          status.versionPath || "N�o dispon�vel.",
          "",
          "CONFIGURA��O",
          config.error || "Arquivo JSON sem erro de leitura.",
          "FastFlags: " + Object.keys(config.flags || {}).length
        ].join("\n");

        record("Diagnóstico do Roblox executado.");
      } catch (error) {
        result.textContent = "Erro: " + error.message;
      }
    }, "primary"));

    root.appendChild(box);
  }

  // SESSION HISTORY
  {
    const root = document.getElementById("page-history");
    const box = panel(
      "Histórico local",
      "Registra ações realizadas nas novas ferramentas do SAGA neste computador."
    );

    const result = output(box, "Nenhuma atividade registrada.");
    result.id = "saga-history-output";

    box.appendChild(button("Atualizar histórico", () => {
      try {
        const entries = JSON.parse(localStorage.getItem(historyKey) || "[]");
        result.textContent = entries.length
          ? entries.map(item =>
              new Date(item.date).toLocaleString("pt-BR") + " — " + item.message
            ).join("\n")
          : "Nenhuma atividade registrada.";
      } catch {
        result.textContent = "N�o foi poss�vel ler o hist�rico.";
      }
    }, "primary"));

    box.appendChild(button("Limpar histórico", () => {
      if (!confirm("Apagar o histórico local do SAGA?")) return;
      localStorage.removeItem(historyKey);
      result.textContent = "Histórico limpo.";
    }, "danger"));

    root.appendChild(box);
  }

  // FILE INSPECTOR
  {
    const root = document.getElementById("page-inspector");
    const box = panel(
      "Inspe��o do ClientAppSettings",
      "Analisa o arquivo de FastFlags atualmente detectado pelo SAGA."
    );

    const result = output(box, "Clique em inspecionar.");
    result.id = "saga-inspector-output";

    box.appendChild(button("Inspecionar arquivo atual", async () => {
      try {
        const data = await window.saga.readFlags();
        const flags = data.flags || {};

        result.textContent = [
          "INSPE��O DO ARQUIVO",
          "Roblox instalado: " + (data.installed ? "Sim" : "N�o"),
          "Caminho: " + (data.path || "N�o encontrado"),
          "Erro de leitura: " + (data.error || "Nenhum"),
          "Quantidade de chaves: " + Object.keys(flags).length,
          "",
          "CHAVES",
          ...(Object.keys(flags).length
            ? Object.keys(flags).sort()
            : ["Nenhuma FastFlag encontrada."])
        ].join("\n");

        record("Inspe��o do arquivo de FastFlags executada.");
      } catch (error) {
        result.textContent = "Erro: " + error.message;
      }
    }, "primary"));

    root.appendChild(box);
  }

  // ESTILO DOS NOVOS MÓDULOS
  const style = document.createElement("style");
  style.textContent = `
    .saga-extra-output {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      max-height: 440px;
      overflow: auto;
      padding: 15px;
      margin: 14px 0;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: #0b0d15;
      color: var(--text);
      font: 12px/1.8 Consolas, monospace;
    }
    [data-saga-extra] .btn {
      margin: 5px 7px 5px 0;
    }
    [data-saga-extra] .panel {
      margin-bottom: 16px;
    }
  `;
  document.head.appendChild(style);

  record("SAGA iniciado com módulos extras.");
  console.info("SAGA: oito módulos extras carregados.");
})();


// SAGA_LANGUAGE_CLOCK_UI_V1
(() => {
  const languages = [
    ["pt-BR", "Português (Brasil)"],
    ["en-US", "English (United States)"],
    ["es-ES", "Español"],
    ["fr-FR", "Français"],
    ["de-DE", "Deutsch"],
    ["it-IT", "Italiano"],
    ["ja-JP", "æ—¥æœ¬èªž"],
    ["ko-KR", "í•œêµ­ì–´"],
    ["zh-CN", "ä¸­æ–‡ï¼ˆç®€ä½“ï¼‰"],
    ["ru-RU", "Русский"],
    ["nl-NL", "Nederlands"],
    ["hi-IN", "à¤¹à¤¿à¤¨à¥à¤¦à¥€"],
    ["ar", "Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©"],
    ["tr-TR", "Türkçe"]
  ];

  const translations = {
    "en-US": {
      "Vis�o geral": "Overview",
      "Personaliza��o": "Personalization",
      "Roblox": "Roblox",
      "FastFlags": "FastFlags",
      "Modos": "Modes",
      "Perfis": "Profiles",
      "Sistema": "System",
      "Intervalo de atualiza��o": "Refresh interval",
      "Cor principal da interface": "Interface accent color",
      "Reduzir animações": "Reduce animations",
      "Salvar preferências": "Save preferences",
      "Restaurar padr�o": "Restore defaults",
      "Informações": "Information",
      "Atualizar": "Refresh",
      "Monitoramento local": "Local monitoring",
      "Abrir Roblox": "Launch Roblox",
      "Configurar cliente": "Configure client",
      "Estado do ambiente": "Environment status",
      "Uso de CPU": "CPU usage",
      "Uso de RAM": "RAM usage",
      "Gerenciamento do Roblox": "Roblox management",
      "Iniciar Roblox": "Start Roblox",
      "Fechar Roblox": "Close Roblox",
      "Abrir pasta": "Open folder",
      "Perfis de configura��o": "Configuration profiles",
      "Informações do sistema": "System information",
      "Uso de CPU por núcleo": "CPU usage per core",
      "Sobre o SAGA": "About SAGA",
      "APP PREFERENCES": "APP PREFERENCES",
      "PLAYER CONTROL": "PLAYER CONTROL",
      "OVERVIEW": "OVERVIEW"
    },
    "es-ES": {
      "Vis�o geral": "Vista general",
      "Personaliza��o": "Personalizaci�n",
      "Roblox": "Roblox",
      "FastFlags": "FastFlags",
      "Modos": "Modos",
      "Perfis": "Perfiles",
      "Sistema": "Sistema",
      "Intervalo de atualiza��o": "Intervalo de actualizaci�n",
      "Cor principal da interface": "Color principal de la interfaz",
      "Reduzir animações": "Reducir animaciones",
      "Salvar preferências": "Guardar preferencias",
      "Restaurar padr�o": "Restaurar valores predeterminados",
      "Informações": "Información",
      "Atualizar": "Actualizar",
      "Monitoramento local": "Monitorización local",
      "Abrir Roblox": "Abrir Roblox",
      "Configurar cliente": "Configurar cliente",
      "Estado do ambiente": "Estado del entorno",
      "Uso de CPU": "Uso de CPU",
      "Uso de RAM": "Uso de RAM",
      "Gerenciamento do Roblox": "Administración de Roblox",
      "Iniciar Roblox": "Iniciar Roblox",
      "Fechar Roblox": "Cerrar Roblox",
      "Abrir pasta": "Abrir carpeta",
      "Perfis de configura��o": "Perfiles de configuraci�n",
      "Informações do sistema": "Información del sistema",
      "Uso de CPU por núcleo": "Uso de CPU por núcleo",
      "Sobre o SAGA": "Acerca de SAGA",
      "APP PREFERENCES": "PREFERENCIAS",
      "PLAYER CONTROL": "CONTROL DEL JUGADOR",
      "OVERVIEW": "RESUMEN"
    },
    "fr-FR": {
      "Vis�o geral": "Vue d'ensemble",
      "Personaliza��o": "Personnalisation",
      "Modos": "Modes",
      "Perfis": "Profils",
      "Sistema": "Système",
      "Intervalo de atualiza��o": "Intervalle d'actualisation",
      "Cor principal da interface": "Couleur principale de l'interface",
      "Reduzir animações": "Réduire les animations",
      "Salvar preferências": "Enregistrer les préférences",
      "Restaurar padr�o": "Restaurer les param�tres",
      "Informações": "Informations",
      "Atualizar": "Actualiser",
      "Abrir Roblox": "Ouvrir Roblox",
      "Configurar cliente": "Configurer le client",
      "Uso de CPU": "Utilisation du processeur",
      "Uso de RAM": "Utilisation de la RAM",
      "Sobre o SAGA": "À propos de SAGA"
    },
    "de-DE": {
      "Vis�o geral": "�bersicht",
      "Personaliza��o": "Personalisierung",
      "Modos": "Modi",
      "Perfis": "Profile",
      "Sistema": "System",
      "Intervalo de atualiza��o": "Aktualisierungsintervall",
      "Cor principal da interface": "Hauptfarbe der Oberfläche",
      "Reduzir animações": "Animationen reduzieren",
      "Salvar preferências": "Einstellungen speichern",
      "Restaurar padr�o": "Standards wiederherstellen",
      "Informações": "Informationen",
      "Atualizar": "Aktualisieren",
      "Abrir Roblox": "Roblox öffnen",
      "Configurar cliente": "Client konfigurieren",
      "Sobre o SAGA": "Über SAGA"
    },
    "it-IT": {
      "Vis�o geral": "Panoramica",
      "Personaliza��o": "Personalizzazione",
      "Modos": "Modalità",
      "Perfis": "Profili",
      "Sistema": "Sistema",
      "Intervalo de atualiza��o": "Intervallo di aggiornamento",
      "Cor principal da interface": "Colore principale dell'interfaccia",
      "Reduzir animações": "Riduci animazioni",
      "Salvar preferências": "Salva preferenze",
      "Restaurar padr�o": "Ripristina predefiniti",
      "Informações": "Informazioni",
      "Atualizar": "Aggiorna",
      "Abrir Roblox": "Apri Roblox",
      "Sobre o SAGA": "Informazioni su SAGA"
    },
    "ja-JP": {
      "Visão geral": "概要",
      "Personalização": "カスタマイズ",
      "Modos": "モード",
      "Perfis": "プロファイル",
      "Sistema": "システム",
      "Intervalo de atualização": "更新間隔",
      "Salvar preferências": "設定を保存",
      "Restaurar padrão": "デフォルトに戻す",
      "Informações": "情報",
      "Atualizar": "æ›´æ–°",
      "Abrir Roblox": "Robloxを開く"
    },
    "ko-KR": {
      "Visão geral": "개요",
      "Personalização": "개인 설정",
      "Modos": "ëª¨ë“œ",
      "Perfis": "í”„ë¡œí•„",
      "Sistema": "ì‹œìŠ¤í…œ",
      "Intervalo de atualização": "새로 고침 간격",
      "Salvar preferências": "설정 저장",
      "Restaurar padrão": "기본값 복원",
      "Informações": "정보",
      "Atualizar": "ìƒˆë¡œ ê³ ì¹¨",
      "Abrir Roblox": "Roblox ì‹¤í–‰"
    },
    "zh-CN": {
      "Visão geral": "概览",
      "Personalização": "个性化",
      "Modos": "æ¨¡å¼",
      "Perfis": "é…ç½®æ–‡ä»¶",
      "Sistema": "ç³»ç»Ÿ",
      "Intervalo de atualização": "刷新间隔",
      "Salvar preferências": "保存偏好设置",
      "Restaurar padrão": "恢复默认设置",
      "Informações": "信息",
      "Atualizar": "åˆ·æ–°",
      "Abrir Roblox": "å¯åŠ¨ Roblox"
    },
    "ru-RU": {
      "Visão geral": "Обзор",
      "Personalização": "Персонализация",
      "Modos": "Режимы",
      "Perfis": "Профили",
      "Sistema": "Система",
      "Intervalo de atualização": "Интервал обновления",
      "Salvar preferências": "Сохранить настройки",
      "Restaurar padrão": "Восстановить настройки",
      "Informações": "Информация",
      "Atualizar": "Обновить"
    },
    "nl-NL": {
      "Vis�o geral": "Overzicht",
      "Personaliza��o": "Personalisatie",
      "Modos": "Modi",
      "Perfis": "Profielen",
      "Sistema": "Systeem",
      "Salvar preferências": "Voorkeuren opslaan",
      "Restaurar padr�o": "Standaard herstellen",
      "Informações": "Informatie",
      "Atualizar": "Vernieuwen"
    },
    "hi-IN": {
      "Visão geral": "अवलोकन",
      "Personalização": "निजीकरण",
      "Modos": "à¤®à¥‹à¤¡",
      "Perfis": "à¤ªà¥à¤°à¥‹à¤«à¤¼à¤¾à¤‡à¤²",
      "Sistema": "à¤¸à¤¿à¤¸à¥à¤Ÿà¤®",
      "Salvar preferências": "सेटिंग सहेजें",
      "Restaurar padrão": "डिफ़ॉल्ट पुनर्स्थापित करें",
      "Informações": "जानकारी",
      "Atualizar": "à¤°à¥€à¤«à¤¼à¥à¤°à¥‡à¤¶"
    },
    "ar": {
      "Visão geral": "نظرة عامة",
      "Personalização": "التخصيص",
      "Modos": "Ø§Ù„Ø£ÙˆØ¶Ø§Ø¹",
      "Perfis": "Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ø´Ø®ØµÙŠØ©",
      "Sistema": "Ø§Ù„Ù†Ø¸Ø§Ù…",
      "Salvar preferências": "حفظ التفضيلات",
      "Restaurar padrão": "استعادة الافتراضي",
      "Informações": "معلومات",
      "Atualizar": "ØªØ­Ø¯ÙŠØ«"
    },
    "tr-TR": {
      "Visão geral": "Genel Bakış",
      "Personalização": "Kişiselleştirme",
      "Modos": "Modlar",
      "Perfis": "Profiller",
      "Sistema": "Sistem",
      "Salvar preferências": "Tercihleri kaydet",
      "Restaurar padrão": "Varsayılanı geri yükle",
      "Informações": "Bilgiler",
      "Atualizar": "Yenile"
    }
  };

  const root = document.getElementById("page-settings");
  const topActions = document.querySelector(".top-actions");

  if (!root || !topActions) {
    console.error("SAGA: �rea de personaliza��o n�o encontrada.");
    return;
  }

  const languagePanel = document.createElement("div");
  languagePanel.className = "panel";
  languagePanel.innerHTML = `
    <span class="eyebrow">LANGUAGE & REGION</span>
    <h3>Idioma e regi�o</h3>
    <p class="muted">Escolha o idioma da interface do SAGA.</p>
    <label class="setting">
      <span>Idioma da interface</span>
      <select class="field" id="saga-language"></select>
    </label>
    <p class="muted" id="saga-language-status">Idioma selecionado.</p>
  `;

  const languageSelect = languagePanel.querySelector("#saga-language");

  languages.forEach(([code, name]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    languageSelect.appendChild(option);
  });

  const clockPanel = document.createElement("div");
  clockPanel.className = "panel";
  clockPanel.innerHTML = `
    <span class="eyebrow">DATE & TIME</span>
    <h3>Data e hora</h3>
    <p class="muted">Configure o relógio exibido na barra superior.</p>
    <label class="setting">
      <span>Formato de 24 horas</span>
      <input type="checkbox" id="saga-clock-24">
    </label>
    <label class="setting">
      <span>Mostrar relógio na barra superior</span>
      <input type="checkbox" id="saga-clock-visible">
    </label>
    <div id="saga-clock-preview" class="saga-clock-preview"></div>
  `;

  root.appendChild(languagePanel);
  root.appendChild(clockPanel);

  const clock = document.createElement("div");
  clock.id = "saga-clock";
  clock.className = "saga-clock";
  clock.setAttribute("aria-live", "off");
  topActions.insertBefore(clock, topActions.firstChild);

  const clock24 = clockPanel.querySelector("#saga-clock-24");
  const clockVisible = clockPanel.querySelector("#saga-clock-visible");
  const clockPreview = clockPanel.querySelector("#saga-clock-preview");

  const originalApply = applyPreferences;

  function currentLanguage() {
    return languages.some(([code]) => code === preferences.language)
      ? preferences.language : "pt-BR";
  }

  function translateInterface() {
    const dictionary = translations[currentLanguage()] || {};

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const original = node.nodeValue;
      const trimmed = original.trim();

      if (!trimmed || !dictionary[trimmed]) return;

      const leading = original.match(/^\s*/)[0];
      const trailing = original.match(/\s*$/)[0];

      node.nodeValue = leading + dictionary[trimmed] + trailing;
    });

    document.documentElement.lang = currentLanguage();
    document.documentElement.dir =
      currentLanguage() === "ar" ? "rtl" : "ltr";
  }

  function updateClock() {
    const locale = currentLanguage();
    const now = new Date();

    const time = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: !preferences.clock24h
    }).format(now);

    const date = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(now);

    clock.textContent = time + "  |  " + date;
    clockPreview.textContent = time + " — " + date;
    clock.hidden = !preferences.showClock;
  }

  applyPreferences = function (value) {
    originalApply(value);

    preferences.language = languages.some(([code]) =>
      code === preferences.language
    ) ? preferences.language : "pt-BR";

    preferences.clock24h = preferences.clock24h !== false;
    preferences.showClock = preferences.showClock !== false;

    languageSelect.value = preferences.language;
    clock24.checked = preferences.clock24h;
    clockVisible.checked = preferences.showClock;

    translateInterface();
    updateClock();
  };

  persistPreferences = async function () {
    try {
      const saved = await window.saga.savePreferences({
        refreshMs: Number($("refresh-interval").value),
        accent: $("accent-color").value,
        reduceMotion: $("reduce-motion").checked,
        language: languageSelect.value,
        clock24h: clock24.checked,
        showClock: clockVisible.checked
      });

      applyPreferences(saved);
      toast("Preferências salvas.");
    } catch (error) {
      toast("Erro ao salvar: " + error.message);
    }
  };

  languageSelect.addEventListener("change", () => {
    preferences.language = languageSelect.value;
    translateInterface();
    updateClock();
    persistPreferences();
  });

  clock24.addEventListener("change", persistPreferences);
  clockVisible.addEventListener("change", persistPreferences);

  $("save-preferences").onclick = persistPreferences;

  $("reset-preferences").onclick = async () => {
    try {
      const saved = await window.saga.savePreferences({
        refreshMs: 5000,
        accent: "#FFFFFF",
        reduceMotion: false,
        language: "pt-BR",
        clock24h: true,
        showClock: true
      });

      applyPreferences(saved);
      toast("Preferências restauradas.");
    } catch (error) {
      toast(error.message);
    }
  };

  const observer = new MutationObserver((mutations) => {
    const hasNewElements = mutations.some(mutation =>
      mutation.type === "childList" && mutation.addedNodes.length > 0
    );

    if (hasNewElements) translateInterface();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  const timer = setInterval(updateClock, 1000);

  window.addEventListener("beforeunload", () => {
    clearInterval(timer);
    observer.disconnect();
  });

  const style = document.createElement("style");
  style.textContent = `
    .saga-clock {
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      text-align: right;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: rgba(255,255,255,.035);
      max-width: 310px;
      line-height: 1.5;
    }
    .saga-clock[hidden] {
      display: none !important;
    }
    .saga-clock-preview {
      margin-top: 14px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: #0b0d15;
      font-size: 15px;
      font-weight: 600;
    }
    #page-settings .setting {
      margin: 12px 0;
    }
    #page-settings select {
      max-width: 100%;
    }
  `;

  document.head.appendChild(style);

  applyPreferences(preferences);
  console.info("SAGA: idioma e relógio carregados.");
})();

