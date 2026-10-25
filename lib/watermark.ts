import { useSyncExternalStore } from "react";

export type Watermark = {
  text: string;
  // A small PNG data URL, so it can live in storage with the rest.
  image: string | null;
  opacity: number;
  // "tiled" is the diagonal pattern; it keeps that name so watermarks saved
  // before there were other patterns still load.
  layout: "tiled" | "staggered" | "corner";
};

export const MAX_WATERMARK_TEXT = 40;
export const DEFAULT_WATERMARK: Watermark = {
  text: "",
  image: null,
  opacity: 0.4,
  layout: "tiled",
};

// TODO: once there's a Privacy Policy page, mention that the watermark
// settings are kept in this browser's localStorage (never sent anywhere).
const STORAGE_KEY = "slab-edit.watermark";
const CHANGE_EVENT = "slab-edit:watermark";
// Big enough to stay sharp on a full-size export, small enough for storage.
const MAX_LOGO_SIZE = 512;

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
      image:
        typeof value.image === "string" && value.image.startsWith("data:image/")
          ? value.image
          : null,
      opacity:
        typeof value.opacity === "number"
          ? Math.min(Math.max(value.opacity, 0.1), 1)
          : DEFAULT_WATERMARK.opacity,
      layout: ["staggered", "corner"].includes(value.layout)
        ? value.layout
        : "tiled",
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
  return watermark.text.trim().length > 0 || !!watermark.image;
}

// Shrinks an uploaded logo to fit MAX_LOGO_SIZE and re-encodes it as PNG,
// which keeps any transparency.
export async function logoFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(
      1,
      MAX_LOGO_SIZE / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const logos = new Map<string, Promise<HTMLImageElement | null>>();

// Decoded once per logo and reused for every draw.
export function loadLogo(
  watermark: Watermark,
): Promise<HTMLImageElement | null> {
  const src = watermark.image;
  if (!src) return Promise.resolve(null);
  let logo = logos.get(src);
  if (!logo) {
    const img = new Image();
    img.src = src;
    logo = img.decode().then(
      () => img,
      () => null,
    );
    logos.set(src, logo);
  }
  return logo;
}

// Draws into a width × height area at the context's origin. Sizes are
// relative to the area, so the on-screen preview and the full-size export
// look the same. The logo (from loadLogo) and the text form one stamp:
// [logo] text. Text is white with a dark outline so it reads on both white
// slab shells and dark backgrounds.
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  watermark: Watermark,
  logo: HTMLImageElement | null,
) {
  const text = watermark.text.trim();
  if (!text && !logo) return;
  const size = Math.max(10, Math.round(Math.min(width, height) * 0.06));
  ctx.save();
  ctx.globalAlpha = watermark.opacity;
  ctx.font = `600 ${size}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.lineJoin = "round";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // A logo on its own gets a bit more room than one next to text. Very wide
  // logos are capped so a corner mark doesn't take over the photo.
  let logoHeight = logo ? size * (text ? 1.6 : 2.4) : 0;
  let logoWidth = logo
    ? (logo.naturalWidth / logo.naturalHeight) * logoHeight
    : 0;
  if (logoWidth > size * 5) {
    logoHeight *= (size * 5) / logoWidth;
    logoWidth = size * 5;
  }
  const gap = logo && text ? size * 0.4 : 0;
  const textWidth = text ? ctx.measureText(text).width : 0;
  const stampWidth = logoWidth + gap + textWidth;
  const stampHeight = Math.max(logoHeight, size * 1.2);

  // (x, y) is the stamp's center.
  const stamp = (x: number, y: number) => {
    const left = x - stampWidth / 2;
    if (logo) {
      ctx.drawImage(logo, left, y - logoHeight / 2, logoWidth, logoHeight);
    }
    if (text) {
      ctx.strokeText(text, left + logoWidth + gap, y);
      ctx.fillText(text, left + logoWidth + gap, y);
    }
  };

  if (watermark.layout === "corner") {
    const pad = size * 0.7;
    stamp(width - pad - stampWidth / 2, height - pad - stampHeight / 2);
  } else if (watermark.layout === "staggered") {
    // A few level stamps in rows, with every other row shifted into the gaps
    // of the rows around it: rows about five text heights apart, stamps
    // about eleven apart across. A long stamp is shrunk to fit its place (to
    // 60% at most, then a row holds one fewer), so none is cut off at the
    // edges. Worked out from the photo's shape and the stamp's proportions
    // rather than pixels (size is rounded), so the small preview and the
    // full-size export get the same pattern.
    const across = width / (Math.min(width, height) * 0.06);
    const down = height / (Math.min(width, height) * 0.06);
    const rows = Math.min(6, Math.max(2, Math.round(down / 5)));
    const fit = (perRow: number) =>
      Math.min(1, (across / perRow - 1) / (stampWidth / size));
    let perRow = Math.max(1, Math.round(across / 11));
    while (perRow > 1 && fit(perRow) < 0.6) perRow--;
    const scale = fit(perRow);
    const stepX = width / perRow;
    for (let row = 0; row < rows; row++) {
      const y = ((row + 0.5) * height) / rows;
      const shifted = row % 2 === 1 && perRow > 1;
      for (let i = 0; i < (shifted ? perRow - 1 : perRow); i++) {
        ctx.save();
        ctx.translate((i + (shifted ? 1 : 0.5)) * stepX, y);
        ctx.scale(scale, scale);
        stamp(0, 0);
        ctx.restore();
      }
    }
  } else {
    // Repeated diagonally across the whole photo so it can't be cropped out.
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6);
    const reach = Math.hypot(width, height) / 2;
    const stepX = stampWidth + size * 2.5;
    const stepY = stampHeight + size * 2.3;
    for (let row = 0, y = -reach; y <= reach; row++, y += stepY) {
      const offset = row % 2 ? stepX / 2 : 0;
      for (let x = -reach - offset; x <= reach + stepX; x += stepX) {
        stamp(x, y);
      }
    }
  }
  ctx.restore();
}
