import { Skia, SkPath } from '@shopify/react-native-skia';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  width: number;
  tool: PenTool;
  path?: string; // serialized SVG path for storage
}

export type PenTool = 'ballpoint' | 'fountain' | 'marker' | 'pencil';

export interface PenConfig {
  tool: PenTool;
  color: string;
  width: number;
  opacity: number;
}

export const PEN_DEFAULTS: Record<PenTool, Omit<PenConfig, 'color'>> = {
  ballpoint: { tool: 'ballpoint', width: 2, opacity: 1 },
  fountain: { tool: 'fountain', width: 3, opacity: 1 },
  marker: { tool: 'marker', width: 12, opacity: 0.6 },
  pencil: { tool: 'pencil', width: 2, opacity: 0.8 },
};

// Catmull-Rom spline → cubic Bezier path
export function buildSkiaPath(points: StrokePoint[], tool: PenTool, baseWidth: number): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;
  if (points.length === 1) {
    path.addCircle(points[0].x, points[0].y, getStrokeWidth(tool, baseWidth, points[0].pressure) / 2);
    return path;
  }

  path.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    path.lineTo(points[1].x, points[1].y);
    return path;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  return path;
}

export function getStrokeWidth(tool: PenTool, baseWidth: number, pressure: number): number {
  const p = Math.max(0.1, Math.min(1, pressure));
  switch (tool) {
    case 'fountain':
      return baseWidth * (0.5 + p * 1.5); // strong pressure sensitivity
    case 'ballpoint':
      return baseWidth * (0.8 + p * 0.4); // mild variation
    case 'marker':
      return baseWidth; // flat
    case 'pencil':
      return baseWidth * (0.6 + p * 0.8);
    default:
      return baseWidth;
  }
}

export function serializeStrokes(strokes: Stroke[]): string {
  return JSON.stringify(strokes.map(s => ({
    ...s,
    path: undefined, // don't store prebuilt path
  })));
}

export function deserializeStrokes(raw: string): Stroke[] {
  try {
    return JSON.parse(raw) as Stroke[];
  } catch {
    return [];
  }
}
