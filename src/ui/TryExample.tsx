import { useState } from 'react'
import { createExampleFilm } from '@/media/exampleFilm'
import { announce } from '@/state/announce'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { SparkIcon } from './Icon'

/**
 * "Try it with an example film."
 *
 * The single most useful thing on the empty screen. Someone opening this for
 * the first time is holding footage they cannot replace, and learning what
 * "Cut here" does by pressing it on their mother's last birthday is a
 * frightening way to start. Three throwaway clips remove that risk entirely.
 */
export function TryExample() {
  const addFiles = useEditor((state) => state.addFiles)
  const [state, setState] = useState<'idle' | 'making' | 'failed'>('idle')
  const [made, setMade] = useState(0)

  async function build() {
    setState('making')
    setMade(0)
    announce('Making an example film. This takes a moment.')

    try {
      const files = await createExampleFilm(({ done }) => setMade(done))
      await addFiles(files)
      setState('idle')
      announce('The example film is ready. It has three pieces you can practise on.')
    } catch {
      setState('failed')
      announce('The example could not be made in this browser.')
    }
  }

  if (state === 'failed') {
    return (
      <p className="dropzone__hint">
        The example could not be made in this browser, but your own videos will still work.
      </p>
    )
  }

  return (
    <>
      <Button
        label={state === 'making' ? `Making the example… ${made} of 3` : 'Try it with an example film'}
        hint={state === 'making' ? 'Just a moment' : 'Practise on something that does not matter'}
        icon={<SparkIcon />}
        size="large"
        disabled={state === 'making'}
        onClick={() => void build()}
      />
      <p className="dropzone__hint">
        Three short clips appear, and you can cut them about as much as you like.
      </p>
    </>
  )
}
