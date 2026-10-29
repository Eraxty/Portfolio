import * as THREE from 'three';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const Z = new THREE.Vector3(0, 0, 1);

// Builds a quaternion in a bone's parent space that turns `fromDir` toward `toDir`, clamped to maxAngle.
function clampedTurn(fromDir, toDir, maxAngle, out) {
  const angle = fromDir.angleTo(toDir);
  if (angle > maxAngle) {
    const axis = _v2.crossVectors(fromDir, toDir).normalize();
    return out.setFromAxisAngle(axis, maxAngle);
  }
  return out.setFromUnitVectors(fromDir, toDir);
}

function worldToParentDir(bone, worldDir, out) {
  _m.copy(bone.parent.matrixWorld).invert();
  return out.copy(worldDir).transformDirection(_m);
}

export class Wheatley {
  constructor(gltf) {
    this.root = new THREE.Group();     // positioned by the camera rig
    this.body = new THREE.Group();     // sway and bob
    this.root.add(this.body);

    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bones = {};
    model.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => this.#dress(m));
      }
    });
    this.bones = bones;

    // Find the eye's real forward and the shell's real up from the rig, then turn the model to face +Z.
    const eye = bones.eyeball_eye;
    const ap = bones.inner_aperture;
    const hu = bones.handle_upper;
    const hl = bones.handle_lower;
    const pos = (b) => b.getWorldPosition(new THREE.Vector3());
    const fwd = pos(ap).sub(pos(eye)).normalize();
    const up = pos(hu).sub(pos(hl));
    up.sub(fwd.clone().multiplyScalar(up.dot(fwd))).normalize();
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const basis = new THREE.Matrix4().makeBasis(right, up, fwd);
    const align = new THREE.Quaternion().setFromRotationMatrix(basis).invert();

    // centre and normalise to a 1 unit diameter
    const pivot = new THREE.Group();
    pivot.quaternion.copy(align);
    pivot.add(model);
    pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot, true);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const s = 1 / Math.max(size.x, size.z);
    const holder = new THREE.Group();
    holder.scale.setScalar(s);
    pivot.position.copy(centre).multiplyScalar(-1);
    holder.add(pivot);
    this.body.add(holder);
    this.root.updateMatrixWorld(true);

    // Rest data for the aim and lid bones, all expressed in each bone's parent space.
    this.aim = bones.axel_center_z;
    this.aimRest = this.aim.quaternion.clone();
    const fwdWorld = pos(ap).sub(pos(eye)).normalize();
    this.aimFwd = worldToParentDir(this.aim, fwdWorld, new THREE.Vector3());

    const lidAxisWorld = new THREE.Vector3().crossVectors(fwdWorld, pos(hu).sub(pos(hl)).normalize()).normalize();
    this.lids = ['eyelid_upper_main', 'eyelid_lower_main'].map((n, i) => {
      const b = bones[n];
      return { b, rest: b.quaternion.clone(), axis: worldToParentDir(b, lidAxisWorld, new THREE.Vector3()).normalize(), sign: i === 0 ? 1 : -1 };
    });
    this.aperture = bones.inner_aperture;
    this.apertureRest = this.aperture.scale.clone();
    this.handles = [bones.handle_upper, bones.handle_lower].map((b) => ({ b, rest: b.quaternion.clone() }));

    // eye light
    this.eyeLight = new THREE.PointLight('#5fb6ff', 2.2, 3.2, 2);
    this.eyeLight.position.set(0, 0, 0.62);
    this.body.add(this.eyeLight);

    this.target = new THREE.Vector3(0, 0, 5);
    this.look = new THREE.Quaternion();
    this.lidOpen = 1;        // 1 open, 0 shut
    this.lidSquint = 0;
    this.dilate = 1;
    this.blinkT = 0;
    this.nextBlink = 2 + Math.random() * 3;
    this.idle = 0;
    this.saccade = new THREE.Vector3();
    this.nextSaccade = 0;
    this.startle = 0;
    this.angVel = 0;
  }

  #dress(m) {
    const n = (m.name || '').toLowerCase();
    if (n.includes('glass')) {
      m.transparent = true;
      m.opacity = 0.18;
      m.depthWrite = false;
      m.roughness = 0.04;
      m.metalness = 0;
      m.color = new THREE.Color('#9fd3ff');
    } else if (n.includes('light')) {
      m.color = new THREE.Color('#0d2a4a');
      m.map = null;
      m.emissive = new THREE.Color('#2f9bff');
      m.emissiveIntensity = 2.4;
      m.toneMapped = false;
    } else {
      m.roughness = 0.42;
      m.metalness = 0.35;
      m.envMapIntensity = 1.1;
    }
  }

  setTargetSoft(worldPoint) { this.target.copy(worldPoint); }

  nudge() { this.idle = 0; }

  poke() {
    this.startle = 1;
    this.blinkT = 0.0001;
  }

  update(dt, t, speed01) {
    this.idle += dt;

    // Idle saccades: after a while without input he glances around on his own.
    if (this.idle > 3.5 && t > this.nextSaccade) {
      this.saccade.set((Math.random() - 0.5) * 3, (Math.random() - 0.4) * 1.6, 0);
      this.nextSaccade = t + 0.8 + Math.random() * 1.6;
    } else if (this.idle <= 3.5) {
      this.saccade.multiplyScalar(0.9);
    }

    // aim
    this.root.updateMatrixWorld(true);
    const bonePos = this.aim.getWorldPosition(_v);
    const goal = _v2.copy(this.target).add(this.saccade).sub(bonePos).normalize();
    const goalParent = worldToParentDir(this.aim, goal, new THREE.Vector3()).normalize();
    clampedTurn(this.aimFwd, goalParent, 0.95, _q);
    const before = this.look.clone();
    const k = 1 - Math.exp(-dt * (this.idle > 3.5 ? 14 : 9));
    this.look.slerp(_q, k);
    this.angVel = THREE.MathUtils.lerp(this.angVel, before.angleTo(this.look) / Math.max(dt, 1e-3), 0.2);
    this.aim.quaternion.copy(this.look).multiply(this.aimRest);

    // body follows a little, bobs, and jolts when poked
    this.startle = Math.max(0, this.startle - dt * 1.6);
    const jolt = Math.sin(t * 60) * this.startle * 0.08;
    this.body.position.y = Math.sin(t * 1.3) * 0.025;
    this.body.rotation.z = Math.sin(t * 0.9) * 0.03 + jolt;
    this.body.rotation.x = Math.sin(t * 1.1 + 1) * 0.02;

    // handles twitch with eye speed
    const tw = Math.min(this.angVel * 0.02, 0.18);
    this.handles.forEach((h, i) => {
      _q.setFromAxisAngle(Z, (i ? -1 : 1) * (tw + Math.sin(t * 2 + i) * 0.02));
      h.b.quaternion.copy(h.rest).multiply(_q);
    });

    // blinks: quick close, slower open. Double blink sometimes.
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT === 0) {
      this.blinkT = 0.0001;
      this.nextBlink = 2.4 + Math.random() * 4 + (Math.random() < 0.2 ? -2.2 : 0);
    }
    let close = 0;
    if (this.blinkT > 0) {
      this.blinkT += dt;
      const b = this.blinkT;
      close = b < 0.07 ? b / 0.07 : b < 0.11 ? 1 : Math.max(0, 1 - (b - 0.11) / 0.16);
      if (b > 0.3) this.blinkT = 0;
    }
    this.lidSquint = THREE.MathUtils.lerp(this.lidSquint, Math.min(speed01 * 0.3 + this.startle * 0.45, 0.5), 0.08);
    const shut = Math.max(close, this.lidSquint);
    // the rig's rest pose has the lids shut, so "open" is a rotation away from rest
    const open = 0.68 * (1 - shut);
    this.lids.forEach((l) => {
      _q.setFromAxisAngle(l.axis, l.sign * open);
      l.b.quaternion.copy(_q).multiply(l.rest);
    });

    // pupil aperture: narrows with speed, opens wide when startled
    const d = THREE.MathUtils.clamp(1 - speed01 * 0.35 + this.startle * 0.45, 0.6, 1.45);
    this.dilate = THREE.MathUtils.lerp(this.dilate, d, 0.1);
    this.aperture.scale.set(this.apertureRest.x, this.apertureRest.y * this.dilate, this.apertureRest.z * this.dilate);

    this.eyeLight.intensity = 2.2 * (1 - shut * 0.8);
  }
}
