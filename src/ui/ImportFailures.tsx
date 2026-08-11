import { useEditor } from '@/state/store'
import { Button } from './Button'
import { WarningIcon } from './Icon'

/**
 * What went wrong with the files that would not come in.
 *
 * Shown as a list rather than one message at a time, and never as a modal:
 * a dialog demanding to be dismissed before you can carry on is precisely the
 * wrong thing to put in front of someone who has just been told their
 * photographs did not load.
 */
export function ImportFailures() {
  const failures = useEditor((state) => state.failures)
  const dismiss = useEditor((state) => state.dismissFailures)

  if (failures.length === 0) return null

  return (
    <section className="failures" role="alert" aria-labelledby="failures-title">
      <h2 className="failures__title" id="failures-title">
        <WarningIcon />
        {failures.length === 1
          ? 'One file could not be added'
          : `${failures.length} files could not be added`}
      </h2>
      <ul className="failures__list">
        {failures.map((failure, index) => (
          <li key={`${failure.fileName}-${index}`}>
            <strong>{failure.fileName}</strong>
            <span>{failure.userMessage}</span>
            {failure.suggestion ? <span className="failures__hint">{failure.suggestion}</span> : null}
          </li>
        ))}
      </ul>
      <Button label="I understand" onClick={dismiss} />
    </section>
  )
}
