import * as THREE from 'three';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

export class Glados {
  constructor(gltf) {
    this.root = new THREE.Group();
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          const n = (m.name || '').toLowerCase();
          if (n.includes('selfillum')) {
            m.emissive = new THREE.Color('#ffb21a');
            m.emissiveIntensity = 6;
            m.emissiveMap = m.map;
            m.toneMapped = false;
          } else {
            m.roughness = 0.5;
            m.metalness = 0.25;
          }
        });
      }
    });

    // The export left her lying along Z. Pose the first animation frame, then use the rig to hang her:
    // string points down, head faces +Z.
    this.mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations.find((a) => a.name === 'glados_loopsmall') || gltf.animations[0];
    if (clip) this.mixer.clipAction(clip).play();
    this.mixer.update(0);
    model.updateMatrixWorld(true);
    const bone = (n) => model.getObjectByName(n);
    const P = (n) => bone(n).getWorldPosition(new THREE.Vector3());
    const mount = P('glados_rotates');
    const centre = P('glados_center_X');
    const headTip = P('glados_export_head_tip');
    const q1 = new THREE.Quaternion().setFromUnitVectors(centre.clone().sub(mount).normalize(), new THREE.Vector3(0, -1, 0));
    const face = headTip.clone().sub(centre).applyQuaternion(q1);
    face.y = 0;
    const q2 = new THREE.Quaternion().setFromUnitVectors(face.normalize(), new THREE.Vector3(0, 0, 1));
    const pivot = new THREE.Group();
    pivot.quaternion.copy(q2.multiply(q1));
    pivot.add(model);
    pivot.updateMatrixWorld(true);

    // normalise to 5.2 units tall with the ceiling mount at y = 0
    const box = new THREE.Box3().setFromObject(pivot, true);
    const s = 5.2 / box.getSize(new THREE.Vector3()).y;
    const m = mount.clone().applyQuaternion(pivot.quaternion);
    const holder = new THREE.Group();
    holder.scale.setScalar(s);
    pivot.position.set(-m.x, -box.max.y, -m.z);
    holder.add(pivot);
    this.root.add(holder);


    model.traverse((o) => { if (o.isBone && o.name === 'glados_export_neck_baseY') this.neck = o; });
    model.traverse((o) => { if (o.isBone && o.name === 'glados_export_head_rotate_inner') this.head = o; });
    this.neckRest = this.neck?.quaternion.clone();
    this.target = new THREE.Vector3();
    this.look = new THREE.Quaternion();
    this.eyeLight = new THREE.PointLight('#ffb21a', 0, 6, 2);
    this.root.add(this.eyeLight);
  }

  setTarget(p) { this.target.copy(p); }

  update(dt, visible) {
    if (!visible) return;
    if (this.neck) this.neck.quaternion.copy(this.neckRest);
    this.mixer.update(dt);
    if (!this.neck) return;
    // After the idle clip poses her, turn the neck a little further toward the visitor.
    this.root.updateMatrixWorld(true);
    const from = this.neck.getWorldPosition(_v);
    const dirWorld = this.target.clone().sub(from).normalize();
    _m.copy(this.neck.parent.matrixWorld).invert();
    const dir = dirWorld.transformDirection(_m).normalize();
    // the rest-forward of the neck in parent space, estimated from the head's position
    const head = this.head.getWorldPosition(new THREE.Vector3()).sub(from).normalize().transformDirection(_m).normalize();
    _q.setFromUnitVectors(head, dir);
    const ang = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
    if (ang > 0.6) _q.slerp(new THREE.Quaternion(), 1 - 0.6 / ang);
    this.look.slerp(_q, 1 - Math.exp(-dt * 3));
    this.neck.quaternion.premultiply(this.look);
    const eye = this.head.getWorldPosition(_v);
    this.eyeLight.position.copy(this.root.worldToLocal(eye.clone()));
    this.eyeLight.intensity = 3;
  }
}
