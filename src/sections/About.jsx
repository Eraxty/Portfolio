export function About() {
  return (
    <section id="about" className="about-section section-chamber" aria-labelledby="about-title">
      <div className="section-number mono">03 // SUBJECT NOTES</div>
      <div className="about-layout">
        <div className="about-type">
          <h2 id="about-title">
            Not a corporate professional. More like a student with a compiler, a physics problem,
            and suspicious confidence.
          </h2>
          <p>
            I build games, interfaces, shaders, tiny tools, strange utilities and whatever idea keeps
            making noise in my head. The work moves between programming, design and creative coding.
          </p>
          <p>
            Currently fighting JEE and occasionally winning. The experiments continue anyway.
          </p>
        </div>
        <div className="photo-system" aria-label="Personal photography composition">
          <figure className="photo-main">
            <img src="/images/cowboy-fragment.webp" alt="Hardik wearing a hat on a boat, treated as monochrome editorial portrait" />
            <figcaption className="mono">PORTRAIT FRAGMENT // HAT OBSCURES IDENTITY</figcaption>
          </figure>
          <figure className="photo-slice">
            <img src="/images/boat-field.webp" alt="Hardik standing on a boat in a cropped cinematic treatment" />
            <figcaption className="mono">WATER LEVEL: UNSTABLE</figcaption>
          </figure>
          <figure className="photo-archive">
            <img src="/images/build-1.webp" alt="Childhood archive photo of Hardik on a beach" />
            <figcaption className="mono">HARDIK // BUILD 1.0</figcaption>
          </figure>
        </div>
      </div>
      <button
        className="anomaly-trigger mono"
        type="button"
        onClick={() => document.documentElement.classList.toggle('anomaly-open')}
      >
        OPEN ANOMALY FILE
      </button>
      <div className="anomaly-image" aria-hidden="true">
        <img src="/images/anomaly.webp" alt="" />
      </div>
    </section>
  );
}
