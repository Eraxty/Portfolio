export const portalStore = {
  portals: new Map(),
  listeners: new Set(),
  register(id, rect, color) {
    this.portals.set(id, { id, rect, color });
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
};
