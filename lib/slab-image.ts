import { type Watermark, drawWatermark } from "@/lib/watermark";

// A black box as fractions of the photo's width/height, so it is independent
// of how large the preview renders and maps straight onto the full-size
// export.
export type Box = { id: number; x: number; y: number; w: number; h: number };

export const MIN_BOX_FRACTION = 0.02;

// iOS Safari won't allocate a canvas above ~16.7M pixels, and recent iPhones
// shoot 24MP, so the export is scaled down just enough to fit.
const MAX_CANVAS_PIXELS = 16_777_216;
const JPEG_QUALITY = 0.92;

let nextBoxId = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Slab labels sit across the top of the slab, so new boxes start up there —
// each one a little lower than the last so they don't stack. Ids come from a
// counter rather than crypto.randomUUID(), which doesn't exist on plain-http
// origins like a phone hitting the dev server over the LAN.
export function newBox(index: number): Box {
  const w = 0.4;
  const h = 0.08;
  return {
    id: nextBoxId++,
    x: (1 - w) / 2,
    y: Math.min(0.1 + index * 0.1, 1 - h),
    w,
    h,
  };
}

export function moveBox(box: Box, dx: number, dy: number): Box {
  return {
    ...box,
    x: clamp(box.x + dx, 0, 1 - box.w),
    y: clamp(box.y + dy, 0, 1 - box.h),
  };
}

export function resizeBox(box: Box, dw: number, dh: number): Box {
  return {
    ...box,
    w: clamp(box.w + dw, MIN_BOX_FRACTION, 1 - box.x),
    h: clamp(box.h + dh, MIN_BOX_FRACTION, 1 - box.y),
  };
}

// JPEG photos stay JPEG: a PNG of a 12MP phone photo is several times larger
// and can blow past upload limits. Anything else may have transparency, so it
// becomes PNG.
export function exportType(sourceType: string) {
  return sourceType === "image/jpeg" ? "image/jpeg" : "image/png";
}

// Re-encoding through a canvas also drops the photo's EXIF metadata,
// including any GPS location.
export function renderEdited(
  img: HTMLImageElement,
  boxes: Box[],
  type: string,
  watermark: Watermark | null = null,
): Promise<Blob> {
  const scale = Math.min(
    1,
    Math.sqrt(MAX_CANVAS_PIXELS / (img.naturalWidth * img.naturalHeight)),
  );
  const width = Math.floor(img.naturalWidth * scale);
  const height = Math.floor(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Couldn't render image"));

  ctx.drawImage(img, 0, 0, width, height);
  // Under the boxes, so a box always covers what it hides completely.
  if (watermark) drawWatermark(ctx, width, height, watermark);
  ctx.fillStyle = "#000";
  for (const box of boxes) {
    // Round outward so no anti-aliased sliver of the serial survives at the
    // box's edges.
    const x0 = Math.floor(box.x * width);
    const y0 = Math.floor(box.y * height);
    const x1 = Math.ceil((box.x + box.w) * width);
    const y1 = Math.ceil((box.y + box.h) * height);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Free the bitmap right away — iOS caps total canvas memory and
        // collects detached canvases lazily.
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error("Couldn't render image"));
      },
      type,
      JPEG_QUALITY,
    );
  });
}
