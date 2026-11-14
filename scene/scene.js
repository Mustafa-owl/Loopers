/*
  Erbil at dusk: the 3D scene behind the home page.

  An ordinary Erbil residential street at blue hour, built from code:
  two- and three-storey concrete houses behind garden walls and steel gates,
  stone-clad and plastered facades, window grilles, split AC units, water
  tanks and satellite dishes on every roof, black-and-yellow kerbs, sodium
  street lamps, cars, the web of neighbourhood generator cables, and the
  Citadel at the end of the view: an oval mound with a continuous ring of
  old brick house facades, the great south gate and its ramp, floodlit.

  The home page story drives it with the scroll, from 0 to 3, through:
    0  the street as it was: generator cables everywhere, lights on
    1  Runaki: the cables and the generator come down
    2  a cut: one block goes dark
    3  neighbours report: pins rise over the dark houses

  Build:  npx esbuild src/scene/scene.js --bundle --minify --format=iife \
            --global-name=ErbilScene --outfile=assets/js/scene.js
*/

import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeCar, makeTree } from "./parts.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/* ================================================================== */
/* helpers                                                             */
/* ================================================================== */

// Same street every time: a seeded random number generator.
function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = rng(1404);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h || w;
  return [c, c.getContext("2d")];
}
function texture(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function noise(g, w, h, amount, alpha = 1) {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
    img.data[i + 3] = 255 * alpha;
  }
  g.putImageData(img, 0, 0);
}
function blotches(g, w, h, count, dark, size = 0.2, strength = 0.1) {
  for (let i = 0; i < count; i++) {
    const r = Math.random() * w * size + 6;
    const x = Math.random() * w,
      y = Math.random() * h;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const d = dark ? "40,32,24" : "255,250,240";
    grd.addColorStop(0, `rgba(${d},${strength})`);
    grd.addColorStop(1, `rgba(${d},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/* A box whose texture coordinates are in metres, so textures tile at the
   same real size on every wall instead of stretching. `tile` = metres per
   texture repeat. */
function box(w, h, d, tile = 4) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // faces: +x, -x, +y, -y, +z, -z (4 vertices each)
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  }
  return g;
}

/* ================================================================== */
/* textures painted in code                                            */
/* ================================================================== */

// Plaster: off-white with dirt splash at the bottom and rain streaks.
function plasterTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  g.fillStyle = "#d9d4cb";
  g.fillRect(0, 0, S, S);
  noise(g, S, S, 18);
  blotches(g, S, S, 40, true, 0.15, 0.06);
  blotches(g, S, S, 30, false, 0.12, 0.08);
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S,
      h = Math.random() * S * 0.6 + 20;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "rgba(70,58,46,0.16)");
    grd.addColorStop(1, "rgba(70,58,46,0)");
    g.fillStyle = grd;
    g.fillRect(x, 0, Math.random() * 4 + 1, h);
  }
  // hairline cracks
  g.strokeStyle = "rgba(60,50,40,0.18)";
  g.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    let x = Math.random() * S,
      y = Math.random() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (Math.random() - 0.5) * 30;
      y += Math.random() * 20;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return texture(c);
}

// Stone cladding: the cut limestone tiles used on so many Erbil houses.
function stoneTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  const [bc, bg] = canvas(S);
  g.fillStyle = "#b9ad98";
  g.fillRect(0, 0, S, S);
  bg.fillStyle = "#000";
  bg.fillRect(0, 0, S, S);
  const rows = 8,
    rh = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -rh * 0.7 : 0;
    while (x < S) {
      const w = rh * (1.3 + Math.random() * 1.1);
      const l = 200 + Math.random() * 30;
      const hue = 36 + Math.random() * 8;
      g.fillStyle = `hsl(${hue}, ${22 + Math.random() * 14}%, ${l / 2.9}%)`;
      g.fillRect(x + 2, r * rh + 2, w - 4, rh - 4);
      bg.fillStyle = `rgb(${190 + Math.random() * 50},${190 + Math.random() * 50},${190 + Math.random() * 50})`;
      bg.fillRect(x + 2, r * rh + 2, w - 4, rh - 4);
      x += w;
    }
  }
  noise(g, S, S, 22);
  blotches(g, S, S, 30, true, 0.12, 0.08);
  noise(bg, S, S, 30);
  return [texture(c), texture(bc, { srgb: false })];
}

// Old yellow-brown baked brick, for the Citadel.
function brickTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  const [bc, bg] = canvas(S);
  g.fillStyle = "#8a6a4a";
  g.fillRect(0, 0, S, S);
  bg.fillStyle = "#222";
  bg.fillRect(0, 0, S, S);
  const rh = S / 32,
    bw = rh * 4;
  for (let r = 0; r < 32; r++) {
    for (let x = ((r % 2) * -bw) / 2; x < S; x += bw) {
      const l = 52 + Math.random() * 14;
      g.fillStyle = `hsl(${30 + Math.random() * 8}, ${38 + Math.random() * 12}%, ${l}%)`;
      g.fillRect(x + 1.5, r * rh + 1.5, bw - 3, rh - 3);
      bg.fillStyle = "#ddd";
      bg.fillRect(x + 1.5, r * rh + 1.5, bw - 3, rh - 3);
    }
  }
  noise(g, S, S, 26);
  blotches(g, S, S, 40, true, 0.15, 0.12);
  return [texture(c), texture(bc, { srgb: false })];
}

/* The Citadel's outer face: one continuous wall of joined old houses in
   ochre brick and lime plaster, as it looks from the city. Each house has
   its own height and tone; from the top down: a coping, a row of small
   ventilation slits, a row of tall round-headed windows, a row of small
   square windows, then plain wall down to the mound. One strip, 64 m wide
   and 18 m tall, anchored at the top of the wall. */
const FAC_M = 32; // pixels per metre
function citadelFacadeTexture() {
  const W = 64 * FAC_M,
    H = 18 * FAC_M;
  const [c, g] = canvas(W, H);
  const [ec, eg] = canvas(W, H);
  const [bc, bg] = canvas(W, H); // bump: recesses read as depth
  const m = (v) => v * FAC_M;
  // base: warm ochre plaster over brick, with faint coursing
  g.fillStyle = "#b97b45";
  g.fillRect(0, 0, W, H);
  bg.fillStyle = "#bbb";
  bg.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 6) {
    g.fillStyle = `rgba(90,55,30,${0.05 + Math.random() * 0.05})`;
    g.fillRect(0, y, W, 1);
  }
  noise(g, W, H, 18);
  const openings = [];
  let x = 0;
  while (x < W) {
    const w = m(7 + Math.random() * 10);
    const tone = Math.random();
    g.fillStyle =
      tone < 0.4
        ? `rgba(255,214,160,${0.08 + Math.random() * 0.1})`
        : tone < 0.7
          ? `rgba(120,70,35,${0.06 + Math.random() * 0.1})`
          : "rgba(0,0,0,0)";
    g.fillRect(x, 0, w, H);
    // coping and a thin shadow line under it
    g.fillStyle = "rgba(255,228,190,0.5)";
    g.fillRect(x, 0, w, m(0.35));
    g.fillStyle = "rgba(60,35,20,0.45)";
    g.fillRect(x, m(0.35), w, m(0.12));
    const pad = m(1.1);
    const slits = Math.random() < 0.7,
      arches = Math.random() < 0.8,
      squares = Math.random() < 0.75;
    const dark = (px, py, pw, ph, arch, lit) => {
      openings.push([px, py, pw, ph, arch, lit]);
      g.fillStyle = "#2b1a10";
      g.beginPath();
      if (arch) {
        g.moveTo(px, py + ph);
        g.lineTo(px, py + pw / 2);
        g.arc(px + pw / 2, py + pw / 2, pw / 2, Math.PI, 0);
        g.lineTo(px + pw, py + ph);
      } else g.rect(px, py, pw, ph);
      g.fill();
      // a lighter reveal on the lit side and sill below
      g.fillStyle = "rgba(255,225,180,0.35)";
      g.fillRect(px - 2, py + ph, pw + 4, 3);
      bg.fillStyle = "#333";
      bg.fillRect(px, py, pw, ph);
      if (lit) {
        eg.fillStyle = `rgba(255,${170 + Math.random() * 50},${90 + Math.random() * 40},0.95)`;
        eg.beginPath();
        if (arch) {
          eg.moveTo(px + 3, py + ph - 2);
          eg.lineTo(px + 3, py + pw / 2);
          eg.arc(px + pw / 2, py + pw / 2, pw / 2 - 3, Math.PI, 0);
          eg.lineTo(px + pw - 3, py + ph - 2);
        } else eg.rect(px + 3, py + 3, pw - 6, ph - 6);
        eg.fill();
      }
    };
    if (slits) for (let sx = x + pad; sx < x + w - pad; sx += m(1.25)) dark(sx, m(1.0), m(0.55), m(0.22), false, false);
    const step = m(2.8 + Math.random() * 0.8);
    if (arches)
      for (let sx = x + pad; sx < x + w - pad - m(1.3); sx += step)
        dark(sx, m(2.2), m(1.3), m(2.4), true, Math.random() < 0.22);
    if (squares)
      for (let sx = x + pad + m(0.2); sx < x + w - pad - m(0.9); sx += step)
        dark(sx, m(5.9), m(0.9), m(0.9), false, Math.random() < 0.12);
    // a long wooden balcony or ledge on some houses
    if (Math.random() < 0.3) {
      g.fillStyle = "#5a3a22";
      g.fillRect(x + m(0.5), m(4.7), w - m(1), m(0.18));
      g.fillStyle = "rgba(40,22,12,0.35)";
      g.fillRect(x + m(0.5), m(4.88), w - m(1), m(0.35));
    }
    // vertical joint where two houses meet
    g.fillStyle = "rgba(70,40,20,0.4)";
    g.fillRect(x, 0, 3, H);
    x += w;
  }
  // older, darker and patched lower wall, rain streaks
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(70,40,20,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * W, m(1 + Math.random() * 6), 2 + Math.random() * 3, m(1 + Math.random() * 6));
  }
  const grd = g.createLinearGradient(0, m(7), 0, H);
  grd.addColorStop(0, "rgba(60,35,18,0)");
  grd.addColorStop(1, "rgba(60,35,18,0.3)");
  g.fillStyle = grd;
  g.fillRect(0, m(7), W, H);
  blotches(g, W, H, 60, true, 0.08, 0.08);
  // floodlit from the foot of the wall
  eg.globalCompositeOperation = "destination-over";
  const lg = eg.createLinearGradient(0, H, 0, 0);
  lg.addColorStop(0, "rgba(255,170,90,0.5)");
  lg.addColorStop(0.55, "rgba(255,160,80,0.2)");
  lg.addColorStop(1, "rgba(255,150,70,0.05)");
  eg.fillStyle = lg;
  eg.fillRect(0, 0, W, H);
  eg.globalCompositeOperation = "lighter";
  for (let lx = 40; lx < W; lx += 160 + Math.random() * 80) {
    const rg = eg.createRadialGradient(lx, H, 0, lx, H, m(9));
    rg.addColorStop(0, "rgba(255,190,110,0.45)");
    rg.addColorStop(1, "rgba(255,190,110,0)");
    eg.fillStyle = rg;
    eg.fillRect(lx - m(9), 0, m(18), H);
  }
  // floodlight doesn't reach into the openings: keep them dark, except the lit rooms
  eg.globalCompositeOperation = "source-over";
  for (const [px, py, pw, ph, arch, lit] of openings) {
    eg.fillStyle = lit ? `rgb(255,${175 + Math.random() * 40},${95 + Math.random() * 30})` : "#000";
    eg.beginPath();
    if (arch) {
      eg.moveTo(px, py + ph);
      eg.lineTo(px, py + pw / 2);
      eg.arc(px + pw / 2, py + pw / 2, pw / 2, Math.PI, 0);
      eg.lineTo(px + pw, py + ph);
    } else eg.rect(px, py, pw, ph);
    eg.fill();
  }
  return [texture(c), texture(ec), texture(bc, { srgb: false })];
}

/* Windows: a 2x2 atlas of four window types, plus a glow map that lights
   up only the glass, with a curtain silhouette.
     [0] white PVC, two panes, curtains
     [1] dark aluminium, three panes, blinds
     [2] with a steel security grille (ground floors)
     [3] roller shutter half down                                        */
function windowTextures() {
  const S = 512,
    C = 256;
  const [c, g] = canvas(S);
  const [ec, eg] = canvas(S);
  const [rc, rg] = canvas(S);
  rg.fillStyle = "#999";
  rg.fillRect(0, 0, S, S);
  eg.fillStyle = "#000";
  eg.fillRect(0, 0, S, S);
  const cells = [
    [0, 0],
    [C, 0],
    [0, C],
    [C, C],
  ];
  cells.forEach(([ox, oy], k) => {
    const frame = k === 1 ? "#2e3236" : k === 2 ? "#3a3f44" : "#e9e6df";
    g.fillStyle = frame;
    g.fillRect(ox, oy, C, C);
    const panes = k === 1 ? 3 : 2;
    const m = 14,
      pw = (C - m * (panes + 1)) / panes;
    for (let p = 0; p < panes; p++) {
      const px = ox + m + p * (pw + m),
        py = oy + m,
        ph = C - m * 2;
      // glass: dark, with a faint sky reflection gradient
      const gg = g.createLinearGradient(px, py, px + pw, py + ph);
      gg.addColorStop(0, "#3b4a63");
      gg.addColorStop(0.5, "#1b2230");
      gg.addColorStop(1, "#283246");
      g.fillStyle = gg;
      g.fillRect(px, py, pw, ph);
      rg.fillStyle = "#0a0a0a";
      rg.fillRect(px, py, pw, ph); // glass is smooth
      // the light behind the curtain
      const lg = eg.createRadialGradient(px + pw / 2, py + ph * 0.45, 4, px + pw / 2, py + ph * 0.45, ph * 0.75);
      lg.addColorStop(0, "#ffffff");
      lg.addColorStop(1, "#8a8a8a");
      eg.fillStyle = lg;
      eg.fillRect(px, py, pw, ph);
      // curtains / blinds as soft folds
      if (k === 1) {
        for (let y = py; y < py + ph; y += 7) {
          eg.fillStyle = "rgba(0,0,0,0.25)";
          eg.fillRect(px, y, pw, 2);
        }
      } else {
        const side = p === 0 ? px : px + pw * 0.62;
        const cg = eg.createLinearGradient(side, 0, side + pw * 0.38, 0);
        cg.addColorStop(0, "rgba(0,0,0,0.55)");
        cg.addColorStop(0.5, "rgba(0,0,0,0.25)");
        cg.addColorStop(1, "rgba(0,0,0,0.5)");
        eg.fillStyle = cg;
        eg.fillRect(side, py, pw * 0.38, ph);
        for (let f = side; f < side + pw * 0.38; f += 9) {
          eg.fillStyle = "rgba(0,0,0,0.18)";
          eg.fillRect(f, py, 3, ph);
        }
      }
      // a silhouette of a lamp or a plant, sometimes
      if (Math.random() < 0.5) {
        eg.fillStyle = "rgba(0,0,0,0.5)";
        eg.fillRect(px + pw * 0.2, py + ph * 0.7, pw * 0.25, ph * 0.3);
      }
    }
    if (k === 2) {
      // steel grille: vertical bars with a curl pattern
      g.strokeStyle = "#1c1e20";
      g.lineWidth = 5;
      eg.strokeStyle = "#000";
      eg.lineWidth = 5;
      for (let x = ox + 24; x < ox + C - 10; x += 26) {
        for (const ctx of [g, eg]) {
          ctx.beginPath();
          ctx.moveTo(x, oy + 6);
          ctx.lineTo(x, oy + C - 6);
          ctx.stroke();
        }
      }
      for (const y of [oy + 60, oy + C - 60])
        for (const ctx of [g, eg]) {
          ctx.beginPath();
          ctx.moveTo(ox + 6, y);
          ctx.lineTo(ox + C - 6, y);
          ctx.stroke();
        }
      for (const ctx of [g, eg]) {
        ctx.beginPath();
        ctx.arc(ox + C / 2, oy + C / 2, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (k === 3) {
      // roller shutter box and slats covering the top 45%
      g.fillStyle = "#cfcac0";
      g.fillRect(ox, oy, C, C * 0.45);
      eg.fillStyle = "#000";
      eg.fillRect(ox, oy, C, C * 0.45);
      rg.fillStyle = "#999";
      rg.fillRect(ox, oy, C, C * 0.45);
      for (let y = oy; y < oy + C * 0.45; y += 8) {
        g.fillStyle = "rgba(0,0,0,0.12)";
        g.fillRect(ox, y, C, 2);
      }
    }
  });
  return {
    map: texture(c, { repeat: false }),
    glow: texture(ec, { repeat: false }),
    rough: texture(rc, { repeat: false, srgb: false }),
  };
}

function gateTexture(colour) {
  const [c, g] = canvas(256);
  g.fillStyle = colour;
  g.fillRect(0, 0, 256, 256);
  for (let x = 10; x < 256; x += 18) {
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(x, 0, 6, 256);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(x + 6, 0, 2, 256);
  }
  g.fillStyle = "rgba(0,0,0,0.4)";
  g.fillRect(0, 40, 256, 10);
  g.fillRect(0, 200, 256, 10);
  g.fillRect(126, 0, 4, 256);
  noise(g, 256, 256, 14);
  return texture(c, { repeat: false });
}

function shutterTexture() {
  const [c, g] = canvas(256);
  g.fillStyle = "#9da2a5";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fillRect(0, y, 256, 2);
    g.fillStyle = "rgba(255,255,255,0.15)";
    g.fillRect(0, y + 2, 256, 1);
  }
  noise(g, 256, 256, 18);
  blotches(g, 256, 256, 8, true, 0.3, 0.12);
  return texture(c, { repeat: false });
}

function paverTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  g.fillStyle = "#8f8a80";
  g.fillRect(0, 0, S, S);
  const t = S / 8;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const l = 52 + Math.random() * 10;
      g.fillStyle = `hsl(35, 8%, ${l}%)`;
      g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
    }
  noise(g, S, S, 20);
  blotches(g, S, S, 30, true, 0.15, 0.12);
  return texture(c);
}

/* Asphalt for a residential Erbil street. One tile is 10 m x 10 m; across
   the tile is the road's full width (9.2 m), so lanes, wheel tracks, the
   faded centre line and the dusty gutters land in the right places. */
function asphaltTexture() {
  const S = 1024,
    M = S / 10; // pixels per metre
  const [c, g] = canvas(S);
  const [rc, rg] = canvas(S); // roughness: polished tracks are smoother
  g.fillStyle = "#38393b";
  g.fillRect(0, 0, S, S);
  rg.fillStyle = "#e6e6e6";
  rg.fillRect(0, 0, S, S);
  // aggregate: thousands of tiny light and dark stones
  for (let i = 0; i < 26000; i++) {
    const l = Math.random() < 0.5 ? 18 + Math.random() * 12 : 42 + Math.random() * 22;
    g.fillStyle = `hsla(30, 4%, ${l}%, ${0.35 + Math.random() * 0.4})`;
    const r = 0.6 + Math.random() * 1.6;
    g.fillRect(Math.random() * S, Math.random() * S, r, r);
  }
  // the road is 9.2 m wide: centre at 4.6 m. Wheel tracks are darker and polished.
  for (const x of [1.25, 2.95, 6.25, 7.95]) {
    const grd = g.createLinearGradient((x - 0.55) * M, 0, (x + 0.55) * M, 0);
    grd.addColorStop(0, "rgba(20,20,22,0)");
    grd.addColorStop(0.5, "rgba(20,20,22,0.28)");
    grd.addColorStop(1, "rgba(20,20,22,0)");
    g.fillStyle = grd;
    g.fillRect((x - 0.55) * M, 0, 1.1 * M, S);
    rg.fillStyle = "rgba(170,170,170,0.5)";
    rg.fillRect((x - 0.35) * M, 0, 0.7 * M, S);
  }
  // dusty gutters along both kerbs
  for (const [x0, x1] of [
    [0, 0.45],
    [8.75, 9.2],
  ]) {
    const grd = g.createLinearGradient(x0 * M, 0, x1 * M, 0);
    const dust = "rgba(150,135,110,0.45)",
      none = "rgba(150,135,110,0)";
    grd.addColorStop(0, x0 === 0 ? dust : none);
    grd.addColorStop(1, x0 === 0 ? none : dust);
    g.fillStyle = grd;
    g.fillRect(x0 * M, 0, (x1 - x0) * M, S);
  }
  // repair patches: newer, darker asphalt with crisp edges
  for (let i = 0; i < 3; i++) {
    const w = (1 + Math.random() * 2.5) * M,
      h = (0.8 + Math.random() * 2.5) * M;
    const x = Math.random() * (S - w),
      y = Math.random() * (S - h);
    g.fillStyle = "rgba(22,22,24,0.55)";
    g.fillRect(x, y, w, h);
    g.strokeStyle = "rgba(10,10,10,0.6)";
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
  }
  // cracks, some sealed with shiny black tar
  for (let i = 0; i < 9; i++) {
    let x = Math.random() * S,
      y = Math.random() * S;
    const sealed = Math.random() < 0.5;
    g.strokeStyle = sealed ? "rgba(8,8,8,0.55)" : "rgba(15,15,15,0.4)";
    g.lineWidth = sealed ? 2.6 : 1.1;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      x += (Math.random() - 0.5) * 50;
      y += (Math.random() - 0.3) * 45;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // oil drips in the parking strips by the kerb
  for (let i = 0; i < 7; i++) {
    const x = (Math.random() < 0.5 ? 0.7 + Math.random() * 1.2 : 7.3 + Math.random() * 1.2) * M,
      y = Math.random() * S;
    const og = g.createRadialGradient(x, y, 0, x, y, 0.5 * M);
    og.addColorStop(0, "rgba(10,10,12,0.5)");
    og.addColorStop(1, "rgba(10,10,12,0)");
    g.fillStyle = og;
    g.fillRect(x - 0.5 * M, y - 0.5 * M, M, M);
  }
  // faded white dashed centre line: 3 m dash, 7 m gap
  g.fillStyle = "rgba(225,222,210,0.55)";
  g.fillRect(4.53 * M, 1 * M, 0.14 * M, 3 * M);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = "rgba(56,57,59,0.8)";
    g.fillRect(4.53 * M + Math.random() * 0.14 * M, (1 + Math.random() * 3) * M, 2, 2);
  }
  blotches(g, S, S, 30, false, 0.12, 0.04);
  blotches(g, S, S, 30, true, 0.12, 0.05);
  return [texture(c), texture(rc, { srgb: false })];
}

function dirtTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  g.fillStyle = "#8d7a62";
  g.fillRect(0, 0, S, S);
  noise(g, S, S, 40);
  blotches(g, S, S, 60, true, 0.15, 0.15);
  blotches(g, S, S, 40, false, 0.15, 0.08);
  return texture(c);
}

// Night facades for the city in the middle distance: walls with lit windows.
function cityNightTextures() {
  const S = 512;
  const [c, g] = canvas(S);
  const [ec, eg] = canvas(S);
  g.fillStyle = "#6e6457";
  g.fillRect(0, 0, S, S);
  noise(g, S, S, 20);
  eg.fillStyle = "#000";
  eg.fillRect(0, 0, S, S);
  for (let y = 16; y < S; y += 64) {
    for (let x = 12; x < S; x += 40) {
      g.fillStyle = "#1e232c";
      g.fillRect(x, y, 18, 26);
      if (Math.random() < 0.33) {
        const warm = Math.random() < 0.85;
        eg.fillStyle = warm ? `rgb(255,${170 + Math.random() * 50},${90 + Math.random() * 50})` : "rgb(200,220,255)";
        eg.fillRect(x, y, 18, 26);
      }
    }
  }
  return [texture(c), texture(ec)];
}

/* The flag of Kurdistan: red, white and green bands with a golden sun of
   21 rays in the middle. Drawn at 900 x 600 with a faint cloth weave. */
function flagTexture() {
  const W = 900,
    H = 600;
  const [c, g] = canvas(W, H);
  g.fillStyle = "#ed2024";
  g.fillRect(0, 0, W, H / 3);
  g.fillStyle = "#ffffff";
  g.fillRect(0, H / 3, W, H / 3);
  g.fillStyle = "#278e43";
  g.fillRect(0, (2 * H) / 3, W, H / 3);
  g.save();
  g.translate(W / 2, H / 2);
  const R = H * 0.29,
    r = R * 0.6; // ray tips and the sun's disc
  g.fillStyle = "#febd11";
  g.beginPath();
  for (let i = 0; i < 21; i++) {
    const a0 = (i / 21) * Math.PI * 2 - Math.PI / 2,
      half = Math.PI / 21;
    g.lineTo(Math.cos(a0 - half) * r * 1.02, Math.sin(a0 - half) * r * 1.02);
    g.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
    g.lineTo(Math.cos(a0 + half) * r * 1.02, Math.sin(a0 + half) * r * 1.02);
  }
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // cloth weave and a little wear at the fly end
  for (let y = 0; y < H; y += 3) {
    g.fillStyle = `rgba(0,0,0,${0.025 + Math.random() * 0.02})`;
    g.fillRect(0, y, W, 1);
  }
  const wear = g.createLinearGradient(W * 0.75, 0, W, 0);
  wear.addColorStop(0, "rgba(0,0,0,0)");
  wear.addColorStop(1, "rgba(60,40,20,0.12)");
  g.fillStyle = wear;
  g.fillRect(0, 0, W, H);
  const t = texture(c, { repeat: false });
  t.anisotropy = 8;
  return t;
}

/* Report markers over the dark houses, drawn like the map's labels:
   a black pill with a red dot and a "power off" sign for a confirmed cut,
   a white pill with a grey ring for a single unconfirmed report.        */
function pinTexture(confirmed) {
  const [c, g] = canvas(256, 320);
  const pill = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  const bg = confirmed ? "#172238" : "#ffffff",
    fg = confirmed ? "#ffffff" : "#59647a";
  // soft shadow
  g.fillStyle = "rgba(0,0,0,0.28)";
  pill(34, 36, 196, 96, 48);
  g.fill();
  // stem and the spot on the roof
  g.strokeStyle = bg;
  g.lineWidth = 7;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(128, 140);
  g.lineTo(128, 292);
  g.stroke();
  g.fillStyle = bg;
  g.beginPath();
  g.ellipse(128, 298, 16, 7, 0, 0, Math.PI * 2);
  g.fill();
  // pill with a little pointer
  g.fillStyle = bg;
  pill(28, 26, 200, 96, 48);
  g.fill();
  g.beginPath();
  g.moveTo(112, 118);
  g.lineTo(144, 118);
  g.lineTo(128, 142);
  g.closePath();
  g.fill();
  if (!confirmed) {
    g.strokeStyle = "rgba(0,0,0,0.12)";
    g.lineWidth = 3;
    pill(28, 26, 200, 96, 48);
    g.stroke();
  }
  // status dot
  if (confirmed) {
    g.fillStyle = "rgba(255,81,70,0.3)";
    g.beginPath();
    g.arc(84, 74, 25, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ff6a5a";
    g.beginPath();
    g.arc(84, 74, 15, 0, Math.PI * 2);
    g.fill();
  } else {
    g.strokeStyle = "#98989d";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(84, 74, 13, 0, Math.PI * 2);
    g.stroke();
  }
  // a lightning bolt with a line through it: "no power"
  g.save();
  g.translate(158, 74);
  g.fillStyle = fg;
  g.beginPath();
  g.moveTo(6, -30);
  g.lineTo(-16, 4);
  g.lineTo(-2, 4);
  g.lineTo(-8, 30);
  g.lineTo(16, -6);
  g.lineTo(2, -6);
  g.closePath();
  g.fill();
  g.strokeStyle = bg;
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(-26, -26);
  g.lineTo(26, 26);
  g.stroke();
  g.strokeStyle = confirmed ? "#ff6a5a" : fg;
  g.lineWidth = 6;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(-24, -24);
  g.lineTo(24, 24);
  g.stroke();
  g.restore();
  return texture(c, { repeat: false });
}

function lightPoolTexture() {
  const [c, g] = canvas(256);
  const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, "rgba(255,170,90,1)");
  rg.addColorStop(0.35, "rgba(255,150,70,0.45)");
  rg.addColorStop(1, "rgba(255,140,60,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  return texture(c, { repeat: false });
}

/* A hanging cable between two points. */
function cable(a, b, sag, r = 0.04) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    pts.push(p);
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, r, 4, false);
}

/* A car body from its side profile, extruded and bevelled. */

/* ================================================================== */
/* the scene                                                           */
/* ================================================================== */

export function mount(container, options = {}) {
  rand = rng(1404);
  const opts = Object.assign({ stage: 0, bloom: true, still: false, onReady: null, models: "assets/models/" }, options);
  const parked = [];
  const lowPower = !opts.still && (window.innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: !!opts.still,
  });
  /* How many pixels to draw. Every effect below runs once per pixel, so a big
     screen at 1.25× costs half as much again as the same screen at 1×. Live,
     we stay under about 1.5 million pixels whatever the screen; the bloom
     and grain hide the difference. */
  const budget = (w, h) => Math.min(window.devicePixelRatio || 1, 1, Math.sqrt(1.5e6 / Math.max(1, w * h)));
  renderer.setPixelRatio(
    opts.still
      ? Math.min(window.devicePixelRatio || 1, 2)
      : budget(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight),
  );
  let pixelRatio = renderer.getPixelRatio();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // nothing that casts a shadow moves, so draw them once
  renderer.shadowMap.needsUpdate = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color("#7a6670"), 0.00085);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 6000);

  /* ---- sky: blue hour, a band of orange dust on the horizon ---- */
  const sky = new Sky();
  sky.scale.setScalar(5000);
  const su = sky.material.uniforms;
  su.turbidity.value = 6.5;
  su.rayleigh.value = 2.6;
  su.mieCoefficient.value = 0.0032;
  su.mieDirectionalG.value = 0.8;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90.7),
    THREE.MathUtils.degToRad(214),
  );
  su.sunPosition.value.copy(sunDir);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  const sky2 = new Sky();
  sky2.scale.setScalar(5000);
  Object.keys(su).forEach((k) => {
    sky2.material.uniforms[k].value = su[k].value;
  });
  skyScene.add(sky2);
  scene.environment = pmrem.fromScene(skyScene, 0.03).texture;
  scene.environmentIntensity = 0.7;

  // the last of the sun, very low and warm, and a cool sky fill
  const sun = new THREE.DirectionalLight("#ff9566", 0.75);
  sun.position.set(-170, 55, -420);
  sun.target.position.set(0, 0, -60);
  sun.castShadow = true;
  const sm = lowPower ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight("#8d9bd0", "#4a3a30", 0.85));

  /* ---- materials ---- */
  const plaster = plasterTexture();
  const [stone, stoneBump] = stoneTexture();
  const wallColours = ["#e2d9c8", "#ece6d8", "#d8c5a3", "#efe9de", "#cfc3ae", "#ddcaa6", "#c7bba8", "#e6d3b6"];
  const wallMats = wallColours.map((c) => new THREE.MeshStandardMaterial({ color: c, map: plaster, roughness: 0.93 }));
  const stoneMat = new THREE.MeshStandardMaterial({
    color: "#f1e6d1",
    map: stone,
    bumpMap: stoneBump,
    bumpScale: 1.2,
    roughness: 0.8,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: "#f3efe7", roughness: 0.75 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: "#2a2d30", roughness: 0.5, metalness: 0.7 });
  const roofMat = new THREE.MeshStandardMaterial({ color: "#9b9286", map: plaster, roughness: 0.98 });
  const [asphaltMap, asphaltRough] = asphaltTexture();
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltMap, roughnessMap: asphaltRough, roughness: 1 });
  const paverMat = new THREE.MeshStandardMaterial({ map: paverTexture(), roughness: 0.88 });
  const dirt = new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 1 });

  /* ---- layout ---- */
  const ROAD = 4.6; // half road width
  const WALK = 7.4; // garden walls stand here
  const FRONT = 10.6; // house fronts stand here
  const crossZ = [-64, -132, -200, -268];
  const nearCross = (z, pad) => crossZ.some((c) => Math.abs(z - c) < pad);

  /* ---- ground, road, pavements ---- */
  {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), dirt);
    g.material.map.repeat.set(400, 400);
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.03;
    g.receiveShadow = true;
    scene.add(g);

    const roadGeo = new THREE.PlaneGeometry(ROAD * 2, 480);
    roadGeo.attributes.uv.array.forEach((v, i, a) => {
      a[i] = i % 2 ? (v * 480) / 10 : (v * ROAD * 2) / 10;
    });
    const road = new THREE.Mesh(roadGeo, asphalt);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -200);
    road.receiveShadow = true;
    scene.add(road);
    for (const z of crossZ) {
      const cg = new THREE.PlaneGeometry(320, 10);
      cg.attributes.uv.array.forEach((v, i, a) => {
        a[i] = i % 2 ? v : v * 32;
      });
      const cr = new THREE.Mesh(cg, asphalt);
      cr.rotation.x = -Math.PI / 2;
      cr.position.set(0, 0.01, z);
      cr.receiveShadow = true;
      scene.add(cr);
    }
    for (const s of [-1, 1]) {
      const walk = new THREE.Mesh(box(WALK - ROAD, 0.16, 480, 3), paverMat);
      walk.position.set((s * (ROAD + WALK)) / 2, 0.08, -200);
      walk.receiveShadow = true;
      scene.add(walk);
    }
  }

  // speed humps painted yellow and black, zebra crossings at the junctions,
  // and a few manhole covers
  {
    const [hc, hg] = canvas(256, 32);
    for (let i = 0; i < 8; i++) {
      hg.fillStyle = i % 2 ? "#1d1d1d" : "#d9a91c";
      hg.fillRect(i * 32, 0, 32, 32);
    }
    const humpMat = new THREE.MeshStandardMaterial({ map: texture(hc, { repeat: false }), roughness: 0.8 });
    const hump = new THREE.CylinderGeometry(0.45, 0.45, ROAD * 2 - 0.2, 20, 1, false, 0, Math.PI);
    hump.rotateZ(Math.PI / 2);
    hump.rotateX(-Math.PI / 2);
    hump.scale(1, 0.22, 1);
    for (const z of [-44, -108, -176, -244]) {
      const h = new THREE.Mesh(hump, humpMat);
      h.position.set(0, 0, z);
      h.receiveShadow = true;
      scene.add(h);
    }
    const zebraMat = new THREE.MeshStandardMaterial({
      color: "#d8d6cf",
      roughness: 0.75,
      transparent: true,
      opacity: 0.85,
    });
    const bars = [];
    for (const cz of crossZ)
      for (const side of [-1, 1]) {
        const zc = cz + side * 6.5;
        for (let x = -ROAD + 0.5; x < ROAD - 0.3; x += 0.9) bars.push([x + 0.25, zc]);
      }
    const zebra = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 2.6), zebraMat, bars.length);
    const zm = new THREE.Matrix4(),
      zq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
      one = new THREE.Vector3(1, 1, 1);
    bars.forEach(([x, z], i) => {
      zm.compose(new THREE.Vector3(x, 0.012, z), zq, one);
      zebra.setMatrixAt(i, zm);
    });
    zebra.receiveShadow = true;
    scene.add(zebra);
    const holeMat = new THREE.MeshStandardMaterial({ color: "#2b2b2c", roughness: 0.45, metalness: 0.6 });
    const holeGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.02, 24);
    for (const [x, z] of [
      [1.4, -36],
      [-2.1, -88],
      [0.6, -150],
      [-1.2, -215],
      [2.0, -290],
    ]) {
      const mh = new THREE.Mesh(holeGeo, holeMat);
      mh.position.set(x, 0.01, z);
      mh.receiveShadow = true;
      scene.add(mh);
    }
  }

  // kerbs painted black and yellow, the way Erbil's are
  {
    const positions = [];
    for (const s of [-1, 1]) for (let z = 40; z > -440; z -= 1.0) if (!nearCross(z, 6)) positions.push([s * ROAD, z]);
    const kerbs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.22, 0.26, 0.98),
      new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      positions.length,
    );
    const m = new THREE.Matrix4();
    const yellow = new THREE.Color("#d9a91c"),
      black = new THREE.Color("#1d1d1d");
    positions.forEach(([x, z], i) => {
      m.makeTranslation(x, 0.13, z);
      kerbs.setMatrixAt(i, m);
      kerbs.setColorAt(i, Math.round(z) % 2 === 0 ? yellow : black);
    });
    kerbs.receiveShadow = true;
    scene.add(kerbs);
  }

  /* ---- houses ---- */
  const houses = [];
  const windows = [];
  const acUnits = [];
  const tanks = [];
  const dishes = [];
  const frames = [];
  const solar = [];
  const pv = [];
  const gates = [];
  const shutters = [];

  // A balcony: a concrete slab with a thin edge, and either a solid parapet
  // (the most common in Erbil) or a painted steel balustrade with posts,
  // top rail and side returns back to the wall.
  function addBalcony(g, faceX, side, floorY, z, bw, wallMat) {
    const D = 1.2;
    const out = (d) => faceX - side * d;
    const slab = new THREE.Mesh(box(D, 0.16, bw, 2), trimMat);
    slab.position.set(out(D / 2), floorY + 0.02, z);
    slab.castShadow = slab.receiveShadow = true;
    g.add(slab);
    const soffit = new THREE.Mesh(box(D - 0.06, 0.02, bw - 0.06, 2), stoneMat);
    soffit.position.set(out(D / 2), floorY - 0.07, z);
    g.add(soffit);
    if (rand() < 0.55) {
      // solid parapet, same finish as the house, with a light coping
      for (const [px, pw, pd, pz] of [
        [out(D - 0.06), 0.12, bw, z],
        [out(D / 2), D - 0.12, 0.12, z - bw / 2 + 0.06],
        [out(D / 2), D - 0.12, 0.12, z + bw / 2 - 0.06],
      ]) {
        const p = new THREE.Mesh(box(pw, 0.95, pd, 2), wallMat);
        p.position.set(px, floorY + 0.1 + 0.475, pz);
        p.castShadow = true;
        g.add(p);
        const cap = new THREE.Mesh(box(pw + 0.06, 0.05, pd + 0.06, 2), trimMat);
        cap.position.set(px, floorY + 1.08, pz);
        g.add(cap);
      }
    } else {
      const H = 1.0,
        y0 = floorY + 0.1;
      const railGeo = [];
      const add = (geo, x, y, zz) => {
        geo.translate(x, y, zz);
        railGeo.push(geo);
      };
      // top rail and bottom rail along the front and both sides
      for (const yy of [y0 + H, y0 + 0.08]) {
        add(new THREE.BoxGeometry(0.05, 0.04, bw), out(D - 0.04), yy, z);
        for (const sz of [-1, 1]) add(new THREE.BoxGeometry(D, 0.04, 0.05), out(D / 2), yy, z + sz * (bw / 2 - 0.03));
      }
      // vertical bars, every 12 cm
      for (let b = -bw / 2 + 0.06; b <= bw / 2 - 0.06; b += 0.12)
        add(new THREE.BoxGeometry(0.018, H, 0.018), out(D - 0.04), y0 + H / 2, z + b);
      for (const sz of [-1, 1])
        for (let d = 0.12; d < D - 0.05; d += 0.12)
          add(new THREE.BoxGeometry(0.018, H, 0.018), out(d), y0 + H / 2, z + sz * (bw / 2 - 0.03));
      const rail = new THREE.Mesh(mergeGeometries(railGeo), darkMetal);
      rail.castShadow = true;
      g.add(rail);
    }
  }

  function addHouse(cx, cz, side, depth, width, floors, row) {
    const h = floors * 3.3;
    const g = new THREE.Group();
    const clad = rand() < 0.38;
    const mat = clad ? stoneMat : pick(wallMats);
    const body = new THREE.Mesh(box(depth, h, width, 4), mat);
    body.position.set(cx, h / 2, cz);
    body.castShadow = body.receiveShadow = true;
    g.add(body);

    // a plinth of darker stone at the bottom
    const plinth = new THREE.Mesh(box(depth + 0.08, 0.7, width + 0.08, 2), stoneMat);
    plinth.position.set(cx, 0.35, cz);
    plinth.material = stoneMat;
    g.add(plinth);

    // flat roof surface and a parapet with a light coping
    const roof = new THREE.Mesh(box(depth - 0.3, 0.1, width - 0.3, 4), roofMat);
    roof.position.set(cx, h + 0.05, cz);
    roof.receiveShadow = true;
    g.add(roof);
    const pt = 0.25,
      ph = 1.05;
    for (const [w, d, x, z] of [
      [depth, pt, cx, cz - width / 2 + pt / 2],
      [depth, pt, cx, cz + width / 2 - pt / 2],
      [pt, width, cx - depth / 2 + pt / 2, cz],
      [pt, width, cx + depth / 2 - pt / 2, cz],
    ]) {
      const p = new THREE.Mesh(box(w, ph, d, 4), mat);
      p.position.set(x, h + ph / 2, z);
      p.castShadow = true;
      g.add(p);
      const cap = new THREE.Mesh(box(w + 0.1, 0.08, d + 0.1, 2), trimMat);
      cap.position.set(x, h + ph + 0.04, z);
      g.add(cap);
    }
    // floor bands on plastered houses
    if (!clad && rand() < 0.6) {
      for (let f = 1; f < floors; f++) {
        const band = new THREE.Mesh(box(depth + 0.14, 0.24, width + 0.14, 2), trimMat);
        band.position.set(cx, f * 3.3, cz);
        g.add(band);
      }
    }
    // stair room on the roof
    let stair = null;
    if (rand() < 0.5) {
      const sr = new THREE.Mesh(box(3, 2.6, 3.4, 4), mat);
      sr.position.set(cx + between(-depth / 4, depth / 4), h + 1.3, cz + between(-width / 4, width / 4));
      sr.castShadow = true;
      g.add(sr);
      stair = { x: sr.position.x, z: sr.position.z };
    }

    // the street-facing facade
    const faceX = cx - (side * depth) / 2;
    const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const perFloor = width > 10.5 ? 3 : 2;
    for (let f = 0; f < floors; f++) {
      // Upper floors on the street side sometimes get a balcony in front of
      // one window column. That window becomes a tall balcony door.
      const balK = f > 0 && row === 0 && rand() < 0.45 ? Math.floor(rand() * perFloor) : -1;
      for (let k = 0; k < perFloor; k++) {
        const z = cz - width / 2 + (width / perFloor) * (k + 0.5);
        const isDoor = k === balK;
        const y = isDoor ? f * 3.3 + 1.3 : f * 3.3 + 1.75;
        const w = isDoor ? 1.3 : 1.5,
          hh = isDoor ? 2.35 : 1.6;
        const type = f === 0 ? 2 : isDoor ? 0 : rand() < 0.25 ? 3 : rand() < 0.5 ? 0 : 1;
        windows.push({ x: faceX - side * 0.02, y, z, rotY, w, h: hh, house: houses.length, type });
        frames.push({ x: faceX - side * 0.07, y, z, rotY, w, h: hh });
        if (f > 0 && !isDoor && rand() < 0.4)
          acUnits.push({ x: faceX - side * 0.2, y: y - 1.3, z: z + 0.55 * (rand() < 0.5 ? 1 : -1), rotY });
        if (isDoor) addBalcony(g, faceX, side, f * 3.3, z, Math.min(width / perFloor - 0.4, 3.4), mat);
      }
    }
    // garden wall and a steel gate on the street side (front row only)
    if (row === 0) {
      const wallMat = rand() < 0.5 ? stoneMat : mat;
      const wx = side * WALK;
      const gateW = 3.2;
      const gz = cz + between(-width / 2 + gateW, width / 2 - gateW);
      for (const [z0, z1] of [
        [cz - width / 2, gz - gateW / 2],
        [gz + gateW / 2, cz + width / 2],
      ]) {
        const len = z1 - z0;
        if (len < 0.2) continue;
        const w = new THREE.Mesh(box(0.3, 2.3, len, 2), wallMat);
        w.position.set(wx + side * 0.15, 1.15, (z0 + z1) / 2);
        w.castShadow = w.receiveShadow = true;
        g.add(w);
        const cap = new THREE.Mesh(box(0.42, 0.1, len, 2), trimMat);
        cap.position.set(wx + side * 0.15, 2.35, (z0 + z1) / 2);
        g.add(cap);
      }
      gates.push({ x: wx + side * 0.15, z: gz, w: gateW, colour: pick(["#2d3b30", "#1f2226", "#3a2a22", "#253040"]) });
      // a shop on the ground floor of some houses
      if (rand() < 0.3 && cz > -200)
        shutters.push({ x: faceX - side * 0.03, z: cz + width * 0.22, rotY, w: 3.2, house: houses.length });
    }

    // rooftop solar: more and more Erbil houses put panels on a raised steel
    // frame, which also shades the roof in summer. The panels get a band of
    // the roof to themselves, clear of the stair room; tanks and dishes go
    // elsewhere.
    let band = null;
    if (rand() < 0.42) {
      const rows = rand() < 0.4 ? 2 : 1;
      const span = rows * 3.4;
      // try the half of the roof away from the stair room
      const zc = stair ? (stair.z > cz ? cz - width / 4 : cz + width / 4) : cz + between(-width / 6, width / 6);
      if (width > span + 2.5) {
        band = { z0: zc - span / 2 - 0.3, z1: zc + span / 2 + 0.3 };
        pv.push({ cx, cz: zc, depth, width: span + 0.6, y: h + 0.1, rows });
      }
    }
    const freeSpot = (r) => {
      for (let t = 0; t < 12; t++) {
        const x = cx + between(-depth / 2 + r, depth / 2 - r),
          z = cz + between(-width / 2 + r, width / 2 - r);
        if (band && z > band.z0 - r && z < band.z1 + r) continue;
        if (stair && Math.abs(x - stair.x) < 1.5 + r && Math.abs(z - stair.z) < 1.7 + r) continue;
        return [x, z];
      }
      return null;
    };
    // roof clutter
    const nTanks = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < nTanks; i++) {
      const spot = freeSpot(1.3);
      if (!spot) continue;
      tanks.push({
        x: spot[0],
        y: h + 0.1,
        z: spot[1],
        colour: pick(["#f1f0ea", "#f1f0ea", "#ecebe4", "#1d1e20", "#2c5c9e", "#e4dcc6"]),
        r: between(0.55, 0.7),
      });
    }
    const nDish = rand() < 0.8 ? 1 + Math.floor(rand() * 2) : 0;
    for (let i = 0; i < nDish; i++) {
      const sp = freeSpot(0.8);
      if (sp) dishes.push({ x: sp[0], y: h + 0.1, z: sp[1], s: between(0.8, 1.2) });
    }
    if (rand() < 0.25 && !band) {
      const sp = freeSpot(1.4);
      if (sp) solar.push({ x: sp[0], y: h + 0.1, z: sp[1] });
    }

    scene.add(g);
    houses.push({ group: g, cx, cz, side, row, top: h, faceX, block: side < 0 && cz < -16 && cz > -62 });
  }

  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      let z = 36;
      while (z > -330) {
        const width = between(9.5, 12.5);
        const depth = between(10, 13);
        const floors = row === 0 ? (rand() < 0.55 ? 2 : 3) : rand() < 0.45 ? 2 : 3;
        const cz = z - width / 2;
        if (nearCross(cz, width / 2 + 5.5)) {
          z -= 12;
          continue;
        }
        const cx = side * (FRONT + depth / 2 + row * 18 + (row ? between(-1, 1) : 0));
        addHouse(cx, cz, side, depth, width, floors, row);
        z -= width + between(0.3, 1.2);
      }
    }
  }

  /* ---- windows: one instanced mesh, light per window via a shader tweak ---- */
  const winTex = windowTextures();
  const winMat = new THREE.MeshStandardMaterial({
    map: winTex.map,
    emissiveMap: winTex.glow,
    emissive: 0xffffff,
    roughnessMap: winTex.rough,
    roughness: 1,
    metalness: 0.1,
  });
  winMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 aGlow;\nattribute vec2 aCell;\nvarying vec3 vGlow;",
      )
      .replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\nvMapUv = uv * 0.5 + aCell; vEmissiveMapUv = vMapUv; vRoughnessMapUv = vMapUv;\nvGlow = aGlow;",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGlow;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;");
  };
  const WARM = ["#ffbe6a", "#ffb35a", "#ffc97f", "#ffd59a", "#ffc070", "#cfdcff"].map((c) => new THREE.Color(c));
  const winMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), winMat, windows.length);
  const glowAttr = new THREE.InstancedBufferAttribute(new Float32Array(windows.length * 3), 3);
  const cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(windows.length * 2), 2);
  winMesh.geometry.setAttribute("aGlow", glowAttr);
  winMesh.geometry.setAttribute("aCell", cellAttr);
  const CELLS = [
    [0, 0.5],
    [0.5, 0.5],
    [0, 0],
    [0.5, 0],
  ]; // canvas y is flipped
  const winNow = [],
    winWant = [];
  {
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion();
    windows.forEach((w, i) => {
      q.setFromEuler(new THREE.Euler(0, w.rotY, 0));
      m.compose(new THREE.Vector3(w.x, w.y, w.z), q, new THREE.Vector3(w.w, w.h, 1));
      winMesh.setMatrixAt(i, m);
      cellAttr.setXY(i, CELLS[w.type][0], CELLS[w.type][1]);
      w.lit = rand() < 0.68;
      w.warm = pick(WARM).clone().multiplyScalar(between(2.2, 3.4));
      const c = w.lit ? w.warm.clone() : new THREE.Color(0, 0, 0);
      winNow.push(c.clone());
      winWant.push(c.clone());
      glowAttr.setXYZ(i, c.r, c.g, c.b);
    });
  }
  winMesh.receiveShadow = true;
  scene.add(winMesh);

  // window frames stick out a little, so each window looks set into the wall
  {
    const parts = [];
    const t = 0.1,
      d = 0.14;
    for (const [w, h, x, y] of [
      [1 + t * 2, t, 0, 0.5 + t / 2],
      [1 + t * 2, t * 1.6, 0, -0.5 - t * 0.8],
      [t, 1, -0.5 - t / 2, 0],
      [t, 1, 0.5 + t / 2, 0],
    ]) {
      const b = new THREE.BoxGeometry(w, h, d);
      b.translate(x, y, d / 2);
      parts.push(b);
    }
    const geo = mergeGeometries(parts);
    const inst = new THREE.InstancedMesh(geo, trimMat, frames.length);
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion();
    frames.forEach((f, i) => {
      q.setFromEuler(new THREE.Euler(0, f.rotY, 0));
      m.compose(new THREE.Vector3(f.x, f.y, f.z), q, new THREE.Vector3(f.w, f.h, 1));
      inst.setMatrixAt(i, m);
    });
    inst.castShadow = true;
    scene.add(inst);
  }

  // split AC units under the windows
  {
    const [c, g] = canvas(128, 96);
    g.fillStyle = "#e9e7e1";
    g.fillRect(0, 0, 128, 96);
    g.fillStyle = "#2b2b2b";
    g.beginPath();
    g.arc(80, 48, 34, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#8a8a8a";
    g.lineWidth = 2;
    for (let r = 8; r < 34; r += 6) {
      g.beginPath();
      g.arc(80, 48, r, 0, Math.PI * 2);
      g.stroke();
    }
    for (let y = 14; y < 86; y += 6) {
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(8, y, 30, 2);
    }
    noise(g, 128, 96, 10);
    const front = new THREE.MeshStandardMaterial({ map: texture(c, { repeat: false }), roughness: 0.55 });
    const side = new THREE.MeshStandardMaterial({ color: "#e4e2dc", roughness: 0.55 });
    const geo = new THREE.BoxGeometry(0.85, 0.6, 0.32);
    const inst = new THREE.InstancedMesh(geo, [side, side, side, side, front, side], acUnits.length);
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion();
    acUnits.forEach((a, i) => {
      q.setFromEuler(new THREE.Euler(0, a.rotY, 0));
      m.compose(new THREE.Vector3(a.x, a.y, a.z), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(i, m);
    });
    inst.castShadow = true;
    scene.add(inst);
  }

  // rooftop water tanks: ribbed plastic drums with a domed lid, on steel stands
  {
    const prof = [];
    const H = 1.25;
    prof.push(new THREE.Vector2(0, 0));
    for (let i = 0; i <= 24; i++) {
      const y = (i / 24) * H;
      const rib = Math.sin((i / 24) * Math.PI * 6) * 0.02;
      prof.push(new THREE.Vector2(0.98 + rib, y));
    }
    prof.push(new THREE.Vector2(0.9, H + 0.08));
    prof.push(new THREE.Vector2(0.45, H + 0.18));
    prof.push(new THREE.Vector2(0.3, H + 0.22));
    prof.push(new THREE.Vector2(0, H + 0.22));
    const geo = new THREE.LatheGeometry(prof, 20);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.42 }), tanks.length);
    const stand = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.5, 1), darkMetal, tanks.length);
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion();
    tanks.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, t.y + 0.5, t.z), q, new THREE.Vector3(t.r, t.r, t.r));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, new THREE.Color(t.colour));
      m.compose(new THREE.Vector3(t.x, t.y + 0.25, t.z), q, new THREE.Vector3(t.r * 2.1, 1, t.r * 2.1));
      stand.setMatrixAt(i, m);
    });
    inst.castShadow = stand.castShadow = true;
    scene.add(inst, stand);
  }

  // satellite dishes, all aimed at the same satellites
  {
    const dishGeo = new THREE.SphereGeometry(0.5, 20, 8, 0, Math.PI * 2, 0, 0.7);
    dishGeo.rotateX(-Math.PI / 2);
    dishGeo.scale(1, 1, 0.55);
    const armGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5);
    armGeo.rotateX(Math.PI / 2);
    armGeo.translate(0, -0.1, 0.32);
    const lnb = new THREE.BoxGeometry(0.08, 0.08, 0.12);
    lnb.translate(0, -0.1, 0.65);
    const dishAll = mergeGeometries(
      [dishGeo, armGeo.toNonIndexed ? armGeo : armGeo, lnb].map((g) => (g.index ? g.toNonIndexed() : g)),
    );
    const inst = new THREE.InstancedMesh(
      dishAll,
      new THREE.MeshStandardMaterial({ color: "#e4e4e0", roughness: 0.4, metalness: 0.25, side: THREE.DoubleSide }),
      dishes.length,
    );
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.05, 1, 6), darkMetal, dishes.length);
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion();
    const aim = new THREE.Euler(-0.75, Math.PI * 0.85, 0);
    dishes.forEach((d, i) => {
      q.setFromEuler(aim);
      m.compose(new THREE.Vector3(d.x, d.y + 1.05, d.z), q, new THREE.Vector3(d.s, d.s, d.s));
      inst.setMatrixAt(i, m);
      m.makeTranslation(d.x, d.y + 0.5, d.z);
      poles.setMatrixAt(i, m);
    });
    inst.castShadow = true;
    scene.add(inst, poles);
  }

  // solar water heaters: a tilted tube panel and a drum
  {
    const [c, g] = canvas(256, 128);
    g.fillStyle = "#1a1c20";
    g.fillRect(0, 0, 256, 128);
    for (let x = 4; x < 256; x += 12) {
      const lg = g.createLinearGradient(x, 0, x + 9, 0);
      lg.addColorStop(0, "#2a3140");
      lg.addColorStop(0.5, "#8995a8");
      lg.addColorStop(1, "#2a3140");
      g.fillStyle = lg;
      g.fillRect(x, 0, 9, 128);
    }
    const panelMat = new THREE.MeshStandardMaterial({
      map: texture(c, { repeat: false }),
      roughness: 0.2,
      metalness: 0.5,
    });
    const drumMat = new THREE.MeshStandardMaterial({ color: "#d9d9d6", roughness: 0.35, metalness: 0.6 });
    solar.forEach((s) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2, 0.05, 1.6), panelMat);
      p.position.set(s.x, s.y + 0.7, s.z);
      p.rotation.x = -0.6;
      p.castShadow = true;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2, 14), drumMat);
      d.rotation.z = Math.PI / 2;
      d.position.set(s.x, s.y + 1.3, s.z - 0.7);
      d.castShadow = true;
      scene.add(p, d);
    });
  }

  // solar panel arrays on raised frames, tilted towards the street
  if (pv.length) {
    const [tc, tg] = canvas(128, 256);
    tg.fillStyle = "#b9bec4";
    tg.fillRect(0, 0, 128, 256);
    tg.fillStyle = "#0f2142";
    tg.fillRect(5, 5, 118, 246);
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 12; j++) {
        const l = 14 + Math.random() * 6;
        tg.fillStyle = `hsl(218, 55%, ${l}%)`;
        tg.fillRect(7 + i * 19.3, 7 + j * 20.3, 18, 19);
      }
    tg.fillStyle = "rgba(255,255,255,0.06)";
    for (let j = 0; j < 12; j++) tg.fillRect(7, 7 + j * 20.3 + 9, 114, 1);
    const pvMat = new THREE.MeshStandardMaterial({
      map: texture(tc, { repeat: false }),
      roughness: 0.22,
      metalness: 0.35,
      envMapIntensity: 1.2,
    });
    const frameMat2 = new THREE.MeshStandardMaterial({ color: "#8d949b", roughness: 0.5, metalness: 0.7 });
    const PW = 1.13,
      PL = 2.28,
      tilt = 0.52;
    const panels = [],
      legs = [];
    pv.forEach((a) => {
      const cols = Math.max(2, Math.min(7, Math.floor((a.depth - 2.5) / (PW + 0.03))));
      for (let r = 0; r < a.rows; r++) {
        const z0 = a.cz + (r - (a.rows - 1) / 2) * 3.4;
        const base = a.y + 1.1;
        for (let c = 0; c < cols; c++) {
          const x = a.cx + (c - (cols - 1) / 2) * (PW + 0.03);
          panels.push([x, base + (Math.sin(tilt) * PL) / 2, z0]);
        }
        // a leg at each end and every two panels: short at the front, tall at the back
        for (let c = 0; c <= cols; c += 2) {
          const x = a.cx + (c - cols / 2) * (PW + 0.03);
          legs.push([x, a.y, z0 + (Math.cos(tilt) * PL) / 2 - 0.1, 1.1]);
          legs.push([x, a.y, z0 - (Math.cos(tilt) * PL) / 2 + 0.1, 1.1 + Math.sin(tilt) * PL]);
        }
      }
    });
    const pg = new THREE.BoxGeometry(PW, 0.04, PL);
    const pInst = new THREE.InstancedMesh(
      pg,
      [frameMat2, frameMat2, pvMat, frameMat2, frameMat2, frameMat2],
      panels.length,
    );
    const mm = new THREE.Matrix4(),
      q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0)),
      one = new THREE.Vector3(1, 1, 1);
    panels.forEach(([x, y, z], i) => {
      mm.compose(new THREE.Vector3(x, y, z), q, one);
      pInst.setMatrixAt(i, mm);
    });
    pInst.castShadow = true;
    pInst.receiveShadow = true;
    scene.add(pInst);
    const lInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 1, 0.06), frameMat2, legs.length);
    const q0 = new THREE.Quaternion();
    legs.forEach(([x, y, z, hgt], i) => {
      mm.compose(new THREE.Vector3(x, y + hgt / 2, z), q0, new THREE.Vector3(1, hgt, 1));
      lInst.setMatrixAt(i, mm);
    });
    lInst.castShadow = true;
    scene.add(lInst);
  }

  // gates in the garden walls
  {
    const mats = {};
    gates.forEach((gt) => {
      const mat =
        mats[gt.colour] ||
        (mats[gt.colour] = new THREE.MeshStandardMaterial({
          map: gateTexture(gt.colour),
          roughness: 0.55,
          metalness: 0.5,
        }));
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, gt.w), mat);
      g.position.set(gt.x, 1.15, gt.z);
      g.castShadow = true;
      scene.add(g);
      for (const dz of [-gt.w / 2 - 0.2, gt.w / 2 + 0.2]) {
        const p = new THREE.Mesh(box(0.5, 2.8, 0.4, 2), stoneMat);
        p.position.set(gt.x, 1.4, gt.z + dz);
        p.castShadow = true;
        scene.add(p);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 10, 8),
          new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd7a0").multiplyScalar(2.2), toneMapped: false }),
        );
        lamp.position.set(gt.x, 3.0, gt.z + dz);
        scene.add(lamp);
      }
    });
  }

  /* ---- street lamps and the pools of light under them ---- */
  const lampHeads = [];
  const lampLights = [];
  const poolTex = lightPoolTexture();
  {
    const pole = new THREE.CylinderGeometry(0.08, 0.14, 9, 10);
    const head = new THREE.BoxGeometry(0.75, 0.18, 0.34);
    const headLight = new THREE.Color("#ffad5e").multiplyScalar(2.2);
    let i = 0;
    for (let z = 20; z > -340; z -= 26, i++) {
      if (nearCross(z, 7)) continue;
      const s = i % 2 ? 1 : -1;
      const p = new THREE.Mesh(pole, darkMetal);
      p.position.set(s * (ROAD + 0.5), 4.5, z);
      p.castShadow = true;
      const arm = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(s * (ROAD + 0.5), 8.9, z),
            new THREE.Vector3(s * (ROAD + 0.4), 9.6, z),
            new THREE.Vector3(s * (ROAD - 1.5), 9.4, z),
          ),
          10,
          0.05,
          5,
        ),
        darkMetal,
      );
      const hd = new THREE.Mesh(head, new THREE.MeshBasicMaterial({ color: headLight.clone(), toneMapped: false }));
      hd.position.set(s * (ROAD - 1.6), 9.32, z);
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 16),
        new THREE.MeshBasicMaterial({
          map: poolTex,
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(s * (ROAD - 1.6), 0.05, z);
      scene.add(p, arm, hd, pool);
      lampHeads.push({ mesh: hd, side: s, z, on: headLight.clone(), pool });
      if (lampLights.length < (lowPower ? 3 : 7)) {
        const l = new THREE.PointLight("#ff9f4d", 85, 28, 2);
        l.position.set(s * (ROAD - 1.6), 8.9, z);
        scene.add(l);
        lampLights.push({ light: l, side: s, z, base: 85 });
      }
    }
  }

  /* ---- the neighbourhood generator and its web of cables ---- */
  const genGroup = new THREE.Group();
  const cableMat = new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.6, transparent: true });
  {
    const [c, g] = canvas(256, 128);
    g.fillStyle = "#3f6b4d";
    g.fillRect(0, 0, 256, 128);
    for (let x = 20; x < 236; x += 10) {
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(x, 30, 5, 60);
    }
    g.fillStyle = "#e8c22a";
    g.fillRect(200, 10, 40, 16);
    noise(g, 256, 128, 22);
    blotches(g, 256, 128, 10, true, 0.3, 0.2);
    const genMat = new THREE.MeshStandardMaterial({
      map: texture(c, { repeat: false }),
      roughness: 0.6,
      metalness: 0.4,
      transparent: true,
    });
    const gen = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 6.5), genMat);
    gen.position.set(ROAD + 3.2, 1.3, -14);
    gen.castShadow = true;
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: "#1d1d1d", roughness: 0.4, transparent: true }),
    );
    pipe.position.set(ROAD + 3.2, 3.8, -16.4);
    genGroup.add(gen, pipe);

    const relays = [
      new THREE.Vector3(ROAD + 0.9, 9.6, -12),
      new THREE.Vector3(-ROAD - 0.9, 9.4, -44),
      new THREE.Vector3(ROAD + 0.9, 9.4, -84),
      new THREE.Vector3(-ROAD - 0.9, 9.4, -112),
      new THREE.Vector3(ROAD + 0.9, 9.4, -156),
      new THREE.Vector3(-ROAD - 0.9, 9.4, -186),
    ];
    const poleMat = new THREE.MeshStandardMaterial({ color: "#5b5047", roughness: 0.9, transparent: true });
    relays.forEach((p) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, p.y + 0.6, 8), poleMat);
      pole.position.set(p.x, (p.y + 0.6) / 2, p.z);
      pole.castShadow = true;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), poleMat);
      bar.position.set(p.x, p.y, p.z);
      genGroup.add(pole, bar);
    });
    const geos = [];
    for (let i = 0; i < relays.length - 1; i++) {
      for (let k = 0; k < 7; k++) {
        const off = new THREE.Vector3(between(-0.2, 0.2), between(-0.25, 0.15), between(-0.7, 0.7));
        geos.push(cable(relays[i].clone().add(off), relays[i + 1].clone().add(off), between(1.3, 2.4)));
      }
    }
    geos.push(
      cable(new THREE.Vector3(ROAD + 3.2, 2.6, -11.5), relays[0].clone().add(new THREE.Vector3(0, -0.5, 0)), 0.5, 0.06),
    );
    houses
      .filter((h) => h.row === 0 && h.cz > -200)
      .forEach((h) => {
        let best = relays[0],
          bd = 1e9;
        relays.forEach((r) => {
          const d = Math.abs(r.z - h.cz) + (Math.sign(r.x) === h.side ? 0 : 8);
          if (d < bd) {
            bd = d;
            best = r;
          }
        });
        const n = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          const end = new THREE.Vector3(
            h.faceX - h.side * 0.05,
            between(5.4, Math.min(h.top - 0.5, 8.8)),
            h.cz + between(-3.5, 3.5),
          );
          const len = best.distanceTo(end);
          geos.push(
            cable(
              best.clone().add(new THREE.Vector3(0, between(-0.4, 0.1), between(-0.6, 0.6))),
              end,
              0.5 + len * 0.05,
              between(0.025, 0.04),
            ),
          );
        }
      });
    const web = new THREE.Mesh(mergeGeometries(geos), cableMat);
    web.castShadow = true;
    genGroup.add(web);
  }
  scene.add(genGroup);

  /* ---- cars: mostly white and silver Camrys, Avalons and Altimas, a Land Cruiser,
          and two driving with their lights on ---- */
  {
    const spec = [
      [-3.3, -26, "camry", "#f3f3f0", 0],
      [3.3, -38, "altima", "#c3c6c9", 0],
      [-3.3, -73, "avalon", "#16181b", 0],
      [3.3, -101, "camry", "#f3f3f0", 0],
      [-3.3, -146, "altima", "#6d1a18", 0],
      [3.3, -176, "cruiser", "#f3f3f0", 0],
      [3.3, -19, "avalon", "#f3f3f0", 0],
      [-3.3, -6, "camry", "#b4b8bb", 0],
      [3.3, 8, "camry", "#2b2f34", 0],
      [-3.3, -118, "camry", "#f3f3f0", 0],
      [3.3, -128, "altima", "#f3f3f0", 0],
      [-1.35, -90, "camry", "#ecece8", 1],
      [1.35, -158, "altima", "#9a9ea1", -1],
    ];
    spec.forEach(([x, z, model, colour, driving]) => {
      const car = makeCar(model, colour, { lights: !!driving });
      if (driving) {
        const beam = new THREE.Mesh(
          new THREE.PlaneGeometry(3.4, 11),
          new THREE.MeshBasicMaterial({
            map: poolTex,
            color: "#ffe9c4",
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        beam.rotation.x = -Math.PI / 2;
        beam.position.set(0, 0.05, 7.5);
        car.add(beam);
      }
      if (!driving) parked.push({ car, model, colour });
      car.position.set(x, 0, z);
      car.rotation.y = driving === -1 ? Math.PI : driving === 1 ? 0 : between(-0.03, 0.03) + (x > 0 ? Math.PI : 0);
      scene.add(car);
    });
  }

  /* ---- trees along the pavement ---- */
  [
    [-5.8, -31],
    [5.8, -57],
    [-5.8, -95],
    [5.8, -121],
    [-5.8, -163],
    [5.8, -6],
    [-5.8, 12],
    [5.8, -190],
  ].forEach(([x, z]) => {
    const t = makeTree(rand, between(5.5, 7));
    t.position.set(x, 0, z);
    t.rotation.y = rand() * Math.PI * 2;
    scene.add(t);
  });

  /* ---- shop shutters and signs (lights go off in the dark block) ---- */
  {
    const shut = new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.5, metalness: 0.6 });
    const signColours = ["#2fbf71", "#e8423a", "#2b8be8", "#f2c230", "#ffffff"];
    shutters.forEach((s) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(s.w, 2.7), shut);
      p.rotation.y = s.rotY;
      p.position.set(s.x, 1.45, s.z);
      scene.add(p);
      const c = new THREE.Color(pick(signColours)).multiplyScalar(1.8);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.75, s.w + 1.2),
        new THREE.MeshBasicMaterial({ color: c, toneMapped: false }),
      );
      sign.position.set(s.x - Math.sign(s.x) * 0.1, 3.2, s.z);
      scene.add(sign);
      if (houses[s.house].block) lampHeads.push({ mesh: sign, side: -1, z: -30, on: c.clone(), sign: true });
    });
  }

  // Everything that makes up the Citadel, so a detailed model can replace it.
  const citadel = new THREE.Group();
  scene.add(citadel);

  /* ================================================================ */
  /* the Citadel                                                       */
  /*   430 x 340 m oval mound rising 25-32 m with 45-degree slopes,    */
  /*   crowned by an unbroken ring of about a hundred old brick house  */
  /*   facades, some with buttresses. The great south gate faces the   */
  /*   city with a broad stair-ramp; the flag flies over it. At night  */
  /*   the walls are floodlit from the foot of the slope.              */
  /* ================================================================ */
  {
    const cx = -20,
      cz = -620,
      rx = 215,
      rz = 170,
      H = 30;
    const [brick, brickBump] = brickTexture();

    // slope texture: packed earth, erosion runnels and patches of grass,
    // brighter near the bottom where the floodlights stand
    const S = 1024;
    const [sc, sg] = canvas(S, 256);
    sg.fillStyle = "#86694f";
    sg.fillRect(0, 0, S, 256);
    noise(sg, S, 256, 36);
    // packed earth with stones, a few runnels and tufts of dry grass
    for (let i = 0; i < 2600; i++) {
      const l = 25 + Math.random() * 30;
      sg.fillStyle = `hsla(${22 + Math.random() * 14}, ${25 + Math.random() * 20}%, ${l}%, ${0.25 + Math.random() * 0.4})`;
      sg.beginPath();
      sg.ellipse(
        Math.random() * S,
        Math.random() * 256,
        1 + Math.random() * 4,
        1 + Math.random() * 3,
        Math.random() * 3,
        0,
        Math.PI * 2,
      );
      sg.fill();
    }
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * S,
        h = 30 + Math.random() * 120;
      sg.fillStyle = `rgba(55,35,22,${0.06 + Math.random() * 0.08})`;
      sg.fillRect(x, 256 - h - Math.random() * 60, 1 + Math.random() * 2, h);
    }
    for (let i = 0; i < 900; i++) {
      sg.fillStyle = `rgba(${120 + Math.random() * 40},${105 + Math.random() * 30},55,${0.3 + Math.random() * 0.3})`;
      sg.fillRect(Math.random() * S, 60 + Math.random() * 196, 1, 2 + Math.random() * 3);
    }
    const slopeMap = texture(sc);
    slopeMap.repeat.set(24, 2);
    const [ec, eg] = canvas(16, 256);
    const lg = eg.createLinearGradient(0, 256, 0, 0);
    lg.addColorStop(0, "rgba(255,170,90,1)");
    lg.addColorStop(0.45, "rgba(255,150,70,0.35)");
    lg.addColorStop(1, "rgba(255,140,60,0.1)");
    eg.fillStyle = lg;
    eg.fillRect(0, 0, 16, 256);
    const slopeGlow = texture(ec);

    const prof = [];
    prof.push(new THREE.Vector2(1.17, 0));
    for (let i = 1; i <= 24; i++) {
      const k = i / 24;
      prof.push(new THREE.Vector2(1.16 - k * 0.15 - Math.sin(k * Math.PI) * 0.014, k * 0.985));
    }
    prof.push(new THREE.Vector2(1.0, 1));
    prof.push(new THREE.Vector2(0, 1));
    const mg = new THREE.LatheGeometry(prof, 260);
    // erosion: push the surface in and out a little around the ring
    const mp = mg.attributes.position;
    for (let i = 0; i < mp.count; i++) {
      const x = mp.getX(i),
        y = mp.getY(i),
        z = mp.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 0.9 || y > 0.99) continue;
      const a = Math.atan2(z, x);
      // lumps, gullies and slumped patches, stronger halfway down the slope
      const mid = Math.sin(Math.min(1, y) * Math.PI);
      const n =
        1 +
        (Math.sin(a * 37) * 0.004 +
          Math.sin(a * 91 + y * 7) * 0.004 +
          Math.sin(a * 13 + y * 3) * 0.006 +
          Math.sin(a * 211 + y * 19) * 0.0025 +
          (Math.random() - 0.5) * 0.006) *
          (0.5 + mid);
      mp.setXYZ(i, x * n, y * (1 + (Math.random() - 0.5) * 0.01 * mid), z * n);
    }
    mg.scale(rx, H, rz);
    mg.computeVertexNormals();
    const slope = new THREE.MeshStandardMaterial({
      color: "#cbbca9",
      map: slopeMap,
      roughness: 1,
      flatShading: true,
      emissive: new THREE.Color("#e6b07a"),
      emissiveMap: slopeGlow,
      emissiveIntensity: 0.1,
    });
    const mound = new THREE.Mesh(mg, slope);
    mound.position.set(cx, 0, cz);
    mound.receiveShadow = true;
    citadel.add(mound);

    // The outer wall: about 60 joined houses, each its own height and a
    // little in front of or behind its neighbours, with a light coping on
    // top and a timber ledge on some. The facade texture sits on the outside.
    const [fac, facGlow, facBump] = citadelFacadeTexture();
    const facMat = new THREE.MeshStandardMaterial({
      map: fac,
      emissiveMap: facGlow,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.4,
      roughness: 0.92,
      bumpMap: facBump,
      bumpScale: 0.6,
    });
    const plainMat = new THREE.MeshStandardMaterial({
      map: brick,
      color: "#e0b07c",
      roughness: 0.95,
      emissive: new THREE.Color("#ff9a50"),
      emissiveIntensity: 0.08,
    });
    const roofMat2 = new THREE.MeshStandardMaterial({ color: "#7a5f48", roughness: 1 });
    const copeMat = new THREE.MeshStandardMaterial({
      color: "#efc996",
      roughness: 0.9,
      emissive: new THREE.Color("#ffb070"),
      emissiveIntensity: 0.12,
    });
    const woodMat = new THREE.MeshStandardMaterial({ color: "#5a3b24", roughness: 0.85 });
    const ringPoint = (a, k = 1) => new THREE.Vector3(cx + Math.cos(a) * rx * k, 0, cz + Math.sin(a) * rz * k);
    const outward = (p) => new THREE.Vector3(p.x - cx, 0, (p.z - cz) * (rx / rz) * (rx / rz)).normalize();
    // five slightly different plaster/brick tones, so neighbouring houses
    // never match exactly
    const facVariants = ["#ffffff", "#f1d9bd", "#ffe9d2", "#e6c7a6", "#fff3e2"].map((c) => {
      const m = facMat.clone();
      m.color.set(c);
      return m;
    });
    const segs = 66;
    let u = 0;
    for (let i = 0; i < segs; i++) {
      // uneven widths: some houses are narrow, some long
      const a0 = (i / segs) * Math.PI * 2 + (i ? (rand() - 0.5) * 0.02 : 0),
        a1 = ((i + 1) / segs) * Math.PI * 2;
      const set = 0.992 + (rand() - 0.5) * 0.012;
      const p0 = ringPoint(a0, set),
        p1 = ringPoint(a1, set);
      const len = p0.distanceTo(p1) + 0.8;
      // an uneven skyline: mostly 10-15 m, a few tall houses, a few low ones
      const r0 = rand();
      const h = r0 < 0.12 ? 8 + rand() * 2 : r0 > 0.85 ? 16 + rand() * 3 : 10.5 + rand() * 4.5;
      const d = 12 + rand() * 6;
      const geo = new THREE.BoxGeometry(len, h, d);
      const uv = geo.attributes.uv;
      for (let k = 16; k < 20; k++) uv.setXY(k, (u + uv.getX(k) * len) / 64, 1 - h / 18 + (uv.getY(k) * h) / 18);
      for (let k = 0; k < uv.count; k++)
        if (k < 16 || k >= 20) uv.setXY(k, (uv.getX(k) * (k < 8 ? d : len)) / 8, (uv.getY(k) * h) / 8);
      u += len + rand() * 9; // jump along the strip so the pattern never lines up
      const house = new THREE.Mesh(geo, [
        plainMat,
        plainMat,
        roofMat2,
        plainMat,
        facVariants[Math.floor(rand() * facVariants.length)],
        plainMat,
      ]);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const out = outward(mid);
      house.position.set(mid.x - (out.x * d) / 2, H - 1 + h / 2, mid.z - (out.z * d) / 2);
      house.lookAt(house.position.clone().add(out));
      house.rotateY((rand() - 0.5) * 0.05); // not quite square to the ring
      house.castShadow = true;
      citadel.add(house);
      const top = H - 1 + h;
      // coping, broken where houses were repaired at different times
      if (rand() < 0.85) {
        const cope = new THREE.Mesh(new THREE.BoxGeometry(len * (0.7 + rand() * 0.3), 0.4, 0.8), copeMat);
        cope.position.copy(mid).add(out.clone().multiplyScalar(0.1));
        cope.position.y = top + 0.1;
        cope.lookAt(cope.position.clone().add(out));
        citadel.add(cope);
      }
      // a room or a parapet wall standing on some roofs breaks up the skyline
      if (rand() < 0.35) {
        const rw = 3 + rand() * 6,
          rh = 2.2 + rand() * 1.6;
        const room = new THREE.Mesh(box(rw, rh, 3 + rand() * 3, 4), plainMat);
        room.position
          .copy(mid)
          .add(out.clone().multiplyScalar(-(3 + rand() * 4)))
          .add(new THREE.Vector3(-out.z, 0, out.x).multiplyScalar((rand() - 0.5) * len * 0.5));
        room.position.y = top + rh / 2;
        room.lookAt(room.position.clone().add(out));
        room.castShadow = true;
        citadel.add(room);
      }
      // a timber ledge on some houses
      if (rand() < 0.3) {
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(len * (0.4 + rand() * 0.4), 0.25, 1.1), woodMat);
        ledge.position
          .copy(mid)
          .add(out.clone().multiplyScalar(0.5))
          .add(new THREE.Vector3(-out.z, 0, out.x).multiplyScalar((rand() - 0.5) * len * 0.3));
        ledge.position.y = top - 4.8;
        ledge.lookAt(ledge.position.clone().add(out));
        ledge.castShadow = true;
        citadel.add(ledge);
      }
      // a shallow pilaster where some houses meet
      if (rand() < 0.4) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(1.4, h + 0.3, 1.0), plainMat);
        pil.position.copy(p0).add(out.clone().multiplyScalar(0.3));
        pil.position.y = H - 1 + (h + 0.3) / 2;
        pil.lookAt(pil.position.clone().add(out));
        pil.castShadow = true;
        citadel.add(pil);
      }
      // sloping brick buttresses at the foot of some old walls
      if (rand() < 0.3) {
        const nb = 1 + Math.floor(rand() * 3);
        for (let b = 0; b < nb; b++) {
          const bh = 4 + rand() * 4;
          const wedge = new THREE.Shape();
          wedge.moveTo(0, 0);
          wedge.lineTo(bh * 0.45, 0);
          wedge.lineTo(0, bh);
          wedge.closePath();
          const wg = new THREE.ExtrudeGeometry(wedge, { depth: 1.6, bevelEnabled: false });
          wg.translate(0, 0, -0.8);
          wg.rotateY(-Math.PI / 2);
          const bt = new THREE.Mesh(wg, plainMat);
          bt.position
            .copy(mid)
            .add(new THREE.Vector3(-out.z, 0, out.x).multiplyScalar(((b - (nb - 1) / 2) * len) / (nb + 0.5)));
          bt.position.y = H - 1.2;
          bt.lookAt(bt.position.clone().add(out));
          bt.castShadow = true;
          citadel.add(bt);
        }
      }
    }
    // the minaret and dome of the Citadel mosque, and a few trees inside,
    // showing over the wall
    {
      const mx = cx - 40,
        mz = cz + 60;
      const mMat = new THREE.MeshStandardMaterial({
        map: brick,
        color: "#e8b98a",
        roughness: 0.9,
        emissive: new THREE.Color("#ff9a50"),
        emissiveIntensity: 0.14,
      });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 26, 16), mMat);
      shaft.position.set(mx, H + 13, mz);
      shaft.castShadow = true;
      citadel.add(shaft);
      const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.6, 1.6, 16), copeMat);
      gallery.position.set(mx, H + 25.5, mz);
      citadel.add(gallery);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 5, 16), mMat);
      upper.position.set(mx, H + 28.8, mz);
      citadel.add(upper);
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 3.2, 16),
        new THREE.MeshStandardMaterial({ color: "#6f8f8a", roughness: 0.5, metalness: 0.4 }),
      );
      cap.position.set(mx, H + 32.9, mz);
      citadel.add(cap);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: "#c9b79a",
          roughness: 0.8,
          emissive: new THREE.Color("#ff9a50"),
          emissiveIntensity: 0.08,
        }),
      );
      dome.position.set(mx + 14, H + 9, mz - 6);
      citadel.add(dome);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 3, 24), mMat);
      drum.position.set(mx + 14, H + 7.5, mz - 6);
      citadel.add(drum);
      const crownMat = new THREE.MeshStandardMaterial({ color: "#56603a", roughness: 1 });
      for (let t = 0; t < 14; t++) {
        const a = rand() * Math.PI * 2,
          r = 0.25 + rand() * 0.55;
        const tx = cx + Math.cos(a) * rx * r,
          tz = cz + Math.sin(a) * rz * r,
          ty = H + 10 + rand() * 4;
        for (let b = 0; b < 3; b++) {
          const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + rand() * 1.8, 1), crownMat);
          crown.position.set(tx + (rand() - 0.5) * 3, ty + rand() * 2, tz + (rand() - 0.5) * 3);
          crown.scale.y = 1.15;
          citadel.add(crown);
        }
      }
    }
    // a raised kerb of old stone along the top edge of the mound
    {
      const ring = new THREE.Shape();
      const hole = new THREE.Path();
      for (let k = 0; k <= 160; k++) {
        const a = (k / 160) * Math.PI * 2;
        const o = ringPoint(a, 1.012),
          ii = ringPoint(a, 0.985);
        k ? ring.lineTo(o.x - cx, o.z - cz) : ring.moveTo(o.x - cx, o.z - cz);
        k ? hole.lineTo(ii.x - cx, ii.z - cz) : hole.moveTo(ii.x - cx, ii.z - cz);
      }
      ring.holes.push(hole);
      const rg = new THREE.ExtrudeGeometry(ring, { depth: 1.2, bevelEnabled: false, curveSegments: 1 });
      rg.rotateX(Math.PI / 2);
      const kerb = new THREE.Mesh(
        rg,
        new THREE.MeshStandardMaterial({
          color: "#8a6a4c",
          map: brick,
          roughness: 1,
          emissive: new THREE.Color("#ff9a50"),
          emissiveIntensity: 0.1,
        }),
      );
      kerb.position.set(cx, H + 0.1, cz);
      kerb.receiveShadow = true;
      citadel.add(kerb);
    }
    // inside: a dense mass of lower flat roofs and courtyards
    {
      const n = 260;
      const roofs = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: "#6f5a47", map: brick, roughness: 1 }),
        n,
      );
      const mm = new THREE.Matrix4(),
        q = new THREE.Quaternion();
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2,
          r = Math.sqrt(rand()) * 0.84;
        const h = between(3, 8);
        mm.compose(
          new THREE.Vector3(cx + Math.cos(a) * rx * r, H + h / 2, cz + Math.sin(a) * rz * r),
          q,
          new THREE.Vector3(between(10, 22), h, between(10, 22)),
        );
        roofs.setMatrixAt(i, mm);
      }
      citadel.add(roofs);
    }
    // floodlights along the foot of the slope
    {
      const n = 90;
      const lamps = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.7, 8, 6),
        new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc888").multiplyScalar(1.5), toneMapped: false }),
        n,
      );
      const mm = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        mm.makeTranslation(cx + Math.cos(a) * rx * 1.19, 1, cz + Math.sin(a) * rz * 1.19);
        lamps.setMatrixAt(i, mm);
      }
      citadel.add(lamps);
    }

    // The great south gate: a taller block in the same ochre brick as the
    // wall, with a deep pointed-arch doorway in a raised frame, two rows of
    // small round-headed windows, and the flag above. A second, smaller
    // arched entrance sits further along the wall.
    {
      const gx = cx + 24,
        gz = cz + rz * 1.0;
      const gateMat = new THREE.MeshStandardMaterial({
        map: brick,
        bumpMap: brickBump,
        bumpScale: 0.6,
        color: "#e2a46c",
        roughness: 0.9,
        emissive: new THREE.Color("#ff9a50"),
        emissiveIntensity: 0.22,
      });
      const frameMat = new THREE.MeshStandardMaterial({
        map: brick,
        color: "#f6d3a6",
        roughness: 0.85,
        emissive: new THREE.Color("#ffad66"),
        emissiveIntensity: 0.3,
      });
      const darkMat = new THREE.MeshStandardMaterial({ color: "#2b1a10", roughness: 1 });
      const GW = 30,
        GH = 21;
      const front = gz + 2.5;
      // the block itself, with the facade texture on its face
      const blockGeo = new THREE.BoxGeometry(GW, GH, 18);
      const buv = blockGeo.attributes.uv;
      for (let k = 16; k < 20; k++) buv.setXY(k, 0.3 + (buv.getX(k) * GW) / 64, 1 - 18 / 18 + (buv.getY(k) * 18) / 18);
      const block = new THREE.Mesh(blockGeo, [gateMat, gateMat, roofMat2, gateMat, gateMat, gateMat]);
      block.position.set(gx, H - 1 + GH / 2, front - 9);
      block.castShadow = true;
      citadel.add(block);
      const cope = new THREE.Mesh(box(GW + 0.6, 0.6, 18.6, 2), copeMat);
      cope.position.set(gx, H - 1 + GH + 0.2, front - 9);
      citadel.add(cope);
      // the raised arch frame and the doorway cut through it
      const pointed = (path, hw, spring, top) => {
        path.moveTo(-hw, 0);
        path.lineTo(-hw, spring);
        path.quadraticCurveTo(-hw, spring + (top - spring) * 0.75, 0, top);
        path.quadraticCurveTo(hw, spring + (top - spring) * 0.75, hw, spring);
        path.lineTo(hw, 0);
      };
      const frame = new THREE.Shape();
      frame.moveTo(-8, 0);
      frame.lineTo(8, 0);
      frame.lineTo(8, 16.5);
      frame.lineTo(-8, 16.5);
      frame.closePath();
      const door = new THREE.Path();
      pointed(door, 4.4, 8.5, 14);
      door.closePath();
      frame.holes.push(door);
      const frameGeo = new THREE.ExtrudeGeometry(frame, {
        depth: 1.4,
        bevelEnabled: true,
        bevelSize: 0.15,
        bevelThickness: 0.15,
        bevelSegments: 1,
      });
      const fuv = frameGeo.attributes.uv;
      for (let k = 0; k < fuv.count; k++) fuv.setXY(k, fuv.getX(k) / 4, fuv.getY(k) / 4);
      const fr = new THREE.Mesh(frameGeo, frameMat);
      fr.position.set(gx, H - 1, front);
      fr.castShadow = true;
      citadel.add(fr);
      // the passage: dark reveal, then a warm lit vault deeper in
      const reveal = new THREE.Shape();
      pointed(reveal, 4.4, 8.5, 14);
      reveal.closePath();
      const rvg = new THREE.ExtrudeGeometry(reveal, { depth: 1.45, bevelEnabled: false });
      const rv = new THREE.Mesh(
        rvg,
        new THREE.MeshStandardMaterial({ color: "#4a2e1c", roughness: 1, side: THREE.BackSide }),
      );
      rv.position.set(gx, H - 1, front + 0.01);
      citadel.add(rv);
      // the old studded timber doors stand open; the vaulted passage beyond is lit
      const [pc, pg] = canvas(64, 128);
      const pgr = pg.createLinearGradient(0, 128, 0, 0);
      pgr.addColorStop(0, "#ffcf8a");
      pgr.addColorStop(0.55, "#d98a4a");
      pgr.addColorStop(1, "#5a3420");
      pg.fillStyle = pgr;
      pg.fillRect(0, 0, 64, 128);
      pg.fillStyle = "rgba(40,20,10,0.55)";
      pg.fillRect(0, 0, 9, 128);
      pg.fillRect(55, 0, 9, 128);
      const inner = new THREE.Mesh(
        new THREE.ShapeGeometry(reveal),
        new THREE.MeshBasicMaterial({ map: texture(pc, { repeat: false }), toneMapped: false }),
      );
      const iuv = inner.geometry.attributes.uv;
      for (let k = 0; k < iuv.count; k++) iuv.setXY(k, (iuv.getX(k) + 4.4) / 8.8, iuv.getY(k) / 14);
      inner.position.set(gx, H - 1, front + 0.03);
      citadel.add(inner);
      // round-headed windows in two rows either side of the arch, and a row of slits
      const win = new THREE.Shape();
      win.moveTo(-0.55, 0);
      win.lineTo(-0.55, 1.4);
      win.absarc(0, 1.4, 0.55, Math.PI, 0, true);
      win.lineTo(0.55, 0);
      win.closePath();
      const winGeo = new THREE.ShapeGeometry(win);
      const litMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#ffbf7a").multiplyScalar(1.1),
        toneMapped: false,
      });
      for (const sx of [-1, 1])
        for (const [wx, wy] of [
          [10.5, 12.5],
          [13.5, 12.5],
          [10.5, 6],
          [13.5, 6],
        ]) {
          const wm = new THREE.Mesh(winGeo, (wx + wy) % 3 < 1 ? litMat : darkMat);
          wm.position.set(gx + sx * wx, H - 1 + wy, front + 0.02);
          citadel.add(wm);
        }
      for (let k = -13; k <= 13; k += 1.6) {
        const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.25), darkMat);
        sl.position.set(gx + k, H - 1 + GH - 1.3, front + 0.02);
        citadel.add(sl);
      }
      // a timber balcony ledge across the block, like the old houses beside it
      const led = new THREE.Mesh(box(GW - 2, 0.3, 1.2, 2), woodMat);
      led.position.set(gx, H - 1 + 17.2, front + 0.5);
      led.castShadow = true;
      citadel.add(led);
      // the smaller second entrance further along the wall
      {
        const a2 = Math.PI / 2 - 0.42;
        const p = ringPoint(a2, 0.996),
          out = outward(p);
        const f2 = new THREE.Shape();
        f2.moveTo(-3.2, 0);
        f2.lineTo(3.2, 0);
        f2.lineTo(3.2, 8);
        f2.lineTo(-3.2, 8);
        f2.closePath();
        const d2 = new THREE.Path();
        pointed(d2, 1.9, 3.8, 6.4);
        d2.closePath();
        f2.holes.push(d2);
        const g2 = new THREE.Mesh(new THREE.ExtrudeGeometry(f2, { depth: 0.8, bevelEnabled: false }), frameMat);
        g2.position.set(p.x, H - 1, p.z);
        g2.lookAt(g2.position.clone().add(out));
        citadel.add(g2);
        const s2 = new THREE.Shape();
        pointed(s2, 1.9, 3.8, 6.4);
        s2.closePath();
        const in2 = new THREE.Mesh(new THREE.ShapeGeometry(s2), darkMat);
        in2.position.copy(g2.position).add(out.clone().multiplyScalar(0.05));
        in2.position.y = H - 1;
        in2.lookAt(in2.position.clone().add(out));
        citadel.add(in2);
      }
      // two clipped cypress trees either side of the gate, as on the square
      const cyp = new THREE.LatheGeometry(
        Array.from({ length: 14 }, (_, k) => {
          const t = k / 13;
          return new THREE.Vector2(Math.sin(Math.PI * Math.pow(t, 0.8)) * 1.9 + 0.01, t * 9);
        }),
        18,
      );
      const cypMat = new THREE.MeshStandardMaterial({ color: "#3f4a2a", roughness: 1, flatShading: true });
      const cpos = cyp.attributes.position;
      for (let k = 0; k < cpos.count; k++) {
        const n = 1 + (Math.random() - 0.5) * 0.18;
        cpos.setX(k, cpos.getX(k) * n);
        cpos.setZ(k, cpos.getZ(k) * n);
      }
      cyp.computeVertexNormals();
      for (const sx of [-1, 1]) {
        const t = new THREE.Mesh(cyp, cypMat);
        t.position.set(gx + sx * 11, 0, front + 70);
        t.castShadow = true;
        citadel.add(t);
      }
      // the broad stair-ramp down to the square, with lamps on both sides
      const rampLen = 64,
        rampW = 16;
      const steps = 40;
      const stepMat = new THREE.MeshStandardMaterial({
        color: "#bfa98a",
        map: stoneTexture()[0],
        roughness: 0.9,
        emissive: new THREE.Color("#ff9a50"),
        emissiveIntensity: 0.06,
      });
      const stepGeo = new THREE.BoxGeometry(rampW, 1, rampLen / steps + 0.05);
      const stepInst = new THREE.InstancedMesh(stepGeo, stepMat, steps);
      const mm = new THREE.Matrix4();
      for (let k = 0; k < steps; k++) {
        const y = (H - 1) * (1 - k / steps);
        mm.compose(
          new THREE.Vector3(gx, y / 2, front + 1.4 + (k + 0.5) * (rampLen / steps)),
          new THREE.Quaternion(),
          new THREE.Vector3(1, Math.max(0.3, y), 1),
        );
        stepInst.setMatrixAt(k, mm);
      }
      stepInst.receiveShadow = true;
      citadel.add(stepInst);
      const lampMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#ffd29a").multiplyScalar(1.15),
        toneMapped: false,
      });
      for (let k = 2; k < steps; k += 5) {
        const y = (H - 1) * (1 - k / steps);
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 6), darkMetal);
          post.position.set(gx + s * (rampW / 2 + 0.3), y + 1.75, front + 1.4 + k * (rampLen / steps));
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampMat);
          bulb.position.set(post.position.x, y + 3.6, post.position.z);
          citadel.add(post, bulb);
        }
      }
      // the flag over the gate, on a tapered steel pole with a gold finial
      const poleH = 24,
        poleY = H - 1 + GH;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.32, poleH, 16),
        new THREE.MeshStandardMaterial({ color: "#c9ccd0", roughness: 0.3, metalness: 0.9 }),
      );
      pole.position.set(gx, poleY + poleH / 2, front - 9);
      pole.castShadow = true;
      citadel.add(pole);
      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 16, 12),
        new THREE.MeshStandardMaterial({ color: "#d4a73a", roughness: 0.25, metalness: 1 }),
      );
      finial.position.set(gx, poleY + poleH + 0.35, front - 9);
      citadel.add(finial);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.8, 16), copeMat);
      base.position.set(gx, poleY + 0.4, front - 9);
      citadel.add(base);
      // the cloth: 3:2, hanging from the pole with soft travelling folds that
      // grow towards the fly end, and a slight droop
      const FW = 12,
        FH = 8;
      const fg = new THREE.PlaneGeometry(FW, FH, 60, 24);
      const fp = fg.attributes.position;
      for (let k = 0; k < fp.count; k++) {
        const x = fp.getX(k) + FW / 2,
          y = fp.getY(k),
          t = x / FW;
        const z =
          (Math.sin(x * 0.75 - 0.4) * 0.55 +
            Math.sin(x * 1.6 + y * 0.35) * 0.18 +
            Math.sin(x * 0.33 + y * 0.12) * 0.25) *
          Math.pow(t, 0.8);
        fp.setXYZ(k, fp.getX(k) - t * t * 0.4, y - t * t * 0.9 + Math.sin(x * 0.75) * 0.08 * t, z);
      }
      fg.computeVertexNormals();
      const ft = flagTexture();
      const flag = new THREE.Mesh(
        fg,
        new THREE.MeshStandardMaterial({
          map: ft,
          side: THREE.DoubleSide,
          roughness: 0.85,
          emissive: new THREE.Color("#ffffff"),
          emissiveMap: ft,
          emissiveIntensity: 0.1,
        }),
      );
      flag.position.set(gx + FW / 2 + 0.2, poleY + poleH - FH / 2 - 0.4, front - 9);
      flag.castShadow = true;
      citadel.add(flag);
      // a floodlight on the flag from the roof of the gate
      const spot = new THREE.SpotLight("#ffe2b8", 1100, 60, 0.35, 0.6, 2);
      spot.position.set(gx - 3, poleY + 2, front + 4);
      spot.target = flag;
      citadel.add(spot);
    }
    // a warm wash of floodlight on the city-facing side
    const glow = new THREE.PointLight("#ffa257", 21000, 480, 2);
    glow.position.set(cx + 20, 16, cz + rz + 130);
    scene.add(glow);
  }

  /* ---- the city in the middle distance: blocks with lit windows ---- */
  {
    const [wall, wallGlow] = cityNightTextures();
    const mat = new THREE.MeshStandardMaterial({
      map: wall,
      emissiveMap: wallGlow,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 1.5,
      roughness: 0.95,
    });
    const n = lowPower ? 700 : 1300;
    const inst = new THREE.InstancedMesh(box(1, 1, 1, 1), mat, n);
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion();
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const x = between(-800, 750),
        z = between(-900, -240);
      if (Math.abs(x) < 70 && z > -340) continue; // keep our street clear
      if (Math.hypot((x + 20) / 260, (z + 620) / 215) < 1.05) continue; // the Citadel and the open ground around it
      const inFront = x > -260 && x < 230 && z < -330 && z > -460;
      const w = between(10, 22),
        d = between(10, 22),
        h = inFront ? pick([3.3, 6.6]) : pick([6.6, 6.6, 9.9, 9.9, 13.2, 16.5]);
      q.setFromEuler(new THREE.Euler(0, rand() < 0.5 ? 0 : 0.04, 0));
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d));
      inst.setMatrixAt(k++, m);
    }
    inst.count = k;
    scene.add(inst);
    // and farther still, just points of light
    const pn = lowPower ? 1500 : 3000;
    const pos = new Float32Array(pn * 3),
      col = new Float32Array(pn * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pn; i++) {
      const a = between(Math.PI * 0.85, Math.PI * 2.15),
        r = between(700, 1800);
      pos[i * 3] = Math.cos(a) * r * 1.2;
      pos[i * 3 + 1] = between(1, 16);
      pos[i * 3 + 2] = Math.sin(a) * r - 300;
      c.set(pick(["#ffcf87", "#ffb45e", "#fff1d6", "#ffd9a0", "#cfe0ff"]));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({ size: 2.6, vertexColors: true, toneMapped: false, transparent: true, opacity: 0.9 }),
      ),
    );
  }

  /* ---- report pins (stage 3) ---- */
  // Pins live in their own scene, drawn after ambient occlusion, so the AO
  // pass doesn't shade the see-through parts of the sprite as a dark box.
  const pins = [];
  const pinScene = new THREE.Scene();
  {
    const red = pinTexture(true);
    const grey = pinTexture(false);
    const blockHouses = houses
      .filter((h) => h.block && h.row === 0)
      .concat(houses.filter((h) => h.block && h.row === 1));
    blockHouses.slice(0, 3).forEach((h, i) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: red, color: "#ffffff", transparent: true, depthWrite: false, fog: false }),
      );
      sp.position.set(h.cx, h.top + 5, h.cz);
      sp.scale.set(0.001, 0.001, 1);
      sp.center.set(0.5, 22 / 320);
      sp.userData = { y: h.top + 1.1, delay: i * 0.18, size: 7 };
      pinScene.add(sp);
      pins.push(sp);
    });
    const far = houses.find((h) => h.row === 0 && h.side > 0 && h.cz < -85);
    if (far) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: grey, color: "#d6d6d6", transparent: true, depthWrite: false, fog: false }),
      );
      sp.position.set(far.cx, far.top + 5, far.cz);
      sp.scale.set(0.001, 0.001, 1);
      sp.center.set(0.5, 22 / 320);
      sp.userData = { y: far.top + 1.1, delay: 0.6, size: 6 };
      pinScene.add(sp);
      pins.push(sp);
    }
  }

  /* ---- camera positions for each stage ---- */
  const SHOTS = [
    { pos: [2.5, 12.5, 30], look: [-3, 9, -160] },
    { pos: [6, 21, 10], look: [-4, 4, -130] },
    { pos: [10, 25, 10], look: [-12, 2, -44] },
    { pos: [12, 29, 6], look: [-13, 4, -42] },
  ];
  if (opts.shot) SHOTS[opts.stage] = opts.shot; // for previews
  const camPos = new THREE.Vector3(...SHOTS[0].pos);
  const camLook = new THREE.Vector3(...SHOTS[0].look);
  const wantPos = camPos.clone();
  const wantLook = camLook.clone();

  /* ---- post-processing: ambient occlusion, glow, and a camera-like finish ---- */
  let composer = null,
    gtao = null;
  if (opts.bloom && !lowPower) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    try {
      gtao = new GTAOPass(scene, camera, 512, 512);
      gtao.blendIntensity = 0.85;
      gtao.updateGtaoMaterial({
        radius: 1.6,
        distanceExponent: 1.5,
        thickness: 2,
        scale: 1.2,
        samples: opts.still ? 24 : 12,
      });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      composer.addPass(gtao);
    } catch (e) {
      gtao = null;
    }
    const pinPass = new RenderPass(pinScene, camera);
    pinPass.clear = false;
    pinPass.clearDepth = true;
    composer.addPass(pinPass);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.38, 0.4, 1.0));
    composer.addPass(new OutputPass());
    // vignette, a cool/warm split and fine grain, after tone mapping
    composer.addPass(
      new ShaderPass({
        uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
        vertexShader:
          "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          float l = dot(c.rgb, vec3(0.299,0.587,0.114));
          c.rgb = mix(c.rgb * vec3(0.94,0.98,1.06), c.rgb * vec3(1.05,1.0,0.93), smoothstep(0.15, 0.7, l));
          float v = smoothstep(0.95, 0.35, length(vUv - 0.5) * 1.15);
          c.rgb *= mix(0.72, 1.0, v);
          c.rgb += (hash(vUv * 1000.0) - 0.5) * 0.012;
          gl_FragColor = c;
        }`,
      }),
    );
  }

  /* ---- the scroll is a playhead ----
     The page passes a progress p from 0 to 3 through the story, the way
     scrubbing moves through a film:
       0 → 1  the camera glides back and up, the generator cables come down
       1 → 2  the cut spreads: each house in the block goes dark at its own
              moment, then the street lamps on that side
       2 → 3  the camera settles over the dark block, the pins rise one by one
     Scrolling back plays it backwards. setStage(n) is setProgress(n).    */
  let stage = -1,
    progress = -1;
  let cableTarget = 1,
    cableNow = 1;
  let pinsTarget = 0,
    pinsNow = 0;
  const OFF = new THREE.Color(0, 0, 0);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => x * x * (3 - 2 * x);
  const band = (x, from, to) => smooth(clamp01((x - from) / (to - from)));
  const pathPos = new THREE.CatmullRomCurve3(
    SHOTS.map((sh) => new THREE.Vector3(...sh.pos)),
    false,
    "centripetal",
  );
  const pathLook = new THREE.CatmullRomCurve3(
    SHOTS.map((sh) => new THREE.Vector3(...sh.look)),
    false,
    "centripetal",
  );
  // When each window and lamp goes off: block houses one after another,
  // a few windows a beat late, the lamps nearest the block first
  const winOffAt = windows.map((w, i) => 1.3 + ((w.house * 37) % 10) * 0.055 + (i % 3) * 0.018);
  const lampOffAt = (l) => 1.55 + clamp01((-l.z - 14) / 48) * 0.3;

  function setProgress(p) {
    p = Math.max(0, Math.min(3, Number(p) || 0));
    if (Math.abs(p - progress) < 0.0005) return;
    lastMove = performance.now();
    progress = p;
    stage = Math.round(p);
    // Slow near each shot, quicker between them, so every chapter has a
    // moment where the picture holds still enough to look at
    const i = Math.min(2, Math.floor(p));
    const u = (i + smooth(p - i)) / 3;
    wantPos.copy(pathPos.getPoint(u));
    wantLook.copy(pathLook.getPoint(u));
    if (camera.aspect < 0.9) wantPos.add(new THREE.Vector3(-2, 5, 6));
    cableTarget = 1 - band(p, 0.3, 1);
    pinsTarget = band(p, 2.25, 2.85);
    windows.forEach((w, n) => {
      const off = houses[w.house].block && p >= winOffAt[n];
      winWant[n].copy(off || !w.lit ? OFF : w.warm);
    });
    lampHeads.forEach((l) => {
      const inBlock = l.sign || (l.side < 0 && l.z < -14 && l.z > -62);
      l.dark = inBlock && p >= (l.sign ? 1.4 : lampOffAt(l));
    });
    lampLights.forEach((l) => {
      l.dark = l.side < 0 && l.z < -14 && l.z > -62 && p >= lampOffAt(l);
    });
    wake();
  }
  const setStage = (n) => setProgress(n);

  // Run something heavy only once the scroll has been still for a moment
  let lastMove = 0;
  function whenStill(fn) {
    const wait = () => {
      if (performance.now() - lastMove < 500 || running) {
        setTimeout(wait, 250);
        return;
      }
      (window.requestIdleCallback || ((f) => setTimeout(f, 0)))(fn, { timeout: 1500 });
    };
    wait();
  }

  function resize(keepCamera) {
    const w = container.clientWidth || 1,
      h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 58 : 42;
    camera.updateProjectionMatrix();
    if (!opts.still && budget(w, h) < pixelRatio) {
      pixelRatio = budget(w, h);
      renderer.setPixelRatio(pixelRatio);
      if (composer) composer.setPixelRatio(pixelRatio);
    }
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    if (keepCamera === true) {
      wake();
      return;
    }
    const now = progress < 0 ? opts.stage : progress;
    progress = -1;
    setProgress(now);
    camPos.copy(wantPos);
    camLook.copy(wantLook);
    wake();
  }

  /* ---- animation: only runs while something is moving and on screen ---- */
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let running = false,
    visible = true,
    idleFrames = 0,
    last = performance.now();

  function approach(c, want, k) {
    c.lerp(want, k);
    if (Math.abs(c.r - want.r) + Math.abs(c.g - want.g) + Math.abs(c.b - want.b) < 0.01) {
      c.copy(want);
      return false;
    }
    return true;
  }

  // Ambient occlusion is the most expensive pass (it draws the whole scene a
  // second time). While the camera is moving it fades out, and it fades back
  // in once the camera has settled, so scrolling stays smooth.
  const AO = 0.85;
  let aoNow = AO;
  function setAo(want, dt) {
    if (!gtao) return false;
    const step = dt * (want > aoNow ? 2.2 : 6);
    aoNow = want > aoNow ? Math.min(want, aoNow + step) : Math.max(want, aoNow - step);
    if (!(aoNow >= 0)) aoNow = 0;
    if (aoNow > AO) aoNow = AO;
    gtao.blendIntensity = aoNow;
    gtao.enabled = aoNow > 0.01;
    return aoNow !== want;
  }

  // If the computer can't keep up, draw fewer pixels (only ever goes down).
  const slow = [];
  function adapt(ms) {
    if (opts.still || pixelRatio <= 0.6) return;
    slow.push(ms);
    if (slow.length < 12) return;
    slow.sort((a, b) => a - b);
    const mid = slow[6];
    slow.length = 0;
    if (mid > 20) {
      if (gtao && mid > 30) {
        gtao.enabled = false;
        gtao = null;
      } // the most expensive pass goes first
      pixelRatio = Math.max(0.6, pixelRatio * 0.8);
      renderer.setPixelRatio(pixelRatio);
      if (composer) {
        composer.setPixelRatio(pixelRatio);
      }
      resize(true);
    }
  }

  let compiled = !!opts.still;
  function draw() {
    if (!compiled) return; // the shaders are still compiling (see the end)
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(pinScene, camera);
      renderer.autoClear = ac;
    }
  }

  function frame(now) {
    const gap = now - last;
    const dt = Math.max(0, Math.min(0.05, gap / 1000));
    last = now;
    const k = reduced ? 1 : 1 - Math.pow(0.0015, dt);
    let moving = false,
      camMoving = false;

    if (camPos.distanceToSquared(wantPos) > 1e-4) {
      camPos.lerp(wantPos, k);
      camMoving = true;
    }
    if (camLook.distanceToSquared(wantLook) > 1e-4) {
      camLook.lerp(wantLook, k);
      camMoving = true;
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (camMoving) moving = true;

    if (Math.abs(cableNow - cableTarget) > 0.002) {
      cableNow += (cableTarget - cableNow) * (reduced ? 1 : Math.min(1, dt * 2.2));
      moving = true;
    } else cableNow = cableTarget;
    const genOn = cableNow > 0.01;
    if (genGroup.visible !== genOn) genGroup.visible = genOn; // it casts no shadow, so the shadows don't need drawing again
    genGroup.traverse((o) => {
      if (o.material) o.material.opacity = cableNow;
    });

    // windows follow the playhead; a light going off fades in a blink
    let changed = false;
    windows.forEach((w, i) => {
      if (winNow[i].equals(winWant[i])) return;
      moving = true;
      approach(winNow[i], winWant[i], reduced ? 1 : Math.min(1, dt * 9));
      glowAttr.setXYZ(i, winNow[i].r, winNow[i].g, winNow[i].b);
      changed = true;
    });
    if (changed) glowAttr.needsUpdate = true;
    lampHeads.forEach((l) => {
      const want = l.dark ? OFF : l.on;
      if (!l.mesh.material.color.equals(want)) {
        approach(l.mesh.material.color, want, reduced ? 1 : Math.min(1, dt * 6));
        if (l.pool) l.pool.visible = !l.dark;
        moving = true;
      }
    });
    lampLights.forEach((l) => {
      const want = l.dark ? 0 : l.base;
      if (Math.abs(l.light.intensity - want) > 0.5) {
        l.light.intensity += (want - l.light.intensity) * (reduced ? 1 : Math.min(1, dt * 6));
        moving = true;
      } else l.light.intensity = want;
    });

    if (Math.abs(pinsNow - pinsTarget) > 0.001) {
      pinsNow += (pinsTarget - pinsNow) * (reduced ? 1 : Math.min(1, dt * 3));
      moving = true;
    } else pinsNow = pinsTarget;
    pins.forEach((p) => {
      const u = p.userData;
      const t = Math.max(0, Math.min(1, (pinsNow - u.delay * 0.5) / (1 - u.delay * 0.5)));
      const ease = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * 5) : 1;
      const s = Math.max(0.001, u.size * ease);
      p.scale.set(s, s * 1.25, 1);
      p.position.y = u.y;
      p.visible = t > 0.01;
    });

    if (setAo(camMoving ? 0 : AO, dt)) moving = true;

    const t0 = performance.now();
    draw(now);
    // time the frame (the GPU finishes later, so use the gap between frames too)
    if (moving && running && gap < 200) adapt(Math.max(performance.now() - t0, gap));
    idleFrames = moving ? 0 : idleFrames + 1;
    if (visible && idleFrames < 3) requestAnimationFrame(frame);
    else running = false;
  }

  function wake() {
    if (!running && visible) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  // The generator and its cables fade in and out while scrolling. If they cast
  // shadows, every fade would redraw the whole shadow map, a visible stutter.
  genGroup.traverse((o) => {
    o.castShadow = false;
  });

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver((e) => {
    visible = e[0].isIntersecting;
    if (visible) wake();
  });
  io.observe(container);
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (visible) wake();
  });

  /* ---- real car models replace the simple ones once they have loaded ---- */
  const REAL = { camry: "camry70.glb", avalon: "camry80.glb", altima: "altima.glb" };
  const LEN = { "camry70.glb": 4.88, "camry80.glb": 4.92, "altima.glb": 4.9 };
  const FLIP = { "camry70.glb": 0, "camry80.glb": 0, "altima.glb": 0 };
  const PAINT = /^(EX_CarPaint|BODY|silver_altima|body$)/i;
  function prepare(file, root) {
    const g = new THREE.Group();
    g.add(root);
    root.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(root);
    let size = box.getSize(new THREE.Vector3());
    if (size.x > size.z) {
      root.rotation.y = Math.PI / 2;
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root);
      size = box.getSize(new THREE.Vector3());
    }
    const k = LEN[file] / size.z;
    root.scale.multiplyScalar(k);
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    root.position.x -= c.x;
    root.position.z -= c.z;
    root.position.y -= box.min.y;
    if (FLIP[file]) g.rotation.y = Math.PI;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      const fix = (m) => {
        if (m.transmission > 0) {
          m = m.clone();
          m.transmission = 0;
          m.transparent = true;
          m.opacity = 0.55;
          m.color.set("#0b0f14");
          m.roughness = 0.05;
          m.metalness = 0.3;
          m.depthWrite = false;
        }
        return m;
      };
      o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    });
    return g;
  }
  function paintClone(tpl, colour) {
    const c = tpl.clone(true);
    c.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      if (PAINT.test(o.material.name)) {
        const m = o.material.clone();
        m.color.set(colour);
        if (m.map) m.map = null;
        m.metalness = 0.25;
        m.roughness = 0.42;
        if ("clearcoat" in m) {
          m.clearcoat = 0.6;
          m.clearcoatRoughness = 0.18;
        }
        o.material = m;
      }
    });
    return c;
  }
  const modelsReady = !opts.models
    ? Promise.resolve()
    : (() => {
        // The models are small, so they decode on the page itself: the site's
        // security policy (rightly) doesn't let scripts start workers from blobs.
        const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
        const files = [...new Set(parked.map((p) => REAL[p.model]).filter(Boolean))];
        return Promise.all(
          files.map((f) =>
            loader
              .loadAsync(opts.models + f)
              .then((gl) => [f, prepare(f, gl.scene)])
              .catch(() => [f, null]),
          ),
        ).then((list) => {
          const tpl = Object.fromEntries(list);
          // Build the new cars aside and compile their shaders in the background
          // (with the street's lights), then swap them in while nobody is scrolling
          const holder = new THREE.Scene();
          const swaps = [];
          parked.forEach((p) => {
            const t = tpl[REAL[p.model]];
            if (!t) return;
            const car = paintClone(t, p.colour);
            holder.add(car);
            swaps.push([p, car]);
          });
          if (!swaps.length) return;
          return renderer
            .compileAsync(holder, camera, scene)
            .catch(() => {})
            .then(() =>
              whenStill(() => {
                swaps.forEach(([p, car]) => {
                  p.car.clear();
                  p.car.add(car);
                });
                renderer.shadowMap.needsUpdate = true;
                wake();
              }),
            );
        });
      })();

  setProgress(opts.stage);
  resize();
  // Compile every shader before the first frame, including the pins and the
  // generator that only appear later, so nothing compiles mid-scroll. The
  // browser does this off the main thread where it can; the film or the
  // still picture stays on screen until then.
  const hidden = [genGroup, ...pins].filter((o) => !o.visible);
  hidden.forEach((o) => {
    o.visible = true;
  });
  Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(pinScene, camera, scene)])
    .catch(() => {})
    .then(() => {
      hidden.forEach((o) => {
        o.visible = false;
      });
      compiled = true;
      requestAnimationFrame((t) => {
        draw(t);
        if (opts.onReady) opts.onReady();
        wake();
      });
    });

  return {
    setStage,
    setProgress,
    ready: modelsReady,
    get stage() {
      return stage;
    },
    canvas: renderer.domElement,
    // jump straight to the end state of the current stage (for still images)
    renderNow() {
      camPos.copy(wantPos);
      camLook.copy(wantLook);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      windows.forEach((w, i) => {
        winNow[i].copy(winWant[i]);
        glowAttr.setXYZ(i, winNow[i].r, winNow[i].g, winNow[i].b);
      });
      glowAttr.needsUpdate = true;
      cableNow = cableTarget;
      genGroup.visible = cableNow > 0.01;
      genGroup.traverse((o) => {
        if (o.material) o.material.opacity = cableNow;
      });
      pinsNow = pinsTarget;
      pins.forEach((p) => {
        const u = p.userData;
        const sz = pinsNow ? u.size : 0.001;
        p.scale.set(sz, sz * 1.25, 1);
        p.visible = pinsNow > 0;
        p.position.y = u.y;
      });
      lampHeads.forEach((l) => {
        l.mesh.material.color.copy(l.dark ? OFF : l.on);
        if (l.pool) l.pool.visible = !l.dark;
      });
      lampLights.forEach((l) => {
        l.light.intensity = l.dark ? 0 : l.base;
      });
      draw(0.5);
    },
    dispose() {
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}
