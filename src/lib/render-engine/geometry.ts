export interface Point2D {
  x: number;
  y: number;
  /** perspective weight (1/depth), used by drawPerspective for interpolation */
  w?: number;
}

export interface Camera {
  W: number;
  H: number;
  f: number;
  d: number;
  pitch: number;
  camY: number;
  proj(x: number, y: number, z: number): { x: number; y: number; k: number; zc: number };
}

export function makeCam(
  W: number,
  H: number,
  focal: number,
  dist: number,
  pitchDeg: number,
  camY = 0
): Camera {
  const pitch = ((pitchDeg || 0) * Math.PI) / 180;
  return {
    W,
    H,
    f: focal,
    d: dist,
    pitch,
    camY,
    proj(x, y, z) {
      const yy = y - this.camY;
      const zz = z + this.d;
      const c = Math.cos(this.pitch);
      const s = Math.sin(this.pitch);
      const y2 = yy * c - zz * s;
      let z2 = yy * s + zz * c;
      if (z2 < 1) z2 = 1;
      const k = this.f / z2;
      return { x: this.W / 2 + x * k, y: this.H / 2 + y2 * k, k, zc: z2 };
    },
  };
}

export function rotY(p: { x: number; y: number; z: number }, ang: number) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

export function cardCorners(
  cam: Camera,
  wCard: number,
  hCard: number,
  ang: number,
  liftY: number
): Point2D[] {
  const hw = wCard / 2;
  const pts = [
    { x: -hw, y: -hCard, z: 0 },
    { x: hw, y: -hCard, z: 0 },
    { x: hw, y: 0, z: 0 },
    { x: -hw, y: 0, z: 0 },
  ];
  return pts.map((p) => {
    const r = rotY(p, ang);
    const s = cam.proj(r.x, r.y + liftY, r.z);
    return { x: s.x, y: s.y, w: 1 / s.zc };
  });
}

export function projEllipse(
  cam: Camera,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  y: number,
  n: number
): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(cam.proj(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz));
  }
  return pts;
}

export function pathPts(ctx: CanvasRenderingContext2D, pts: Point2D[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

export function expandQuad(q: Point2D[], m: number): Point2D[] {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  return q.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * m, y: p.y + (dy / len) * m };
  });
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
