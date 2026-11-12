/* Amplicon map: ruler, regions and one lane per primer pair. */
(function () {
  "use strict";
  const PM = (window.PM = window.PM || {});
  const MAX_LANES = 10;

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
    for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
    return 10 * p;
  }

  PM.renderMap = function (host, rec, result, selIndex, selection, onPick) {
    const w = Math.max(320, host.clientWidth || 600);
    const pairs = (result && result.pairs) || [];
    const shown = pairs.slice(0, MAX_LANES);
    if (selIndex >= MAX_LANES && pairs[selIndex]) shown.push(pairs[selIndex]);
    const laneH = 13;
    const top = 44;
    const h = rec ? top + Math.max(1, shown.length) * laneH + 8 : 60;
    const padL = 36, padR = 10;
    const n = rec ? rec.sequence.length : 1;
    const x = (pos) => padL + (pos / Math.max(n, 1)) * (w - padL - padR);
    let s = `<svg viewBox="0 0 ${w} ${h}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="rgba(255,92,122,0.12)"/><rect width="2" height="5" fill="rgba(255,92,122,0.75)"/>
        </pattern>
        <filter id="glow" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="2.4"/></filter>
      </defs>`;
    if (!rec) {
      s += `<text x="${w / 2}" y="34" text-anchor="middle" fill="var(--dim)" font-size="12">—</text></svg>`;
      host.innerHTML = s;
      return;
    }
    // ruler
    const step = niceStep(n / Math.max(3, Math.floor(w / 110)));
    s += `<line x1="${x(0)}" x2="${x(n)}" y1="14" y2="14" stroke="var(--line)"/>`;
    for (let p = 0; p <= n; p += step) {
      const lab = p === 0 ? 1 : p;
      s += `<line x1="${x(p)}" x2="${x(p)}" y1="10" y2="14" stroke="var(--line-strong)"/>`;
      s += `<text x="${x(p)}" y="8" font-size="9.5" text-anchor="middle" fill="var(--dim)" font-family="Chakra Petch">${lab}</text>`;
    }
    // template
    s += `<rect x="${x(0)}" y="22" width="${x(n) - x(0)}" height="8" rx="2" fill="var(--panel-3)"/>`;
    (rec.included || []).forEach(([a, l]) => {
      s += `<rect x="${x(a)}" y="19" width="${Math.max(2, x(a + l) - x(a))}" height="14" rx="2" fill="rgba(108,168,255,0.12)" stroke="var(--sky)" stroke-dasharray="3 2"/>`;
    });
    (rec.excluded || []).forEach(([a, l]) => {
      s += `<rect x="${x(a)}" y="20" width="${Math.max(2, x(a + l) - x(a))}" height="12" fill="url(#hatch)"/>`;
    });
    (rec.targets || []).forEach(([a, l]) => {
      const ww = Math.max(3, x(a + l) - x(a));
      s += `<rect x="${x(a)}" y="19" width="${ww}" height="14" rx="2" fill="var(--accent)" opacity="0.35" filter="url(#glow)"/>`;
      s += `<rect x="${x(a)}" y="19" width="${ww}" height="14" rx="2" fill="var(--accent)"/>`;
    });
    if (selection) {
      const [a, b] = selection;
      s += `<path d="M${x(a)} 36 v4 H${x(b + 1)} v-4" fill="none" stroke="var(--text)" stroke-width="1.5"/>`;
    }
    // lanes
    shown.forEach((p, li) => {
      const y = top + li * laneH + laneH / 2;
      const on = p.index === selIndex;
      const op = on ? 1 : 0.55;
      s += `<g class="lane" data-index="${p.index}">`;
      s += `<rect class="lane-hit" x="0" y="${y - laneH / 2}" width="${w}" height="${laneH}" fill="transparent"/>`;
      s += `<text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" font-weight="700" font-family="Chakra Petch" fill="${on ? "var(--accent)" : "var(--dim)"}">#${p.rank}</text>`;
      if (p.left && p.right) {
        s += `<line x1="${x(p.left.start)}" x2="${x(p.right.end + 1)}" y1="${y}" y2="${y}" stroke="${on ? "var(--text)" : "var(--line-strong)"}" stroke-width="${on ? 1.6 : 1}" opacity="${op}"/>`;
      }
      const arrow = (o, dir, color) => {
        const a = x(o.start), b = Math.max(x(o.end + 1), a + 6);
        const hh = on ? 5 : 4;
        const tip = 5;
        const d = dir > 0
          ? `M${a} ${y - hh} H${b - tip} L${b} ${y} L${b - tip} ${y + hh} H${a} Z`
          : `M${b} ${y - hh} H${a + tip} L${a} ${y} L${a + tip} ${y + hh} H${b} Z`;
        return `<path d="${d}" fill="${color}" opacity="${op}"/>`;
      };
      if (p.left) s += arrow(p.left, 1, "var(--mint)");
      if (p.right) s += arrow(p.right, -1, "var(--coral)");
      if (p.internal) {
        s += `<rect x="${x(p.internal.start)}" y="${y - 3}" width="${Math.max(4, x(p.internal.end + 1) - x(p.internal.start))}" height="6" rx="1.5" fill="var(--sky)" opacity="${op}"/>`;
      }
      if (on && p.left && p.right) {
        const mid = (x(p.left.start) + x(p.right.end + 1)) / 2;
        s += `<text x="${mid}" y="${y - 3}" text-anchor="middle" font-size="9.5" font-weight="700" font-family="Chakra Petch" fill="var(--text)" paint-order="stroke" stroke="var(--panel)" stroke-width="3">${p.product_size} bp</text>`;
      }
      s += `</g>`;
    });
    s += `</svg>`;
    host.innerHTML = s;
    host.querySelectorAll(".lane").forEach((g) => {
      g.addEventListener("click", () => onPick(+g.dataset.index));
    });
  };
})();
