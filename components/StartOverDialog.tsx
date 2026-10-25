"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";

// Asks before the editor clears every photo and goes back to the start
// screen. A bottom sheet on phones, in thumb reach, and a small dialog in the
// middle of wider screens.
export function StartOverDialog({
  open,
  onClose,
  onConfirm,
  photoCount,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  photoCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      onClose={onClose}
      // A tap on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="start-over-title"
      aria-describedby="start-over-description"
      className="mx-0 mt-auto mb-0 w-full max-w-none rounded-t-2xl border-t border-white/10 bg-panel p-0 text-foreground backdrop:bg-black/60 max-sm:sheet sm:m-auto sm:w-96 sm:rounded-2xl sm:border"
    >
      <div className="flex flex-col gap-4 px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-5">
        <div
          aria-hidden
          className="mx-auto mb-1 h-1 w-9 rounded-full bg-line-strong sm:hidden"
        />
        <div className="flex flex-col gap-1">
          <h2
            id="start-over-title"
            className="text-[17px]/6 font-medium sm:text-base/5.5"
          >
            Start over?
          </h2>
          <p
            id="start-over-description"
            className="text-[13px]/4.5 text-pretty text-muted"
          >
            {photoCount > 1
              ? `This clears all ${photoCount} photos and their boxes.`
              : "This clears your photo and its boxes."}{" "}
            Your watermark stays saved.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              // Close first, so focus goes back to what opened it before the
              // editor (and this dialog with it) goes away.
              dialogRef.current?.close();
              onConfirm();
            }}
          >
            Start over
          </Button>
        </div>
      </div>
    </dialog>
  );
}
