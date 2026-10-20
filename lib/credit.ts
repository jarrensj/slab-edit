// Every export gets a "Made with <site>" band under the photo, where <site>
// is the host of NEXT_PUBLIC_BASE_URL (e.g. slabedit.com).
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

// The band's height as a fraction of the photo's shorter side, so it's in the
// same proportion on any photo size and in the on-screen preview.
export const CREDIT_BAND_FRACTION = 0.05;

// Rounded down, so the export never ends up taller than the canvas size
// limit allowed for.
export function creditBandHeight(width: number, height: number) {
  return Math.floor(Math.min(width, height) * CREDIT_BAND_FRACTION);
}

// Draws the band into a width × bandHeight area starting at row `top`.
export function drawCredit(
  ctx: CanvasRenderingContext2D,
  top: number,
  width: number,
  bandHeight: number,
) {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, top, width, bandHeight);
  ctx.font = `500 ${Math.round(bandHeight * 0.45)}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(creditText(), width / 2, top + bandHeight / 2);
  ctx.restore();
}
