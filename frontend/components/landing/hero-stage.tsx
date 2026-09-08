"use client";

import { useEffect, useRef } from "react";

type Node = {
  orbit: number;
  speed: number;
  phase: number;
  lift: number;
  size: number;
  live: boolean;
};

const NODES: Node[] = [
  { orbit: 0, speed: 0, phase: 0, lift: 0, size: 1, live: true },
  { orbit: 1.15, speed: 0.22, phase: 0.2, lift: 0.18, size: 0.62, live: true },
  { orbit: 1.35, speed: 0.16, phase: 1.3, lift: -0.28, size: 0.5, live: false },
  { orbit: 1.05, speed: 0.28, phase: 2.4, lift: 0.42, size: 0.48, live: true },
  { orbit: 1.45, speed: 0.14, phase: 3.5, lift: -0.12, size: 0.56, live: false },
  { orbit: 1.22, speed: 0.2, phase: 4.6, lift: 0.32, size: 0.44, live: true },
  { orbit: 1.38, speed: 0.18, phase: 5.5, lift: -0.38, size: 0.52, live: false },
];

function ok(...values: number[]) {
  return values.every((value) => Number.isFinite(value));
}

function project(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  rotY: number,
  rotX: number,
) {
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const y1 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const scale = 3.1 / (3.1 + z2 + 1.8);
  const field = Math.max(width, height) * 0.5;
  const px = width * 0.5 + x1 * scale * field;
  const py = height * 0.5 + y1 * scale * field;
  if (!ok(px, py, scale, z2)) return null;
  return { x: px, y: py, scale, depth: z2 };
}

/**
 * Lightweight 2.5D call constellation. No WebGL, no shadowBlur.
 * Runs on rAF; paused only when the tab is hidden or reduced-motion is on.
 */
export function HeroStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx =
      canvas.getContext("2d", { alpha: true, desynchronized: true }) ??
      canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let cssW = 0;
    let cssH = 0;
    const sparks = Array.from({ length: 22 }, () => ({
      x: (Math.random() - 0.5) * 7,
      y: (Math.random() - 0.5) * 5,
      z: (Math.random() - 0.5) * 5,
    }));

    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.4);
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 2 || height < 2) return;
      if (width === cssW && height === cssH) return;
      cssW = width;
      cssH = height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (event: PointerEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w < 1 || h < 1) return;
      mouse.tx = event.clientX / w - 0.5;
      mouse.ty = event.clientY / h - 0.5;
    };

    const draw = (now: number) => {
      const width = cssW;
      const height = cssH;
      if (width < 2 || height < 2) return;

      const t = reduceMotion ? 1.2 : now / 1000;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      const rotY = t * 0.18 + mouse.x * 0.45;
      const rotX = 0.42 + Math.sin(t * 0.22) * 0.05 + mouse.y * 0.22;

      ctx.clearRect(0, 0, width, height);

      const points = NODES.map((node, index) => {
        const angle = t * node.speed + node.phase;
        const x = index === 0 ? 0 : Math.cos(angle) * node.orbit;
        const z = index === 0 ? 0 : Math.sin(angle) * node.orbit;
        const y = index === 0 ? 0 : node.lift + Math.sin(angle * 1.4) * 0.08;
        return { node, point: project(x, y, z, width, height, rotY, rotX) };
      }).filter((item) => item.point);

      points.sort((a, b) => (a.point?.depth ?? 0) - (b.point?.depth ?? 0));

      ctx.lineWidth = 1;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i].point;
          const b = points[j].point;
          if (!a || !b) continue;
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const limit = Math.max(width, height) * 0.55;
          if (dist > limit) continue;
          ctx.strokeStyle = `rgba(61, 90, 254, ${(1 - dist / limit) * 0.28})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      sparks.forEach((spark) => {
        const point = project(spark.x, spark.y, spark.z, width, height, rotY, rotX);
        if (!point) return;
        ctx.fillStyle = `rgba(61, 90, 254, ${0.12 + point.scale * 0.28})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(0.7, 1.8 * point.scale), 0, Math.PI * 2);
        ctx.fill();
      });

      points.forEach(({ node, point }) => {
        if (!point) return;
        const r = Math.max(10, 46 * node.size * point.scale);
        if (!ok(point.x, point.y, r)) return;
        const pulse = node.live ? 0.55 + Math.sin(t * 3 + node.phase) * 0.45 : 0.15;

        if (node.live) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, r * (1.45 + pulse * 0.2), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 122, 69, ${0.16 + pulse * 0.22})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        const body = ctx.createRadialGradient(
          point.x - r * 0.25,
          point.y - r * 0.3,
          2,
          point.x,
          point.y,
          r,
        );
        if (node.size === 1) {
          body.addColorStop(0, "#ffffff");
          body.addColorStop(1, "#8ea0ff");
        } else {
          body.addColorStop(0, "#ffffff");
          body.addColorStop(1, node.live ? "#ffb08a" : "#a8b6ff");
        }
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(61, 90, 254, 0.22)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      draw(now);
    };

    resize();
    draw(1200);
    canvas.classList.add("is-ready");
    if (!reduceMotion) raf = requestAnimationFrame(loop);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", resize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-stage-canvas" aria-hidden />;
}
