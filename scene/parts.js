/*
  Parts for the Erbil street scene: realistic sedans and leafy trees.
*/
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Sedans: the cars you actually see parked on an Erbil street.        */
/* The body is lofted from a side profile, a plan outline and a        */
/* rounded cross-section, so it has real curves: hood, windscreen,     */
/* roof, rear window, boot, wheel arches and a narrower glasshouse.    */
/* ------------------------------------------------------------------ */

/* Each model is a smooth side profile with wheel-arch cut-outs (the
   lower body), plus a greenhouse profile (windscreen, roof, rear window).
   Both are extruded across the car's width with rounded edges.
     camry   4.88 m   the most common car in the city
     avalon  4.98 m   longer, flatter boot
     altima  4.90 m   lower nose, faster rear window
     cruiser 4.95 m   Land Cruiser, for variety                         */
const MODELS = {
  camry: {
    L: 4.88,
    W: 1.84,
    wb: 2.83,
    r: 0.335,
    belt: 0.97,
    nose: 0.78,
    deck: 1.02,
    roof: 1.44,
    ws: [1.12, 0.42],
    rw: [-1.55, -0.62],
  },
  avalon: {
    L: 4.98,
    W: 1.85,
    wb: 2.87,
    r: 0.34,
    belt: 0.98,
    nose: 0.8,
    deck: 1.03,
    roof: 1.44,
    ws: [1.15, 0.44],
    rw: [-1.62, -0.66],
  },
  altima: {
    L: 4.9,
    W: 1.85,
    wb: 2.82,
    r: 0.335,
    belt: 0.96,
    nose: 0.74,
    deck: 1.0,
    roof: 1.43,
    ws: [1.12, 0.4],
    rw: [-1.45, -0.55],
  },
  cruiser: {
    L: 4.95,
    W: 1.98,
    wb: 2.85,
    r: 0.39,
    belt: 1.28,
    nose: 1.02,
    deck: 1.3,
    roof: 1.9,
    ws: [1.25, 0.82],
    rw: [-2.3, -2.12],
    suv: true,
  },
};

function lowerShape(M) {
  const h = M.L / 2,
    fa = M.wb / 2,
    ra = -M.wb / 2,
    ar = M.r + 0.07,
    by = M.suv ? 0.34 : 0.22;
  const s = new THREE.Shape();
  s.moveTo(-h + 0.06, by + 0.12);
  // rear bumper and boot lip
  s.bezierCurveTo(-h - 0.04, by + 0.3, -h - 0.04, M.deck - 0.2, -h + 0.02, M.deck - 0.06);
  s.quadraticCurveTo(-h + 0.05, M.deck, -h + 0.2, M.deck);
  s.lineTo(M.rw[0] + 0.02, M.belt + 0.02);
  // belt line to the base of the windscreen
  s.lineTo(M.ws[0] + 0.02, M.belt);
  // bonnet, sloping to the nose
  s.bezierCurveTo(M.ws[0] + 0.55, M.belt - 0.04, h - 0.3, M.nose + 0.1, h - 0.1, M.nose);
  s.quadraticCurveTo(h + 0.02, M.nose - 0.02, h + 0.02, M.nose - 0.16);
  s.bezierCurveTo(h + 0.04, by + 0.3, h + 0.02, by + 0.12, h - 0.1, by + 0.08);
  // front wheel arch
  s.lineTo(fa + ar + 0.05, by);
  s.absarc(fa, M.r, ar, Math.asin((by - M.r) / ar), Math.PI - Math.asin((by - M.r) / ar), false);
  s.lineTo(ra + ar + 0.02, by - 0.02);
  // rear wheel arch
  s.absarc(ra, M.r, ar, Math.asin((by - 0.02 - M.r) / ar), Math.PI - Math.asin((by - 0.02 - M.r) / ar), false);
  s.lineTo(-h + 0.12, by);
  s.closePath();
  return s;
}

