import { announce } from '@/state/announce'
import { useTheme } from '@/state/theme'
import { Button } from './Button'
import { MoonIcon, SunIcon } from './Icon'

/**
 * Switches between the dark brand look and the lighter, higher-legibility one.
 *
 * The label names the theme you will GET, not the one you are in — "Light
 * screen" reads as an offer rather than a status, which is the difference
 * between a control someone tries and one they puzzle over.
 */
export function ThemeToggle() {
  const theme = useTheme((state) => state.theme)
  const toggle = useTheme((state) => state.toggle)
  const goingLight = theme === 'dark'

  return (
    <Button
      label={goingLight ? 'Light screen' : 'Dark screen'}
      hint={goingLight ? 'Easier to read' : 'Easier on the eyes'}
      icon={goingLight ? <SunIcon /> : <MoonIcon />}
      ariaLabel={goingLight ? 'Switch to the light screen' : 'Switch to the dark screen'}
      onClick={() => {
        toggle()
        announce(goingLight ? 'Light screen.' : 'Dark screen.')
      }}
    />
  )
}
