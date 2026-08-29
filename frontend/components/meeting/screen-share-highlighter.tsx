"use client";

import { Button } from "@/components/ui/button";
import { useScreenShareHighlighter } from "@/components/meeting/screen-share-highlighter-sync";
import type { HighlightStroke } from "@/lib/screen-share-highlighter-messages";
import {
  findScreenShareVideo,
  getVideoBoundsInContainer,
  getVideoSearchRoot,
  isNormalizedPoint,
  type VideoBounds,
} from "@/lib/screen-share-video-bounds";
import { Highlighter, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const HIGHLIGHT_COLORS = [
  { id: "yellow", value: "#fbbc0488", label: "Yellow" },
  { id: "green", value: "#34a85388", label: "Green" },
  { id: "blue", value: "#8ab4f888", label: "Blue" },
  { id: "red", value: "#ea433588", label: "Red" },
  { id: "purple", value: "#a142f488", label: "Purple" },
  { id: "white", value: "#ffffff66", label: "White" },
];

const HIGHLIGHT_WIDTHS = [
  { value: 8, label: "Small" },
  { value: 16, label: "Medium" },
  { value: 24, label: "Large" },
  { value: 32, label: "Extra large" },
];

type ScreenShareHighlighterControlsProps = {
  disabled?: boolean;
};

export function ScreenShareHighlighterControls({
  disabled = false,
}: ScreenShareHighlighterControlsProps) {
  const { isScreenSharing, highlightMode, setHighlightMode, sharerName } =
    useScreenShareHighlighter();

  if (!isScreenSharing) return null;

  return (
    <Button
      size="sm"
      variant={highlightMode ? "primary" : "secondary"}
      disabled={disabled}
      onClick={() => setHighlightMode(!highlightMode)}
      title={
        sharerName ? `Highlight on ${sharerName}'s screen` : "Highlight screen"
      }
    >
      <Highlighter className="h-4 w-4" />
      Highlight
    </Button>
  );
}

type ScreenShareHighlighterOverlayProps = {
  localIdentity: string;
  authorName: string;
};

export function ScreenShareHighlighterOverlay({
  localIdentity,
  authorName,
}: ScreenShareHighlighterOverlayProps) {
  const {
    strokes,
    isScreenSharing,
    highlightMode,
    setHighlightMode,
    addStroke,
    undoOwnStroke,
    clearAll,
    sharerName,
  } = useScreenShareHighlighter();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<HighlightStroke | null>(null);
  const videoBoundsRef = useRef<VideoBounds | null>(null);
  const [videoBounds, setVideoBounds] = useState<VideoBounds | null>(null);
  const [color, setColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [width, setWidth] = useState(16);

  const updateVideoBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const searchRoot = getVideoSearchRoot(container);
    const video = findScreenShareVideo(searchRoot);
    if (!video) {
      videoBoundsRef.current = null;
      setVideoBounds(null);
      return;
    }
    const bounds = getVideoBoundsInContainer(video, container);
    videoBoundsRef.current = bounds;
    setVideoBounds(bounds);
  }, []);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const bounds = videoBoundsRef.current;
    if (!canvas || !bounds) return false;

    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    return true;
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !syncCanvasSize()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      drawHighlightStroke(ctx, stroke, canvas.width, canvas.height);
    }
    if (currentStrokeRef.current) {
      drawHighlightStroke(
        ctx,
        currentStrokeRef.current,
        canvas.width,
        canvas.height,
      );
    }
  }, [strokes, syncCanvasSize]);

  useEffect(() => {
    redraw();
  }, [redraw, videoBounds]);

  useEffect(() => {
    if (!isScreenSharing) return;

    updateVideoBounds();
    const container = containerRef.current;
    if (!container) return;
    const searchRoot = getVideoSearchRoot(container);

    const observer = new ResizeObserver(() => {
      updateVideoBounds();
    });
    observer.observe(container);
    observer.observe(searchRoot);

    const video = findScreenShareVideo(searchRoot);
    if (video) {
      observer.observe(video);
    }

    const mutationObserver = new MutationObserver(() => {
      updateVideoBounds();
    });
    mutationObserver.observe(searchRoot, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const interval = window.setInterval(updateVideoBounds, 500);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.clearInterval(interval);
    };
  }, [isScreenSharing, updateVideoBounds]);

  function pointerPos(
    e: React.PointerEvent<HTMLCanvasElement>,
  ): [number, number] | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;

    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    return [
      Math.min(1, Math.max(0, nx)),
      Math.min(1, Math.max(0, ny)),
    ];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const point = pointerPos(e);
    if (!point) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color,
      widthNorm: width / canvas.height,
      points: [point],
      author: authorName,
      authorIdentity: localIdentity,
    };
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const point = pointerPos(e);
    if (!point) return;
    currentStrokeRef.current.points.push(point);
    redraw();
  }

  async function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!drawingRef.current || !currentStrokeRef.current) return;
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    redraw();
    await addStroke(stroke);
  }

  function handleUndoMine() {
    const lastOwn = [...strokes]
      .reverse()
      .find((stroke) => stroke.authorIdentity === localIdentity);
    if (!lastOwn) return;
    void undoOwnStroke(lastOwn.id);
  }

  if (!isScreenSharing) return null;

  const interactive = highlightMode;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-10 ${interactive ? "" : "pointer-events-none"}`}
    >
      {interactive ? (
        <div className="pointer-events-auto relative z-20 flex shrink-0 flex-col gap-2 border-b border-[var(--meet-primary)]/30 bg-[var(--meet-surface)]/90 px-3 py-2 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--meet-text-muted)]">
              Highlighting{" "}
              {sharerName ? `${sharerName}'s screen` : "shared screen"} — visible
              to everyone
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleUndoMine}>
                Undo mine
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void clearAll()}>
                <Trash2 className="h-4 w-4" />
                Clear all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHighlightMode(false)}
              >
                <X className="h-4 w-4" />
                Done
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--meet-text-muted)]">
                Color
              </span>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  className={`h-6 w-6 rounded-full border-2 ${color === c.value ? "border-[var(--meet-primary)]" : "border-transparent"}`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--meet-text-muted)]">
                Size
              </span>
              <select
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="rounded-lg border border-[var(--meet-border)] bg-[var(--meet-bg)] px-2 py-1 text-xs text-[var(--meet-text)]"
              >
                {HIGHLIGHT_WIDTHS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label} ({w.value}px)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {videoBounds ? (
        <canvas
          ref={canvasRef}
          className={`absolute z-10 touch-none ${interactive ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
          style={{
            left: videoBounds.left,
            top: videoBounds.top,
            width: videoBounds.width,
            height: videoBounds.height,
          }}
          onPointerDown={interactive ? onPointerDown : undefined}
          onPointerMove={interactive ? onPointerMove : undefined}
          onPointerUp={interactive ? onPointerUp : undefined}
          onPointerLeave={interactive ? onPointerUp : undefined}
        />
      ) : null}
    </div>
  );
}

function drawHighlightStroke(
  ctx: CanvasRenderingContext2D,
  stroke: HighlightStroke,
  canvasWidth: number,
  canvasHeight: number,
) {
  if (stroke.points.length === 0) return;

  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = getStrokeWidth(stroke, canvasHeight);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  const first = toCanvasPoint(stroke.points[0], canvasWidth, canvasHeight);
  if (!first) return;
  ctx.moveTo(first[0], first[1]);

  for (let i = 1; i < stroke.points.length; i++) {
    const point = toCanvasPoint(stroke.points[i], canvasWidth, canvasHeight);
    if (!point) continue;
    ctx.lineTo(point[0], point[1]);
  }
  ctx.stroke();
}

function getStrokeWidth(stroke: HighlightStroke, canvasHeight: number): number {
  if (typeof stroke.widthNorm === "number") {
    return stroke.widthNorm * canvasHeight;
  }
  return 16;
}

function toCanvasPoint(
  point: [number, number],
  canvasWidth: number,
  canvasHeight: number,
): [number, number] | null {
  if (isNormalizedPoint(point)) {
    return [point[0] * canvasWidth, point[1] * canvasHeight];
  }
  return point;
}
