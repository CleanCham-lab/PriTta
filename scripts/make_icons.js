// Render Helly (the built-in fallback mascot) into helly-icon.png and README art. Dev-only helper.
//   npm i -D playwright   (or use a global install)
//   node scripts/make_icons.js
// Then: python scripts/png_to_ico.py helly-icon
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mascotJs = fs.readFileSync(path.join(root, "pritta/web/js/mascot.js"), "utf8");

const page = (body, bg) => `<!doctype html><html><head><style>
  html,body{margin:0;background:${bg};}
  .hl-eyes-happy,.hl-brows-sad,.hl-tear,.hl-sweat,.hl-sparkles,.hl-mouth{display:none}
  .hl-mouth-smile{display:inline}
  .happy .hl-eyes-open,.happy .hl-mouth-smile{display:none}
  .happy .hl-eyes-happy,.happy .hl-mouth-open,.happy .hl-sparkles{display:inline}
</style></head><body>${body}<script>window.PM={};${mascotJs}</script><script>
  document.querySelectorAll("[data-helly]").forEach(el => {
    el.innerHTML = PM.mascotSVG.replace('viewBox="0 0 160 212"', 'viewBox="' + el.dataset.vb + '"');
    if (el.dataset.mood) el.querySelector("svg").classList.add(el.dataset.mood);
  });
</script></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

  // app icon: head on a rounded indigo tile
  await p.setContent(page(`<div style="width:512px;height:512px;display:grid;place-items:center">
    <div style="width:472px;height:472px;border-radius:104px;background:linear-gradient(160deg,#2f2878,#1a1640);display:grid;place-items:center;overflow:hidden">
      <div data-helly data-vb="20 -4 120 164" style="width:360px;height:492px;margin-top:40px"></div></div></div>`, "transparent"));
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(root, "pritta/web/img/helly-icon.png"), omitBackground: true });

  // README art: full body, happy
  await p.setViewportSize({ width: 320, height: 424 });
  await p.setContent(page(`<div data-helly data-mood="happy" data-vb="0 0 160 212" style="width:320px;height:424px"></div>`, "transparent"));
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(root, "docs/helly.png"), omitBackground: true });
  await browser.close();
})();
