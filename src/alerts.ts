export function fireAlert(orderId: string): void {
  // In production: enqueue to support ticket system.
  // A polling job picks up NeedsAttention orders on a ~10s interval.
  console.warn(`[ALERT] Order ${orderId} requires manual attention`)
}
