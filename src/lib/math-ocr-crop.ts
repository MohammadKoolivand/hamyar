import type { MathCrop } from "../server/imports/math-ocr";
export interface PercentPoint { x: number; y: number }
const bounded = (value: number) => Math.max(0, Math.min(100, value));
export function percentPointFromPointer(
  x: number, y: number, bounds: { left: number; top: number; width: number; height: number },
): PercentPoint {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
  return {
    x: bounded(100 * (x - bounds.left) / bounds.width),
    y: bounded(100 * (y - bounds.top) / bounds.height),
  };
}
/** Normalized top-left crop regardless of drag direction. */
export function cropFromDrag(start: PercentPoint, end: PercentPoint): MathCrop {
  const x1 = bounded(start.x), x2 = bounded(end.x);
  const y1 = bounded(start.y), y2 = bounded(end.y);
  return {
    x: Math.round(Math.min(x1, x2) * 100) / 100,
    y: Math.round(Math.min(y1, y2) * 100) / 100,
    width: Math.round(Math.abs(x2 - x1) * 100) / 100,
    height: Math.round(Math.abs(y2 - y1) * 100) / 100,
  };
}
export function selectableMathCrop(crop: MathCrop): boolean {
  return crop.x >= 0 && crop.y >= 0 &&
    crop.width >= 3 && crop.height >= 2 &&
    crop.x + crop.width <= 100 && crop.y + crop.height <= 100 &&
    crop.width * crop.height <= 6500;
}
