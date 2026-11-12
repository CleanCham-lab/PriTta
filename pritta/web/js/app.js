/* PriTta main controller. */
(function () {
  "use strict";
  const PM = (window.PM = window.PM || {});
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const EXAMPLE = {
    name: "example_seq.txt",
    text: "CAGGCGCGCTCGGCCCGAGCGGCGGCGGCGGCGGCGGCCGAGGAAAAAAGATGGCGGCGGGCTCGGATCTGCTGGACGAGGTCTTCTTCAACAGCGAGGTGGACGAGAAAGTGGTGAGCGACCTGGTGGGCTCGCTGGAGTCGCAGCTGGCGGCCAGCGCGGCCCACCACCACCACCTCGCGCCGCGCACGCCCGAGGTGCGGGCCGCGGCCGCCGGCGCGCTCGGGAACCATGTTGTGAGCGGCAGCCCGGCCGGAGCCGCGGGCGCAGGGCCGGCCGCCCCCGCCGAGGGCGCGCCCGGAGCGGCGCCGGAGCCGCCCCCCGCAGGTAGAGCGCGGCCGGGGGGCGGGGGGCCGCAGC[GCCCGGGCCCCCCCTCACCG]CGCCGCCCCCTTGTCCCCGCAGGGCCCGCGCCGCCCGCCGCGAAGCTGAGGCCGCCGCCCGAGGGCAGCGCGGGGTCCTGCGCCCCGGTGCCCGCCGCCGCCGCCGTCGCCGCGGGGCCCGAGCCCGCCCCCGCCGGCCCCGCCAAGCCCGCCGGCCCCGCCGCGCTGGCCGCCCGCGCCGGCCCCGGCCCCGGGCCCGGCCCCGGCCCCGGCCCCGGCCCTGGCCCTGGCAAGCCCGCCGGCCCCGGCGCCGCGCAAACTTTGAATGGG",
  };

  const S = {
    info: null,
    records: [],
    cur: 0,
    selPair: 0,
    expanded: false,
    selection: null,
    tab: "settings",
    running: false,
    theme: "dark",
    sound: false,
    baseColors: true,
    animateGel: false,
  };
  let settings, viewer, mascot;

  // ================================================================ helpers
  const rec = () => S.records[S.cur] || null;
  const fmtPos = (n) => Number(n).toLocaleString();

  function toast(msg, err) {
    const el = document.createElement("div");
    el.className = "toast" + (err ? " err" : "");
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), err ? 6000 : 2600);
  }

  // tiny synth for optional sound effects
  let audio = null;
  function beep(kind) {
    if (!S.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const seqs = {
        ok: [[523, 0], [659, 0.08], [784, 0.16], [1047, 0.24]],
        err: [[220, 0], [180, 0.12]],
        tap: [[880, 0]],
        start: [[392, 0], [523, 0.07]],
      };
      (seqs[kind] || seqs.tap).forEach(([f, t]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = kind === "err" ? "square" : "triangle";
        o.frequency.value = f;
        const t0 = audio.currentTime + t;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(kind === "err" ? 0.05 : 0.08, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
        o.connect(g).connect(audio.destination);
        o.start(t0);
        o.stop(t0 + 0.16);
      });
    } catch (e) { /* audio is optional */ }
  }

  let saveTimer = 0;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      PM.api("save_settings", {
        lang: PM.lang, theme: S.theme, sound: S.sound, baseColors: S.baseColors,
        values: settings ? settings.values : undefined,
        preset: settings ? settings.preset : undefined,
        engine: settings ? settings.engine : undefined,
      }).catch(() => {});
    }, 400);
  }

  function gc(seq) {
    if (!seq.length) return 0;
    let n = 0;
    for (const b of seq) if (b === "G" || b === "C" || b === "S") n++;
    return (100 * n) / seq.length;
  }

  function toMarkup(r) {
    const ev = {};
    const add = (pos, ch, close) => { (ev[pos] = ev[pos] || { o: [], c: [] })[close ? "c" : "o"].push(ch); };
    const merged = (regs) => {
      const out = [];
      regs.slice().sort((a, b) => a[0] - b[0]).forEach(([s, l]) => {
        const e = s + l;
        if (out.length && s <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], e);
        else out.push([s, e]);
      });
      return out;
    };
    [["included", "{", "}"], ["excluded", "<", ">"], ["targets", "[", "]"]].forEach(([k, o, c]) => {
      merged(r[k] || []).forEach(([s, e]) => { add(s, o, false); add(e, c, true); });
    });
    let out = "";
    for (let i = 0; i <= r.sequence.length; i++) {
      if (ev[i]) out += ev[i].c.reverse().join("") + ev[i].o.join("");
      if (i < r.sequence.length) {
        out += r.sequence[i];
        if ((i + 1) % 60 === 0 && i + 1 < r.sequence.length && !ev[i + 1]) out += "\n";
      }
    }
    return out;
  }

  // ================================================================ mascot context
  function mascotContext() {
    const r = rec();
    if (!r) return mascot.say(PM.t(PM.mascotMode === "image" ? "m.hello_img" : "m.hello"));
    if (!r.targets.length) return mascot.say(PM.t("m.no_target"));
    if (S.records.length > 1) return mascot.say(PM.t("m.loaded_multi", { n: S.records.length }));
    mascot.say(PM.t("m.loaded", { n: fmtPos(r.sequence.length) }));
  }

  // ================================================================ rendering
  function renderSequence() {
    const r = rec();
    const has = !!r;
    $("#dropzone").hidden = has || !$("#editor").hidden;
    $("#viewer").hidden = !has || !$("#editor").hidden;
    $("#seqFoot").hidden = !has || !$("#editor").hidden;
    $("#viewer").classList.toggle("no-color", !S.baseColors);
    $("#seqStats").innerHTML = has
      ? `<span>${PM.t("seq.length")} <b>${fmtPos(r.sequence.length)}</b> bp</span>
         <span>${PM.t("seq.gc")} <b>${gc(r.sequence).toFixed(1)}</b>%</span>
         <span>${PM.t("seq.regions")} <b>${r.targets.length}</b></span>`
      : "";
    // record picker
    const picker = $("#recPicker");
    picker.hidden = S.records.length < 2;
    if (S.records.length > 1) {
      $("#recSelect").innerHTML = S.records.map((x, i) => {
        const mark = x.result ? (x.result.ok && x.result.pairs.length ? " ✓" : " ✗") : "";
        return `<option value="${i}" ${i === S.cur ? "selected" : ""}>${i + 1}. ${x.id.replace(/</g, "&lt;")}${mark}</option>`;
      }).join("");
    }
    $("#runAllWrap").hidden = S.records.length < 2;
    const pair = r && r.result && r.result.pairs ? r.result.pairs[S.selPair] : null;
    if (has) viewer.setRecord(r, pair);
    else viewer.setRecord(null);
    if (S.selection && has) viewer.setSelection(S.selection);
    updateCursor(null);
  }

  function renderMap() {
    const r = rec();
    PM.renderMap($("#map"), r, r && r.result, S.selPair, S.selection, selectPair);
  }

  function renderResults() {
    const r = rec();
    if (r && !r.picks) r.picks = new Set();
    PM.renderResults($("#tab-results"), r, r && r.result,
      { selPair: S.selPair, expanded: S.expanded, picks: (r && r.picks) || new Set(), animateGel: S.animateGel },
      { onSelectPair: selectPair, onPick: togglePick, onToggleDetails: toggleDetails, onCopy: copyText, onExport: exportAs });
    S.animateGel = false;
    const n = r && r.result && r.result.pairs ? r.result.pairs.length : 0;
    const badge = $("#resCount");
    badge.hidden = !(r && r.result);
    badge.textContent = n;
    badge.classList.toggle("hot", n > 0 && S.tab !== "results");
  }

  function renderAll() {
    renderSequence();
    renderMap();
    renderResults();
    updateRunButton();
  }

  function setTab(tab) {
    S.tab = tab;
    $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    $("#tab-settings").hidden = tab !== "settings";
    $("#tab-results").hidden = tab !== "results";
    $("#resCount").classList.remove("hot");
  }

  function updateRunButton() {
    const btn = $("#runBtn");
    const valid = settings ? settings.problems().length === 0 : false;
    btn.disabled = S.running || !S.records.length || !valid || !S.info.engine.available.length;
    btn.classList.toggle("running", S.running);
    $("#runLabel").textContent = S.running ? PM.t("run.running") : PM.t("run.go");
    btn.title = !S.records.length ? PM.t("run.need_seq") : "";
  }

  function updateCursor(pos) {
    const el = $("#cursorInfo");
    const parts = [];
    if (pos !== null && pos !== undefined) parts.push(`${PM.t("seq.cursor")} <b>${fmtPos(pos + 1)}</b>`);
    if (S.selection) {
      const [a, b] = S.selection;
      parts.push(`${PM.t("seq.selection")} <b>${fmtPos(a + 1)}–${fmtPos(b + 1)}</b> (${b - a + 1} bp)`);
    }
    if (!parts.length && rec()) parts.push(PM.t("seq.dragHint"));
    el.innerHTML = parts.join(" · ");
  }

  // ================================================================ loading
  async function loadText(text, name) {
    let res;
    try {
      res = await PM.api("parse", text, name || "sequence");
    } catch (e) {
      res = { error: String(e.message || e) };
    }
    if (res.error) {
      mascot.say(PM.t("m.error", { msg: res.error }), "sad");
      toast(res.error, true);
      beep("err");
      return false;
    }
    S.records = res.records.map((r) => Object.assign(r, { picks: new Set() }));
    S.cur = 0;
    S.selPair = 0;
    S.selection = null;
    S.expanded = false;
    const params = S.records[0].params || {};
    if (Object.keys(params).length) {
      settings.setValues(params);
      toast(PM.t("toast.params_loaded"));
    }
    const warn = [].concat(...S.records.map((r) => r.warnings || []));
    if (warn.length) toast(warn[0]);
    closeEditor();
    renderAll();
    if (S.records.some((r) => r.result)) {
      S.animateGel = true;
      setTab("results");
      renderResults();
    }
    toast(PM.t("toast.loaded", { n: S.records.length }));
    if (S.records.some((r) => r.result)) mascot.say(PM.t("m.loaded_out"));
    else mascotContext();
    if (rec().targets.length) mascot.setState("happy"), setTimeout(() => mascot.setState("idle"), 1600);
    beep("tap");
    persistRecentName(name);
    return true;
  }

  function persistRecentName() { /* reserved for a recent-files list */ }

  function readFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadText(String(reader.result || ""), file.name);
    reader.onerror = () => toast(PM.t("toast.err"), true);
    reader.readAsText(file);
  }

  // ================================================================ editor
  function openEditor() {
    const r = rec();
    $("#editorText").value = r ? toMarkup(r) : "";
    $("#editor").hidden = false;
    $("#viewer").hidden = true;
    $("#dropzone").hidden = true;
    $("#seqFoot").hidden = true;
    hideSelPop();
    setTimeout(() => $("#editorText").focus(), 0);
  }

  function closeEditor() {
    $("#editor").hidden = true;
    renderSequence();
  }

  async function applyEditor() {
    const text = $("#editorText").value;
    if (!text.trim()) { closeEditor(); return; }
    const r = rec();
    if (r && S.records.length > 1 && !text.trim().startsWith(">")) {
      // edit one record of a multi-record set in place
      const res = await PM.api("parse", text, r.id);
      if (res.error) { toast(res.error, true); mascot.say(PM.t("m.error", { msg: res.error }), "sad"); return; }
      const nr = res.records[0];
      Object.assign(r, { sequence: nr.sequence, targets: nr.targets, excluded: nr.excluded, included: nr.included, result: null, picks: new Set() });
      $("#editor").hidden = true;
      S.selection = null;
      renderAll();
      mascotContext();
      return;
    }
    await loadText(text, r ? r.id : "sequence");
  }

  // ================================================================ selection → regions
  function showSelPop(range, x, y) {
    const pop = $("#selPop");
    const body = $("#seqBody").getBoundingClientRect();
    $("#selLen").textContent = `${fmtPos(range[0] + 1)}–${fmtPos(range[1] + 1)} · ${range[1] - range[0] + 1} bp`;
    pop.hidden = false;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = x - body.left - pw / 2;
    let top = y - body.top + 14;
    left = Math.max(8, Math.min(left, body.width - pw - 8));
    if (top + ph > body.height - 6) top = y - body.top - ph - 14;
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.max(6, top)}px`;
  }
  function hideSelPop() { $("#selPop").hidden = true; }

  function mergeRegions(regs) {
    const out = [];
    regs.slice().sort((a, b) => a[0] - b[0]).forEach(([s, l]) => {
      const e = s + l;
      const last = out[out.length - 1];
      if (last && s <= last[0] + last[1]) last[1] = Math.max(last[0] + last[1], e) - last[0];
      else out.push([s, l]);
    });
    return out;
  }

  function applyRegion(kind) {
    const r = rec();
    const sel = S.selection;
    if (!r || !sel) return;
    const [a, b] = sel;
    if (kind === "copy") {
      copyText(r.sequence.slice(a, b + 1));
    } else if (kind === "clear") {
      const overlaps = ([s, l]) => s <= b && s + l - 1 >= a;
      r.targets = r.targets.filter((x) => !overlaps(x));
      r.excluded = r.excluded.filter((x) => !overlaps(x));
      r.included = r.included.filter((x) => !overlaps(x));
    } else if (kind === "included") {
      r.included = [[a, b - a + 1]];
    } else {
      r[kind] = mergeRegions(r[kind].concat([[a, b - a + 1]]));
    }
    if (kind !== "copy") {
      if (kind === "targets") mascot.say(PM.t("m.target_set", { a: fmtPos(a + 1), b: fmtPos(b + 1) }), "happy", 2200);
      beep("tap");
    }
    S.selection = null;
    viewer.setSelection(null);
    hideSelPop();
    renderSequence();
    renderMap();
  }

  // ================================================================ results interactions
  function selectPair(i) {
    const r = rec();
    if (!r || !r.result || !r.result.pairs[i]) return;
    if (S.selPair !== i) S.expanded = false;
    S.selPair = i;
    const pair = r.result.pairs[i];
    viewer.setPair(pair);
    if (pair.left) viewer.scrollToPos(pair.left.start);
    renderMap();
    if (S.tab !== "results") setTab("results");
    renderResults();
    const card = $(`.pcard[data-index="${i}"]`);
    if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function togglePick(rank) {
    const r = rec();
    if (!r) return;
    r.picks = r.picks || new Set();
    if (r.picks.has(rank)) r.picks.delete(rank); else r.picks.add(rank);
    beep("tap");
    renderResults();
  }

  function toggleDetails() {
    S.expanded = !S.expanded;
    renderResults();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast(PM.t("toast.copied"));
  }

  function stem(id) {
    return String(id || "primers").replace(/\.(txt|fa|fasta|fna|fas|seq|in|out|primer3)$/i, "").replace(/[^\w.-]+/g, "_") || "primers";
  }

  async function saveFile(filename, text) {
    if (PM.isDesktop()) {
      const res = await PM.api("save_text", filename, text);
      if (res && res.saved) {
        toast(`${PM.t("toast.saved")}: ${res.saved}`);
        mascot.say(PM.t("m.exported", { file: res.saved.split(/[\\/]/).pop() }), "happy", 2600);
        beep("ok");
      } else if (res && res.error) {
        toast(res.error, true);
      }
      return;
    }
    const bom = /\.(csv|tsv)$/i.test(filename) ? "﻿" : "";
    const blob = new Blob([bom + text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    mascot.say(PM.t("m.exported", { file: filename }), "happy", 2600);
  }

  async function exportAs(kind) {
    const r = rec();
    if (!r) return;
    const all = S.records.filter((x) => x.result && x.result.ok);
    const base = S.records.length > 1 ? "pritta_batch" : stem(r.id);
    try {
      if (kind === "csv" || kind === "tsv") {
        const res = await PM.api("export_text", all.map((x) => x.result), kind);
        await saveFile(`${base}.primers.${kind}`, res.text);
      } else if (kind === "order") {
        const selection = {};
        all.forEach((x) => {
          // starred pairs; otherwise the selected pair (current record) or rank 1 (other records)
          let picks = x.picks && x.picks.size ? Array.from(x.picks) : [];
          if (!picks.length && x.result.pairs.length) {
            const sel = x === r ? x.result.pairs[S.selPair] : null;
            picks = [sel ? sel.rank : 1];
          }
          selection[x.result.id] = picks;
        });
        const res = await PM.api("export_text", all.map((x) => x.result), "order", selection);
        await saveFile(`${base}.order.tsv`, res.text);
      } else if (kind === "in") {
        let text = r.result && r.result.boulder_in;
        if (!text) {
          const res = await PM.api("boulder_input", payload(r), settings.values);
          if (res.error) throw new Error(res.error);
          text = res.text;
        }
        await saveFile(`${stem(r.id)}.primer3.in`, text);
      } else if (kind === "out") {
        if (r.result && r.result.boulder_out) await saveFile(`${stem(r.id)}.primer3.out`, r.result.boulder_out);
      } else if (kind === "copy") {
        const lines = ["record\trank\tforward\treverse\tprobe\tproduct_bp"];
        (r.result ? r.result.pairs : []).forEach((p) => {
          lines.push([r.id, p.rank, p.left ? p.left.seq : "", p.right ? p.right.seq : "", p.internal ? p.internal.seq : "", p.product_size].join("\t"));
        });
        await copyText(lines.join("\n"));
      }
    } catch (e) {
      toast(String(e.message || e), true);
    }
  }

  // ================================================================ running
  function payload(r) {
    return { id: r.id, sequence: r.sequence, targets: r.targets, excluded: r.excluded, included: r.included };
  }

  async function run() {
    if (S.running || !S.records.length) return;
    if (settings.problems().length) return;
    const all = $("#runAll").checked && S.records.length > 1;
    const targets = all ? S.records.map((_, i) => i) : [S.cur];
    S.running = true;
    hideSelPop();
    updateRunButton();
    beep("start");
    mascot.say(PM.t("m.running"), "thinking");
    let okCount = 0;
    try {
      for (let k = 0; k < targets.length; k++) {
        const r = S.records[targets[k]];
        if (targets.length > 1) mascot.say(PM.t("m.running_n", { i: k + 1, n: targets.length }), "thinking");
        const started = performance.now();
        let res;
        try {
          res = await PM.api("design", payload(r), settings.values, settings.engine);
        } catch (e) {
          res = { ok: false, error: String(e.message || e), pairs: [] };
        }
        // let Helly think for a beat so the state change is visible
        const wait = 450 - (performance.now() - started);
        if (wait > 0 && targets.length === 1) await new Promise((ok) => setTimeout(ok, wait));
        r.result = res;
        r.picks = new Set();
        if (res.ok && res.pairs.length) okCount++;
      }
    } finally {
      S.running = false;
    }
    S.selPair = 0;
    S.expanded = false;
    S.animateGel = true;
    setTab("results");
    renderAll();
    const r = rec();
    const res = r.result;
    if (targets.length > 1) {
      mascot.say(PM.t("m.done_all", { ok: okCount, n: targets.length }), okCount ? "happy" : "sad");
      beep(okCount ? "ok" : "err");
    } else if (!res.ok) {
      mascot.say(PM.t("m.error", { msg: res.error }), "sad");
      beep("err");
    } else if (!res.pairs.length) {
      mascot.say(PM.t("m.none", { reason: PM.topReason(res.explain || {}) }), "sad");
      beep("err");
    } else {
      const top = res.pairs[0];
      mascot.say(PM.t("m.done", { n: res.pairs.length, size: top.product_size, grade: top.grade }), "happy");
      beep("ok");
      if (top.left) viewer.scrollToPos(top.left.start);
    }
  }

  // ================================================================ chrome
  function applyTheme() {
    document.documentElement.dataset.theme = S.theme;
  }
  function applySound() {
    $("#soundBtn").classList.toggle("on", S.sound);
    $("#soundBtn .wave").style.display = S.sound ? "" : "none";
    $("#soundBtn .mute").style.display = S.sound ? "none" : "";
  }
  function setLang(lang) {
    PM.lang = lang === "en" ? "en" : "ko";
    $$("#langSeg button").forEach((b) => b.classList.toggle("on", b.dataset.lang === PM.lang));
    PM.applyI18n();
    if (settings) settings.render();
    if (S.info) renderAll();
    if (mascot) mascotContext();
  }

  function engineChip() {
    const e = S.info.engine;
    const chip = $("#engineChip");
    chip.classList.toggle("off", !e.available.length);
    const label = e.default === "primer3-py" ? `primer3-py ${e.primer3_py}` : e.default === "primer3_core" ? "primer3_core" : PM.t("top.engine.none");
    $("span", chip).textContent = label;
    chip.title = e.primer3_core ? `primer3_core: ${e.primer3_core}` : "";
    $("#aboutEngine").textContent = [e.primer3_py ? `primer3-py ${e.primer3_py}` : null, e.primer3_core].filter(Boolean).join(" · ") || "—";
  }

  function wire() {
    // tabs
    $$(".tabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
    // top bar
    $$("#langSeg button").forEach((b) => b.addEventListener("click", () => { setLang(b.dataset.lang); persist(); }));
    $("#themeBtn").addEventListener("click", () => { S.theme = S.theme === "dark" ? "light" : "dark"; applyTheme(); persist(); });
    $("#soundBtn").addEventListener("click", () => { S.sound = !S.sound; applySound(); beep("tap"); persist(); });
    $("#aboutBtn").addEventListener("click", () => { $("#about").hidden = false; });
    $("#aboutClose").addEventListener("click", () => { $("#about").hidden = true; });
    $("#about").addEventListener("click", (e) => { if (e.target.id === "about") $("#about").hidden = true; });
    $("#repoBtn").addEventListener("click", () => {
      PM.api("open_external", S.info.repo).catch(() => window.open(S.info.repo, "_blank"));
    });
    // sequence toolbar
    const openPicker = () => $("#fileInput").click();
    $("#openBtn").addEventListener("click", openPicker);
    $("#dzOpen").addEventListener("click", openPicker);
    $("#fileInput").addEventListener("change", (e) => { readFile(e.target.files[0]); e.target.value = ""; });
    $("#exampleBtn").addEventListener("click", () => loadText(EXAMPLE.text, EXAMPLE.name));
    $("#dzExample").addEventListener("click", () => loadText(EXAMPLE.text, EXAMPLE.name));
    $("#editBtn").addEventListener("click", openEditor);
    $("#dzPaste").addEventListener("click", openEditor);
    $("#editCancel").addEventListener("click", closeEditor);
    $("#editApply").addEventListener("click", applyEditor);
    $("#editorText").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); e.stopPropagation(); applyEditor(); }
    });
    $("#clearBtn").addEventListener("click", () => {
      S.records = []; S.cur = 0; S.selection = null; S.selPair = 0;
      hideSelPop(); closeEditor(); renderAll(); mascotContext();
    });
    $("#recSelect").addEventListener("change", (e) => {
      S.cur = +e.target.value; S.selPair = 0; S.selection = null; S.expanded = false;
      hideSelPop(); renderAll(); mascotContext();
    });
    $("#baseColors").addEventListener("change", (e) => { S.baseColors = e.target.checked; $("#viewer").classList.toggle("no-color", !S.baseColors); persist(); });
    // selection popup
    $$("#selPop button").forEach((b) => b.addEventListener("mousedown", (e) => e.stopPropagation()));
    $$("#selPop button").forEach((b) => b.addEventListener("click", () => applyRegion(b.dataset.region)));
    // run
    $("#runBtn").addEventListener("click", run);
    // mascot
    const poke = () => {
      mascot.poke();
      const tips = PM.t("m.tips");
      setTimeout(() => mascot.say(tips[Math.floor(Math.random() * tips.length)]), 120);
      beep("tap");
    };
    $("#mascot").addEventListener("click", poke);
    $("#mascot").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poke(); } });
    // menus close on outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".menu-wrap")) $$(".menu").forEach((m) => (m.hidden = true));
    });
    // keyboard
    document.addEventListener("keydown", (e) => {
      const inField = e.target.closest && e.target.closest("input, textarea, select");
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); openPicker(); }
      else if (e.key === "Escape") {
        hideSelPop(); $("#about").hidden = true; $$(".menu").forEach((m) => (m.hidden = true));
        if (S.selection) { S.selection = null; viewer.setSelection(null); renderMap(); updateCursor(null); }
      } else if (!inField && rec() && rec().result && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        const n = rec().result.pairs.length;
        if (n) { e.preventDefault(); selectPair((S.selPair + (e.key === "ArrowDown" ? 1 : n - 1)) % n); }
      }
    });
    // paste anywhere (outside inputs) loads a sequence
    document.addEventListener("paste", (e) => {
      if (e.target.closest && e.target.closest("input, textarea")) return;
      const text = (e.clipboardData || window.clipboardData).getData("text");
      if (text && text.trim()) { e.preventDefault(); loadText(text, "pasted_sequence"); }
    });
    // drag & drop
    let depth = 0;
    window.addEventListener("dragenter", (e) => { e.preventDefault(); depth++; $("#dropOverlay").hidden = false; });
    window.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) $("#dropOverlay").hidden = true; });
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => {
      e.preventDefault(); depth = 0; $("#dropOverlay").hidden = true;
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f);
      else {
        const text = e.dataTransfer.getData("text");
        if (text) loadText(text, "dropped_sequence");
      }
    });
    window.addEventListener("resize", () => renderMap());
  }

  // ================================================================ boot
  function setupMascot() {
    const m = S.info && S.info.mascot;
    if (m && m.src) {
      mascot = new PM.ImageMascot($("#mascot"), $("#bubbleText"), m);
      $(".col-left").classList.add("has-sticker");
      $(".bubble-name").textContent = m.name || "PriTta";
      $("#brandMark").innerHTML = `<img src="img/icon.png" alt="">`;
      $("#aboutHelly").innerHTML = `<img src="${m.src}" alt="">`;
      $("#mascot").setAttribute("aria-label", m.name || "PriTta");
      const credit = document.querySelector('[data-i18n="about.mascot.d"]');
      if (credit) credit.dataset.i18n = "about.mascot.img";
      PM.mascotMode = "image";
    } else {
      mascot = new PM.Mascot($("#mascot"), $("#bubbleText"));
      $("#brandMark").innerHTML = PM.mascotSVG.replace('viewBox="0 0 160 212"', 'viewBox="22 0 116 166"').replace('class="helly"', 'class="helly brand-helly"');
      $("#aboutHelly").innerHTML = PM.mascotSVG.replace('class="helly"', 'class="helly is-idle"');
      PM.mascotMode = "helly";
    }
  }

  async function boot() {
    PM.applyI18n();
    viewer = new PM.Viewer($("#viewer"), {
      onSelect: (range, x, y) => { S.selection = range; showSelPop(range, x, y); renderMap(); updateCursor(null); },
      onHover: (pos) => updateCursor(pos),
      onClear: () => { S.selection = null; hideSelPop(); renderMap(); updateCursor(null); },
    });

    try {
      S.info = await PM.api("init");
    } catch (e) {
      setupMascot();
      mascot.say(PM.t("m.error", { msg: String(e.message || e) }), "sad");
      return;
    }
    setupMascot();
    const st = S.info.settings || {};
    PM.lang = st.lang || ((navigator.language || "ko").toLowerCase().startsWith("ko") ? "ko" : "en");
    S.theme = st.theme || "dark";
    S.sound = !!st.sound;
    S.baseColors = st.baseColors !== false;
    $("#baseColors").checked = S.baseColors;
    $("#ver").textContent = `v${S.info.version}`;
    $("#aboutVer").textContent = `v${S.info.version}`;
    applyTheme();
    applySound();

    settings = new PM.Settings($("#tab-settings"), S.info, st, () => { updateRunButton(); persist(); });
    PM.app = {
      onPreset: (name) => { mascot.say(PM.t("m.preset", { name: PM.t("preset." + name) })); beep("tap"); },
    };
    engineChip();
    wire();
    setLang(PM.lang);
    mascot.say(PM.t(PM.mascotMode === "image" ? "m.hello_img" : "m.hello"), "hello");
    if (!S.info.engine.available.length) {
      mascot.say(PM.t("m.error", { msg: "Primer3 engine not found (pip install primer3-py)" }), "sad");
    }
    if (S.info.startup) await loadText(S.info.startup.text, S.info.startup.name);
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
