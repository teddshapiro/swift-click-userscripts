// ==UserScript==
// @name         Swift Click Haunted Web
// @namespace    https://swiftclick.com/
// @version      0.6.0
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
  const KEY_SOUND = 'scHauntedWebSound';

  if (document.getElementById(ROOT_ID)) return;

  const state = {
    enabled: Boolean(GM_getValue(KEY_ON, false)),
    signOpen: Boolean(GM_getValue(KEY_SIGN, true)),
    sound: Boolean(GM_getValue(KEY_SOUND, false)),
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
    #${ROOT_ID} .sc-sound{position:absolute;top:57px;right:4px;width:27px;height:27px;border:1px solid #76502b;border-radius:50%;background:#241a20;color:#a99a86;font:15px/25px Arial,sans-serif;text-align:center;cursor:pointer;box-shadow:0 2px 5px #000}
    #${ROOT_ID} .sc-sound.sc-sound-on{color:#ffad43;border-color:#b8782e;text-shadow:0 0 5px #ff7a18}
    #${ROOT_ID} .sc-cord{position:absolute;top:49px;left:73px;width:4px;height:28px;background:#6f5a42;border-radius:3px;pointer-events:none}
    #${ROOT_ID} .sc-sign{top:72px}
    #${FX_ID} .sc-flash{position:absolute;inset:0;background:rgba(225,235,255,.9);opacity:0;animation:scFlash .6s ease-out forwards}
    #${FX_ID} .sc-bolt{position:absolute;top:-10px;width:6px;height:48vh;background:#f2f5ff;box-shadow:0 0 16px 6px rgba(225,235,255,.75);transform:skew(-14deg);opacity:0;animation:scBolt .6s ease-out forwards}
    #${FX_ID} .sc-peeker{position:absolute;width:46px;height:55px;opacity:0;animation:scPeeker 5.5s ease-in-out forwards;filter:drop-shadow(0 0 8px rgba(230,225,255,.65))}
    #${FX_ID} .sc-peeker-head{position:absolute;inset:2px 4px 8px;border-radius:50% 50% 42% 42%;background:rgba(230,228,238,.9)}
    #${FX_ID} .sc-peeker-eye{position:absolute;top:18px;width:5px;height:8px;border-radius:50%;background:#211927}
    #${FX_ID} .sc-peeker-eye.e1{left:14px} #${FX_ID} .sc-peeker-eye.e2{left:27px}
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
    @keyframes scFlash{0%,12%{opacity:0}18%{opacity:.9}27%{opacity:.05}34%{opacity:.55}55%,100%{opacity:0}}
    @keyframes scBolt{0%,16%{opacity:0}18%{opacity:1}28%{opacity:0}34%{opacity:.75}48%,100%{opacity:0}}
    @keyframes scPeeker{0%,10%{opacity:0;transform:translateX(22px)}28%,70%{opacity:.75;transform:translateX(0)}90%,100%{opacity:0;transform:translateX(22px)}}
    @keyframes scGhost{0%{opacity:0;transform:translateY(18px) scale(.8)}22%{opacity:.48}
      70%{opacity:.42;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-35px) scale(.9)}}
    #${FX_ID} .sc-cemetery{position:absolute;left:0;bottom:-8px;width:100%;height:150px;opacity:.96;animation:scCemeteryRise .8s ease-out both;filter:drop-shadow(0 -5px 8px rgba(0,0,0,.35))}
    #${FX_ID} .sc-cemetery *{vector-effect:non-scaling-stroke}
    @keyframes scCemeteryRise{from{transform:translateY(65px);opacity:0}to{transform:translateY(0);opacity:.96}}
    #${FX_ID} .sc-yard-ghost{position:absolute;bottom:70px;width:74px;height:94px;opacity:0;filter:drop-shadow(0 0 10px rgba(220,215,255,.65));animation:scYardGhost 7s ease-in-out forwards}
    #${FX_ID} .sc-yard-ghost-body{position:absolute;inset:0;background:rgba(218,216,230,.82);border-radius:48% 48% 34% 34%;clip-path:polygon(8% 0,92% 0,100% 75%,84% 100%,67% 82%,50% 100%,33% 82%,15% 100%,0 75%)}
    #${FX_ID} .sc-yard-ghost-eye{position:absolute;top:30px;width:8px;height:13px;border-radius:50%;background:#17121c;z-index:1}.sc-yard-ghost-eye.e1{left:22px}.sc-yard-ghost-eye.e2{right:22px}
    @keyframes scYardGhost{0%,8%{opacity:0;transform:translateY(100px)}24%,72%{opacity:.82;transform:translateY(0)}82%{opacity:.82;transform:translateY(4px)}100%{opacity:0;transform:translateY(105px)}}
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

  const cord = el('div', { class: 'sc-cord', 'aria-hidden': 'true' });
  const sound = el('div', { class: 'sc-sound', role: 'button', tabindex: '0', title: 'Toggle thunder sound', 'aria-label': 'Toggle thunder sound' }, '♬');
  const sign = el('div', { class: 'sc-sign', role: 'button', tabindex: '0', title: 'Click to hide or show the countdown' });
  const days = el('span', { class: 'sc-days' });
  const label = el('span', { class: 'sc-label' });
  sign.append(days, label);
  const hint = el('div', { class: 'sc-hint' }, 'drag bat • click eyes to haunt');
  root.append(batWrap, cord, sign, sound, hint);
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

  function makeCemetery(){
    const s=svgEl('svg',{class:'sc-cemetery',viewBox:'0 0 1200 150',preserveAspectRatio:'none','aria-hidden':'true'});
    const far=svgEl('g',{fill:'#151219',opacity:'.82'}),near=svgEl('g',{fill:'#070609'});
    far.append(
      svgEl('path',{d:'M0 123 Q70 105 140 119 T290 116 T440 121 T610 114 T790 120 T960 112 T1200 118 L1200 150 L0 150Z'}),
      svgEl('path',{d:'M70 122 V82 Q70 68 83 68 Q96 68 96 82 V122Z'}),
      svgEl('path',{d:'M215 122 V72 H230 V57 H239 V72 H254 V82 H239 V122Z'}),
      svgEl('path',{d:'M350 122 V88 Q350 72 367 72 Q384 72 384 88 V122Z'}),
      svgEl('path',{d:'M515 120 V77 Q515 62 530 62 Q545 62 545 77 V120Z'}),
      svgEl('path',{d:'M690 122 V84 Q690 68 708 68 Q726 68 726 84 V122Z'}),
      svgEl('path',{d:'M890 121 V70 H903 V54 H912 V70 H927 V80 H912 V121Z'}),
      svgEl('path',{d:'M1050 122 V86 Q1050 71 1066 71 Q1082 71 1082 86 V122Z'})
    );
    near.append(
      svgEl('path',{d:'M0 132 Q55 116 110 128 T230 126 T360 131 T500 124 T650 130 T810 123 T970 129 T1090 121 T1200 127 L1200 150 L0 150Z'}),
      svgEl('path',{d:'M125 134 V83 Q125 64 145 64 Q165 64 165 83 V134Z'}),
      svgEl('path',{d:'M300 132 V74 H316 V54 H326 V74 H344 V85 H326 V132Z'}),
      svgEl('path',{d:'M455 134 V94 Q455 76 474 76 Q493 76 493 94 V134Z'}),
      svgEl('path',{d:'M755 133 V79 Q755 59 777 59 Q799 59 799 79 V133Z'}),
      svgEl('path',{d:'M1000 133 V91 Q1000 72 1020 72 Q1040 72 1040 91 V133Z'}),
      svgEl('path',{d:'M0 132 V67 L12 61 L18 43 L25 60 L37 48 L31 68 L47 77 L30 79 L43 95 L23 86 L18 132Z'}),
      svgEl('path',{d:'M1200 132 V52 L1187 47 L1178 27 L1172 49 L1157 36 L1164 58 L1144 70 L1167 70 L1152 91 L1176 80 L1182 132Z'}),
      svgEl('path',{d:'M18 112 V83 H23 V112 M36 112 V80 H41 V112 M54 112 V86 H59 V112 M8 88 H68 V93 H8Z'}),
      svgEl('path',{d:'M1128 112 V83 H1133 V112 M1146 112 V79 H1151 V112 M1164 112 V85 H1169 V112 M1118 88 H1180 V93 H1118Z'}),
      svgEl('path',{d:'M604 132 V102 L610 90 L614 103 L620 84 L625 105 L633 94 L632 116 L642 108 L636 132Z'})
    );
    near.append(
      svgEl('path',{d:'M180 136 l5 -18 4 11 6 -22 5 24 8 -14 2 19 M405 136 l4 -15 5 9 5 -20 6 22 7 -13 3 17 M840 136 l4 -19 6 12 5 -25 6 27 8 -15 2 20'}),
      svgEl('path',{d:'M548 132 V91 L559 79 L570 91 V132 M544 91 H574 L559 66Z'}),
      svgEl('path',{d:'M666 132 V87 Q666 70 682 68 L696 72 Q704 78 704 91 V132Z'}),
      svgEl('path',{d:'M960 132 l-8 -45 14 -3 7 46Z'})
    );
    near.append(
      svgEl('path',{d:'M36 132 C39 111 38 91 43 74 C47 60 56 50 61 34 C62 49 58 59 54 69 C66 59 72 45 78 30 C78 48 72 63 62 76 C76 68 87 55 95 43 C91 62 78 76 61 87 C74 83 87 82 101 84 C84 90 71 94 57 98 L55 132Z'}),
      svgEl('path',{d:'M1148 132 C1145 111 1148 93 1142 75 C1138 61 1127 51 1121 35 C1121 51 1127 63 1133 73 C1119 63 1110 48 1105 31 C1104 51 1112 68 1125 80 C1108 73 1096 61 1087 48 C1092 68 1107 82 1127 91 C1111 88 1097 90 1083 96 C1104 97 1122 101 1137 106 L1139 132Z'}),
      svgEl('path',{d:'M240 133 l3 -49 q2 -18 19 -24 q17 6 19 24 l3 49Z M248 86 q14 -11 28 0 q-2 -19 -14 -22 q-12 3 -14 22Z'}),
      svgEl('path',{d:'M724 133 l5 -58 14 -12 15 12 5 58Z M722 77 l21 -24 22 24Z'}),
      svgEl('path',{d:'M865 134 l-4 -49 q-1 -17 15 -23 q18 5 19 23 l4 49Z M869 82 q11 -14 22 0 l-3 -13 -9 -8 -8 8Z'})
    );
    const fence=svgEl('g',{fill:'#09070b',opacity:'.96'});
    for(let x=90;x<1120;x+=38){fence.append(svgEl('path',{d:`M${x} 136 V98 l5 -9 5 9 v38Z`}));}
    fence.append(svgEl('path',{d:'M86 108 H1128 V113 H86Z M86 125 H1128 V130 H86Z'}));
    const raven=svgEl('path',{fill:'#050406',d:'M934 68 q10 -11 22 0 q-8 -3 -10 6 q-7 -8 -12 -6Z'});
    s.append(far,fence,near,raven);return s;
  }

  function makeFx() {
    if (document.getElementById(FX_ID)) return;
    const fx = el('div', { id: FX_ID, 'aria-hidden': 'true' });
    fx.append(el('div', { class: 'sc-vignette' }), el('div', { class: 'sc-fog f1' }), el('div', { class: 'sc-fog f2' }), makeCemetery());
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

  function playThunder() {
    if (!state.enabled || !state.sound) return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
    const ctx=new AC(),dur=3.2,buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate),data=buffer.getChannelData(0);let rumble=0;
    for(let i=0;i<data.length;i++){const t=i/ctx.sampleRate,noise=Math.random()*2-1;rumble=(rumble+.02*noise)/1.02;const crack=t<.09?noise*(1-t/.09):0;data[i]=crack*.65+rumble*2.8*Math.exp(-t*.95);}
    const src=ctx.createBufferSource(),low=ctx.createBiquadFilter(),gain=ctx.createGain();low.type='lowpass';low.frequency.value=700;gain.gain.value=.28;src.buffer=buffer;src.connect(low);low.connect(gain);gain.connect(ctx.destination);src.start();
  }

  function lightning() {
    if(!state.enabled)return; const fx=document.getElementById(FX_ID); if(!fx)return;
    const flash=el('div',{class:'sc-flash'}),bolt=el('div',{class:'sc-bolt'}); bolt.style.left=(15+Math.random()*70)+'vw'; fx.append(flash,bolt);
    setTimeout(()=>{flash.remove();bolt.remove();},850); state.timers.push(setTimeout(playThunder,350+Math.random()*1100));
  }

  function spawnYardGhost(){
    if(!state.enabled)return;const fx=document.getElementById(FX_ID);if(!fx)return;
    const g=el('div',{class:'sc-yard-ghost'}),body=el('div',{class:'sc-yard-ghost-body'});
    g.style.left=(12+Math.random()*76)+'vw';g.append(body,el('i',{class:'sc-yard-ghost-eye e1'}),el('i',{class:'sc-yard-ghost-eye e2'}));fx.appendChild(g);
    g.addEventListener('animationend',()=>g.remove(),{once:true});
  }

  function spawnGhost() {
    if (!state.enabled) return;
    const fx = document.getElementById(FX_ID); if (!fx) return;
    const boxes=[...document.querySelectorAll('ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,article,section,main img,main video,[role="article"]')].map(n=>n.getBoundingClientRect()).filter(r=>r.width>120&&r.height>70&&r.top>70&&r.top<innerHeight-80&&r.left>10&&r.right<innerWidth-10);
    const box=boxes.length?boxes[Math.floor(Math.random()*boxes.length)]:null;
    const g=el('div',{class:box?'sc-peeker':'sc-ghost'});
    if(box){const head=el('div',{class:'sc-peeker-head'});head.append(el('i',{class:'sc-peeker-eye e1'}),el('i',{class:'sc-peeker-eye e2'}));g.appendChild(head);g.style.left=(box.right-14)+'px';g.style.top=(box.top+20)+'px';}
    else{g.textContent='👻';g.style.left=(5+Math.random()*88)+'vw';g.style.top=(30+Math.random()*55)+'vh';}
    fx.appendChild(g);
    g.addEventListener('animationend', () => g.remove(), { once: true });
  }

  function ensureEffectsOn(){if(!state.enabled){state.enabled=true;GM_setValue(KEY_ON,true);renderState();}}
  function isTypingTarget(target){return target instanceof Element&&(target.matches('input,textarea,select')||target.isContentEditable);}
  function handleShortcut(e){if(!e.ctrlKey||!e.altKey||isTypingTarget(e.target))return;const key=e.key.toLowerCase();if(!['g','l','b'].includes(key))return;e.preventDefault();e.stopPropagation();ensureEffectsOn();if(key==='g'){spawnYardGhost();spawnGhost();}if(key==='l')lightning();if(key==='b')spawnBat();}

  function scheduleAmbient() {
    clearTimers();
    const loopBat = () => {
      if (!state.enabled) return;
      spawnBat();
      state.timers.push(setTimeout(loopBat, 9000 + Math.random() * 14000));
    };
    const loopGhost = () => {
      if (!state.enabled) return;
      spawnYardGhost();
      spawnGhost();
      state.timers.push(setTimeout(loopGhost, 13000 + Math.random() * 18000));
    };
    state.timers.push(setTimeout(loopBat, 1600));
    const loopLightning=()=>{if(!state.enabled)return;lightning();state.timers.push(setTimeout(loopLightning,18000+Math.random()*26000));};
    state.timers.push(setTimeout(loopGhost, 3200));
    state.timers.push(setTimeout(loopLightning, 7000+Math.random()*9000));
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

  function toggleSound(){state.sound=!state.sound;GM_setValue(KEY_SOUND,state.sound);sound.classList.toggle('sc-sound-on',state.sound);sound.textContent=state.sound?'♪':'♬';sound.setAttribute('aria-pressed',String(state.sound));if(state.enabled && state.sound)playThunder();}

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
  sound.addEventListener('click',e=>{e.stopPropagation();toggleSound();});
  sound.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleSound();}});
  sign.addEventListener('click', e => { e.stopPropagation(); toggleSign(); });
  sign.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSign(); }
  });
  window.addEventListener('resize', () => { placeRoot(); GM_setValue(KEY_X, Math.round(state.x)); });
  document.addEventListener('keydown',handleShortcut,true);

  updateCountdown();
  placeRoot();
  sign.classList.toggle('sc-collapsed', !state.signOpen);
  sound.classList.toggle('sc-sound-on',state.sound); sound.textContent=state.sound?'♪':'♬'; sound.setAttribute('aria-pressed',String(state.sound));
  renderState();
})();