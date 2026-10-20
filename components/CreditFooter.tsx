"use client";

import { useEffect, useRef } from "react";
import { CREDIT_TEXT, creditBandHeight, drawCredit } from "@/lib/credit";

// Preview of the credit band under the photo, drawn with the same function as
// the export. Its aspect ratio comes from the photo's own size, so it's in
// the same proportion to the photo as in the saved file.
export function CreditFooter({
  photoWidth,
  photoHeight,
}: {
  photoWidth: number;
  photoHeight: number;
}) {
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
      drawCredit(ctx, 0, width, height);
    }
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={CREDIT_TEXT}
      // w-0 + min-w-full: exactly as wide as the photo, without the canvas's
      // default 300px width widening the column for narrow photos.
      className="block w-0 min-w-full rounded-b-lg"
      style={{
        aspectRatio: `${photoWidth} / ${creditBandHeight(photoWidth, photoHeight)}`,
      }}
    />
  );
}
