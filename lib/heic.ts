// HEIC/HEIF is what iPhones (and some Android phones) shoot. Safari decodes it
// natively, Chrome and Firefox don't, and on Windows these files often arrive
// with an empty MIME type, so the extension counts too.
export function isHeic(file: File) {
  return /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/") || isHeic(file);
}

// libheif compiled to WASM (~3MB), imported only once a browser has failed to
// show a HEIC photo itself, so most visitors never download it.
export async function heicToJpeg(file: Blob): Promise<Blob> {
  const { heicTo } = await import("heic-to");
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.95 });
}
