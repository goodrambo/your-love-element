(() => {
  const productionHosts = new Set(["yourloveelement.com", "www.yourloveelement.com"]);
  const isLocal = !productionHosts.has(window.location.hostname);

  window.YLE_RUNTIME_MODE = isLocal ? "local-preview" : "production";
  window.YLE_API_BASE_URL = isLocal
    ? ""
    : "https://your-love-element-api.goodrambo2013.workers.dev";

  document.documentElement.dataset.runtimeMode = window.YLE_RUNTIME_MODE;
  document.documentElement.dataset.apiEnabled = String(Boolean(window.YLE_API_BASE_URL));
})();
