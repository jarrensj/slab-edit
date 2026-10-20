// Every export gets a small "Made with <site>" credit at the bottom center of
// the photo, where <site> is the host of NEXT_PUBLIC_BASE_URL (e.g.
// slabedit.com). It's drawn on the photo, so the export keeps its size.
// TODO: let people pay to remove the credit. Taking payments will also need
// Terms of Service and Privacy Policy updates.
function siteHost() {
  // Referenced literally so Next inlines it at build time.
  const value = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (value) {
    try {
      // Accepts "https://slabedit.com" or a bare "slabedit.com".
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      return url.host.replace(/^www\./, "");
    } catch {
      // Not a URL; fall back to the page's own host.
    }
  }
  return window.location.host;
}

export function creditText() {
  return `Made with ${siteHost()}`;
}

// Draws into a width × height area at the context's origin. Sizes are
// relative to the area, like the watermark, so the on-screen preview and the
// full-size export look the same. The text stays within the bottom 3.9% of
// the shorter side, below where a corner watermark ends (its padding is 4.2%),
// so the two never overlap.
export function drawCredit(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const size = Math.max(1, Math.round(Math.min(width, height) * 0.026));
  const text = creditText();
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.font = `600 ${size}px ${getComputedStyle(document.body).fontFamily}`;
  // The watermark's look: white with a dark outline, so it reads on white
  // slab shells and dark backgrounds alike.
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.lineJoin = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(text, width / 2, height - size);
  ctx.fillText(text, width / 2, height - size);
  ctx.restore();
}
