/* © 2026 NorthPoint Tech. All rights reserved.

   The 3D map on the team's Home screen, from our own map file.

   The map is a Protomaps file of Kurdistan made from OpenStreetMap
   (data/maps/kurdistan.pmtiles, put there by the server person; see
   docs/operations.md), drawn by MapLibre. Buildings stand up from their
   height in OpenStreetMap, or one ordinary three-floor height (9 m) where
   OpenStreetMap doesn't say. The colours are the site's: greys, a pale
   blue-grey for water, and our red and blue points on top.

   Only on a computer, and only when the file is there: phones and anything
   without it keep the flat street map (map.js).                          */
const EU = window.EU;
const VENDOR = "/assets/vendor/maps/";
const FILE = "/maps/kurdistan.pmtiles";

let lib = null; // { maplibregl, kit }
let map = null;
let available = null; // is the map file on the server?
let sprites = false; // and the map's icons (optional)

/* Can this screen show it? A computer-sized screen, WebGL, and the file */
export async function can3D() {
  if (!matchMedia("(min-width: 981px) and (pointer: fine)").matches) return false;
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return false;
  if (available == null) {
    try {
      available = (await fetch(FILE, { method: "HEAD", cache: "no-store" })).ok;
      sprites = available && (await fetch("/maps/sprites/v4/light.json", { method: "HEAD" })).ok;
    } catch (e) {
      available = false;
    }
  }
  return available;
}

async function load() {
  if (lib) return lib;
  const [maplibregl, kit] = await Promise.all([import(VENDOR + "maplibre-gl.mjs"), import(VENDOR + "map-kit.js")]);
  const ml = maplibregl.default || maplibregl;
  if (!document.querySelector("link[data-maplibre]")) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = VENDOR + "maplibre-gl.css";
    css.dataset.maplibre = "";
    document.head.append(css);
  }
  ml.addProtocol("pmtiles", new kit.Protocol().tile);
  // without it Sorani and Arabic names come out as loose letters, back to front
  try {
    if (ml.getRTLTextPluginStatus() === "unavailable")
      ml.setRTLTextPlugin(location.origin + VENDOR + "mapbox-gl-rtl-text.min.js", true);
  } catch {
    /* already set */
  }
  lib = { ml, kit };
  return lib;
}

const dark = () =>
  document.documentElement.getAttribute("data-theme") === "dark" ||
  (!document.documentElement.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);

/* A calm, drawn-by-hand look instead of the map's stock colours: the
   site's greys, quiet blue water, white streets with a thin grey edge,
   buildings that get a shade darker the taller they are, and one name per
   place in the page's own language. */
const LOOK = {
  light: {
    background: "#e6e9ec",
    earth: "#eef0f2",
    water: "#b7cad8",
    park_a: "#dbe4da",
    park_b: "#d3dfd2",
    wood_a: "#d6e0d4",
    wood_b: "#ccd9ca",
    scrub_a: "#e1e6dd",
    scrub_b: "#d8dfd3",
    sand: "#e8e8e4",
    beach: "#e8e8e4",
    hospital: "#e9e3e4",
    school: "#e7e8eb",
    industrial: "#e1e4e8",
    military: "#e1e3e5",
    aerodrome: "#e2e5e9",
    pedestrian: "#f2f3f4",
    zoo: "#dbe4da",
    low: "#dfe2e6",
    tall: "#b9c1cb",
    edge: "#c9cfd6",
    road: "#ffffff",
    minor: "#f7f8f9",
    label: "#3e4955",
    road_label: "#6a7581",
    halo: "#ffffff",
    sky: "#dfe6ed",
  },
  dark: {
    background: "#11161c",
    earth: "#151b22",
    water: "#1c2a37",
    park_a: "#18221d",
    park_b: "#1a251f",
    wood_a: "#18221d",
    wood_b: "#1a251f",
    scrub_a: "#171e1c",
    scrub_b: "#18201d",
    sand: "#1a1f25",
    beach: "#1a1f25",
    hospital: "#1d1b20",
    school: "#191e25",
    industrial: "#191e25",
    military: "#181c21",
    aerodrome: "#181d23",
    pedestrian: "#1c222a",
    zoo: "#18221d",
    low: "#232b35",
    tall: "#37414e",
    edge: "#2a323c",
    road: "#2c3540",
    minor: "#222a33",
    label: "#c3ccd6",
    road_label: "#8b96a3",
    halo: "#11161c",
    sky: "#1a222b",
  },
};

