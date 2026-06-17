'use dom';

import type { DOMProps } from 'expo/dom';
import { useCallback, useEffect, useRef } from 'react';

import { buildStrokeOutline, drawStrokePolygon, type Point } from '@/lib/stroke';

type DrawingCanvasProps = {
  clearSignal?: number;
  inkColor?: string;
  dom?: DOMProps;
};

function getCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    t: performance.now(),
  };
}

export default function DrawingCanvas({
  clearSignal = 0,
  inkColor = '#111',
}: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  const completedStrokesRef = useRef<Point[][]>([]);
  const activePointsRef = useRef<Point[]>([]);
  const isDrawingRef = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const { width, height } = sizeRef.current;
    if (!canvas || !ctx || width === 0 || height === 0) return;

    ctx.clearRect(0, 0, width, height);

    for (const stroke of completedStrokesRef.current) {
      const polygon = buildStrokeOutline(stroke);
      drawStrokePolygon(ctx, polygon, inkColor);
    }

    if (activePointsRef.current.length > 0) {
      const polygon = buildStrokeOutline(activePointsRef.current);
      drawStrokePolygon(ctx, polygon, inkColor);
    }
  }, [inkColor]);

  const setupCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    sizeRef.current = { width, height, dpr };
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxRef.current = ctx;
    redraw();
  }, [redraw]);

  useEffect(() => {
    setupCanvas();
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => setupCanvas());
    observer.observe(container);
    return () => observer.disconnect();
  }, [setupCanvas]);

  useEffect(() => {
    completedStrokesRef.current = [];
    activePointsRef.current = [];
    isDrawingRef.current = false;
    redraw();
  }, [clearSignal, redraw]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    activePointsRef.current = [getCanvasPoint(canvas, event.clientX, event.clientY)];
    redraw();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    activePointsRef.current.push(getCanvasPoint(canvas, event.clientX, event.clientY));
    redraw();
  };

  const finishStroke = () => {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    if (activePointsRef.current.length > 0) {
      completedStrokesRef.current.push([...activePointsRef.current]);
    }
    activePointsRef.current = [];
    redraw();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    canvasRef.current?.releasePointerCapture(event.pointerId);
    finishStroke();
  };

  const handlePointerCancel = () => {
    finishStroke();
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        touchAction: 'none',
        overflow: 'hidden',
      }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      />
    </div>
  );
}
