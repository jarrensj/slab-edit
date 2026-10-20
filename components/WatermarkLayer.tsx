"use client";

import { useEffect, useRef } from "react";
import { type Watermark, drawWatermark, loadLogo } from "@/lib/watermark";

// Live preview of the watermark over the photo, drawn with the same function
// as the export so what's on screen is what gets saved.
export function WatermarkLayer({ watermark }: { watermark: Watermark }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let logo: HTMLImageElement | null | undefined;
    function draw() {
      // Wait for the logo, so it doesn't pop in after the text.
      if (cancelled || logo === undefined) return;
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(canvas!.clientWidth * dpr);
      const height = Math.round(canvas!.clientHeight * dpr);
      canvas!.width = width;
      canvas!.height = height;
      ctx.clearRect(0, 0, width, height);
      drawWatermark(ctx, width, height, watermark, logo);
    }
    loadLogo(watermark).then((loaded) => {
      logo = loaded;
      draw();
    });
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [watermark]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full rounded-lg"
    />
  );
}
