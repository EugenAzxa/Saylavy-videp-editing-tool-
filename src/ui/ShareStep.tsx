import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { announce } from '@/state/announce'
import { Button } from './Button'

/**
 * The share step, shown once a film has been exported.
 *
 * **This is a demonstration.** No film is uploaded anywhere and the link does
 * not resolve — the whole product is built on nothing leaving the device, so
 * a working share link would need a hosting decision that has not been taken.
 * See docs/ROADMAP.md.
 *
 * It is built rather than mocked up in a slide because the QR code is real: it
 * genuinely encodes the address shown, and it genuinely downloads as a PNG you
 * could put on an order of service or a plaque. That makes it a useful
 * demonstration of the idea instead of a picture of one.
 *
 * The "not live yet" notice is load-bearing and must not be quietly removed to
 * make a screenshot tidier. Someone scanning a code that goes nowhere, at a
 * funeral, is precisely the failure this app exists to avoid.
 */

/** Where links will live if this is ever built for real. */
const LINK_BASE = 'https://saylavy.pro/f'

function makeReference(): string {
  // Eight hex characters, which is the shape a real short link would take.
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function ShareStep({ filename }: { filename: string }) {
  const [reference] = useState(makeReference)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const link = `${LINK_BASE}/${reference}`

  useEffect(() => {
    let live = true
    void QRCode.toDataURL(link, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1120', light: '#ffffff' },
    })
      .then((url) => {
        if (live) setQr(url)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [link])

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      announce('Link copied.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      announce('The link could not be copied. You can select it and copy it by hand.')
    }
  }

  function downloadQr() {
    if (!qr) return
    const link_ = document.createElement('a')
    link_.href = qr
    link_.download = `${filename.replace(/\.mp4$/i, '')} QR.png`
    link_.click()
    announce('QR code image saved.')
  }

  return (
    <section className="share">
      <div className="share__head">
        <h3 className="share__title">Share with a code</h3>
        <span className="share__tag">Preview</span>
      </div>

      <p className="share__lead">
        The idea: a code on the order of service or the plaque, so anyone can watch the film later.
      </p>

      <div className="share__body">
        <div className="share__qr">
          {qr ? <img src={qr} alt={`QR code for ${link}`} /> : <span className="share__qr-wait" />}
        </div>

        <div className="share__side">
          <label className="share__link-label" htmlFor="share-link">
            Link
          </label>
          <input id="share-link" className="ifield" type="text" readOnly value={link} />

          <div className="share__buttons">
            <Button
              label={copied ? 'Copied' : 'Copy link'}
              size="compact"
              onClick={() => void copy()}
            />
            <Button label="Save QR code" size="compact" disabled={!qr} onClick={downloadQr} />
          </div>
        </div>
      </div>

      <p className="share__warning">
        <strong>Not live yet.</strong> Nothing has been uploaded and this address does not open
        anything. Hosting films would mean keeping them on a server, which is the one thing this
        tool currently promises not to do — so it is a decision for Saylavy, not a switch to flip.
      </p>
    </section>
  )
}
