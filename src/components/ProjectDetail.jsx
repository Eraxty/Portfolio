import { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';

export function ProjectDetail({ project, onClose }) {
  useEffect(() => {
    if (!project) return undefined;
    const close = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose, project]);

  if (!project) return null;

  return (
    <div
      className="project-detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-detail-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`detail-panel detail-${project.accent}`}>
        <button className="detail-close" type="button" onClick={onClose} aria-label="Close project detail">
          <X size={18} />
        </button>
        <p className="mono">PROJECT TEST FILE // {project.specimen}</p>
        <h3 id="project-detail-title">{project.name}</h3>
        <p className="detail-summary">{project.summary}</p>
        <ul>
          {project.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <a className="detail-link" href={project.url} target="_blank" rel="noreferrer">
          Open repository <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}
