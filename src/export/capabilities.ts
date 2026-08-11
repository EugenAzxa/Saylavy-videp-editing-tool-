/**
 * Can this browser actually produce an MP4?
 *
 * Checked up front and shown on the export screen rather than discovered
 * three minutes into a render. If the answer is no, the user needs to hear it
 * before they have spent an evening assembling the film.
 */

import { getFirstEncodableVideoCodec } from 'mediabunny'

export interface ExportSupport {
  supported: boolean
  /** Plain-language explanation, shown only when `supported` is false. */
  reason: string | null
  suggestion: string | null
}

export async function checkExportSupport(width: number, height: number): Promise<ExportSupport> {
  if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
    return {
      supported: false,
      reason: 'This browser cannot save video files.',
      suggestion: 'Google Chrome, Microsoft Edge and Safari can. Your work will still be here if you open this page in one of them.',
    }
  }

  // A secure context is required for WebCodecs. `localhost` counts as one, so
  // this only ever trips on a site served over plain http.
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: 'Saving is switched off because this page is not on a secure connection.',
      suggestion: 'Open the page using an address that begins with https://',
    }
  }

  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height })
  if (!codec) {
    return {
      supported: false,
      reason: 'This device cannot compress video at the chosen size.',
      suggestion: 'Try again on a newer computer, phone or browser.',
    }
  }

  return { supported: true, reason: null, suggestion: null }
}
