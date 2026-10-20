"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import {
  DEFAULT_WATERMARK,
  MAX_WATERMARK_TEXT,
  type Watermark,
  drawWatermark,
  hasWatermark,
  loadLogo,
  logoFromFile,
  saveWatermark,
  useWatermark,
} from "@/lib/watermark";

export const LAYOUTS: { value: Watermark["layout"]; label: string }[] = [
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
    let cancelled = false;
    let logo: HTMLImageElement | null | undefined;

    function draw() {
      if (cancelled || logo === undefined || !canvas!.clientWidth) return;
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
      drawWatermark(ctx!, w, h, watermark, logo);
      ctx!.restore();
    }

    loadLogo(watermark).then((loaded) => {
      logo = loaded;
      draw();
    });
    // The sheet is still closed (zero-sized) when this first runs, so draw
    // again once the canvas has a size.
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [ready, img, watermark]);

  return <canvas ref={canvasRef} aria-hidden className="block size-full" />;
}

// Watermark settings, kept out of the editor itself: most people set this
// once. They take over the editor's side panel on wider screens and open in
// WatermarkSheet otherwise. Changes save as they're made.
export function WatermarkSettings({
  photoUrl,
  onDone,
  inPanel = false,
}: {
  photoUrl: string | null;
  onDone: () => void;
  inPanel?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [addingLogo, setAddingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const watermark = useWatermark();
  const opacity = Math.round(watermark.opacity * 100);

  // In the panel these replace the Edit button that opened them, so focus
  // moves here rather than dropping back to the page.
  useEffect(() => {
    if (inPanel) titleRef.current?.focus();
  }, [inPanel]);

  function update(changes: Partial<Watermark>) {
    saveWatermark({ ...watermark, ...changes });
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    setAddingLogo(true);
    try {
      update({ image: await logoFromFile(file) });
    } catch {
      setLogoError("Couldn't open that image. Try a PNG or JPG.");
    } finally {
      setAddingLogo(false);
    }
  }

  return (
    <>
      <div
        className={
          inPanel
            ? "flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto p-5"
            : "flex flex-col gap-4"
        }
      >
        <div className="flex flex-col gap-1">
          <h2
            ref={titleRef}
            id="watermark-title"
            tabIndex={-1}
            className={`font-medium outline-none ${
              inPanel ? "text-base/5.5" : "text-[17px]/6"
            }`}
          >
            Watermark
          </h2>
          <p className="text-[13px]/4.5 text-pretty text-muted">
            Text, a logo, or both. Saved on this device and added to every
            photo you save; switch it off for a single photo.
          </p>
        </div>

        <div
          className={`rounded-[10px] border border-line bg-field p-2.5 ${
            inPanel ? "h-55" : "h-45"
          }`}
        >
          <WatermarkPreview photoUrl={photoUrl} watermark={watermark} />
        </div>

        <label className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between">
            <span className="section-label">Text</span>
            <span aria-hidden className="font-mono text-xs text-faint">
              {watermark.text.length}/{MAX_WATERMARK_TEXT}
            </span>
          </span>
          <input
            type="text"
            value={watermark.text}
            onChange={(e) => update({ text: e.target.value })}
            maxLength={MAX_WATERMARK_TEXT}
            placeholder="Your shop or handle"
            autoComplete="off"
            enterKeyHint="done"
            className="h-11 rounded-[10px] border border-line-strong bg-field px-3.5 text-base outline-sky-500 placeholder:text-faint focus-visible:outline-2 pointer-fine:h-9 pointer-fine:rounded-lg pointer-fine:px-3 pointer-fine:text-sm"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="section-label">Logo</span>
          <div className="flex items-center gap-2">
            {watermark.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={watermark.image}
                alt="Your logo"
                className="size-11 shrink-0 rounded-lg border border-line-strong bg-field object-contain p-1"
              />
            )}
            <Button
              onClick={() => logoInputRef.current?.click()}
              disabled={addingLogo}
              className="flex-1"
            >
              {addingLogo
                ? "Adding…"
                : watermark.image
                  ? "Replace logo"
                  : "Upload a logo"}
            </Button>
            {watermark.image && (
              <Button onClick={() => update({ image: null })} className="flex-1">
                Remove logo
              </Button>
            )}
          </div>
          {logoError && (
            <p role="alert" className="text-sm text-red-400">
              {logoError}
            </p>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onLogoChange}
          />
        </div>

        <label className="flex flex-col gap-2.5">
          <span className="flex items-baseline justify-between">
            <span className="section-label">Opacity</span>
            <span className="text-[13px] text-muted">{opacity}%</span>
          </span>
          {/* 44px tall on touch screens for thumbs, with the extra height
              pulled back out of the layout. */}
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={opacity}
            onChange={(e) => update({ opacity: Number(e.target.value) / 100 })}
            style={{ "--value": (opacity - 10) / 90 } as React.CSSProperties}
            className="slider -my-2.5 h-11 w-full outline-offset-2 outline-sky-500 focus-visible:outline-2 pointer-fine:my-0 pointer-fine:h-4"
          />
        </label>

        <fieldset>
          <legend className="section-label mb-2">Layout</legend>
          <div className="grid grid-cols-2 gap-0.75 rounded-[11px] border border-line bg-field p-0.75 pointer-fine:rounded-[9px]">
            {LAYOUTS.map(({ value, label }) => (
              <label
                key={value}
                className="flex h-9.5 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-muted transition-colors has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-sky-500 pointer-fine:h-7.5 pointer-fine:rounded-md pointer-fine:text-[13px]"
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
      </div>

      <div
        className={`grid grid-cols-2 gap-2 ${
          inPanel ? "border-t border-line px-5 pt-4 pb-5" : "mt-1"
        }`}
      >
        <Button
          onClick={() => saveWatermark(DEFAULT_WATERMARK)}
          disabled={!hasWatermark(watermark)}
        >
          Remove
        </Button>
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  );
}

// The settings as a bottom sheet on phones, or a centered dialog on larger
// screens when there's no side panel to put them in.
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // A tap on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="watermark-title"
      className="mx-0 mt-auto mb-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-white/10 bg-panel p-0 text-foreground backdrop:bg-black/60 sm:m-auto sm:max-w-md sm:rounded-2xl sm:border sm:border-line"
    >
      <div className="flex flex-col gap-4 px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pt-5">
        <div
          aria-hidden
          className="mx-auto mb-1 h-1 w-9 rounded-full bg-line-strong sm:hidden"
        />
        <WatermarkSettings photoUrl={photoUrl} onDone={onClose} />
      </div>
    </dialog>
  );
}
