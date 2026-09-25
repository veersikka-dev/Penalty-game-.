import * as THREE from 'three';

/** Creates a CanvasTexture by running a 2D drawing callback. */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

let glow: THREE.Texture | null = null;
/** Shared soft radial glow sprite. */
export function glowTexture(): THREE.Texture {
  if (glow) return glow;
  glow = canvasTexture(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    r.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  }, false);
  return glow;
}

/** Vertical fade texture used for light shafts. */
export function shaftTexture(): THREE.Texture {
  return canvasTexture(64, 256, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, 'rgba(255,255,255,0.9)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    const hg = g.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, 'rgba(0,0,0,1)');
    hg.addColorStop(0.5, 'rgba(0,0,0,0)');
    hg.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = hg;
    g.fillRect(0, 0, w, h);
  }, false);
}