function cabinShape(M) {
  const s = new THREE.Shape();
  if (M.suv) {
    s.moveTo(M.rw[0], M.belt - 0.02);
    s.lineTo(M.rw[1] + 0.05, M.roof - 0.06);
    s.quadraticCurveTo(M.rw[1] + 0.1, M.roof, M.rw[1] + 0.3, M.roof);
    s.lineTo(M.ws[1] - 0.15, M.roof);
    s.quadraticCurveTo(M.ws[1] + 0.05, M.roof, M.ws[1] + 0.12, M.roof - 0.08);
    s.lineTo(M.ws[0], M.belt - 0.02);
  } else {
    s.moveTo(M.rw[0], M.belt - 0.02);
    s.bezierCurveTo(M.rw[0] + 0.45, M.belt + 0.12, M.rw[1] - 0.1, M.roof - 0.02, M.rw[1] + 0.2, M.roof);
    s.bezierCurveTo(M.rw[1] + 0.5, M.roof + 0.015, M.ws[1] - 0.3, M.roof + 0.015, M.ws[1], M.roof - 0.01);
    s.bezierCurveTo(M.ws[1] + 0.25, M.roof - 0.05, M.ws[0] - 0.35, M.belt + 0.2, M.ws[0], M.belt - 0.02);
  }
  s.closePath();
  return s;
}

const geoCache = {};
function geometries(name) {
  if (geoCache[name]) return geoCache[name];
  const M = MODELS[name];
  const lower = new THREE.ExtrudeGeometry(lowerShape(M), {
    depth: M.W - 0.24,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.06,
    bevelSegments: 5,
    curveSegments: 24,
  });
  lower.translate(0, 0, -(M.W - 0.24) / 2);
  lower.rotateY(-Math.PI / 2);
  const cabW = M.W - 0.42;
  const cabin = new THREE.ExtrudeGeometry(cabinShape(M), {
    depth: cabW - 0.12,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 4,
    curveSegments: 20,
  });
  cabin.translate(0, 0, -(cabW - 0.12) / 2);
  cabin.rotateY(-Math.PI / 2);
  // Plan taper: real bodies narrow towards the bumpers and round off at
  // the corners; the glasshouse leans in towards the roof (tumblehome).
  const h = M.L / 2;
  const taper = (g, fn) => {
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setX(i, pa.getX(i) * fn(pa.getY(i), pa.getZ(i)));
    pa.needsUpdate = true;
  };
  taper(lower, (y, z) => {
    const e = Math.abs(z) / h; // 0 middle, 1 at the ends
    const top = Math.max(0, (y - (M.belt - 0.35)) / 0.4); // upper body rounds in more
    return 1 - 0.1 * Math.pow(e, 4) - 0.05 * Math.pow(e, 2) * top - 0.03 * top;
  });
  taper(cabin, (y) => 1 - 0.2 * Math.max(0, (y - M.belt) / (M.roof - M.belt)));
  geoCache[name] = { lower, cabin };
  return geoCache[name];
}

let shared = null;
function sharedParts() {
  if (shared) return shared;
  const tyre = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.92 });
  const rim = new THREE.MeshStandardMaterial({ color: "#b9bcbf", roughness: 0.28, metalness: 0.95 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#0e141c",
    roughness: 0.04,
    metalness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  });
  const black = new THREE.MeshStandardMaterial({ color: "#0c0d0e", roughness: 0.5, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: "#e6e8ea", roughness: 0.15, metalness: 1 });
  const plate = new THREE.MeshStandardMaterial({ color: "#f2f2ef", roughness: 0.5 });
  const lens = new THREE.MeshPhysicalMaterial({ color: "#d9dde2", roughness: 0.05, metalness: 0.3, clearcoat: 1 });
  const tailOff = new THREE.MeshStandardMaterial({ color: "#5a0d0b", roughness: 0.2, metalness: 0.2 });
  const headOn = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#fff4dc").multiplyScalar(5),
    toneMapped: false,
  });
  const tailOn = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#ff2414").multiplyScalar(3),
    toneMapped: false,
  });
  const tyreGeo = new THREE.TorusGeometry(0.25, 0.1, 10, 24);
  const tyreFill = new THREE.CylinderGeometry(0.33, 0.33, 0.2, 24);
  tyreFill.rotateZ(Math.PI / 2);
  tyreGeo.rotateY(Math.PI / 2);
  // five-spoke alloy
  const spokes = [];
  for (let k = 0; k < 5; k++) {
    const s = new THREE.BoxGeometry(0.03, 0.2, 0.05);
    s.translate(0, 0.1, 0);
    s.rotateX((k / 5) * Math.PI * 2);
    spokes.push(s);
  }
  const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12);
  hub.rotateZ(Math.PI / 2);
  const rimRing = new THREE.TorusGeometry(0.21, 0.025, 6, 24);
  rimRing.rotateY(Math.PI / 2);
  shared = {
    tyre,
    rim,
    glass,
    black,
    chrome,
    plate,
    lens,
    tailOff,
    headOn,
    tailOn,
    tyreGeo,
    tyreFill,
    spokes,
    hub,
    rimRing,
  };
  return shared;
}

