// ==UserScript==
// @name         Swift Click Haunted Web
// @namespace    https://swiftclick.com/
// @version      0.1.0
// @description  A draggable Halloween bat, countdown, and lightweight spooky effects for the web.
// @author       Swift Click
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/swift-click-haunted-web.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/swift-click-haunted-web.user.js
// ==/UserScript==

(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const ROOT_ID = 'sc-haunted-web-root';
  const STYLE_ID = 'sc-haunted-web-style';
  const FX_ID = 'sc-haunted-web-fx';
  const KEY_X = 'scHauntedWebBatX';
  const KEY_ON = 'scHauntedWebEnabled';
  const KEY_SIGN = 'scHauntedWebSignOpen';

  if (document.getElementById(ROOT_ID)) return;

  const state = {
    enabled: Boolean(GM_getValue(KEY_ON, false)),
    signOpen: Boolean(GM_getValue(KEY_SIGN, true)),
    x: Number(GM_getValue(KEY_X, Math.round(window.innerWidth * 0.72))),
    dragging: false,
    moved: false,
    startX: 0,
    startLeft: 0,
    timers: []
  };

  const el = (tag, attrs = {}, text = '') => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    if (text) node.textContent = text;
    return node;
  };

  const svgEl = (tag, attrs = {}) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    return node;
  };

  const style = el('style', { id: STYLE_ID });
  style.textContent = `
    #${ROOT_ID}{position:fixed;top:0;left:0;width:150px;height:145px;z-index:2147483647;
      font-family:Georgia,"Times New Roman",serif;user-select:none;touch-action:none;
      filter:drop-shadow(0 4px 6px rgba(0,0,0,.55));}
    #${ROOT_ID} *{box-sizing:border-box}
    #${ROOT_ID} .sc-bat-wrap{position:absolute;top:-38px;left:25px;width:100px;height:100px;
      cursor:grab;transition:filter .25s ease,transform .2s ease;}
    #${ROOT_ID} .sc-bat-wrap:active{cursor:grabbing}
    #${ROOT_ID} .sc-bat-wrap:hover{transform:translateY(2px)}
    #${ROOT_ID} .sc-bat{width:100%;height:100%;overflow:visible}
    #${ROOT_ID} .sc-wing{fill:#17131d;stroke:#09070b;stroke-width:2}
    #${ROOT_ID} .sc-body{fill:#211927;stroke:#09070b;stroke-width:2}
    #${ROOT_ID} .sc-ear{fill:#211927;stroke:#09070b;stroke-width:2}
    #${ROOT_ID} .sc-eye-open{fill:#ff7a18;opacity:0;transform-box:fill-box;transform-origin:center;
      transform:scaleY(.05);transition:opacity .18s ease,transform .25s ease;filter:url(#sc-eye-glow)}
    #${ROOT_ID} .sc-eye-closed{fill:none;stroke:#8d6b48;stroke-width:2.2;stroke-linecap:round;
      opacity:1;transition:opacity .15s ease}
    #${ROOT_ID}.sc-on .sc-eye-open{opacity:1;transform:scaleY(1)}
    #${ROOT_ID}.sc-on .sc-eye-closed{opacity:0}
    #${ROOT_ID}.sc-on .sc-bat-wrap{filter:drop-shadow(0 0 8px rgba(255,102,0,.35))}
    #${ROOT_ID} .sc-fang{fill:#e8e1d8}
    #${ROOT_ID} .sc-sign{position:absolute;top:62px;left:13px;width:124px;min-height:58px;
      border:2px solid #392719;border-radius:7px;background:linear-gradient(#574027,#322317);
      color:#f0d5a5;text-align:center;padding:9px 7px 7px;cursor:pointer;
      box-shadow:inset 0 0 0 2px rgba(175,116,48,.18),0 3px 8px rgba(0,0,0,.45);
      transform-origin:50% 0;transition:transform .28s ease,opacity .2s ease;}
    #${ROOT_ID} .sc-sign::before,#${ROOT_ID} .sc-sign::after{content:"";position:absolute;top:-17px;
      width:1px;height:18px;background:#6f5a42}
    #${ROOT_ID} .sc-sign::before{left:28px}.sc-sign::after{right:28px}
    #${ROOT_ID} .sc-days{display:block;font:bold 18px/1 Georgia,serif;letter-spacing:1px;color:#ffad43;
      text-shadow:0 1px 2px #000}
    #${ROOT_ID} .sc-label{display:block;margin-top:5px;font:bold 10px/1.15 Georgia,serif;
      letter-spacing:1.2px;text-transform:uppercase}
    #${ROOT_ID} .sc-sign.sc-collapsed{transform:translateY(-48px) scaleY(.15);opacity:.25}
    #${ROOT_ID} .sc-hint{position:absolute;top:122px;left:0;width:150px;text-align:center;color:#ddd;
      font:10px/1.2 Arial,sans-serif;text-shadow:0 1px 2px #000;opacity:0;transition:opacity .2s;pointer-events:none}
    #${ROOT_ID}:hover .sc-hint{opacity:.72}
    #${FX_ID}{position:fixed;inset:0;z-index:2147483645;pointer-events:none;overflow:hidden;
      background:linear-gradient(180deg,rgba(22,5,30,.08),rgba(31,8,2,.13));}
    #${FX_ID} .sc-vignette{position:absolute;inset:0;box-shadow:inset 0 0 150px 25px rgba(18,0,22,.42)}
    #${FX_ID} .sc-fog{position:absolute;width:70vw;height:22vh;border-radius:50%;
      background:rgba(215,215,225,.055);filter:blur(28px);animation:scFog 18s linear infinite}
    #${FX_ID} .sc-fog.f2{top:48%;left:25%;animation-duration:25s;animation-direction:reverse}
    #${FX_ID} .sc-fog.f1{top:72%;left:-35%}
    #${FX_ID} .sc-flybat{position:absolute;left:-70px;font-size:26px;opacity:.65;
      animation:scFly 9s linear forwards;filter:grayscale(1) brightness(.45)}
    #${FX_ID} .sc-ghost{position:absolute;font-size:30px;opacity:0;
      animation:scGhost 4.5s ease-in-out forwards;filter:grayscale(.35) drop-shadow(0 0 6px rgba(220,210,255,.5))}
    @keyframes scFog{0%{transform:translateX(0) scale(1)}50%{transform:translateX(70vw) scale(1.15)}100%{transform:translateX(140vw) scale(1)}}
    @keyframes scFly{0%{transform:translate(0,0) rotate(-8deg)}40%{transform:translate(45vw,-45px) rotate(7deg)}
      75%{transform:translate(82vw,25px) rotate(-5deg)}100%{transform:translate(calc(100vw + 100px),-20px) rotate(5deg)}}
    @keyframes scGhost{0%{opacity:0;transform:translateY(18px) scale(.8)}22%{opacity:.48}
      70%{opacity:.42;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-35px) scale(.9)}}
    html.sc-haunted-active{filter:saturate(.84) sepia(.06)}
    @media (prefers-reduced-motion:reduce){
      #${FX_ID} .sc-fog,#${FX_ID} .sc-flybat,#${FX_ID} .sc-ghost{animation:none!important}
      #${ROOT_ID} *{transition:none!important}
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  const root = el('div', { id: ROOT_ID, role: 'group', 'aria-label': 'Swift Click Haunted Web controls' });
  const batWrap = el('div', { class: 'sc-bat-wrap', role: 'button', tabindex: '0',
    title: 'Click to haunt this page. Drag left or right to move me.',
    'aria-label': 'Toggle Halloween effects' });

  const svg = svgEl('svg', { class: 'sc-bat', viewBox: '0 0 100 100', 'aria-hidden': 'true' });
  const defs = svgEl('defs');
  const filter = svgEl('filter', { id: 'sc-eye-glow', x: '-100%', y: '-100%', width: '300%', height: '300%' });
  const blur = svgEl('feGaussianBlur', { stdDeviation: '2.4', result: 'blur' });
  const merge = svgEl('feMerge');
  merge.append(svgEl('feMergeNode', { in: 'blur' }), svgEl('feMergeNode', { in: 'SourceGraphic' }));
  filter.append(blur, merge); defs.appendChild(filter); svg.appendChild(defs);

  svg.append(
    svgEl('path', { class:'sc-wing', d:'M44 25 C31 18 17 17 4 22 C13 29 17 39 17 50 C25 43 31 46 36 53 C38 41 41 33 44 25Z' }),
    svgEl('path', { class:'sc-wing', d:'M56 25 C69 18 83 17 96 22 C87 29 83 39 83 50 C75 43 69 46 64 53 C62 41 59 33 56 25Z' }),
    svgEl('ellipse', { class:'sc-body', cx:'50', cy:'39', rx:'19', ry:'25' }),
    svgEl('path', { class:'sc-ear', d:'M36 25 L37 7 L47 21Z' }),
    svgEl('path', { class:'sc-ear', d:'M64 25 L63 7 L53 21Z' }),
    svgEl('path', { class:'sc-eye-closed', d:'M39 37 Q43 40 47 37' }),
    svgEl('path', { class:'sc-eye-closed', d:'M53 37 Q57 40 61 37' }),
    svgEl('ellipse', { class:'sc-eye-open', cx:'43', cy:'38', rx:'3.7', ry:'5' }),
    svgEl('ellipse', { class:'sc-eye-open', cx:'57', cy:'38', rx:'3.7', ry:'5' }),
    svgEl('path', { class:'sc-fang', d:'M43 48 L47 48 L45 54Z' }),
    svgEl('path', { class:'sc-fang', d:'M53 48 L57 48 L55 54Z' })
  );
  batWrap.appendChild(svg);

  const sign = el('div', { class: 'sc-sign', role: 'button', tabindex: '0', title: 'Click to hide or show the countdown' });
  const days = el('span', { class: 'sc-days' });
  const label = el('span', { class: 'sc-label' });
  sign.append(days, label);
  const hint = el('div', { class: 'sc-hint' }, 'drag bat • click eyes to haunt');
  root.append(batWrap, sign, hint);
  document.documentElement.appendChild(root);

  function halloweenInfo() {
    const now = new Date();
    let year = now.getFullYear();
    let target = new Date(year, 9, 31);
    const today = new Date(year, now.getMonth(), now.getDate());
    if (today > target) { year += 1; target = new Date(year, 9, 31); }
    const diff = Math.ceil((target - today) / 86400000);
    return { diff, isHalloween: now.getMonth() === 9 && now.getDate() === 31 };
  }

  function updateCountdown() {
    const info = halloweenInfo();
    if (info.isHalloween) {
      days.textContent = 'HAPPY';
      label.textContent = 'HALLOWEEN';
    } else {
      days.textContent = String(info.diff) + (info.diff === 1 ? ' DAY' : ' DAYS');
      label.textContent = 'TO HALLOWEEN';
    }
  }

  function clampX(x) {
    return Math.max(-18, Math.min(window.innerWidth - 132, x));
  }

  function placeRoot() {
    state.x = clampX(state.x);
    root.style.left = state.x + 'px';
  }

  function makeFx() {
    if (document.getElementById(FX_ID)) return;
    const fx = el('div', { id: FX_ID, 'aria-hidden': 'true' });
    fx.append(el('div', { class: 'sc-vignette' }), el('div', { class: 'sc-fog f1' }), el('div', { class: 'sc-fog f2' }));
    document.documentElement.appendChild(fx);
    document.documentElement.classList.add('sc-haunted-active');
    scheduleAmbient();
  }

  function clearTimers() {
    state.timers.forEach(clearTimeout);
    state.timers.length = 0;
  }

  function removeFx() {
    clearTimers();
    document.getElementById(FX_ID)?.remove();
    document.documentElement.classList.remove('sc-haunted-active');
  }

  function spawnBat() {
    if (!state.enabled) return;
    const fx = document.getElementById(FX_ID); if (!fx) return;
    const b = el('div', { class: 'sc-flybat' }, '🦇');
    b.style.top = (12 + Math.random() * 50) + 'vh';
    b.style.animationDuration = (7 + Math.random() * 5) + 's';
    fx.appendChild(b);
    b.addEventListener('animationend', () => b.remove(), { once: true });
  }

  function spawnGhost() {
    if (!state.enabled) return;
    const fx = document.getElementById(FX_ID); if (!fx) return;
    const g = el('div', { class: 'sc-ghost' }, '👻');
    g.style.left = (5 + Math.random() * 88) + 'vw';
    g.style.top = (30 + Math.random() * 55) + 'vh';
    fx.appendChild(g);
    g.addEventListener('animationend', () => g.remove(), { once: true });
  }

  function scheduleAmbient() {
    clearTimers();
    const loopBat = () => {
      if (!state.enabled) return;
      spawnBat();
      state.timers.push(setTimeout(loopBat, 9000 + Math.random() * 14000));
    };
    const loopGhost = () => {
      if (!state.enabled) return;
      spawnGhost();
      state.timers.push(setTimeout(loopGhost, 13000 + Math.random() * 18000));
    };
    state.timers.push(setTimeout(loopBat, 1600));
    state.timers.push(setTimeout(loopGhost, 4200));
  }

  function renderState() {
    root.classList.toggle('sc-on', state.enabled);
    root.setAttribute('data-enabled', String(state.enabled));
    batWrap.setAttribute('aria-pressed', String(state.enabled));
    if (state.enabled) makeFx(); else removeFx();
  }

  function toggleHaunt() {
    state.enabled = !state.enabled;
    GM_setValue(KEY_ON, state.enabled);
    renderState();
  }

  function toggleSign() {
    state.signOpen = !state.signOpen;
    GM_setValue(KEY_SIGN, state.signOpen);
    sign.classList.toggle('sc-collapsed', !state.signOpen);
  }

  batWrap.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    state.dragging = true; state.moved = false; state.startX = e.clientX; state.startLeft = state.x;
    batWrap.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  batWrap.addEventListener('pointermove', e => {
    if (!state.dragging) return;
    const dx = e.clientX - state.startX;
    if (Math.abs(dx) > 6) state.moved = true;
    if (state.moved) { state.x = clampX(state.startLeft + dx); placeRoot(); }
  });
  batWrap.addEventListener('pointerup', e => {
    if (!state.dragging) return;
    state.dragging = false;
    try { batWrap.releasePointerCapture(e.pointerId); } catch (_) {}
    if (state.moved) GM_setValue(KEY_X, Math.round(state.x)); else toggleHaunt();
  });
  batWrap.addEventListener('pointercancel', () => { state.dragging = false; });
  batWrap.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHaunt(); }
  });
  sign.addEventListener('click', e => { e.stopPropagation(); toggleSign(); });
  sign.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSign(); }
  });
  window.addEventListener('resize', () => { placeRoot(); GM_setValue(KEY_X, Math.round(state.x)); });

  updateCountdown();
  placeRoot();
  sign.classList.toggle('sc-collapsed', !state.signOpen);
  renderState();
})();