import type { Id } from './types'

/**
 * Ids only ever need to be unique within one browser session — nothing is
 * persisted or synced — so a counter with a prefix is enough, and it makes
 * bug reports far easier to read than a UUID would ("clip_7" vs a hex blob).
 */
let counter = 0

export function newId(prefix: string): Id {
  counter += 1
  return `${prefix}_${counter}`
}
