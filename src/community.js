(function () {
  const channelInput = document.getElementById("youtube-channel");
  const apiKeyInput = document.getElementById("youtube-api-key");
  const youtubeResult = document.getElementById("youtube-result");
  const discordInput = document.getElementById("discord-client-id");
  const discordEnabled = document.getElementById("discord-enabled");
  const discordResult = document.getElementById("discord-result");

  function showResult(element, message, isError) {
    element.textContent = message;
    element.className = `integration-result ${isError ? "result-warn" : "result-good"}`;
  }

  async function loadSettings() {
    const settings = await window.saga.getSettings();
    channelInput.value = settings.youtubeChannelId;
    discordInput.value = settings.discordClientId;
    discordEnabled.checked = settings.discordPresenceEnabled;
    apiKeyInput.placeholder = settings.hasYouTubeApiKey
      ? "Chave salva (deixe vazio para mantê-la)"
      : "Armazenada protegida pelo Windows";
  }

  document.getElementById("youtube-save").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const settings = await window.saga.saveYouTubeSettings(channelInput.value.trim(), apiKeyInput.value.trim());
      apiKeyInput.value = "";
      apiKeyInput.placeholder = settings.hasYouTubeApiKey
        ? "Chave salva (deixe vazio para mantê-la)"
        : "Armazenada protegida pelo Windows";
      showResult(youtubeResult, "Configuração salva localmente.", false);
    } catch (error) {
      showResult(youtubeResult, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("youtube-refresh").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    showResult(youtubeResult, "Consultando a YouTube Data API…", false);
    try {
      const result = await window.saga.getYouTubeStatus();
      const subscribers = result.subscriberCount
        ? ` · ${Number(result.subscriberCount).toLocaleString("pt-BR")} inscritos públicos`
        : "";
      const live = result.live
        ? `\nAO VIVO: ${result.live.title} — ${result.live.url}`
        : "\nNenhuma transmissão ao vivo pública encontrada.";
      showResult(youtubeResult, `${result.channelName}${subscribers}${live}`, false);
    } catch (error) {
      showResult(youtubeResult, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("youtube-clear-key").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const settings = await window.saga.clearYouTubeApiKey();
      apiKeyInput.value = "";
      apiKeyInput.placeholder = "Armazenada protegida pelo Windows";
      showResult(
        youtubeResult,
        settings.hasYouTubeApiKey ? "A chave não foi removida." : "Chave da API removida do armazenamento local.",
        settings.hasYouTubeApiKey
      );
    } catch (error) {
      showResult(youtubeResult, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("discord-connect").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    showResult(discordResult, "Conectando ao Discord local…", false);
    try {
      const result = await window.saga.configureDiscord(discordInput.value.trim(), discordEnabled.checked);
      showResult(discordResult, result.message, false);
    } catch (error) {
      showResult(discordResult, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  window.sagaCommunity = { load: loadSettings };
})();