export function makeCar(model, colour, { lights = false } = {}) {
  const M = MODELS[model];
  const P = sharedParts();
  const paint = new THREE.MeshPhysicalMaterial({
    color: colour,
    roughness: 0.32,
    metalness: 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
  const car = new THREE.Group();
  const G = geometries(model);
  const body = new THREE.Mesh(G.lower, paint);
  body.castShadow = true;
  const cabin = new THREE.Mesh(G.cabin, P.glass);
  cabin.castShadow = true;
  car.add(body, cabin);
  // painted roof panel and pillars over the glass
  const roofLen = (M.ws[1] - M.rw[1]) * 0.92;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(M.W - 0.46, 0.04, roofLen), paint);
  roof.position.set(0, M.roof + (M.suv ? -0.02 : 0.005), (M.ws[1] + M.rw[1]) / 2);
  car.add(roof);
  const bz = (M.ws[1] + M.rw[1]) / 2 + (M.suv ? 0.2 : 0.05);
  for (const sx of [-1, 1]) {
    // door handles
    for (const dz of [bz + 0.75, bz - 0.55]) {
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.16), P.chrome);
      hd.position.set(sx * (M.W / 2 + 0.005), M.belt - 0.12, dz);
      car.add(hd);
    }
  }
  // chrome window trim along the belt and a dark rocker panel under the doors
  for (const sx of [-1, 1]) {
    const trimLen = M.ws[0] - M.rw[0];
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, trimLen), P.chrome);
    trim.position.set(sx * (M.W / 2 - 0.08), M.belt + 0.01, (M.ws[0] + M.rw[0]) / 2);
    car.add(trim);
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, M.wb - 2 * (M.r + 0.12)), P.black);
    rocker.position.set(sx * (M.W / 2 + 0.0), M.suv ? 0.38 : 0.27, 0);
    car.add(rocker);
  }
  // wheels sit in the arches
  for (const z of [M.wb / 2, -M.wb / 2]) {
    for (const s of [-1, 1]) {
      const x = s * (M.W / 2 - 0.13);
      const sc = M.r / 0.33;
      const fill = new THREE.Mesh(P.tyreFill, P.tyre);
      fill.position.set(x, M.r, z);
      fill.scale.setScalar(sc);
      const ty = new THREE.Mesh(P.tyreGeo, P.tyre);
      ty.position.set(x + s * 0.02, M.r, z);
      ty.scale.setScalar(sc);
      const ring = new THREE.Mesh(P.rimRing, P.rim);
      ring.position.set(x + s * 0.11, M.r, z);
      ring.scale.setScalar(sc);
      const hub = new THREE.Mesh(P.hub, P.rim);
      hub.position.set(x + s * 0.11, M.r, z);
      car.add(fill, ty, ring, hub);
      for (const sg of P.spokes) {
        const sp = new THREE.Mesh(sg, P.rim);
        sp.position.set(x + s * 0.11, M.r, z);
        sp.scale.setScalar(sc);
        car.add(sp);
      }
      fill.castShadow = true;
    }
  }

  const frontZ = M.L / 2,
    rearZ = -M.L / 2;
  for (const s of [-1, 1]) {
    // headlights: swept lenses at the front corners
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.2), lights ? P.headOn : P.lens);
    hl.position.set(s * (M.W / 2 - 0.42), M.nose - 0.06, frontZ - 0.12);
    hl.rotation.set(0.25, -s * 0.38, 0);
    car.add(hl);
    // wide tail lights wrapping the rear corners
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.11, 0.12), lights ? P.tailOn : P.tailOff);
    tl.position.set(s * (M.W / 2 - 0.42), M.deck - 0.16, rearZ + 0.02);
    tl.rotation.y = s * 0.28;
    car.add(tl);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.1), paint);
    mirror.position.set(s * (M.W / 2 - 0.02), M.belt + 0.1, M.ws[0] - 0.12);
    car.add(mirror);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(M.W * 0.5, 0.2, 0.08), P.black);
  grille.position.set(0, M.nose - 0.18, frontZ - 0.02);
  car.add(grille);
  const lowGrille = new THREE.Mesh(new THREE.BoxGeometry(M.W * 0.62, 0.14, 0.06), P.black);
  lowGrille.position.set(0, M.suv ? 0.5 : 0.36, frontZ - 0.04);
  car.add(lowGrille);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), P.chrome);
  badge.position.set(0, M.nose - 0.18, frontZ + 0.03);
  car.add(badge);
  const pf = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.02), P.plate);
  pf.position.set(0, M.suv ? 0.62 : 0.48, frontZ + 0.08);
  car.add(pf);
  const pr = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.02), P.plate);
  pr.position.set(0, M.deck - 0.42, rearZ - 0.1);
  car.add(pr);
  // boot lid shut line and a dark diffuser under the rear bumper
  const lid = new THREE.Mesh(new THREE.BoxGeometry(M.W * 0.66, 0.012, 0.012), P.black);
  lid.position.set(0, M.deck - 0.24, rearZ - 0.085);
  car.add(lid);
  const diff = new THREE.Mesh(new THREE.BoxGeometry(M.W * 0.74, 0.1, 0.06), P.black);
  diff.position.set(0, M.suv ? 0.42 : 0.3, rearZ - 0.06);
  car.add(diff);
  grille.position.z = frontZ + 0.05;
  lowGrille.position.z = frontZ + 0.04;
  badge.position.z = frontZ + 0.1;
  return car;
}

