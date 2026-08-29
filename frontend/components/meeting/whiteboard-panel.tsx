"use client";

import { Button } from "@/components/ui/button";
import { useWhiteboardSync } from "@/components/meeting/whiteboard-sync";
import {
  type WhiteboardStroke,
  type WhiteboardTool,
} from "@/lib/whiteboard-messages";
import { useParticipants } from "@livekit/components-react";
import {
  Circle,
  Eraser,
  Highlighter,
  Minus,
  Pencil,
  Redo2,
  Square,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLORS = ["#ffffff", "#8ab4f8", "#34a853", "#fbbc04", "#ea4335", "#000000"];
const WIDTHS = [2, 4, 8, 12];

type WhiteboardPanelProps = {
  open: boolean;
  onClose: () => void;
  localIdentity: string;
  authorName: string;
  isHost: boolean;
  onToast?: (message: string, tone?: "info" | "success" | "warning") => void;
};

export function WhiteboardPanel({
  open,
  onClose,
  localIdentity,
  authorName,
  isHost,
}: WhiteboardPanelProps) {
  const liveParticipants = useParticipants();
  const {
    strokes,
    owner,
    canEdit,
    handoverTo,
    revokeEditor,
    addStroke,
    undoStroke,
    clearOwnStrokes,
    requestSync,
  } = useWhiteboardSync();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const openedRef = useRef(false);

  const [tool, setTool] = useState<WhiteboardTool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [handoverOpen, setHandoverOpen] = useState(false);

  const nonAdminParticipants = useMemo(
    () =>
      liveParticipants
        .filter((participant) => !(isHost && participant.isLocal))
        .map((participant) => ({
          identity: participant.identity,
          name: participant.name || participant.identity || "Guest",
        })),
    [liveParticipants, isHost],
  );

  const assignedEditor =
    owner && !(isHost && owner.identity === localIdentity) ? owner : null;

  const assignCandidates = nonAdminParticipants.filter(
    (p) => p.identity !== owner?.identity,
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      drawStroke(ctx, stroke);
    }
    if (currentStrokeRef.current) {
      drawStroke(ctx, currentStrokeRef.current);
    }
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    void requestSync();
  }, [open, requestSync]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      redrawRef.current();
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [open]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * canvas.width,
      ((e.clientY - rect.top) / rect.height) * canvas.height,
    ];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canEdit) return;
    if (tool === "eraser") {
      eraseAt(...pointerPos(e));
      return;
    }
    drawingRef.current = true;
    const point = pointerPos(e);
    currentStrokeRef.current = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tool,
      color: tool === "highlighter" ? color + "88" : color,
      width: tool === "highlighter" ? width * 2 : width,
      points: [point],
      author: authorName,
      authorIdentity: localIdentity,
    };
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canEdit) return;
    if (tool === "eraser" && e.buttons > 0) {
      eraseAt(...pointerPos(e));
      return;
    }
    if (!drawingRef.current || !currentStrokeRef.current) return;
    currentStrokeRef.current.points.push(pointerPos(e));
    redraw();
  }

  async function onPointerUp() {
    if (!canEdit) return;
    if (!drawingRef.current || !currentStrokeRef.current) return;
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    redraw();
    await addStroke(stroke);
  }

  function eraseAt(x: number, y: number) {
    if (!canEdit) return;
    const hit = strokes.findLast(
      (stroke) =>
        stroke.authorIdentity === localIdentity &&
        stroke.points.some(
          ([px, py]) => Math.hypot(px - x, py - y) < stroke.width + 8,
        ),
    );
    if (!hit) return;
    void undoStroke(hit.id);
  }

  function handleUndo() {
    const lastOwn = [...strokes]
      .reverse()
      .find((stroke) => stroke.authorIdentity === localIdentity);
    if (!lastOwn) return;
    void undoStroke(lastOwn.id);
  }

  async function handleHandover(identity: string, name: string) {
    await handoverTo({ identity, name });
  }

  async function handleRevoke() {
    await revokeEditor();
  }

  if (!open) return null;

  const readOnly = !canEdit;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[var(--meet-bg)]">
      <header className="flex shrink-0 flex-col gap-2 border-b border-[var(--meet-border)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium text-[var(--meet-text)]">Whiteboard</h2>
            <p className="text-xs text-[var(--meet-text-muted)]">
              {isHost
                ? assignedEditor
                  ? `You are editing (Admin) · ${assignedEditor.name} can also edit`
                  : "You are editing (Admin)"
                : canEdit
                  ? "You are editing"
                  : owner
                    ? `View only — ${owner.name} is editing`
                    : "View only — ask admin to assign you"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isHost ? (
              <div className="relative">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setHandoverOpen((v) => !v)}
                >
                  <UserRoundCog className="h-4 w-4" />
                  Assign editor
                </Button>
                {handoverOpen ? (
                  <div className="absolute right-0 top-full z-30 mt-1 min-w-[220px] rounded-lg border border-[var(--meet-border)] bg-[var(--meet-surface)] py-1 shadow-lg">
                    {assignedEditor ? (
                      <div className="border-b border-[var(--meet-border)] px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--meet-text-muted)]">
                          Current editor
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-sm text-[var(--meet-text)]">
                            {assignedEditor.name}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 text-xs text-[var(--meet-danger)] hover:underline"
                            onClick={() => void handleRevoke()}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--meet-text-muted)]">
                      Assign to
                    </p>
                    {assignCandidates.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-[var(--meet-text-muted)]">
                        No other participants in the call yet
                      </p>
                    ) : (
                      assignCandidates.map((participant) => (
                        <button
                          key={participant.identity}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm text-[var(--meet-text)] hover:bg-[var(--meet-bg)]"
                          onClick={() =>
                            void handleHandover(
                              participant.identity,
                              participant.name,
                            )
                          }
                        >
                          {participant.name}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["pen", Pencil],
                ["highlighter", Highlighter],
                ["eraser", Eraser],
                ["line", Minus],
                ["rectangle", Square],
                ["circle", Circle],
              ] as const
            ).map(([t, Icon]) => (
              <Button
                key={t}
                size="sm"
                variant={tool === t ? "primary" : "secondary"}
                onClick={() => setTool(t)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-[var(--meet-primary)]" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <select
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="rounded-lg border border-[var(--meet-border)] bg-[var(--meet-surface)] px-2 py-1 text-sm text-[var(--meet-text)]"
            >
              {WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w}px
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={handleUndo}>
              <Redo2 className="h-4 w-4" />
              Undo mine
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void clearOwnStrokes()}>
              <Trash2 className="h-4 w-4" />
              Clear mine
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--meet-text-muted)]">
            Ask the admin to assign you the whiteboard if you need to draw.
          </p>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 touch-none ${readOnly ? "cursor-default" : "cursor-crosshair"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke) {
  if (stroke.points.length === 0) return;

  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const [x0, y0] = stroke.points[0];
  const [x1, y1] = stroke.points.at(-1)!;

  switch (stroke.tool) {
    case "line":
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      break;
    case "rectangle": {
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      break;
    }
    case "circle": {
      const r = Math.hypot(x1 - x0, y1 - y0);
      ctx.beginPath();
      ctx.arc(x0, y0, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    default:
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
      }
      ctx.stroke();
  }
}
