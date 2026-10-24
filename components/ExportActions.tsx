"use client";

import { downloadZip } from "client-zip";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};
const COARSE_POINTER = "(pointer: coarse)";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari can still be reading the blob after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function subscribeToPointer(onChange: () => void) {
  const query = matchMedia(COARSE_POINTER);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function noSubscription() {
  return () => {};
}

// Phones and tablets get the native share sheet (Save Image, Messages, …)
// instead of a download that lands in the Files app.
function prefersShareSheet() {
  return (
    matchMedia(COARSE_POINTER).matches && typeof navigator.share === "function"
  );
}

// False when the browser won't open the sheet: the tap that asked for it no
// longer counts, or it won't take these files. Closing the sheet without
// picking anything (AbortError) counts as done.
async function openShareSheet(files: File[]) {
  try {
    await navigator.share({ files });
    return true;
  } catch (err) {
    if (!(err instanceof DOMException)) throw err;
    if (err.name === "NotAllowedError") return false;
    if (err.name !== "AbortError") throw err;
    return true;
  }
}

// Image clipboard writes need ClipboardItem and a secure context (not a
// plain-http LAN address); without them there's no Copy button at all.
function canCopyImages() {
  return (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  );
}

function flash(set: (value: boolean) => void) {
  set(true);
  setTimeout(() => set(false), 1800);
}

type ExportItem = { filename: string; getBlob: () => Promise<Blob> };

// Copy and Download act on the photo on screen. With several photos,
// "Download all" becomes the main action: the single Download steps back,
// and phones, short on room in the dock, keep just Copy and Download all.
export function ExportActions({
  getBlob,
  filename,
  allItems = [],
}: {
  getBlob: (type?: string) => Promise<Blob>;
  filename: string;
  allItems?: ExportItem[];
}) {
  const shareSheet = useSyncExternalStore(
    subscribeToPointer,
    prefersShareSheet,
    () => false,
  );
  const multiple = allItems.length > 1;
  const canCopy = useSyncExternalStore(noSubscription, canCopyImages, () => false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onCopy() {
    if (copying) return;
    setError(null);
    setCopying(true);
    // The PNG goes in as a promise so the write starts inside the tap: Safari
    // rejects clipboard writes that begin after an await. Clipboards only
    // take PNG, whatever the export format.
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": getBlob("image/png") })])
      .then(() => flash(setCopied))
      .catch(() => setError("Couldn't copy the image. Try saving it instead."))
      .finally(() => setCopying(false));
  }

  async function onSave() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      // Usually already rendered ahead, so this resolves right away and the
      // share sheet opens while the tap still counts.
      const blob = await getBlob();
      const name = `${filename}.${EXTENSIONS[blob.type] ?? "png"}`;
      const file = new File([blob], name, { type: blob.type });
      if (shareSheet && navigator.canShare?.({ files: [file] })) {
        if (!(await openShareSheet([file]))) {
          setError("The photo is ready now. Tap again to share it.");
        }
        return;
      }
      saveBlob(blob, name);
      flash(setSaved);
    } catch {
      setError("Couldn't save the image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {canCopy && (
        <Button onClick={onCopy} disabled={copying}>
          {copying ? "Copying…" : copied ? "✓ Copied" : "Copy"}
        </Button>
      )}
      <Button
        variant={multiple ? "secondary" : "accent"}
        onClick={onSave}
        disabled={saving}
        className={multiple ? "max-sm:hidden" : canCopy ? "" : "col-span-2"}
      >
        {saving
          ? "Saving…"
          : saved
            ? "✓ Saved"
            : shareSheet
              ? "Save / Share"
              : "Download"}
      </Button>
      {multiple && (
        <DownloadAllButton
          items={allItems}
          shareSheet={shareSheet}
          className={canCopy ? "sm:col-span-2" : "col-span-2"}
        />
      )}
      {error && (
        <p
          role="alert"
          className="col-span-2 basis-full text-sm text-red-400"
        >
          {error}
        </p>
      )}
    </>
  );
}

const ZIP_NAME = "slabs-edited.zip";

// Photos pasted from the clipboard are all called image.png, so a repeated
// name gets a number, as the browser does for its own downloads. Desktop file
// systems ignore case, so this does too.
function uniqueName(name: string, taken: Set<string>) {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
    candidate = `${stem}-${n}${ext}`;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

// Renders the photos one after another (each full-size render needs its own
// canvas, and phones cap how much canvas memory a page can hold at once).
// Phones then hand them all to the share sheet, where iOS offers "Save N
// Images"; elsewhere they're saved as one .zip. Separate downloads don't work:
// a page gets one download per click, and Chrome holds back the rest behind a
// "Download multiple files" prompt that's easy to miss.
function DownloadAllButton({
  items,
  shareSheet,
  className = "",
}: {
  items: ExportItem[];
  shareSheet: boolean;
  className?: string;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Files rendered for the share sheet after the tap that asked for them
  // stopped counting, waiting for the next tap. They're only good for the
  // items they came from: a new photo, a box change, or a watermark change
  // drops them.
  const [prepared, setPrepared] = useState<{
    items: ExportItem[];
    files: File[];
  } | null>(null);
  const ready = prepared?.items === items ? prepared.files : null;

  async function renderAll() {
    const files: File[] = [];
    const taken = new Set<string>();
    for (const [i, item] of items.entries()) {
      setProgress(i + 1);
      const blob = await item.getBlob();
      const name = `${item.filename}.${EXTENSIONS[blob.type] ?? "png"}`;
      files.push(new File([blob], uniqueName(name, taken), { type: blob.type }));
    }
    setProgress(null);
    return files;
  }

  async function saveZip(files: File[]) {
    saveBlob(await downloadZip(files).blob(), ZIP_NAME);
    flash(setDone);
  }

  async function onDownloadAll() {
    if (progress !== null) return;
    setError(null);
    try {
      if (ready) {
        setPrepared(null);
        // Straight from this tap, so the sheet can open. If the browser still
        // refuses, it won't take this many files, so they go in the zip.
        if (!(await openShareSheet(ready))) await saveZip(ready);
        return;
      }
      const files = await renderAll();
      if (shareSheet && navigator.canShare?.({ files })) {
        // iOS only opens the sheet close to the tap, and rendering every
        // photo usually takes longer; then the next tap opens it.
        const tapCounts = navigator.userActivation?.isActive !== false;
        if (!tapCounts || !(await openShareSheet(files))) {
          setPrepared({ items, files });
        }
        return;
      }
      await saveZip(files);
    } catch {
      setError("Couldn't save every photo. Try them one at a time.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <Button
        variant="accent"
        onClick={onDownloadAll}
        disabled={progress !== null}
        className={className}
      >
        {progress !== null
          ? `${shareSheet ? "Preparing" : "Saving"} ${progress} of ${items.length}…`
          : ready
            ? `Tap to save ${items.length}`
            : done
              ? `✓ Saved ${items.length}`
              : `${shareSheet ? "Save" : "Download"} all ${items.length}`}
      </Button>
      {error && (
        <p
          role="alert"
          className="col-span-2 basis-full text-sm text-red-400"
        >
          {error}
        </p>
      )}
    </>
  );
}
