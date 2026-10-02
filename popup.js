document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const ratingCards = document.querySelectorAll('.radio-card');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const presetList = document.getElementById('presetList');
  const newPresetInput = document.getElementById('newPresetInput');
  const addPresetBtn = document.getElementById('addPresetBtn');
  const customCommentText = document.getElementById('customCommentText');
  const fillOptionsToggle = document.getElementById('fillOptionsToggle');
  const fillCommentsToggle = document.getElementById('fillCommentsToggle');
  const autoSubmitToggle = document.getElementById('autoSubmitToggle');
  const fillBtn = document.getElementById('fillBtn');
  const statusText = document.getElementById('statusText');

  let currentSettings = {
    ratingMode: 'excellent',
    commentMode: 'preset',
    customComment: '',
    presetComments: [],
    fillOptions: true,
    fillComments: true,
    autoSubmit: false
  };

  // 1. Load initial settings from chrome.storage
  chrome.storage.local.get(['ratingMode', 'commentMode', 'customComment', 'presetComments', 'fillOptions', 'fillComments', 'autoSubmit'], (res) => {
    if (res.ratingMode) currentSettings.ratingMode = res.ratingMode;
    if (res.commentMode) currentSettings.commentMode = res.commentMode;
    if (res.customComment !== undefined) currentSettings.customComment = res.customComment;
    if (res.presetComments) currentSettings.presetComments = res.presetComments;
    if (res.fillOptions !== undefined) currentSettings.fillOptions = res.fillOptions;
    if (res.fillComments !== undefined) currentSettings.fillComments = res.fillComments;
    if (res.autoSubmit !== undefined) currentSettings.autoSubmit = res.autoSubmit;

    updateUIState();
  });

  function updateUIState() {
    // Select correct rating radio card
    ratingCards.forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio.value === currentSettings.ratingMode) {
        card.classList.add('selected');
        radio.checked = true;
      } else {
        card.classList.remove('selected');
        radio.checked = false;
      }
    });

    // Active Tab
    tabBtns.forEach(btn => {
      if (btn.dataset.tab === currentSettings.commentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    tabPanels.forEach(panel => {
      if (panel.id === `panel-${currentSettings.commentMode}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Textarea content
    customCommentText.value = currentSettings.customComment;

    // Toggle switches
    fillOptionsToggle.checked = currentSettings.fillOptions;
    fillCommentsToggle.checked = currentSettings.fillComments;
    autoSubmitToggle.checked = currentSettings.autoSubmit;

    // Render presets list
    renderPresets();
  }

  // 2. Rating card selection
  ratingCards.forEach(card => {
    card.addEventListener('click', () => {
      const value = card.dataset.value;
      currentSettings.ratingMode = value;
      ratingCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input').checked = true;
      saveSettings();
    });
  });

  // 3. Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      currentSettings.commentMode = tabName;
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabPanels.forEach(p => {
        p.classList.toggle('active', p.id === `panel-${tabName}`);
      });
      saveSettings();
    });
  });

  // 4. Custom comment change
  customCommentText.addEventListener('input', () => {
    currentSettings.customComment = customCommentText.value;
    saveSettings();
  });

  // 5. Toggles
  fillOptionsToggle.addEventListener('change', () => {
    currentSettings.fillOptions = fillOptionsToggle.checked;
    saveSettings();
  });

  fillCommentsToggle.addEventListener('change', () => {
    currentSettings.fillComments = fillCommentsToggle.checked;
    saveSettings();
  });

  autoSubmitToggle.addEventListener('change', () => {
    currentSettings.autoSubmit = autoSubmitToggle.checked;
    saveSettings();
  });

  // 6. Presets Rendering & Adding/Deleting
  function renderPresets() {
    presetList.innerHTML = '';
    const presets = currentSettings.presetComments || [];
    
    document.querySelector('.preset-count-badge').textContent = `${presets.length} Presets`;

    presets.forEach((preset, index) => {
      const item = document.createElement('div');
      item.className = 'preset-item';

      const textSpan = document.createElement('span');
      textSpan.textContent = preset;
      textSpan.title = preset;

      const delBtn = document.createElement('button');
      delBtn.className = 'preset-delete';
      delBtn.innerHTML = '&times;';
      delBtn.addEventListener('click', () => {
        deletePreset(index);
      });

      item.appendChild(textSpan);
      item.appendChild(delBtn);
      presetList.appendChild(item);
    });
  }

  addPresetBtn.addEventListener('click', addPreset);
  newPresetInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addPreset();
  });

  function addPreset() {
    const val = newPresetInput.value.trim();
    if (!val) return;

    if (!currentSettings.presetComments) currentSettings.presetComments = [];
    currentSettings.presetComments.push(val);
    newPresetInput.value = '';
    renderPresets();
    saveSettings();
  }

  function deletePreset(index) {
    currentSettings.presetComments.splice(index, 1);
    renderPresets();
    saveSettings();
  }

  function saveSettings() {
    chrome.storage.local.set(currentSettings);
  }

  // 7. Execute Autofill on Active Tab
  fillBtn.addEventListener('click', async () => {
    statusText.textContent = "Scanning active feedback form...";
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        statusText.textContent = "Error: Active tab not found.";
        return;
      }

      // Send message to content script
      chrome.tabs.sendMessage(tab.id, {
        action: "START_AUTOFILL",
        settings: currentSettings
      }, (response) => {
        if (chrome.runtime.lastError) {
          // If content script not injected yet, inject programmatically
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }, () => {
            chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ['content.css']
            }, () => {
              chrome.tabs.sendMessage(tab.id, {
                action: "START_AUTOFILL",
                settings: currentSettings
              }, (res) => {
                handleResponse(res);
              });
            });
          });
        } else {
          handleResponse(response);
        }
      });
    } catch (err) {
      statusText.textContent = "Error: " + err.message;
    }
  });

  function handleResponse(response) {
    if (response && response.success) {
      const { radioCount, selectCount, commentCount } = response.stats;
      statusText.textContent = `Done! Filled ${radioCount} radios, ${selectCount} dropdowns & ${commentCount} comments.`;
    } else {
      statusText.textContent = "Autofill complete.";
    }
  }
});
