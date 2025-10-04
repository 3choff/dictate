const providerKeysContainer = document.getElementById('provider-keys');
const PROVIDERS = [
  { id: 'groq', label: 'Groq API Key', placeholder: 'Enter your Groq API key' },
  { id: 'deepgram', label: 'Deepgram API Key', placeholder: 'Enter your Deepgram API key' },
  { id: 'cartesia', label: 'Cartesia API Key', placeholder: 'Enter your Cartesia API key' },
  { id: 'gemini', label: 'Gemini API Key', placeholder: 'Enter your Gemini API key' },
  { id: 'mistral', label: 'Mistral API Key', placeholder: 'Enter your Mistral API key' },
  { id: 'sambanova', label: 'SambaNova API Key', placeholder: 'Enter your SambaNova API key' },
  { id: 'fireworks', label: 'Fireworks API Key', placeholder: 'Enter your Fireworks API key' },
];
const providerInputs = {};
const apiServiceSelect = document.getElementById('api-service');
const transcriptionLanguageSelect = document.getElementById('transcription-language');
const insertionModeSelect = document.getElementById('insertion-mode');
const preserveFormattingCheckbox = document.getElementById('preserve-formatting');
const voiceCommandsCheckbox = document.getElementById('voice-commands-enabled');
const grammarProviderSelect = document.getElementById('grammar-provider');

function createProviderKeyInputs() {
  PROVIDERS.forEach(({ id, label, placeholder }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group provider-key hidden';
    wrapper.setAttribute('data-provider', id);

    wrapper.innerHTML = `
      <label for="${id}-api-key">${label}</label>
      <div class="input-with-eye">
        <input type="password" id="${id}-api-key" placeholder="${placeholder}">
        <button class="eye-toggle" type="button" data-target="${id}-api-key" aria-label="Toggle ${label} visibility">
          <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#b0b0b0"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path fill-rule="evenodd" clip-rule="evenodd" d="M1 10c0-3.9 3.1-7 7-7s7 3.1 7 7h-1c0-3.3-2.7-6-6-6s-6 2.7-6 6H1zm4 0c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3-3-1.3-3-3zm1 0c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z"></path></g></svg>
        </button>
      </div>
    `;

    providerKeysContainer.appendChild(wrapper);
    providerInputs[id] = wrapper.querySelector('input');
  });
}

function attachEyeToggles() {
  document.querySelectorAll('.eye-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });
}

createProviderKeyInputs();

window.addEventListener('DOMContentLoaded', async () => {
  const settings = await window.electronAPI.getSettings();
  PROVIDERS.forEach(({ id }) => {
    const input = providerInputs[id];
    if (!input) return;
    const keyName = `${id}ApiKey`;
    if (id === 'groq') {
      input.value = settings[keyName] || settings.apiKey || '';
    } else {
      input.value = settings[keyName] || '';
    }
  });
  apiServiceSelect.value = settings.apiService;
  transcriptionLanguageSelect.value = settings.transcriptionLanguage || 'multilingual';
  insertionModeSelect.value = settings.insertionMode || 'clipboard';
  grammarProviderSelect.value = settings.grammarProvider || 'groq';
  preserveFormattingCheckbox.checked = settings.preserveFormatting !== false;
  voiceCommandsCheckbox.checked = settings.voiceCommandsEnabled !== false;
  attachEyeToggles();
  // Toggle provider key visibility based on selected service
  const updateKeyVisibility = () => {
    const provider = apiServiceSelect.value;
    document.querySelectorAll('.provider-key').forEach((group) => {
      if (group.getAttribute('data-provider') === provider) {
        group.classList.remove('hidden');
      } else {
        group.classList.add('hidden');
      }
    });
  };
  apiServiceSelect.addEventListener('change', updateKeyVisibility);
  updateKeyVisibility();

  requestAnimationFrame(() => {
    const rect = document.body.getBoundingClientRect();
    window.electronAPI.reportSettingsSize?.({
      width: rect.width,
      height: rect.height,
    });
  });
});

document.getElementById('close-settings-btn').addEventListener('click', () => {
  const settings = {
    apiService: apiServiceSelect.value,
    transcriptionLanguage: transcriptionLanguageSelect.value,
    insertionMode: insertionModeSelect.value,
    preserveFormatting: !!preserveFormattingCheckbox.checked,
    voiceCommandsEnabled: !!voiceCommandsCheckbox.checked,
    grammarProvider: grammarProviderSelect.value,
  };
  PROVIDERS.forEach(({ id }) => {
    const input = providerInputs[id];
    if (!input) return;
    settings[`${id}ApiKey`] = input.value;
  });
  window.electronAPI.setSettings(settings);
  window.electronAPI.closeSettingsWindow();
});

// Help button -> open issues page in default browser
const helpBtn = document.getElementById('settings-help');
if (helpBtn && window.electronAPI && typeof window.electronAPI.openExternalLink === 'function') {
  helpBtn.addEventListener('click', () => {
    window.electronAPI.openExternalLink('https://github.com/3choff/dictate/issues');
  });
}
