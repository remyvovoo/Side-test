export type DetailKind = "corner-tl" | "corner-tr" | "corner-bl" | "corner-br" | "surface";

/**
 * Côté d'un gros plan de coin, en fraction de la HAUTEUR de la carte. La
 * zone est CARRÉE — un coin se juge sur ses deux bords à parts égales — et
 * tenir cette fraction sur la hauteur conserve exactement l'échelle d'avant
 * le 19 août 2026, que Remy a jugée meilleure (voir renderDetailShot).
 */
const CORNER_FRACTION = 0.34;

/** Air laissé autour de la carte sur la vue d'ensemble, en fraction du cadre. */
const SURFACE_AIR = 0.07;

/**
 * Recul au-delà des deux bords EXTÉRIEURS du coin, en fraction de la zone.
 * Le cadrage déborde donc légèrement de la carte de ce côté-là : le blanc
 * s'y installe naturellement, comme le fond derrière une carte posée. Sur
 * les deux autres côtés la carte continue hors champ, ce qui est le propre
 * d'un gros plan. C'est cette dissymétrie qui distingue « bord de la carte »
 * de « carte coupée net » — la bande blanche du 19 août 2026 tombait au
 * milieu de la carte, d'où l'illusion de coupure.
 */
const CORNER_MARGIN = 0.14;

function cornerOrigin(kind: DetailKind, iw: number, ih: number, side: number, m: number) {
  switch (kind) {
    case "corner-tl":
      return { sx: -m, sy: -m };
    case "corner-tr":
      return { sx: iw - side + m, sy: -m };
    case "corner-bl":
      return { sx: -m, sy: ih - side + m };
    case "corner-br":
      return { sx: iw - side + m, sy: ih - side + m };
    case "surface":
      return { sx: 0, sy: 0 };
  }
}

/**
 * Gros plan RÉEL et non retouché de la carte (un coin, ou la surface
 * entière) sur fond blanc — pas de studio, pas de perspective. Ces images
 * sont la PREUVE de l'état pour l'acheteur, par opposition aux visuels
 * commerciaux qui sont la vitrine ; cette distinction est lisible d'un coup
 * d'œil et il faut la préserver. Rien ici n'a le droit d'altérer ce que la
 * photo montre vraiment.
 *
 * Cadre TOUJOURS CARRÉ, sur fond blanc, et jamais de bande vide ajoutée
 * d'un seul côté — c'est elle qui donnait l'illusion d'une carte coupée
 * net (repérée par Remy le 19 août 2026). Deux façons de l'éviter, une par
 * type de plan, et surtout PAS en zoomant davantage : l'échelle d'origine
 * a été jugée meilleure, seul le cadrage était en cause.
 *
 *   - un coin  : on prélève une zone déjà CARRÉE dans la carte, qui remplit
 *                donc le cadre sans rien à combler ;
 *   - surface  : la carte entière est centrée avec de l'air tout autour,
 *                le blanc devient une marge voulue au lieu d'un reste.
 */
export function renderDetailShot(
  canvas: HTMLCanvasElement,
  source: HTMLImageElement,
  kind: DetailKind,
  size = 900
) {
  const iw = source.naturalWidth || source.width;
  const ih = source.naturalHeight || source.height;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  if (kind === "surface") {
    // Vue d'ensemble : la carte respire, elle ne touche aucun bord.
    const box = size * (1 - 2 * SURFACE_AIR);
    const scale = Math.min(box / iw, box / ih);
    const outW = iw * scale;
    const outH = ih * scale;
    ctx.drawImage(source, 0, 0, iw, ih, (size - outW) / 2, (size - outH) / 2, outW, outH);
    return;
  }

  // Coin : zone carrée décalée vers l'extérieur, propre à CHAQUE coin — le
  // blanc se place au-delà des deux bords concernés (en haut et à gauche
  // pour le coin haut gauche, en bas et à droite pour le coin bas droit,
  // etc.). Le débordement hors de la photo n'est pas peint : drawImage
  // rogne source et destination dans la même proportion.
  const side = ih * CORNER_FRACTION;
  const { sx, sy } = cornerOrigin(kind, iw, ih, side, side * CORNER_MARGIN);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
}
