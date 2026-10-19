import { useSyncExternalStore } from "react";

export type Watermark = {
  text: string;
  opacity: number;
  layout: "tiled" | "corner";
};

export const MAX_WATERMARK_TEXT = 40;
export const DEFAULT_WATERMARK: Watermark = {
  text: "",
  opacity: 0.4,
  layout: "tiled",
};

// TODO: once there's a Privacy Policy page, mention that the watermark
// settings are kept in this browser's localStorage (never sent anywhere).
const STORAGE_KEY = "slab-edit.watermark";
const CHANGE_EVENT = "slab-edit:watermark";

// The watermark is set once and reused for every photo, so it lives in this
// browser's storage. It never leaves the device.
let memoryRaw: string | null = null;
let cachedRaw: string | null | undefined;
let cachedValue = DEFAULT_WATERMARK;

function parse(raw: string | null): Watermark {
  if (!raw) return DEFAULT_WATERMARK;
  try {
    const value = JSON.parse(raw);
    return {
      text:
        typeof value.text === "string"
          ? value.text.slice(0, MAX_WATERMARK_TEXT)
          : "",
      opacity:
        typeof value.opacity === "number"
          ? Math.min(Math.max(value.opacity, 0.1), 1)
          : DEFAULT_WATERMARK.opacity,
      layout: value.layout === "corner" ? "corner" : "tiled",
    };
  } catch {
    return DEFAULT_WATERMARK;
  }
}

// Returns the same object until the stored value changes, as
// useSyncExternalStore requires.
function read(): Watermark {
  let raw = memoryRaw;
  try {
    raw = localStorage.getItem(STORAGE_KEY) ?? memoryRaw;
  } catch {}
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useWatermark() {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_WATERMARK);
}

export function saveWatermark(next: Watermark) {
  // Kept in memory too, so it still works for this visit when storage is
  // blocked (some private-browsing modes).
  memoryRaw = JSON.stringify(next);
  try {
    localStorage.setItem(STORAGE_KEY, memoryRaw);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function hasWatermark(watermark: Watermark) {
  return watermark.text.trim().length > 0;
}

// Draws into a width × height area at the context's origin. Sizes are
// relative to the area, so the on-screen preview and the full-size export
// look the same. White text with a dark outline reads on both white slab
// shells and dark backgrounds.
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  watermark: Watermark,
) {
  const text = watermark.text.trim();
  if (!text) return;
  const size = Math.max(10, Math.round(Math.min(width, height) * 0.06));
  ctx.save();
  ctx.globalAlpha = watermark.opacity;
  ctx.font = `600 ${size}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.lineJoin = "round";

  const stamp = (x: number, y: number) => {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };

  if (watermark.layout === "corner") {
    const pad = size * 0.7;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    stamp(width - pad, height - pad);
  } else {
    // Repeated diagonally across the whole photo so it can't be cropped out.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6);
    const reach = Math.hypot(width, height) / 2;
    const stepX = ctx.measureText(text).width + size * 2.5;
    const stepY = size * 3.5;
    for (let row = 0, y = -reach; y <= reach; row++, y += stepY) {
      const offset = row % 2 ? stepX / 2 : 0;
      for (let x = -reach - offset; x <= reach + stepX; x += stepX) {
        stamp(x, y);
      }
    }
  }
  ctx.restore();
}
