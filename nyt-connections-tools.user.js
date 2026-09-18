// ==UserScript==
// @name         NYT Connections → Categories Puzzle Assistant
// @namespace    local
// @version      0.4.1
// @description  Send NYT Connections words to your Categories Puzzle Assistant GPT with a confirmation modal
// @match        https://www.nytimes.com/games/connections*
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/nyt-connections-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/nyt-connections-tools.user.js
// ==/UserScript==

(function () {
  'use strict';

  const APP_VERSION = '0.4.1';

  const GPT_URL =
    'https://chatgpt.com/g/g-aRlmdi0S7-categories-puzzle-assistant';

  function getWords() {
    const root = document.querySelector('#pz-game-root');
    if (!root) return [];

    let words = [...root.querySelectorAll(
      'input[data-testid="card-input"]'
    )]
      .map(el => el.value || el.getAttribute('aria-label'))
      .map(word => word?.trim())
      .filter(Boolean);

    if (!words.length) {
      words = [...root.querySelectorAll(
        '[data-testid="card-label"][data-flip-id]'
      )]
        .map(el => el.getAttribute('data-flip-id'))
        .map(word => word?.trim())
        .filter(Boolean);
    }

    return [...new Set(words)];
  }

  function getSelectedWords() {
    const root = document.querySelector('#pz-game-root');
    if (!root) return [];

    return [...root.querySelectorAll(
      'input[data-testid="card-input"]:checked'
    )]
      .map(el => el.value || el.getAttribute('aria-label'))
      .map(word => word?.trim())
      .filter(Boolean);
  }

  function buildPrompt(mode, words) {
    switch (mode) {
      case 'reverse':
        return [
          'Use Reverse Rainbow mode for this Connections puzzle.',
          '',
          ...words
        ].join('\n');

      case 'selected':
        return [
          'Analyze these selected words from my Connections puzzle. Do not assume they form a correct category; help me evaluate whether they belong together.',
          '',
          ...words
        ].join('\n');

      default:
        return [
          'Solve this Connections puzzle. Show your reasoning and propose the four groups with difficulty colors.',
          '',
          ...words
        ].join('\n');
    }
  }

  function getModeTitle(mode) {
    switch (mode) {
      case 'reverse':
        return 'Reverse Rainbow';
      case 'selected':
        return 'Ask About Selected Words';
      default:
        return 'Ask Categories Puzzle Assistant';
    }
  }

  function showConfirmationModal(mode) {
    const words =
      mode === 'selected'
        ? getSelectedWords()
        : getWords();

    if (!words.length) {
      alert(
        mode === 'selected'
          ? 'No Connections tiles are currently selected.'
          : 'Could not find the Connections puzzle words.'
      );
      return;
    }

    removeExistingModal();

    const overlay = document.createElement('div');
    overlay.id = 'categories-gpt-modal-overlay';

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999999',
      background: 'rgba(0, 0, 0, 0.55)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '70px 20px 20px',
      overflowY: 'auto'
    });

    const modal = document.createElement('div');

    Object.assign(modal.style, {
      width: 'min(680px, 96vw)',
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
      background: '#ffffff',
      color: '#111111',
      borderRadius: '16px',
      boxShadow: '0 18px 60px rgba(0,0,0,.35)',
      padding: '24px',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
    });

    const title = document.createElement('h2');
    title.textContent = getModeTitle(mode);

    Object.assign(title.style, {
      margin: '0 0 10px',
      fontSize: '24px',
      lineHeight: '1.2'
    });

    const intro = document.createElement('p');
    intro.textContent =
      mode === 'selected'
        ? 'The script captured ' + words.length + ' selected word' + (words.length === 1 ? '' : 's') + ' from the Connections board.'
        : 'The script captured ' + words.length + ' word' + (words.length === 1 ? '' : 's') + ' from the current Connections board.';

    Object.assign(intro.style, {
      margin: '0 0 16px',
      fontSize: '15px',
      lineHeight: '1.5',
      color: '#444'
    });

    const wordHeading = document.createElement('div');
    wordHeading.textContent = 'Captured words';

    Object.assign(wordHeading.style, {
      fontWeight: '700',
      marginBottom: '8px',
      fontSize: '14px'
    });

    const wordGrid = document.createElement('div');

    Object.assign(wordGrid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: '8px',
      marginBottom: '20px'
    });

    words.forEach(word => {
      const chip = document.createElement('div');
      chip.textContent = word;

      Object.assign(chip.style, {
        padding: '10px 6px',
        borderRadius: '8px',
        background: '#efefe8',
        textAlign: 'center',
        fontWeight: '700',
        fontSize: '13px',
        overflowWrap: 'anywhere'
      });

      wordGrid.appendChild(chip);
    });

    const instructionsBox = document.createElement('div');

    Object.assign(instructionsBox.style, {
      background: '#f5f5f5',
      border: '1px solid #dddddd',
      borderRadius: '10px',
      padding: '14px 16px',
      marginBottom: '20px'
    });

    const instructionsTitle = document.createElement('div');
    instructionsTitle.textContent = 'What happens next';

    Object.assign(instructionsTitle.style, {
      fontWeight: '700',
      marginBottom: '8px'
    });

    const instructions = document.createElement('ol');

    Object.assign(instructions.style, {
      margin: '0',
      paddingLeft: '20px',
      lineHeight: '1.6',
      fontSize: '14px'
    });

    [
      'Click “Continue to Custom GPT” below.',
      'The puzzle prompt will be copied to your clipboard.',
      'The Categories Puzzle Assistant will open in a new tab.',
      'Paste the copied prompt into ChatGPT using Ctrl+V on Windows/Linux or Cmd+V on Mac.',
      'Press Enter or click Send.'
    ].forEach(text => {
      const item = document.createElement('li');
      item.textContent = text;
      instructions.appendChild(item);
    });

    instructionsBox.append(
      instructionsTitle,
      instructions
    );

    const buttonRow = document.createElement('div');

    Object.assign(buttonRow.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      flexWrap: 'wrap'
    });

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';

    Object.assign(cancelButton.style, {
      padding: '10px 16px',
      borderRadius: '999px',
      border: '1px solid #777',
      background: '#fff',
      color: '#111',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '14px'
    });

    cancelButton.addEventListener('click', () => {
      overlay.remove();
    });

    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.textContent = 'Continue to Custom GPT';

    Object.assign(continueButton.style, {
      padding: '10px 18px',
      borderRadius: '999px',
      border: '1px solid #111',
      background: '#111',
      color: '#fff',
      cursor: 'pointer',
      fontWeight: '700',
      fontSize: '14px'
    });

    continueButton.addEventListener('click', () => {
      const prompt = buildPrompt(mode, words);

      GM_setClipboard(prompt);

      overlay.remove();

      showToast(
        'Prompt copied. Paste it into the Categories Puzzle Assistant.'
      );

      GM_openInTab(GPT_URL, {
        active: true,
        insert: true
      });
    });

    buttonRow.append(
      cancelButton,
      continueButton
    );

    const footerRow = document.createElement('div');

    Object.assign(footerRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: '12px',
      marginTop: '2px'
    });

    const versionLabel = document.createElement('div');
    versionLabel.textContent = 'v' + APP_VERSION;

    Object.assign(versionLabel.style, {
      color: '#888',
      fontSize: '11px',
      lineHeight: '1',
      userSelect: 'none'
    });

    footerRow.append(
      versionLabel,
      buttonRow
    );

    modal.append(
      title,
      intro,
      wordHeading,
      wordGrid,
      instructionsBox,
      footerRow
    );

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

    const escapeHandler = event => {
      if (event.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escapeHandler);
      }
    };

    document.addEventListener('keydown', escapeHandler);
  }

  function removeExistingModal() {
    document
      .querySelector('#categories-gpt-modal-overlay')
      ?.remove();
  }

  function showToast(message) {
    let toast =
      document.querySelector('#categories-gpt-toast');

    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'categories-gpt-toast';

      Object.assign(toast.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: '99999999',
        padding: '11px 15px',
        borderRadius: '8px',
        background: '#111',
        color: '#fff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
        fontSize: '14px',
        boxShadow: '0 3px 12px rgba(0,0,0,.25)',
        opacity: '0',
        transition: 'opacity .2s ease'
      });

      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';

    clearTimeout(toast._hideTimer);

    toast._hideTimer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 3000);
  }

  function makeButton(text, handler) {
    const button = document.createElement('button');

    button.textContent = text;
    button.type = 'button';

    Object.assign(button.style, {
      padding: '9px 14px',
      border: '1px solid #666',
      borderRadius: '999px',
      background: '#fff',
      color: '#111',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '14px',
      lineHeight: '1.2'
    });

    button.addEventListener('mouseenter', () => {
      button.style.background = '#f2f2f2';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#fff';
    });

    button.addEventListener('click', handler);

    return button;
  }

  function addToolbar() {
    if (
      document.querySelector('#categories-gpt-tools')
    ) {
      return;
    }

    const root =
      document.querySelector('#pz-game-root');

    if (!root) return;

    const words = getWords();

    if (words.length < 4) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'categories-gpt-tools';

    Object.assign(toolbar.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      justifyContent: 'center',
      alignItems: 'center',
      margin: '10px auto 16px',
      padding: '8px'
    });

    const solveButton = makeButton(
      'Ask GPT',
      () => showConfirmationModal('normal')
    );

    const reverseButton = makeButton(
      'Reverse Rainbow',
      () => showConfirmationModal('reverse')
    );

    const selectedButton = makeButton(
      'Ask About Selected',
      () => showConfirmationModal('selected')
    );

    toolbar.append(
      solveButton,
      reverseButton,
      selectedButton
    );

    root.prepend(toolbar);
  }

  const observer = new MutationObserver(() => {
    addToolbar();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  addToolbar();
})();
