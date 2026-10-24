"use client";

import { downloadZip } from "client-zip";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

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

function noSubscription() {
  return () => {};
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
  const multiple = allItems.length > 1;
  const canCopy = useSyncExternalStore(noSubscription, canCopyImages, () => false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
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
      .catch(() => setError("Couldn't copy the image. Try downloading it instead."))
      .finally(() => setCopying(false));
  }

  async function onDownload() {
    if (downloading) return;
    setError(null);
    setDownloading(true);
    try {
      const blob = await getBlob();
      saveBlob(blob, `${filename}.${EXTENSIONS[blob.type] ?? "png"}`);
      flash(setDownloaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save image");
    } finally {
      setDownloading(false);
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
        onClick={onDownload}
        disabled={downloading}
        className={multiple ? "max-sm:hidden" : canCopy ? "" : "col-span-2"}
      >
        {downloading ? "Saving…" : downloaded ? "✓ Saved" : "Download"}
      </Button>
      {multiple && (
        <DownloadAllButton
          items={allItems}
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
// canvas, and phones cap how much canvas memory a page can hold at once) and
// saves them as one .zip. Separate files don't work: a page gets one download
// per click, and Chrome holds back the rest behind a "Download multiple
// files" prompt that's easy to miss.
// TODO: once the share-sheet PR (#15) lands, phones should hand all the files
// to the share sheet in one go instead of a zip; iOS then offers "Save N
// Images".
function DownloadAllButton({
  items,
  className = "",
}: {
  items: ExportItem[];
  className?: string;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownloadAll() {
    if (progress !== null) return;
    setError(null);
    try {
      const files = [];
      const taken = new Set<string>();
      for (const [i, item] of items.entries()) {
        setProgress(i + 1);
        const blob = await item.getBlob();
        const name = `${item.filename}.${EXTENSIONS[blob.type] ?? "png"}`;
        files.push({ name: uniqueName(name, taken), input: blob });
      }
      saveBlob(await downloadZip(files).blob(), ZIP_NAME);
      flash(setDone);
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
          ? `Saving ${progress} of ${items.length}…`
          : done
            ? `✓ Saved ${items.length}`
            : `Download all ${items.length}`}
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
