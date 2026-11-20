(function () {
  const form = document.getElementById("assistant-form");
  const input = document.getElementById("assistant-question");
  const area = document.getElementById("chat-area");

  function addMessage(text, kind) {
    const message = document.createElement("div");
    message.className = kind === "user" ? "user-message" : "bot-message";
    if (kind !== "user") {
      const label = document.createElement("b");
      label.textContent = "SAGA IA LOCAL";
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      message.append(label, paragraph);
    } else {
      message.textContent = text;
    }
    area.append(message);
    area.scrollTop = area.scrollHeight;
  }

  async function answer(question) {
    const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/abrir configur|ir para configur/.test(text)) {
      window.dispatchEvent(new CustomEvent("saga:navigate", { detail: "settings" }));
      return "Abri a aba Configurações.";
    }
    if (/restaurar configur|restaurar padrao/.test(text)) {
      if (!window.confirm("Restaurar as preferências, apagar o histórico e remover as integrações salvas (incluindo a chave do YouTube)?")) {
        return "Restauração cancelada; suas preferências não foram alteradas.";
      }
      const settings = await window.saga.resetSettings();
      window.sagaSettings.apply(settings);
      window.dispatchEvent(new CustomEvent("saga:settings-reset"));
      return "Preferências restauradas; o histórico e as integrações salvas também foram removidos. Não alterei arquivos ou configurações do Roblox.";
    }
    if (/roblox.*(instalad|vers|encontr)|status.*roblox|esta instalado/.test(text)) {
      const status = await window.saga.getRobloxStatus();
      return status.installed
        ? `Roblox detectado no computador. Build local: ${status.build}. Use “Jogar Roblox” para abrir pelo protocolo oficial.`
        : "Não encontrei uma instalação do Roblox em %LOCALAPPDATA%\\Roblox\\Versions. Instale o aplicativo pelo site oficial.";
    }
    if (/versao.*(saga|launcher)|informac.*launcher/.test(text)) {
      const info = await window.saga.getAppInfo();
      return `SAGA Launcher ${info.version}, executando em ${info.platform}. As respostas deste assistente são locais e baseadas em regras; não uso um modelo de linguagem.`;
    }
    if (/batata|desempenho|fps|trav|lento|lag/.test(text)) {
      return "Para reduzir travamentos, diminua a qualidade gráfica nas configurações do próprio Roblox, feche aplicativos que não usa e atualize o driver gráfico pelo fabricante. O SAGA não aplica um “Modo Batata” automaticamente nem modifica configurações do jogo.";
    }
    if (/shader/.test(text)) {
      return "O SAGA não instala shaders nem altera arquivos do Roblox. Mods ou ferramentas que modificam o cliente podem violar as regras da plataforma e oferecer risco de segurança.";
    }
    if (/ajuda|comando|o que voce faz/.test(text)) {
      return "Posso abrir configurações, restaurar as preferências do launcher (com confirmação), consultar se Roblox está instalado e oferecer dicas locais de desempenho. Não consigo executar scripts, alterar o Roblox ou responder por um modelo de IA.";
    }
    return "Não encontrei uma resposta confiável para essa pergunta na base local. Posso ajudar com configurações do launcher, detecção local do Roblox e dicas gerais de desempenho; não consulto contas nem serviços externos.";
  }

  async function submit(question) {
    const value = question.trim();
    if (!value) return;
    addMessage(value, "user");
    input.value = "";
    form.querySelector("button").disabled = true;
    try {
      addMessage(await answer(value), "assistant");
    } catch (error) {
      addMessage(`Não consegui concluir essa ação: ${error.message}`, "assistant");
    } finally {
      form.querySelector("button").disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submit(input.value);
  });
  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => void submit(button.dataset.prompt));
  });
})();
