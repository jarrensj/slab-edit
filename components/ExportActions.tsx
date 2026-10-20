"use client";

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
  const shareSheet = useSyncExternalStore(
    subscribeToPointer,
    prefersShareSheet,
    () => false,
  );
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
        try {
          await navigator.share({ files: [file] });
        } catch (err) {
          if (!(err instanceof DOMException)) throw err;
          // AbortError: the sheet was closed without picking anything.
          if (err.name === "NotAllowedError") {
            setError("The photo is ready now. Tap again to share it.");
          } else if (err.name !== "AbortError") {
            throw err;
          }
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
        variant="primary"
        onClick={onSave}
        disabled={saving}
        className={canCopy ? "" : "col-span-2"}
      >
        {saving
          ? "Saving…"
          : saved
            ? "✓ Saved"
            : shareSheet
              ? "Save / Share"
              : "Download"}
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
