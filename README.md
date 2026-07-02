# GeoCore Platform (v7)

**GeoCore** is a browser-based GIS data management and dashboarding tool built for
**Trinity Metals** to manage spatial data across its mine sites (Rutongo, Nyakabingo,
Musha). It lets a user upload spatial files (Shapefile, GeoJSON, CSV, KML/KMZ), style
and filter features on an interactive map, build chart/legend dashboards, run basic
spatial analysis, and export the result as an image or PDF.

There is **no backend server**. It is a single-page React application that runs
entirely in the user's browser and stores all project data locally using the
browser's IndexedDB.

---

## 1. What This Tool Does

- **Project management** — create/open/delete named projects from a landing page.
  Each project stores its own layers, styling, filters, dashboard layout, and basemap.
- **Data import** — drag/select files to load onto the map:
  - `.zip` (zipped Shapefile, parsed with `shpjs`)
  - `.geojson` / `.json`
  - `.csv` (auto-detects latitude/longitude columns)
  - `.kml` / `.kmz`
  - Custom XYZ/TMS/WMS tile layers by URL (raster overlays)
- **Interactive map (Leaflet)** — 6 basemaps (Satellite, Hybrid, Topographic,
  Street, Dark, Light), zoom/pan controls, geolocation button, place search
  (geocoding), distance/area measurement tools, north arrow, scale bar.
- **Symbology** — per-layer, per-category styling: fill color, outline color/width,
  point shape/size, opacity, hollow (outline-only) polygons.
- **Smart filtering** — build filter groups (AND/OR logic) with per-field rules
  (equals, contains, greater/less than, "is any of", etc.), scoped to one layer or all layers.
- **Charts & Legend widgets** — bar/pie/donut/line/area/table charts driven by any
  attribute field, count- or area-based, always reflecting only the features
  currently visible on screen (bounds + filters applied).
- **Dashboard layouts** — four preset grid arrangements (Classic, Dual Panel, Grid,
  Focus) combining the map with chart/legend panels, independently configurable.
- **Spatial analysis (Turf.js)** — Buffer, Centroid, and Dissolve tools that create
  new derived layers.
- **Export** — Map-only PNG, full dashboard PNG, or landscape PDF (via
  `leaflet-image`, `html2canvas`, and `jsPDF`).
