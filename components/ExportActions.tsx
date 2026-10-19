"use client";

import { useState } from "react";
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

export function ExportActions({
  getBlob,
  filename,
}: {
  getBlob: () => Promise<Blob>;
  filename: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    if (downloading) return;
    setError(null);
    setDownloading(true);
    try {
      const blob = await getBlob();
      saveBlob(blob, `${filename}.${EXTENSIONS[blob.type] ?? "png"}`);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save image");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={onDownload}
        disabled={downloading}
        className="col-span-2"
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
