/* Results tab: report (virtual gel + candidate filtering) and ranked pair cards. */
(function () {
  "use strict";
  const PM = (window.PM = window.PM || {});
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fx = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? "–" : Number(v).toFixed(d));

  const ICON = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.5 1.2 6.4L12 17.3l-5.7 3.1 1.2-6.4-4.7-4.5 6.4-.8z"/></svg>',
    starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.5 1.2 6.4L12 17.3l-5.7 3.1 1.2-6.4-4.7-4.5 6.4-.8z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
    export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>',
  };
  PM.ICON = ICON;

  function colorSeq(seq) {
    let h = "";
    for (const b of seq) {
      const c = { A: "ba", C: "bc", G: "bg", T: "bt" }[b] || "";
      h += c ? `<span class="${c}">${b}</span>` : b;
    }
    return h;
  }

  // ------------------------------------------------------------------ gel
  function gelSVG(pairs, selIndex) {
    const lanes = pairs.slice(0, 8);
    const sizes = lanes.map((p) => p.product_size).filter(Boolean);
    const big = sizes.some((s) => s > 1400);
    const ladder = big ? [250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000]
                       : [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500];
    const lo = Math.min(ladder[0], ...sizes.map((s) => s * 0.9)) * 0.92;
    const hi = Math.max(ladder[ladder.length - 1], ...sizes.map((s) => s * 1.1)) * 1.05;
    const W = 146, H = 214, top = 24, bottom = H - 8, labelW = 26;
    const nl = lanes.length + 1;
    const laneW = (W - labelW - 4) / nl;
    const y = (bp) => top + 10 + ((Math.log(hi) - Math.log(bp)) / (Math.log(hi) - Math.log(lo))) * (bottom - top - 14);
    const wellY = top;
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="${esc(PM.t("res.gel"))}">
      <defs><filter id="bandglow" x="-30%" y="-300%" width="160%" height="700%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>`;
    const laneX = (i) => labelW + 2 + i * laneW;
    for (let i = 0; i < nl; i++) {
      s += `<rect x="${laneX(i) + 3}" y="${wellY - 4}" width="${laneW - 6}" height="5" rx="1" fill="var(--gel-well)" stroke="#2c2560" stroke-width="0.6"/>`;
      const lab = i === 0 ? "L" : String(lanes[i - 1].rank);
      const on = i > 0 && lanes[i - 1].index === selIndex;
      s += `<text class="lane-label ${on ? "on" : ""}" x="${laneX(i) + laneW / 2}" y="12" text-anchor="middle">${lab}</text>`;
    }
    // ladder
    const marks = big ? [500, 1000, 3000, 10000] : [100, 500, 1000, 1500];
    ladder.forEach((bp) => {
      const yy = y(bp);
      const bright = bp === 500 || bp === 1000 || bp === 3000;
      s += `<g class="band" data-dy="${(yy - wellY).toFixed(1)}"><rect x="${laneX(0) + 4}" y="${yy - 1}" width="${laneW - 8}" height="${bright ? 2.6 : 1.8}" rx="1" fill="#e3ddff" opacity="${bright ? 0.95 : 0.6}"/></g>`;
      if (marks.includes(bp)) {
        s += `<text x="${labelW - 2}" y="${yy + 3}" text-anchor="end" font-size="8.5" fill="#9d97cf" font-family="Chakra Petch">${bp >= 1000 ? bp / 1000 + "k" : bp}</text>`;
      }
    });
    lanes.forEach((p, i) => {
      if (!p.product_size) return;
      const yy = y(p.product_size);
      const on = p.index === selIndex;
      const x0 = laneX(i + 1) + 3, w = laneW - 6;
      s += `<g class="band" data-dy="${(yy - wellY).toFixed(1)}">
        <rect x="${x0}" y="${yy - 2.5}" width="${w}" height="5" rx="2" fill="var(--band)" opacity="${on ? 0.9 : 0.55}" filter="url(#bandglow)"/>
        <rect x="${x0 + 1}" y="${yy - 1.6}" width="${w - 2}" height="3.2" rx="1.5" fill="${on ? "#fff3d6" : "#ffd7a0"}" opacity="${on ? 1 : 0.75}"/>
      </g>`;
    });
    return s + "</svg>";
  }

  function animateGel(host, animate) {
    const bands = host.querySelectorAll(".band");
    if (!animate) return;
    bands.forEach((b) => {
      b.style.transition = "none";
      b.style.transform = `translateY(${-Number(b.dataset.dy)}px)`;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bands.forEach((b) => {
        b.style.transition = "";
        b.style.transform = "translateY(0)";
      });
    }));
  }

  // ------------------------------------------------------------------ filtering funnel
  const SEG_COLORS = ["var(--coral)", "var(--warn)", "var(--lilac)", "var(--sky)", "#8f88c9", "#6f68a8", "#5a5496"];

  function funnelHTML(explain) {
    const sides = [["left", "res.left"], ["right", "res.right"], ["internal", "res.internal"], ["pair", "res.pair"]];
    let h = `<div class="funnel"><h4>${esc(PM.t("res.filter"))}</h4>`;
    for (const [key, label] of sides) {
      const items = explain[key];
      if (!items || !items.length) continue;
      const considered = (items.find((i) => i.label === "considered") || {}).count || 0;
      const ok = (items.find((i) => i.label === "ok") || {}).count || 0;
      const reasons = items.filter((i) => i.label !== "considered" && i.label !== "ok").sort((a, b) => b.count - a.count);
      const total = Math.max(considered, ok + reasons.reduce((a, r) => a + r.count, 0), 1);
      let bar = "";
      reasons.forEach((r, i) => {
        bar += `<i style="width:${(100 * r.count) / total}%;background:${SEG_COLORS[i % SEG_COLORS.length]}" title="${esc(PM.explainLabel(r.label))}: ${r.count}"></i>`;
      });
      bar += `<i style="width:${(100 * ok) / total}%;background:var(--mint)" title="ok: ${ok}"></i>`;
      const legend = reasons.slice(0, 3).map((r) => `${esc(PM.explainLabel(r.label))} ${r.count.toLocaleString()}`).join(" · ");
      h += `<div class="fbar-row"><div class="fbar-top"><span>${esc(PM.t(label))} <b>${considered.toLocaleString()}</b></span><span class="ok">${ok.toLocaleString()} ✓</span></div>
        <div class="fbar">${bar}</div>${legend ? `<div class="fbar-legend">${legend}</div>` : ""}</div>`;
    }
    return h + "</div>";
  }

  PM.topReason = function (explain) {
    let best = null;
    for (const key of ["left", "right", "internal", "pair"]) {
      (explain[key] || []).forEach((i) => {
        if (i.label !== "considered" && i.label !== "ok" && (!best || i.count > best.count)) best = i;
      });
    }
    return best ? PM.explainLabel(best.label) : "?";
  };

  // ------------------------------------------------------------------ cards
  function level(value, limit) {
    if (value === null || value === undefined) return 0;
    if (value <= 0) return 1;
    return Math.max(1, Math.min(5, Math.ceil((value / (limit || 47)) * 5)));
  }

  function statHTML(labelKey, value, limit) {
    const lv = level(value, limit);
    return `<div class="stat" title="${esc(PM.t(labelKey))}: ${fx(value, 1)} °C / ${fx(limit, 0)} °C"><span>${esc(PM.t(labelKey))}</span>
      <div class="pips l${lv}"><i></i><i></i><i></i><i></i><i></i></div></div>`;
  }

  function oligoRow(kind, o) {
    const label = { f: "F", r: "R", p: "P" }[kind];
    return `<div class="oligo"><span class="dir ${kind}">${label}</span>
      <span class="oseq" title="${o.seq}">${colorSeq(o.seq)}</span>
      <span class="ometa"><span><b>${fx(o.tm, 1)}</b>°</span><span><b>${fx(o.gc, 0)}</b>%</span>
      <button class="copy" data-copy="${o.seq}" title="${esc(PM.t("res.copy"))}" aria-label="${esc(PM.t("res.copy"))}">${ICON.copy}</button></span></div>`;
  }

  function structBlock(title, st) {
    if (!st) return "";
    const found = st.found && st.lines && st.lines.length;
    return `<div class="struct ${found ? "" : "none"}"><header><b>${esc(title)}</b><span>Tm ${fx(st.tm, 1)} °C · ΔG ${fx(st.dg, 2)} kcal/mol</span></header>
      <pre>${found ? esc(st.lines.join("\n")) : esc(PM.t("res.s.none"))}</pre></div>`;
  }

  function detailsHTML(p) {
    const cols = [["left", "F"], ["right", "R"], ["internal", "P"]].filter(([k]) => p[k]);
    const row = (key, fn) => `<tr><td>${esc(PM.t(key))}</td>${cols.map(([k]) => `<td>${fn(p[k])}</td>`).join("")}</tr>`;
    let h = `<div class="details"><table class="dtable"><thead><tr><th></th>${cols.map(([, n]) => `<th>${n}</th>`).join("")}</tr></thead><tbody>
      ${row("res.d.pos", (o) => `${o.start + 1}–${o.end + 1}`)}
      ${row("res.d.len", (o) => o.len)}
      ${row("res.d.tm", (o) => fx(o.tm, 2))}
      ${row("res.d.gc", (o) => fx(o.gc, 1))}
      ${row("res.d.hairpin", (o) => fx(o.hairpin_th, 1))}
      ${row("res.d.self_any", (o) => fx(o.self_any_th, 1))}
      ${row("res.d.self_end", (o) => fx(o.self_end_th, 1))}
      ${row("res.d.end_stab", (o) => fx(o.end_stability, 2))}
      ${row("res.d.penalty", (o) => fx(o.penalty, 3))}
      </tbody></table><div class="structs">`;
    h += structBlock(PM.t("res.s.hetero"), p.structures && p.structures.heterodimer);
    for (const [k, n] of cols) {
      const st = p[k].structures || {};
      h += structBlock(`${n} · ${PM.t("res.s.homo")}`, st.homodimer);
      h += structBlock(`${n} · ${PM.t("res.s.hairpin")}`, st.hairpin);
    }
    return h + "</div></div>";
  }

  function cardHTML(p, params, state) {
    const on = p.index === state.selPair;
    const picked = state.picks.has(p.rank);
    const L = p.left || {}, R = p.right || {};
    const mx = (a, b) => Math.max(a ?? 0, b ?? 0);
    const problems = [L.problems, R.problems, p.internal && p.internal.problems].filter(Boolean);
    return `<article class="pcard ${on ? "on" : ""}" data-index="${p.index}">
      <div class="pc-top">
        <span class="grade g${p.grade}" title="${esc(PM.t("res.grade.tip"))}">${p.grade}</span>
        <div class="pc-rank">#${p.rank}<small>${esc(PM.t("res.penalty"))} ${fx(p.penalty, 2)}</small></div>
        <div class="pc-size"><b>${p.product_size}<small>bp</small></b><span>${esc(PM.t("res.product_tm"))} ${fx(p.product_tm, 1)} °C</span></div>
        <button class="pick ${picked ? "on" : ""}" data-pick="${p.rank}" title="${esc(PM.t("res.pick"))}" aria-label="${esc(PM.t("res.pick"))}" aria-pressed="${picked}">${picked ? ICON.star : ICON.starO}</button>
      </div>
      ${p.left ? oligoRow("f", p.left) : ""}
      ${p.right ? oligoRow("r", p.right) : ""}
      ${p.internal ? oligoRow("p", p.internal) : ""}
      <div class="stats">
        ${statHTML("res.st.hairpin", mx(L.hairpin_th, R.hairpin_th), params.PRIMER_MAX_HAIRPIN_TH)}
        ${statHTML("res.st.self", mx(L.self_any_th, R.self_any_th), params.PRIMER_MAX_SELF_ANY_TH)}
        ${statHTML("res.st.self_end", mx(L.self_end_th, R.self_end_th), params.PRIMER_MAX_SELF_END_TH)}
        ${statHTML("res.st.pair", p.compl_any_th, params.PRIMER_PAIR_MAX_COMPL_ANY_TH)}
        ${statHTML("res.st.pair_end", p.compl_end_th, params.PRIMER_PAIR_MAX_COMPL_END_TH)}
      </div>
      ${problems.length ? `<div class="problems">⚠ ${esc(problems.join(" / "))}</div>` : ""}
      ${on && state.expanded ? detailsHTML(p) : ""}
      ${on ? `<button class="more-btn" data-more>${esc(PM.t(state.expanded ? "res.less" : "res.details"))} ${ICON.chevron}</button>` : ""}
    </article>`;
  }

  // ------------------------------------------------------------------ main
  PM.renderResults = function (host, rec, result, state, h) {
    if (!rec || !result) {
      host.innerHTML = `<div class="empty-results"><h3>${esc(PM.t("res.empty.t"))}</h3><p>${esc(PM.t("res.empty.b"))}</p></div>`;
      return;
    }
    const pairs = result.pairs || [];
    const params = result.params || {};
    const sub = [
      pairs.length ? `${pairs.length} ${PM.t("res.pairs")}` : null,
      result.engine === "loaded from file" ? PM.t("res.loaded") : result.engine,
    ].filter(Boolean).join(" · ");
    let html = `<div class="res-head"><div class="res-title"><b title="${esc(rec.id)}">${esc(rec.id)}</b><small>${esc(sub)}</small></div>
      <div class="menu-wrap"><button class="btn small" data-menu>${ICON.export}${esc(PM.t("res.export"))} ${ICON.chevron}</button>
      <div class="menu" hidden>
        <button data-export="csv">${esc(PM.t("res.ex.csv"))}<small>${esc(PM.t("res.ex.csv.d"))}</small></button>
        <button data-export="tsv">${esc(PM.t("res.ex.tsv"))}<small>${esc(PM.t("res.ex.tsv.d"))}</small></button>
        <button data-export="order">${esc(PM.t("res.ex.order"))}<small>${esc(PM.t("res.ex.order.d"))}</small></button>
        <hr>
        <button data-export="in">${esc(PM.t("res.ex.in"))}<small>${esc(PM.t("res.ex.in.d"))}</small></button>
        <button data-export="out" ${result.boulder_out ? "" : "disabled"}>${esc(PM.t("res.ex.out"))}<small>${esc(PM.t("res.ex.out.d"))}</small></button>
        <hr>
        <button data-export="copy">${esc(PM.t("res.copy_all"))}</button>
      </div></div></div>`;
    if (result.error) html += `<div class="err-box">${esc(result.error)}</div>`;
    if (result.warnings && result.warnings.length) html += `<div class="warn-box">${result.warnings.map(esc).join("<br>")}</div>`;
    const hasExplain = result.explain && Object.keys(result.explain).length;
    if (pairs.length || hasExplain) {
      html += `<div class="report">
        <div class="gel-box">${gelSVG(pairs, state.selPair)}<div class="gel-cap">${esc(PM.t("res.ladder"))}</div></div>
        ${funnelHTML(result.explain || {})}
      </div>`;
    }
    if (result.ok && !pairs.length) {
      html += `<div class="err-box"><b>${esc(PM.t("res.none"))}</b><br>${esc(PM.t("res.none.tip"))}</div>`;
    }
    html += `<div class="pairs">${pairs.map((p) => cardHTML(p, params, state)).join("")}</div>`;
    host.innerHTML = html;
    animateGel(host, state.animateGel);
    state.animateGel = false;

    // wiring
    const menuBtn = host.querySelector("[data-menu]");
    const menu = host.querySelector(".menu");
    if (menuBtn) {
      menuBtn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    }
    host.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => { menu.hidden = true; h.onExport(b.dataset.export); }));
    host.querySelectorAll(".pcard").forEach((c) => c.addEventListener("click", (e) => {
      if (e.target.closest("button, .details")) return;
      if (String(window.getSelection() || "").trim()) return; // user is selecting text
      h.onSelectPair(+c.dataset.index);
    }));
    host.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => h.onCopy(b.dataset.copy)));
    host.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => h.onPick(+b.dataset.pick)));
    const more = host.querySelector("[data-more]");
    if (more) more.addEventListener("click", () => h.onToggleDetails());
  };
})();
