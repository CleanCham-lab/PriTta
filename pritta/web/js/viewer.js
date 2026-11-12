/* Sequence viewer: numbered lines in blocks of 10, region overlays and drag selection. */
(function () {
  "use strict";
  const PM = (window.PM = window.PM || {});

  const F_T = 1, F_X = 2, F_I = 4, F_L = 8, F_R = 16, F_P = 32, F_S = 64;
  const BASECLS = { A: "ba", C: "bc", G: "bg", T: "bt" };

  class Viewer {
    constructor(el, { onSelect, onHover, onClear } = {}) {
      this.el = el;
      this.onSelect = onSelect || (() => {});
      this.onHover = onHover || (() => {});
      this.onClear = onClear || (() => {});
      this.seq = "";
      this.flags = new Uint8Array(0);
      this.lineLen = 60;
      this.charW = 7.8;
      this.lines = [];
      this.sel = null; // [a, b] inclusive
      this._drag = null;
      this._raf = 0;
      this._bind();
      new ResizeObserver(() => this._relayout()).observe(el);
    }

    setRecord(rec, pair) {
      this.rec = rec;
      this.seq = rec ? rec.sequence : "";
      this.pair = pair || null;
      this._computeFlags();
      this._relayout(true);
    }

    setPair(pair) {
      this.pair = pair || null;
      this._computeFlags();
      this._renderAll();
    }

    setSelection(range) {
      this.sel = range;
      this._computeFlags();
      this._renderAll();
    }

    scrollToPos(pos) {
      const line = Math.floor(pos / this.lineLen);
      const el = this.lines[line];
      if (!el) return;
      const top = el.offsetTop - this.el.clientHeight / 3;
      this.el.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }

    // ------------------------------------------------------------------
    _computeFlags() {
      const n = this.seq.length;
      const f = new Uint8Array(n);
      const mark = (regions, bit) => {
        (regions || []).forEach(([s, l]) => {
          for (let i = Math.max(0, s); i < Math.min(n, s + l); i++) f[i] |= bit;
        });
      };
      if (this.rec) {
        mark(this.rec.included, F_I);
        mark(this.rec.excluded, F_X);
        mark(this.rec.targets, F_T);
      }
      const p = this.pair;
      if (p) {
        if (p.left) mark([[p.left.start, p.left.len]], F_L);
        if (p.right) mark([[p.right.start, p.right.len]], F_R);
        if (p.internal) mark([[p.internal.start, p.internal.len]], F_P);
      }
      if (this.sel) mark([[this.sel[0], this.sel[1] - this.sel[0] + 1]], F_S);
      this.flags = f;
    }

    _measure() {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit";
      probe.textContent = "ACGTACGTAC".repeat(10);
      this.el.appendChild(probe);
      const w = probe.getBoundingClientRect().width / 100;
      probe.remove();
      if (w > 0) this.charW = w;
    }

    _relayout(force) {
      if (!this.seq) {
        this.el.innerHTML = "";
        this.lines = [];
        return;
      }
      this._measure();
      const usable = this.el.clientWidth - 16 - this.charW * 7.6 - 18;
      const per = Math.max(10, Math.floor(usable / (this.charW * 11)) * 10);
      if (!force && per === this.lineLen && this.lines.length) return;
      this.lineLen = per;
      this._renderAll();
    }

    _renderAll() {
      if (!this.seq) return;
      const n = this.seq.length;
      const count = Math.ceil(n / this.lineLen);
      const frag = document.createDocumentFragment();
      this.lines = [];
      for (let li = 0; li < count; li++) {
        const line = document.createElement("div");
        line.className = "vline";
        line.dataset.line = li;
        line.innerHTML = this._lineHTML(li);
        frag.appendChild(line);
        this.lines.push(line);
      }
      const top = this.el.scrollTop;
      this.el.innerHTML = "";
      this.el.appendChild(frag);
      this.el.scrollTop = top;
    }

    _lineHTML(li) {
      const s = li * this.lineLen;
      const e = Math.min(this.seq.length, s + this.lineLen);
      const f = this.flags;
      let html = `<span class="vnum">${s + 1}</span><span class="vseq">`;
      let i = s;
      while (i < e) {
        const blockEnd = Math.min(e, i - ((i - s) % 10) + 10);
        while (i < blockEnd) {
          const b = this.seq[i];
          const sig = f[i];
          let j = i + 1;
          while (j < blockEnd && f[j] === sig && this.seq[j] === b) j++;
          html += `<span class="${cls(b, sig)}">${this.seq.slice(i, j)}</span>`;
          i = j;
        }
        if (i < e) html += " ";
      }
      return html + "</span>";
    }

    // ------------------------------------------------------------------
    _posFromPoint(x, y) {
      const r = this.el.getBoundingClientRect();
      const cx = Math.min(Math.max(x, r.left + 2), r.right - 12);
      const cy = Math.min(Math.max(y, r.top + 2), r.bottom - 2);
      const hit = document.elementFromPoint(cx, cy);
      const line = hit && hit.closest ? hit.closest(".vline") : null;
      if (!line || !this.el.contains(line)) return null;
      const li = +line.dataset.line;
      const seqEl = line.querySelector(".vseq");
      const sr = seqEl.getBoundingClientRect();
      const lineStart = li * this.lineLen;
      const lineEnd = Math.min(this.seq.length, lineStart + this.lineLen) - 1;
      if (x < sr.left) return lineStart;
      const col = Math.floor((x - sr.left) / this.charW);
      const block = Math.floor(col / 11);
      const within = Math.min(col % 11, 9);
      return Math.min(lineEnd, lineStart + block * 10 + within);
    }

    _bind() {
      this.el.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || !this.seq) return;
        const pos = this._posFromPoint(e.clientX, e.clientY);
        if (pos === null) return;
        e.preventDefault();
        this._drag = { a: pos, b: pos, moved: false, x: e.clientX, y: e.clientY };
      });
      document.addEventListener("mousemove", (e) => {
        if (this._drag) {
          const r = this.el.getBoundingClientRect();
          if (e.clientY < r.top + 16) this.el.scrollTop -= 14;
          else if (e.clientY > r.bottom - 16) this.el.scrollTop += 14;
          const pos = this._posFromPoint(e.clientX, e.clientY);
          if (pos !== null && pos !== this._drag.b) {
            this._drag.b = pos;
            this._drag.moved = true;
            this._schedule([Math.min(this._drag.a, pos), Math.max(this._drag.a, pos)]);
          }
          return;
        }
        if (this.el.contains(e.target)) {
          const pos = this._posFromPoint(e.clientX, e.clientY);
          this.onHover(pos);
        }
      });
      this.el.addEventListener("mouseleave", () => this.onHover(null));
      document.addEventListener("mouseup", (e) => {
        if (!this._drag) return;
        const d = this._drag;
        this._drag = null;
        if (!d.moved) {
          if (this.sel) { this.setSelection(null); }
          this.onClear();
          return;
        }
        const range = [Math.min(d.a, d.b), Math.max(d.a, d.b)];
        this.setSelection(range);
        this.onSelect(range, e.clientX, e.clientY);
      });
    }

    _schedule(range) {
      this.sel = range;
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => {
        this._computeFlags();
        this._renderAll();
      });
    }
  }

  function cls(b, sig) {
    let c = BASECLS[b] || "bn";
    if (sig & F_T) c += " rt";
    if (sig & F_X) c += " rx";
    if (sig & F_I) c += " ri";
    if (sig & F_L) c += " pl";
    if (sig & F_R) c += " pr";
    if (sig & F_P) c += " pp";
    if (sig & F_S) c += " sel";
    return c;
  }

  PM.Viewer = Viewer;
})();
