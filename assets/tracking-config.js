window.YLE_META_PIXEL_ID = window.YLE_RUNTIME_MODE === "production"
  ? "4282306195342317"
  : "";

document.documentElement.dataset.metaTracking = window.YLE_META_PIXEL_ID ? "enabled" : "disabled";
