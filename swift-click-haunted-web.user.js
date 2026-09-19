// ==UserScript==
// @name         Swift Click Haunted Web
// @namespace    https://swiftclick.com/
// @version      0.7.0
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
    const s=svgEl('svg',{class:'sc-cemetery',viewBox:'0 0 1600 180',preserveAspectRatio:'none','aria-hidden':'true'});
    const far=svgEl('g',{fill:'#18141c',opacity:'.78'}),mid=svgEl('g',{fill:'#0d0a10',opacity:'.94'}),near=svgEl('g',{fill:'#050407'});
    far.append(
      svgEl('path',{d:'M0 145 C90 122 175 139 255 130 C350 119 430 143 520 128 C615 112 690 138 780 126 C875 113 960 140 1050 126 C1140 112 1235 139 1320 127 C1420 113 1510 131 1600 121 L1600 180 L0 180Z'}),
      svgEl('path',{d:'M92 145 L96 111 Q98 90 118 84 Q138 90 140 111 L144 145Z'}),
      svgEl('path',{d:'M333 140 L337 106 Q339 91 352 85 L365 92 L370 140Z'}),
      svgEl('path',{d:'M620 140 L624 102 Q626 83 646 78 Q665 84 667 102 L671 140Z'}),
      svgEl('path',{d:'M980 140 L984 106 Q987 89 1003 83 Q1020 90 1022 106 L1026 140Z'}),
      svgEl('path',{d:'M1370 140 L1374 105 Q1376 88 1393 82 Q1410 88 1412 105 L1416 140Z'})
    );
    const tree=(x,y,scale,flip=1)=>svgEl('path',{transform:`translate(${x} ${y}) scale(${scale*flip} ${scale})`,d:'M0 0 C-5 -23 -3 -42 -12 -60 C-19 -75 -31 -86 -36 -106 C-26 -95 -17 -87 -10 -78 C-13 -101 -8 -123 2 -145 C2 -121 7 -104 14 -91 C20 -113 34 -132 50 -145 C37 -124 31 -107 30 -90 C43 -104 60 -113 79 -116 C59 -105 45 -93 36 -78 C55 -87 75 -88 96 -83 C72 -78 54 -70 39 -59 C58 -62 76 -58 92 -49 C68 -50 49 -45 31 -35 C20 -24 15 -10 13 0Z'});
    mid.append(tree(92,154,.72),tree(1510,157,.83,-1),tree(1165,151,.48));
    const stones=[
      ['M0 0 L3 -47 Q5 -72 29 -78 Q54 -72 56 -47 L60 0Z',205,153,1,-5],
      ['M0 0 L2 -62 L16 -72 L29 -62 L31 0Z M-5 -62 L16 -91 L37 -62Z',405,154,.9,4],
      ['M0 0 L4 -52 Q6 -72 25 -77 Q43 -72 46 -52 L50 0Z M15 -59 Q25 -70 35 -59',540,155,.82,-8],
      ['M0 0 L3 -70 H18 V-91 H29 V-70 H47 V-57 H29 V0Z',735,154,.88,3],
      ['M0 0 L5 -58 Q7 -80 31 -84 Q54 -79 57 -58 L62 0Z M13 -61 Q31 -78 49 -61',890,155,1.02,-4],
      ['M0 0 L2 -51 L13 -65 L27 -68 L40 -58 L43 0Z',1080,153,.9,7],
      ['M0 0 L4 -64 H19 V-86 H30 V-64 H49 V-52 H30 V0Z',1270,155,.8,-6],
      ['M0 0 L3 -53 Q5 -76 28 -81 Q50 -75 53 -53 L57 0Z',1450,155,.9,5]
    ];
    for(const [d,x,y,sc,rot] of stones)mid.append(svgEl('path',{d,transform:`translate(${x} ${y}) rotate(${rot}) scale(${sc})`}));
    const gate=svgEl('g',{fill:'#08060a'});
    gate.append(svgEl('path',{d:'M20 158 V92 H29 V158 M1571 158 V92 H1580 V158 M25 98 C230 70 380 102 540 88 C690 75 770 58 800 40 C830 58 910 75 1060 88 C1220 102 1370 70 1575 98 V106 C1370 82 1220 112 1060 98 C900 84 830 69 800 52 C770 69 700 84 540 98 C380 112 230 82 25 106Z'}));
    for(let x=42;x<1570;x+=44)gate.append(svgEl('path',{d:`M${x} 158 V104 l5 -13 5 13 v54Z`}));
    gate.append(svgEl('path',{d:'M28 124 H1574 V130 H28Z'}));
    near.append(
      svgEl('path',{d:'M0 157 C105 141 190 159 280 149 C390 137 475 162 575 148 C680 134 765 157 865 147 C975 135 1060 160 1165 147 C1280 132 1390 156 1600 141 L1600 180 L0 180Z'}),
      svgEl('path',{d:'M250 166 l6 -28 7 17 8 -37 8 40 11 -25 4 33 M680 166 l5 -23 7 13 8 -33 8 36 12 -22 3 29 M1190 166 l6 -27 8 16 7 -39 9 42 12 -24 4 32'}),
      svgEl('path',{d:'M152 160 q10 -23 20 0 q9 -31 19 0 q10 -19 20 0Z'}),
      svgEl('path',{d:'M1008 160 q8 -22 17 0 q9 -30 18 0 q8 -18 18 0Z'})
    );
    const crypt=svgEl('g',{fill:'#070509'});
    crypt.append(svgEl('path',{d:'M566 151 V91 H651 V151Z M556 91 L608 51 L661 91Z M584 151 V108 Q584 91 608 91 Q632 91 632 108 V151Z'}),svgEl('path',{d:'M594 83 H622 V89 H594Z'}));
    const raven=svgEl('path',{fill:'#030204',d:'M1118 87 q11 -13 25 -2 q-10 -2 -12 8 q-7 -9 -13 -6Z'});
    s.append(far,gate,mid,crypt,near,raven);return s;
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