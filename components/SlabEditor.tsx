"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { CreditLayer } from "@/components/CreditLayer";
import { ExportActions } from "@/components/ExportActions";
import { WatermarkLayer } from "@/components/WatermarkLayer";
import { WatermarkSheet } from "@/components/WatermarkSheet";
import {
  type Box,
  exportType,
  moveBox,
  newBox,
  renderEdited,
  resizeBox,
} from "@/lib/slab-image";
import { type Watermark, hasWatermark, useWatermark } from "@/lib/watermark";

type Photo = { url: string; name: string; type: string };

type DragState = {
  mode: "move" | "resize";
  id: number;
  startX: number;
  startY: number;
  start: Box;
};

// Arrow keys nudge a box by 1% of the photo; with Shift they resize it.
const KEY_STEP = 0.01;
const LINK_CLASS =
  "min-h-11 min-w-11 cursor-pointer touch-manipulation px-2 text-sm underline underline-offset-4";

function describeWatermark(watermark: Watermark) {
  const text = watermark.text.trim();
  if (watermark.image && text) return `logo + “${text}”`;
  return watermark.image ? "logo" : `“${text}”`;
}

const ARROW_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function SlabEditor() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [watermarkOn, setWatermarkOn] = useState(true);
  const [watermarkSheetOpen, setWatermarkSheetOpen] = useState(false);
  const watermark = useWatermark();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const isLoaded = !!photo && loadedUrl === photo.url;
  const isFailed = !!photo && failedUrl === photo.url;
  const activeWatermark =
    watermarkOn && hasWatermark(watermark) ? watermark : null;

  const ingestImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    dragRef.current = null;
    setPhoto({
      url: URL.createObjectURL(file),
      name: file.name,
      type: file.type,
    });
    setBoxes([newBox(0)]);
  }, []);

  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          ingestImageFile(file);
          return;
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ingestImageFile]);

  useEffect(() => {
    let dragDepth = 0;
    function hasFiles(e: DragEvent) {
      const types = e.dataTransfer?.types;
      return !!types && Array.from(types).includes("Files");
    }
    function onDragEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth += 1;
      setIsDragging(true);
    }
    function onDragOver(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    }
    function onDragLeave() {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setIsDragging(false);
    }
    function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      const image = files.find((f) => f.type.startsWith("image/"));
      if (image) ingestImageFile(image);
    }
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [ingestImageFile]);

  // Copy asks for PNG; Download takes the photo's own export type.
  // TODO: when the share-sheet PR's render cache lands, key it on
  // activeWatermark too (it's the same object until the settings change), so
  // Copy/Save never hand back a render with stale watermark settings.
  const getEditedBlob = useCallback(
    (type?: string): Promise<Blob> => {
      const img = imgRef.current;
      if (!photo || !img || !img.naturalWidth) {
        return Promise.reject(new Error("Photo isn't loaded yet"));
      }
      return renderEdited(
        img,
        boxes,
        type ?? exportType(photo.type),
        activeWatermark,
      );
    },
    [photo, boxes, activeWatermark],
  );

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) ingestImageFile(file);
    e.target.value = "";
  }

  function addBox() {
    setBoxes((prev) => [...prev, newBox(prev.length)]);
  }

  function removeBox(id: number) {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
  }

  function replaceBox(next: Box) {
    setBoxes((prev) => prev.map((b) => (b.id === next.id ? next : b)));
  }

  // Pointer position in photo fractions.
  function pointerFractions(e: React.PointerEvent) {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      fx: (e.clientX - rect.left) / rect.width,
      fy: (e.clientY - rect.top) / rect.height,
    };
  }

  function startDrag(
    e: React.PointerEvent<HTMLElement>,
    box: Box,
    mode: DragState["mode"],
  ) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { fx, fy } = pointerFractions(e);
    dragRef.current = { mode, id: box.id, startX: fx, startY: fy, start: box };
  }

  // Attached to the box only: events from its captured resize handle bubble
  // up here, so the handle doesn't need its own move/up listeners.
  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const { fx, fy } = pointerFractions(e);
    const dx = fx - drag.startX;
    const dy = fy - drag.startY;
    replaceBox(
      drag.mode === "move"
        ? moveBox(drag.start, dx, dy)
        : resizeBox(drag.start, dx, dy),
    );
  }

  function endDrag() {
    dragRef.current = null;
  }

  function onBoxKeyDown(e: React.KeyboardEvent, box: Box) {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeBox(box.id);
      return;
    }
    const arrow = ARROW_KEYS[e.key];
    if (!arrow) return;
    e.preventDefault();
    const [dx, dy] = [arrow[0] * KEY_STEP, arrow[1] * KEY_STEP];
    replaceBox(e.shiftKey ? resizeBox(box, dx, dy) : moveBox(box, dx, dy));
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={onFileChange}
    />
  );

  const watermarkSheet = (
    <WatermarkSheet
      open={watermarkSheetOpen}
      onClose={() => setWatermarkSheetOpen(false)}
      photoUrl={isLoaded ? photo.url : null}
    />
  );

  if (!photo) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`flex w-full cursor-pointer touch-manipulation flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
            isDragging
              ? "border-foreground bg-foreground/5"
              : "border-foreground/20 hover:border-foreground/40"
          }`}
        >
          <span className="hidden text-lg font-medium pointer-coarse:inline">
            Tap to choose a slab photo
          </span>
          <span className="font-medium pointer-coarse:hidden">
            {isDragging ? "Drop it here" : "Drag and drop a slab photo"}
          </span>
          <span className="text-sm text-foreground/60 pointer-coarse:hidden">
            …or click to choose one, or paste it (⌘V / Ctrl+V)
          </span>
        </button>
        <button
          type="button"
          onClick={() => setWatermarkSheetOpen(true)}
          className={`${LINK_CLASS} text-foreground/70`}
        >
          {hasWatermark(watermark)
            ? `Watermark: ${describeWatermark(watermark)} · Edit`
            : "+ Add a watermark"}
        </button>
        {fileInput}
        {watermarkSheet}
      </div>
    );
  }

  const baseName = photo.name.replace(/\.[^.]+$/, "") || "slab";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        ref={stageRef}
        className={`relative select-none ${
          isDragging ? "ring-2 ring-foreground" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={photo.url}
          alt="Slab photo"
          onLoad={() => setLoadedUrl(photo.url)}
          onError={() => setFailedUrl(photo.url)}
          draggable={false}
          className="block max-h-[60dvh] max-w-full rounded-lg [-webkit-touch-callout:none]"
        />
        {isLoaded && activeWatermark && (
          <WatermarkLayer watermark={activeWatermark} />
        )}
        {isLoaded &&
          boxes.map((box) => (
            <div
              key={box.id}
              tabIndex={0}
              role="group"
              aria-label="Black box. Drag or use the arrow keys to move it, Shift+arrow keys to resize it, Delete to remove it."
              onPointerDown={(e) => startDrag(e, box, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(e) => onBoxKeyDown(e, box)}
              className="absolute cursor-move touch-none bg-black ring-1 ring-white/70 outline-offset-2 outline-sky-500 focus-visible:outline-2"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
            >
              {/* Both corner controls have a 44px hit area for thumbs, set
                  mostly outside the box so grabbing near a corner still
                  moves the box. The visible dot sits on the corner itself. */}
              <button
                type="button"
                onClick={() => removeBox(box.id)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Remove box"
                className="absolute -right-8 -top-8 size-11 cursor-pointer touch-manipulation"
              >
                <span className="absolute left-0 top-5 flex size-6 items-center justify-center rounded-full bg-white text-sm leading-none text-zinc-900 shadow ring-1 ring-zinc-300">
                  ×
                </span>
              </button>
              <div
                role="presentation"
                onPointerDown={(e) => startDrag(e, box, "resize")}
                className="absolute -bottom-8 -right-8 size-11 cursor-nwse-resize touch-none"
              >
                <span className="absolute left-1.25 top-1.25 size-3.5 rounded-sm border border-zinc-900 bg-white" />
              </div>
            </div>
          ))}
        {/* Over the boxes, as in the export, so a box can't hide it. */}
        {isLoaded && <CreditLayer />}
      </div>

      {/* TODO: once HEIC support lands, hide this row while a photo converts,
          like the photo itself. */}
      <div className="flex items-center justify-center">
        {hasWatermark(watermark) ? (
          <>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm">
              <input
                type="checkbox"
                checked={watermarkOn}
                onChange={(e) => setWatermarkOn(e.target.checked)}
                className="size-5 cursor-pointer accent-foreground"
              />
              Watermark
              {watermark.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={watermark.image}
                  alt=""
                  className="size-5 object-contain"
                />
              )}
              {watermark.text.trim() && (
                <span className="max-w-36 truncate text-foreground/60">
                  “{watermark.text.trim()}”
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setWatermarkSheetOpen(true)}
              className={LINK_CLASS}
            >
              Edit
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setWatermarkSheetOpen(true)}
            className={LINK_CLASS}
          >
            + Add a watermark
          </button>
        )}
      </div>

      {isFailed ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t open that photo. Try saving it as a JPG or PNG first.
        </p>
      ) : (
        <p className="max-w-md text-sm text-foreground/60">
          Drag the black box over the serial number, and drag its corner to
          resize it. Add more boxes for anything else you want hidden.
        </p>
      )}

      {/* Pinned to the bottom of the screen while the photo is taller than
          the viewport, so the actions stay in thumb reach. */}
      <div className="sticky bottom-0 grid w-full max-w-md grid-cols-2 gap-2 bg-background pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
        <Button onClick={addBox} disabled={!isLoaded}>
          + Add box
        </Button>
        <Button onClick={() => fileInputRef.current?.click()}>
          Change photo
        </Button>
        {isLoaded && (
          <ExportActions
            getBlob={getEditedBlob}
            filename={`${baseName}-edited`}
          />
        )}
      </div>
      {fileInput}
      {watermarkSheet}
    </div>
  );
}
