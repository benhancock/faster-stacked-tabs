export function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function calculateAnimationProgress(
  now: number,
  startTime: number,
  duration: number
): number {
  return clamp((now - startTime) / duration, 0, 1);
}
