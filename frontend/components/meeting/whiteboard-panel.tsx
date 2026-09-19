"use client";

import { useWhiteboardSync } from "@/components/meeting/whiteboard-sync";
import {
  type WhiteboardStroke,
  type WhiteboardTool,
} from "@/lib/whiteboard-messages";
import { useParticipants } from "@livekit/components-react";
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Eraser,
  Highlighter,
  Minus,
  Pencil,
  Redo2,
  Settings2,
  Square,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLORS = ["#ffffff", "#8ab4f8", "#34a853", "#fbbc04", "#ea4335", "#000000"];
const WIDTHS = [2, 4, 8, 12];
const TOOLS = [
  { id: "pen", label: "Pen", Icon: Pencil },
  { id: "highlighter", label: "Highlighter", Icon: Highlighter },
  { id: "eraser", label: "Eraser", Icon: Eraser },
  { id: "line", label: "Line", Icon: Minus },
  { id: "rectangle", label: "Rectangle", Icon: Square },
  { id: "circle", label: "Circle", Icon: Circle },
] as const;

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const assignRef = useRef<HTMLDivElement>(null);

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
    setSheetOpen(false);
    setAssignOpen(false);
  }

  async function handleRevoke() {
    await revokeEditor();
    setSheetOpen(false);
    setAssignOpen(false);
  }

  useEffect(() => {
    if (!open) {
      setSheetOpen(false);
      setAssignOpen(false);
    }
  }, [open]);

  useEffect(() => {
    function onResize() {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setSheetOpen(false);
      } else {
        setAssignOpen(false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!assignOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!assignRef.current?.contains(event.target as Node)) {
        setAssignOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [assignOpen]);

  if (!open) return null;

  const readOnly = !canEdit;
  const activeTool = TOOLS.find((item) => item.id === tool) ?? TOOLS[0];
  const ActiveToolIcon = activeTool.Icon;

  return (
    <div className="meet-whiteboard" role="dialog" aria-label="Whiteboard">
      <header className="meet-wb-chrome">
        <p className="meet-wb-title">Whiteboard</p>
        {canEdit ? (
          <p className="meet-wb-status">
            <ActiveToolIcon />
            {activeTool.label}
            <span
              className="meet-wb-status-swatch"
              style={{ background: color }}
            />
            {width}px
          </p>
        ) : (
          <p className="meet-wb-status is-muted">
            {assignedEditor
              ? `${assignedEditor.name} is drawing`
              : "Waiting for the host to assign drawing"}
          </p>
        )}

        <div className="meet-wb-desktop">
          {canEdit ? (
            <>
              <div className="meet-wb-desktop-group" role="toolbar" aria-label="Draw">
                {TOOLS.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      aria-label={item.label}
                      className={tool === item.id ? "is-active" : undefined}
                      onClick={() => setTool(item.id)}
                    >
                      <Icon />
                    </button>
                  );
                })}
              </div>
              <div className="meet-wb-desktop-group meet-wb-desktop-colors" role="toolbar" aria-label="Color">
                {COLORS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`Use ${value}`}
                    className={color === value ? "is-active" : undefined}
                    onClick={() => setColor(value)}
                  >
                    <span style={{ background: value }} />
                  </button>
                ))}
              </div>
              <div className="meet-wb-desktop-group" role="toolbar" aria-label="Stroke">
                {WIDTHS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`meet-wb-width${width === value ? " is-active" : ""}`}
                    onClick={() => setWidth(value)}
                  >
                    {value}px
                  </button>
                ))}
              </div>
              <div className="meet-wb-desktop-group">
                <button type="button" title="Undo" aria-label="Undo" onClick={handleUndo}>
                  <Redo2 />
                </button>
                <button
                  type="button"
                  title="Clear"
                  aria-label="Clear"
                  onClick={() => void clearOwnStrokes()}
                >
                  <Trash2 />
                </button>
              </div>
            </>
          ) : (
            <p className="meet-wb-readonly">
              {assignedEditor
                ? `${assignedEditor.name} is drawing`
                : "Waiting for the host to assign drawing"}
            </p>
          )}
          {isHost ? (
            <div className="meet-wb-desktop-assign" ref={assignRef}>
              <button
                type="button"
                className={assignOpen ? "is-active" : undefined}
                aria-expanded={assignOpen}
                onClick={() => setAssignOpen((openAssign) => !openAssign)}
              >
                <UserRoundCog />
                Assign
                <ChevronDown />
              </button>
              {assignOpen ? (
                <div className="meet-wb-assign-menu" role="menu">
                  {assignedEditor ? (
                    <div className="meet-wb-assign-current">
                      <span>{assignedEditor.name}</span>
                      <button
                        type="button"
                        onClick={() => void handleRevoke()}
                      >
                        Take back
                      </button>
                    </div>
                  ) : null}
                  {assignCandidates.length === 0 ? (
                    <p className="meet-wb-assign-empty">No other people yet</p>
                  ) : (
                    assignCandidates.map((participant) => (
                      <button
                        key={participant.identity}
                        type="button"
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
        </div>

        <button
          type="button"
          className={`meet-wb-tools-btn${sheetOpen ? " is-open" : ""}`}
          aria-expanded={sheetOpen}
          aria-controls="meet-wb-sheet"
          onClick={() => setSheetOpen((openSheet) => !openSheet)}
        >
          <Settings2 />
          Tools
          <ChevronUp />
        </button>
        <button
          type="button"
          className="meet-wb-close"
          onClick={onClose}
          aria-label="Close whiteboard"
        >
          <X />
        </button>
      </header>

      <div
        className="meet-wb-canvas"
        onPointerDownCapture={() => {
          if (sheetOpen) setSheetOpen(false);
        }}
      >
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 touch-none ${readOnly ? "cursor-default" : "cursor-crosshair"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>

      {sheetOpen ? (
        <>
          <button
            type="button"
            className="meet-wb-sheet-backdrop"
            aria-label="Close tools"
            onClick={() => setSheetOpen(false)}
          />
          <div
            id="meet-wb-sheet"
            className="meet-wb-sheet"
            ref={sheetRef}
            role="dialog"
            aria-label="Whiteboard tools"
          >
            <div className="meet-wb-sheet-handle" />
            {canEdit ? (
              <>
                <section className="meet-wb-section">
                  <h3>Draw</h3>
                  <div className="meet-wb-grid">
                    {TOOLS.map((item) => {
                      const Icon = item.Icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={tool === item.id ? "is-active" : undefined}
                          onClick={() => setTool(item.id)}
                        >
                          <Icon />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="meet-wb-section">
                  <h3>Color</h3>
                  <div className="meet-wb-colors">
                    {COLORS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={`Use ${value}`}
                        className={color === value ? "is-active" : undefined}
                        onClick={() => setColor(value)}
                      >
                        <span style={{ background: value }} />
                      </button>
                    ))}
                  </div>
                </section>

                <section className="meet-wb-section">
                  <h3>Stroke</h3>
                  <div className="meet-wb-pills">
                    {WIDTHS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={width === value ? "is-active" : undefined}
                        onClick={() => setWidth(value)}
                      >
                        {value}px
                      </button>
                    ))}
                  </div>
                </section>

                <section className="meet-wb-section">
                  <h3>Board</h3>
                  <div className="meet-wb-pills">
                    <button type="button" onClick={handleUndo}>
                      <Redo2 />
                      Undo
                    </button>
                    <button type="button" onClick={() => void clearOwnStrokes()}>
                      <Trash2 />
                      Clear
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <p className="meet-wb-sheet-note">
                {assignedEditor
                  ? `${assignedEditor.name} is drawing. Only the assigned person can edit.`
                  : "Waiting for the host to assign drawing."}
              </p>
            )}

            {isHost ? (
              <section className="meet-wb-section">
                <h3>Assign drawing</h3>
                <div className="meet-wb-assign">
                  {assignedEditor ? (
                    <div className="meet-wb-assign-current">
                      <span>{assignedEditor.name}</span>
                      <button type="button" onClick={() => void handleRevoke()}>
                        Take back
                      </button>
                    </div>
                  ) : null}
                  {assignCandidates.length === 0 ? (
                    <p className="meet-wb-assign-empty">No other people yet</p>
                  ) : (
                    assignCandidates.map((participant) => (
                      <button
                        key={participant.identity}
                        type="button"
                        onClick={() =>
                          void handleHandover(
                            participant.identity,
                            participant.name,
                          )
                        }
                      >
                        <UserRoundCog />
                        {participant.name}
                      </button>
                    ))
                  )}
                </div>
              </section>
            ) : null}
          </div>
        </>
      ) : null}
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
