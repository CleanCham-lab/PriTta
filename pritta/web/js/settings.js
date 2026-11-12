/* Settings form: presets + Primer3 parameters, built from the spec the Python side sends. */
(function () {
  "use strict";
  const PM = (window.PM = window.PM || {});

  const PRESET_ORDER = ["standard", "qpcr", "taqman", "sanger"];
  const RANGE_CHIPS = ["70-150", "100-300", "150-700", "400-800", "700-1500"];

  const LAYOUT = [
    { group: "product", items: [
      { type: "range", tag: "PRIMER_PRODUCT_SIZE_RANGE", label: "f.size_range", help: "f.size_range.h" },
      { type: "stepper", tag: "PRIMER_NUM_RETURN", label: "f.num_return" },
    ] },
    { group: "primer", items: [
      { type: "triple", tags: ["PRIMER_MIN_SIZE", "PRIMER_OPT_SIZE", "PRIMER_MAX_SIZE"], label: "f.length" },
      { type: "triple", tags: ["PRIMER_MIN_TM", "PRIMER_OPT_TM", "PRIMER_MAX_TM"], label: "f.tm" },
      { type: "pair", tags: ["PRIMER_MIN_GC", "PRIMER_MAX_GC"], label: "f.gc" },
      { type: "num", tag: "PRIMER_PAIR_MAX_DIFF_TM", label: "f.diff_tm", help: "f.diff_tm.h" },
      { type: "stepper", tag: "PRIMER_GC_CLAMP", label: "f.gc_clamp", help: "f.gc_clamp.h" },
      { type: "stepper", tag: "PRIMER_MAX_POLY_X", label: "f.poly_x", help: "f.poly_x.h" },
    ] },
    { group: "probe", toggle: "PRIMER_PICK_INTERNAL_OLIGO", items: [
      { type: "triple", tags: ["PRIMER_INTERNAL_MIN_SIZE", "PRIMER_INTERNAL_OPT_SIZE", "PRIMER_INTERNAL_MAX_SIZE"], label: "f.length" },
      { type: "triple", tags: ["PRIMER_INTERNAL_MIN_TM", "PRIMER_INTERNAL_OPT_TM", "PRIMER_INTERNAL_MAX_TM"], label: "f.tm" },
    ] },
    { group: "advanced", collapsible: true, items: [
      { type: "sub", label: "g.chemistry" },
      { type: "num", tag: "PRIMER_SALT_MONOVALENT", label: "f.mono" },
      { type: "num", tag: "PRIMER_SALT_DIVALENT", label: "f.di" },
      { type: "num", tag: "PRIMER_DNTP_CONC", label: "f.dntp" },
      { type: "num", tag: "PRIMER_DNA_CONC", label: "f.dna" },
      { type: "sub", label: "g.structure", help: "f.struct.h" },
      { type: "num", tag: "PRIMER_MAX_HAIRPIN_TH", label: "f.hairpin" },
      { type: "num", tag: "PRIMER_MAX_SELF_ANY_TH", label: "f.self_any" },
      { type: "num", tag: "PRIMER_MAX_SELF_END_TH", label: "f.self_end" },
      { type: "num", tag: "PRIMER_PAIR_MAX_COMPL_ANY_TH", label: "f.pair_any" },
      { type: "num", tag: "PRIMER_PAIR_MAX_COMPL_END_TH", label: "f.pair_end" },
      { type: "sub", label: "g.run" },
      { type: "stepper", tag: "PRIMER_MAX_END_GC", label: "f.end_gc", help: "f.end_gc.h" },
      { type: "switch", tag: "PRIMER_PICK_ANYWAY", label: "f.pick_anyway", help: "f.pick_anyway.h" },
      { type: "engine", label: "f.engine" },
    ] },
  ];

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  class Settings {
    constructor(host, info, initial, onChange) {
      this.host = host;
      this.info = info;
      this.spec = Object.fromEntries(info.spec.map((p) => [p.tag, p]));
      this.presets = info.presets;
      this.values = Object.assign({}, this.presets.standard, initial && initial.values);
      this.preset = (initial && initial.preset) || "standard";
      this.engine = (initial && initial.engine) || "auto";
      this.advancedOpen = false;
      this.onChange = onChange || (() => {});
      this.render();
    }

    get(tag) { return this.values[tag]; }

    setValues(values, preset) {
      Object.assign(this.values, values);
      this.preset = preset || this._detectPreset();
      this.render();
      this._changed(false);
    }

    applyPreset(name) {
      this.values = Object.assign({}, this.presets[name]);
      this.preset = name;
      this.render();
      this._changed(false);
    }

    problems() {
      const v = this.values, out = [];
      const order = (a, b, c) => { if (!(+v[a] <= +v[b] && +v[b] <= +v[c])) out.push(a, b, c); };
      order("PRIMER_MIN_SIZE", "PRIMER_OPT_SIZE", "PRIMER_MAX_SIZE");
      order("PRIMER_MIN_TM", "PRIMER_OPT_TM", "PRIMER_MAX_TM");
      if (+v.PRIMER_MIN_GC > +v.PRIMER_MAX_GC) out.push("PRIMER_MIN_GC", "PRIMER_MAX_GC");
      if (+v.PRIMER_PICK_INTERNAL_OLIGO) {
        order("PRIMER_INTERNAL_MIN_SIZE", "PRIMER_INTERNAL_OPT_SIZE", "PRIMER_INTERNAL_MAX_SIZE");
        order("PRIMER_INTERNAL_MIN_TM", "PRIMER_INTERNAL_OPT_TM", "PRIMER_INTERNAL_MAX_TM");
      }
      if (!/^\s*\d+\s*-\s*\d+(\s+\d+\s*-\s*\d+)*\s*$/.test(String(v.PRIMER_PRODUCT_SIZE_RANGE).replace(/[,;]/g, " "))) {
        out.push("PRIMER_PRODUCT_SIZE_RANGE");
      }
      return out;
    }

    _detectPreset() {
      for (const name of PRESET_ORDER) {
        const p = this.presets[name];
        if (Object.keys(p).every((k) => String(p[k]) === String(this.values[k]))) return name;
      }
      return "custom";
    }

    _changed(detect) {
      if (detect !== false) this.preset = this._detectPreset();
      this.host.querySelectorAll(".preset").forEach((b) => b.classList.toggle("on", b.dataset.preset === this.preset));
      const note = this.host.querySelector(".custom-note");
      if (note) note.textContent = this.preset === "custom" ? PM.t("preset.custom") : "";
      const bad = new Set(this.problems());
      this.host.querySelectorAll("[data-tags]").forEach((f) => {
        f.classList.toggle("bad", f.dataset.tags.split(",").some((t) => bad.has(t)));
      });
      this.host.querySelectorAll(".chip[data-range]").forEach((c) => {
        c.classList.toggle("on", c.dataset.range === String(this.values.PRIMER_PRODUCT_SIZE_RANGE).trim());
      });
      const probeOn = !!+this.values.PRIMER_PICK_INTERNAL_OLIGO;
      this.host.querySelectorAll(".probe-body").forEach((b) => (b.hidden = !probeOn));
      this.onChange({ values: this.values, preset: this.preset, engine: this.engine, valid: bad.size === 0 });
    }

    // -------------------------------------------------------------- rendering
    _help(key) {
      return key ? ` <span class="help" title="${esc(PM.t(key))}">?</span>` : "";
    }

    _numInput(tag, extraCls) {
      const p = this.spec[tag] || {};
      return `<input class="num-in ${extraCls || ""}" type="number" data-tag="${tag}" value="${esc(this.values[tag])}"` +
        ` min="${p.min ?? ""}" max="${p.max ?? ""}" step="${p.step ?? "any"}" aria-label="${tag}">`;
    }

    _item(it) {
      const label = PM.t(it.label);
      switch (it.type) {
        case "sub":
          return `<div class="sub-h">${esc(label)}${this._help(it.help)}</div>`;
        case "range": {
          const chips = RANGE_CHIPS.map((r) => `<button type="button" class="chip" data-range="${r}">${r}</button>`).join("");
          return `<div class="field wide" data-tags="${it.tag}"><label for="f-${it.tag}">${esc(label)}${this._help(it.help)}</label>
            <input id="f-${it.tag}" class="txt-in" style="width:100%" type="text" data-tag="${it.tag}" value="${esc(this.values[it.tag])}" spellcheck="false">
            <div class="chips">${chips}</div></div>`;
        }
        case "stepper":
          return `<div class="field" data-tags="${it.tag}"><span class="flabel">${esc(label)}${this._help(it.help)}</span>
            <span class="stepper"><button type="button" data-step="-1" data-for="${it.tag}" aria-label="-">−</button>${this._numInput(it.tag)}<button type="button" data-step="1" data-for="${it.tag}" aria-label="+">+</button></span></div>`;
        case "num":
          return `<div class="field" data-tags="${it.tag}"><span class="flabel">${esc(label)}${this._help(it.help)}</span>${this._numInput(it.tag)}</div>`;
        case "triple":
        case "pair": {
          const names = it.type === "triple" ? ["f.min", "f.opt", "f.max"] : ["f.min", "f.max"];
          const cells = it.tags.map((t, i) => `<label class="cell ${names[i] === "f.opt" ? "opt" : ""}"><span>${PM.t(names[i])}</span>${this._numInput(t)}</label>`).join("");
          return `<div class="field wide" data-tags="${it.tags.join(",")}"><span class="flabel">${esc(label)}${this._help(it.help)}</span>
            <div class="triple ${it.type === "pair" ? "two" : ""}">${cells}</div></div>`;
        }
        case "switch":
          return `<div class="field" data-tags="${it.tag}"><span class="flabel">${esc(label)}${this._help(it.help)}</span>
            <label class="switch"><input type="checkbox" data-tag="${it.tag}" ${+this.values[it.tag] ? "checked" : ""}><i></i></label></div>`;
        case "engine": {
          const avail = this.info.engine.available;
          const opts = ["auto"].concat(avail).map((e) => `<option value="${e}" ${e === this.engine ? "selected" : ""}>${e === "auto" ? "auto" : e}</option>`).join("");
          return `<div class="field"><span class="flabel">${esc(label)}</span><select class="select-in" data-engine>${opts}</select></div>`;
        }
      }
      return "";
    }

    render() {
      const presets = PRESET_ORDER.map((name) => `<button type="button" class="preset ${name === this.preset ? "on" : ""}" data-preset="${name}">
        <b>${esc(PM.t("preset." + name))}</b><small>${esc(PM.t("preset." + name + ".d"))}</small></button>`).join("");
      let html = `<div class="presets">${presets}</div><div class="custom-note"></div>`;
      for (const g of LAYOUT) {
        const items = g.items.map((it) => this._item(it)).join("");
        if (g.collapsible) {
          html += `<details class="fgroup" ${this.advancedOpen ? "open" : ""}><summary>${esc(PM.t("g." + g.group))}</summary>${items}</details>`;
        } else if (g.toggle) {
          html += `<section class="fgroup"><h3>${esc(PM.t("g." + g.group))}
            <label class="switch toggle-head" title="${esc(PM.t("f.probe"))}"><input type="checkbox" data-tag="${g.toggle}" ${+this.values[g.toggle] ? "checked" : ""}><i></i></label></h3>
            <div class="probe-body" ${+this.values[g.toggle] ? "" : "hidden"}>${items}</div></section>`;
        } else {
          html += `<section class="fgroup"><h3>${esc(PM.t("g." + g.group))}</h3>${items}</section>`;
        }
      }
      this.host.innerHTML = html;
      this._wire();
      this._changed(false);
    }

    _wire() {
      const h = this.host;
      h.querySelectorAll(".preset").forEach((b) => b.addEventListener("click", () => {
        this.applyPreset(b.dataset.preset);
        PM.app && PM.app.onPreset(b.dataset.preset);
      }));
      h.querySelectorAll("input[data-tag]").forEach((inp) => {
        const evt = inp.type === "checkbox" ? "change" : "input";
        inp.addEventListener(evt, () => {
          const tag = inp.dataset.tag;
          if (inp.type === "checkbox") this.values[tag] = inp.checked ? 1 : 0;
          else if (inp.type === "number") this.values[tag] = inp.value === "" ? "" : Number(inp.value);
          else this.values[tag] = inp.value;
          this._changed();
        });
      });
      h.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
        const tag = b.dataset.for;
        const p = this.spec[tag] || {};
        let v = Number(this.values[tag] || 0) + Number(b.dataset.step) * (p.step || 1);
        if (p.min !== undefined) v = Math.max(p.min, v);
        if (p.max !== undefined) v = Math.min(p.max, v);
        this.values[tag] = v;
        const inp = h.querySelector(`input[data-tag="${tag}"]`);
        if (inp) inp.value = v;
        this._changed();
      }));
      h.querySelectorAll(".chip[data-range]").forEach((c) => c.addEventListener("click", () => {
        this.values.PRIMER_PRODUCT_SIZE_RANGE = c.dataset.range;
        const inp = h.querySelector('input[data-tag="PRIMER_PRODUCT_SIZE_RANGE"]');
        if (inp) inp.value = c.dataset.range;
        this._changed();
      }));
      const eng = h.querySelector("[data-engine]");
      if (eng) eng.addEventListener("change", () => { this.engine = eng.value; this._changed(false); });
      const det = h.querySelector("details.fgroup");
      if (det) det.addEventListener("toggle", () => { this.advancedOpen = det.open; });
    }
  }

  PM.Settings = Settings;
})();
