"use client";

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

export function ExportActions({
  getBlob,
  filename,
}: {
  getBlob: (type?: string) => Promise<Blob>;
  filename: string;
}) {
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
        variant="primary"
        onClick={onDownload}
        disabled={downloading}
        className={canCopy ? "" : "col-span-2"}
      >
        {downloading ? "Saving…" : downloaded ? "✓ Saved" : "Download"}
      </Button>
      {error && (
        <p
          role="alert"
          className="col-span-2 basis-full text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </>
  );
}
