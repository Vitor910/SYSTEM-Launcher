(function () {
  const controls = [...document.querySelectorAll("[data-setting]")];
  const settingNames = controls.map((control) => control.dataset.setting);

  function applySettings(settings) {
    for (const control of controls) {
      control.checked = settings[control.dataset.setting] === true;
    }
    document.documentElement.dataset.animations = settings.animations ? "on" : "off";
    window.dispatchEvent(new CustomEvent("saga:notifications", { detail: settings.notifications }));
  }

  async function loadSettings() {
    const settings = await window.saga.getSettings();
    applySettings(settings);
    if (settings.warning) {
      window.dispatchEvent(new CustomEvent("saga:toast", {
        detail: { message: settings.warning, error: true }
      }));
    }
    return settings;
  }

  for (const control of controls) {
    control.addEventListener("change", async () => {
      const { setting } = control.dataset;
      control.disabled = true;
      try {
        const settings = await window.saga.updateSetting(setting, control.checked);
        applySettings(settings);
        window.dispatchEvent(new CustomEvent("saga:toast", { detail: { message: "Preferência salva." } }));
      } catch (error) {
        control.checked = !control.checked;
        window.dispatchEvent(new CustomEvent("saga:toast", { detail: { message: error.message, error: true } }));
      } finally {
        control.disabled = false;
      }
    });
  }

  document.getElementById("reset-settings").addEventListener("click", async () => {
    if (!window.confirm("Restaurar as preferências, apagar o histórico e remover as integrações salvas (incluindo a chave do YouTube)?")) return;
    try {
      const settings = await window.saga.resetSettings();
      applySettings(settings);
      window.dispatchEvent(new CustomEvent("saga:settings-reset"));
      window.dispatchEvent(new CustomEvent("saga:toast", { detail: { message: "Preferências restauradas." } }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent("saga:toast", { detail: { message: error.message, error: true } }));
    }
  });

  window.sagaSettings = { load: loadSettings, apply: applySettings, names: settingNames };
})();
