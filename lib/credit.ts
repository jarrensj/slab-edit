// Every export gets a "Made with slabedit.com" band under the photo.
// TODO: let people pay to remove the credit. Taking payments will also need
// Terms of Service and Privacy Policy updates.
export const CREDIT_TEXT = "Made with slabedit.com";

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
  ctx.fillText(CREDIT_TEXT, width / 2, top + bandHeight / 2);
  ctx.restore();
}
