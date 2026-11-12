/* One call API for both runtimes: pywebview (desktop) and the local HTTP bridge (--browser). */
(function () {
  "use strict";
  const PM = (window.PM = window.PM || {});
  const token = new URLSearchParams(location.search).get("t") || "";

  function waitForPywebview(timeoutMs) {
    return new Promise((resolve) => {
      if (window.pywebview && window.pywebview.api) return resolve(true);
      if (location.protocol === "http:" && token) return resolve(false); // browser bridge
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      window.addEventListener("pywebviewready", () => finish(true));
      setTimeout(() => finish(!!(window.pywebview && window.pywebview.api)), timeoutMs);
    });
  }

  let desktop = null;

  PM.api = async function (method, ...args) {
    if (desktop === null) desktop = await waitForPywebview(4000);
    if (desktop) {
      return window.pywebview.api[method](...args);
    }
    const res = await fetch(`/api/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PriTta-Token": token },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    return data.result;
  };

  PM.isDesktop = () => desktop === true;
})();
