import { useAnnouncer } from '@/state/announce'

/**
 * A visually hidden live region. Screen readers read whatever lands here.
 *
 * `aria-live="polite"` rather than `assertive`: these messages confirm what
 * the user just did, so they should wait their turn rather than interrupting.
 */
export function Announcer() {
  const message = useAnnouncer((state) => state.message)
  const nonce = useAnnouncer((state) => state.nonce)

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {/* The key forces a remount so an identical repeated message is re-read. */}
      <span key={nonce}>{message}</span>
    </div>
  )
}
