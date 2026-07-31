import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { archiveRepos, featuredProjects, stackIndex } from '../data/projects.js';
import { ProjectDetail } from '../components/ProjectDetail.jsx';
import { PortalGate } from '../systems/portals/PortalGate.jsx';

export function Projects() {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  return (
    <section id="work" className="projects-section section-chamber" aria-labelledby="work-title">
      <div className="section-number mono">{'02 // TEST ARCHIVE'}</div>
      <div className="section-heading">
        <h2 id="work-title">Work That Escaped The Lab</h2>
        <p>
          Real public GitHub repositories, arranged as artifacts instead of achievement theater.
        </p>
      </div>
      <div className="project-archive">
        {featuredProjects.map((project, index) => (
          <article className={`project-specimen specimen-${project.accent}`} key={project.id}>
            <button type="button" onClick={() => setSelected(project)} aria-label={`Inspect ${project.name}`}>
              <span className="specimen-index mono">{project.specimen}</span>
              <span className="specimen-name">{project.name}</span>
              <span className="specimen-label mono">{project.label}</span>
              <span className="specimen-summary">{project.summary}</span>
              <span className="specimen-meta mono">{`${project.language} // UPDATED ${project.updated}`}</span>
              <span className="specimen-slab" style={{ '--shift': `${index * 9}px` }} />
            </button>
          </article>
        ))}
      </div>
      <div className="technical-index" aria-label="Technical stack index">
        {stackIndex.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="repo-conveyor">
        <p className="mono">ADDITIONAL PUBLIC REPOSITORIES</p>
        <div>
          {archiveRepos.map(([name, language, date, url]) => (
            <a href={url} key={name} target="_blank" rel="noreferrer">
              <span>{name}</span>
              <small>{language}</small>
              <small>{date}</small>
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </div>
      <PortalGate id="work-blue" color="blue" target="#about" className="section-portal work-portal" />
      <ProjectDetail project={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
