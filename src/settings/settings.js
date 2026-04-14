(async function() {
  const config = await window.brainrot.getConfig();

  // ── Elements ──
  const hotkeyBtn = document.getElementById('hotkey-btn');
  const startupToggle = document.getElementById('startup-toggle');
  const qualitySelect = document.getElementById('quality-select');
  const positionSelect = document.getElementById('position-select');
  const widthSlider = document.getElementById('width-slider');
  const widthLabel = document.getElementById('width-label');
  const hotkeyModal = document.getElementById('hotkey-modal');
  const hotkeyPreview = document.getElementById('hotkey-preview');

  // ── Populate current values ──
  function formatHotkey(hotkey) {
    return hotkey
      .replace('CommandOrControl', 'Ctrl')
      .replace(/\+/g, ' + ');
  }

  hotkeyBtn.textContent = formatHotkey(config.hotkey || 'CommandOrControl+Shift+B');
  startupToggle.checked = config.launchOnStartup !== false;
  qualitySelect.value = config.videoQuality || '720p';
  positionSelect.value = config.overlayPosition || 'right';
  widthSlider.value = config.overlayWidth || 25;
  widthLabel.textContent = `${widthSlider.value}% of screen`;

  // ── Event handlers ──

  startupToggle.addEventListener('change', () => {
    window.brainrot.setConfig({ launchOnStartup: startupToggle.checked });
  });

  qualitySelect.addEventListener('change', () => {
    window.brainrot.setConfig({ videoQuality: qualitySelect.value });
  });

  positionSelect.addEventListener('change', () => {
    window.brainrot.setConfig({ overlayPosition: positionSelect.value });
  });

  widthSlider.addEventListener('input', () => {
    widthLabel.textContent = `${widthSlider.value}% of screen`;
  });

  widthSlider.addEventListener('change', () => {
    window.brainrot.setConfig({ overlayWidth: parseInt(widthSlider.value, 10) });
  });

  // ── Hotkey Recording ──
  let isRecording = false;

  hotkeyBtn.addEventListener('click', () => {
    isRecording = true;
    hotkeyModal.classList.remove('hidden');
    hotkeyPreview.textContent = '';
  });

  document.addEventListener('keydown', (e) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    // Escape cancels
    if (e.key === 'Escape') {
      isRecording = false;
      hotkeyModal.classList.add('hidden');
      return;
    }

    // Build the hotkey string
    const parts = [];
    if (e.ctrlKey) parts.push('CommandOrControl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    // Only register if at least one modifier is held + a non-modifier key
    const key = e.key;
    const isModifier = ['Control', 'Alt', 'Shift', 'Meta'].includes(key);

    if (isModifier) {
      hotkeyPreview.textContent = parts.join(' + ') + ' + ...';
      return;
    }

    // Normalize key name
    const keyName = key.length === 1 ? key.toUpperCase() : key;
    parts.push(keyName);

    if (parts.length < 2) {
      // Need at least one modifier
      hotkeyPreview.textContent = 'Add a modifier (Ctrl, Alt, Shift)';
      return;
    }

    const hotkey = parts.join('+');
    hotkeyPreview.textContent = formatHotkey(hotkey);

    // Save after brief delay for visual feedback
    setTimeout(() => {
      window.brainrot.setConfig({ hotkey });
      hotkeyBtn.textContent = formatHotkey(hotkey);
      isRecording = false;
      hotkeyModal.classList.add('hidden');
    }, 400);
  });
})();