function flavour(kit) {
  const night = dark();
  const L = LOOK[night ? "dark" : "light"];
  const f = { ...kit.namedFlavor(night ? "dark" : "light") };
  for (const k of Object.keys(f)) {
    if (typeof f[k] !== "string") continue;
    if (/casing/.test(k)) f[k] = L.edge;
    else if (/^(tunnel_|bridges_)?(highway|major|link)$/.test(k) || /^bridges_/.test(k)) f[k] = L.road;
    else if (/^(tunnel_|bridges_)?(minor|minor_a|minor_b|minor_service|other)$/.test(k)) f[k] = L.minor;
    else if (/^tunnel_/.test(k)) f[k] = L.minor;
    else if (/_halo$/.test(k)) f[k] = L.halo;
    else if (/^roads_label/.test(k) || k === "address_label") f[k] = L.road_label;
    else if (/_label$/.test(k)) f[k] = L.label;
  }
  Object.assign(f, {
    background: L.background,
    earth: L.earth,
    water: L.water,
    park_a: L.park_a,
    park_b: L.park_b,
    wood_a: L.wood_a,
    wood_b: L.wood_b,
    scrub_a: L.scrub_a,
    scrub_b: L.scrub_b,
    sand: L.sand,
    beach: L.beach,
    hospital: L.hospital,
    school: L.school,
    industrial: L.industrial,
    military: L.military,
    aerodrome: L.aerodrome,
    pedestrian: L.pedestrian,
    zoo: L.zoo,
    railway: L.road_label,
    boundaries: L.road_label,
    buildings: L.low,
  });
  // land cover in the same quiet greens and greys, not the stock yellow and bright green
  f.landcover = {
    grassland: L.park_a,
    barren: L.earth,
    urban_area: L.earth,
    farmland: L.scrub_a,
    glacier: L.earth,
    scrub: L.scrub_a,
    forest: L.wood_a,
  };
  return { f, L };
}

// one name in the page's language (the stock labels stack two scripts on two lines)
function nameField() {
  const keys = {
    ckb: ["name:ckb", "name:ar", "name"],
    ar: ["name:ar", "name:ckb", "name"],
    kmr: ["name:ku", "name:en", "name"],
    en: ["name:en", "name"],
  }[EU.lang] || ["name:en", "name"];
  return ["coalesce", ...keys.map((k) => ["get", k])];
}

