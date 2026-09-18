// ==UserScript==
// @name         Cielo Home Climate Snapshot
// @namespace    ted-cielo-tools
// @version      1.7
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/cielo-home-climate-snapshot.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/cielo-home-climate-snapshot.user.js
// @description  Adds a polished household summary card, scenes, quick toggles, and home weather to the Cielo Home dashboard
// @match        https://home.cielowigle.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const APP_VERSION = '1.7';

  const CARD_ID = 'tedd-climate-card';
  const STYLE_ID = 'tedd-climate-style';
  const DEBUG_STYLE_ID = 'tedd-climate-debug-style';
  const DEBUG_ERROR_ID = 'tedd-climate-debug-error';
  const HOME_ZIP = '11375';
  const WEATHER_REFRESH_MS = 15 * 60 * 1000;

  // Visual defaults are intentionally restrained so the added UI feels native.
  // We still derive the live card treatment from the page when possible.
  const DESIGN_DEFAULTS = {
    radius: '10px',
    borderColor: '#e2edf3',
    shadow: '0 2px 8px rgba(41, 73, 107, 0.08)',
    softShadow: '0 1px 4px rgba(41, 73, 107, 0.06)',
    background: '#ffffff',
    surface: '#f8fbfd',
    text: '#1f3950',
    textMuted: '#668197',
    label: '#6d8aa0',
    blue: '#0b7fab',
    blueSoft: '#edf7fd',
    green: '#1f8b4c',
    greenSoft: '#eef9f1',
    orange: '#d97706',
    orangeSoft: '#fff7ed',
    violet: '#6d4dd8',
    violetSoft: '#f5f1ff',
    red: '#dc2626',
    redSoft: '#fff4f4',
    spacing: '14px',
    iconSize: '20px'
  };

  let renderTimer = null;
  const deviceToggleBusy = new Map();
  let bulkToggleBusy = false;
  let sceneBusy = false;
  let modeTestBusy = false;

  const weatherState = {
    status: 'idle',
    currentTempF: null,
    currentWeatherCode: null,
    currentCondition: '',
    tomorrowSummary: '',
    tomorrowHigh: null,
    tomorrowLow: null,
    lastFetchMs: 0,
    coordsKey: '',
    locationLabel: `ZIP ${HOME_ZIP}`
  };

  let pageBackgroundColor = '#f3f4f6';

  function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function parseNumber(text, regex) {
    const match = cleanText(text).match(regex);
    return match ? Number(match[1]) : null;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function ensureDebugUi() {
    if (!document.head) return;

    let styleTag = document.getElementById(DEBUG_STYLE_ID);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = DEBUG_STYLE_ID;
      styleTag.textContent = `
        #${DEBUG_ERROR_ID} {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 12px;
          z-index: 999998;
          max-width: 760px;
          margin: 0 auto;
          padding: 12px 14px;
          border-radius: 10px;
          background: #fff4f4;
          color: #8a1f1f;
          border: 1px solid #f1b9b9;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          font: 600 12px/1.4 system-ui, sans-serif;
          white-space: pre-wrap;
        }
      `;
      document.head.appendChild(styleTag);
    }
  }

  function setDebugStatus(_message) {}

  function showDebugError(error) {
    ensureDebugUi();
    let panel = document.getElementById(DEBUG_ERROR_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = DEBUG_ERROR_ID;
      document.body.appendChild(panel);
    }

    const message = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
    panel.textContent = `Home Climate Snapshot error\n${message}`;
  }

  function weatherCodeToText(code) {
    const map = {
      0: 'Clear',
      1: 'Mostly Clear',
      2: 'Partly Cloudy',
      3: 'Cloudy',
      45: 'Fog',
      48: 'Fog',
      51: 'Light Drizzle',
      53: 'Drizzle',
      55: 'Heavy Drizzle',
      56: 'Freezing Drizzle',
      57: 'Freezing Drizzle',
      61: 'Light Rain',
      63: 'Rain',
      65: 'Heavy Rain',
      66: 'Freezing Rain',
      67: 'Freezing Rain',
      71: 'Light Snow',
      73: 'Snow',
      75: 'Heavy Snow',
      77: 'Snow',
      80: 'Rain Showers',
      81: 'Showers',
      82: 'Heavy Showers',
      85: 'Snow Showers',
      86: 'Snow Showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm',
      99: 'Thunderstorm'
    };
    return map[code] || 'Forecast Unavailable';
  }

  function getWeatherKind(code) {
    if ([0, 1].includes(code)) return 'sun';
    if ([2, 3].includes(code)) return 'cloud-sun';
    if ([45, 48].includes(code)) return 'cloud';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'cloud-rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowflake';
    if ([95, 96, 99].includes(code)) return 'zap';
    return 'cloud';
  }

  // Inline SVG icons keep the script self-contained and avoid a runtime icon dependency.
  function iconSvg(name, className = '') {
    const cls = className ? ` class="${className}"` : '';
    const common = `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
    const icons = {
      house: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M3 11.5 12 4l9 7.5"/><path ${common} d="M5 10.5V20h14v-9.5"/><path ${common} d="M10 20v-6h4v6"/></svg>`,
      monitor: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><rect ${common} x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="17" r="1" fill="currentColor"/><path ${common} d="M9 7h6"/></svg>`,
      plug: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M12 3v7"/><path ${common} d="M8 3v7"/><path ${common} d="M16 3v7"/><path ${common} d="M8 10h8v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4z"/><path ${common} d="M12 16v5"/></svg>`,
      thermometer: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0z"/><path ${common} d="M12 9v8"/></svg>`,
      droplets: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>`,
      gauge: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M4.93 19a10 10 0 1 1 14.14 0"/><path ${common} d="M12 12 16 8"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
      sun: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><circle ${common} cx="12" cy="12" r="4"/><path ${common} d="M12 2v2"/><path ${common} d="M12 20v2"/><path ${common} d="m4.93 4.93 1.41 1.41"/><path ${common} d="m17.66 17.66 1.41 1.41"/><path ${common} d="M2 12h2"/><path ${common} d="M20 12h2"/><path ${common} d="m6.34 17.66-1.41 1.41"/><path ${common} d="m19.07 4.93-1.41 1.41"/></svg>`,
      snowflake: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M12 2v20"/><path ${common} d="m4.93 6 14.14 12"/><path ${common} d="m19.07 6-14.14 12"/><path ${common} d="m8 4 4 4 4-4"/><path ${common} d="m8 20 4-4 4 4"/><path ${common} d="m3 10 5 2-1 5"/><path ${common} d="m21 10-5 2 1 5"/></svg>`,
      power: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M12 2v10"/><path ${common} d="M6.2 6.2a8 8 0 1 0 11.6 0"/></svg>`,
      moon: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5z"/><path ${common} d="M17 4v2"/><path ${common} d="M18 5h-2"/></svg>`,
      cloud: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.7-1.7A4.5 4.5 0 0 0 6.5 19Z"/></svg>`,
      'cloud-sun': `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M12 5V3"/><path ${common} d="m7.05 6.05-1.4-1.4"/><path ${common} d="M5 11H3"/><path ${common} d="M19 11h2"/><path ${common} d="m16.95 6.05 1.4-1.4"/><circle ${common} cx="12" cy="11" r="4"/><path ${common} d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.7-1.7A4.5 4.5 0 0 0 6.5 19Z"/></svg>`,
      'cloud-rain': `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M17.5 16a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.7-1.7A4.5 4.5 0 0 0 6.5 16Z"/><path ${common} d="M8 18v3"/><path ${common} d="M12 18v3"/><path ${common} d="M16 18v3"/></svg>`,
      'plus-circle': `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><circle ${common} cx="12" cy="12" r="9"/><path ${common} d="M12 8v8"/><path ${common} d="M8 12h8"/></svg>`,
      fan: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><circle ${common} cx="12" cy="12" r="1.5"/><path ${common} d="M12 4c2.8 0 4 1.6 4 3.1 0 2.2-2 3.9-4 3.9 0-2.5-1.3-4.4-1.3-5.8C10.7 4.6 11.2 4 12 4Z"/><path ${common} d="M18.9 10c1.4 2.4.7 4.3-.6 5-1.9 1.1-4.4-.1-5.4-1.8 2.1-1.2 3.1-3.4 4.3-4.1.6-.4 1.3-.3 1.7.9Z"/><path ${common} d="M9.1 10c1.2.7 2.2 2.9 4.3 4.1-1 1.7-3.5 2.9-5.4 1.8-1.3-.7-2-2.6-.6-5 .4-1.2 1.1-1.3 1.7-.9Z"/></svg>`,
      briefcase: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M10 7V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"/><rect ${common} x="3" y="7" width="18" height="13" rx="2"/><path ${common} d="M3 12h18"/></svg>`,
      bed: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M2 10h20v8"/><path ${common} d="M4 10V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3"/><path ${common} d="M22 18H2"/><path ${common} d="M2 6v12"/></svg>`,
      sofa: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path ${common} d="M3 11h18v6H3z"/><path ${common} d="M5 17v2"/><path ${common} d="M19 17v2"/></svg>`,
      palette: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 1 0 0-4.6H12a2.4 2.4 0 0 1 0-4.8h1.8A4.2 4.2 0 0 0 18 7.4 4.4 4.4 0 0 0 13.6 3Z"/><circle cx="6.5" cy="11.5" r="1" fill="currentColor"/><circle cx="9" cy="7.5" r="1" fill="currentColor"/><circle cx="14.5" cy="7.5" r="1" fill="currentColor"/></svg>`,
      warehouse: `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M3 10 12 4l9 6v10H3Z"/><path ${common} d="M8 14h8"/><path ${common} d="M8 18h8"/><path ${common} d="M8 10h8"/></svg>`,
      'arrow-right': `<svg viewBox="0 0 24 24" aria-hidden="true"${cls}><path ${common} d="M5 12h14"/><path ${common} d="m13 5 7 7-7 7"/></svg>`
    };
    return icons[name] || icons.house;
  }

  function getDeviceStyleSource() {
    return document.querySelector('app-devicecard .grid-item') ||
      document.querySelector('app-devicecard .deviceBody') ||
      document.querySelector('app-devicecard');
  }

  function isTooDarkBorder(color) {
    const match = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return false;
    const [, r, g, b] = match.map(Number);
    return r < 90 && g < 90 && b < 90;
  }

  function deriveDesignTokens() {
    const source = getDeviceStyleSource();
    if (!source) return DESIGN_DEFAULTS;

    const style = getComputedStyle(source);
    const pageBackgroundSource =
      document.querySelector('.deviceListContainer') ||
      document.querySelector('.ps-0.pe-0') ||
      document.querySelector('app-dashboard-layout') ||
      document.body;
    const pageBackgroundStyle = pageBackgroundSource ? getComputedStyle(pageBackgroundSource).backgroundColor : '';
    if (pageBackgroundStyle && pageBackgroundStyle !== 'transparent' && !pageBackgroundStyle.includes('0, 0, 0, 0')) {
      pageBackgroundColor = pageBackgroundStyle;
    }
    const sourceBorder = style.borderColor || '';
    const safeBorderColor =
      !sourceBorder ||
      sourceBorder === 'transparent' ||
      sourceBorder.includes('0, 0, 0, 0') ||
      isTooDarkBorder(sourceBorder)
        ? DESIGN_DEFAULTS.borderColor
        : sourceBorder;
    const sourceShadow = style.boxShadow || '';
    const safeShadow =
      !sourceShadow ||
      sourceShadow === 'none' ||
      sourceShadow.includes('rgba(0, 0, 0, 0)')
        ? DESIGN_DEFAULTS.shadow
        : sourceShadow;

    return {
      radius: style.borderRadius || DESIGN_DEFAULTS.radius,
      borderColor: safeBorderColor,
      shadow: safeShadow,
      softShadow: DESIGN_DEFAULTS.softShadow,
      background: style.backgroundColor || DESIGN_DEFAULTS.background,
      surface: DESIGN_DEFAULTS.surface,
      text: DESIGN_DEFAULTS.text,
      textMuted: DESIGN_DEFAULTS.textMuted,
      label: DESIGN_DEFAULTS.label,
      blue: DESIGN_DEFAULTS.blue,
      blueSoft: DESIGN_DEFAULTS.blueSoft,
      green: DESIGN_DEFAULTS.green,
      greenSoft: DESIGN_DEFAULTS.greenSoft,
      orange: DESIGN_DEFAULTS.orange,
      orangeSoft: DESIGN_DEFAULTS.orangeSoft,
      violet: DESIGN_DEFAULTS.violet,
      violetSoft: DESIGN_DEFAULTS.violetSoft,
      red: DESIGN_DEFAULTS.red,
      redSoft: DESIGN_DEFAULTS.redSoft,
      spacing: DESIGN_DEFAULTS.spacing,
      iconSize: DESIGN_DEFAULTS.iconSize
    };
  }

  function ensureStyles() {
    let styleTag = document.getElementById(STYLE_ID);
    const t = deriveDesignTokens();

    const css = `
      html, body {
        min-height: 100%;
        overflow-y: auto !important;
        background: ${pageBackgroundColor} !important;
      }
      app-dashboard-layout,
      app-dashboard-layout > div,
      app-dashboard-layout .mat-typography,
      app-dashboard-layout .container-fluid,
      app-dashboard-layout .deviceListContainer,
      app-dashboard-layout .homeScreen,
      app-dashboard-layout .homeScreen.homeScreenFullWidth,
      app-dashboard-layout .desktop,
      app-dashboard-layout .ps-0.pe-0 {
        height: auto !important;
        max-height: none !important;
        min-height: 0 !important;
        background: ${pageBackgroundColor} !important;
      }
      app-dashboard-layout .deviceListContainer,
      app-dashboard-layout .homeScreen,
      app-dashboard-layout .homeScreen.homeScreenFullWidth,
      app-dashboard-layout .desktop,
      app-dashboard-layout .ps-0.pe-0 {
        overflow: visible !important;
      }
      .tedd-climate-root {
        --tedd-radius: ${t.radius};
        --tedd-border: ${t.borderColor};
        --tedd-shadow: ${t.shadow};
        --tedd-shadow-soft: ${t.softShadow};
        --tedd-bg: ${t.background};
        --tedd-surface: ${t.surface};
        --tedd-text: ${t.text};
        --tedd-muted: ${t.textMuted};
        --tedd-label: ${t.label};
        --tedd-blue: ${t.blue};
        --tedd-blue-soft: ${t.blueSoft};
        --tedd-green: ${t.green};
        --tedd-green-soft: ${t.greenSoft};
        --tedd-orange: ${t.orange};
        --tedd-orange-soft: ${t.orangeSoft};
        --tedd-violet: ${t.violet};
        --tedd-violet-soft: ${t.violetSoft};
        --tedd-red: ${t.red};
        --tedd-red-soft: ${t.redSoft};
        --tedd-space: ${t.spacing};
        --tedd-icon-size: ${t.iconSize};
        margin: 18px 16px 28px 16px;
        padding: 22px;
        border-radius: var(--tedd-radius);
        background: linear-gradient(180deg, rgba(255,255,255,.99), rgba(249,252,254,.99));
        border: 1px solid var(--tedd-border);
        box-shadow: var(--tedd-shadow-soft);
        color: var(--tedd-text);
        font-family: inherit;
      }
      .tedd-climate-root * { box-sizing: border-box; }
      .tedd-climate-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(280px, 400px);
        gap: 20px;
        align-items: start;
      }
      .tedd-climate-title-wrap {
        display: flex;
        align-items: flex-start;
        gap: 18px;
        min-width: 0;
      }
      .tedd-climate-house {
        width: 56px;
        height: 56px;
        color: var(--tedd-blue);
        flex: 0 0 56px;
      }
      .tedd-climate-eyebrow,
      .tedd-climate-section-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: .05em;
        text-transform: uppercase;
        color: var(--tedd-label);
      }
      .tedd-climate-heading {
        font-size: clamp(28px, 3vw, 44px);
        line-height: 1.08;
        font-weight: 700;
        margin: 8px 0 10px;
        color: #132845;
      }
      .tedd-climate-subtitle {
        font-size: 16px;
        color: var(--tedd-muted);
      }
      .tedd-climate-weather {
        border: 1px solid var(--tedd-border);
        border-radius: var(--tedd-radius);
        background: linear-gradient(180deg, #fafdff, #f3f8fd);
        box-shadow: var(--tedd-shadow-soft);
        padding: 16px 18px;
        display: flex;
        gap: 14px;
        align-items: center;
        min-height: 110px;
      }
      .tedd-climate-weather-icon {
        width: 48px;
        height: 48px;
        color: var(--tedd-blue);
        flex: 0 0 48px;
      }
      .tedd-climate-weather-temp {
        font-size: 28px;
        font-weight: 700;
        color: #173153;
        line-height: 1;
      }
      .tedd-climate-weather-condition {
        font-size: 16px;
        color: #173153;
      }
      .tedd-climate-weather-sub {
        margin-top: 8px;
        font-size: 13px;
        color: var(--tedd-muted);
      }
      .tedd-climate-metrics {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 14px;
        margin-top: 22px;
      }
      .tedd-climate-metric-card,
      .tedd-climate-mini-card,
      .tedd-climate-secondary-band,
      .tedd-climate-weather {
        border-radius: var(--tedd-radius);
        border: 1px solid var(--tedd-border);
      }
      .tedd-climate-metric-card {
        background: var(--tedd-bg);
        box-shadow: 0 1px 3px rgba(41, 73, 107, 0.05);
        padding: 16px 16px 14px;
        min-height: 128px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .tedd-climate-metric-top {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .tedd-climate-metric-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid currentColor;
        opacity: .9;
      }
      .tedd-climate-metric-icon {
        width: var(--tedd-icon-size);
        height: var(--tedd-icon-size);
      }
      .tedd-climate-metric-label {
        font-size: 13px;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: .02em;
      }
      .tedd-climate-metric-value {
        font-size: 26px;
        font-weight: 700;
        color: #132845;
      }
      .tedd-climate-metric-sub {
        font-size: 12px;
        color: var(--tedd-muted);
      }
      .tedd-climate-metric-blue { color: var(--tedd-blue); background: linear-gradient(180deg, #fbfdff, var(--tedd-blue-soft)); }
      .tedd-climate-metric-green { color: var(--tedd-green); background: linear-gradient(180deg, #fbfffc, var(--tedd-green-soft)); }
      .tedd-climate-metric-violet { color: var(--tedd-violet); background: linear-gradient(180deg, #fff, var(--tedd-violet-soft)); }
      .tedd-climate-metric-orange { color: var(--tedd-orange); background: linear-gradient(180deg, #fff, var(--tedd-orange-soft)); }
      .tedd-climate-secondary-band {
        margin-top: 16px;
        background: var(--tedd-bg);
        box-shadow: 0 1px 3px rgba(41, 73, 107, 0.05);
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0;
        overflow: hidden;
      }
      .tedd-climate-secondary-item {
        padding: 18px 20px;
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 110px;
      }
      .tedd-climate-secondary-item + .tedd-climate-secondary-item {
        border-left: 1px solid var(--tedd-border);
      }
      .tedd-climate-secondary-icon {
        width: 32px;
        height: 32px;
        color: var(--tedd-blue);
        flex: 0 0 32px;
      }
      .tedd-climate-secondary-kicker {
        font-size: 12px;
        color: var(--tedd-label);
        text-transform: uppercase;
        font-weight: 700;
      }
      .tedd-climate-secondary-value {
        margin-top: 4px;
        font-size: 18px;
        color: #1a3253;
        font-weight: 700;
      }
      .tedd-climate-section {
        margin-top: 24px;
      }
      .tedd-climate-scene-list,
      .tedd-climate-toggle-list {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
      }
      .tedd-climate-btn {
        appearance: none;
        border: 1px solid var(--tedd-border);
        border-radius: var(--tedd-radius);
        background: var(--tedd-bg);
        color: var(--tedd-text);
        min-height: 44px;
        cursor: pointer;
        transition: background-color .18s ease, border-color .18s ease, box-shadow .18s ease, color .18s ease, transform .18s ease;
      }
      .tedd-climate-btn:hover:not(:disabled) {
        border-color: #c5d9e7;
        box-shadow: var(--tedd-shadow-soft);
      }
      .tedd-climate-btn:focus-visible {
        outline: 2px solid #7cbaf0;
        outline-offset: 2px;
      }
      .tedd-climate-btn:disabled {
        opacity: .72;
        cursor: wait;
      }
      .tedd-climate-scene-btn {
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 0 18px;
        min-width: 220px;
        min-height: 56px;
        font-size: 15px;
        font-weight: 700;
      }
      .tedd-climate-scene-btn--night { background: linear-gradient(135deg, #17396a, #274c87); color: #fff; border-color: transparent; }
      .tedd-climate-scene-btn--cool { background: linear-gradient(135deg, #1f91c2, #1780b0); color: #fff; border-color: transparent; }
      .tedd-climate-scene-btn--cooler { background: linear-gradient(135deg, #1670c9, #0a5f86); color: #fff; border-color: transparent; }
      .tedd-climate-scene-icon {
        width: 20px;
        height: 20px;
        flex: 0 0 20px;
      }
      .tedd-climate-scene-badge {
        padding: 5px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .03em;
        text-transform: uppercase;
        background: rgba(255,255,255,.16);
        border: 1px solid rgba(255,255,255,.25);
      }
      .tedd-climate-toggle-btn {
        min-width: 180px;
        min-height: 70px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--tedd-bg);
        box-shadow: 0 1px 3px rgba(41, 73, 107, 0.05);
      }
      .tedd-climate-toggle-btn[data-state="on"] {
        background: linear-gradient(180deg, #fbfffc, var(--tedd-green-soft));
        border-color: #d8eadb;
      }
      .tedd-climate-toggle-btn[data-state="off"] {
        background: linear-gradient(180deg, #fff, #f9fbfd);
      }
      .tedd-climate-toggle-icon-wrap {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--tedd-muted);
        background: #fff;
        border: 1px solid var(--tedd-border);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
      }
      .tedd-climate-toggle-btn[data-state="on"] .tedd-climate-toggle-icon-wrap {
        color: var(--tedd-green);
        border-color: #cae6d1;
      }
      .tedd-climate-toggle-icon {
        width: 18px;
        height: 18px;
      }
      .tedd-climate-toggle-name {
        font-size: 15px;
        font-weight: 600;
        text-align: left;
      }
      .tedd-climate-toggle-state {
        font-size: 13px;
        font-weight: 600;
        color: var(--tedd-muted);
      }
      .tedd-climate-toggle-btn[data-state="on"] .tedd-climate-toggle-state {
        color: var(--tedd-green);
      }
      .tedd-climate-global {
        margin-top: 18px;
        min-height: 78px;
        padding: 16px 18px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 18px;
        background: linear-gradient(180deg, #fff, #fff7f7);
        border-color: #f2d6d6;
      }
      .tedd-climate-global:hover:not(:disabled) {
        border-color: #ef9a9a;
      }
      .tedd-climate-global-icon-wrap {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #fff;
        color: var(--tedd-red);
        border: 1px solid #f4c6c6;
      }
      .tedd-climate-global-icon,
      .tedd-climate-global-arrow {
        width: 22px;
        height: 22px;
      }
      .tedd-climate-global-title {
        font-size: 18px;
        font-weight: 700;
        color: #172b49;
      }
      .tedd-climate-global-sub {
        margin-top: 4px;
        font-size: 13px;
        color: var(--tedd-muted);
      }
      .tedd-climate-global-arrow {
        color: var(--tedd-red);
      }
      .tedd-climate-muted-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(255,255,255,.18);
        border: 1px solid rgba(255,255,255,.35);
        color: inherit;
        font-size: 14px;
        font-weight: 700;
      }
      @media (max-width: 1200px) {
        .tedd-climate-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (max-width: 980px) {
        .tedd-climate-header { grid-template-columns: 1fr; }
        .tedd-climate-secondary-band { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .tedd-climate-secondary-item:nth-child(3) { border-left: none; border-top: 1px solid var(--tedd-border); }
        .tedd-climate-secondary-item:nth-child(4) { border-top: 1px solid var(--tedd-border); }
      }
      @media (max-width: 760px) {
        .tedd-climate-root { margin: 16px 10px 24px; padding: 16px; }
        .tedd-climate-title-wrap { gap: 12px; }
        .tedd-climate-house { width: 42px; height: 42px; flex-basis: 42px; }
        .tedd-climate-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .tedd-climate-secondary-band { grid-template-columns: 1fr; }
        .tedd-climate-secondary-item + .tedd-climate-secondary-item { border-left: none; border-top: 1px solid var(--tedd-border); }
        .tedd-climate-scene-btn,
        .tedd-climate-toggle-btn,
        .tedd-climate-global { width: 100%; min-width: 0; }
      }
      @media (max-width: 520px) {
        .tedd-climate-metrics { grid-template-columns: 1fr; }
      }
    `;

    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = STYLE_ID;
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = css;
  }

  function ensureSummaryCard() {
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('section');
      card.id = CARD_ID;
      card.className = 'tedd-climate-root';
      card.setAttribute('aria-label', 'Home Climate Snapshot');
    }

    const deviceListContainer = document.querySelector('.deviceListContainer');
    const dashboardRow =
      deviceListContainer?.closest('.row') ||
      document.querySelector('.deviceListContainer')?.parentElement?.closest('.row');
    const homeScreen =
      document.querySelector('.deviceListContainer .homeScreen') ||
      document.querySelector('.homeScreen.homeScreenFullWidth') ||
      document.querySelector('.homeScreen');

    const fallbackContainer =
      document.querySelector('.ps-0.pe-0') ||
      document.querySelector('app-root');

    if (dashboardRow?.parentNode) {
      const shouldMove =
        card.parentNode !== dashboardRow.parentNode ||
        card.previousElementSibling !== dashboardRow;

      if (shouldMove) {
        dashboardRow.insertAdjacentElement('afterend', card);
      }
    } else if (deviceListContainer?.parentNode) {
      const shouldMove =
        card.parentNode !== deviceListContainer.parentNode ||
        card.previousElementSibling !== deviceListContainer;

      if (shouldMove) {
        deviceListContainer.insertAdjacentElement('afterend', card);
      }
    } else if (homeScreen?.parentNode) {
      const shouldMove =
        card.parentNode !== homeScreen.parentNode ||
        card.previousElementSibling !== homeScreen;

      if (shouldMove) {
        homeScreen.insertAdjacentElement('afterend', card);
      }
    } else if (fallbackContainer) {
      if (card.parentNode !== fallbackContainer) {
        fallbackContainer.appendChild(card);
      }
    } else if (!card.parentNode) {
      document.body.appendChild(card);
    }

    return card;
  }

  async function fetchWeatherForHomeZip() {
    const now = Date.now();

    if (
      weatherState.status === 'ready' &&
      weatherState.coordsKey === HOME_ZIP &&
      now - weatherState.lastFetchMs < WEATHER_REFRESH_MS
    ) {
      return;
    }

    const geoResponse = await fetch(`https://api.zippopotam.us/us/${HOME_ZIP}`, { credentials: 'omit' });
    if (!geoResponse.ok) throw new Error(`ZIP lookup failed: ${geoResponse.status}`);

    const geoData = await geoResponse.json();
    const place = geoData.places?.[0];
    if (!place) throw new Error('ZIP lookup returned no places');

    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    weatherState.locationLabel = `${place['place name']}, ${place['state abbreviation'] || place.state}`;

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '2');
    url.searchParams.set('current', 'temperature_2m,weather_code');
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');

    const response = await fetch(url.toString(), { credentials: 'omit' });
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);

    const data = await response.json();
    const currentTempF = Math.round(data.current?.temperature_2m);
    const currentCode = Number(data.current?.weather_code ?? 0);
    const tomorrowCode = Number(data.daily?.weather_code?.[1] ?? 0);
    const tomorrowHigh = Math.round(data.daily?.temperature_2m_max?.[1]);
    const tomorrowLow = Math.round(data.daily?.temperature_2m_min?.[1]);

    weatherState.status = 'ready';
    weatherState.currentTempF = currentTempF;
      weatherState.currentWeatherCode = currentCode;
      weatherState.currentCondition = weatherCodeToText(currentCode);
      weatherState.tomorrowSummary = weatherCodeToText(tomorrowCode);
    weatherState.tomorrowHigh = tomorrowHigh;
    weatherState.tomorrowLow = tomorrowLow;
    weatherState.lastFetchMs = now;
    weatherState.coordsKey = HOME_ZIP;
  }

  function refreshWeatherIfNeeded() {
    if (
      weatherState.status === 'ready' &&
      Date.now() - weatherState.lastFetchMs < WEATHER_REFRESH_MS
    ) return;

    if (weatherState.status === 'loading') return;

    weatherState.status = 'loading';

    (async () => {
      try {
        await fetchWeatherForHomeZip();
      } catch (error) {
        console.error('Weather fetch failed:', error);
        weatherState.status = 'error';
      }
      render();
    })();
  }

  function findDeviceCards() {
    return [...document.querySelectorAll('app-devicecard')].filter(card => {
      const name = cleanText(card.querySelector('.device-Name')?.textContent);
      const status = cleanText(card.querySelector('.deviceStatus')?.textContent);
      return !!name && /powered on|powered off/i.test(status);
    });
  }

  function findCardByName(name) {
    return findDeviceCards().find(card => {
      const cardName = cleanText(card.querySelector('.device-Name')?.textContent);
      return cardName.toLowerCase() === name.toLowerCase();
    }) || null;
  }

  function parseRoomTemp(card) {
    const tempEl = card.querySelector('.device-room-temp .room-temp');
    if (!tempEl) return null;
    const rawText = tempEl.childNodes[0]?.textContent || tempEl.textContent || '';
    const value = parseNumber(rawText, /(\d{2,3})/);
    return Number.isFinite(value) ? value : null;
  }

  function parseSetTemp(card) {
    const footerTempEl =
      card.querySelector('.deviceFooterWrapper .temp span') ||
      card.querySelector('.deviceFooterWrapper .temp');
    if (!footerTempEl) return null;
    return parseNumber(footerTempEl.textContent, /(\d{2,3})°?/);
  }

  function parseHumidity(card) {
    const humidityEl = card.querySelector('.device-room-temp .room-humidity');
    if (!humidityEl) return null;
    return parseNumber(humidityEl.textContent, /(\d{1,3})%/);
  }

  function parseDeviceCard(card) {
    const name = cleanText(card.querySelector('.device-Name')?.textContent);
    const statusText = cleanText(card.querySelector('.deviceStatus')?.textContent);
    if (!name || !/powered on|powered off/i.test(statusText)) return null;

    return {
      name,
      poweredOn: /powered on/i.test(statusText),
      poweredOff: /powered off/i.test(statusText),
      roomTemp: parseRoomTemp(card),
      setTemp: parseSetTemp(card),
      humidity: parseHumidity(card)
    };
  }

  function summarize(devices) {
    const total = devices.length;
    const onCount = devices.filter(d => d.poweredOn).length;
    const offCount = devices.filter(d => d.poweredOff).length;
    const temps = devices.map(d => d.roomTemp).filter(Number.isFinite);
    const setTemps = devices.map(d => d.setTemp).filter(Number.isFinite);
    const humidities = devices.map(d => d.humidity).filter(Number.isFinite);

    const hottest = devices.filter(d => Number.isFinite(d.roomTemp)).sort((a, b) => b.roomTemp - a.roomTemp)[0];
    const coolest = devices.filter(d => Number.isFinite(d.roomTemp)).sort((a, b) => a.roomTemp - b.roomTemp)[0];
    const highestHumidity = devices.filter(d => Number.isFinite(d.humidity)).sort((a, b) => b.humidity - a.humidity)[0];

    return {
      total,
      onCount,
      offCount,
      hottest,
      coolest,
      highestHumidity,
      avgSetTemp: setTemps.length ? Math.round(setTemps.reduce((a, b) => a + b, 0) / setTemps.length) : null,
      avgHumidity: humidities.length ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length) : null,
      high: temps.length ? Math.max(...temps) : null,
      low: temps.length ? Math.min(...temps) : null
    };
  }

  function isDeviceBusy(name) {
    return deviceToggleBusy.get(name.toLowerCase()) === true;
  }

  function setDeviceBusy(name, value) {
    deviceToggleBusy.set(name.toLowerCase(), value);
  }

  function isAnyDeviceBusy() {
    if (bulkToggleBusy || sceneBusy || modeTestBusy) return true;
    return [...deviceToggleBusy.values()].some(Boolean);
  }

  function openDevicePanel(deviceName) {
    const deviceCard = findCardByName(deviceName);
    if (!deviceCard) throw new Error(`${deviceName} card not found`);

    const clickable =
      deviceCard.querySelector('.grid-item') ||
      deviceCard.querySelector('.deviceBody') ||
      deviceCard;

    clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  async function closeDevicePanel() {
    const closeButton =
      document.querySelector('.nav-action-btn.desktop') ||
      document.querySelector('.cielo-icon-right.nav-action-btn.desktop') ||
      document.querySelector('.nav-row .nav-action-btn');

    if (closeButton) {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(500);
    }
  }

  async function toggleDevicePower(deviceName) {
    if (isDeviceBusy(deviceName)) return;
    setDeviceBusy(deviceName, true);
    render();

    try {
      openDevicePanel(deviceName);
      await sleep(700);

      const powerButton = document.querySelector('.powerButton .btn-Power, .btn-Power');
      if (!powerButton) throw new Error('Power button not found');

      powerButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(1000);
      await closeDevicePanel();
    } catch (err) {
      console.error(`${deviceName} toggle failed:`, err);
      alert(`${deviceName} toggle did not complete. The page layout may have changed.`);
    } finally {
      setDeviceBusy(deviceName, false);
      render();
    }
  }

  async function toggleAllOff(devices) {
    if (bulkToggleBusy || isAnyDeviceBusy()) return;
    const activeDevices = devices.filter(device => device.poweredOn);
    if (!activeDevices.length) return;

    const ok = window.confirm(`Turn off ${activeDevices.length} active ${activeDevices.length === 1 ? 'device' : 'devices'}?`);
    if (!ok) return;

    bulkToggleBusy = true;
    render();

    try {
      for (const device of activeDevices) {
        await toggleDevicePower(device.name);
        await sleep(500);
      }
    } finally {
      bulkToggleBusy = false;
      render();
    }
  }

  async function runBedtimeScene(devices) {
    if (sceneBusy || isAnyDeviceBusy()) return;

    const bedtimeTarget = devices.find(device => device.name.toLowerCase() === 'bedroom');
    if (!bedtimeTarget) {
      alert('Bedroom device not found, so the Bedtime scene could not run.');
      return;
    }

    const devicesToTurnOff = devices.filter(device => device.name !== bedtimeTarget.name && device.poweredOn);
    const needsBedroomOn = !bedtimeTarget.poweredOn;
    if (!devicesToTurnOff.length && !needsBedroomOn) return;

    sceneBusy = true;
    render();

    try {
      if (needsBedroomOn) {
        await toggleDevicePower(bedtimeTarget.name);
        await sleep(500);
      }
      for (const device of devicesToTurnOff) {
        await toggleDevicePower(device.name);
        await sleep(500);
      }
    } finally {
      sceneBusy = false;
      render();
    }
  }

  async function setDeviceMode(deviceName, modeLabel) {
    if (modeTestBusy || isAnyDeviceBusy()) return;

    modeTestBusy = true;
    render();

    try {
      openDevicePanel(deviceName);
      await sleep(900);

      const getModeTrigger = () =>
        document.querySelector('.modeSection ul.selectedMode li') ||
        document.querySelector('.modeSection ul.selectedMode') ||
        document.querySelector('.modeSection');

      let modeTrigger = getModeTrigger();
      if (!modeTrigger) {
        openDevicePanel(deviceName);
        await sleep(900);
        modeTrigger = getModeTrigger();
      }
      if (!modeTrigger) throw new Error('Mode control not found');

      modeTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(650);

      let optionItems = [...document.querySelectorAll('.options-popup.modeOpen li, .options-popup .modeOpen li, .modeOpen.level-options li')];
      if (!optionItems.length) {
        modeTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await sleep(500);
        optionItems = [...document.querySelectorAll('.options-popup.modeOpen li, .options-popup .modeOpen li, .modeOpen.level-options li')];
      }

      const targetOption = optionItems.find(item => cleanText(item.textContent).toLowerCase() === modeLabel.toLowerCase());
      if (!targetOption) throw new Error(`${modeLabel} option not found`);

      targetOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(800);
      await closeDevicePanel();
    } catch (err) {
      console.error(`${deviceName} mode change failed:`, err);
      alert(`${deviceName} mode change did not complete. The page layout may have changed.`);
    } finally {
      modeTestBusy = false;
      render();
    }
  }

  async function setDeviceFan(deviceName, fanLabel) {
    if (modeTestBusy || isAnyDeviceBusy()) return;

    modeTestBusy = true;
    render();

    try {
      openDevicePanel(deviceName);
      await sleep(900);

      const getFanTrigger = () =>
        document.querySelector('.modeSection ul.selectedMode li:nth-child(2)') ||
        document.querySelector('.modeSection ul.selectedMode li .cielo-icon-fan-medium')?.closest('li') ||
        document.querySelector('.modeSection ul.selectedMode li .cielo-icon-fan-high')?.closest('li') ||
        document.querySelector('.modeSection ul.selectedMode li .cielo-icon-fan-low')?.closest('li') ||
        document.querySelector('.modeSection ul.selectedMode li .cielo-icon-fan-auto')?.closest('li');

      let fanTrigger = getFanTrigger();
      if (!fanTrigger) {
        openDevicePanel(deviceName);
        await sleep(900);
        fanTrigger = getFanTrigger();
      }
      if (!fanTrigger) throw new Error('Fan control not found');

      fanTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(650);

      let optionItems = [...document.querySelectorAll('.options-popup.fanOpen li, .options-popup .fanOpen li, .fanOpen.level-options li')];
      if (!optionItems.length) {
        fanTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await sleep(500);
        optionItems = [...document.querySelectorAll('.options-popup.fanOpen li, .options-popup .fanOpen li, .fanOpen.level-options li')];
      }

      const targetOption = optionItems.find(item => cleanText(item.textContent).toLowerCase() === fanLabel.toLowerCase());
      if (!targetOption) throw new Error(`${fanLabel} fan option not found`);

      targetOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(800);
      await closeDevicePanel();
    } catch (err) {
      console.error(`${deviceName} fan change failed:`, err);
      alert(`${deviceName} fan change did not complete. The page layout may have changed.`);
    } finally {
      modeTestBusy = false;
      render();
    }
  }

  async function setOfficeCoolHigh() {
    if (modeTestBusy || isAnyDeviceBusy()) return;

    modeTestBusy = true;
    render();

    try {
      openDevicePanel('Office');
      await sleep(900);

      const getModeTrigger = () =>
        document.querySelector('.modeSection ul.selectedMode li') ||
        document.querySelector('.modeSection ul.selectedMode') ||
        document.querySelector('.modeSection');

      const getFanTrigger = () =>
        document.querySelector('.modeSection ul.selectedMode li:nth-child(2)') ||
        document.querySelector('.modeSection ul.selectedMode li .cielo-icon-fan-medium')?.closest('li') ||
        document.querySelector('.modeSection ul.selectedMode li .cielo-icon-fan-high')?.closest('li') ||
        document.querySelector('.modeSection ul.selectedMode li .cielo-icon-fan-low')?.closest('li') ||
        document.querySelector('.modeSection ul.selectedMode li .cielo-icon-fan-auto')?.closest('li');

      let modeTrigger = getModeTrigger();
      if (!modeTrigger) {
        openDevicePanel('Office');
        await sleep(900);
        modeTrigger = getModeTrigger();
      }
      if (!modeTrigger) throw new Error('Mode control not found');

      modeTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(650);

      let modeItems = [...document.querySelectorAll('.options-popup.modeOpen li, .options-popup .modeOpen li, .modeOpen.level-options li')];
      if (!modeItems.length) {
        modeTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await sleep(500);
        modeItems = [...document.querySelectorAll('.options-popup.modeOpen li, .options-popup .modeOpen li, .modeOpen.level-options li')];
      }

      const coolOption = modeItems.find(item => cleanText(item.textContent).toLowerCase() === 'cool');
      if (!coolOption) throw new Error('Cool option not found');

      coolOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(800);

      let fanTrigger = getFanTrigger();
      if (!fanTrigger) {
        await sleep(400);
        fanTrigger = getFanTrigger();
      }
      if (!fanTrigger) throw new Error('Fan control not found');

      fanTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(650);

      let fanItems = [...document.querySelectorAll('.options-popup.fanOpen li, .options-popup .fanOpen li, .fanOpen.level-options li')];
      if (!fanItems.length) {
        fanTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await sleep(500);
        fanItems = [...document.querySelectorAll('.options-popup.fanOpen li, .options-popup .fanOpen li, .fanOpen.level-options li')];
      }

      const highOption = fanItems.find(item => cleanText(item.textContent).toLowerCase() === 'high');
      if (!highOption) throw new Error('High fan option not found');

      highOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(800);
      await closeDevicePanel();
    } catch (err) {
      console.error('Office Cool + High test failed:', err);
      alert('Office Cool + High did not complete. The page layout may have changed.');
    } finally {
      modeTestBusy = false;
      render();
    }
  }

  function getRoomIcon(name) {
    const key = name.toLowerCase();
    if (key.includes('office')) return 'briefcase';
    if (key.includes('bedroom')) return 'bed';
    if (key.includes('living')) return 'sofa';
    if (key.includes('studio')) return 'palette';
    if (key.includes('basement')) return 'warehouse';
    return 'monitor';
  }

  function getWeatherMarkup() {
    const ready = weatherState.status === 'ready';
    const displayIcon = ready ? getWeatherKind(weatherState.currentWeatherCode ?? 3) : 'cloud';

    let body = `
      <div class="tedd-climate-weather-temp">--°F</div>
      <div class="tedd-climate-weather-condition">Loading</div>
      <div class="tedd-climate-weather-sub">Tomorrow: ...</div>
    `;

    if (ready) {
      body = `
        <div class="tedd-climate-weather-temp">${weatherState.currentTempF}°F</div>
        <div class="tedd-climate-weather-condition">${weatherState.currentCondition}</div>
        <div class="tedd-climate-weather-sub">Tomorrow: ${weatherState.tomorrowSummary}, ${weatherState.tomorrowHigh}° / ${weatherState.tomorrowLow}°</div>
      `;
    } else if (weatherState.status === 'error') {
      body = `
        <div class="tedd-climate-weather-temp">--</div>
        <div class="tedd-climate-weather-condition">Weather unavailable</div>
        <div class="tedd-climate-weather-sub">${weatherState.locationLabel}</div>
      `;
    }

    return `
      <div class="tedd-climate-weather" aria-label="Home weather for ${weatherState.locationLabel}">
        ${iconSvg(displayIcon, 'tedd-climate-weather-icon')}
        <div>${body}</div>
      </div>
    `;
  }

  function buildMetricCard({ tone, icon, label, value, sub }) {
    return `
      <div class="tedd-climate-metric-card tedd-climate-metric-${tone}">
        <div class="tedd-climate-metric-top">
          <span class="tedd-climate-metric-icon-wrap">
            ${iconSvg(icon, 'tedd-climate-metric-icon')}
          </span>
          <div class="tedd-climate-metric-label">${label}</div>
        </div>
        <div class="tedd-climate-metric-value">${value}</div>
        <div class="tedd-climate-metric-sub">${sub}</div>
      </div>
    `;
  }

  function buildSecondaryItem({ icon, label, value }) {
    return `
      <div class="tedd-climate-secondary-item">
        ${iconSvg(icon, 'tedd-climate-secondary-icon')}
        <div>
          <div class="tedd-climate-secondary-kicker">${label}</div>
          <div class="tedd-climate-secondary-value">${value}</div>
        </div>
      </div>
    `;
  }

  function buildSceneButton({ cls, icon, label, badge, busy, ariaLabel }) {
    return `
      <button class="tedd-climate-btn tedd-climate-scene-btn ${cls}" ${busy ? 'disabled' : ''} aria-label="${ariaLabel}">
        ${iconSvg(icon, 'tedd-climate-scene-icon')}
        <span>${label}</span>
        <span class="tedd-climate-scene-badge">${badge}</span>
      </button>
    `;
  }

  function buildToggleButton(device) {
    const busy = isDeviceBusy(device.name);
    const state = device.poweredOn ? 'on' : 'off';
    const statusText = busy ? 'Working...' : device.poweredOn ? 'On' : 'Off';

    return `
      <button
        class="tedd-climate-btn tedd-climate-toggle-btn"
        data-device-name="${device.name.replace(/"/g, '&quot;')}"
        data-state="${state}"
        ${busy ? 'disabled' : ''}
        aria-label="${device.name} toggle, currently ${statusText}"
      >
        <span class="tedd-climate-toggle-icon-wrap">
          ${iconSvg(getRoomIcon(device.name), 'tedd-climate-toggle-icon')}
        </span>
        <span class="tedd-climate-toggle-name">${device.name}</span>
        <span class="tedd-climate-toggle-state">${statusText}</span>
      </button>
    `;
  }

  function renderSummaryCard(summary, devices) {
    ensureStyles();
    const card = ensureSummaryCard();

    const hottestText = summary.hottest ? `${summary.hottest.name} ${summary.hottest.roomTemp}°` : 'n/a';
    const coolestText = summary.coolest ? `${summary.coolest.name} ${summary.coolest.roomTemp}°` : 'n/a';
    const highestHumidityText = summary.highestHumidity ? `${summary.highestHumidity.name} ${summary.highestHumidity.humidity}%` : 'n/a';

    const bedroomDevice = devices.find(device => device.name.toLowerCase() === 'bedroom');
    const officeModeTestLabel = modeTestBusy ? 'Running Office test...' : 'Office Cool';
    const officeCoolHighLabel = modeTestBusy ? 'Running Office test...' : 'Office Cool + High';
    const bedtimeLabel = sceneBusy ? 'Running Bedtime...' : 'Bedtime';
    const allOffLabel = bulkToggleBusy ? 'Turning everything off...' : 'Turn Everything Off';
    const allOffBadge = bulkToggleBusy ? '...' : String(summary.onCount);

    const metricsHtml = [
      buildMetricCard({ tone: 'blue', icon: 'monitor', label: 'Devices', value: summary.total, sub: 'Total' }),
      buildMetricCard({ tone: 'green', icon: 'plug', label: 'Powered On', value: summary.onCount, sub: 'Active' }),
      buildMetricCard({ tone: 'violet', icon: 'thermometer', label: 'Average Setpoint', value: summary.avgSetTemp !== null ? `${summary.avgSetTemp}°` : 'n/a', sub: 'Fahrenheit' }),
      buildMetricCard({ tone: 'orange', icon: 'droplets', label: 'Avg Humidity', value: summary.avgHumidity !== null ? `${summary.avgHumidity}%` : 'n/a', sub: 'Average' }),
      buildMetricCard({ tone: 'blue', icon: 'gauge', label: 'Temperature Range', value: summary.low !== null && summary.high !== null ? `${summary.low}° - ${summary.high}°` : 'n/a', sub: 'Current' })
    ].join('');

    const secondaryHtml = [
      buildSecondaryItem({ icon: 'sun', label: 'Warmest Room', value: hottestText }),
      buildSecondaryItem({ icon: 'snowflake', label: 'Coolest Room', value: coolestText }),
      buildSecondaryItem({ icon: 'power', label: 'Powered Off', value: `${summary.offCount} ${summary.offCount === 1 ? 'Device' : 'Devices'}` }),
      buildSecondaryItem({ icon: 'droplets', label: 'Highest Humidity', value: highestHumidityText })
    ].join('');

    const sceneButtons = [
      buildSceneButton({
        cls: 'tedd-climate-scene-btn--night',
        icon: 'moon',
        label: bedtimeLabel,
        badge: 'Bedroom On',
        busy: sceneBusy,
        ariaLabel: 'Run bedtime scene'
      }),
      buildSceneButton({
        cls: 'tedd-climate-scene-btn--cool',
        icon: 'snowflake',
        label: officeModeTestLabel,
        badge: 'Office',
        busy: modeTestBusy,
        ariaLabel: 'Set Office mode to Cool'
      }),
      buildSceneButton({
        cls: 'tedd-climate-scene-btn--cooler',
        icon: 'fan',
        label: officeCoolHighLabel,
        badge: 'Office',
        busy: modeTestBusy,
        ariaLabel: 'Set Office mode to Cool and fan to High'
      })
    ].join('');

    const toggleButtonsHtml = devices.map(buildToggleButton).join('');

    card.innerHTML = `
      <div class="tedd-climate-header">
        <div class="tedd-climate-title-wrap">
          ${iconSvg('house', 'tedd-climate-house')}
          <div>
            <div class="tedd-climate-eyebrow">Household Summary</div>
            <h2 class="tedd-climate-heading">Home Climate Snapshot</h2>
            <div class="tedd-climate-subtitle">Quick overview of your devices, temperatures, humidity, and controls.</div>
          </div>
        </div>
        ${getWeatherMarkup()}
      </div>

      <div class="tedd-climate-metrics">${metricsHtml}</div>
      <div class="tedd-climate-secondary-band">${secondaryHtml}</div>

      <div class="tedd-climate-section">
        <div class="tedd-climate-section-title">Scenes</div>
        <div class="tedd-climate-scene-list">
          ${sceneButtons}
        </div>
      </div>

      <div class="tedd-climate-section">
        <div class="tedd-climate-section-title">Quick Toggle</div>
        <div class="tedd-climate-toggle-list">
          ${toggleButtonsHtml}
        </div>
      </div>

      <button class="tedd-climate-btn tedd-climate-global" ${(bulkToggleBusy || !summary.onCount) ? 'disabled' : ''} aria-label="Turn everything off">
        <span class="tedd-climate-global-icon-wrap">
          ${iconSvg('power', 'tedd-climate-global-icon')}
        </span>
        <span>
          <span class="tedd-climate-global-title">${allOffLabel}</span>
          <span class="tedd-climate-global-sub">Power off all active devices</span>
        </span>
        <span style="display:flex; align-items:center; gap:12px;">
          <span class="tedd-climate-muted-badge">${allOffBadge}</span>
          ${iconSvg('arrow-right', 'tedd-climate-global-arrow')}
        </span>
      </button>
    `;

    const versionLabel = document.createElement('div');
    versionLabel.textContent = 'v' + APP_VERSION;
    Object.assign(versionLabel.style, {
      marginTop: '10px',
      fontSize: '10px',
      color: DESIGN_DEFAULTS.textMuted,
      opacity: '0.72',
      textAlign: 'left',
      userSelect: 'none'
    });
    card.appendChild(versionLabel);

    card.querySelectorAll('.tedd-climate-toggle-btn').forEach(button => {
      button.addEventListener('click', () => {
        const name = button.getAttribute('data-device-name');
        if (name) toggleDevicePower(name);
      });
    });

    card.querySelector('.tedd-climate-global')?.addEventListener('click', () => toggleAllOff(devices));
    card.querySelector('.tedd-climate-scene-btn--night')?.addEventListener('click', () => runBedtimeScene(devices));
    card.querySelector('.tedd-climate-scene-btn--cool')?.addEventListener('click', () => setDeviceMode('Office', 'Cool'));
    card.querySelector('.tedd-climate-scene-btn--cooler')?.addEventListener('click', () => setOfficeCoolHigh());
  }

  function render() {
    try {
      const cards = findDeviceCards();
      setDebugStatus(`loaded, ${cards.length} device cards found`);
      const devices = cards.map(parseDeviceCard).filter(Boolean);
      if (!devices.length) return;

      renderSummaryCard(summarize(devices), devices);
      refreshWeatherIfNeeded();
    } catch (error) {
      console.error('Home Climate Snapshot render failed:', error);
      setDebugStatus('render error');
      showDebugError(error);
    }
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 500);
  }

  try {
    setDebugStatus('script loaded');
    const observer = new MutationObserver(scheduleRender);
    render();
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(render, 5000);
  } catch (error) {
    console.error('Home Climate Snapshot startup failed:', error);
    showDebugError(error);
  }
})();
