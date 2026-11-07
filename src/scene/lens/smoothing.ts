const SETTLE_DISTANCE = 0.05;

export function smoothToward(current: number, target: number, dt: number, rate: number): number {
  if (dt <= 0) return target;
  const next = current + (target - current) * (1 - Math.exp(-dt * rate));
  return Math.abs(target - next) < SETTLE_DISTANCE ? target : next;
}
