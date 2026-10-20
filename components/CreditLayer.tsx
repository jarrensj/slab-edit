"use client";

import { useEffect, useRef } from "react";
import { creditText, drawCredit } from "@/lib/credit";

// Live preview of the site credit over the photo, drawn with the same
// function as the export so what's on screen is what gets saved.
export function CreditLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function draw() {
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(canvas!.clientWidth * dpr);
      const height = Math.round(canvas!.clientHeight * dpr);
      canvas!.width = width;
      canvas!.height = height;
      drawCredit(ctx, width, height);
    }
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={creditText()}
      className="pointer-events-none absolute inset-0 size-full rounded-lg"
    />
  );
}
