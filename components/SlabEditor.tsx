"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button, buttonClass } from "@/components/Button";
import { CreditLayer } from "@/components/CreditLayer";
import { ExportActions } from "@/components/ExportActions";
import { WatermarkLayer } from "@/components/WatermarkLayer";
import {
  LAYOUTS,
  WatermarkSettings,
  WatermarkSheet,
} from "@/components/WatermarkSheet";
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
// Buttons that read as text. The pseudo-element pads the tap target out to
// about 44px without taking up any room.
const TEXT_BUTTON_CLASS =
  "relative cursor-pointer touch-manipulation outline-offset-2 outline-sky-500 transition-colors before:absolute before:-inset-3 focus-visible:outline-2";
const LINK_CLASS = `${TEXT_BUTTON_CLASS} text-muted underline underline-offset-3 hover:text-foreground`;

// Tailwind's sm: breakpoint, where the editor gets its side panel.
const WIDE_QUERY = "(min-width: 40rem)";

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isWideScreen() {
  return window.matchMedia(WIDE_QUERY).matches;
}

function describeWatermark(watermark: Watermark) {
  const text = watermark.text.trim();
  if (watermark.image && text) return `logo + “${text}”`;
  return watermark.image ? "logo" : `“${text}”`;
}

// E.g. "Tiled · 40%".
function describeSettings(watermark: Watermark) {
  const layout = LAYOUTS.find((l) => l.value === watermark.layout)?.label;
  return `${layout} · ${Math.round(watermark.opacity * 100)}%`;
}

const ARROW_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// The watermark on/off checkbox, drawn as a switch.
function WatermarkToggle({
  checked,
  onChange,
  className = "",
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex min-h-6 min-w-0 cursor-pointer items-center gap-3 ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-5 w-8.5 shrink-0 rounded-full bg-line-strong outline-offset-2 outline-sky-500 transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgba(0,0,0,0.4)] after:transition-transform peer-checked:after:translate-x-3.5"
      />
      <span className="truncate text-sm">{children}</span>
    </label>
  );
}

