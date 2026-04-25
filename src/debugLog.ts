// In-memory lock event log for development debugging only.
// Resets on server restart. Never import this from production code paths.

export type LockEventType = 'claimed' | 'released' | 'conflict'

export interface LockEvent {
  type: LockEventType
  orderId: string
  conflictReason?: 'not_found' | 'conflict'
  timestamp: string
}

const lockEvents: LockEvent[] = []

export function logLockEvent(event: Omit<LockEvent, 'timestamp'>): void {
  lockEvents.push({ ...event, timestamp: new Date().toISOString() })
}

export function getLockEvents(): LockEvent[] {
  return [...lockEvents]
}

export function clearLockEvents(): void {
  lockEvents.length = 0
}
