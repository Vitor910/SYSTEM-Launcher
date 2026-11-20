(function () {
  const editor = document.getElementById("code-editor");
  const lineNumbers = document.getElementById("line-numbers");
  const highlight = document.getElementById("code-highlight");
  const result = document.getElementById("code-result");
  const examples = {
    hello: '-- Primeiro exemplo do SAGA\nlocal mensagem = "Olá, mundo!"\n\nprint(mensagem)\n\n-- Experimente editar este código.',
    variable: '-- Variáveis em Luau\nlocal nome = "Vitin"\nlocal pontos = 100\nlocal ativo = true\n\nprint(nome, pontos, ativo)',
    function: '-- Criando uma função\nlocal function cumprimentar(nome)\n    print("Olá, " .. nome .. "!")\nend\n\ncumprimentar("Jogador")',
    loop: '-- Repetição com for\nfor numero = 1, 5 do\n    print("Número:", numero)\nend'
  };
  const tokenPattern = /(?:--.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:and|break|do|else|elseif|end|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b|\b\d+(?:\.\d+)?\b)/gm;

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function updateEditor() {
    const lines = editor.value.split("\n");
    lineNumbers.textContent = lines.map((_, index) => index + 1).join("\n");
    let position = 0;
    let output = "";
    for (const match of editor.value.matchAll(tokenPattern)) {
      const [token] = match;
      const offset = match.index;
      output += escapeHtml(editor.value.slice(position, offset));
      position = offset + token.length;
      const escapedToken = escapeHtml(token);
      let kind = "number";
      if (token.startsWith("--")) kind = "comment";
      else if (token.startsWith('"') || token.startsWith("'")) kind = "string";
      else if (/^[A-Za-z]/.test(token)) kind = "keyword";
      output += `<span class="syntax-${kind}">${escapedToken}</span>`;
    }
    highlight.innerHTML = output + escapeHtml(editor.value.slice(position)) + (editor.value.endsWith("\n") ? " " : "");
  }

  function updateResult(message, kind = "result-muted") {
    result.textContent = message;
    result.className = kind;
  }

  editor.addEventListener("input", updateEditor);
  editor.addEventListener("scroll", () => {
    highlight.scrollTop = editor.scrollTop;
    highlight.scrollLeft = editor.scrollLeft;
    lineNumbers.scrollTop = editor.scrollTop;
  });
  document.getElementById("example-select").addEventListener("change", (event) => {
    editor.value = examples[event.target.value];
    updateEditor();
    updateResult("Exemplo carregado. A análise é local e simplificada.");
  });
  document.getElementById("check-code").addEventListener("click", () => {
    const code = editor.value;
    const issues = [];
    if ((code.match(/\b(function|then|do)\b/g) || []).length > (code.match(/\bend\b/g) || []).length) {
      issues.push("Possível bloco function/then/do sem end.");
    }
    if ((code.match(/\brepeat\b/g) || []).length > (code.match(/\buntil\b/g) || []).length) {
      issues.push("Possível bloco repeat sem until.");
    }
    if ((code.match(/\(/g) || []).length !== (code.match(/\)/g) || []).length) {
      issues.push("Quantidade de parênteses de abertura e fechamento diferente.");
    }
    if (/\blocal\s*=/.test(code)) issues.push("Declaração local sem nome de variável.");
    updateResult(
      issues.length ? `Atenção: ${issues.join(" ")}` : "Nenhum problema básico detectado. Isto não substitui luau-analyze.",
      issues.length ? "result-warn" : "result-good"
    );
  });
  document.getElementById("format-code").addEventListener("click", () => {
    let indent = 0;
    editor.value = editor.value.split("\n").map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const closesLine = /^(end\b|until\b|else\b|elseif\b)/.test(trimmed);
      const lineIndent = Math.max(0, indent - (closesLine ? 1 : 0));
      const formatted = `${"    ".repeat(lineIndent)}${trimmed}`;
      if (!trimmed.startsWith("--")) {
        const opens = (trimmed.match(/\b(function|then|do|repeat)\b/g) || []).length;
        const closes = (trimmed.match(/\b(end|until)\b/g) || []).length;
        indent = Math.max(0, indent + opens - closes);
      }
      return formatted;
    }).join("\n");
    updateEditor();
    updateResult("Formatação simples aplicada; revise o resultado.");
  });
  document.getElementById("copy-code").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(editor.value);
      window.dispatchEvent(new CustomEvent("saga:toast", { detail: { message: "Código copiado." } }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent("saga:toast", {
        detail: { message: `Não foi possível copiar: ${error.message}`, error: true }
      }));
    }
  });
  document.getElementById("clear-code").addEventListener("click", () => {
    editor.value = "";
    updateEditor();
    updateResult("Editor limpo.");
  });
  document.getElementById("explain-code").addEventListener("click", () => {
    const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd).trim();
    if (!selected) {
      updateResult("Selecione um trecho de código para receber uma explicação.");
      return;
    }
    const explanation = selected.startsWith("--")
      ? "Comentário: texto iniciado por -- não é executado pelo Luau."
      : /\blocal function\b/.test(selected)
        ? "Declara uma função local, acessível no escopo em que foi criada."
        : /\bfor\b/.test(selected)
          ? "Laço for: repete um bloco para percorrer números ou valores de uma coleção."
          : /\bif\b/.test(selected)
            ? "Condicional if: executa o bloco quando a condição avalia como verdadeira."
            : /\bprint\s*\(/.test(selected)
              ? "print envia valores à saída de depuração do ambiente Luau; aqui o código não é executado."
              : "Trecho selecionado. O SAGA não executa código; consulte a documentação oficial do Luau para detalhes semânticos.";
    updateResult(explanation);
  });
  updateEditor();
})();
