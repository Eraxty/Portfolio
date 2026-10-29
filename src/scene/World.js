import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, NoiseEffect, VignetteEffect,
  ChromaticAberrationEffect, ToneMappingEffect, ToneMappingMode, BlendFunction, SMAAEffect,
} from 'postprocessing';
import { panelMaterial, portalMaterial } from './materials.js';
import { Wheatley } from './Wheatley.js';
import { Glados } from './Glados.js';
import { CubeRig } from './CubeRig.js';
import { PortalGun, PORTAL_COLORS } from './PortalGun.js';

const FOV = 35;
const lerp = THREE.MathUtils.lerp;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// World layout (y descends as you scroll)
const Y = { hero: 0, statement: -3.2, portal: -4.6, work: -9, lab: -14, subject: -20.5, contact: -28 };
const CONTACT = { floor: Y.contact - 1.95, ceil: Y.contact + 1.7, x: 2.1 };

export class World {
  constructor(canvas, { reduced, mobile }) {
    this.canvas = canvas;
    this.reduced = reduced;
    this.mobile = mobile;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerSmooth = new THREE.Vector2(0, 0);
    this.scroll = 0;
    this.velocity = 0;
    this.anchors = [];
    this.raycaster = new THREE.Raycaster();
    this.listeners = {};
    this.transit = 0;

    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, stencil: false, depth: true, powerPreference: 'high-performance',
    }));
    // adaptive resolution: start high, step down if frames run long, creep back up when there is headroom
    this.dprMax = Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75);
    this.dprMin = mobile ? 0.75 : 1;
    this.dpr = this.dprMax;
    this.frameTimes = [];
    this.adaptAt = 0;
    r.setPixelRatio(this.dpr);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.setClearColor('#0a0a0b');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a0a0b');
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 80);
    this.camera.position.set(0, 0, 6.2);
    this.scene.add(this.camera);

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.#lights();
    this.#chamber();
    this.#composer();
    this.gun = new PortalGun(this.scene);
    this.flashColor = PORTAL_COLORS.blue;
    this.travelFlash = 0;
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, ...a) { (this.listeners[name] || []).forEach((fn) => fn(...a)); }

  #lights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#bcc6d6', '#0a0a0b', 0.35));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(2, 4, 6);
    s.add(key);
    this.rimO = new THREE.PointLight('#ff7a1a', 30, 14, 2);
    this.rimB = new THREE.PointLight('#2f9bff', 30, 14, 2);
    s.add(this.rimO, this.rimB);
  }

  #chamber() {
    // back wall and a pair of side walls, receding into fog
    this.wallMat = panelMaterial({ tile: 1.5 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 70), this.wallMat);
    wall.position.set(0, -14, -6);
    this.scene.add(wall);

    const floorMat = panelMaterial({ tile: 1.1, base: '#101012', seam: '#24242a', floor: true });
    floorMat.uniforms.uFogNear.value = 4;
    floorMat.uniforms.uFogFar.value = 18;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, CONTACT.floor, -2);
    this.scene.add(floor);
    this.floorMat = floorMat;

    // management rails: thin bars at different depths for parallax, each with a light strip
    const railMat = new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: 0.7, roughness: 0.35 });
    const stripMat = new THREE.MeshBasicMaterial({ color: '#8a8a90', toneMapped: false });
    const rails = new THREE.Group();
    const rnd = mulberry(7);
    for (let i = 0; i < 14; i++) {
      const y = 2 - i * 2.4 - rnd() * 1.2;
      const z = -1.5 - rnd() * 4;
      const len = 6 + rnd() * 10;
      const x = (rnd() - 0.5) * 12;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), railMat);
      bar.position.set(x, y, z);
      rails.add(bar);
      if (rnd() > 0.6 && z < -3) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(len * (0.15 + rnd() * 0.2), 0.01, 0.01), stripMat);
        strip.position.set(x + (rnd() - 0.5) * len * 0.4, y - 0.05, z + 0.04);
        rails.add(strip);
      }
    }
    this.scene.add(rails);

    // dust in the light
    const n = this.mobile ? 500 : 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 16;
      pos[i * 3 + 1] = 4 - rnd() * 40;
      pos[i * 3 + 2] = -5 + rnd() * 9;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({
      color: '#9aa0aa', size: 0.018, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false,
    }));
    this.scene.add(this.dust);

    // the blue portal we fall through after the statement
    this.portal = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), portalMaterial('#2f9bff'));
    this.portal.position.set(0, Y.portal, -2.2);
    this.scene.add(this.portal);
    // the orange exit ring, glued to the camera
    this.exit = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), portalMaterial('#ff7a1a'));
    this.exit.material.uniforms.uOpen.value = 1;
    this.exit.position.z = -1;
    this.exit.renderOrder = 10;
    this.exit.material.depthTest = false;
    this.camera.add(this.exit);
  }

  #composer() {
    const c = (this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType }));
    c.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new BloomEffect({ intensity: 1.15, luminanceThreshold: 0.72, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.75, resolutionScale: 0.5 });
    this.ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0), radialModulation: true, modulationOffset: 0.25 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = 0.09;
    const vignette = new VignetteEffect({ darkness: 0.62, offset: 0.28 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    c.addPass(new EffectPass(this.camera, this.bloom, tone));
    if (!this.mobile) c.addPass(new EffectPass(this.camera, new SMAAEffect()));
    c.addPass(new EffectPass(this.camera, this.ca, vignette, noise));
  }

  async load(onProgress) {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_u, done, total) => onProgress?.(done / total);
    const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
    const [w, g, c] = await Promise.all([
      loader.loadAsync('/models/wheatley.glb'),
      loader.loadAsync('/models/glados.glb'),
      loader.loadAsync('/models/cube.glb'),
    ]);
    await this.#title();

    this.wheatley = new Wheatley(w);
    this.scene.add(this.wheatley.root);
    // cheap invisible hit shapes: raycasting a skinned mesh every few frames is not free
    const ghost = new THREE.MeshBasicMaterial({ visible: false });
    this.wheatleyHit = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), ghost);
    this.wheatley.root.add(this.wheatleyHit);

    this.glados = new Glados(g);
    this.glados.root.position.set(3.1, Y.subject + 5.7, -0.8);
    this.glados.root.rotation.y = -0.55;
    this.scene.add(this.glados.root);
    this.gladosHit = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.6, 10), ghost);
    this.gladosHit.position.set(-0.2, -3.9, 0);
    this.glados.root.add(this.gladosHit);

    this.cubeRig = new CubeRig(c, { floorY: CONTACT.floor, ceilY: CONTACT.ceil });
    this.cubeRig.root.position.x = CONTACT.x;
    this.cubeRig.onLand = (loops) => this.emit('cube-land', loops);
    this.cubeRig.onPass = () => this.emit('cube-pass');
    this.scene.add(this.cubeRig.root);

    // compile everything once so the first scroll does not hitch
    this.renderer.compile(this.scene, this.camera);
  }

  // Name drawn into the scene so Wheatley can sit in front of it.
  async #title() {
    try { await document.fonts.load('850 200px Archivo'); } catch { /* fallback font */ }
    const cv = document.createElement('canvas');
    const W = 2400, H = 1000;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    if ('fontStretch' in ctx) ctx.fontStretch = 'expanded';
    ctx.fillStyle = '#ecece6';
    ctx.textBaseline = 'alphabetic';
    const lines = ['HARDIK', 'RAJOTIYA'];
    let size = 400;
    ctx.font = `850 ${size}px Archivo, sans-serif`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    size = Math.floor(size * (W * 0.98) / widest);
    ctx.font = `850 ${size}px Archivo, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${-size * 0.045}px`;
    const lh = size * 0.86;
    const top = (H - lh * 2) / 2 + size * 0.78;
    lines.forEach((l, i) => {
      ctx.fillText(l, 0, top + i * lh);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.titleMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(0.62, 0.62, 0.6) });
    this.title = new THREE.Mesh(new THREE.PlaneGeometry(1, H / W), this.titleMat);
    this.title.position.set(0, 0.05, -1.8);
    this.title.renderOrder = 4;
    this.scene.add(this.title);
  }

  // Scroll anchors come from the DOM so the 3D always lines up with the sections.
  measure(sections) {
    const vh = window.innerHeight;
    const top = (el) => el.getBoundingClientRect().top + window.scrollY;
    const st = sections.statement;
    const portalAt = top(st) + st.offsetHeight - vh;
    const max = document.documentElement.scrollHeight - vh;
    const portrait = this.camera.aspect < 0.9;
    const wx = portrait ? 0.55 : 1;
    const HIDE = portrait ? 2.6 : 1.6;
    // phones: Wheatley gets out of the way of the timing tower and the copy; set pieces move to centre
    const wWork = portrait ? [HIDE, 0.7, 6.4, 0.3] : [0.74, 0.62, 6.4, 0.42];
    const wLab = portrait ? [-HIDE, 0.7, 6.6, 0.3] : [-0.78, 0.66, 6.6, 0.4];
    const wContact = portrait ? [-0.5, 0.8, 6.4, 0.36] : [0.62, 0.55, 6.4, 0.42];
    const wEnd = portrait ? [-0.55, 0.62, 6.4, 0.3] : [0.36, 0.5, 6.4, 0.45];
    const camEnd = portrait ? [0.4, Y.contact - 1.0, 9.4] : [0.6, Y.contact, 7];
    const lookEnd = portrait ? [0.4, Y.contact - 2.65, 0] : [1.2, Y.contact - 0.5, 0];
    this.anchors = [
      { at: 0, cam: [0, Y.hero, 6.2], look: [0, Y.hero, 0], w: portrait ? [0, 0.42, 5.2, 0.5] : [0.56, -0.04, 5.2, 0.6] },
      { at: top(st) * 0.9, cam: [0, Y.statement + 0.4, 6.6], look: [0, Y.statement, 0], w: [-0.62 * wx, 0.55, 6.4, 0.55] },
      { at: portalAt - vh * 0.35, cam: [0, Y.portal, 4.4], look: [0, Y.portal, -2.2], w: [-0.62 * wx, 0.55, 6.4, 0.55] },
      { at: portalAt, cam: [0, Y.portal, -1.65], look: [0, Y.portal, -6], w: [-0.62 * wx, 0.55, 6.4, 0.55], into: true },
      { at: portalAt + 1, cam: [0, Y.work + 0.6, 6.4], look: [0, Y.work + 0.3, 0], w: wWork, out: true },
      { at: top(sections.lab) - vh * 0.2, cam: [0, Y.work - 1.6, 6.8], look: [0, Y.work - 1.8, 0], w: wWork },
      { at: top(sections.lab) + vh * 0.4, cam: [0, Y.lab, 6.8], look: [0, Y.lab, 0], w: wLab },
      { at: top(sections.subject), cam: [0, Y.subject + 1.2, 7.2], look: [0.6, Y.subject + 1.6, 0], w: [-HIDE, 0.5, 6.6, 0.4] },
      { at: top(sections.subject) + sections.subject.offsetHeight * 0.55, cam: [-0.4, Y.subject - 1.5, 7.2], look: [0.6, Y.subject - 1.2, 0], w: [-HIDE, 0.4, 6.6, 0.4] },
      { at: top(sections.contact) + vh * 0.3, cam: [0.4, Y.contact + 0.3, 7.4], look: [0.8, Y.contact - 0.4, 0], w: wContact },
      { at: max, cam: camEnd, look: lookEnd, w: wEnd },
    ];
    if (this.glados) {
      // right third of the screen at her depth, whatever the window width
      const halfW = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 8 * this.camera.aspect;
      this.glados.root.position.x = portrait ? 0.7 : Math.min(3.1, halfW * 1.02);
      this.glados.root.scale.setScalar(portrait ? 0.62 : 1);
    }
    if (this.cubeRig) this.cubeRig.root.position.x = portrait ? 0.55 : CONTACT.x;
    if (this.title) this.title.position.y = portrait ? -0.75 : 0.05;
    this.contactAt = top(sections.contact);
    this.portalAt = portalAt;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.title) {
      // fill ~94% of the screen width at the title's depth
      const d = 6.2 - this.title.position.z;
      const vw = 2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * this.camera.aspect;
      const vhh = 2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      // desktop: left-aligned in the gutter, Wheatley holds the right third; portrait: full width under him
      const portrait = this.camera.aspect < 0.9;
      const s = portrait ? Math.min(vw * 0.94, vhh * 1.6) : Math.min(vw * 0.66, vhh * 1.45);
      this.title.scale.set(s, s, 1);
      const gutter = (Math.min(56, Math.max(16, w * 0.04)) / w) * vw;
      this.titleBaseX = portrait ? 0 : -vw / 2 + gutter + s / 2;
    }
  }

  #sample(y) {
    const a = this.anchors;
    if (!a.length) return null;
    if (y <= a[0].at) return { ...a[0], t: 0, i: 0 };
    for (let i = 0; i < a.length - 1; i++) {
      if (y < a[i + 1].at) {
        const t = clamp01((y - a[i].at) / Math.max(1, a[i + 1].at - a[i].at));
        return { i, t, from: a[i], to: a[i + 1] };
      }
    }
    return { ...a[a.length - 1], t: 1, i: a.length - 1 };
  }

  #screenToWorld(sx, sy, d, out) {
    // a point at normalised screen coords (sx, sy) and distance d in front of the camera
    const h = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * d;
    out.set(sx * h * this.camera.aspect, sy * h, -d);
    return out.applyMatrix4(this.camera.matrixWorld);
  }

  setPointer(nx, ny) {
    this.pointer.set(nx, ny);
    this.wheatley?.nudge();
  }

  // What did the visitor click? Things first, then portals; empty wall is the caller's to shoot at.
  click(nx, ny) {
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    if (this.cubeRig && this.cubeRig.cube.visible && this.cubeRig.hit(this.raycaster)) {
      this.cubeRig.toggleLoop();
      this.emit('cube-click', this.cubeRig.state);
      return 'cube';
    }
    if (this.wheatley && this.raycaster.intersectObject(this.wheatleyHit, false).length) {
      this.wheatley.poke();
      this.emit('wheatley-poke');
      return 'wheatley';
    }
    if (this.glados && this.gladosNear && this.raycaster.intersectObject(this.gladosHit, false).length) {
      this.glados.poke?.();
      this.emit('glados-poke');
      return 'glados';
    }
    const portal = this.gun.hit(this.raycaster);
    if (portal) {
      if (this.gun.enter(portal)) this.emit('portal-enter', portal.kind);
      else this.emit('portal-alone', portal.kind);
      return 'portal';
    }
    return null;
  }

  shoot(kind, nx, ny, scrollY) {
    if (this.gun.travel) return null;
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const p = this.gun.shoot(kind, this.raycaster, scrollY);
    if (p) this.emit('portal-placed', kind, this.gun.both);
    return p;
  }

  hoverTarget(nx, ny) {
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const objs = [this.wheatleyHit, this.cubeRig?.cube.visible && this.cubeRig.hitBox, this.gladosNear && this.gladosHit,
      ...Object.values(this.gun.portals).filter((p) => p.placed).map((p) => p.mesh)].filter(Boolean);
    return this.raycaster.intersectObjects(objs, false).length > 0;
  }

  #adapt(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    let next = this.dpr;
    if (avg > 1 / 45 && this.dpr > this.dprMin) next = Math.max(this.dprMin, this.dpr - 0.25);
    else if (avg < 1 / 75 && this.dpr < this.dprMax) next = Math.min(this.dprMax, this.dpr + 0.125);
    if (next !== this.dpr) {
      this.dpr = next;
      this.renderer.setPixelRatio(next);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  update(dt, t, scrollY, velocity, speed01) {
    this.velocity = lerp(this.velocity, velocity, 0.1);
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 6));
    const s = this.#sample(scrollY);
    if (!s) return;

    const cam = new THREE.Vector3();
    const look = new THREE.Vector3();
    let w;
    if (s.from) {
      const into = s.to.into;
      const e = into ? Math.pow(s.t, 2.2) : s.to.out ? s.t : easeInOut(s.t);
      cam.fromArray(s.from.cam).lerp(new THREE.Vector3().fromArray(s.to.cam), e);
      look.fromArray(s.from.look).lerp(new THREE.Vector3().fromArray(s.to.look), e);
      w = s.from.w.map((v, k) => lerp(v, s.to.w[k], easeInOut(s.t)));
    } else {
      cam.fromArray(s.cam);
      look.fromArray(s.look);
      w = s.w;
    }

    // pointer parallax
    const px = this.pointerSmooth.x;
    const py = this.pointerSmooth.y;
    cam.x += px * 0.18;
    cam.y += py * 0.1;

    // portal travel: dive into one portal, jump the page, burst out of the other
    const tr = this.gun.travel;
    this.travelFlash = 0;
    if (tr) {
      tr.t += dt;
      const front = new THREE.Vector3();
      if (tr.phase === 'in') {
        const k = Math.min(tr.t / 0.5, 1);
        const e = k * k * k;
        cam.lerp(this.gun.front(tr.from, front), e);
        look.lerp(tr.from.mesh.position, e);
        this.travelFlash = smooth(Math.max(0, (k - 0.6) / 0.4));
        this.flashColor = PORTAL_COLORS[tr.from.kind];
        if (k >= 1) {
          tr.phase = 'out';
          tr.t = 0;
          this.emit('portal-jump', tr.to.scrollY, tr.to.kind);
        }
      } else {
        const k = Math.min(tr.t / 0.85, 1);
        const e = 1 - Math.pow(1 - k, 3);
        const start = this.gun.front(tr.to, front);
        cam.copy(start.lerp(cam, e));
        look.copy(tr.to.mesh.position.clone().lerp(look, e));
        this.travelFlash = 1 - smooth(Math.min(1, k * 2.5));
        this.flashColor = PORTAL_COLORS[tr.to.kind];
        if (k >= 1) this.gun.travel = null;
      }
    }
    this.gun.update(dt, t);

    this.camera.position.copy(cam);
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();

    // portal transit
    const pu = this.portal.material.uniforms;
    const toPortal = this.portalAt ? clamp01((scrollY - (this.portalAt - window.innerHeight * 1.3)) / (window.innerHeight * 0.95)) : 0;
    pu.uOpen.value = smooth(toPortal);
    pu.uFill.value = clamp01((scrollY - (this.portalAt - window.innerHeight * 0.3)) / (window.innerHeight * 0.3));
    pu.uTime.value = t;
    const after = clamp01((scrollY - this.portalAt) / (window.innerHeight * 0.7));
    const xu = this.exit.material.uniforms;
    xu.uTime.value = t;
    if (tr && tr.phase === 'out') {
      const k = Math.min(tr.t / 0.85, 1);
      xu.uColor.value.set(PORTAL_COLORS[tr.to.kind]);
      this.exit.visible = true;
      const es2 = 1.6 + Math.pow(k, 1.2) * 10;
      this.exit.scale.set(es2, es2, 1);
      xu.uFill.value = 1 - smooth(Math.min(1, k * 2.4));
      this.transit = this.travelFlash;
    } else {
      xu.uColor.value.set(PORTAL_COLORS.orange);
      this.exit.visible = scrollY > this.portalAt && after < 1;
      const es = 1.6 + Math.pow(after, 1.4) * 9;
      this.exit.scale.set(es, es, 1);
      xu.uFill.value = 1 - smooth(clamp01(after * 2.4));
      this.transit = scrollY < this.portalAt ? pu.uFill.value : 1 - clamp01(after * 2.4);
      if (!tr) this.flashColor = scrollY > this.portalAt ? PORTAL_COLORS.orange : PORTAL_COLORS.blue;
    }
    this.transit = Math.max(this.transit, this.travelFlash);

    // Wheatley rides along in screen space
    if (this.wheatley) {
      const wp = this.#screenToWorld(w[0], w[1], w[2], new THREE.Vector3());
      const wh = this.wheatley.root;
      wh.position.copy(wp);
      wh.quaternion.copy(this.camera.quaternion);
      const sc = w[3] * (this.mobile && this.camera.aspect < 0.9 ? 0.75 : 1) * Math.min(1.25, Math.max(0.85, this.camera.aspect / 1.6)) * 2.1;
      wh.scale.setScalar(sc);
      // look target: the pointer, projected to a plane between him and the camera
      const tgt = this.#screenToWorld(px, py, Math.max(1.2, w[2] - 3.2), new THREE.Vector3());
      this.wheatley.setTargetSoft(tgt);
      this.wheatley.update(dt, t, speed01);
    }

    // title follows the hero only
    if (this.title) {
      this.title.position.x = (this.titleBaseX || 0) - px * 0.12;
      this.titleMat.opacity = 1 - clamp01(scrollY / (window.innerHeight * 0.9));
      this.title.visible = this.titleMat.opacity > 0.001;
    }

    // rims hug the camera so every stop gets orange left, blue right
    this.rimO.position.set(cam.x - 4, cam.y + 1.5, 1.5);
    this.rimB.position.set(cam.x + 4, cam.y - 0.5, 1.5);

    // GLaDOS watches you
    if (this.glados) {
      const near = Math.abs(cam.y - Y.subject) < 7;
      this.gladosNear = near;
      const tgt = this.#screenToWorld(px, py, 2.5, new THREE.Vector3());
      this.glados.setTarget(tgt);
      this.glados.update(dt, near);
    }

    if (this.cubeRig) {
      if (scrollY > this.contactAt + window.innerHeight * 0.15) this.cubeRig.drop();
      this.cubeRig.update(dt, t);
    }

    this.wallMat.uniforms.uTime.value = t;
    this.dust.rotation.y = t * 0.01;
    this.dust.position.y = Math.sin(t * 0.2) * 0.1;

    // speed reads as lens stress
    const v = Math.min(Math.abs(this.velocity) / 3500, 1);
    this.ca.offset.set(v * 0.004 + this.transit * 0.006, v * 0.002);

    this.composer.render(dt);
    this.#adapt(dt);
  }
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
