export const portalStore = {
  portals: new Map(),
  listeners: new Set(),
  cooldownUntil: 0,
  register(id, rect, color, element, target = null) {
    this.portals.set(id, { id, rect, color, element, target });
    this.listeners.forEach((listener) => listener(this.portals));
  },
  unregister(id) {
    this.portals.delete(id);
    this.listeners.forEach((listener) => listener(this.portals));
  },
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.portals);
    return () => this.listeners.delete(listener);
  },
  visiblePortals() {
    return [...this.portals.values()].filter((portal) => {
      if (!portal.rect) return false;
      return (
        portal.rect.bottom > -80 &&
        portal.rect.top < window.innerHeight + 80 &&
        portal.rect.right > -80 &&
        portal.rect.left < window.innerWidth + 80
      );
    });
  },
  destinationFor(source) {
    const visible = this.visiblePortals().filter((portal) => portal.id !== source.id);
    return (
      visible.find((portal) => portal.color !== source.color) ||
      [...this.portals.values()].find((portal) => portal.id !== source.id && portal.color !== source.color) ||
      [...this.portals.values()].find((portal) => portal.id !== source.id) ||
      null
    );
  },
  requestTransition(sourceId, options = {}) {
    const now = performance.now();
    if (!options.force && now < this.cooldownUntil) return false;

    const source = this.portals.get(sourceId);
    if (!source) return false;

    const destination = this.destinationFor(source);
    if (!destination) return false;

    this.cooldownUntil = now + (options.force ? 520 : 860);
    window.dispatchEvent(new CustomEvent('portal-transition', {
      detail: {
        source: source.id,
        destination: destination.id,
        color: source.color,
        target: source.target || destination.target || null,
        point: options.point || null,
        force: Boolean(options.force),
      },
    }));
    return true;
  },
};
