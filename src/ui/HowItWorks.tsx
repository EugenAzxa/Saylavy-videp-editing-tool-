/**
 * What this tool does, in four steps, before the user has committed to
 * anything.
 *
 * Written to be read once and remembered — each step is a plain instruction
 * naming the exact words on the buttons it refers to, so someone can match
 * what they read here to what they see later. No screenshots: they go stale,
 * and they do not survive a screen reader.
 */

const STEPS = [
  {
    title: 'Put your videos and photographs in',
    body: 'Choose them from this computer, or drag them onto the page. They are added one after another, in the order you pick them.',
  },
  {
    title: 'Find the moment you care about',
    body: 'Press Play to watch, or slide the blue dot along the bar until the picture shows the moment you want.',
  },
  {
    title: 'Cut away what you do not need',
    body: '“Cut here” splits the film into two pieces at that moment. Then choose a piece and remove it, or move it earlier or later.',
  },
  {
    title: 'Save the finished film',
    body: 'Give it a name and press save. It goes into this computer’s Downloads folder, ready to play or pass on.',
  },
]

export function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-title">
      <h2 className="how__title" id="how-title">
        How it works
      </h2>

      <ol className="how__list">
        {STEPS.map((step, index) => (
          <li className="how__step" key={step.title}>
            <span className="how__number" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h3 className="how__step-title">{step.title}</h3>
              <p className="how__body">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="how__reassure">
        Nothing you do here is permanent. <strong>Undo</strong> is at the top of the page and takes
        back anything, as many times as you need.
      </p>
    </section>
  )
}
