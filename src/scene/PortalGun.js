import * as THREE from 'three';
import { portalMaterial } from './materials.js';

// The portal gun. Blue and orange portals land on the chamber's back wall wherever you shoot.
// Each one remembers the scroll position it was placed at; stepping into one drops you out of the other.
const WALL_Z = -5.93;
const COLORS = { blue: '#2f9bff', orange: '#ff7a1a' };

export class PortalGun {
  constructor(scene) {
    this.scene = scene;
    this.portals = {};
    for (const kind of ['blue', 'orange']) {
      const mat = portalMaterial(COLORS[kind]);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), mat);
      mesh.visible = false;
      mesh.renderOrder = 1;   // on the wall: draw before the title plane and the models in front
      // scorch ring left on the panels where the shot lands
      const scorch = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.26, 48),
        new THREE.MeshBasicMaterial({ color: COLORS[kind], transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
      );
      scorch.position.z = 0.01;
      mesh.add(scorch);
      const light = new THREE.PointLight(COLORS[kind], 0, 5, 2);
      light.position.z = 0.6;
      mesh.add(light);
      scene.add(mesh);
      this.portals[kind] = { kind, mesh, mat, scorch, light, placed: false, scrollY: 0, open: 0, age: 0 };
    }
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -WALL_Z);
    this.travel = null;
  }

  get both() { return this.portals.blue.placed && this.portals.orange.placed; }

  // Shoot along a ray; returns the portal if it landed.
  shoot(kind, raycaster, scrollY) {
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(this.plane, hit)) return null;
    const p = this.portals[kind];
    hit.x = THREE.MathUtils.clamp(hit.x, -9, 9);
    p.mesh.position.set(hit.x, hit.y, WALL_Z);
    p.mesh.visible = true;
    p.placed = true;
    p.scrollY = scrollY;
    p.open = 0;
    p.age = 0;
    return p;
  }

  hit(raycaster) {
    for (const p of Object.values(this.portals)) {
      if (p.placed && p.open > 0.6 && raycaster.intersectObject(p.mesh, false).length) return p;
    }
    return null;
  }

  other(p) { return this.portals[p.kind === 'blue' ? 'orange' : 'blue']; }

  // In front of a portal, close enough that it fills the screen.
  front(p, out) { return out.copy(p.mesh.position).add(new THREE.Vector3(0, 0, 0.75)); }

  enter(p) {
    if (this.travel || !this.both) return false;
    this.travel = { from: p, to: this.other(p), phase: 'in', t: 0, jumped: false };
    return true;
  }

  update(dt, t) {
    for (const p of Object.values(this.portals)) {
      if (!p.placed) continue;
      p.age += dt;
      // a quick overshoot as it snaps open
      const k = Math.min(p.age / 0.45, 1);
      p.open = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 7) : 1;
      p.mat.uniforms.uOpen.value = Math.max(0, p.open);
      p.mat.uniforms.uTime.value = t;
      p.mat.uniforms.uFill.value = this.travel && (this.travel.from === p || this.travel.to === p) ? this.travelFill : 0;
      p.scorch.scale.setScalar(1 + p.age * 6);
      p.scorch.material.opacity = Math.max(0, 0.9 - p.age * 2.2);
      p.light.intensity = 3.5 * Math.max(0, p.open);
    }
  }

  get travelFill() {
    const tr = this.travel;
    if (!tr) return 0;
    return tr.phase === 'in' ? Math.min(1, tr.t / 0.45) : Math.max(0, 1 - tr.t / 0.35);
  }
}

export const PORTAL_COLORS = COLORS;
