/* © 2026 NorthPoint Tech. All rights reserved.
   The symbol for each kind of utility site, drawn the way infrastructure
   maps draw them: a square for electricity, a circle for water, with a
   simple mark inside. 16 × 16, stroked in the current colour.          */
export const SITE_ICON = {
  substation: '<path d="M9 2.5 5 8.5h3l-1 5 4-6.5H8z" fill="currentColor" stroke="none"/>',
  plant:
    '<path d="M8 2.8c2.3 3 3.6 4.9 3.6 6.6a3.6 3.6 0 0 1-7.2 0c0-1.7 1.3-3.6 3.6-6.6z" fill="currentColor" stroke="none"/>',
  pumping: '<circle cx="8" cy="8" r="3.4"/><path d="M8 4.6 11 8 8 11.4"/>',
  reservoir: '<path d="M3.5 5h9v7h-9z"/><path d="M3.5 8.4c1.5-1 3-1 4.5 0s3 1 4.5 0"/>',
  office: '<path d="M4 13V4h5v9M9 7h3v6M6 6h1M6 8.5h1M6 11h1"/>',
};

export function siteSvg(kind) {
  return `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${SITE_ICON[kind] || ""}</svg>`;
}
