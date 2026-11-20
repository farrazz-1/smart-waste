/* ============================================================
   SmartWaste — icon set & illustrations
   ============================================================ */
(function () {
  'use strict';

  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    'plus-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/>',
    user: '<path d="M20 21v-1.8a4.2 4.2 0 0 0-4.2-4.2H8.2A4.2 4.2 0 0 0 4 19.2V21"/><circle cx="12" cy="7.5" r="4"/>',
    users: '<path d="M16 21v-1.8a4.2 4.2 0 0 0-4.2-4.2H6.2A4.2 4.2 0 0 0 2 19.2V21"/><circle cx="9" cy="7.5" r="4"/><path d="M22 21v-1.8a4.2 4.2 0 0 0-3.2-4.1M16.5 3.6a4 4 0 0 1 0 7.8"/>',
    bell: '<path d="M18 8.4a6 6 0 1 0-12 0c0 6.2-2.5 7.6-2.5 7.6h17S18 14.6 18 8.4z"/><path d="M13.8 20a2 2 0 0 1-3.6 0"/>',
    logout: '<path d="M9.5 21H5.8A1.8 1.8 0 0 1 4 19.2V4.8A1.8 1.8 0 0 1 5.8 3h3.7"/><path d="M16 16.5 20.5 12 16 7.5"/><path d="M20.5 12H9"/>',
    refresh: '<path d="M21 4.5V10h-5.5"/><path d="M20.3 9A8.5 8.5 0 0 0 5.2 6.2L3 9"/><path d="M3 19.5V14h5.5"/><path d="M3.7 15a8.5 8.5 0 0 0 15.1 2.8L21 15"/>',
    download: '<path d="M21 15.5v3.7a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 19.2v-3.7"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M12 15.5V3"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    'map-pin': '<path d="M20 10.2c0 6.2-8 11.8-8 11.8s-8-5.6-8-11.8a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.8"/>',
    camera: '<path d="M21.5 18.2a2.3 2.3 0 0 1-2.3 2.3H4.8a2.3 2.3 0 0 1-2.3-2.3V9.4a2.3 2.3 0 0 1 2.3-2.3h3.4L10.2 4h3.6l2 3.1h3.4a2.3 2.3 0 0 1 2.3 2.3z"/><circle cx="12" cy="13.5" r="3.7"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.7" cy="8.7" r="1.7"/><path d="m21 15.5-4.5-4.5L6 21"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4.2A1.2 1.2 0 0 1 9.2 3h5.6A1.2 1.2 0 0 1 16 4.2V6"/><path d="M18.5 6v13a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6"/><path d="M10 10.5v6M14 10.5v6"/>',
    check: '<path d="m20 6.5-11 11-5-5"/>',
    'check-circle': '<path d="M21.4 11.1V12a9.4 9.4 0 1 1-5.6-8.6"/><path d="m21 4-9.5 9.5-2.8-2.8"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'arrow-right': '<path d="M4.5 12h15"/><path d="m13 5.5 6.5 6.5-6.5 6.5"/>',
    'arrow-left': '<path d="M19.5 12h-15"/><path d="m11 5.5-6.5 6.5 6.5 6.5"/>',
    'arrow-up-right': '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M11.5 4.5H5.2A2.2 2.2 0 0 0 3 6.7v12.1A2.2 2.2 0 0 0 5.2 21h12.1a2.2 2.2 0 0 0 2.2-2.2v-6.3"/><path d="M18.3 2.7a2.3 2.3 0 0 1 3.2 3.2L12 15.4l-4.2 1 1-4.2z"/>',
    'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m14.7 9.3-5.4 5.4M9.3 9.3l5.4 5.4"/>',
    leaf: '<path d="M11 20A7.5 7.5 0 0 1 9.6 5.3C15.5 4.2 17 3.7 19 1c1 2.1 2 4.7 2 8.5 0 5.8-4.6 10.5-10 10.5z"/><path d="M2 22c.6-3.8 2.4-6.5 5.8-8"/>',
    truck: '<path d="M1.5 4.5h13.2v11.3H1.5z"/><path d="M14.7 8.6h3.7l3.1 3.2v4H14.7"/><circle cx="5.7" cy="18.6" r="2.2"/><circle cx="17.3" cy="18.6" r="2.2"/>',
    building: '<path d="M3 21h18"/><path d="M5 21V6.5L12 3l7 3.5V21"/><path d="M9 9.5h1.5M13.5 9.5H15M9 13.5h1.5M13.5 13.5H15M10 21v-3.5h4V21"/>',
    scale: '<path d="M12 3v18"/><path d="M7 21h10"/><path d="M3 7h3.2c2.1 0 4.4-.9 5.8-2 1.4 1.1 3.7 2 5.8 2H21"/><path d="m3 7-2.2 6a3.7 3.7 0 0 0 4.4 0z"/><path d="m21 7-2.2 6a3.7 3.7 0 0 0 4.4 0z" transform="translate(-4.8 0)"/>',
    sparkles: '<path d="m12 3 1.6 4.7L18 9.3l-4.4 1.6L12 15.6l-1.6-4.7L6 9.3l4.4-1.6z"/><path d="M19 14.5 19.7 16.8 22 17.5l-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z"/><path d="M5 15.5l.5 1.5L7 17.5l-1.5.5L5 19.5l-.5-1.5L3 17.5l1.5-.5z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9v.4"/><path d="M12 17.5h.01"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    'wifi-off': '<path d="m2 2 20 20"/><path d="M8.5 15.9a5 5 0 0 1 7 0"/><path d="M5 12.6a10.5 10.5 0 0 1 3.2-2M15.8 10.8a10.4 10.4 0 0 1 3.2 1.8"/><path d="M2 8.6a15.5 15.5 0 0 1 4-2.3M18 6.3a15.6 15.6 0 0 1 4 2.3"/><path d="M12 19.5h.01"/>',
    eye: '<path d="M1.8 12S5.6 4.8 12 4.8 22.2 12 22.2 12 18.4 19.2 12 19.2 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3.2"/>',
    'eye-off': '<path d="m2 2 20 20"/><path d="M6.6 6.7C3.7 8.4 1.8 12 1.8 12S5.6 19.2 12 19.2c1.6 0 3-.4 4.2-1"/><path d="M9.9 5.2c.7-.2 1.4-.3 2.1-.3 6.4 0 10.2 7.1 10.2 7.1a18 18 0 0 1-2.5 3.4"/><path d="M9.9 9.9a3.2 3.2 0 0 0 4.2 4.2"/>',
    'alert-triangle': '<path d="M10.3 3.9 1.9 18.2A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5"/><path d="M12 17.5h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.5h.01"/>',
    filter: '<path d="M3 5h18l-7 8.2V20l-4 1.5v-8.3z"/>',
    upload: '<path d="M21 15.5v3.7a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 19.2v-3.7"/><path d="m7.5 7.5 4.5-4.5 4.5 4.5"/><path d="M12 3v12"/>',
    shield: '<path d="M12 21.5s8-4 8-10V5.2L12 2.2 4 5.2V11.5c0 6 8 10 8 10z"/><path d="m8.7 11.7 2.2 2.2 4.4-4.4"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><path d="M12 14.5v3"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8.5v4.8a2.7 2.7 0 0 0 5.4 0V12a9.4 9.4 0 1 0-3.7 7.4"/>',
    'more-horizontal': '<circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    'corner-up-right': '<path d="M6 19v-7a4 4 0 0 1 4-4h8"/><path d="m14 4 4 4-4 4"/>',
    package: '<path d="m12 2.5 9 5v9l-9 5-9-5v-9z"/><path d="m3.3 7.3 8.7 4.8 8.7-4.8"/><path d="M12 12.1V21"/>',
    weight: '<circle cx="12" cy="6.5" r="2.5"/><path d="M8.7 8.5h6.6l2.2 10.2a2 2 0 0 1-2 2.3H8.5a2 2 0 0 1-2-2.3z"/><path d="M10.5 13h3"/>'
  };

  const ART = {
    mark: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9.4 21.6c-.3-6.8 4.5-12.6 13-13.7 1 8.6-4.2 14.7-10.7 14.7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.2 25.3c1.9-6.1 5.5-10 11-12.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    'mark-light': '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9.4 21.6c-.3-6.8 4.5-12.6 13-13.7 1 8.6-4.2 14.7-10.7 14.7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.2 25.3c1.9-6.1 5.5-10 11-12.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    'mark-soft': '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9.4 21.6c-.3-6.8 4.5-12.6 13-13.7 1 8.6-4.2 14.7-10.7 14.7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.2 25.3c1.9-6.1 5.5-10 11-12.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    hero: `
<svg viewBox="0 0 380 330" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="earthGrad" x1="252" y1="84" x2="152" y2="268" gradientUnits="userSpaceOnUse">
      <stop stop-color="#a8d18a"/><stop offset=".55" stop-color="#7bb665"/><stop offset="1" stop-color="#4e8d50"/>
    </linearGradient>
    <linearGradient id="creamHouse" x1="196" y1="92" x2="196" y2="140" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fbf7e8"/><stop offset="1" stop-color="#efe6cd"/>
    </linearGradient>
    <linearGradient id="orangeHouse" x1="255" y1="100" x2="255" y2="148" gradientUnits="userSpaceOnUse">
      <stop stop-color="#f6b46a"/><stop offset="1" stop-color="#ee9548"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".4" r=".65">
      <stop stop-color="#8fc774" stop-opacity=".45"/><stop offset="1" stop-color="#8fc774" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <ellipse cx="212" cy="296" rx="104" ry="16" fill="#16331c" fill-opacity=".35"/>
  <circle cx="216" cy="174" r="122" fill="url(#glow)"/>
  <circle cx="212" cy="172" r="102" fill="url(#earthGrad)"/>

  <path d="M129 154c9-18 29-25 45-16 8-12 27-13 36-2 11-3 23 5 23 17 0 12-10 20-24 20h-61c-13 0-23-8-19-19z" fill="#c4e2a8" fill-opacity=".9"/>
  <path d="M244 195c6-13 21-17 32-9 5-8 19-7 23 2 9 1 14 8 12 15-2 8-10 12-20 12h-36c-10 0-15-10-11-20z" fill="#c4e2a8" fill-opacity=".75"/>
  <path d="M166 233c4-8 13-11 20-6 3-5 12-4 14 2 5 1 8 5 7 9-1 5-6 8-12 8h-22c-6 0-9-6-7-13z" fill="#b7d998" fill-opacity=".65"/>
  <path d="M118 215c12-8 30-5 38 7" stroke="#e9f7dc" stroke-width="3" stroke-linecap="round" stroke-opacity=".5"/>

  <!-- orbit -->
  <ellipse cx="212" cy="172" rx="146" ry="82" stroke="#f4fbec" stroke-opacity=".2" stroke-width="1.5" stroke-dasharray="3 9" transform="rotate(-16 212 172)"/>

  <!-- houses -->
  <g>
    <rect x="160" y="110" width="47" height="33" rx="4" fill="url(#creamHouse)"/>
    <path d="m156 111 24-22 28 22z" fill="#e98b53"/>
    <rect x="176" y="124" width="10" height="19" rx="2" fill="#4f6f48"/>
    <rect x="192" y="119" width="8" height="8" rx="1.6" fill="#f0c56b"/>
    <rect x="201" y="68" width="4" height="28" rx="2" fill="#eaf5df" fill-opacity=".55"/>
  </g>
  <g>
    <rect x="227" y="119" width="56" height="44" rx="5" fill="url(#orangeHouse)"/>
    <path d="m221 121 31-28 34 28z" fill="#f8d8b4"/>
    <rect x="249" y="136" width="12" height="27" rx="2" fill="#3f6446"/>
    <rect x="267" y="131" width="10" height="10" rx="2" fill="#fff4d9"/>
    <rect x="233" y="131" width="10" height="10" rx="2" fill="#fff4d9"/>
    <path d="M288 95v-22" stroke="#5d8b52" stroke-width="3"/>
    <path d="M288 77c-9-2-12-8-10-14 7 0 12 5 10 14z" fill="#cfe8b5"/>
  </g>

  <!-- tree -->
  <g>
    <path d="M164 236v-32" stroke="#5b7c45" stroke-width="4" stroke-linecap="round"/>
    <circle cx="164" cy="196" r="17" fill="#9ccc78"/>
    <circle cx="152" cy="203" r="11" fill="#8dbd68"/>
    <circle cx="177" cy="204" r="10" fill="#b3dc91"/>
  </g>

  <!-- bins -->
  <g>
    <rect x="120" y="257" width="36" height="33" rx="6" fill="#f6c25e"/>
    <rect x="116" y="251" width="44" height="9" rx="4.5" fill="#f9d98e"/>
    <rect x="129" y="267" width="4" height="13" rx="2" fill="#cb9537" fill-opacity=".55"/>
    <rect x="137" y="267" width="4" height="13" rx="2" fill="#cb9537" fill-opacity=".55"/>
    <rect x="145" y="267" width="4" height="13" rx="2" fill="#cb9537" fill-opacity=".55"/>
  </g>
  <g>
    <rect x="164" y="252" width="40" height="38" rx="7" fill="#3f7a3f"/>
    <rect x="159" y="245" width="50" height="10" rx="5" fill="#57965a"/>
    <path d="m172 268 12-9 12 9v9a2 2 0 0 1-2 2h-20a2 2 0 0 1-2-2z" fill="#d6ebc1" fill-opacity=".9"/>
    <path d="M180 271v5m8-5v5" stroke="#3f7a3f" stroke-width="2.4" stroke-linecap="round"/>
  </g>

  <!-- leaves & sparkles -->
  <path d="M98 101c-13-4-17-16-12-27 12 2 19 12 20 23" fill="#c3e3a5" fill-opacity=".9"/>
  <path d="M306 218c12 2 17 11 14 21-11 0-17-8-19-17" fill="#f0b25f" fill-opacity=".9"/>
  <path d="M318 61c8-2 14 3 15 11-8 2-14-2-15-11z" fill="#f7d28e"/>
  <path d="m86 168 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#f5fbe9" fill-opacity=".85"/>
  <path d="m322 148 1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" fill="#f5fbe9" fill-opacity=".6"/>
  <circle cx="99" cy="225" r="3.5" fill="#f5fbe9" fill-opacity=".5"/>
  <circle cx="304" cy="116" r="3" fill="#f5fbe9" fill-opacity=".5"/>
  <circle cx="287" cy="47" r="2.4" fill="#f5fbe9" fill-opacity=".35"/>

  <!-- paper plane -->
  <path d="M67 74l33-14-11 33-7-13z" fill="#f6f4e8"/>
  <path d="m100 60-18 20" stroke="#cfd9c5" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M52 96c-13 3-23 12-27 25" stroke="#f6f4e8" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 7" stroke-opacity=".55"/>
</svg>`,
    promo: `
<svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="promoBin" x1="94" y1="45" x2="142" y2="128" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8dbd66"/><stop offset="1" stop-color="#4e8a3c"/>
    </linearGradient>
  </defs>
  <ellipse cx="120" cy="129" rx="72" ry="8" fill="#cfe4bf" fill-opacity=".5"/>
  <path d="M34 104c16-30 44-38 68-22 5-18 27-27 44-17 18 10 23 26 29 39z" fill="#d8ecc3" fill-opacity=".75"/>
  <g>
    <rect x="94" y="51" width="52" height="68" rx="10" fill="url(#promoBin)"/>
    <rect x="86" y="42" width="68" height="14" rx="7" fill="#6ba24b"/>
    <rect x="107" y="38" width="30" height="6" rx="3" fill="#5a913f"/>
    <path d="m107 76 13-11 13 11v18a3 3 0 0 1-3 3h-20a3 3 0 0 1-3-3z" fill="#eaf6dd" fill-opacity=".92"/>
    <path d="M113.5 81v10m6.5-10v10m6.5-10v10" stroke="#5d9445" stroke-width="3" stroke-linecap="round"/>
  </g>
  <path d="M74 92c-8-14-3-27 10-31 5 13 0 25-10 31z" fill="#7fb45c"/>
  <path d="M68 114c-9-3-14-12-11-22 9 2 14 10 11 22z" fill="#a3cc7e"/>
  <path d="M166 84c8-2 13 2 15 10-8 2-13-1-15-10z" fill="#f0ad55"/>
  <path d="M168 50c14 4 19 12 16 23-12-1-19-9-16-23z" fill="#f6c678" fill-opacity=".8"/>
  <path d="M45 63l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#a9cf86"/>
  <circle cx="192" cy="112" r="4" fill="#c6e0a8"/>
  <circle cx="57" cy="44" r="3" fill="#f2c073" fill-opacity=".8"/>
  <path d="M190 30l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" fill="#9cc87c"/>
</svg>`
  };

  function icon(name, cls) {
    const body = ICONS[name] || ICONS.info;
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.hydrated === '1') return;
      el.innerHTML = icon(el.dataset.icon);
      el.dataset.hydrated = '1';
    });
  }

  function hydrateArt(root) {
    (root || document).querySelectorAll('[data-art]').forEach((el) => {
      if (el.dataset.hydrated === '1') return;
      el.innerHTML = ART[el.dataset.art] || '';
      el.dataset.hydrated = '1';
    });
  }

  window.ICONS = ICONS;
  window.ART = ART;
  window.icon = icon;
  window.hydrateIcons = hydrateIcons;
  window.hydrateArt = hydrateArt;
})();