/* ------------------------------------------------------------------ */
/* Trees: a trunk with branches and hundreds of leaf cards, which      */
/* reads as foliage instead of a lump.                                 */
/* ------------------------------------------------------------------ */
let leafMat = null;
function leafMaterial() {
  if (leafMat) return leafMat;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  for (let i = 0; i < 70; i++) {
    const x = 20 + Math.random() * 216,
      y = 20 + Math.random() * 216;
    const l = 18 + Math.random() * 22;
    g.save();
    g.translate(x, y);
    g.rotate(Math.random() * Math.PI * 2);
    g.fillStyle = `hsl(${85 + Math.random() * 25}, ${30 + Math.random() * 25}%, ${16 + Math.random() * 16}%)`;
    g.beginPath();
    g.ellipse(0, 0, l * 0.35, l * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  leafMat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
  return leafMat;
}

export function makeTree(rand, height = 5) {
  const tree = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: "#4a3a2c", roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, height * 0.55, 7), bark);
  trunk.position.y = height * 0.275;
  trunk.castShadow = true;
  tree.add(trunk);
  const crownY = height * 0.68,
    R = height * 0.33;
  for (let b = 0; b < 4; b++) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, R * 1.1, 5), bark);
    br.position.set(0, height * 0.55, 0);
    br.rotation.set((rand() - 0.5) * 1.2, rand() * Math.PI * 2, (rand() - 0.5) * 1.2);
    br.translateY(R * 0.5);
    tree.add(br);
  }
  const n = 260;
  const cards = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9), leafMaterial(), n);
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    // points in a squashed sphere, denser near the surface
    const u = rand() * Math.PI * 2,
      v = Math.acos(2 * rand() - 1),
      r = R * (0.55 + 0.45 * Math.cbrt(rand()));
    const x = Math.sin(v) * Math.cos(u) * r,
      y = Math.cos(v) * r * 0.8,
      z = Math.sin(v) * Math.sin(u) * r;
    e.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    q.setFromEuler(e);
    const s = 0.7 + rand() * 0.6;
    m.compose(new THREE.Vector3(x, crownY + y, z), q, new THREE.Vector3(s, s, s));
    cards.setMatrixAt(i, m);
  }
  cards.castShadow = true;
  tree.add(cards);
  return tree;
}
