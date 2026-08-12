/**
 * The one button in this app.
 *
 * Deliberately restrictive: a label is required, and there is no icon-only
 * variant. Sizes bottom out at a 56px hit area, well above the 44px WCAG
 * target, because the people using this are frequently working on a laptop
 * trackpad with unsteady hands.
 */

import type { ReactNode } from 'react'

export type ButtonTone = 'plain' | 'primary' | 'danger'
/**
 * `compact` is for application chrome — toolbars and the top bar — where a
 * two-line label would turn a row of controls into a wall of prose. It is
 * still 44px tall, which is the WCAG 2.2 target size. Everything the user acts
 * on inside the film stays at `medium` or larger.
 */
export type ButtonSize = 'compact' | 'medium' | 'large' | 'huge'

interface ButtonProps {
  label: string
  onClick: () => void
  icon?: ReactNode
  /** A second line of smaller text explaining what the button will do. */
  hint?: string
  tone?: ButtonTone
  size?: ButtonSize
  disabled?: boolean
  /** Overrides the accessible name when the visible label needs context. */
  ariaLabel?: string
  ariaKeyShortcuts?: string
}

export function Button({
  label,
  onClick,
  icon,
  hint,
  tone = 'plain',
  size = 'medium',
  disabled = false,
  ariaLabel,
  ariaKeyShortcuts,
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn--${tone} btn--${size}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-keyshortcuts={ariaKeyShortcuts}
    >
      {icon ? <span className="btn__icon">{icon}</span> : null}
      <span className="btn__text">
        <span className="btn__label">{label}</span>
        {hint ? <span className="btn__hint">{hint}</span> : null}
      </span>
    </button>
  )
}
