import type { Priority } from './types'

export const PRIORITIES: readonly Priority[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH']

export const PRIORITY_LABEL: Record<Priority, string> = {
  NONE: 'None',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

/** Keyboard shortcut digits 0/1/2/3 → priority. */
export const PRIORITY_BY_DIGIT: Record<string, Priority> = {
  '0': 'NONE',
  '1': 'LOW',
  '2': 'MEDIUM',
  '3': 'HIGH',
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as string[]).includes(value)
}
