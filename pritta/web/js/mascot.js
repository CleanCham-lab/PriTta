/* Helly - PriTta's original mascot.
 * The face is framed by a DNA double helix (mint + coral strands, base-pair
 * rungs on the little helix sprout), and she wears a tiny lab coat.
 * States: idle | thinking | happy | sad | hello
 */
(function () {
  "use strict";
  const PM = (window.PM = window.PM || {});

  const O = "#1E1848"; // outline ink

  function strand(d, color, cap) {
    cap = cap || "butt";
    return `<path d="${d}" fill="none" stroke="${O}" stroke-width="12.5" stroke-linecap="${cap}"/>` +
           `<path d="${d}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="${cap}"/>`;
  }

  function rung(y, x1, x2, c1, c2) {
    const mid = (x1 + x2) / 2;
    return `<path d="M${x1} ${y}H${x2}" stroke="${O}" stroke-width="8" stroke-linecap="round"/>` +
           `<path d="M${x1} ${y}H${mid}" stroke="${c1}" stroke-width="4.5"/>` +
           `<path d="M${mid} ${y}H${x2}" stroke="${c2}" stroke-width="4.5"/>`;
  }

  const MINT = "var(--strand-a, #4FE3C1)";
  const CORAL = "var(--strand-b, #FF6F91)";
  const YEL = "#FFD23F";
  const SKY = "#6CA8FF";
  const SKIN = "#FFE8DA";
  const COAT = "#F6F5FF";
  // strand A: left tip -> crossing -> right mini-loop -> forehead crossing -> left cheek -> chin crossing -> scarf tail
  const A_PATH = "M70 8 Q72 16 80 20 Q112 37 80 54 C55 58 30 72 30 100 C30 128 55 142 80 146 Q96 150 104 163";
  const B_PATH = "M90 8 Q88 16 80 20 Q48 37 80 54 C105 58 130 72 130 100 C130 128 105 142 80 146 Q64 150 56 163";

  const SVG = `
<svg class="helly" viewBox="0 0 160 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Helly">
  <defs>
    <radialGradient id="hl-cheek" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FF8FA8" stop-opacity=".75"/>
      <stop offset="1" stop-color="#FF8FA8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse class="hl-shadow" cx="80" cy="206" rx="40" ry="5" fill="#000" opacity=".22"/>
  <g class="hl-all">
    <!-- feet -->
    <ellipse cx="66" cy="199" rx="10.5" ry="6.5" fill="#2E2670" stroke="${O}" stroke-width="2.5"/>
    <ellipse cx="94" cy="199" rx="10.5" ry="6.5" fill="#2E2670" stroke="${O}" stroke-width="2.5"/>
    <!-- arms (behind coat) -->
    <g class="hl-arm hl-arm-l">
      <path d="M56 156 L42 178" stroke="${O}" stroke-width="15" stroke-linecap="round"/>
      <path d="M56 156 L42 178" stroke="${COAT}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="40.5" cy="181" r="6.8" fill="${SKIN}" stroke="${O}" stroke-width="2.5"/>
    </g>
    <g class="hl-arm hl-arm-r">
      <path d="M104 156 L118 178" stroke="${O}" stroke-width="15" stroke-linecap="round"/>
      <path d="M104 156 L118 178" stroke="${COAT}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="119.5" cy="181" r="6.8" fill="${SKIN}" stroke="${O}" stroke-width="2.5"/>
    </g>
    <!-- lab coat -->
    <path d="M58 145 C52 160 47 176 45 190 Q45 198 53 198 L107 198 Q115 198 115 190 C113 176 108 160 102 145 Z"
          fill="${COAT}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M67 147 L80 172 L93 147 Z" fill="#3D3585" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M80 172 V197" stroke="#C9C3EE" stroke-width="2"/>
    <circle cx="84.5" cy="181" r="1.7" fill="#9D94DA"/>
    <circle cx="84.5" cy="190" r="1.7" fill="#9D94DA"/>
    <rect x="90" y="178" width="13" height="10" rx="2.5" fill="none" stroke="#C9C3EE" stroke-width="1.8"/>
    <path d="M94 171 V181" stroke="${O}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M94 171 V181" stroke="${YEL}" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="58" y="176" width="11" height="13" rx="2" fill="${MINT}" stroke="${O}" stroke-width="1.8"/>
    <path d="M60.8 181 H66.2 M60.8 185 H64" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>

    <!-- base-pair rungs inside the helix sprout -->
    <g class="hl-rungs">
      <g class="hl-rung r1">${rung(30, 64, 96, YEL, SKY)}</g>
      <g class="hl-rung r2">${rung(44, 64, 96, SKY, YEL)}</g>
    </g>

    <!-- head: the helix loop is the face outline -->
    <path d="M80 54 C55 58 30 72 30 100 C30 128 55 142 80 146 C105 142 130 128 130 100 C130 72 105 58 80 54 Z" fill="${SKIN}"/>
    <ellipse cx="51" cy="120" rx="10" ry="6" fill="url(#hl-cheek)"/>
    <ellipse cx="109" cy="120" rx="10" ry="6" fill="url(#hl-cheek)"/>

    <!-- eyes -->
    <g class="hl-eyes-open">
      <g class="hl-eye">
        <ellipse cx="62" cy="104" rx="7.6" ry="10.2" fill="#2A2160"/>
        <ellipse class="hl-pupil" cx="62" cy="107" rx="5" ry="5.2" fill="#5B4FD6"/>
        <circle class="hl-glint" cx="59.4" cy="99.6" r="3.1" fill="#fff"/>
        <circle class="hl-glint" cx="64.6" cy="108.8" r="1.4" fill="#fff"/>
      </g>
      <g class="hl-eye">
        <ellipse cx="98" cy="104" rx="7.6" ry="10.2" fill="#2A2160"/>
        <ellipse class="hl-pupil" cx="98" cy="107" rx="5" ry="5.2" fill="#5B4FD6"/>
        <circle class="hl-glint" cx="95.4" cy="99.6" r="3.1" fill="#fff"/>
        <circle class="hl-glint" cx="100.6" cy="108.8" r="1.4" fill="#fff"/>
      </g>
    </g>
    <g class="hl-eyes-happy" fill="none" stroke="#2A2160" stroke-width="3.6" stroke-linecap="round">
      <path d="M54.5 106 Q62 96 69.5 106"/>
      <path d="M90.5 106 Q98 96 105.5 106"/>
    </g>
    <g class="hl-brows-sad" fill="none" stroke="#2A2160" stroke-width="2.6" stroke-linecap="round">
      <path d="M53 94 L67 88.5"/>
      <path d="M107 94 L93 88.5"/>
    </g>
    <path class="hl-tear" d="M55 113 Q51 120 55 123 Q59 120 55 113 Z" fill="#9FD8FF" stroke="${O}" stroke-width="1.2"/>

    <!-- mouths -->
    <path class="hl-mouth hl-mouth-smile" d="M74.5 119.5 Q80 125 85.5 119.5" fill="none" stroke="#2A2160" stroke-width="2.6" stroke-linecap="round"/>
    <g class="hl-mouth hl-mouth-open">
      <path d="M73 118 Q80 131 87 118 Z" fill="#7A2340" stroke="#2A2160" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M76.5 124.5 Q80 121.8 83.5 124.5 Q80 128.4 76.5 124.5 Z" fill="#FF8FA8"/>
    </g>
    <ellipse class="hl-mouth hl-mouth-o" cx="80" cy="122" rx="3.2" ry="3.8" fill="#7A2340" stroke="#2A2160" stroke-width="2"/>
    <path class="hl-mouth hl-mouth-frown" d="M74.5 124 Q80 118.5 85.5 124" fill="none" stroke="#2A2160" stroke-width="2.6" stroke-linecap="round"/>

    <!-- helix strands: one continuous path each; the face is the loop between two crossings -->
    ${strand(B_PATH, CORAL, "round")}
    ${strand(A_PATH, MINT, "round")}
    <!-- coral passes over mint at the forehead crossing so the crossings alternate like a real helix -->
    <path d="M71.84 48.9 Q75.2 51.45 80 54 C87.5 55.2 95 57.3 101.83 60.41" fill="none" stroke="${O}" stroke-width="12.5"/>
    <path d="M68 45.5 Q72 49.75 80 54 C90 55.6 100 58.8 108.4 63.86" fill="none" stroke="${CORAL}" stroke-width="8"/>
    <circle cx="70" cy="7" r="5.2" fill="${MINT}" stroke="${O}" stroke-width="2.5"/>
    <circle cx="90" cy="7" r="5.2" fill="${CORAL}" stroke="${O}" stroke-width="2.5"/>
    <circle cx="68.6" cy="5.4" r="1.4" fill="#fff" opacity=".9"/>
    <circle cx="88.6" cy="5.4" r="1.4" fill="#fff" opacity=".9"/>

    <path class="hl-sweat" d="M122 66 Q116 76 121 80 Q127 77 122 66 Z" fill="#9FD8FF" stroke="${O}" stroke-width="1.4"/>
    <g class="hl-sparkles" fill="${YEL}" stroke="${O}" stroke-width="1.4" stroke-linejoin="round">
      <path class="hl-spark s1" d="M18 58 L21 66 L29 69 L21 72 L18 80 L15 72 L7 69 L15 66 Z"/>
      <path class="hl-spark s2" d="M142 44 L144.5 50 L151 52.5 L144.5 55 L142 61 L139.5 55 L133 52.5 L139.5 50 Z"/>
      <path class="hl-spark s3" d="M146 118 L148 123 L153 125 L148 127 L146 132 L144 127 L139 125 L144 123 Z"/>
    </g>
  </g>
</svg>`;

  const STATES = ["idle", "thinking", "happy", "sad", "hello", "poke"];

  // Effects drawn around an image mascot (sparkles, sweat drop, gloom lines).
  const FX = `
<svg class="st-fx" viewBox="0 0 100 180" preserveAspectRatio="none" aria-hidden="true">
  <g class="fx-sparkles" fill="${YEL}" stroke="${O}" stroke-width="1.2" stroke-linejoin="round">
    <path class="hl-spark s1" d="M-6 40 L-3.5 47 L3.5 49.5 L-3.5 52 L-6 59 L-8.5 52 L-15.5 49.5 L-8.5 47 Z"/>
    <path class="hl-spark s2" d="M104 14 L106 19 L111 21 L106 23 L104 28 L102 23 L97 21 L102 19 Z"/>
    <path class="hl-spark s3" d="M108 86 L110 91 L115 93 L110 95 L108 100 L106 95 L101 93 L106 91 Z"/>
  </g>
  <path class="fx-sweat" d="M96 18 Q90 28 95 32 Q101 29 96 18 Z" fill="#9FD8FF" stroke="${O}" stroke-width="1.2"/>
  <g class="fx-gloom" stroke="#6CA8FF" stroke-width="2.4" stroke-linecap="round">
    <path d="M28 -10 V-2"/><path d="M50 -14 V-4"/><path d="M72 -10 V-2"/>
  </g>
</svg>`;

  class BaseMascot {
    constructor(host, bubbleText) {
      this.host = host;
      this.bubble = bubbleText;
      this.state = "idle";
      this._typeTimer = null;
      this._resetTimer = null;
    }

    _start() {
      this.setState("hello");
      this._resetTimer = setTimeout(() => this.setState("idle"), 2400);
    }

    setState(state) {
      if (!STATES.includes(state)) state = "idle";
      STATES.forEach((s) => this.root.classList.remove(`is-${s}`));
      // restart CSS animations for one-shot states
      void this.root.getBoundingClientRect();
      this.root.classList.add(`is-${state}`);
      this.state = state;
    }

    /** Show a line in the speech bubble, optionally with a mood that falls back to idle. */
    say(text, mood, holdMs) {
      clearTimeout(this._resetTimer);
      if (mood) this.setState(mood);
      if (mood && mood !== "thinking" && mood !== "idle") {
        this._resetTimer = setTimeout(() => this.setState("idle"), holdMs || 5200);
      }
      this._type(text);
    }

    poke() {
      clearTimeout(this._resetTimer);
      this.setState("poke");
      this._resetTimer = setTimeout(() => this.setState("idle"), 700);
    }

    _type(text) {
      clearInterval(this._typeTimer);
      const el = this.bubble;
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || !text) {
        el.textContent = text || "";
        return;
      }
      const chars = Array.from(text);
      let i = 0;
      el.textContent = "";
      this._typeTimer = setInterval(() => {
        i += 2;
        el.textContent = chars.slice(0, i).join("");
        if (i >= chars.length) clearInterval(this._typeTimer);
      }, 22);
    }
  }

  /** Helly, drawn in SVG (built-in original mascot). */
  class Mascot extends BaseMascot {
    constructor(host, bubbleText) {
      super(host, bubbleText);
      host.innerHTML = SVG;
      this.root = host.querySelector("svg");
      this._start();
    }
  }

  /** A mascot from an image (img/mascot.png + img/mascot.json), shown as a sticker.
   *  If mascot.json gives the head circle, that part becomes its own layer that spins while computing. */
  class ImageMascot extends BaseMascot {
    constructor(host, bubbleText, cfg) {
      super(host, bubbleText);
      const [w, h] = cfg.size || [1, 1];
      let head = "";
      if (cfg.head) {
        const { cx, cy, r } = cfg.head;
        const pct = (v) => `${(v * 100).toFixed(3)}%`;
        head = `<div class="st-head" style="left:${pct((cx - r) / w)};top:${pct((cy - r) / h)};` +
          `width:${pct((2 * r) / w)};height:${pct((2 * r) / h)};background-image:url('${cfg.src}');` +
          `background-size:${pct(w / (2 * r))} ${pct(h / (2 * r))};` +
          `background-position:${pct((cx - r) / (w - 2 * r))} ${pct((cy - r) / (h - 2 * r))}"></div>`;
      }
      host.classList.add("img-mode");
      host.style.setProperty("--st-aspect", `${w} / ${h}`);
      host.innerHTML = `<div class="sticker"><div class="st-frame"><img src="${cfg.src}" alt="" draggable="false">${head}</div>${FX}</div>`;
      this.root = host.querySelector(".sticker");
      this._start();
    }
  }

  PM.Mascot = Mascot;
  PM.ImageMascot = ImageMascot;
  PM.mascotSVG = SVG;
})();