export function SlabEditor() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [watermarkOn, setWatermarkOn] = useState(true);
  const [watermarkSheetOpen, setWatermarkSheetOpen] = useState(false);
  const watermark = useWatermark();
  const isWide = useSyncExternalStore(subscribeToWidth, isWideScreen, () => false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const isLoaded = !!photo && loadedUrl === photo.url;
  const isFailed = !!photo && failedUrl === photo.url;
  const hasMark = hasWatermark(watermark);
  const activeWatermark = watermarkOn && hasMark ? watermark : null;
  // With a photo open on wider screens, the watermark settings take over the
  // side panel, so the photo stays in view as they change. Otherwise they
  // open in a sheet.
  const settingsInPanel = !!photo && isWide;

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

  function editWatermark() {
    setWatermarkSheetOpen(true);
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

  const watermarkSheet = !settingsInPanel && (
    <WatermarkSheet
      open={watermarkSheetOpen}
      onClose={() => setWatermarkSheetOpen(false)}
      photoUrl={isLoaded ? photo.url : null}
      asDrawer={isWide}
    />
  );

  if (!photo) {
    return (
      <div className="flex flex-1 flex-col sm:overflow-y-auto">
        <div className="my-auto flex flex-col items-center gap-7 px-4 pt-5 pb-8 sm:gap-10 sm:px-6 sm:py-10">
          <div className="flex max-w-140 flex-col gap-2 text-center sm:gap-2.5">
            <h1 className="text-2xl/7.5 font-medium tracking-[-0.02em] text-pretty sm:text-[28px]/8.5">
              Clean up a slab photo before you share it
            </h1>
            <p className="text-[15px]/5.5 text-pretty text-muted">
              Block out the serial numbers on your slabs and add a watermark to
              your inventory. Nothing is uploaded.
            </p>
          </div>
          <div className="flex w-full max-w-155 flex-col items-center gap-7 sm:gap-3.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`flex h-75 w-full cursor-pointer touch-manipulation flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed outline-offset-2 outline-sky-500 transition-colors focus-visible:outline-2 sm:h-80 sm:gap-2.5 ${
                isDragging
                  ? "border-foreground bg-white/5"
                  : "border-line-strong bg-panel hover:border-white/34"
              }`}
            >
              <span className="hidden text-[17px]/6 font-medium pointer-coarse:inline">
                Tap to choose a slab photo
              </span>
              <span className="hidden text-sm text-muted pointer-coarse:inline">
                From your camera roll or files
              </span>
              <span className="text-lg/6.5 font-medium pointer-coarse:hidden">
                {isDragging ? "Drop it here" : "Drop a slab photo here"}
              </span>
              <span className="text-sm text-muted pointer-coarse:hidden">
                or paste it with ⌘V / Ctrl+V
              </span>
              <span className={`mt-3 sm:mt-2.5 ${buttonClass()}`}>
                Choose a photo
              </span>
            </button>
            <div className="flex min-h-11 max-w-full items-center gap-2.5 sm:min-h-8">
              <span className="section-label shrink-0">Watermark</span>
              <span className="min-w-0 truncate text-[13px] text-muted">
                {hasMark
                  ? `${describeWatermark(watermark)} · ${describeSettings(watermark)}`
                  : "None yet"}
              </span>
              <span
                aria-hidden
                className="size-0.75 shrink-0 rounded-full bg-foreground/30"
              />
              <button
                type="button"
                onClick={editWatermark}
                className={`${TEXT_BUTTON_CLASS} shrink-0 text-[13px] text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-hover`}
              >
                {hasMark ? "Edit" : "Set one up"}
              </button>
            </div>
          </div>
        </div>
        {fileInput}
        {watermarkSheet}
      </div>
    );
  }

  const baseName = photo.name.replace(/\.[^.]+$/, "") || "slab";

  return (
    <div className="flex flex-1 flex-col sm:min-h-0 sm:flex-row">
      <div className="flex flex-1 flex-col items-center gap-2 px-4 pt-4 pb-4 sm:min-w-0 sm:justify-center sm:gap-3.5 sm:p-8">
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
            // On wider screens, the photo fits under the header with room
            // for the stage's padding and the file name row below it.
            className="block max-h-[60dvh] max-w-full rounded-lg [-webkit-touch-callout:none] sm:max-h-[calc(100dvh-52px-64px-30px)]"
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

        <div className="flex h-6 max-w-full items-center gap-2 font-mono text-xs text-faint sm:h-auto">
          <span className="truncate">{photo.name}</span>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${LINK_CLASS} shrink-0`}
          >
            Change photo
          </button>
        </div>

        {/* Phones only; wider screens have this in the side panel.
            TODO: once HEIC support lands, hide the watermark controls here
            and in the panel while a photo converts, like the photo itself. */}
        <div className="flex h-13 w-full items-center gap-3 rounded-xl border border-line bg-panel px-3.5 sm:hidden">
          {hasMark ? (
            <WatermarkToggle
              checked={watermarkOn}
              onChange={setWatermarkOn}
              className="flex-1 self-stretch"
            >
              Watermark{" "}
              <span className="text-muted">{describeWatermark(watermark)}</span>
            </WatermarkToggle>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm">
              Watermark <span className="text-muted">None yet</span>
            </span>
          )}
          <button
            type="button"
            onClick={editWatermark}
            className={`${LINK_CLASS} shrink-0 text-[13px]`}
          >
            {hasMark ? "Edit" : "Set one up"}
          </button>
        </div>

        {isFailed ? (
          <p role="alert" className="text-center text-sm text-red-400">
            Couldn&apos;t open that photo. Try saving it as a JPG or PNG first.
          </p>
        ) : (
          <p className="mt-1 text-center text-[13px]/4.5 text-pretty text-faint sm:hidden">
            Drag the black box over the serial number; drag its corner to
            resize.
          </p>
        )}
      </div>

      {/* The side panel on wider screens. On phones it's a dock, pinned to
          the bottom of the screen while the photo is taller than the
          viewport, so the actions stay in thumb reach. */}
      <aside className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-panel px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:static sm:w-84 sm:shrink-0 sm:gap-0 sm:overflow-y-auto sm:border-t-0 sm:border-l sm:p-0">
        {settingsInPanel && watermarkSheetOpen ? (
          <WatermarkSettings
            inPanel
            photoUrl={isLoaded ? photo.url : null}
            onDone={() => setWatermarkSheetOpen(false)}
          />
        ) : (
          <>
            <section className="hidden flex-col gap-3 border-b border-line px-5 pt-5 pb-4.5 sm:flex">
              <div className="flex items-center justify-between">
                <h2 className="section-label">Boxes</h2>
                <Button size="sm" onClick={addBox} disabled={!isLoaded}>
                  + Add box
                </Button>
              </div>
              {boxes.map((box, i) => (
                <div
                  key={box.id}
                  className="flex h-9 items-center justify-between rounded-lg bg-field px-3"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-2.25 w-3.5 rounded-[1px] bg-black ring-1 ring-white/70"
                    />
                    Box {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBox(box.id)}
                    aria-label={`Remove box ${i + 1}`}
                    className={`${TEXT_BUTTON_CLASS} text-[13px] text-muted hover:text-foreground`}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <p className="text-[13px]/4.5 text-pretty text-faint">
                Drag a box over the serial number and pull its corner to
                resize. Arrow keys nudge; Shift + arrows resize.
              </p>
            </section>

            <section className="hidden flex-col gap-3 border-b border-line px-5 py-4.5 sm:flex">
              <div className="flex items-center justify-between">
                <h2 className="section-label">Watermark</h2>
                <button
                  type="button"
                  onClick={editWatermark}
                  className={`${LINK_CLASS} text-[13px]`}
                >
                  {hasMark ? "Edit" : "Set one up"}
                </button>
              </div>
              {hasMark ? (
                <>
                  <WatermarkToggle
                    checked={watermarkOn}
                    onChange={setWatermarkOn}
                  >
                    <span className="sr-only">Watermark </span>
                    {describeWatermark(watermark)}
                  </WatermarkToggle>
                  <p className="text-[13px]/4.5 text-faint">
                    {describeSettings(watermark)}
                  </p>
                </>
              ) : (
                <p className="text-muted">None yet</p>
              )}
            </section>

            <Button
              onClick={addBox}
              disabled={!isLoaded}
              className="w-full sm:hidden"
            >
              + Add box
            </Button>

            {isLoaded && (
              <div className="flex flex-col gap-2.5 sm:mt-auto sm:p-5">
                <div className="grid grid-cols-2 gap-2">
                  <ExportActions
                    getBlob={getEditedBlob}
                    filename={`${baseName}-edited`}
                  />
                </div>
                <p className="hidden text-center text-xs text-faint sm:block">
                  Saves as{" "}
                  {exportType(photo.type) === "image/jpeg" ? "JPG" : "PNG"} at
                  the original size.
                </p>
              </div>
            )}
          </>
        )}
      </aside>
      {fileInput}
      {watermarkSheet}
    </div>
  );
}