function style(kit) {
  const { f: flav, L } = flavour(kit);
  // Arabic-script names for Sorani and Arabic, Latin names for English and Kurmanji
  const lang = EU.lang === "ckb" || EU.lang === "ar" ? "ar" : "en";
  const name = nameField();
  const base = kit
    .layers("protomaps", flav, { lang })
    // no shop and café icons, house numbers or road shields: they crowd out our own marks
    .filter((l) => !["buildings", "pois", "address_label", "roads_shields", "roads_oneway"].includes(l.id))
    .map((l) => {
      if (l.type !== "symbol") return l;
      const big = /places_(locality|region|country)/.test(l.id);
      return {
        ...l,
        layout: {
          ...l.layout,
          "text-field": name,
          "text-letter-spacing": 0,
          "text-transform": "none",
          ...(/^places_/.test(l.id) && l.layout["icon-image"] ? { "icon-image": "" } : {}),
          ...(big ? { "text-size": ["interpolate", ["linear"], ["zoom"], 8, 13, 14, 16] } : {}),
        },
        paint: {
          ...l.paint,
          "text-halo-color": L.halo,
          "text-halo-width": 1.6,
          "text-halo-blur": 0,
          ...(/^roads_labels/.test(l.id) ? { "text-color": L.road_label } : { "text-color": L.label }),
        },
      };
    });
  const roads = base.findIndex((l) => /^roads_label/.test(l.id));
  const extrude = {
    id: "buildings-3d",
    type: "fill-extrusion",
    source: "protomaps",
    "source-layer": "buildings",
    minzoom: 13,
    paint: {
      // a shade darker the taller it is, so the skyline reads at a glance
      "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "height"], 9], 6, L.low, 40, L.tall],
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, ["coalesce", ["get", "height"], 9]],
      "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
      "fill-extrusion-opacity": 1,
      "fill-extrusion-vertical-gradient": true,
    },
  };
  // the footprint's edge, so rows of houses don't melt into one block
  const edges = {
    id: "buildings-edge",
    type: "line",
    source: "protomaps",
    "source-layer": "buildings",
    minzoom: 15,
    paint: { "line-color": L.edge, "line-width": 0.6 },
  };
  base.splice(roads < 0 ? base.length : roads, 0, edges, extrude);
  return {
    version: 8,
    glyphs: location.origin + "/maps/fonts/{fontstack}/{range}.pbf",
    ...(sprites ? { sprite: location.origin + "/maps/sprites/v4/" + (dark() ? "dark" : "light") } : {}),
    // soft light from the south-west, and a plain sky instead of an empty void when tilted
    light: { anchor: "map", position: [1.4, 210, 35], color: "#ffffff", intensity: dark() ? 0.25 : 0.4 },
    sky: {
      "sky-color": L.sky,
      "horizon-color": L.background,
      "fog-color": L.background,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.75,
    },
    sources: {
      protomaps: {
        type: "vector",
        url: "pmtiles://" + location.origin + FILE,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, Protomaps',
      },
    },
    layers: base,
  };
}

/* A small footprint on the ground around a point, `w` by `d` metres, or a
   circle when `round`, so generators and utility sites stand up as real
   little buildings instead of dots */
function footprint(lng, lat, w, d, round = false) {
  const mx = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
  const my = 1 / 110540;
  const ring = round
    ? Array.from({ length: 17 }, (_, i) => {
        const t = (i / 16) * 2 * Math.PI;
        return [lng + (Math.cos(t) * w * mx) / 2, lat + (Math.sin(t) * w * my) / 2];
      })
    : [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
        [-1, -1],
      ].map(([a, b]) => [lng + (a * w * mx) / 2, lat + (b * d * my) / 2]);
  return { type: "Polygon", coordinates: [ring] };
}

// size and height of each kind of utility site: width, depth, height (metres), round
const SITE_SHAPE = {
  substation: [60, 44, 7, false],
  plant: [72, 46, 14, false],
  pumping: [24, 20, 7, false],
  reservoir: [44, 44, 11, true],
  office: [28, 20, 16, false],
};

const COLOUR = { out: "--red", trouble: "--accent", unconfirmed: "--bg", quiet: "--ink-3" };

/* Draws the 3D map into `el`; same arguments as the flat drawMap, and
   `onFail` when our map file can't be read, so the flat map can take over */
let last = null; // what was drawn, to draw again when day/night changes
let watching = false;

