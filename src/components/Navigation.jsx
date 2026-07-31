const links = [
  ['INDEX', '#index'],
  ['WORK', '#work'],
  ['ABOUT', '#about'],
  ['CONTACT', '#contact'],
];

export function Navigation() {
  return (
    <header className="edge-nav">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <a className="nav-mark" href="#index" aria-label="Go to top">
        HR
      </a>
      <nav aria-label="Primary navigation">
        {links.map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
