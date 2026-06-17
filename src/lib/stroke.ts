export type Point = {
  x: number;
  y: number;
  t: number;
};

export type StrokeOptions = {
  baseRadius?: number;
  minRadius?: number;
  maxRadius?: number;
  velocityFactor?: number;
  minDistance?: number;
  resampleSpacing?: number;
};

const DEFAULTS: Required<StrokeOptions> = {
  baseRadius: 4,
  minRadius: 2,
  maxRadius: 6,
  velocityFactor: 0.08,
  minDistance: 1.5,
  resampleSpacing: 2,
};

function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function filterPoints(points: Point[], minDistance: number): Point[] {
  if (points.length === 0) return [];

  const filtered: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = filtered[filtered.length - 1];
    if (distance(last, points[i]) >= minDistance) {
      filtered.push(points[i]);
    }
  }
  return filtered;
}

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;

  const x =
    0.5 *
    (2 * p1.x +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

  const y =
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

  const time = p1.t + (p2.t - p1.t) * t;
  return { x, y, t: time };
}

function phantomPoint(a: Point, b: Point): Point {
  return {
    x: a.x + (a.x - b.x),
    y: a.y + (a.y - b.y),
    t: a.t + (a.t - b.t),
  };
}

export function resampleCatmullRom(points: Point[], spacing: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [...points];

  const result: Point[] = [{ ...points[0] }];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? phantomPoint(points[0], points[1]) : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 < points.length ? points[i + 2] : phantomPoint(p2, p1);

    const segmentLength = distance(p1, p2);
    const steps = Math.max(1, Math.ceil(segmentLength / spacing));

    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const sample = catmullRom(p0, p1, p2, p3, t);
      const last = result[result.length - 1];
      if (distance(last, sample) >= spacing * 0.5) {
        result.push(sample);
      }
    }
  }

  return result;
}

function radiusAtPoint(prev: Point, current: Point, options: Required<StrokeOptions>): number {
  const dt = Math.max(current.t - prev.t, 1);
  const speed = distance(prev, current) / dt;
  return clamp(options.baseRadius - speed * options.velocityFactor, options.minRadius, options.maxRadius);
}

function tangentAt(points: Point[], index: number): { x: number; y: number } {
  if (points.length === 1) return { x: 1, y: 0 };

  if (index === 0) {
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  if (index === points.length - 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  const dx = points[index + 1].x - points[index - 1].x;
  const dy = points[index + 1].y - points[index - 1].y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

export function buildStrokeOutline(rawPoints: Point[], options: StrokeOptions = {}): Point[] {
  const opts = { ...DEFAULTS, ...options };
  const filtered = filterPoints(rawPoints, opts.minDistance);
  if (filtered.length === 0) return [];

  if (filtered.length === 1) {
    const p = filtered[0];
    const r = opts.baseRadius;
    const segments = 12;
    const outline: Point[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      outline.push({
        x: p.x + Math.cos(angle) * r,
        y: p.y + Math.sin(angle) * r,
        t: p.t,
      });
    }
    return outline;
  }

  const centerline = resampleCatmullRom(filtered, opts.resampleSpacing);
  const left: Point[] = [];
  const right: Point[] = [];

  for (let i = 0; i < centerline.length; i++) {
    const tangent = tangentAt(centerline, i);
    const normal = { x: -tangent.y, y: tangent.x };
    const prev = centerline[Math.max(i - 1, 0)];
    const radius = radiusAtPoint(prev, centerline[i], opts);

    left.push({
      x: centerline[i].x + normal.x * radius,
      y: centerline[i].y + normal.y * radius,
      t: centerline[i].t,
    });
    right.push({
      x: centerline[i].x - normal.x * radius,
      y: centerline[i].y - normal.y * radius,
      t: centerline[i].t,
    });
  }

  return [...left, ...right.reverse()];
}

export function drawStrokePolygon(
  ctx: CanvasRenderingContext2D,
  polygon: Point[],
  color = '#111',
) {
  if (polygon.length < 3) return;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i].x, polygon[i].y);
  }
  ctx.closePath();
  ctx.fill();
}
