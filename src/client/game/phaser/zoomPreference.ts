type MapView = "farm" | "market" | "neighbourhood";
const key = (view: MapView) => `sumer:map-zoom:${view}`;

export const savedMapZoom = (view: MapView, fit: number, fallback: number): number => {
  let zoom = fallback;
  try {
    const saved = window.localStorage.getItem(key(view));
    if (saved === "fit") zoom = fit;
    else if (saved !== null && Number.isFinite(Number(saved)) && Number(saved) > 0) zoom = Number(saved);
  } catch { /* Browser storage is optional. */ }
  return Math.max(fit, Math.min(Math.max(2, fit), zoom));
};

export const saveMapZoom = (view: MapView, zoom: number | "fit") => {
  if (zoom !== "fit" && (!Number.isFinite(zoom) || zoom <= 0)) return;
  try { window.localStorage.setItem(key(view), String(zoom)); } catch { /* Browser storage is optional. */ }
};
