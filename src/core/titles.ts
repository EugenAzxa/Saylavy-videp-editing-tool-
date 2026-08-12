/**
 * Text cards: the fonts on offer and the presets behind them.
 *
 * Every face here is one the operating system already has. Nothing is
 * downloaded, for two reasons that both matter: a request to a font CDN would
 * tell a third party that someone is using a funeral tool, and canvas has to
 * be able to draw the face synchronously at export time — a webfont that has
 * not finished loading silently renders as the fallback, and the file the
 * family receives is not the one they approved.
 *
 * The names are what the user sees. "Georgia" means nothing to most people;
 * "Classic" does.
 */

import type { TitleSpec } from './types'

export interface FontChoice {
  id: string
  /** Shown to the user. */
  name: string
  /** A CSS font stack, used identically by the preview and the export. */
  stack: string
}

export const FONTS: FontChoice[] = [
  { id: 'classic', name: 'Classic', stack: "Georgia, 'Times New Roman', Times, serif" },
  {
    id: 'elegant',
    name: 'Elegant',
    stack: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
  },
  { id: 'simple', name: 'Simple', stack: "'Segoe UI', Helvetica, Arial, sans-serif" },
  {
    id: 'modern',
    name: 'Modern',
    stack: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif",
  },
  { id: 'typewriter', name: 'Typewriter', stack: "'Courier New', Courier, monospace" },
]

export const DEFAULT_FONT_ID = 'classic'

export function fontStack(fontId: string): string {
  return (FONTS.find((font) => font.id === fontId) ?? FONTS[0]!).stack
}

/** Ready-made looks, so nobody has to operate a colour picker to get a good one. */
export interface TitleStyle {
  id: string
  name: string
  color: string
  background: string
}

export const TITLE_STYLES: TitleStyle[] = [
  { id: 'ink', name: 'White on black', color: '#ffffff', background: '#000000' },
  { id: 'paper', name: 'Black on ivory', color: '#1a1a1a', background: '#f4f1ea' },
  { id: 'night', name: 'White on navy', color: '#ffffff', background: '#0b1120' },
  { id: 'warm', name: 'Cream on brown', color: '#f6ead6', background: '#2e1f16' },
]

export const MAX_TITLE_LINES = 3

/** A full-screen card, for a clip with no footage behind it. */
export function newTitle(lines: string[] = ['In loving memory', '']): TitleSpec {
  const style = TITLE_STYLES[0]!
  return {
    lines: lines.slice(0, MAX_TITLE_LINES),
    fontId: DEFAULT_FONT_ID,
    color: style.color,
    background: style.background,
    placement: 'card',
  }
}

/**
 * Words over footage. Always white, because the picture underneath is unknown
 * and white on a dark scrim is the one combination that survives any of it.
 */
export function newOverlay(lines: string[] = ['', '']): TitleSpec {
  return {
    lines: lines.slice(0, MAX_TITLE_LINES),
    fontId: DEFAULT_FONT_ID,
    color: '#ffffff',
    background: '#000000',
    placement: 'bottom',
  }
}

/** Blank lines are dropped so a half-filled card still sits centred. */
export function visibleLines(title: TitleSpec): string[] {
  return title.lines.map((line) => line.trim()).filter((line) => line.length > 0)
}