- **Theming** — dark/light mode toggle, persisted in `localStorage`.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| UI framework | React (functional components + hooks: `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`) |
| Build tool | Vite |
| Mapping | [Leaflet 1.9.4](https://leafletjs.com/) |
| Charts | [Chart.js 4.4.1](https://www.chartjs.org/) |
| Spatial analysis | [Turf.js 6.5.0](https://turfjs.org/) |
| Shapefile parsing | [shpjs 4.0.4](https://github.com/calvinmetcalf/shapefile-js) |
| CSV parsing | [PapaParse 5.4.1](https://www.papaparse.com/) |
| KML/KMZ parsing | [@mapbox/togeojson](https://github.com/mapbox/togeojson) + [JSZip](https://stuk.github.io/jszip/) |
| Map screenshot capture | [leaflet-image](https://github.com/mapbox/leaflet-image) |
| DOM/dashboard capture | [html2canvas](https://html2canvas.hertzen.com/) |
| PDF export | [jsPDF](https://github.com/parallax/jsPDF) |
| Local persistence | Browser **IndexedDB** (no server database) |
| Geocoding | [Nominatim](https://nominatim.org/) (OpenStreetMap's free search API) |
| Icons | Inline hand-drawn SVG (no icon library dependency) |

All of the above (except React/Vite) are loaded **at runtime from public CDNs**
(cdnjs.cloudflare.com and cdn.jsdelivr.net) rather than bundled via npm — see
Section 6 for why this matters operationally.

---

## 3. Architecture Notes

The entire application currently lives in **one file** (`App.jsx`), exported as the
default component. Internally it is organized into logical sections (visible as
comment banners in the source):

```
Constants & themes → Geometry/IndexedDB/script-loader helpers → Icon set
→ Shared UI primitives (Btn, Modal, EmptyMsg) → Chart/Legend widgets
→ Symbol Editor modal → Filter system (rules/groups) → Export modal
→ Layout picker/engine → Tile layer + Analysis modals
→ ProjectsPage (landing screen) → Dashboard (main editor/map screen) → App (root)
```

Key architectural points to understand before modifying this code:

- **The Leaflet map instance is created once** and never destroyed while a project
  is open. It is a single persistent `<div>` (`mapDivRef`) that gets **repositioned
  via JavaScript** (`MapSlot` component) into whichever layout slot currently needs
  it (editor sidebar view, or one of the 4 dashboard grid layouts). This avoids
  re-initializing Leaflet on every layout change, but means map positioning logic
  is somewhat fragile — if you add new layout templates, you must also update
  `MapSlot`'s repositioning `ResizeObserver` logic.
- **Charts are self-contained** — each `ChartWidget` picks its own source layer,
  field, and chart type independently, and derives its own color mapping from
  that layer's data. There is no shared/global color state to keep in sync.
- **Auto-save** — project state is debounced (2s) and written to IndexedDB on any
  change via `saveProject()`. There is no manual "Save" button, no version history,
  and no conflict resolution if the same project is open in two tabs.

---

## 4. Data Storage & Persistence — Important Caveats

**All project data (layers, styling, filters, dashboard configuration) is stored
in the browser's IndexedDB (`geocore_v7` database), scoped to one browser profile
on one device.**

This means:
- Data does **not** sync across devices, browsers, or users. Two people cannot
  see the same project unless they manually export/re-import the source files.
- Clearing browser cookies/site data, using a different browser, using private/
  incognito mode, or reinstalling the OS/browser **will permanently delete every
  project**. There is currently no cloud backup, export/import of a whole project,
  or backend database.
- There is no authentication — anyone with access to that browser profile can
  open, edit, or delete any saved project.

**If long-term production use is intended, this is the single most important
gap to close before wider rollout** (see Section 7, Recommendations).

---

## 5. Getting Started (Local Development)

### Prerequisites
- Node.js 18+ and npm
- A modern browser (Chrome, Edge, or Firefox recommended — see Section 6)

### Setup
```bash
npm install
npm run dev
```
This starts a local Vite dev server (default: `http://localhost:5173`) with hot
module reload.

### Build for production
```bash
npm run build
```
This outputs a static bundle to `dist/`. Because there is no backend, the output
is just static HTML/JS/CSS.

### Preview a production build locally
```bash
npm run preview
```

---

## 6. Deployment / Hosting

Since GeoCore is a fully static, client-side app, it can be hosted on **any static
file host** — no server-side runtime, database, or API is required.

**Recommended options:**
- **Static hosting platforms:** Netlify, Vercel, Cloudflare Pages, GitHub Pages
  — connect the repo, set build command `npm run build`, publish directory `dist`.
- **Cloud storage + CDN:** AWS S3 + CloudFront, Azure Static Web Apps, GCP Cloud
  Storage + Cloud CDN.
- **Self-hosted:** any nginx/Apache server serving the contents of `dist/` as
  static files.

### Deployment requirements/checklist
- **Serve over HTTPS.** Browser Geolocation (`navigator.geolocation`, used by the
  "go to my location" button) only works on secure (HTTPS) origins, plus `localhost`.
- **Outbound network access required at runtime** — the browser (not the server)
  needs to reach:
  - `cdnjs.cloudflare.com`, `cdn.jsdelivr.net` (JS/CSS libraries)
  - Basemap tile providers: `mt1.google.com` (Google satellite/hybrid tiles — see
    note below), `tile.opentopomap.org`, `tile.openstreetmap.org`,
    `basemaps.cartocdn.com`
  - `nominatim.openstreetmap.org` (place search)
  - `fonts.googleapis.com` (Inter font)
  - If deployed inside a corporate network with an egress firewall/proxy, all of
    the above domains must be allow-listed or the app will fail to load/tile.
- **No environment variables or secrets are required** — there is no API key
  configuration in the current code.

---

## 7. Known Limitations & Recommended Improvements

These are worth reviewing with the incoming IT/dev team before this tool becomes
business-critical:

1. **No backend / no shared storage (highest priority).** Move project storage to
   a real database (e.g., via a lightweight backend API, Supabase, Firebase, or
   similar) so projects can be shared between users, backed up, and recovered.
   At minimum, add a "Export project as file" / "Import project file" feature so
   users can manually back up and hand off projects.
2. **No authentication or access control.** Anyone with the URL and browser
   access can view/edit/delete any project. Add login + per-project permissions
   if this will be used beyond a single trusted machine.
3. **Google tile usage without an API key** (`mt1.google.com/vt/...`) is not an
   officially supported/licensed way to consume Google imagery and may be rate-
   limited or blocked without notice. Recommend switching to the official Google
   Maps Platform API (with billing/API key) or a licensed imagery provider (e.g.,
   Mapbox, Esri, Bing Maps) for production use.
4. **CDN dependency at runtime.** All third-party libraries (Leaflet, Chart.js,
   Turf.js, etc.) load from public CDNs on every page load. Consider migrating
   these to npm dependencies bundled by Vite, which improves reliability,
   offline/air-gapped deployment support, and load performance.
5. **Single monolithic component file.** For long-term maintainability, split
   `App.jsx` into logical modules (map/, charts/, filters/, modals/, projects/)
   and consider adding TypeScript and basic tests, especially around the filter
   engine and chart data aggregation logic.
6. **No autosave conflict handling / version history.** If a project is open in
   two browser tabs, the last save silently wins. Consider adding "last modified"
   checks or simple undo/version snapshots.
7. **Nominatim usage policy.** The free Nominatim geocoding endpoint has a strict
   usage policy (max ~1 request/second, requires a valid `User-Agent`/referrer,
   no heavy/commercial use). At scale, switch to a self-hosted Nominatim instance
   or a paid geocoding provider.
8. **No automated tests or CI/CD pipeline** currently exists for this codebase —
   recommend adding basic build/lint checks before deployment on every push.

---

## 8. Browser Support

Tested against modern evergreen browsers (Chrome, Edge, Firefox). Requires:
- IndexedDB support (all modern browsers)
- ES2020+ JavaScript support
- `ResizeObserver` API support
- HTTPS (or `localhost`) for the geolocation feature to work

Internet Explorer and very old browser versions are **not supported**.

---

## 9. Quick Troubleshooting Guide

| Symptom | Likely Cause |
|---|---|
| Map/basemap tiles don't load | Firewall blocking tile provider domains (see Section 6) |
| App shows a blank/loading screen forever | CDN scripts (cdnjs/jsdelivr) blocked or unreachable |
| "Go to my location" doesn't work | Site not served over HTTPS, or browser location permission denied |
| Uploaded shapefile fails to parse | `.zip` must contain `.shp`, `.shx`, `.dbf` (and ideally `.prj`) at the root |
| Search box returns no results | Nominatim rate limit hit, or query too short/vague |
| A project "disappeared" | Browser data/cache was cleared, or being viewed from a different browser/device/profile (see Section 4) |
| Export PDF/PNG looks broken | Cross-origin tile provider blocked `html2canvas`; the app already works around this using `leaflet-image` for the map layer specifically — check console for CORS errors from third-party tiles |

---

## 10. Ownership / Handover Notes

This project was developed as a rapid, self-contained internal tool with a focus
on functionality over infrastructure. Before treating it as a permanent,
multi-user production system, prioritize Section 7, items 1–3 (backend storage,
authentication, and licensed tile provider) — everything else is a maintainability
improvement rather than a functional risk.
