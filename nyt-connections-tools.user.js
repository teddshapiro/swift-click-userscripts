// ==UserScript==
// @name         NYT Connections → Categories Puzzle Assistant
// @namespace    local
// @version      1.3.3
// @description  NYT Connections tools with direct SwiftClick AI solving plus the existing Custom GPT workflow
// @match        https://www.nytimes.com/games/connections*
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      connections-ai-service.tedd-7f4.workers.dev
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/connections-ai-feedback/nyt-connections-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/connections-ai-feedback/nyt-connections-tools.user.js
// ==/UserScript==

(function () {
  'use strict';

  const APP_VERSION = '1.3.3';

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
  let aiProgressAnimationFrame = null;
  let aiProgressResizeObserver = null;
  let aiFeedbackState = null;
  let pendingNytSubmission = null;
  let feedbackCheckTimer = null;
  const trackedSelectedWords =
    new Set();

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
    const root =
      document.querySelector(
        '#pz-game-root'
      );

    if (!root) return [];

    const checked = [
      ...root.querySelectorAll(
        'input[data-testid="card-input"]:checked'
      )
    ]
      .map(
        el =>
          el.value ||
          el.getAttribute(
            'aria-label'
          )
      )
      .map(word =>
        word?.trim()
      )
      .filter(Boolean);

    if (checked.length) {
      return [
        ...new Set(checked)
      ];
    }

    return [
      ...trackedSelectedWords
    ];
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

  function updateAiProgressPosition() {
    if (!aiProgressOverlay) return;

    const board = aiProgressOverlay._swiftclickBoard;

    if (!board?.isConnected) {
      stopAiProgress();
      return;
    }

    const rect = board.getBoundingClientRect();
    const pad = 7;

    Object.assign(aiProgressOverlay.style, {
      left: Math.round(rect.left - pad) + 'px',
      top: Math.round(rect.top - pad) + 'px',
      width: Math.round(rect.width + pad * 2) + 'px',
      height: Math.round(rect.height + pad * 2) + 'px'
    });
  }

  function animateAiProgress(timestamp) {
    if (!aiProgressOverlay) return;

    if (!aiProgressOverlay._swiftclickStartedAt) {
      aiProgressOverlay._swiftclickStartedAt = timestamp;
    }

    const elapsed =
      timestamp -
      aiProgressOverlay._swiftclickStartedAt;

    const orbit =
      aiProgressOverlay._swiftclickOrbit;

    const base =
      aiProgressOverlay._swiftclickBase;

    const colorIndex =
      Math.floor(elapsed / 650) %
      AI_COLOR_ORDER.length;

    const color =
      AI_COLORS[
        AI_COLOR_ORDER[colorIndex]
      ];

    const dashOffset =
      -((elapsed / 11) % 112);

    const pulse =
      0.72 +
      0.28 *
        ((Math.sin(elapsed / 180) + 1) / 2);

    orbit.setAttribute(
      'stroke',
      color
    );

    orbit.setAttribute(
      'stroke-dashoffset',
      String(dashOffset)
    );

    orbit.setAttribute(
      'stroke-opacity',
      String(pulse)
    );

    base.setAttribute(
      'stroke',
      color
    );

    aiProgressAnimationFrame =
      window.requestAnimationFrame(
        animateAiProgress
      );
  }

  function stopAiProgress() {
    if (aiProgressAnimationFrame !== null) {
      window.cancelAnimationFrame(
        aiProgressAnimationFrame
      );

      aiProgressAnimationFrame = null;
    }

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

  function startAiProgress(indexedEntries) {
    stopAiProgress();

    const board =
      getBoardContainer(indexedEntries);

    if (!board) return;

    const overlay = document.createElement('div');
    overlay.id = 'categories-ai-progress';
    overlay._swiftclickBoard = board;

    Object.assign(overlay.style, {
      position: 'fixed',
      zIndex: '9999990',
      pointerEvents: 'none'
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
      display: 'block',
      overflow: 'visible'
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
      AI_COLORS.yellow
    );
    base.setAttribute(
      'stroke-width',
      '2.5'
    );
    base.setAttribute(
      'stroke-opacity',
      '0.20'
    );
    base.setAttribute(
      'vector-effect',
      'non-scaling-stroke'
    );

    const orbit = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect'
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
      AI_COLORS.yellow
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

    overlay._swiftclickBase = base;
    overlay._swiftclickOrbit = orbit;

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

    aiProgressAnimationFrame =
      window.requestAnimationFrame(
        animateAiProgress
      );
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
        1000000 +
      cached *
        LUNA_STANDARD_PRICING.cachedInputPerMillion /
        1000000 +
      output *
        LUNA_STANDARD_PRICING.outputPerMillion /
        1000000
    );
  }

  function formatEstimatedCost(cost) {
    if (!Number.isFinite(cost)) return null;

    if (cost < 0.001) {
      return '$' + cost.toFixed(5);
    }

    if (cost < 0.01) {
      return '$' + cost.toFixed(4);
    }

    return '$' + cost.toFixed(3);
  }

  function getStoredAiToken() {
    return String(
      GM_getValue(AI_TOKEN_KEY, '') || ''
    ).trim();
  }

  function promptForAiToken() {
    const token = window.prompt(
      'AI Solve requires a SwiftClick Connections AI access key.\n\n' +
      'For pricing and access information, email connections@SwiftClick.com.\n\n' +
      'If you already have a key, enter it below. It will be stored only in Tampermonkey on this browser.'
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

  function requestAiSolution(
    token,
    indexedEntries,
    confirmedGroups = []
  ) {
    const payload = {
      profile: 'connections-solver-v2',
      request_id: makeRequestId(),
      subject_ref: 'connections:nyt:live',
      data: {
        tiles: indexedEntries.map(entry => ({
          id: entry.id,
          word: entry.word
        })),
        confirmed_groups:
          confirmedGroups.map(group => ({
            color: group.color,
            label: group.label,
            words: [...group.words]
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
        timeout: 300000,

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
              'The Connections AI request timed out after five minutes. Please try again; unusually difficult puzzles can take longer to reason through.'
            )
          );
        }
      });
    });
  }

  function validateAiSolution(
    solution,
    indexedEntries,
    confirmedGroups = []
  ) {
    const expectedGroupCount =
      indexedEntries.length / 4;

    if (
      !solution ||
      solution.ok !== true ||
      !Array.isArray(solution.groups) ||
      solution.groups.length !==
        expectedGroupCount
    ) {
      throw new Error(
        'The AI service did not return the expected number of remaining groups.'
      );
    }

    const validIds = new Set(
      indexedEntries.map(entry => entry.id)
    );

    const confirmedColors = new Set(
      confirmedGroups
        .map(group => group.color)
        .filter(color =>
          AI_COLOR_ORDER.includes(color)
        )
    );

    const seenIds = new Set();
    const seenColors = new Set();

    solution.groups.forEach(group => {
      if (
        !group ||
        !AI_COLOR_ORDER.includes(group.color) ||
        confirmedColors.has(group.color) ||
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
        if (
          !validIds.has(id) ||
          seenIds.has(id)
        ) {
          throw new Error(
            'The AI service returned an invalid tile assignment.'
          );
        }

        seenIds.add(id);
      });
    });

    if (
      seenIds.size !== indexedEntries.length ||
      seenColors.size !==
        expectedGroupCount
    ) {
      throw new Error(
        'The AI service returned an incomplete remaining solution.'
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

    aiFeedbackState = null;
    pendingNytSubmission = null;
    trackedSelectedWords.clear();

    if (feedbackCheckTimer) {
      window.clearTimeout(
        feedbackCheckTimer
      );
      feedbackCheckTimer = null;
    }

    document
      .querySelector('#categories-ai-results')
      ?.remove();

    if (clearAiButton) {
      clearAiButton.disabled = true;
      clearAiButton.style.opacity = '0.55';
      clearAiButton.style.cursor = 'default';
    }
  }

  function ensureAiSummaryStyles() {
    if (
      document.querySelector(
        '#categories-ai-summary-styles'
      )
    ) {
      return;
    }

    const style =
      document.createElement('style');

    style.id =
      'categories-ai-summary-styles';

    style.textContent = [
      '#categories-ai-results .swiftclick-ai-summary-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(4, minmax(0, 1fr));',
      '  gap: 10px;',
      '}',
      '#categories-ai-results .swiftclick-ai-summary-card {',
      '  min-width: 0;',
      '}',
      '@media (max-width: 900px) {',
      '  #categories-ai-results .swiftclick-ai-summary-grid {',
      '    grid-template-columns: repeat(2, minmax(0, 1fr));',
      '  }',
      '}',
      '@media (max-width: 560px) {',
      '  #categories-ai-results .swiftclick-ai-summary-grid {',
      '    grid-template-columns: 1fr;',
      '  }',
      '}'
    ].join('\n');

    document.head.appendChild(style);
  }

  function hexToRgba(hex, alpha) {
    const value =
      String(hex || '')
        .replace('#', '');

    if (!/^[0-9a-fA-F]{6}$/.test(value)) {
      return (
        'rgba(0, 0, 0, ' +
        alpha +
        ')'
      );
    }

    const red =
      parseInt(value.slice(0, 2), 16);

    const green =
      parseInt(value.slice(2, 4), 16);

    const blue =
      parseInt(value.slice(4, 6), 16);

    return (
      'rgba(' +
      red +
      ', ' +
      green +
      ', ' +
      blue +
      ', ' +
      alpha +
      ')'
    );
  }

  function normalizeWord(value) {
    return String(value || '')
      .trim()
      .toUpperCase();
  }

  function wordSetKey(words) {
    return [...words]
      .map(normalizeWord)
      .filter(Boolean)
      .sort()
      .join('\u0001');
  }

  function visiblePuzzleWords() {
    return [
      ...new Set(
        getTileEntries()
          .filter(entry =>
            entry.element
              ?.getClientRects()
              ?.length
          )
          .map(entry =>
            entry.word?.trim()
          )
          .filter(Boolean)
      )
    ];
  }

  function initializeAiFeedback(
    groups,
    indexedEntries,
    confirmedGroups = []
  ) {
    const wordById =
      new Map(
        indexedEntries.map(entry => [
          entry.id,
          entry.word
        ])
      );

    const originalByColor = {};

    groups.forEach(group => {
      originalByColor[group.color] = {
        ...group,
        words: group.tile_ids
          .map(id =>
            wordById.get(id) || id
          )
      };
    });

    const confirmedByColor = {};

    confirmedGroups.forEach(group => {
      if (
        group &&
        AI_COLOR_ORDER.includes(
          group.color
        ) &&
        Array.isArray(group.words) &&
        group.words.length === 4
      ) {
        confirmedByColor[group.color] = {
          color: group.color,
          label:
            group.label ||
            'NYT confirmed group',
          words: [...group.words]
        };
      }
    });

    aiFeedbackState = {
      originalByColor,
      confirmedByColor,
      rejectedKeys: new Set(),
      allPuzzleWords: [
        ...new Set([
          ...indexedEntries
            .map(entry => entry.word)
            .filter(Boolean),
          ...Object.values(
            confirmedByColor
          )
            .flatMap(group =>
              group.words || []
            )
        ])
      ]
    };
  }

  function parseRgb(value) {
    const match =
      String(value || '').match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
      );

    if (!match) return null;

    return [
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    ];
  }

  function nearestConnectionsColor(rgb) {
    if (!rgb) return null;

    const targets = {
      yellow: [249, 223, 109],
      green: [160, 195, 90],
      blue: [176, 196, 239],
      purple: [186, 129, 197]
    };

    let best = null;
    let bestDistance = Infinity;

    Object.entries(targets)
      .forEach(([name, target]) => {
        const distance =
          Math.sqrt(
            Math.pow(
              rgb[0] - target[0],
              2
            ) +
            Math.pow(
              rgb[1] - target[1],
              2
            ) +
            Math.pow(
              rgb[2] - target[2],
              2
            )
          );

        if (distance < bestDistance) {
          bestDistance = distance;
          best = name;
        }
      });

    return bestDistance <= 95
      ? best
      : null;
  }

  function inferNytGroupColor(container) {
    const elements = [
      container,
      ...container.querySelectorAll('*')
    ];

    let ancestor =
      container.parentElement;

    for (
      let depth = 0;
      ancestor &&
      depth < 5;
      depth += 1,
      ancestor = ancestor.parentElement
    ) {
      elements.push(ancestor);
    }

    for (const element of elements) {
      if (
        !element?.getClientRects?.()
          .length
      ) {
        continue;
      }

      const color =
        nearestConnectionsColor(
          parseRgb(
            window
              .getComputedStyle(element)
              .backgroundColor
          )
        );

      if (color) return color;
    }

    return null;
  }

  function inferNytGroupLabel(
    container,
    words
  ) {
    const normalizedWords =
      new Set(
        words.map(normalizeWord)
      );

    const ignored = [
      'CREATE FOUR GROUPS OF FOUR!',
      'MISTAKES REMAINING:',
      'SHUFFLE',
      'DESELECT ALL',
      'SUBMIT'
    ];

    const candidates = [
      container,
      ...container.querySelectorAll('*')
    ]
      .filter(element =>
        element.getClientRects().length
      )
      .map(element =>
        element.textContent?.trim()
      )
      .filter(Boolean)
      .filter((text, index, array) =>
        array.indexOf(text) === index
      )
      .filter(text => {
        const normalized =
          normalizeWord(text);

        if (
          normalizedWords.has(
            normalized
          )
        ) {
          return false;
        }

        if (
          ignored.includes(
            normalized
          )
        ) {
          return false;
        }

        const wordHits =
          words.filter(word =>
            normalized.includes(
              normalizeWord(word)
            )
          ).length;

        return (
          text.length >= 3 &&
          text.length <= 120 &&
          wordHits <= 1
        );
      })
      .sort(
        (a, b) =>
          a.length - b.length
      );

    return (
      candidates[0] ||
      'NYT confirmed group'
    );
  }

  function findNytSolvedGroupInfo(words) {
    const root =
      document.querySelector(
        '#pz-game-root'
      );

    if (!root) {
      return {
        color: null,
        label: 'NYT confirmed group'
      };
    }

    const normalizedWords =
      words.map(normalizeWord);

    const candidates = [
      ...root.querySelectorAll(
        'div, section, article, li'
      )
    ]
      .filter(element =>
        element.getClientRects().length
      )
      .filter(element => {
        const text =
          normalizeWord(
            element.textContent
          );

        return normalizedWords
          .every(word =>
            text.includes(word)
          );
      })
      .sort((a, b) => {
        const aText =
          a.textContent?.trim()
            .length || Infinity;

        const bText =
          b.textContent?.trim()
            .length || Infinity;

        if (aText !== bText) {
          return aText - bText;
        }

        const aRect =
          a.getBoundingClientRect();

        const bRect =
          b.getBoundingClientRect();

        return (
          aRect.width * aRect.height -
          bRect.width * bRect.height
        );
      });

    const container =
      candidates[0] || root;

    return {
      color:
        inferNytGroupColor(
          container
        ),
      label:
        inferNytGroupLabel(
          container,
          words
        )
    };
  }

  function getAiCardState(color) {
    if (!aiFeedbackState) {
      return null;
    }

    const original =
      aiFeedbackState
        .originalByColor[color];

    const actual =
      aiFeedbackState
        .confirmedByColor[color];

    if (actual) {
      const actualKey =
        wordSetKey(actual.words);

      const sourceEntry =
        Object.entries(
          aiFeedbackState
            .originalByColor
        ).find(([, group]) =>
          wordSetKey(group.words) ===
          actualKey
        );

      const sourceColor =
        sourceEntry?.[0] || null;

      if (
        sourceColor === color
      ) {
        return {
          group: actual,
          status: 'confirmed',
          statusText:
            '✓ NYT CONFIRMED',
          note:
            'The AI grouping matched the NYT result.'
        };
      }

      if (sourceColor) {
        return {
          group: actual,
          status: 'confirmed',
          statusText:
            '✓ NYT CONFIRMED',
          note:
            'AI originally assigned this group to ' +
            sourceColor.toUpperCase() +
            '.'
        };
      }

      if (!original) {
        return {
          group: actual,
          status: 'confirmed',
          statusText:
            '✓ NYT CONFIRMED',
          note:
            'Already solved by NYT before this AI pass.'
        };
      }

      return {
        group: actual,
        status: 'corrected',
        statusText:
          'OOPS — NYT ACTUALLY',
        note:
          'The AI had guessed “' +
          original.label +
          '” for this color.'
      };
    }

    if (!original) {
      return null;
    }

    const originalKey =
      wordSetKey(
        original.words
      );

    const movedEntry =
      Object.entries(
        aiFeedbackState
          .confirmedByColor
      ).find(([, group]) =>
        wordSetKey(group.words) ===
        originalKey
      );

    if (movedEntry) {
      return {
        group: original,
        status: 'moved',
        statusText:
          'AI COLOR GUESS WRONG',
        note:
          '→ NYT SAYS ' +
          movedEntry[0].toUpperCase()
      };
    }

    if (
      aiFeedbackState
        .rejectedKeys
        .has(originalKey)
    ) {
      return {
        group: original,
        status: 'rejected',
        statusText:
          '✕ REJECTED BY NYT',
        note:
          'Oops — NYT rejected this four-word grouping.'
      };
    }

    return {
      group: original,
      status: 'guess',
      statusText: '',
      note:
        original.explanation
    };
  }

  function rerenderAiFeedback() {
    if (!aiFeedbackState) return;

    const entries =
      getTileEntries();

    const indexedEntries =
      Object.values(
        aiFeedbackState
          .originalByColor
      )
        .flatMap(group =>
          group.tile_ids.map(
            (id, index) => ({
              id,
              word:
                group.words[index]
            })
          )
        );

    renderAiSummary(
      AI_COLOR_ORDER
        .map(color =>
          aiFeedbackState
            .originalByColor[color]
        )
        .filter(Boolean),
      indexedEntries,
      null,
      true
    );
  }

  function getOriginalAiWords() {
    if (!aiFeedbackState) {
      return [];
    }

    if (
      Array.isArray(
        aiFeedbackState
          .allPuzzleWords
      ) &&
      aiFeedbackState
        .allPuzzleWords
        .length
    ) {
      return [
        ...aiFeedbackState
          .allPuzzleWords
      ];
    }

    return [
      ...new Set(
        Object.values(
          aiFeedbackState
            .originalByColor
        )
          .flatMap(group =>
            group.words || []
          )
          .filter(Boolean)
      )
    ];
  }

  function extractConfirmedWords(
    element
  ) {
    const textCandidates = [
      element.innerText || '',
      ...[
        ...element.querySelectorAll(
          '*'
        )
      ]
        .filter(node =>
          node.getClientRects().length
        )
        .map(node =>
          node.textContent?.trim() ||
          ''
        )
    ]
      .map(text =>
        text.trim()
      )
      .filter(Boolean);

    for (
      const text of
        textCandidates
    ) {
      const lines =
        text.split(/\n+/)
          .map(line =>
            line.trim()
          )
          .filter(Boolean);

      for (const line of lines) {
        const words =
          line.split(',')
            .map(word =>
              word.trim()
            )
            .filter(Boolean);

        if (
          words.length === 4 &&
          words.every(
            word =>
              word.length > 0 &&
              word.length <= 100
          )
        ) {
          return words;
        }
      }
    }

    return [];
  }

  function getNytConfirmedGroupsFromBoard() {
    const root =
      document.querySelector(
        '#pz-game-root'
      );

    if (!root) return [];

    const visibleElements = [
      root,
      ...root.querySelectorAll('*')
    ]
      .filter(element =>
        element.getClientRects().length
      );

    const candidates = [];

    visibleElements.forEach(
      element => {
        const directColor =
          nearestConnectionsColor(
            parseRgb(
              window
                .getComputedStyle(
                  element
                )
                .backgroundColor
            )
          );

        if (!directColor) {
          return;
        }

        const searchBlocks = [
          element
        ];

        let parent =
          element.parentElement;

        for (
          let depth = 0;
          parent &&
          parent !== root &&
          depth < 3;
          depth += 1,
          parent =
            parent.parentElement
        ) {
          searchBlocks.push(parent);
        }

        for (
          const block of
            searchBlocks
        ) {
          const words =
            extractConfirmedWords(
              block
            );

          if (
            words.length !== 4
          ) {
            continue;
          }

          const rect =
            block
              .getBoundingClientRect();

          candidates.push({
            element: block,
            color: directColor,
            words,
            label:
              inferNytGroupLabel(
                block,
                words
              ),
            textLength:
              block.textContent
                ?.trim()
                .length ||
              Infinity,
            area:
              rect.width *
              rect.height
          });

          break;
        }
      }
    );

    // Fallback for NYT markup where the
    // colored background sits on an
    // ancestor/descendant separate from
    // the text block.
    visibleElements
      .filter(element =>
        /div|section|article|li/i
          .test(
            element.tagName
          )
      )
      .forEach(element => {
        const words =
          extractConfirmedWords(
            element
          );

        if (
          words.length !== 4
        ) {
          return;
        }

        const color =
          inferNytGroupColor(
            element
          );

        if (!color) return;

        const rect =
          element
            .getBoundingClientRect();

        candidates.push({
          element,
          color,
          words,
          label:
            inferNytGroupLabel(
              element,
              words
            ),
          textLength:
            element.textContent
              ?.trim()
              .length ||
            Infinity,
          area:
            rect.width *
            rect.height
        });
      });

    const bestByColor = {};

    candidates.forEach(
      candidate => {
        const current =
          bestByColor[
            candidate.color
          ];

        if (
          !current ||
          candidate.textLength <
            current.textLength ||
          (
            candidate.textLength ===
              current.textLength &&
            candidate.area <
              current.area
          )
        ) {
          bestByColor[
            candidate.color
          ] = candidate;
        }
      }
    );

    return AI_COLOR_ORDER
      .map(color =>
        bestByColor[color]
      )
      .filter(Boolean)
      .map(candidate => ({
        color:
          candidate.color,
        label:
          candidate.label ||
          'NYT confirmed group',
        words:
          [...candidate.words]
      }));
  }

  function scanNytConfirmedGroups() {
    if (!aiFeedbackState) return;

    const confirmed =
      getNytConfirmedGroupsFromBoard();

    if (!confirmed.length) {
      return;
    }

    let changed = false;

    confirmed.forEach(group => {
      const existing =
        aiFeedbackState
          .confirmedByColor[
            group.color
          ];

      const nextKey =
        wordSetKey(
          group.words
        );

      const existingKey =
        existing
          ? wordSetKey(
              existing.words
            )
          : '';

      if (
        nextKey !== existingKey ||
        group.label !==
          existing?.label
      ) {
        aiFeedbackState
          .confirmedByColor[
            group.color
          ] = {
            color:
              group.color,
            words:
              [...group.words],
            label:
              group.label
          };

        aiFeedbackState
          .rejectedKeys
          .delete(nextKey);

        changed = true;
      }
    });

    if (changed) {
      rerenderAiFeedback();
    }
  }

  function getClickedTileWord(target) {
    const direct =
      target?.closest?.(
        '[data-testid="card-label"][data-flip-id]'
      );

    if (direct) {
      return direct
        .getAttribute(
          'data-flip-id'
        )
        ?.trim() || '';
    }

    const host =
      target?.closest?.(
        'button, [role="button"], label'
      );

    const nested =
      host?.querySelector?.(
        '[data-testid="card-label"][data-flip-id]'
      );

    if (nested) {
      return nested
        .getAttribute(
          'data-flip-id'
        )
        ?.trim() || '';
    }

    return '';
  }

  function trackTileSelectionClick(
    target
  ) {
    const word =
      getClickedTileWord(
        target
      );

    if (!word) return false;

    if (
      trackedSelectedWords
        .has(word)
    ) {
      trackedSelectedWords
        .delete(word);
    } else {
      trackedSelectedWords
        .add(word);
    }

    return true;
  }

  function recordNytConfirmedGroup(
    words
  ) {
    if (!aiFeedbackState) return;

    const key =
      wordSetKey(words);

    const authoritative =
      getNytConfirmedGroupsFromBoard()
        .find(group =>
          wordSetKey(
            group.words
          ) === key
        );

    const info =
      authoritative ||
      findNytSolvedGroupInfo(
        words
      );

    let color =
      info.color;

    if (!color) {
      const matchingOriginal =
        Object.entries(
          aiFeedbackState
            .originalByColor
        ).find(([, group]) =>
          wordSetKey(group.words) ===
          key
        );

      color =
        matchingOriginal?.[0] ||
        AI_COLOR_ORDER.find(
          name =>
            !aiFeedbackState
              .confirmedByColor[name]
        );
    }

    if (!color) return;

    aiFeedbackState
      .confirmedByColor[color] = {
        color,
        words: [...words],
        label:
          info.label ||
          'NYT confirmed group'
      };

    aiFeedbackState
      .rejectedKeys
      .delete(key);

    rerenderAiFeedback();
  }

  function recordNytRejectedGroup(
    words
  ) {
    if (!aiFeedbackState) return;

    aiFeedbackState
      .rejectedKeys
      .add(
        wordSetKey(words)
      );

    rerenderAiFeedback();
  }

  function parseCssRgb(value) {
    const match =
      String(value || '').match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/
      );

    if (!match) return null;

    return {
      red: Number(match[1]),
      green: Number(match[2]),
      blue: Number(match[3]),
      alpha:
        match[4] === undefined
          ? 1
          : Number(match[4])
    };
  }

  function getVisuallySelectedWords() {
    return getTileEntries()
      .filter(entry => {
        const host =
          getTileHost(
            entry.element
          );

        if (!host) return false;

        const style =
          window.getComputedStyle(host);

        const rgb =
          parseCssRgb(
            style.backgroundColor
          );

        if (
          !rgb ||
          rgb.alpha <= 0
        ) {
          return false;
        }

        const luminance =
          (
            0.2126 * rgb.red +
            0.7152 * rgb.green +
            0.0722 * rgb.blue
          );

        return luminance < 165;
      })
      .map(entry =>
        entry.word?.trim()
      )
      .filter(Boolean);
  }

  function getMistakesRemainingCount() {
    const root =
      document.querySelector(
        '#pz-game-root'
      );

    if (!root) return null;

    const elements = [
      ...root.querySelectorAll('*')
    ];

    const label =
      elements.find(element => {
        const text =
          element.textContent
            ?.trim();

        return (
          text ===
            'Mistakes Remaining:' ||
          text ===
            'Mistakes Remaining'
        );
      });

    if (!label) return null;

    const directMatch =
      label.textContent
        ?.match(
          /Mistakes Remaining:\s*(\d+)/
        );

    if (directMatch) {
      return Number(
        directMatch[1]
      );
    }

    let node =
      label.parentElement;

    for (
      let depth = 0;
      node &&
      depth < 4;
      depth += 1,
      node = node.parentElement
    ) {
      const ariaCandidates = [
        ...node.querySelectorAll(
          '[aria-label], [title]'
        )
      ];

      for (
        const candidate of
          ariaCandidates
      ) {
        const text = (
          candidate.getAttribute(
            'aria-label'
          ) ||
          candidate.getAttribute(
            'title'
          ) ||
          ''
        );

        const match =
          text.match(
            /mistake[^0-9]*(\d+)/i
          );

        if (match) {
          return Number(
            match[1]
          );
        }
      }

      const dots = [
        ...node.querySelectorAll('*')
      ]
        .filter(element => {
          if (
            element === label ||
            element.contains(label)
          ) {
            return false;
          }

          if (
            !element
              .getClientRects()
              .length
          ) {
            return false;
          }

          if (
            element.children.length
          ) {
            return false;
          }

          const rect =
            element
              .getBoundingClientRect();

          if (
            rect.width < 6 ||
            rect.width > 24 ||
            rect.height < 6 ||
            rect.height > 24 ||
            Math.abs(
              rect.width -
              rect.height
            ) > 5
          ) {
            return false;
          }

          const style =
            window.getComputedStyle(
              element
            );

          const rgb =
            parseCssRgb(
              style.backgroundColor
            );

          if (
            !rgb ||
            rgb.alpha <= 0
          ) {
            return false;
          }

          const radius =
            parseFloat(
              style.borderRadius
            ) || 0;

          return (
            radius >=
            Math.min(
              rect.width,
              rect.height
            ) * 0.3
          );
        });

      if (
        dots.length >= 0 &&
        dots.length <= 4
      ) {
        if (
          dots.length > 0 ||
          depth >= 1
        ) {
          return dots.length;
        }
      }
    }

    return null;
  }

  function processPendingNytSubmission() {
    if (!pendingNytSubmission) {
      return;
    }

    const elapsed =
      Date.now() -
      pendingNytSubmission.startedAt;

    const pendingWords =
      pendingNytSubmission
        .words;

    const pendingKey =
      wordSetKey(
        pendingWords
      );

    // Accepted NYT groups are
    // authoritative. Check for a solved
    // colored block before inferring a
    // rejection from any other signal.
    const solvedGroup =
      getNytConfirmedGroupsFromBoard()
        .find(group =>
          wordSetKey(
            group.words
          ) === pendingKey
        );

    if (solvedGroup) {
      pendingNytSubmission = null;
      trackedSelectedWords.clear();

      aiFeedbackState
        .confirmedByColor[
          solvedGroup.color
        ] = {
          color:
            solvedGroup.color,
          words:
            [...solvedGroup.words],
          label:
            solvedGroup.label
        };

      aiFeedbackState
        .rejectedKeys
        .delete(pendingKey);

      rerenderAiFeedback();
      return;
    }

    const currentWords =
      visiblePuzzleWords();

    const currentSet =
      new Set(
        currentWords.map(
          normalizeWord
        )
      );

    const removed =
      pendingNytSubmission
        .beforeWords
        .filter(word =>
          !currentSet.has(
            normalizeWord(word)
          )
        );

    if (removed.length === 4) {
      pendingNytSubmission = null;
      trackedSelectedWords.clear();

      window.setTimeout(
        () =>
          recordNytConfirmedGroup(
            removed
          ),
        120
      );

      return;
    }

    const currentMistakes =
      getMistakesRemainingCount();

    const mistakeDropped =
      Number.isInteger(
        pendingNytSubmission
          .beforeMistakes
      ) &&
      Number.isInteger(
        currentMistakes
      ) &&
      currentMistakes <
        pendingNytSubmission
          .beforeMistakes;

    if (mistakeDropped) {
      const rejected =
        pendingNytSubmission
          .words;

      pendingNytSubmission = null;
      trackedSelectedWords.clear();

      recordNytRejectedGroup(
        rejected
      );

      return;
    }

    // No time-based rejection fallback:
    // accepted groups can remain visible
    // while NYT animates them into the
    // solved-area block.
    if (elapsed < 6500) {
      feedbackCheckTimer =
        window.setTimeout(
          processPendingNytSubmission,
          300
        );
    } else {
      pendingNytSubmission = null;
      trackedSelectedWords.clear();

      // One last authoritative scan in
      // case NYT's animation settled late.
      scanNytConfirmedGroups();
    }
  }

  function captureNytSubmission() {
    if (!aiFeedbackState) return;

    let words =
      getSelectedWords();

    if (words.length !== 4) {
      words =
        getVisuallySelectedWords();
    }

    if (words.length !== 4) {
      return;
    }

    pendingNytSubmission = {
      words: [
        ...new Set(words)
      ],
      beforeWords:
        visiblePuzzleWords(),
      beforeMistakes:
        getMistakesRemainingCount(),
      startedAt: Date.now()
    };

    if (feedbackCheckTimer) {
      window.clearTimeout(
        feedbackCheckTimer
      );
    }

    feedbackCheckTimer =
      window.setTimeout(
        processPendingNytSubmission,
        350
      );
  }

  function createAiSummaryCard(
    group,
    wordById,
    cardState = null
  ) {
    const color =
      AI_COLORS[group.color] ||
      '#cccccc';

    const card =
      document.createElement('section');

    card.className =
      'swiftclick-ai-summary-card';

    Object.assign(card.style, {
      border: '1px solid #e2e2e2',
      borderRadius: '10px',
      overflow: 'hidden',
      background:
        cardState?.status === 'moved'
          ? '#fafafa'
          : '#fff',
      display: 'flex',
      flexDirection: 'column',
      minWidth: '0',
      opacity:
        cardState?.status === 'moved'
          ? '0.88'
          : '1'
    });

    const stripe =
      document.createElement('div');

    Object.assign(stripe.style, {
      height: '5px',
      flex: '0 0 auto',
      background: color
    });

    const body =
      document.createElement('div');

    Object.assign(body.style, {
      padding: '9px 9px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minWidth: '0'
    });

    const status =
      cardState?.status || 'guess';

    const colorName =
      document.createElement('div');

    colorName.textContent =
      group.color.toUpperCase();

    Object.assign(colorName.style, {
      color,
      fontWeight: '850',
      fontSize: '11px',
      letterSpacing: '.05em',
      lineHeight: '1.1'
    });

    const label =
      document.createElement('div');

    label.textContent =
      group.label;

    Object.assign(label.style, {
      fontWeight: '800',
      fontSize: '13px',
      lineHeight: '1.18',
      minHeight:
        status === 'moved'
          ? '0'
          : '31px'
    });

    const statusLine =
      document.createElement('div');

    if (cardState?.statusText) {
      statusLine.textContent =
        cardState.statusText;

      Object.assign(
        statusLine.style,
        {
          fontWeight: '850',
          fontSize: '9.5px',
          letterSpacing: '.025em',
          lineHeight: '1.15',
          color:
            status === 'rejected' ||
            status === 'corrected'
              ? '#9b2c2c'
              : status === 'moved'
                ? '#7a5b00'
                : '#555'
        }
      );
    }

    const wordGrid =
      document.createElement('div');

    Object.assign(wordGrid.style, {
      display: 'grid',
      gridTemplateColumns:
        'repeat(2, minmax(0, 1fr))',
      gridTemplateRows:
        'repeat(2, auto)',
      gap: '5px',
      marginTop: '1px'
    });

    const displayWords =
      Array.isArray(group.words)
        ? group.words
        : group.tile_ids.map(
            id =>
              wordById.get(id) || id
          );

    displayWords.forEach(
      (word, index) => {
        const chip =
          document.createElement('div');

        chip.textContent =
          word;

        Object.assign(chip.style, {
          padding: '6px 5px',
          borderRadius: '7px',
          border:
            '1px solid ' + color,
          background:
            hexToRgba(color, 0.14),
          fontWeight: '800',
          fontSize: '11px',
          lineHeight: '1.15',
          textAlign: 'center',
          minWidth: '0',
          overflowWrap: 'anywhere'
        });

        const column =
          index < 2 ? 1 : 2;

        const row =
          index % 2 + 1;

        chip.style.gridColumn =
          String(column);

        chip.style.gridRow =
          String(row);

        wordGrid.appendChild(chip);
      }
    );

    const explanation =
      document.createElement('div');

    explanation.textContent =
      cardState?.note ||
      group.explanation ||
      '';

    Object.assign(explanation.style, {
      color:
        status === 'moved'
          ? '#444'
          : '#666',
      fontSize:
        status === 'moved'
          ? '11px'
          : '10.5px',
      fontWeight:
        status === 'moved'
          ? '800'
          : '400',
      lineHeight: '1.25',
      marginTop: '1px'
    });

    body.append(
      colorName
    );

    if (cardState?.statusText) {
      body.appendChild(
        statusLine
      );
    }

    body.appendChild(
      label
    );

    if (status !== 'moved') {
      body.appendChild(
        wordGrid
      );
    }

    body.appendChild(
      explanation
    );

    card.append(
      stripe,
      body
    );

    return card;
  }

  function renderAiSummary(
    groups,
    indexedEntries,
    solution,
    preserveFeedbackState = false,
    confirmedGroups = []
  ) {
    ensureAiSummaryStyles();

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

    if (!preserveFeedbackState) {
      initializeAiFeedback(
        groups,
        indexedEntries,
        confirmedGroups
      );
    }

    const panel =
      document.createElement('div');

    panel.id =
      'categories-ai-results';

    Object.assign(panel.style, {
      width: 'min(980px, 96%)',
      margin: '2px auto 8px',
      padding: '11px',
      border: '1px solid #c8c8c8',
      borderRadius: '12px',
      background: '#fff',
      color: '#111',
      boxShadow:
        '0 2px 8px rgba(0,0,0,.08)',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
    });

    const heading =
      document.createElement('div');

    heading.textContent =
      'AI Best Guess';

    Object.assign(heading.style, {
      fontWeight: '800',
      fontSize: '15px',
      marginBottom: '8px'
    });

    const grid =
      document.createElement('div');

    grid.className =
      'swiftclick-ai-summary-grid';

    AI_COLOR_ORDER
      .forEach(color => {
        const cardState =
          getAiCardState(
            color
          );

        const group =
          cardState?.group ||
          aiFeedbackState
            ?.originalByColor
            ?.[color] ||
          aiFeedbackState
            ?.confirmedByColor
            ?.[color];

        if (!group) return;

        grid.appendChild(
          createAiSummaryCard(
            group,
            wordById,
            cardState
          )
        );
      });

    panel.append(
      heading,
      grid
    );

    toolbar.parentNode.insertBefore(
      panel,
      toolbar.nextSibling
    );

    window.requestAnimationFrame(() => {
      applyCompactGameLayout();
      updateToolbarPosition();
    });
  }

  function applyAiHints(
    solution,
    indexedEntries,
    confirmedGroups = []
  ) {
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
      solution,
      false,
      confirmedGroups
    );

    if (clearAiButton) {
      clearAiButton.disabled = false;
      clearAiButton.style.opacity = '1';
      clearAiButton.style.cursor = 'pointer';
    }
  }

  async function solveWithAi(button) {
    const entries = getTileEntries();

    if (
      ![4, 8, 12, 16]
        .includes(entries.length)
    ) {
      alert(
        'AI Solve needs 4, 8, 12, or 16 unsolved Connections tiles. The script currently sees ' +
        entries.length +
        ' tile' +
        (entries.length === 1 ? '' : 's') +
        '.'
      );
      return;
    }

    const confirmedGroups =
      getNytConfirmedGroupsFromBoard();

    const expectedSolvedGroups =
      (16 - entries.length) / 4;

    if (
      entries.length < 16 &&
      confirmedGroups.length <
        expectedSolvedGroups
    ) {
      showToast(
        'Continuing from the ' +
        entries.length +
        ' remaining tiles. Some already-solved NYT group details could not be read, so color tracking may be incomplete.'
      );
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
          indexedEntries,
          confirmedGroups
        );

      validateAiSolution(
        solution,
        indexedEntries,
        confirmedGroups
      );

      applyAiHints(
        solution,
        indexedEntries,
        confirmedGroups
      );

      showToast(
        entries.length === 16
          ? 'AI solution received. No guesses were submitted.'
          : 'AI picked up the puzzle in progress and solved the remaining ' +
            entries.length +
            ' tiles. No guesses were submitted.'
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

  function findPuzzleInstruction(root) {
    const targetText =
      'Create four groups of four!';

    const candidates = [
      ...root.querySelectorAll(
        'div, p, span'
      )
    ]
      .filter(element => {
        if (
          element.textContent?.trim() !==
          targetText
        ) {
          return false;
        }

        return Boolean(
          element.getClientRects().length
        );
      })
      .sort(
        (a, b) =>
          a.children.length -
          b.children.length
      );

    return candidates[0] || null;
  }

  function resetCompactGameShift() {
    const root =
      document.querySelector(
        '#pz-game-root'
      );

    if (!root) return;

    root.style.removeProperty(
      'position'
    );

    root.style.removeProperty(
      'top'
    );

    root.style.removeProperty(
      'margin-bottom'
    );

    root.removeAttribute(
      'data-swiftclick-root-shift'
    );
  }

  function applyCompactGameLayout() {
    resetCompactGameShift();

    const root =
      document.querySelector(
        '#pz-game-root'
      );

    const slot =
      document.querySelector(
        '#categories-gpt-tools-slot'
      );

    if (!root || !slot) return;

    const board =
      getBoardContainer();

    if (!board) return;

    const boardRect =
      board.getBoundingClientRect();

    const slotRect =
      slot.getBoundingClientRect();

    const desiredBoardTop =
      slotRect.bottom + 68;

    const shift =
      Math.max(
        0,
        Math.round(
          boardRect.top -
          desiredBoardTop
        )
      );

    if (shift < 8) return;

    root.setAttribute(
      'data-swiftclick-root-shift',
      String(shift)
    );

    root.style.setProperty(
      'position',
      'relative',
      'important'
    );

    root.style.setProperty(
      'top',
      '-' + shift + 'px',
      'important'
    );

    root.style.setProperty(
      'margin-bottom',
      '-' + shift + 'px',
      'important'
    );
  }

  function preserveNytTitleBar() {
    const titleBar =
      document.querySelector(
        '#connections-container .pz-game-title-bar'
      );

    const titleHeader =
      document.querySelector(
        '#portal-game-header'
      );

    if (titleBar) {
      titleBar.style.setProperty(
        'display',
        'block',
        'important'
      );

      titleBar.style.setProperty(
        'visibility',
        'visible',
        'important'
      );

      titleBar.style.setProperty(
        'opacity',
        '1',
        'important'
      );

      titleBar.style.setProperty(
        'position',
        'relative',
        'important'
      );

      titleBar.style.setProperty(
        'z-index',
        '30',
        'important'
      );
    }

    if (titleHeader) {
      titleHeader.style.setProperty(
        'visibility',
        'visible',
        'important'
      );

      titleHeader.style.setProperty(
        'opacity',
        '1',
        'important'
      );
    }
  }

  function updateToolbarPosition() {
    const root =
      document.querySelector(
        '#pz-game-root'
      );

    const container =
      document.querySelector(
        '#connections-container'
      );

    const wrapper =
      document.querySelector(
        '#js-hook-game-wrapper'
      );

    const slot =
      document.querySelector(
        '#categories-gpt-tools-slot'
      );

    if (
      !root ||
      !container ||
      !wrapper ||
      !slot
    ) {
      return;
    }

    preserveNytTitleBar();

    if (
      slot.parentNode !== container ||
      slot.nextSibling !== wrapper
    ) {
      container.insertBefore(
        slot,
        wrapper
      );
    }

    Object.assign(slot.style, {
      position: 'relative',
      width: '100%',
      left: '',
      top: '',
      zIndex: '20',
      margin: '0 auto 18px',
      padding: '0',
      background: '#fff'
    });

    window.requestAnimationFrame(
      applyCompactGameLayout
    );
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
      margin: '0 auto',
      padding: '2px 8px 4px',
      position: 'relative',
      zIndex: '2',
      background: '#fff'
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

    const slot = document.createElement('div');
    slot.id = 'categories-gpt-tools-slot';

    Object.assign(slot.style, {
      display: 'block',
      boxSizing: 'border-box',
      clear: 'both'
    });

    slot.appendChild(toolbar);
    document.body.appendChild(slot);

    updateToolbarPosition();

    if (
      typeof ResizeObserver === 'function'
    ) {
      const toolbarResizeObserver =
        new ResizeObserver(
          updateToolbarPosition
        );

      toolbarResizeObserver.observe(slot);
    }

    window.addEventListener(
      'resize',
      updateToolbarPosition
    );
  }

  document.addEventListener(
    'click',
    event => {
      trackTileSelectionClick(
        event.target
      );

      const button =
        event.target?.closest?.(
          'button'
        );

      if (!button) return;

      const buttonText =
        button.textContent
          ?.trim()
          .toLowerCase() || '';

      if (
        buttonText ===
        'deselect all'
      ) {
        trackedSelectedWords
          .clear();

        return;
      }

      if (
        buttonText !==
        'submit'
      ) {
        return;
      }

      captureNytSubmission();
    },
    true
  );

  const observer = new MutationObserver(() => {
    addToolbar();

    if (pendingNytSubmission) {
      window.setTimeout(
        processPendingNytSubmission,
        80
      );
    }

    window.setTimeout(
      scanNytConfirmedGroups,
      120
    );

    window.requestAnimationFrame(() => {
      applyCompactGameLayout();
      updateToolbarPosition();
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  addToolbar();
})();
