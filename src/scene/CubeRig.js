import * as THREE from 'three';
import { portalMaterial } from './materials.js';

// The closing set piece. A Companion Cube drops out of an orange portal onto a floor button.
// Click it and a blue portal opens under it: it falls forever, ceiling to floor, until you click again.
export class CubeRig {
  constructor(gltf, { floorY, ceilY }) {
    this.root = new THREE.Group();
    this.floorY = floorY;
    this.ceilY = ceilY;

    const cube = gltf.scene;
    cube.traverse((o) => {
      if (o.isMesh) {
        o.material.envMapIntensity = 1.2;
        o.castShadow = false;
      }
    });
    const box = new THREE.Box3().setFromObject(cube);
    const s = 0.82 / box.getSize(new THREE.Vector3()).y;
    cube.scale.setScalar(s);
    cube.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-s));
    this.cube = new THREE.Group();      // position + world-space stretch
    this.spinner = new THREE.Group();   // tumble
    this.spinner.add(cube);
    this.cube.add(this.spinner);
    this.half = 0.41;
    this.root.add(this.cube);

    // Aperture floor button: a low wide drum, a lit ring, and a plate that sinks under weight.
    const grey = new THREE.MeshStandardMaterial({ color: '#d9d9d4', roughness: 0.55, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.6, metalness: 0.3 });
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#2f9bff', toneMapped: false });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.86, 0.12, 64), grey);
    base.position.y = floorY + 0.06;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.025, 12, 96), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = floorY + 0.125;
    this.plate = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.08, 64), dark);
    this.plateRest = floorY + 0.15;
    this.plate.position.y = this.plateRest;
    this.root.add(base, ring, this.plate);

    // portals (horizontal ellipses)
    const geo = new THREE.PlaneGeometry(1.7, 1.25);
    this.orange = new THREE.Mesh(geo, portalMaterial('#ff7a1a'));
    this.orange.rotation.x = Math.PI / 2;
    this.orange.position.y = ceilY;
    this.blue = new THREE.Mesh(geo, portalMaterial('#2f9bff'));
    this.blue.rotation.x = -Math.PI / 2;
    this.blue.position.y = floorY + 0.2;
    this.blue.renderOrder = 2;
    this.orange.renderOrder = 2;
    this.root.add(this.orange, this.blue);
    this.glow = new THREE.PointLight('#ff7a1a', 0, 4, 2);
    this.glow.position.y = ceilY - 0.3;
    this.root.add(this.glow);

    this.state = 'waiting';   // waiting | falling | resting | looping
    this.y = ceilY + 1.2;
    this.vy = 0;
    this.spin = new THREE.Euler(0.2, 0.6, 0.1);
    this.spinV = new THREE.Vector3();
    this.press = 0;
    this.loops = 0;
    this.cube.visible = false;
    this.onLand = null;
  }

  drop() {
    if (this.state !== 'waiting') return;
    this.state = 'falling';
    this.cube.visible = true;
    this.y = this.ceilY + this.half;
    this.vy = -1.5;
    this.spinV.set(1.2, 2.4, 0.6);
  }

  toggleLoop() {
    if (this.state === 'resting') {
      this.state = 'looping';
      this.loops = 0;
      this.vy = 2.6;   // a little hop before it drops through
      this.spinV.set(2, 3, 1);
    } else if (this.state === 'looping') {
      this.state = 'falling';
    } else if (this.state === 'waiting') {
      this.drop();
    }
  }

  hit(raycaster) {
    return raycaster.intersectObject(this.cube, true).length > 0;
  }

  update(dt, t) {
    const g = -14;
    const om = this.orange.material.uniforms;
    const bm = this.blue.material.uniforms;
    om.uTime.value = t;
    bm.uTime.value = t;
    om.uOpen.value = THREE.MathUtils.lerp(om.uOpen.value, this.state === 'waiting' ? 0.35 : 1, 0.06);
    bm.uOpen.value = THREE.MathUtils.lerp(bm.uOpen.value, this.state === 'looping' ? 1 : 0, 0.08);
    this.glow.intensity = 2.5 * om.uOpen.value;

    if (this.state === 'falling' || this.state === 'looping') {
      this.vy = Math.max(this.vy + g * dt, -16);
      this.y += this.vy * dt;
      const ground = this.plate.position.y + 0.04 + this.half;
      if (this.state === 'looping' && this.y < this.floorY + 0.2 && this.vy < 0) {
        // through the blue portal, out of the orange one
        this.y += this.ceilY - (this.floorY + 0.2);
        this.loops++;
      } else if (this.state === 'falling' && this.y <= ground) {
        this.y = ground;
        if (this.vy < -3) {
          this.vy *= -0.28;           // one honest bounce
          this.press = 1;
        } else {
          this.vy = 0;
          this.state = 'resting';
          this.spin.set(0, this.spin.y, 0);
          this.onLand?.(this.loops);
        }
      }
      this.spin.x += this.spinV.x * dt * (this.state === 'looping' ? 1 : 0.6);
      this.spin.y += this.spinV.y * dt * 0.6;
      this.spin.z += this.spinV.z * dt * (this.state === 'looping' ? 1 : 0.6);
    }
    if (this.state === 'resting') {
      // settle flat onto the plate
      const snap = (a) => Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
      this.spin.x = THREE.MathUtils.lerp(this.spin.x, snap(this.spin.x), 0.15);
      this.spin.z = THREE.MathUtils.lerp(this.spin.z, snap(this.spin.z), 0.15);
      this.y = this.plate.position.y + 0.04 + this.half;
    }
    const pressed = this.state === 'resting' || (this.state === 'falling' && this.y < this.floorY + 1);
    this.plate.position.y = THREE.MathUtils.lerp(this.plate.position.y, this.plateRest - (pressed && this.state === 'resting' ? 0.05 : 0), 0.2);
    this.ringMat.color.lerp(new THREE.Color(this.state === 'resting' ? '#ff7a1a' : '#2f9bff'), 0.1);

    // stretch with speed so the infinite fall reads as fast
    const stretch = 1 + Math.min(Math.abs(this.vy) / 16, 1) * 0.35 * (this.state === 'looping' ? 1 : 0.4);
    this.cube.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
    this.cube.position.y = this.y;
    this.spinner.rotation.copy(this.spin);
  }
}
