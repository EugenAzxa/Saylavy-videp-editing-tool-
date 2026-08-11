/**
 * Icons.
 *
 * Every icon in this app is paired with a written label — never on its own.
 * Icon-only buttons are a common way to make an interface unusable for someone
 * who has not spent twenty years learning what a floppy disk means, and this
 * app's users have better things to be thinking about. The icons are here to
 * make the labels quicker to find, not to replace them.
 *
 * Drawn at 24×24 on a 2px stroke so they stay legible when scaled up.
 */

interface IconProps {
  /** Multiplier on the base 24px size. */
  size?: number
}

function svgProps(size: number) {
  return {
    width: 24 * size,
    height: 24 * size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }
}

export function PlayIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PauseIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function RewindIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M19 5v14L9 12l10-7Z" fill="currentColor" stroke="none" />
      <path d="M5 5v14" />
    </svg>
  )
}

export function CutIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 7.5 19 18M8 16.5 19 6" />
    </svg>
  )
}

export function TrashIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function ArrowLeftIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  )
}

export function ArrowRightIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function UndoIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 8h11a5 5 0 0 1 0 10H9" />
      <path d="M8 4 4 8l4 4" />
    </svg>
  )
}

export function RedoIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M20 8H9a5 5 0 0 0 0 10h6" />
      <path d="m16 4 4 4-4 4" />
    </svg>
  )
}

export function PlusIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function SaveIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function TrimStartIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M5 4v16" />
      <rect x="9" y="7" width="11" height="10" rx="2" fill="currentColor" stroke="none" opacity="0.85" />
    </svg>
  )
}

export function TrimEndIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M19 4v16" />
      <rect x="4" y="7" width="11" height="10" rx="2" fill="currentColor" stroke="none" opacity="0.85" />
    </svg>
  )
}

export function SunIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </svg>
  )
}

export function MoonIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5Z" />
    </svg>
  )
}

export function SparkIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 10.9 10.1 9 12 3.5Z" />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </svg>
  )
}

export function WarningIcon({ size = 1 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}