export async function draw3D(el, states, onPlace, onFail, extra = {}) {
  const { ml, kit } = await load();
  last = [el, states, onPlace, onFail, extra];
  if (!watching) {
    watching = true;
    // the map's colours and our marks are read once, so redraw on a theme switch
    new MutationObserver(() => {
      if (map && last && last[0].isConnected) draw3D(...last);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  let keep = null; // the same view after a redraw
  if (map) {
    keep = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
    map.remove();
    map = null;
  }
  const css = getComputedStyle(el);
  const v = (name) => css.getPropertyValue(name).trim();
  const places = EU.sortedAreas().filter((a) => a.lat != null);
  map = new ml.Map({
    container: el,
    style: style(kit),
    // close enough to the Citadel that the buildings show (they come in at street level)
    center: [44.0092, 36.1912],
    zoom: 14.6,
    pitch: 58,
    bearing: -18,
    ...keep,
    maxPitch: 70,
    cooperativeGestures: true, // the page keeps scrolling; Ctrl + wheel zooms
    attributionControl: { compact: true },
  });
  map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-left");
  let failed = false;
  map.on("error", (e) => {
    if (failed || !(e && e.sourceId === "protomaps")) return;
    failed = true;
    available = false; // don't offer 3D again until the page is reloaded
    if (onFail) onFail();
  });

  const rank = { quiet: 0, unconfirmed: 1, trouble: 2, out: 3 };
  const features = places.map((a) => {
    const s = states[a.slug] || { kind: "quiet" };
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [a.lng, a.lat] },
      properties: {
        slug: a.slug,
        kind: s.kind,
        rank: rank[s.kind],
        name: a.city === "erbil" ? EU.areaName(a) : EU.placeName(a.slug),
        label: s.label || "",
        people: s.people || 0,
      },
    };
  });

  map.on("load", () => {
    map.addSource("places", { type: "geojson", data: { type: "FeatureCollection", features } });
    map.addLayer({
      id: "places",
      type: "circle",
      source: "places",
      layout: { "circle-sort-key": ["get", "rank"] },
      paint: {
        "circle-radius": ["match", ["get", "kind"], "out", 9, "trouble", 8, "unconfirmed", 7, 5],
        "circle-color": [
          "match",
          ["get", "kind"],
          "out",
          v(COLOUR.out),
          "trouble",
          v(COLOUR.trouble),
          "unconfirmed",
          v(COLOUR.unconfirmed),
          v(COLOUR.quiet),
        ],
        "circle-stroke-width": ["match", ["get", "kind"], "unconfirmed", 2, 1.5],
        "circle-stroke-color": ["match", ["get", "kind"], "unconfirmed", v("--accent"), "#ffffff"],
        "circle-pitch-alignment": "viewport",
      },
    });
    // a flat patch of ground under each place with no power or water, so the
    // dark part of the city shows at a glance (solid, no glow)
    map.addLayer(
      {
        id: "places-ground",
        type: "circle",
        source: "places",
        filter: ["in", ["get", "kind"], ["literal", ["out", "trouble"]]],
        paint: {
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 11, 14, 16, 448],
          "circle-color": ["match", ["get", "kind"], "out", v("--red"), v("--accent")],
          "circle-opacity": 0.1,
          "circle-stroke-color": ["match", ["get", "kind"], "out", v("--red"), v("--accent")],
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0.5,
          "circle-pitch-alignment": "map",
        },
      },
      "buildings-edge",
    );

    const point = (lng, lat, props) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: props,
    });
    const gens = (extra.gens || []).filter((g) => g.lat != null);
    const sites = (extra.sites || []).filter((x) => x.lat != null);
    const font = ["Noto Sans Medium"];
    const name = (minzoom, offset) => ({
      minzoom,
      layout: {
        "text-field": ["get", "name"],
        "text-font": font,
        "text-size": 12,
        "text-offset": [0, offset],
        "text-anchor": "top",
        "text-max-width": 9,
        "text-optional": true,
      },
      paint: { "text-color": v("--ink"), "text-halo-color": v("--bg"), "text-halo-width": 1.6 },
    });

    // generators: a small boxed set on the ground (dark when running, grey when
    // off), a dot on top to point at, and the name once you're close
    map.addSource("gens-body", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: gens.map((g) => ({
          type: "Feature",
          geometry: footprint(g.lng, g.lat, 12, 7),
          properties: { running: g.status === "running" ? 1 : 0 },
        })),
      },
    });
    map.addLayer({
      id: "gens-body",
      type: "fill-extrusion",
      source: "gens-body",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": ["case", ["==", ["get", "running"], 1], v("--ink"), v("--line-2")],
        "fill-extrusion-height": 4,
        "fill-extrusion-opacity": 1,
      },
    });
    map.addSource("gens", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: gens.map((g) =>
          point(g.lng, g.lat, {
            name: g.name,
            label: EU.t("gen.s." + g.status),
            running: g.status === "running" ? 1 : 0,
          }),
        ),
      },
    });
    map.addLayer({
      id: "gens",
      type: "circle",
      source: "gens",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 15, 6],
        "circle-color": ["case", ["==", ["get", "running"], 1], v("--ink"), v("--bg")],
        "circle-stroke-color": ["case", ["==", ["get", "running"], 1], v("--bg"), v("--ink")],
        "circle-stroke-width": 2,
        "circle-pitch-alignment": "viewport",
        "circle-translate": [0, -6],
        "circle-translate-anchor": "viewport",
      },
    });
    map.addLayer({ id: "gens-name", type: "symbol", source: "gens", ...name(14.8, 0.6) });

    // utility sites: each kind its own shape and height (a low fenced yard for
    // a substation, a round tank for a reservoir), in its service's colour
    map.addSource("sites-body", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: sites.map((x) => {
          const [w, d, h, round] = SITE_SHAPE[x.kind] || [18, 14, 6, false];
          return {
            type: "Feature",
            geometry: footprint(x.lng, x.lat, w, d, round),
            properties: { service: x.service, h },
          };
        }),
      },
    });
    map.addLayer({
      id: "sites-body",
      type: "fill-extrusion",
      source: "sites-body",
      minzoom: 13,
      paint: {
        "fill-extrusion-color": ["match", ["get", "service"], "water", v("--c-water"), v("--c-power")],
        "fill-extrusion-height": ["get", "h"],
        "fill-extrusion-opacity": 0.95,
        "fill-extrusion-vertical-gradient": true,
      },
    });
    map.addSource("sites", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: sites.map((x) =>
          point(x.lng, x.lat, {
            name: x.name || EU.t("tm.site.k." + x.kind),
            label: EU.t("tm.site.k." + x.kind),
            service: x.service,
          }),
        ),
      },
    });
    map.addLayer({
      id: "sites",
      type: "circle",
      source: "sites",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 5, 15, 7],
        "circle-color": v("--bg"),
        "circle-stroke-color": ["match", ["get", "service"], "water", v("--c-water"), v("--c-power")],
        "circle-stroke-width": 3,
        "circle-pitch-alignment": "viewport",
        "circle-translate": [0, -10],
        "circle-translate-anchor": "viewport",
      },
    });
    map.addLayer({ id: "sites-name", type: "symbol", source: "sites", ...name(14, 0.4) });
    map.addSource("spots", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: (extra.spots || []).map((p) =>
          point(p.lng, p.lat, { slug: p.area, name: p.label, label: EU.t("tm.map.spot"), kind: p.kind }),
        ),
      },
    });
    map.addLayer({
      id: "spots",
      type: "circle",
      source: "spots",
      paint: {
        "circle-radius": 3.5,
        "circle-color": ["match", ["get", "kind"], "out", v("--red"), v("--accent")],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
        "circle-pitch-alignment": "viewport",
      },
    });
    const tip = new ml.Popup({ closeButton: false, closeOnClick: false, className: "tm-maptip3d", offset: 12 });
    const hover = (e) => {
      const p = e.features[0].properties;
      map.getCanvas().style.cursor = "pointer";
      tip
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(
          `<b>${EU.esc(p.name)}</b>${p.label ? `<span>${EU.esc(p.label)}</span>` : ""}${p.people ? `<small>${EU.esc(EU.t("tm.peopleN", { n: p.people }))}</small>` : ""}`,
        )
        .addTo(map);
    };
    for (const layer of ["places", "gens", "spots", "sites"]) {
      map.on("mousemove", layer, hover);
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
        tip.remove();
      });
    }
    map.on("click", "places", (e) => onPlace(e.features[0].properties.slug));
    map.on("click", "spots", (e) => onPlace(e.features[0].properties.slug));
  });
}

/* Moves the 3D map to a city, like goToCity for the flat one */
export function goToCity3D(slug) {
  if (!map) return;
  const ps = EU.sortedAreas().filter((a) => a.city === slug && a.lat != null);
  if (!ps.length) return;
  if (slug === "erbil") map.flyTo({ center: [44.0092, 36.1912], zoom: 14.6, pitch: 58, bearing: -18 });
  else map.flyTo({ center: [ps[0].lng, ps[0].lat], zoom: 14.6, pitch: 58 });
}

/* Stops the 3D map, when the flat one takes over */
export function stop3D() {
  if (map) {
    map.remove();
    map = null;
  }
}
