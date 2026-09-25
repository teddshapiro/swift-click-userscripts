// ==UserScript==
// @name         NYT Connections → Categories Puzzle Assistant
// @namespace    local
// @version      0.5.1
// @description  NYT Connections tools with direct SwiftClick AI solving plus the existing Custom GPT workflow
// @match        https://www.nytimes.com/games/connections*
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      connections-ai-service.tedd-7f4.workers.dev
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/nyt-connections-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/nyt-connections-tools.user.js
// ==/UserScript==

(function () {
  'use strict';

  const APP_VERSION = '0.5.1';

  const GPT_URL =
    'https://chatgpt.com/g/g-aRlmdi0S7-categories-puzzle-assistant';

  const AI_API_URL =
    'https://connections-ai-service.tedd-7f4.workers.dev/solve';

  const AI_TOKEN_KEY = 'swiftclick-connections-ai-token';

  const AI_COLORS = {
    yellow: '#f9df6d',
    green: '#a0c35a',
    blue: '#b0c4ef',
    purple: '#ba81c5'
  };

  const AI_COLOR_ORDER = [
    'yellow',
    'green',
    'blue',
    'purple'
  ];

  const LUNA_STANDARD_PRICING = {
    inputPerMillion: 0.10,
    cachedInputPerMillion: 0.01,
    outputPerMillion: 0.50
  };

  const aiStyledElements = new Map();
  let clearAiButton = null;
  let aiProgressOverlay = null;
  let aiProgressResizeObserver = null;

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

  function getTileEntries() {
    const root = document.querySelector('#pz-game-root');
    if (!root) return [];

    const seenWords = new Set();

    const labelEntries = [...root.querySelectorAll(
      '[data-testid="card-label"][data-flip-id]'
    )]
      .map(element => ({
        element,
        word: element.getAttribute('data-flip-id')?.trim()
      }))
      .filter(entry => {
        if (!entry.word) return false;
        if (!entry.element.getClientRects().length) return false;
        if (seenWords.has(entry.word)) return false;
        seenWords.add(entry.word);
        return true;
      });

    if (labelEntries.length) {
      return labelEntries;
    }

    return [...root.querySelectorAll(
      'input[data-testid="card-input"]'
    )]
      .map(element => ({
        element,
        word: (
          element.value ||
          element.getAttribute('aria-label') ||
          ''
        ).trim()
      }))
      .filter(entry => {
        if (!entry.word) return false;
        if (seenWords.has(entry.word)) return false;
        seenWords.add(entry.word);
        return true;
      });
  }

  function getTileHost(element) {
    return (
      element.closest('button, [role="button"], label') ||
      element.parentElement ||
      element
    );
  }

  function getCommonAncestor(elements) {
    if (!elements.length) return null;

    let ancestor = elements[0];

    while (
      ancestor &&
      !elements.every(element =>
        ancestor.contains(element)
      )
    ) {
      ancestor = ancestor.parentElement;
    }

    return ancestor;
  }

  function getBoardContainer(entries = getTileEntries()) {
    const hosts = entries
      .map(entry => getTileHost(entry.element))
      .filter(Boolean);

    if (!hosts.length) return null;

    const common = getCommonAncestor(hosts);
    const root = document.querySelector('#pz-game-root');

    if (!common || common === root) {
      return hosts[0].parentElement || common;
    }

    return common;
  }

  function ensureAiProgressStyles() {
    if (
      document.querySelector(
        '#categories-ai-progress-styles'
      )
    ) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'categories-ai-progress-styles';
    style.textContent = [
      '@keyframes swiftclick-ai-orbit {',
      '  from { stroke-dashoffset: 0; }',
      '  to { stroke-dashoffset: -112; }',
      '}',
      '@keyframes swiftclick-ai-color-cycle {',
      '  0%, 20% { color: #f9df6d; }',
      '  25%, 45% { color: #a0c35a; }',
      '  50%, 70% { color: #b0c4ef; }',
      '  75%, 95% { color: #ba81c5; }',
      '  100% { color: #f9df6d; }',
      '}',
      '#categories-ai-progress .swiftclick-ai-orbit-line {',
      '  animation: swiftclick-ai-orbit 1.05s linear infinite;',
      '}'
    ].join('\n');

    document.head.appendChild(style);
  }

  function stopAiProgress() {
    if (aiProgressResizeObserver) {
      aiProgressResizeObserver.disconnect();
      aiProgressResizeObserver = null;
    }

    window.removeEventListener(
      'scroll',
      updateAiProgressPosition,
      true
    );

    window.removeEventListener(
      'resize',
      updateAiProgressPosition
    );

    aiProgressOverlay?.remove();
    aiProgressOverlay = null;
  }

  function updateAiProgressPosition() {
    if (!aiProgressOverlay) return;

    const board =
      aiProgressOverlay._swiftclickBoard;

    if (!board?.isConnected) {
      stopAiProgress();
      return;
    }

    const rect = board.getBoundingClientRect();
    const pad = 7;

    Object.assign(aiProgressOverlay.style, {
      left: Math.round(rect.left - pad) + 'px',
      top: Math.round(rect.top - pad) + 'px',
      width:
        Math.round(rect.width + pad * 2) + 'px',
      height:
        Math.round(rect.height + pad * 2) + 'px'
    });
  }

  function startAiProgress(indexedEntries) {
    stopAiProgress();
    ensureAiProgressStyles();

    const board =
      getBoardContainer(indexedEntries);

    if (!board) return;

    const overlay = document.createElement('div');
    overlay.id = 'categories-ai-progress';
    overlay._swiftclickBoard = board;

    Object.assign(overlay.style, {
      position: 'fixed',
      zIndex: '9999990',
      pointerEvents: 'none',
      color: AI_COLORS.yellow,
      animation:
        'swiftclick-ai-color-cycle 2.8s linear infinite'
    });

    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );

    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute(
      'preserveAspectRatio',
      'none'
    );

    Object.assign(svg.style, {
      width: '100%',
      height: '100%',
      overflow: 'visible',
      display: 'block'
    });

    const base = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect'
    );

    base.setAttribute('x', '1.5');
    base.setAttribute('y', '1.5');
    base.setAttribute('width', '97');
    base.setAttribute('height', '97');
    base.setAttribute('rx', '3.5');
    base.setAttribute('ry', '3.5');
    base.setAttribute('fill', 'none');
    base.setAttribute(
      'stroke',
      'currentColor'
    );
    base.setAttribute(
      'stroke-opacity',
      '0.24'
    );
    base.setAttribute(
      'stroke-width',
      '3'
    );
    base.setAttribute(
      'vector-effect',
      'non-scaling-stroke'
    );

    const orbit = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect'
    );

    orbit.classList.add(
      'swiftclick-ai-orbit-line'
    );

    orbit.setAttribute('x', '1.5');
    orbit.setAttribute('y', '1.5');
    orbit.setAttribute('width', '97');
    orbit.setAttribute('height', '97');
    orbit.setAttribute('rx', '3.5');
    orbit.setAttribute('ry', '3.5');
    orbit.setAttribute('fill', 'none');
    orbit.setAttribute(
      'stroke',
      'currentColor'
    );
    orbit.setAttribute(
      'stroke-width',
      '4'
    );
    orbit.setAttribute(
      'stroke-linecap',
      'round'
    );
    orbit.setAttribute(
      'stroke-dasharray',
      '18 10'
    );
    orbit.setAttribute(
      'vector-effect',
      'non-scaling-stroke'
    );

    svg.append(
      base,
      orbit
    );

    overlay.appendChild(svg);
    document.body.appendChild(overlay);
    aiProgressOverlay = overlay;

    updateAiProgressPosition();

    window.addEventListener(
      'scroll',
      updateAiProgressPosition,
      true
    );

    window.addEventListener(
      'resize',
      updateAiProgressPosition
    );

    if (
      typeof ResizeObserver === 'function'
    ) {
      aiProgressResizeObserver =
        new ResizeObserver(
          updateAiProgressPosition
        );

      aiProgressResizeObserver.observe(
        board
      );
    }
  }

  function formatTokenCount(value) {
    return Number.isFinite(value)
      ? value.toLocaleString()
      : null;
  }

  function estimateLunaCost(usage) {
    if (!usage) return null;

    const input =
      Number(usage.input_tokens) || 0;

    const cached =
      Number(
        usage.input_tokens_details
          ?.cached_tokens
      ) || 0;

    const output =
      Number(usage.output_tokens) || 0;

    const uncachedInput =
      Math.max(0, input - cached);

    return (
      uncachedInput *
        LUNA_STANDARD_PRICING.inputPerMillion /
        1_000_000 +
      cached *
        LUNA_STANDARD_PRICING.cachedInputPerMillion /
        1_000_000 +
      output *
        LUNA_STANDARD_PRICING.outputPerMillion /
        1_000_000
    );
  }

  function formatEstimatedCost(cost) {
    if (!Number.isFinite(cost)) return null;

    if (cost < 0.001) {
      return '
  function getStoredAiToken() {
    return String(
      GM_getValue(AI_TOKEN_KEY, '') || ''
    ).trim();
  }

  function promptForAiToken() {
    const token = window.prompt(
      'Enter your Connections AI access token. It will be stored only in Tampermonkey on this browser.'
    );

    if (!token?.trim()) {
      return '';
    }

    const cleanToken = token.trim();
    GM_setValue(AI_TOKEN_KEY, cleanToken);
    return cleanToken;
  }

  function makeRequestId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === 'function'
    ) {
      return window.crypto.randomUUID();
    }

    return (
      'connections-' +
      Date.now() +
      '-' +
      Math.random().toString(16).slice(2)
    );
  }

  function requestAiSolution(token, indexedEntries) {
    const payload = {
      request_id: makeRequestId(),
      subject_ref: 'connections:nyt:live',
      data: {
        tiles: indexedEntries.map(entry => ({
          id: entry.id,
          word: entry.word
        }))
      }
    };

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: AI_API_URL,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(payload),
        timeout: 120000,

        onload(response) {
          let body;

          try {
            body = JSON.parse(response.responseText || '{}');
          } catch {
            const error = new Error(
              'The AI service returned an unreadable response.'
            );
            error.status = response.status;
            reject(error);
            return;
          }

          if (
            response.status >= 200 &&
            response.status < 300
          ) {
            resolve(body);
            return;
          }

          const error = new Error(
            body?.error
              ? 'AI service error: ' + body.error
              : 'AI service request failed.'
          );

          error.status = response.status;
          reject(error);
        },

        onerror() {
          reject(
            new Error(
              'Could not reach the Connections AI service.'
            )
          );
        },

        ontimeout() {
          reject(
            new Error(
              'The Connections AI request timed out.'
            )
          );
        }
      });
    });
  }

  function validateAiSolution(solution, indexedEntries) {
    if (
      !solution ||
      solution.ok !== true ||
      !Array.isArray(solution.groups) ||
      solution.groups.length !== 4
    ) {
      throw new Error(
        'The AI service did not return four groups.'
      );
    }

    const validIds = new Set(
      indexedEntries.map(entry => entry.id)
    );

    const seenIds = new Set();
    const seenColors = new Set();

    solution.groups.forEach(group => {
      if (
        !group ||
        !AI_COLOR_ORDER.includes(group.color) ||
        seenColors.has(group.color)
      ) {
        throw new Error(
          'The AI service returned invalid difficulty colors.'
        );
      }

      seenColors.add(group.color);

      if (
        !Array.isArray(group.tile_ids) ||
        group.tile_ids.length !== 4
      ) {
        throw new Error(
          'The AI service returned a malformed group.'
        );
      }

      group.tile_ids.forEach(id => {
        if (!validIds.has(id) || seenIds.has(id)) {
          throw new Error(
            'The AI service returned an invalid tile assignment.'
          );
        }

        seenIds.add(id);
      });
    });

    if (
      seenIds.size !== 16 ||
      seenColors.size !== 4
    ) {
      throw new Error(
        'The AI service returned an incomplete solution.'
      );
    }
  }

  function clearAiHints() {
    aiStyledElements.forEach(
      (original, element) => {
        element.style.boxShadow = original.boxShadow;
        element.style.outline = original.outline;
        element.style.outlineOffset =
          original.outlineOffset;
        element.removeAttribute(
          'data-swiftclick-ai-color'
        );
      }
    );

    aiStyledElements.clear();

    document
      .querySelector('#categories-ai-results')
      ?.remove();

    if (clearAiButton) {
      clearAiButton.disabled = true;
      clearAiButton.style.opacity = '0.55';
      clearAiButton.style.cursor = 'default';
    }
  }

  function renderAiSummary(groups, indexedEntries, solution) {
    document
      .querySelector('#categories-ai-results')
      ?.remove();

    const root =
      document.querySelector('#pz-game-root');

    const toolbar =
      document.querySelector('#categories-gpt-tools');

    if (!root || !toolbar) return;

    const wordById = new Map(
      indexedEntries.map(entry => [
        entry.id,
        entry.word
      ])
    );

    const panel = document.createElement('div');
    panel.id = 'categories-ai-results';

    Object.assign(panel.style, {
      width: 'min(760px, 96%)',
      margin: '2px auto 8px',
      padding: '14px',
      border: '1px solid #c8c8c8',
      borderRadius: '12px',
      background: '#fff',
      color: '#111',
      boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
    });

    const heading = document.createElement('div');
    heading.textContent = 'SwiftClick AI solution';

    Object.assign(heading.style, {
      fontWeight: '800',
      fontSize: '16px',
      marginBottom: '10px'
    });

    panel.appendChild(heading);

    [...groups]
      .sort(
        (a, b) =>
          AI_COLOR_ORDER.indexOf(a.color) -
          AI_COLOR_ORDER.indexOf(b.color)
      )
      .forEach(group => {
        const row = document.createElement('div');

        Object.assign(row.style, {
          display: 'grid',
          gridTemplateColumns: '18px 1fr',
          gap: '9px',
          alignItems: 'start',
          padding: '8px 0',
          borderTop: '1px solid #ececec'
        });

        const swatch = document.createElement('div');

        Object.assign(swatch.style, {
          width: '16px',
          height: '16px',
          marginTop: '2px',
          borderRadius: '4px',
          background: AI_COLORS[group.color],
          border: '1px solid rgba(0,0,0,.18)'
        });

        const textWrap = document.createElement('div');

        const label = document.createElement('div');
        label.textContent =
          group.color.toUpperCase() +
          ' — ' +
          group.label;

        Object.assign(label.style, {
          fontWeight: '800',
          fontSize: '14px'
        });

        const words = document.createElement('div');
        words.textContent = group.tile_ids
          .map(id => wordById.get(id) || id)
          .join(', ');

        Object.assign(words.style, {
          marginTop: '2px',
          fontWeight: '650',
          fontSize: '13px'
        });

        const explanation =
          document.createElement('div');

        explanation.textContent =
          group.explanation;

        Object.assign(explanation.style, {
          marginTop: '3px',
          color: '#555',
          fontSize: '12px',
          lineHeight: '1.35'
        });

        textWrap.append(
          label,
          words,
          explanation
        );

        row.append(
          swatch,
          textWrap
        );

        panel.appendChild(row);
      });

    const usage = solution?.usage;

    if (usage) {
      const diagnostic = document.createElement('div');

      Object.assign(diagnostic.style, {
        marginTop: '8px',
        paddingTop: '8px',
        borderTop: '1px solid #ececec',
        color: '#777',
        fontSize: '11px',
        lineHeight: '1.4'
      });

      const model =
        solution?.model === 'gpt-6-luna'
          ? 'Luna'
          : (solution?.model || 'AI');

      const input =
        formatTokenCount(
          Number(usage.input_tokens)
        );

      const output =
        formatTokenCount(
          Number(usage.output_tokens)
        );

      const reasoning =
        formatTokenCount(
          Number(
            usage.output_tokens_details
              ?.reasoning_tokens
          )
        );

      const cost =
        solution?.model === 'gpt-6-luna'
          ? formatEstimatedCost(
              estimateLunaCost(usage)
            )
          : null;

      const parts = [model];

      if (input) {
        parts.push(input + ' input');
      }

      if (output) {
        parts.push(output + ' output');
      }

      if (reasoning && Number(reasoning.replace(/,/g, '')) > 0) {
        parts.push(
          reasoning + ' reasoning'
        );
      }

      if (cost) {
        parts.push('est. ' + cost);
      }

      diagnostic.textContent =
        parts.join(' · ');

      panel.appendChild(diagnostic);
    }

    toolbar.parentNode.insertBefore(
      panel,
      toolbar.nextSibling
    );
  }

  function applyAiHints(solution, indexedEntries) {
    clearAiHints();

    const entryById = new Map(
      indexedEntries.map(entry => [
        entry.id,
        entry
      ])
    );

    solution.groups.forEach(group => {
      const color =
        AI_COLORS[group.color];

      group.tile_ids.forEach(id => {
        const entry = entryById.get(id);
        if (!entry) return;

        const host =
          getTileHost(entry.element);

        if (!aiStyledElements.has(host)) {
          aiStyledElements.set(host, {
            boxShadow: host.style.boxShadow,
            outline: host.style.outline,
            outlineOffset:
              host.style.outlineOffset
          });
        }

        host.style.boxShadow =
          'inset 0 0 0 4px ' + color;

        host.style.outline =
          '2px solid ' + color;

        host.style.outlineOffset = '2px';

        host.setAttribute(
          'data-swiftclick-ai-color',
          group.color
        );
      });
    });

    renderAiSummary(
      solution.groups,
      indexedEntries,
      solution
    );

    if (clearAiButton) {
      clearAiButton.disabled = false;
      clearAiButton.style.opacity = '1';
      clearAiButton.style.cursor = 'pointer';
    }
  }

  async function solveWithAi(button) {
    const entries = getTileEntries();

    if (entries.length !== 16) {
      alert(
        'AI Solve needs an untouched 16-tile Connections board. The script currently sees ' +
        entries.length +
        ' tile' +
        (entries.length === 1 ? '' : 's') +
        '.'
      );
      return;
    }

    let token = getStoredAiToken();

    if (!token) {
      token = promptForAiToken();
    }

    if (!token) return;

    const indexedEntries = entries.map(
      (entry, index) => ({
        ...entry,
        id:
          'SC-' +
          String(index + 1).padStart(3, '0')
      })
    );

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = 'AI solving…';
    button.style.opacity = '0.7';
    button.style.cursor = 'wait';

    startAiProgress(indexedEntries);

    try {
      const solution =
        await requestAiSolution(
          token,
          indexedEntries
        );

      validateAiSolution(
        solution,
        indexedEntries
      );

      applyAiHints(
        solution,
        indexedEntries
      );

      showToast(
        'AI solution received. No guesses were submitted.'
      );
    } catch (error) {
      if (error?.status === 401) {
        GM_setValue(AI_TOKEN_KEY, '');

        alert(
          'The Connections AI access token was rejected. The saved copy has been cleared; click AI Solve again to enter it again.'
        );
      } else {
        alert(
          error?.message ||
          'The Connections AI request failed.'
        );
      }
    } finally {
      stopAiProgress();

      button.disabled = false;
      button.textContent = originalText;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
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
      margin: '0 auto 4px',
      padding: '2px 8px'
    });

    const aiSolveButton = makeButton(
      'AI Solve',
      event => solveWithAi(event.currentTarget)
    );

    clearAiButton = makeButton(
      'Clear AI Hints',
      clearAiHints
    );

    clearAiButton.disabled = true;
    clearAiButton.style.opacity = '0.55';
    clearAiButton.style.cursor = 'default';

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
      aiSolveButton,
      clearAiButton,
      solveButton,
      reverseButton,
      selectedButton
    );

    const board = getBoardContainer();

    if (
      board &&
      board.parentNode
    ) {
      board.parentNode.insertBefore(
        toolbar,
        board
      );
    } else {
      root.prepend(toolbar);
    }
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
 + cost.toFixed(5);
    }

    if (cost < 0.01) {
      return '
  function getStoredAiToken() {
    return String(
      GM_getValue(AI_TOKEN_KEY, '') || ''
    ).trim();
  }

  function promptForAiToken() {
    const token = window.prompt(
      'Enter your Connections AI access token. It will be stored only in Tampermonkey on this browser.'
    );

    if (!token?.trim()) {
      return '';
    }

    const cleanToken = token.trim();
    GM_setValue(AI_TOKEN_KEY, cleanToken);
    return cleanToken;
  }

  function makeRequestId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === 'function'
    ) {
      return window.crypto.randomUUID();
    }

    return (
      'connections-' +
      Date.now() +
      '-' +
      Math.random().toString(16).slice(2)
    );
  }

  function requestAiSolution(token, indexedEntries) {
    const payload = {
      request_id: makeRequestId(),
      subject_ref: 'connections:nyt:live',
      data: {
        tiles: indexedEntries.map(entry => ({
          id: entry.id,
          word: entry.word
        }))
      }
    };

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: AI_API_URL,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(payload),
        timeout: 120000,

        onload(response) {
          let body;

          try {
            body = JSON.parse(response.responseText || '{}');
          } catch {
            const error = new Error(
              'The AI service returned an unreadable response.'
            );
            error.status = response.status;
            reject(error);
            return;
          }

          if (
            response.status >= 200 &&
            response.status < 300
          ) {
            resolve(body);
            return;
          }

          const error = new Error(
            body?.error
              ? 'AI service error: ' + body.error
              : 'AI service request failed.'
          );

          error.status = response.status;
          reject(error);
        },

        onerror() {
          reject(
            new Error(
              'Could not reach the Connections AI service.'
            )
          );
        },

        ontimeout() {
          reject(
            new Error(
              'The Connections AI request timed out.'
            )
          );
        }
      });
    });
  }

  function validateAiSolution(solution, indexedEntries) {
    if (
      !solution ||
      solution.ok !== true ||
      !Array.isArray(solution.groups) ||
      solution.groups.length !== 4
    ) {
      throw new Error(
        'The AI service did not return four groups.'
      );
    }

    const validIds = new Set(
      indexedEntries.map(entry => entry.id)
    );

    const seenIds = new Set();
    const seenColors = new Set();

    solution.groups.forEach(group => {
      if (
        !group ||
        !AI_COLOR_ORDER.includes(group.color) ||
        seenColors.has(group.color)
      ) {
        throw new Error(
          'The AI service returned invalid difficulty colors.'
        );
      }

      seenColors.add(group.color);

      if (
        !Array.isArray(group.tile_ids) ||
        group.tile_ids.length !== 4
      ) {
        throw new Error(
          'The AI service returned a malformed group.'
        );
      }

      group.tile_ids.forEach(id => {
        if (!validIds.has(id) || seenIds.has(id)) {
          throw new Error(
            'The AI service returned an invalid tile assignment.'
          );
        }

        seenIds.add(id);
      });
    });

    if (
      seenIds.size !== 16 ||
      seenColors.size !== 4
    ) {
      throw new Error(
        'The AI service returned an incomplete solution.'
      );
    }
  }

  function clearAiHints() {
    aiStyledElements.forEach(
      (original, element) => {
        element.style.boxShadow = original.boxShadow;
        element.style.outline = original.outline;
        element.style.outlineOffset =
          original.outlineOffset;
        element.removeAttribute(
          'data-swiftclick-ai-color'
        );
      }
    );

    aiStyledElements.clear();

    document
      .querySelector('#categories-ai-results')
      ?.remove();

    if (clearAiButton) {
      clearAiButton.disabled = true;
      clearAiButton.style.opacity = '0.55';
      clearAiButton.style.cursor = 'default';
    }
  }

  function renderAiSummary(groups, indexedEntries) {
    document
      .querySelector('#categories-ai-results')
      ?.remove();

    const root =
      document.querySelector('#pz-game-root');

    const toolbar =
      document.querySelector('#categories-gpt-tools');

    if (!root || !toolbar) return;

    const wordById = new Map(
      indexedEntries.map(entry => [
        entry.id,
        entry.word
      ])
    );

    const panel = document.createElement('div');
    panel.id = 'categories-ai-results';

    Object.assign(panel.style, {
      width: 'min(760px, 96%)',
      margin: '0 auto 18px',
      padding: '14px',
      border: '1px solid #c8c8c8',
      borderRadius: '12px',
      background: '#fff',
      color: '#111',
      boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
    });

    const heading = document.createElement('div');
    heading.textContent = 'SwiftClick AI solution';

    Object.assign(heading.style, {
      fontWeight: '800',
      fontSize: '16px',
      marginBottom: '10px'
    });

    panel.appendChild(heading);

    [...groups]
      .sort(
        (a, b) =>
          AI_COLOR_ORDER.indexOf(a.color) -
          AI_COLOR_ORDER.indexOf(b.color)
      )
      .forEach(group => {
        const row = document.createElement('div');

        Object.assign(row.style, {
          display: 'grid',
          gridTemplateColumns: '18px 1fr',
          gap: '9px',
          alignItems: 'start',
          padding: '8px 0',
          borderTop: '1px solid #ececec'
        });

        const swatch = document.createElement('div');

        Object.assign(swatch.style, {
          width: '16px',
          height: '16px',
          marginTop: '2px',
          borderRadius: '4px',
          background: AI_COLORS[group.color],
          border: '1px solid rgba(0,0,0,.18)'
        });

        const textWrap = document.createElement('div');

        const label = document.createElement('div');
        label.textContent =
          group.color.toUpperCase() +
          ' — ' +
          group.label;

        Object.assign(label.style, {
          fontWeight: '800',
          fontSize: '14px'
        });

        const words = document.createElement('div');
        words.textContent = group.tile_ids
          .map(id => wordById.get(id) || id)
          .join(', ');

        Object.assign(words.style, {
          marginTop: '2px',
          fontWeight: '650',
          fontSize: '13px'
        });

        const explanation =
          document.createElement('div');

        explanation.textContent =
          group.explanation;

        Object.assign(explanation.style, {
          marginTop: '3px',
          color: '#555',
          fontSize: '12px',
          lineHeight: '1.35'
        });

        textWrap.append(
          label,
          words,
          explanation
        );

        row.append(
          swatch,
          textWrap
        );

        panel.appendChild(row);
      });

    toolbar.parentNode.insertBefore(
      panel,
      toolbar.nextSibling
    );
  }

  function applyAiHints(solution, indexedEntries) {
    clearAiHints();

    const entryById = new Map(
      indexedEntries.map(entry => [
        entry.id,
        entry
      ])
    );

    solution.groups.forEach(group => {
      const color =
        AI_COLORS[group.color];

      group.tile_ids.forEach(id => {
        const entry = entryById.get(id);
        if (!entry) return;

        const host =
          getTileHost(entry.element);

        if (!aiStyledElements.has(host)) {
          aiStyledElements.set(host, {
            boxShadow: host.style.boxShadow,
            outline: host.style.outline,
            outlineOffset:
              host.style.outlineOffset
          });
        }

        host.style.boxShadow =
          'inset 0 0 0 4px ' + color;

        host.style.outline =
          '2px solid ' + color;

        host.style.outlineOffset = '2px';

        host.setAttribute(
          'data-swiftclick-ai-color',
          group.color
        );
      });
    });

    renderAiSummary(
      solution.groups,
      indexedEntries
    );

    if (clearAiButton) {
      clearAiButton.disabled = false;
      clearAiButton.style.opacity = '1';
      clearAiButton.style.cursor = 'pointer';
    }
  }

  async function solveWithAi(button) {
    const entries = getTileEntries();

    if (entries.length !== 16) {
      alert(
        'AI Solve needs an untouched 16-tile Connections board. The script currently sees ' +
        entries.length +
        ' tile' +
        (entries.length === 1 ? '' : 's') +
        '.'
      );
      return;
    }

    let token = getStoredAiToken();

    if (!token) {
      token = promptForAiToken();
    }

    if (!token) return;

    const indexedEntries = entries.map(
      (entry, index) => ({
        ...entry,
        id:
          'SC-' +
          String(index + 1).padStart(3, '0')
      })
    );

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = 'AI solving…';
    button.style.opacity = '0.7';
    button.style.cursor = 'wait';

    try {
      const solution =
        await requestAiSolution(
          token,
          indexedEntries
        );

      validateAiSolution(
        solution,
        indexedEntries
      );

      applyAiHints(
        solution,
        indexedEntries
      );

      showToast(
        'AI solution received. No guesses were submitted.'
      );
    } catch (error) {
      if (error?.status === 401) {
        GM_setValue(AI_TOKEN_KEY, '');

        alert(
          'The Connections AI access token was rejected. The saved copy has been cleared; click AI Solve again to enter it again.'
        );
      } else {
        alert(
          error?.message ||
          'The Connections AI request failed.'
        );
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
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

    const aiSolveButton = makeButton(
      'AI Solve',
      event => solveWithAi(event.currentTarget)
    );

    clearAiButton = makeButton(
      'Clear AI Hints',
      clearAiHints
    );

    clearAiButton.disabled = true;
    clearAiButton.style.opacity = '0.55';
    clearAiButton.style.cursor = 'default';

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
      aiSolveButton,
      clearAiButton,
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
 + cost.toFixed(4);
    }

    return '
  function getStoredAiToken() {
    return String(
      GM_getValue(AI_TOKEN_KEY, '') || ''
    ).trim();
  }

  function promptForAiToken() {
    const token = window.prompt(
      'Enter your Connections AI access token. It will be stored only in Tampermonkey on this browser.'
    );

    if (!token?.trim()) {
      return '';
    }

    const cleanToken = token.trim();
    GM_setValue(AI_TOKEN_KEY, cleanToken);
    return cleanToken;
  }

  function makeRequestId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === 'function'
    ) {
      return window.crypto.randomUUID();
    }

    return (
      'connections-' +
      Date.now() +
      '-' +
      Math.random().toString(16).slice(2)
    );
  }

  function requestAiSolution(token, indexedEntries) {
    const payload = {
      request_id: makeRequestId(),
      subject_ref: 'connections:nyt:live',
      data: {
        tiles: indexedEntries.map(entry => ({
          id: entry.id,
          word: entry.word
        }))
      }
    };

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: AI_API_URL,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(payload),
        timeout: 120000,

        onload(response) {
          let body;

          try {
            body = JSON.parse(response.responseText || '{}');
          } catch {
            const error = new Error(
              'The AI service returned an unreadable response.'
            );
            error.status = response.status;
            reject(error);
            return;
          }

          if (
            response.status >= 200 &&
            response.status < 300
          ) {
            resolve(body);
            return;
          }

          const error = new Error(
            body?.error
              ? 'AI service error: ' + body.error
              : 'AI service request failed.'
          );

          error.status = response.status;
          reject(error);
        },

        onerror() {
          reject(
            new Error(
              'Could not reach the Connections AI service.'
            )
          );
        },

        ontimeout() {
          reject(
            new Error(
              'The Connections AI request timed out.'
            )
          );
        }
      });
    });
  }

  function validateAiSolution(solution, indexedEntries) {
    if (
      !solution ||
      solution.ok !== true ||
      !Array.isArray(solution.groups) ||
      solution.groups.length !== 4
    ) {
      throw new Error(
        'The AI service did not return four groups.'
      );
    }

    const validIds = new Set(
      indexedEntries.map(entry => entry.id)
    );

    const seenIds = new Set();
    const seenColors = new Set();

    solution.groups.forEach(group => {
      if (
        !group ||
        !AI_COLOR_ORDER.includes(group.color) ||
        seenColors.has(group.color)
      ) {
        throw new Error(
          'The AI service returned invalid difficulty colors.'
        );
      }

      seenColors.add(group.color);

      if (
        !Array.isArray(group.tile_ids) ||
        group.tile_ids.length !== 4
      ) {
        throw new Error(
          'The AI service returned a malformed group.'
        );
      }

      group.tile_ids.forEach(id => {
        if (!validIds.has(id) || seenIds.has(id)) {
          throw new Error(
            'The AI service returned an invalid tile assignment.'
          );
        }

        seenIds.add(id);
      });
    });

    if (
      seenIds.size !== 16 ||
      seenColors.size !== 4
    ) {
      throw new Error(
        'The AI service returned an incomplete solution.'
      );
    }
  }

  function clearAiHints() {
    aiStyledElements.forEach(
      (original, element) => {
        element.style.boxShadow = original.boxShadow;
        element.style.outline = original.outline;
        element.style.outlineOffset =
          original.outlineOffset;
        element.removeAttribute(
          'data-swiftclick-ai-color'
        );
      }
    );

    aiStyledElements.clear();

    document
      .querySelector('#categories-ai-results')
      ?.remove();

    if (clearAiButton) {
      clearAiButton.disabled = true;
      clearAiButton.style.opacity = '0.55';
      clearAiButton.style.cursor = 'default';
    }
  }

  function renderAiSummary(groups, indexedEntries) {
    document
      .querySelector('#categories-ai-results')
      ?.remove();

    const root =
      document.querySelector('#pz-game-root');

    const toolbar =
      document.querySelector('#categories-gpt-tools');

    if (!root || !toolbar) return;

    const wordById = new Map(
      indexedEntries.map(entry => [
        entry.id,
        entry.word
      ])
    );

    const panel = document.createElement('div');
    panel.id = 'categories-ai-results';

    Object.assign(panel.style, {
      width: 'min(760px, 96%)',
      margin: '0 auto 18px',
      padding: '14px',
      border: '1px solid #c8c8c8',
      borderRadius: '12px',
      background: '#fff',
      color: '#111',
      boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
    });

    const heading = document.createElement('div');
    heading.textContent = 'SwiftClick AI solution';

    Object.assign(heading.style, {
      fontWeight: '800',
      fontSize: '16px',
      marginBottom: '10px'
    });

    panel.appendChild(heading);

    [...groups]
      .sort(
        (a, b) =>
          AI_COLOR_ORDER.indexOf(a.color) -
          AI_COLOR_ORDER.indexOf(b.color)
      )
      .forEach(group => {
        const row = document.createElement('div');

        Object.assign(row.style, {
          display: 'grid',
          gridTemplateColumns: '18px 1fr',
          gap: '9px',
          alignItems: 'start',
          padding: '8px 0',
          borderTop: '1px solid #ececec'
        });

        const swatch = document.createElement('div');

        Object.assign(swatch.style, {
          width: '16px',
          height: '16px',
          marginTop: '2px',
          borderRadius: '4px',
          background: AI_COLORS[group.color],
          border: '1px solid rgba(0,0,0,.18)'
        });

        const textWrap = document.createElement('div');

        const label = document.createElement('div');
        label.textContent =
          group.color.toUpperCase() +
          ' — ' +
          group.label;

        Object.assign(label.style, {
          fontWeight: '800',
          fontSize: '14px'
        });

        const words = document.createElement('div');
        words.textContent = group.tile_ids
          .map(id => wordById.get(id) || id)
          .join(', ');

        Object.assign(words.style, {
          marginTop: '2px',
          fontWeight: '650',
          fontSize: '13px'
        });

        const explanation =
          document.createElement('div');

        explanation.textContent =
          group.explanation;

        Object.assign(explanation.style, {
          marginTop: '3px',
          color: '#555',
          fontSize: '12px',
          lineHeight: '1.35'
        });

        textWrap.append(
          label,
          words,
          explanation
        );

        row.append(
          swatch,
          textWrap
        );

        panel.appendChild(row);
      });

    toolbar.parentNode.insertBefore(
      panel,
      toolbar.nextSibling
    );
  }

  function applyAiHints(solution, indexedEntries) {
    clearAiHints();

    const entryById = new Map(
      indexedEntries.map(entry => [
        entry.id,
        entry
      ])
    );

    solution.groups.forEach(group => {
      const color =
        AI_COLORS[group.color];

      group.tile_ids.forEach(id => {
        const entry = entryById.get(id);
        if (!entry) return;

        const host =
          getTileHost(entry.element);

        if (!aiStyledElements.has(host)) {
          aiStyledElements.set(host, {
            boxShadow: host.style.boxShadow,
            outline: host.style.outline,
            outlineOffset:
              host.style.outlineOffset
          });
        }

        host.style.boxShadow =
          'inset 0 0 0 4px ' + color;

        host.style.outline =
          '2px solid ' + color;

        host.style.outlineOffset = '2px';

        host.setAttribute(
          'data-swiftclick-ai-color',
          group.color
        );
      });
    });

    renderAiSummary(
      solution.groups,
      indexedEntries
    );

    if (clearAiButton) {
      clearAiButton.disabled = false;
      clearAiButton.style.opacity = '1';
      clearAiButton.style.cursor = 'pointer';
    }
  }

  async function solveWithAi(button) {
    const entries = getTileEntries();

    if (entries.length !== 16) {
      alert(
        'AI Solve needs an untouched 16-tile Connections board. The script currently sees ' +
        entries.length +
        ' tile' +
        (entries.length === 1 ? '' : 's') +
        '.'
      );
      return;
    }

    let token = getStoredAiToken();

    if (!token) {
      token = promptForAiToken();
    }

    if (!token) return;

    const indexedEntries = entries.map(
      (entry, index) => ({
        ...entry,
        id:
          'SC-' +
          String(index + 1).padStart(3, '0')
      })
    );

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = 'AI solving…';
    button.style.opacity = '0.7';
    button.style.cursor = 'wait';

    try {
      const solution =
        await requestAiSolution(
          token,
          indexedEntries
        );

      validateAiSolution(
        solution,
        indexedEntries
      );

      applyAiHints(
        solution,
        indexedEntries
      );

      showToast(
        'AI solution received. No guesses were submitted.'
      );
    } catch (error) {
      if (error?.status === 401) {
        GM_setValue(AI_TOKEN_KEY, '');

        alert(
          'The Connections AI access token was rejected. The saved copy has been cleared; click AI Solve again to enter it again.'
        );
      } else {
        alert(
          error?.message ||
          'The Connections AI request failed.'
        );
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
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

    const aiSolveButton = makeButton(
      'AI Solve',
      event => solveWithAi(event.currentTarget)
    );

    clearAiButton = makeButton(
      'Clear AI Hints',
      clearAiHints
    );

    clearAiButton.disabled = true;
    clearAiButton.style.opacity = '0.55';
    clearAiButton.style.cursor = 'default';

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
      aiSolveButton,
      clearAiButton,
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
 + cost.toFixed(3);
  }


  function getStoredAiToken() {
    return String(
      GM_getValue(AI_TOKEN_KEY, '') || ''
    ).trim();
  }

  function promptForAiToken() {
    const token = window.prompt(
      'Enter your Connections AI access token. It will be stored only in Tampermonkey on this browser.'
    );

    if (!token?.trim()) {
      return '';
    }

    const cleanToken = token.trim();
    GM_setValue(AI_TOKEN_KEY, cleanToken);
    return cleanToken;
  }

  function makeRequestId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === 'function'
    ) {
      return window.crypto.randomUUID();
    }

    return (
      'connections-' +
      Date.now() +
      '-' +
      Math.random().toString(16).slice(2)
    );
  }

  function requestAiSolution(token, indexedEntries) {
    const payload = {
      request_id: makeRequestId(),
      subject_ref: 'connections:nyt:live',
      data: {
        tiles: indexedEntries.map(entry => ({
          id: entry.id,
          word: entry.word
        }))
      }
    };

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: AI_API_URL,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(payload),
        timeout: 120000,

        onload(response) {
          let body;

          try {
            body = JSON.parse(response.responseText || '{}');
          } catch {
            const error = new Error(
              'The AI service returned an unreadable response.'
            );
            error.status = response.status;
            reject(error);
            return;
          }

          if (
            response.status >= 200 &&
            response.status < 300
          ) {
            resolve(body);
            return;
          }

          const error = new Error(
            body?.error
              ? 'AI service error: ' + body.error
              : 'AI service request failed.'
          );

          error.status = response.status;
          reject(error);
        },

        onerror() {
          reject(
            new Error(
              'Could not reach the Connections AI service.'
            )
          );
        },

        ontimeout() {
          reject(
            new Error(
              'The Connections AI request timed out.'
            )
          );
        }
      });
    });
  }

  function validateAiSolution(solution, indexedEntries) {
    if (
      !solution ||
      solution.ok !== true ||
      !Array.isArray(solution.groups) ||
      solution.groups.length !== 4
    ) {
      throw new Error(
        'The AI service did not return four groups.'
      );
    }

    const validIds = new Set(
      indexedEntries.map(entry => entry.id)
    );

    const seenIds = new Set();
    const seenColors = new Set();

    solution.groups.forEach(group => {
      if (
        !group ||
        !AI_COLOR_ORDER.includes(group.color) ||
        seenColors.has(group.color)
      ) {
        throw new Error(
          'The AI service returned invalid difficulty colors.'
        );
      }

      seenColors.add(group.color);

      if (
        !Array.isArray(group.tile_ids) ||
        group.tile_ids.length !== 4
      ) {
        throw new Error(
          'The AI service returned a malformed group.'
        );
      }

      group.tile_ids.forEach(id => {
        if (!validIds.has(id) || seenIds.has(id)) {
          throw new Error(
            'The AI service returned an invalid tile assignment.'
          );
        }

        seenIds.add(id);
      });
    });

    if (
      seenIds.size !== 16 ||
      seenColors.size !== 4
    ) {
      throw new Error(
        'The AI service returned an incomplete solution.'
      );
    }
  }

  function clearAiHints() {
    aiStyledElements.forEach(
      (original, element) => {
        element.style.boxShadow = original.boxShadow;
        element.style.outline = original.outline;
        element.style.outlineOffset =
          original.outlineOffset;
        element.removeAttribute(
          'data-swiftclick-ai-color'
        );
      }
    );

    aiStyledElements.clear();

    document
      .querySelector('#categories-ai-results')
      ?.remove();

    if (clearAiButton) {
      clearAiButton.disabled = true;
      clearAiButton.style.opacity = '0.55';
      clearAiButton.style.cursor = 'default';
    }
  }

  function renderAiSummary(groups, indexedEntries) {
    document
      .querySelector('#categories-ai-results')
      ?.remove();

    const root =
      document.querySelector('#pz-game-root');

    const toolbar =
      document.querySelector('#categories-gpt-tools');

    if (!root || !toolbar) return;

    const wordById = new Map(
      indexedEntries.map(entry => [
        entry.id,
        entry.word
      ])
    );

    const panel = document.createElement('div');
    panel.id = 'categories-ai-results';

    Object.assign(panel.style, {
      width: 'min(760px, 96%)',
      margin: '0 auto 18px',
      padding: '14px',
      border: '1px solid #c8c8c8',
      borderRadius: '12px',
      background: '#fff',
      color: '#111',
      boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
    });

    const heading = document.createElement('div');
    heading.textContent = 'SwiftClick AI solution';

    Object.assign(heading.style, {
      fontWeight: '800',
      fontSize: '16px',
      marginBottom: '10px'
    });

    panel.appendChild(heading);

    [...groups]
      .sort(
        (a, b) =>
          AI_COLOR_ORDER.indexOf(a.color) -
          AI_COLOR_ORDER.indexOf(b.color)
      )
      .forEach(group => {
        const row = document.createElement('div');

        Object.assign(row.style, {
          display: 'grid',
          gridTemplateColumns: '18px 1fr',
          gap: '9px',
          alignItems: 'start',
          padding: '8px 0',
          borderTop: '1px solid #ececec'
        });

        const swatch = document.createElement('div');

        Object.assign(swatch.style, {
          width: '16px',
          height: '16px',
          marginTop: '2px',
          borderRadius: '4px',
          background: AI_COLORS[group.color],
          border: '1px solid rgba(0,0,0,.18)'
        });

        const textWrap = document.createElement('div');

        const label = document.createElement('div');
        label.textContent =
          group.color.toUpperCase() +
          ' — ' +
          group.label;

        Object.assign(label.style, {
          fontWeight: '800',
          fontSize: '14px'
        });

        const words = document.createElement('div');
        words.textContent = group.tile_ids
          .map(id => wordById.get(id) || id)
          .join(', ');

        Object.assign(words.style, {
          marginTop: '2px',
          fontWeight: '650',
          fontSize: '13px'
        });

        const explanation =
          document.createElement('div');

        explanation.textContent =
          group.explanation;

        Object.assign(explanation.style, {
          marginTop: '3px',
          color: '#555',
          fontSize: '12px',
          lineHeight: '1.35'
        });

        textWrap.append(
          label,
          words,
          explanation
        );

        row.append(
          swatch,
          textWrap
        );

        panel.appendChild(row);
      });

    toolbar.parentNode.insertBefore(
      panel,
      toolbar.nextSibling
    );
  }

  function applyAiHints(solution, indexedEntries) {
    clearAiHints();

    const entryById = new Map(
      indexedEntries.map(entry => [
        entry.id,
        entry
      ])
    );

    solution.groups.forEach(group => {
      const color =
        AI_COLORS[group.color];

      group.tile_ids.forEach(id => {
        const entry = entryById.get(id);
        if (!entry) return;

        const host =
          getTileHost(entry.element);

        if (!aiStyledElements.has(host)) {
          aiStyledElements.set(host, {
            boxShadow: host.style.boxShadow,
            outline: host.style.outline,
            outlineOffset:
              host.style.outlineOffset
          });
        }

        host.style.boxShadow =
          'inset 0 0 0 4px ' + color;

        host.style.outline =
          '2px solid ' + color;

        host.style.outlineOffset = '2px';

        host.setAttribute(
          'data-swiftclick-ai-color',
          group.color
        );
      });
    });

    renderAiSummary(
      solution.groups,
      indexedEntries
    );

    if (clearAiButton) {
      clearAiButton.disabled = false;
      clearAiButton.style.opacity = '1';
      clearAiButton.style.cursor = 'pointer';
    }
  }

  async function solveWithAi(button) {
    const entries = getTileEntries();

    if (entries.length !== 16) {
      alert(
        'AI Solve needs an untouched 16-tile Connections board. The script currently sees ' +
        entries.length +
        ' tile' +
        (entries.length === 1 ? '' : 's') +
        '.'
      );
      return;
    }

    let token = getStoredAiToken();

    if (!token) {
      token = promptForAiToken();
    }

    if (!token) return;

    const indexedEntries = entries.map(
      (entry, index) => ({
        ...entry,
        id:
          'SC-' +
          String(index + 1).padStart(3, '0')
      })
    );

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = 'AI solving…';
    button.style.opacity = '0.7';
    button.style.cursor = 'wait';

    try {
      const solution =
        await requestAiSolution(
          token,
          indexedEntries
        );

      validateAiSolution(
        solution,
        indexedEntries
      );

      applyAiHints(
        solution,
        indexedEntries
      );

      showToast(
        'AI solution received. No guesses were submitted.'
      );
    } catch (error) {
      if (error?.status === 401) {
        GM_setValue(AI_TOKEN_KEY, '');

        alert(
          'The Connections AI access token was rejected. The saved copy has been cleared; click AI Solve again to enter it again.'
        );
      } else {
        alert(
          error?.message ||
          'The Connections AI request failed.'
        );
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
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

    const aiSolveButton = makeButton(
      'AI Solve',
      event => solveWithAi(event.currentTarget)
    );

    clearAiButton = makeButton(
      'Clear AI Hints',
      clearAiHints
    );

    clearAiButton.disabled = true;
    clearAiButton.style.opacity = '0.55';
    clearAiButton.style.cursor = 'default';

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
      aiSolveButton,
      clearAiButton,
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
