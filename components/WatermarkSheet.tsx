"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import {
  DEFAULT_WATERMARK,
  MAX_WATERMARK_TEXT,
  type Watermark,
  drawWatermark,
  saveWatermark,
  useWatermark,
} from "@/lib/watermark";

const LAYOUTS: { value: Watermark["layout"]; label: string }[] = [
  { value: "tiled", label: "Tiled" },
  { value: "corner", label: "Corner" },
];

// Draws the current photo (or a stand-in before one is picked) with the
// watermark on top, so it can be set up with or without a photo open.
function WatermarkPreview({
  photoUrl,
  watermark,
}: {
  photoUrl: string | null;
  watermark: Watermark;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{
    url: string;
    img: HTMLImageElement | null;
  } | null>(null);

  // Decode the photo once per photo, not on every keystroke.
  useEffect(() => {
    if (!photoUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => !cancelled && setLoaded({ url: photoUrl, img });
    img.onerror = () => !cancelled && setLoaded({ url: photoUrl, img: null });
    img.src = photoUrl;
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  const ready = !photoUrl || loaded?.url === photoUrl;
  const img = photoUrl && loaded?.url === photoUrl ? loaded.img : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !ready) return;

    function draw() {
      if (!canvas!.clientWidth) return;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(canvas!.clientWidth * dpr);
      const height = Math.round(canvas!.clientHeight * dpr);
      canvas!.width = width;
      canvas!.height = height;
      // Fit a 3:4 slab-shaped area (or the photo) inside the canvas.
      const aspect = img ? img.naturalWidth / img.naturalHeight : 3 / 4;
      const w = Math.min(width, height * aspect);
      const h = w / aspect;
      const x = (width - w) / 2;
      const y = (height - h) / 2;
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.beginPath();
      ctx!.rect(0, 0, w, h);
      ctx!.clip();
      if (img) {
        ctx!.drawImage(img, 0, 0, w, h);
      } else {
        const gradient = ctx!.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, "#d4d4d8");
        gradient.addColorStop(1, "#71717a");
        ctx!.fillStyle = gradient;
        ctx!.fillRect(0, 0, w, h);
      }
      drawWatermark(ctx!, w, h, watermark);
      ctx!.restore();
    }

    draw();
    // The sheet is still closed (zero-sized) when this first runs, so draw
    // again once the canvas has a size.
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [ready, img, watermark]);

  return <canvas ref={canvasRef} aria-hidden className="h-48 w-full" />;
}

// Watermark settings, kept out of the editor itself: most people set this
// once. A bottom sheet on phones, a centered dialog on larger screens.
// Changes save as they're made.
export function WatermarkSheet({
  open,
  onClose,
  photoUrl,
}: {
  open: boolean;
  onClose: () => void;
  photoUrl: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const watermark = useWatermark();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function update(changes: Partial<Watermark>) {
    saveWatermark({ ...watermark, ...changes });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // A tap on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="watermark-title"
      className="mx-0 mt-auto mb-0 max-h-[90dvh] w-full max-w-none rounded-t-2xl bg-background p-0 text-foreground backdrop:bg-black/60 sm:m-auto sm:max-w-md sm:rounded-2xl"
    >
      <div className="flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-left">
        <div>
          <h2 id="watermark-title" className="text-lg font-semibold">
            Watermark
          </h2>
          <p className="text-sm text-foreground/60">
            Saved on this device and added to every photo you save. You can
            switch it off for a single photo in the editor.
          </p>
        </div>

        <WatermarkPreview photoUrl={photoUrl} watermark={watermark} />

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Text</span>
          <input
            type="text"
            value={watermark.text}
            onChange={(e) => update({ text: e.target.value })}
            maxLength={MAX_WATERMARK_TEXT}
            placeholder="@yourshop"
            autoComplete="off"
            enterKeyHint="done"
            className="h-11 rounded-lg border border-foreground/20 bg-transparent px-3 text-base outline-sky-500 focus-visible:outline-2"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-sm font-medium">
            Opacity
            <span className="text-foreground/60">
              {Math.round(watermark.opacity * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(watermark.opacity * 100)}
            onChange={(e) => update({ opacity: Number(e.target.value) / 100 })}
            className="h-11 w-full cursor-pointer accent-foreground"
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Layout</legend>
          <div className="grid grid-cols-2 gap-2">
            {LAYOUTS.map(({ value, label }) => (
              <label
                key={value}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-foreground/20 text-base has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-sky-500 pointer-fine:h-9 pointer-fine:text-sm"
              >
                <input
                  type="radio"
                  name="watermark-layout"
                  value={value}
                  checked={watermark.layout === value}
                  onChange={() => update({ layout: value })}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => saveWatermark(DEFAULT_WATERMARK)}
            disabled={!watermark.text}
          >
            Remove
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </dialog>
  );
}
