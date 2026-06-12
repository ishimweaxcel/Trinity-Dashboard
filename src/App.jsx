import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════
   CDN
═══════════════════════════════════════════ */
const CDN = {
  leaflet_css: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  leaflet_js:  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  papaparse:   "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js",
  chartjs:     "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
  shpjs:       "https://cdn.jsdelivr.net/npm/shpjs@4.0.4/dist/shp.js",
  html2canvas: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  jspdf:       "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  togeojson:   "https://cdn.jsdelivr.net/npm/@mapbox/togeojson@0.16.0/togeojson.js",
  jszip:       "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  turf:        "https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js",
  leaflet_image: "https://cdn.jsdelivr.net/npm/leaflet-image@0.4.0/leaflet-image.js",
};

/* ═══════════════════════════════════════════
   TRINITY METALS THEME
═══════════════════════════════════════════ */
const THEMES = {
  dark: {
    "--bg":"#0f1923","--panel":"#162030","--panel2":"#1c2a3d","--panel3":"#223247",
    "--border":"#2a3d55","--text":"#e8e4d8","--text-muted":"#7a8fa8",
    "--accent":"#C8922A","--accent2":"#a87420","--accent-soft":"rgba(200,146,42,0.12)",
    "--hover":"rgba(200,146,42,0.08)","--danger":"#e05252","--success":"#4ecdc4",
    "--shadow":"rgba(0,0,0,0.7)","--navy":"#1A2B4A",
  },
  light: {
    "--bg":"#f0ede6","--panel":"#ffffff","--panel2":"#f7f5f0","--panel3":"#edeae3",
    "--border":"#d8d3c8","--text":"#1A2B4A","--text-muted":"#5a6e85",
    "--accent":"#C8922A","--accent2":"#a87420","--accent-soft":"rgba(200,146,42,0.10)",
    "--hover":"rgba(200,146,42,0.07)","--danger":"#c0392b","--success":"#27ae60",
    "--shadow":"rgba(26,43,74,0.15)","--navy":"#1A2B4A",
  },
};

/* ═══════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════ */
const CHART_PALETTE = [
  "#C8922A","#1A2B4A","#2E86AB","#E84855","#3BB273","#7B2D8B","#F4A261",
  "#264653","#E9C46A","#E76F51","#06D6A0","#118AB2","#FFB703","#8338EC",
  "#FB5607","#3A86FF","#FFBE0B","#FF006E","#8AC926","#6A4C93",
];
const POINT_SHAPES = ["circle","square","triangle","diamond","star","cross","hexagon"];
const BASEMAPS = {
  "Satellite":   "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  "Hybrid":      "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  "Topographic": "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  "Street":      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "Dark":        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  "Light":       "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};
const RWANDA = { center:[-1.9403,29.8739], zoom:9 };
const DB_NAME = "geocore_v7";

/* Dashboard layout templates */
const LAYOUT_TEMPLATES = {
  classic: {
    label:"Classic",
    desc:"Sidebar + full map",
    icon:"▤",
    areas:`"sidebar map"`,
    cols:"360px 1fr",
    rows:"1fr",
  },
  dual: {
    label:"Dual Panel",
    desc:"Charts · Map · Charts",
    icon:"▥",
    areas:`"left map right"`,
    cols:"300px 1fr 300px",
    rows:"1fr",
  },
  grid: {
    label:"Grid",
    desc:"2×2 equal panels",
    icon:"▦",
    areas:`"tl tr" "bl br"`,
    cols:"1fr 1fr",
    rows:"1fr 1fr",
  },
  focus: {
    label:"Focus",
    desc:"Large map + bottom charts",
    icon:"▧",
    areas:`"map map map" "c1 c2 c3"`,
    cols:"1fr 1fr 1fr",
    rows:"1fr 280px",
  },
};

/* ═══════════════════════════════════════════
   GEOMETRY HELPERS
═══════════════════════════════════════════ */
function detectGeomType(geojson) {
  const f = geojson?.features?.find(f => f.geometry?.type);
  if (!f) return "Point";
  const t = f.geometry.type;
  if (t.includes("Point"))   return "Point";
  if (t.includes("Line"))    return "Line";
  if (t.includes("Polygon")) return "Polygon";
  return "Point";
}

function ringAreaM2(coords) {
  const R = 6371008.8; let area = 0; const n = coords.length;
  for (let i = 0; i < n; i++) {
    const [lng1,lat1]=coords[i], [lng2,lat2]=coords[(i+1)%n];
    const dLng=(lng2-lng1)*Math.PI/180, phi1=lat1*Math.PI/180, phi2=lat2*Math.PI/180;
    area += dLng*(2+Math.sin(phi1)+Math.sin(phi2));
  }
  return Math.abs(area*R*R/2);
}
function featureAreaM2(f) {
  const t=f.geometry?.type, c=f.geometry?.coordinates;
  if(!t||!c) return 0;
  if(t==="Polygon")      return ringAreaM2(c[0]);
  if(t==="MultiPolygon") return c.reduce((s,p)=>s+ringAreaM2(p[0]),0);
  return 0;
}

/* ═══════════════════════════════════════════
   INDEXEDDB
═══════════════════════════════════════════ */
function openDB() {
  return new Promise((res,rej)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains("projects"))
        db.createObjectStore("projects",{keyPath:"id"});
    };
    req.onsuccess=e=>res(e.target.result);
    req.onerror=e=>rej(e.target.error);
  });
}
const dbOp=(mode,fn)=>openDB().then(db=>new Promise((res,rej)=>{
  const tx=db.transaction("projects",mode), req=fn(tx.objectStore("projects"));
  req.onsuccess=e=>res(e.target.result); req.onerror=e=>rej(e.target.error);
}));
const dbGetAll=()=>dbOp("readonly",s=>s.getAll());
const dbPut=obj=>dbOp("readwrite",s=>s.put(obj));
const dbDelete=id=>dbOp("readwrite",s=>s.delete(id));

/* ═══════════════════════════════════════════
   SCRIPT LOADER
═══════════════════════════════════════════ */
const _loaded=new Set();
function loadScript(src){
  if(_loaded.has(src)) return Promise.resolve();
  if(document.querySelector(`script[src="${src}"]`)){_loaded.add(src);return Promise.resolve();}
  return new Promise((res,rej)=>{
    const s=document.createElement("script"); s.src=src;
    s.onload=()=>{_loaded.add(src);res();}; s.onerror=rej;
    document.head.appendChild(s);
  });
}
function loadStyle(href){
  if(!document.querySelector(`link[href="${href}"]`)){
    const l=document.createElement("link"); l.rel="stylesheet"; l.href=href;
    document.head.appendChild(l);
  }
}

/* ═══════════════════════════════════════════
   ICONS
═══════════════════════════════════════════ */
const IP={
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  chart:  <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  map:    <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
  x:      <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  plus:   <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  image:  <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
  trash:  <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
  eye:    <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
  chevD:  <><polyline points="6 9 12 15 18 9"/></>,
  chevU:  <><polyline points="18 15 12 9 6 15"/></>,
  chevL:  <><polyline points="15 18 9 12 15 6"/></>,
  chevR:  <><polyline points="9 18 15 12 9 6"/></>,
  db:     <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
  zIn:    <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  zOut:   <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  home:   <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  sun:    <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
  moon:   <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
  palette:<><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2v-.5c0-.55.45-1 1-1h1c2.76 0 5-2.24 5-5 0-5.52-4.48-10-10-10z"/></>,
  export: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  folder: <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>,
  ruler:  <><line x1="4" y1="21" x2="21" y2="4"/><line x1="4" y1="21" x2="9" y2="16"/><line x1="21" y1="4" x2="16" y2="9"/><line x1="14" y1="3" x2="3" y2="14"/></>,
  filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
  label:  <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
  back:   <><polyline points="15 18 9 12 15 6"/></>,
  check:  <><polyline points="20 6 9 17 4 12"/></>,
  search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  area:   <><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></>,
  opacity:<><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z"/></>,
  pin:    <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></>,
  view:   <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  edit2:  <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  legend: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
};
const Icon=({name,size=16,color="currentColor"})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {IP[name]}
  </svg>
);

/* ═══════════════════════════════════════════
   SHARED PRIMITIVES
═══════════════════════════════════════════ */
const ss=(extra={})=>({
  background:"var(--panel2)",border:"1.5px solid var(--border)",color:"var(--text)",
  borderRadius:8,padding:"7px 10px",fontSize:12,fontFamily:"Inter,DM Sans,sans-serif",
  cursor:"pointer",outline:"none",...extra,
});

function Btn({onClick,active,children,title,disabled,style={}}){
  return(
    <button onClick={onClick} title={title} disabled={disabled}
      style={{display:"flex",alignItems:"center",gap:6,padding:"0 12px",height:36,
        background:active?"var(--accent)":"var(--panel)",
        border:`1.5px solid ${active?"var(--accent)":"var(--border)"}`,
        borderRadius:10,cursor:disabled?"not-allowed":"pointer",
        color:active?"#fff":"var(--text-muted)",fontSize:12,fontWeight:600,
        fontFamily:"Inter,DM Sans,sans-serif",whiteSpace:"nowrap",
        transition:"all 0.15s",opacity:disabled?0.5:1,...style}}>
      {children}
    </button>
  );
}

function Modal({title,subtitle,onClose,width=420,children}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",
      justifyContent:"center",background:"rgba(10,16,28,0.7)",backdropFilter:"blur(4px)"}}
      onClick={onClose}>
      <div style={{background:"var(--panel)",border:"1.5px solid var(--border)",borderRadius:16,
        width,maxHeight:"82vh",display:"flex",flexDirection:"column",
        boxShadow:"0 32px 80px var(--shadow)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",
          display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,letterSpacing:"0.05em",color:"var(--accent)",
              fontFamily:"Inter,DM Sans,sans-serif"}}>{title}</div>
            {subtitle&&<div style={{fontSize:10,color:"var(--text-muted)",marginTop:2,
              fontFamily:"Inter,DM Sans,sans-serif"}}>{subtitle}</div>}
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:4}}>
            <Icon name="x" size={16}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyMsg({children}){
  return(
    <div style={{padding:"32px 24px",textAlign:"center",fontSize:12,
      color:"var(--text-muted)",fontFamily:"Inter,DM Sans,sans-serif",opacity:0.6}}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════
   LEGEND SWATCH
═══════════════════════════════════════════ */
function legendSwatch(geomType,color,shape="circle",w=22,h=14){
  if(geomType==="Polygon")
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="1" y="1" width="${w-2}" height="${h-2}" rx="2" fill="${color}" stroke="${color}" stroke-width="1"/></svg>`;
  if(geomType==="Line")
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><line x1="2" y1="${h/2}" x2="${w-2}" y2="${h/2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  const r=Math.min(w,h),cx=r/2;
  let inner="";
  switch(shape){
    case "square":   inner=`<rect x="2" y="2" width="${r-4}" height="${r-4}" rx="1" fill="${color}"/>`;break;
    case "triangle": inner=`<polygon points="${cx},2 ${r-2},${r-2} 2,${r-2}" fill="${color}"/>`;break;
    case "diamond":  inner=`<polygon points="${cx},2 ${r-2},${cx} ${cx},${r-2} 2,${cx}" fill="${color}"/>`;break;
    case "star":{const pts=Array.from({length:10},(_,i)=>{const a=(i*Math.PI)/5-Math.PI/2,rd=i%2===0?cx-2:cx*0.45;return`${cx+rd*Math.cos(a)},${cx+rd*Math.sin(a)}`;});inner=`<polygon points="${pts.join(" ")}" fill="${color}"/>`;break;}
    case "cross":    inner=`<line x1="${cx}" y1="2" x2="${cx}" y2="${r-2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/><line x1="2" y1="${cx}" x2="${r-2}" y2="${cx}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;break;
    case "hexagon":{const hp=Array.from({length:6},(_,i)=>{const a=(Math.PI/3)*i-Math.PI/6;return`${cx+(cx-2)*Math.cos(a)},${cx+(cx-2)*Math.sin(a)}`;});inner=`<polygon points="${hp.join(" ")}" fill="${color}"/>`;break;}
    default: inner=`<circle cx="${cx}" cy="${cx}" r="${cx-1.5}" fill="${color}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r}" height="${r}" viewBox="0 0 ${r} ${r}">${inner}</svg>`;
}

function makePointSVG(shape,color,size=16){
  const r=size/2;let inner="";
  switch(shape){
    case "square":   inner=`<rect x="1" y="1" width="${size-2}" height="${size-2}" rx="2" fill="${color}" stroke="#111" stroke-width="1"/>`;break;
    case "triangle": inner=`<polygon points="${r},1 ${size-1},${size-1} 1,${size-1}" fill="${color}" stroke="#111" stroke-width="1"/>`;break;
    case "diamond":  inner=`<polygon points="${r},1 ${size-1},${r} ${r},${size-1} 1,${r}" fill="${color}" stroke="#111" stroke-width="1"/>`;break;
    case "star":{const pts=Array.from({length:10},(_,i)=>{const a=(i*Math.PI)/5-Math.PI/2,rd=i%2===0?r-1:r*0.42;return`${r+rd*Math.cos(a)},${r+rd*Math.sin(a)}`;});inner=`<polygon points="${pts.join(" ")}" fill="${color}" stroke="#111" stroke-width="0.8"/>`;break;}
    case "cross":    inner=`<line x1="${r}" y1="2" x2="${r}" y2="${size-2}" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/><line x1="2" y1="${r}" x2="${size-2}" y2="${r}" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`;break;
    case "hexagon":{const hp=Array.from({length:6},(_,i)=>{const a=(Math.PI/3)*i-Math.PI/6;return`${r+(r-1.5)*Math.cos(a)},${r+(r-1.5)*Math.sin(a)}`;});inner=`<polygon points="${hp.join(" ")}" fill="${color}" stroke="#111" stroke-width="1"/>`;break;}
    default: inner=`<circle cx="${r}" cy="${r}" r="${r-1}" fill="${color}" stroke="#111" stroke-width="1"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;
}

/* ═══════════════════════════════════════════
   CHART DATA BUILDER
   Derives colorMap from the layer itself —
   never depends on external shared state.
═══════════════════════════════════════════ */
function buildColorMap(features,field){
  if(!features?.length||!field) return {};
  const vals=[...new Set(features.map(f=>String(f.properties?.[field]??"N/A")))];
  const map={};
  vals.forEach((v,i)=>{map[v]=CHART_PALETTE[i%CHART_PALETTE.length];});
  return map;
}

function buildChartData(features,field,geomType,chartMode,colorMap){
  if(!features?.length||!field) return null;
  const totals={};
  if(chartMode==="area"&&geomType==="Polygon"){
    const areaKey=features[0]?.properties
      ?Object.keys(features[0].properties).find(k=>/shape.?area|area_ha|area_km|area_m2|area$/i.test(k))
      :null;
    features.forEach(f=>{
      const v=String(f.properties?.[field]??"N/A");
      const a=areaKey&&f.properties[areaKey]!=null?+f.properties[areaKey]||0:featureAreaM2(f);
      totals[v]=(totals[v]||0)+a;
    });
  } else {
    features.forEach(f=>{
      const v=String(f.properties?.[field]??"N/A");
      totals[v]=(totals[v]||0)+1;
    });
  }
  let labels=Object.keys(totals).sort((a,b)=>totals[b]-totals[a]).slice(0,25);
  const raw=labels.map(l=>totals[l]);
  const displaySum=raw.reduce((s,v)=>s+v,0);
  let pcts=raw.map(v=>displaySum>0?+((v/displaySum)*100).toFixed(2):0);
  if(pcts.length>0){const diff=100-pcts.reduce((s,v)=>s+v,0);pcts[pcts.length-1]=+(pcts[pcts.length-1]+diff).toFixed(2);}
  const unit=chartMode==="area"
    ?(raw.some(v=>v>=1e6)?"km²":raw.some(v=>v>=1e4)?"ha":"m²")
    :"features";
  const dv=chartMode==="area"
    ?raw.map(v=>unit==="km²"?+(v/1e6).toFixed(3):unit==="ha"?+(v/1e4).toFixed(2):+v.toFixed(0))
    :raw;
  const colors=labels.map(l=>colorMap[l]||CHART_PALETTE[labels.indexOf(l)%CHART_PALETTE.length]);
  return{labels,values:dv,raw,colors,unit,percentages:pcts};
}

/* ═══════════════════════════════════════════
   CHART INNER  (key-forced remount = no bug)
═══════════════════════════════════════════ */
function ChartInner({built,chartType,isDark}){
  const ref=useRef(null), inst=useRef(null);
  useEffect(()=>{
    if(!ref.current||!built) return;
    if(inst.current){inst.current.destroy();inst.current=null;}
    const {labels,values,colors,unit,percentages}=built;
    const tc=isDark?"#c8c4b8":"#1A2B4A", gc=isDark?"#1e2e42":"#e8e3d8";
    const isPolar=chartType==="pie"||chartType==="donut";
    inst.current=new window.Chart(ref.current.getContext("2d"),{
      type:chartType==="area"?"line":chartType==="donut"?"doughnut":chartType,
      data:{labels,datasets:[{
        data:values,
        backgroundColor:isPolar||chartType==="bar"?colors:chartType==="line"?"transparent":colors,
        borderColor:colors,
        borderWidth:isPolar?2:chartType==="bar"?0:2,
        tension:0.4,fill:chartType==="area",
        pointRadius:(chartType==="line"||chartType==="area")?5:0,
        pointBackgroundColor:colors,pointBorderColor:"#fff",pointBorderWidth:1.5,
        hoverOffset:isPolar?8:0,
      }]},
      options:{
        responsive:true,maintainAspectRatio:false,animation:{duration:250},layout:{padding:6},
        plugins:{
          legend:{display:isPolar,position:"bottom",labels:{
            color:tc,font:{size:10,family:"Inter,DM Sans,sans-serif"},
            padding:8,boxWidth:12,usePointStyle:true,
            generateLabels:ch=>{
              const ds=ch.data.datasets[0];
              return ch.data.labels.map((lbl,i)=>({
                text:`${lbl}  ${built.percentages[i]}%`,
                fillStyle:ds.backgroundColor[i],
                strokeStyle:ds.backgroundColor[i],
                fontColor:tc,
                color:tc,
                lineWidth:0,hidden:false,index:i,
              }));
            },
          }},
          tooltip:{backgroundColor:isDark?"#162030":"#fff",titleColor:tc,bodyColor:isDark?"#8fa5bc":"#5a6e85",
            borderColor:isDark?"#2a3d55":"#d8d3c8",borderWidth:1,padding:10,cornerRadius:8,
            callbacks:{label:ctx=>{const pct=built.percentages[ctx.dataIndex];const val=ctx.parsed.y??ctx.parsed;return`  ${val.toLocaleString()} ${unit}  (${pct}%)`;}},
          },
        },
        scales:isPolar?{}:{
          x:{ticks:{color:tc,font:{size:9,family:"Inter,DM Sans,sans-serif"},maxRotation:40},grid:{color:gc}},
          y:{ticks:{color:tc,font:{size:9,family:"Inter,DM Sans,sans-serif"}},grid:{color:gc},beginAtZero:true,
             title:{display:!!unit,text:unit,color:isDark?"#7a8fa8":"#5a6e85",font:{size:9}}},
        },
      },
    });
    return()=>{if(inst.current){inst.current.destroy();inst.current=null;}};
  },[built,chartType,isDark]);
  return <canvas ref={ref} style={{width:"100%",height:"100%"}}/>;
}

/* ═══════════════════════════════════════════
   SELF-CONTAINED CHART WIDGET
   Each widget holds its own layer ref, field,
   chartType, chartMode — fully independent.
   colorMap derived from layer data on the fly.
═══════════════════════════════════════════ */
function ChartWidget({layers,visibleFeatsByLayer,config,onConfigChange,isDark,compact=false,applyFilters}){
  const {layerId,field,chartType,chartMode}=config;

  const layer=useMemo(()=>layers.find(l=>String(l.id)===String(layerId))||layers[0],[layers,layerId]);
  const geomType=useMemo(()=>detectGeomType(layer?.geojson),[layer]);
  const fields=useMemo(()=>Object.keys(layer?.geojson?.features?.[0]?.properties||{}),[layer]);

  // Visible features for THIS layer — filtered and bounds-clipped
  // Falls back to filtered-all-features on first load (before bounds are computed)
  const visibleFeats=useMemo(()=>{
    const vf=visibleFeatsByLayer[String(layer?.id)];
    if(vf&&vf.length>0) return vf;
    // Bounds not computed yet — use all features but still apply filters
    const all=layer?.geojson?.features||[];
    return applyFilters?applyFilters(all,String(layer?.id)):all;
  },[visibleFeatsByLayer,layer,applyFilters]);

  // ColorMap derived directly from this layer's full data for this field
  const colorMap=useMemo(()=>buildColorMap(layer?.geojson?.features||[],field),[layer,field]);

  const built=useMemo(()=>buildChartData(visibleFeats,field,geomType,chartMode||"count",colorMap),
    [visibleFeats,field,geomType,chartMode,colorMap]);

  const chartKey=`${layer?.id}_${field}_${chartType}_${chartMode}_${visibleFeats.length}_${isDark?'dk':'lt'}`;
  const effectiveMode=chartMode||(geomType==="Polygon"?"area":"count");

  if(compact) return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Mini config bar */}
      <div style={{display:"flex",gap:5,padding:"8px 10px",borderBottom:"1px solid var(--border)",
        flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
        <select value={String(layer?.id||"")} onChange={e=>onConfigChange({layerId:e.target.value})}
          style={{...ss(),flex:1,minWidth:60,fontSize:10,padding:"4px 6px"}}>
          {layers.map(l=><option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
        <select value={field||""} onChange={e=>onConfigChange({field:e.target.value})}
          style={{...ss(),flex:1,minWidth:60,fontSize:10,padding:"4px 6px"}}>
          <option value="">— field —</option>
          {fields.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
        <select value={chartType||"bar"} onChange={e=>onConfigChange({chartType:e.target.value})}
          style={{...ss(),width:54,fontSize:10,padding:"4px 4px"}}>
          {["bar","pie","donut","line","area","table"].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {geomType==="Polygon"&&(
          <button onClick={()=>onConfigChange({chartMode:effectiveMode==="area"?"count":"area"})}
            style={{...ss(),fontSize:9,padding:"4px 7px",fontWeight:700,
              background:effectiveMode==="area"?"var(--accent)":"var(--panel2)",
              border:`1.5px solid ${effectiveMode==="area"?"var(--accent)":"var(--border)"}`,
              color:effectiveMode==="area"?"#fff":"var(--text-muted)"}}>
            {effectiveMode==="area"?"Area":"Count"}
          </button>
        )}
      </div>
      {/* Chart */}
      <div style={{flex:1,minHeight:0,padding:chartType==="table"?0:"8px",overflow:"hidden"}}>
        {chartType==="table"
          ?<TableWidget built={built}/>
          :<div style={{height:"100%"}}>
            {built?<ChartInner key={chartKey} built={built} chartType={chartType||"bar"} isDark={isDark}/>
              :<EmptyMsg>{field?"No visible features":"Select a field"}</EmptyMsg>}
          </div>
        }
      </div>
    </div>
  );

  // Full sidebar version
  return(
    <div style={{borderBottom:"1px solid var(--border)",padding:"12px 14px",
      background:"var(--panel)"}}>
      <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
        <select value={String(layer?.id||"")} onChange={e=>onConfigChange({layerId:e.target.value})}
          style={{...ss(),flex:1,minWidth:80}}>
          {layers.map(l=><option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
        <select value={field||""} onChange={e=>onConfigChange({field:e.target.value})}
          style={{...ss(),flex:1,minWidth:80}}>
          <option value="">— field —</option>
          {fields.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
        <select value={chartType||"bar"} onChange={e=>onConfigChange({chartType:e.target.value})}
          style={{...ss(),width:68}}>
          {["bar","pie","donut","line","area","table"].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {geomType==="Polygon"&&(
          <button onClick={()=>onConfigChange({chartMode:effectiveMode==="area"?"count":"area"})}
            style={{...ss(),fontWeight:700,fontSize:10,
              background:effectiveMode==="area"?"var(--accent)":"var(--panel2)",
              border:`1.5px solid ${effectiveMode==="area"?"var(--accent)":"var(--border)"}`,
              color:effectiveMode==="area"?"#fff":"var(--text-muted)"}}>
            {effectiveMode==="area"?"Area":"Count"}
          </button>
        )}
      </div>
      <div style={{height:250}}>
        {chartType==="table"
          ?<TableWidget built={built}/>
          :(built
            ?<ChartInner key={chartKey} built={built} chartType={chartType||"bar"} isDark={isDark}/>
            :<EmptyMsg>{field?"No visible features":"Select a field"}</EmptyMsg>)
        }
      </div>
    </div>
  );
}

function TableWidget({built}){
  if(!built) return <EmptyMsg>No data</EmptyMsg>;
  const{labels,values,colors,unit,percentages}=built;
  return(
    <div style={{overflowY:"auto",maxHeight:300}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead>
          <tr style={{borderBottom:"2px solid var(--border)",position:"sticky",top:0,background:"var(--panel)"}}>
            {["Class",unit==="features"?"Count":unit,"%",""].map(h=>(
              <th key={h} style={{padding:"6px 10px",textAlign:h==="Class"?"left":"right",
                color:"var(--text-muted)",fontWeight:600,fontSize:10,
                fontFamily:"Inter,DM Sans,sans-serif",letterSpacing:"0.05em"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((val,i)=>(
            <tr key={val} style={{borderBottom:"1px solid var(--border)"}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{padding:"6px 10px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:10,height:10,borderRadius:2,background:colors[i],flexShrink:0,display:"inline-block"}}/>
                <span style={{color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap",maxWidth:120,fontFamily:"Inter,DM Sans,sans-serif"}}>{val}</span>
              </td>
              <td style={{padding:"6px 10px",textAlign:"right",color:"var(--text)",
                fontFamily:"monospace",fontVariantNumeric:"tabular-nums"}}>
                {typeof values[i]==="number"?values[i].toLocaleString(undefined,{maximumFractionDigits:2}):values[i]}
              </td>
              <td style={{padding:"6px 10px",textAlign:"right",color:"var(--text-muted)",fontFamily:"monospace"}}>
                {percentages[i]}%
              </td>
              <td style={{padding:"6px 10px",width:50}}>
                <div style={{height:4,borderRadius:3,background:"var(--border)",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${percentages[i]}%`,background:colors[i],borderRadius:3}}/>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LEGEND WIDGET  (standalone panel)
═══════════════════════════════════════════ */
function LegendWidget({layers,visibleFeatsByLayer,config,onConfigChange}){
  const {layerId,field}=config;
  const layer=layers.find(l=>String(l.id)===String(layerId))||layers[0];
  const geomType=detectGeomType(layer?.geojson);
  const fields=Object.keys(layer?.geojson?.features?.[0]?.properties||{});
  const colorMap=useMemo(()=>buildColorMap(layer?.geojson?.features||[],field),[layer,field]);
  const shapeMap=useMemo(()=>{
    const vals=Object.keys(colorMap);
    const m={};vals.forEach((v,i)=>{m[v]=POINT_SHAPES[i%POINT_SHAPES.length];});return m;
  },[colorMap]);
  const visibleFeats=visibleFeatsByLayer[String(layer?.id)]||[];

  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",gap:6,padding:"8px 12px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
        <select value={String(layer?.id||"")} onChange={e=>onConfigChange({layerId:e.target.value})}
          style={{...ss(),flex:1,fontSize:10,padding:"4px 6px"}}>
          {layers.map(l=><option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
        <select value={field||""} onChange={e=>onConfigChange({field:e.target.value})}
          style={{...ss(),flex:1,fontSize:10,padding:"4px 6px"}}>
          <option value="">— field —</option>
          {fields.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
        {!field||Object.keys(colorMap).length===0
          ?<EmptyMsg>Select layer and field</EmptyMsg>
          :Object.entries(colorMap).map(([val,col])=>{
            const shape=shapeMap[val]||"circle";
            const cnt=visibleFeats.filter(f=>String(f.properties?.[field])===val).length;
            return(
              <div key={val} style={{display:"flex",alignItems:"center",gap:8,
                padding:"5px 0",borderBottom:"1px solid var(--border)"}}>
                <span dangerouslySetInnerHTML={{__html:legendSwatch(geomType,col,shape,22,14)}}
                  style={{flexShrink:0,display:"flex",alignItems:"center"}}/>
                <span style={{flex:1,fontSize:12,color:"var(--text)",overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"Inter,DM Sans,sans-serif"}}>{val}</span>
                <span style={{fontSize:10,color:"var(--text-muted)",fontFamily:"monospace",flexShrink:0}}>{cnt}</span>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   NORTH ARROW
═══════════════════════════════════════════ */
function NorthArrow(){
  return(
    <div style={{position:"absolute",right:14,top:110,zIndex:500,
      width:38,height:38,background:"var(--panel)",border:"1.5px solid var(--border)",
      borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
      boxShadow:"0 2px 8px var(--shadow)"}}>
      <svg width="28" height="28" viewBox="0 0 28 28">
        <text x="14" y="25" textAnchor="middle" fontSize="7" fontWeight="700"
          fill="var(--text-muted)" fontFamily="Inter,DM Sans,sans-serif">N</text>
        <polygon points="14,4 16.5,14 14,12 11.5,14" fill="var(--accent)"/>
        <polygon points="14,22 16.5,14 14,16 11.5,14" fill="var(--border)"/>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════
   GEOLOCATION BUTTON
═══════════════════════════════════════════ */
function GeolocateButton({mapRef}){
  const [loading,setLoading]=useState(false);
  const [active,setActive]=useState(false);
  const markerRef=useRef(null);

  const locate=()=>{
    if(!navigator.geolocation){alert("Geolocation not supported by your browser.");return;}
    setLoading(true);
    navigator.geolocation.getCurrentPosition(pos=>{
      setLoading(false);setActive(true);
      const {latitude:lat,longitude:lng}=pos.coords;
      if(!mapRef.current) return;
      const L=window.L;
      if(markerRef.current){markerRef.current.remove();markerRef.current=null;}
      mapRef.current.setView([lat,lng],15);
      markerRef.current=L.circleMarker([lat,lng],{
        radius:10,color:"#C8922A",fillColor:"#C8922A",fillOpacity:0.35,weight:3,
      }).addTo(mapRef.current)
        .bindPopup(`<div style="font-family:Inter,sans-serif;font-size:12px;color:#1A2B4A;padding:4px"><strong>You are here</strong><br/><span style="color:#7a8fa8;font-size:10px">${lat.toFixed(5)}, ${lng.toFixed(5)}</span></div>`)
        .openPopup();
      setTimeout(()=>setActive(false),3000);
    },err=>{
      setLoading(false);
      const msgs={1:"Location access denied.",2:"Location unavailable.",3:"Location request timed out."};
      alert(msgs[err.code]||"Location error.");
    },{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  };

  return(
    <button onClick={locate} title="Go to my location"
      style={{width:38,height:38,borderRadius:10,
        background:active?"var(--accent)":loading?"var(--panel2)":"var(--panel)",
        border:`1.5px solid ${active?"var(--accent)":"var(--border)"}`,
        cursor:loading?"not-allowed":"pointer",display:"flex",
        alignItems:"center",justifyContent:"center",
        color:active?"#fff":"var(--text-muted)",
        boxShadow:"0 2px 8px var(--shadow)",transition:"all 0.15s"}}
      onMouseEnter={e=>{if(!loading&&!active){e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}}
      onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-muted)";}}}
      disabled={loading}>
      {loading
        ?<div style={{width:14,height:14,border:"2px solid var(--accent)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        :<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>
        </svg>
      }
    </button>
  );
}

/* ═══════════════════════════════════════════
   GEOCODER
═══════════════════════════════════════════ */
function GeocoderSearch({mapRef}){
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const timer=useRef(null),inputRef=useRef(null);

  useEffect(()=>{if(open)setTimeout(()=>inputRef.current?.focus(),80);},[open]);

  useEffect(()=>{
    clearTimeout(timer.current);
    if(q.trim().length<2){setResults([]);return;}
    setLoading(true);
    timer.current=setTimeout(async()=>{
      try{
        const res=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,{headers:{"Accept-Language":"en"}});
        setResults(await res.json());
      }catch{setResults([]);}
      finally{setLoading(false);}
    },400);
  },[q]);

  const goTo=r=>{
    if(!mapRef.current) return;
    const L=window.L,lat=+r.lat,lon=+r.lon;
    mapRef.current.setView([lat,lon],14);
    const m=L.circleMarker([lat,lon],{radius:8,color:"#C8922A",fillColor:"#C8922A",fillOpacity:1,weight:2}).addTo(mapRef.current);
    m.bindPopup(`<div style="font-family:Inter,sans-serif;font-size:12px;color:#1A2B4A;min-width:160px;padding:4px"><strong>${r.display_name.split(",")[0]}</strong><br/><span style="color:#7a8fa8;font-size:10px">${r.display_name.split(",").slice(1,3).join(",")}</span></div>`).openPopup();
    setTimeout(()=>m.remove(),8000);
    setOpen(false);setQ("");setResults([]);
  };

  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(p=>!p)} title="Search location"
        style={{width:38,height:38,borderRadius:10,background:open?"var(--accent)":"var(--panel)",
          border:`1.5px solid ${open?"var(--accent)":"var(--border)"}`,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",
          color:open?"#fff":"var(--text-muted)",transition:"all 0.15s",
          boxShadow:"0 2px 8px var(--shadow)"}}>
        <Icon name="search" size={15} color={open?"#fff":"var(--text-muted)"}/>
      </button>
      {open&&(
        <div style={{position:"absolute",bottom:46,right:0,width:300,
          background:"var(--panel)",border:"1.5px solid var(--border)",
          borderRadius:14,overflow:"hidden",boxShadow:"0 12px 40px var(--shadow)",zIndex:700}}>
          <div style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",
            display:"flex",alignItems:"center",gap:8}}>
            <Icon name="search" size={14} color="var(--text-muted)"/>
            <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Search places…"
              style={{flex:1,background:"transparent",border:"none",outline:"none",
                color:"var(--text)",fontSize:13,fontFamily:"Inter,DM Sans,sans-serif"}}/>
            {loading&&<div style={{width:13,height:13,border:"2px solid var(--accent)",
              borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
            {!loading&&q&&<button onClick={()=>{setQ("");setResults([]);}}
              style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:0}}>
              <Icon name="x" size={13}/>
            </button>}
          </div>
          {results.length>0&&(
            <div style={{maxHeight:220,overflowY:"auto"}}>
              {results.map((r,i)=>(
                <button key={i} onClick={()=>goTo(r)}
                  style={{display:"flex",alignItems:"flex-start",gap:10,width:"100%",
                    padding:"10px 14px",background:"transparent",border:"none",
                    borderBottom:"1px solid var(--border)",cursor:"pointer",textAlign:"left"}}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <Icon name="pin" size={14} color="var(--accent)"/>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:"var(--text)",
                      fontFamily:"Inter,DM Sans,sans-serif"}}>{r.display_name.split(",")[0]}</div>
                    <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2,
                      fontFamily:"Inter,DM Sans,sans-serif"}}>{r.display_name.split(",").slice(1,4).join(", ")}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {results.length===0&&q.trim().length>=2&&!loading&&(
            <div style={{padding:"16px 14px",fontSize:12,color:"var(--text-muted)",textAlign:"center",fontFamily:"Inter,DM Sans,sans-serif"}}>No results found</div>
          )}
          {q.trim().length<2&&(
            <div style={{padding:"14px",fontSize:11,color:"var(--text-muted)",fontFamily:"Inter,DM Sans,sans-serif",lineHeight:1.6}}>
              Search any place — Rwanda, mine sites, coordinates…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SYMBOL EDITOR MODAL
═══════════════════════════════════════════ */
function SymbolEditor({layer,customColorMap={},customShapeMap={},customOpacityMap={},customSizeMap={},
  customOutlineColorMap={},customOutlineWidthMap={},customHollowMap={},primaryField,
  onColorChange,onShapeChange,onOpacityChange,onSizeChange,
  onOutlineColorChange,onOutlineWidthChange,onHollowChange,onClose}){
  const geomType=detectGeomType(layer?.geojson);
  const isPoint=geomType==="Point",isPoly=geomType==="Polygon",isLine=geomType==="Line";
  const baseColorMap=useMemo(()=>buildColorMap(layer?.geojson?.features||[],primaryField),[layer,primaryField]);
  const cats=Object.keys(baseColorMap);
  const getColor=cat=>customColorMap[cat]||baseColorMap[cat]||"#C8922A";
  const getOutline=cat=>customOutlineColorMap[cat]||getColor(cat);
  const isHollow=cat=>!!customHollowMap[cat];

  // Global size shortcut for points
  const [globalSize,setGlobalSize]=useState(16);
  const applyGlobalSize=sz=>{setGlobalSize(sz);cats.forEach(cat=>onSizeChange(cat,sz));};

  const ColSwatch=({color,onChange,title=""})=>(
    <div title={title} style={{position:"relative",width:24,height:24,borderRadius:5,
      background:color,border:"2px solid var(--border)",overflow:"hidden",cursor:"pointer",flexShrink:0}}>
      <input type="color" value={color} onChange={e=>onChange(e.target.value)}
        style={{opacity:0,position:"absolute",inset:0,width:"100%",height:"100%",cursor:"pointer",padding:0}}/>
    </div>
  );

  return(
    <Modal title="Symbol Editor" subtitle={`${geomType} Layer — ${layer?.name||""}`} onClose={onClose} width={520}>
      {/* Global point size */}
      {isPoint&&(
        <div style={{padding:"10px 18px",borderBottom:"1px solid var(--border)",
          display:"flex",alignItems:"center",gap:12,background:"var(--panel2)"}}>
          <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
            fontFamily:"Inter,DM Sans,sans-serif",whiteSpace:"nowrap"}}>ALL SIZES</span>
          <input type="range" min="6" max="48" step="1" value={globalSize}
            onChange={e=>applyGlobalSize(+e.target.value)} style={{flex:1}}/>
          <span style={{fontSize:12,fontWeight:700,color:"var(--accent)",
            minWidth:32,textAlign:"right",fontFamily:"monospace"}}>{globalSize}px</span>
          <div style={{width:globalSize,height:globalSize,borderRadius:"50%",
            background:"var(--accent)",flexShrink:0,transition:"all 0.1s"}}/>
        </div>
      )}
      {/* Column headers */}
      <div style={{display:"grid",
        gridTemplateColumns:isPoint
          ?"32px 1fr 72px 60px 60px 56px"
          :"32px 1fr 56px 56px 44px 56px",
        gap:6,padding:"7px 16px",borderBottom:"1px solid var(--border)",
        fontSize:9,color:"var(--text-muted)",fontWeight:700,
        letterSpacing:"0.08em",fontFamily:"Inter,DM Sans,sans-serif",textTransform:"uppercase"}}>
        <span/>
        <span>CLASS</span>
        {isPoint&&<span style={{textAlign:"center"}}>SHAPE</span>}
        {!isPoint&&<span style={{textAlign:"center"}}>HOLLOW</span>}
        <span style={{textAlign:"center"}}>FILL</span>
        <span style={{textAlign:"center"}}>OUTLINE</span>
        {isPoint&&<span style={{textAlign:"center"}}>SIZE</span>}
        {!isPoint&&<span style={{textAlign:"center"}}>W</span>}
        <span style={{textAlign:"center"}}>{isPoly?"FILL %":"OPACITY"}</span>
      </div>
      <div style={{overflowY:"auto",flex:1}}>
        {cats.length===0?<EmptyMsg>Select a classification field first</EmptyMsg>
          :cats.map(cat=>{
          const sz=customSizeMap[cat]||globalSize||16;
          const hollow=isHollow(cat);
          const outW=customOutlineWidthMap[cat]??(isLine?2.5:1.5);
          return(
          <div key={cat} style={{display:"grid",
            gridTemplateColumns:isPoint
              ?"32px 1fr 72px 60px 60px 56px"
              :"32px 1fr 56px 56px 44px 56px",
            gap:6,padding:"9px 16px",borderBottom:"1px solid var(--border)",alignItems:"center"}}>

            {/* Fill color swatch (also main color for lines/points) */}
            <ColSwatch color={getColor(cat)} onChange={v=>onColorChange(cat,v)} title="Fill colour"/>

            {/* Class label with preview */}
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
              <span dangerouslySetInnerHTML={{__html:legendSwatch(geomType,hollow?"transparent":getColor(cat),customShapeMap[cat]||"circle",22,13)}}
                style={{flexShrink:0,display:"flex",alignItems:"center"}}/>
              <span style={{fontSize:12,color:"var(--text)",overflow:"hidden",
                textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"Inter,DM Sans,sans-serif"}}>{cat}</span>
            </div>

            {/* Shape (points) OR Hollow toggle (polygon/line) */}
            {isPoint?(
              <select value={customShapeMap[cat]||"circle"} onChange={e=>onShapeChange(cat,e.target.value)}
                style={ss({fontSize:10,padding:"3px 5px"})}>
                {POINT_SHAPES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            ):(
              <button onClick={()=>onHollowChange(cat,!hollow)} title={hollow?"Click to fill":"Click for no fill (hollow)"}
                style={{padding:"4px 8px",borderRadius:7,fontSize:10,fontWeight:700,cursor:"pointer",
                  fontFamily:"Inter,DM Sans,sans-serif",border:"1.5px solid var(--border)",
                  background:hollow?"var(--panel3)":"var(--accent-soft)",
                  color:hollow?"var(--text-muted)":"var(--accent)"}}>
                {hollow?"∅ Hollow":"● Filled"}
              </button>
            )}

            {/* Fill color picker (shown for all, greyed out when hollow) */}
            <div style={{display:"flex",justifyContent:"center",opacity:hollow?0.3:1}}>
              <ColSwatch color={getColor(cat)} onChange={v=>{onColorChange(cat,v);}} title="Fill colour"/>
            </div>

            {/* Outline color picker */}
            <div style={{display:"flex",justifyContent:"center"}}>
              <ColSwatch color={getOutline(cat)} onChange={v=>onOutlineColorChange(cat,v)} title="Outline colour"/>
            </div>

            {/* Size (points) OR outline width (poly/line) */}
            {isPoint?(
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <input type="range" min="6" max="48" step="1" value={sz}
                  onChange={e=>onSizeChange(cat,+e.target.value)} style={{flex:1}}/>
                <span style={{fontSize:9,color:"var(--text-muted)",minWidth:18,
                  textAlign:"right",fontFamily:"monospace"}}>{sz}</span>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:3}}>
                <input type="range" min="0.5" max="8" step="0.5" value={outW}
                  onChange={e=>onOutlineWidthChange(cat,+e.target.value)} style={{flex:1}}/>
                <span style={{fontSize:9,color:"var(--text-muted)",minWidth:16,
                  textAlign:"right",fontFamily:"monospace"}}>{outW}</span>
              </div>
            )}

            {/* Opacity (greyed when hollow for polygons) */}
            <div style={{display:"flex",alignItems:"center",gap:4,opacity:(hollow&&isPoly)?0.3:1}}>
              <input type="range" min="0" max="1" step="0.05"
                value={customOpacityMap[cat]??0.85}
                onChange={e=>onOpacityChange(cat,+e.target.value)} style={{flex:1}}/>
              <span style={{fontSize:9,color:"var(--text-muted)",minWidth:24,
                textAlign:"right",fontFamily:"monospace"}}>
                {Math.round((customOpacityMap[cat]??0.85)*100)}%
              </span>
            </div>
          </div>
        )})}
      </div>
      <div style={{padding:"8px 16px",borderTop:"1px solid var(--border)",fontSize:11,
        color:"var(--text-muted)",textAlign:"center",fontFamily:"Inter,DM Sans,sans-serif"}}>
        {isPoint?"Fill colour · Shape · Size slider · Opacity"
          :"∅ Hollow = no fill · Fill colour swatch · Outline colour swatch · Outline width · Opacity"}
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   FILTER SYSTEM v2
   Data model:
   filters = [
     {
       id, layerId:"all"|layerId,
       groupOp:"AND"|"OR",   ← how rules within this group combine
       rules:[
         {id, field, op:"="|"≠"|"in"|"not_in"|"contains"|">"|"<"|">="|"<=", val, vals:[]}
       ]
     }
   ]
   Groups are always joined by AND between each other.
═══════════════════════════════════════════ */

/* Evaluate a single rule against a feature */
function evalRule(rule,props){
  const raw=props?.[rule.field];
  const v=raw==null?"":String(raw);
  const rv=String(rule.val??"");
  switch(rule.op){
    case "=":       return v===rv;
    case "≠":       return v!==rv;
    case "in":      return (rule.vals||[]).map(String).includes(v);
    case "not_in":  return !(rule.vals||[]).map(String).includes(v);
    case "contains":return v.toLowerCase().includes(rv.toLowerCase());
    case "starts":  return v.toLowerCase().startsWith(rv.toLowerCase());
    case ">":       return parseFloat(v)>parseFloat(rv);
    case "<":       return parseFloat(v)<parseFloat(rv);
    case ">=":      return parseFloat(v)>=parseFloat(rv);
    case "<=":      return parseFloat(v)<=parseFloat(rv);
    default:        return true;
  }
}

/* Evaluate a filter group against a feature */
function evalGroup(group,feature,layerId){
  if(!group.rules?.length) return true;
  if(group.layerId!=="all"&&String(group.layerId)!==String(layerId)) return true;
  const props=feature.properties||{};
  if(group.groupOp==="OR") return group.rules.some(r=>evalRule(r,props));
  return group.rules.every(r=>evalRule(r,props));
}

/* Apply all filter groups to a feature — groups are AND-combined */
function passesAllFilters(filters,feature,layerId){
  if(!filters?.length) return true;
  return filters.every(g=>evalGroup(g,feature,layerId));
}

const FILTER_OPS=[
  {op:"in",     label:"is any of  ✓"},
  {op:"not_in", label:"is none of  ✗"},
  {op:"=",      label:"equals exactly"},
  {op:"≠",      label:"does not equal"},
  {op:"contains",label:"contains text"},
  {op:">",      label:"greater than  >"},
  {op:"<",      label:"less than  <"},
  {op:">=",     label:"at least  ≥"},
  {op:"<=",     label:"at most  ≤"},
];

function FilterRuleRow({rule,features,fields,onChange,onRemove}){
  const uniqueVals=useMemo(()=>{
    if(!rule.field||!features?.length) return [];
    return[...new Set(features.map(f=>String(f.properties?.[rule.field]??"")).filter(Boolean))].sort().slice(0,80);
  },[rule.field,features]);

  const isMulti=rule.op==="in"||rule.op==="not_in";
  const selected=rule.vals||[];

  const toggleVal=v=>{
    const next=selected.includes(v)?selected.filter(x=>x!==v):[...selected,v];
    onChange({...rule,vals:next});
  };

  return(
    <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:10,
      padding:"10px 12px",marginBottom:8}}>
      <div style={{display:"flex",gap:6,marginBottom:isMulti&&uniqueVals.length?8:0,flexWrap:"wrap"}}>
        {/* Field selector */}
        <select value={rule.field} onChange={e=>onChange({...rule,field:e.target.value,val:"",vals:[]})}
          style={{...ss(),flex:"1 1 110px"}}>
          {fields.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
        {/* Operator */}
        <select value={rule.op} onChange={e=>onChange({...rule,op:e.target.value,val:"",vals:[]})}
          style={{...ss(),flex:"0 0 110px"}}>
          {FILTER_OPS.map(o=><option key={o.op} value={o.op}>{o.label}</option>)}
        </select>
        {/* Single value picker */}
        {!isMulti&&(
          <select value={rule.val} onChange={e=>onChange({...rule,val:e.target.value})}
            style={{...ss(),flex:"1 1 110px"}}>
            <option value="">— pick —</option>
            {uniqueVals.map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        )}
        <button onClick={onRemove}
          style={{flex:"0 0 30px",height:32,background:"none",border:"1px solid var(--border)",
            borderRadius:7,cursor:"pointer",color:"var(--danger)",display:"flex",
            alignItems:"center",justifyContent:"center"}}>
          <Icon name="x" size={13}/>
        </button>
      </div>
      {/* Multi-value chips for "is any of" / "is none of" */}
      {isMulti&&uniqueVals.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:5,maxHeight:120,overflowY:"auto",
          padding:"4px 0",borderTop:"1px solid var(--border)",marginTop:2}}>
          {uniqueVals.map(v=>{
            const active=selected.includes(v);
            return(
              <button key={v} onClick={()=>toggleVal(v)}
                style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:active?700:400,
                  cursor:"pointer",fontFamily:"Inter,DM Sans,sans-serif",
                  background:active?"var(--accent)":"var(--panel3)",
                  color:active?"#fff":"var(--text-muted)",
                  border:`1.5px solid ${active?"var(--accent)":"var(--border)"}`,
                  transition:"all 0.1s"}}>
                {v}
              </button>
            );
          })}
        </div>
      )}
      {isMulti&&selected.length>0&&(
        <div style={{marginTop:6,fontSize:11,color:"var(--text-muted)",fontFamily:"Inter,DM Sans,sans-serif"}}>
          {selected.length} value{selected.length>1?"s":""} selected
        </div>
      )}
    </div>
  );
}

function FilterGroupCard({group,layers,activeLayerFeatures,allLayerFeatures,onChange,onRemove,index}){
  const layer=layers.find(l=>String(l.id)===String(group.layerId));
  const features=group.layerId==="all"?activeLayerFeatures
    :(allLayerFeatures[String(group.layerId)]||activeLayerFeatures);
  const fields=useMemo(()=>Object.keys(features?.[0]?.properties||{}),[features]);

  const addRule=()=>{
    const f=fields[0]||"";
    onChange({...group,rules:[...group.rules,{id:Date.now(),field:f,op:"in",val:"",vals:[]}]});
  };
  const updateRule=(id,patch)=>onChange({...group,rules:group.rules.map(r=>r.id===id?{...r,...patch}:r)});
  const removeRule=id=>onChange({...group,rules:group.rules.filter(r=>r.id!==id)});

  const isOR=group.groupOp==="OR";

  return(
    <div style={{border:`1.5px solid ${isOR?"var(--accent)":"var(--border)"}`,
      borderRadius:12,marginBottom:12,overflow:"hidden",
      boxShadow:isOR?"0 0 0 1px var(--accent-soft)":"none"}}>
      {/* Group header — plain language */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
        background:"var(--panel3)",borderBottom:"1px solid var(--border)",flexWrap:"wrap"}}>
        {/* Show/hide label */}
        <span style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",
          fontFamily:"Inter,DM Sans,sans-serif",background:"var(--panel2)",
          padding:"2px 8px",borderRadius:5,border:"1px solid var(--border)"}}>
          {index===0?"Show":"And also"}
        </span>
        {/* Layer scope pill */}
        <span style={{fontSize:11,color:"var(--text-muted)",fontFamily:"Inter,DM Sans,sans-serif"}}>features in</span>
        <select value={group.layerId} onChange={e=>onChange({...group,layerId:e.target.value})}
          style={{...ss(),fontSize:11,padding:"3px 8px",flex:"1 1 100px",minWidth:80}}>
          <option value="all">all layers</option>
          {layers.map(l=><option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
        {/* Match mode */}
        <span style={{fontSize:11,color:"var(--text-muted)",fontFamily:"Inter,DM Sans,sans-serif"}}>matching</span>
        <div style={{display:"flex",borderRadius:7,overflow:"hidden",border:"1px solid var(--border)",flexShrink:0}}>
          {[["OR","any rule"],["AND","all rules"]].map(([op,lbl])=>(
            <button key={op} onClick={()=>onChange({...group,groupOp:op})}
              title={op==="OR"?"Feature passes if ANY rule matches":"Feature passes only if ALL rules match"}
              style={{padding:"3px 10px",fontSize:10,fontWeight:700,border:"none",cursor:"pointer",
                fontFamily:"Inter,DM Sans,sans-serif",
                background:group.groupOp===op?"var(--accent)":"var(--panel2)",
                color:group.groupOp===op?"#fff":"var(--text-muted)"}}>
              {lbl}
            </button>
          ))}
        </div>
        <button onClick={onRemove} title="Remove this filter group"
          style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",
            padding:2,marginLeft:"auto"}}>
          <Icon name="x" size={14}/>
        </button>
      </div>
      {/* Rules list */}
      <div style={{padding:"10px 12px 4px"}}>
        {group.rules.length===0
          ?<div style={{fontSize:11,color:"var(--text-muted)",padding:"8px 0",
              fontFamily:"Inter,DM Sans,sans-serif",textAlign:"center"}}>
              No rules yet — click "Add rule" below
            </div>
          :group.rules.map((rule,ri)=>(
            <div key={rule.id}>
              {ri>0&&(
                <div style={{display:"flex",alignItems:"center",gap:6,margin:"4px 0"}}>
                  <div style={{flex:1,height:1,background:"var(--border)"}}/>
                  <span style={{fontSize:10,fontWeight:700,
                    color:isOR?"var(--accent)":"var(--text-muted)",
                    fontFamily:"Inter,DM Sans,sans-serif",padding:"0 6px"}}>
                    {isOR?"OR":"AND"}
                  </span>
                  <div style={{flex:1,height:1,background:"var(--border)"}}/>
                </div>
              )}
              <FilterRuleRow
                rule={rule} features={features} fields={fields}
                onChange={p=>updateRule(rule.id,p)}
                onRemove={()=>removeRule(rule.id)}
              />
            </div>
          ))
        }
        <button onClick={addRule}
          style={{width:"100%",padding:"7px",border:"1px dashed var(--border)",borderRadius:8,
            background:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:11,
            fontFamily:"Inter,DM Sans,sans-serif",marginBottom:8,
            display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Icon name="plus" size={12}/> Add rule
        </button>
      </div>
    </div>
  );
}

function FilterPanel({layers,features,allLayerFeatures,filters,onFiltersChange,onClose}){
  const activeCount=useMemo(()=>{
    let n=0;
    filters.forEach(g=>g.rules.forEach(r=>{
      if(r.op==="in"||r.op==="not_in"?r.vals?.length:r.val) n++;
    }));
    return n;
  },[filters]);

  const addGroup=()=>onFiltersChange([...filters,{
    id:Date.now(),layerId:"all",groupOp:"OR",
    rules:[{id:Date.now()+1,field:Object.keys(features?.[0]?.properties||{})[0]||"",
            op:"in",val:"",vals:[]}]
  }]);

  const updateGroup=(id,patch)=>onFiltersChange(filters.map(g=>g.id===id?{...g,...patch}:g));
  const removeGroup=id=>onFiltersChange(filters.filter(g=>g.id!==id));

  return(
    <Modal title="Smart Filter" onClose={onClose} width={480}>
      <div style={{padding:"10px 16px 0",flex:1,overflowY:"auto",maxHeight:"65vh"}}>
        {filters.length===0
          ?<div style={{textAlign:"center",padding:"28px 0",color:"var(--text-muted)",
              fontSize:13,fontFamily:"Inter,DM Sans,sans-serif"}}>
              <div style={{fontSize:28,marginBottom:8}}>🔍</div>
              No filters — all features visible.<br/>
              <span style={{fontSize:11}}>Add a filter group to start.</span>
            </div>
          :filters.map((g,i)=>(
            <FilterGroupCard key={g.id} group={g} index={i}
              layers={layers} activeLayerFeatures={features}
              allLayerFeatures={allLayerFeatures}
              onChange={p=>updateGroup(g.id,p)}
              onRemove={()=>removeGroup(g.id)}
            />
          ))
        }
        <button onClick={addGroup}
          style={{width:"100%",padding:"9px",border:"1.5px dashed var(--accent)",borderRadius:10,
            background:"var(--accent-soft)",cursor:"pointer",color:"var(--accent)",fontSize:12,
            fontFamily:"Inter,DM Sans,sans-serif",fontWeight:600,marginBottom:12,
            display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          <Icon name="plus" size={13}/> Add Filter Group
        </button>
      </div>
      {(filters.length>0)&&(
        <div style={{padding:"10px 16px",borderTop:"1px solid var(--border)",
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:"var(--text-muted)",fontFamily:"Inter,DM Sans,sans-serif",lineHeight:1.6}}>
            <strong style={{color:"var(--accent)"}}>{activeCount} rule{activeCount!==1?"s":""} active</strong>
            {" · multiple groups are combined with "}<strong>AND</strong>
          </span>
          <button onClick={()=>onFiltersChange([])}
            style={{fontSize:12,color:"var(--danger)",background:"none",border:"none",
              cursor:"pointer",fontFamily:"Inter,DM Sans,sans-serif",flexShrink:0,marginLeft:8}}>
            Clear all
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   EXPORT MODAL — dismisses itself before capture
═══════════════════════════════════════════ */
function ExportModal({dashboardRef,mapDivRef,mapRef,editorRef,projectTitle,onClose}){
  const [exporting,setExporting]=useState(false);

  // Capture the live Leaflet map (tiles + vector layers + markers) as a canvas.
  // html2canvas cannot render cross-origin raster tiles (Google/OSM imagery),
  // which is why the map area was showing up blank in exports. leaflet-image
  // fetches/redraws tiles onto a canvas with proper CORS handling.
  const captureMap=()=>new Promise((resolve,reject)=>{
    const map=mapRef?.current;
    if(!map||!window.leafletImage){reject(new Error("Map not ready for export"));return;}
    window.leafletImage(map,(err,canvas)=>{
      if(err){reject(err);return;}
      resolve(canvas);
    });
  });

  const doExport=async mode=>{
    onClose();
    await new Promise(r=>setTimeout(r,350));
    setExporting(true);
    try{
      if(mode==="map"){
        const mapCanvas=await captureMap();
        const a=document.createElement("a");
        a.href=mapCanvas.toDataURL("image/png");
        a.download=`${projectTitle||"geocore"}_map.png`;
        a.click();
        return;
      }

      // dashboard / pdf: capture the map separately (tiles render correctly),
      // hide the live map div so html2canvas leaves a clean gap behind it,
      // then composite the map image into that gap.
      const target=dashboardRef.current||editorRef.current;
      const mapDiv=mapDivRef?.current;
      let mapCanvas=null,mapRect=null,targetRect=null;
      try{mapCanvas=await captureMap();}catch{/* map may not be present in this view */}

      if(mapDiv&&mapCanvas){
        mapRect=mapDiv.getBoundingClientRect();
        targetRect=target.getBoundingClientRect();
      }

      const prevVisibility=mapDiv?.style.visibility;
      if(mapDiv) mapDiv.style.visibility="hidden";

      let canvas;
      try{
        canvas=await window.html2canvas(target,{useCORS:true,allowTaint:true,scale:2,logging:false,
          ignoreElements:el=>el.classList?.contains('leaflet-control-zoom')});
      }finally{
        if(mapDiv) mapDiv.style.visibility=prevVisibility||"";
      }

      // Composite the map screenshot into the gap left where mapDiv was.
      if(mapCanvas&&mapRect&&targetRect){
        const ctx=canvas.getContext("2d");
        const scaleX=canvas.width/targetRect.width;
        const scaleY=canvas.height/targetRect.height;
        const dx=(mapRect.left-targetRect.left)*scaleX;
        const dy=(mapRect.top-targetRect.top)*scaleY;
        const dw=mapRect.width*scaleX;
        const dh=mapRect.height*scaleY;
        ctx.drawImage(mapCanvas,0,0,mapCanvas.width,mapCanvas.height,dx,dy,dw,dh);
      }

      if(mode==="pdf"){
        const pdf=new window.jspdf.jsPDF({orientation:"landscape",unit:"px",format:[canvas.width/2,canvas.height/2]});
        pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,canvas.width/2,canvas.height/2);
        pdf.save(`${projectTitle||"geocore"}.pdf`);
      } else {
        const a=document.createElement("a");
        a.href=canvas.toDataURL("image/png");
        a.download=`${projectTitle||"geocore"}_${mode}.png`;
        a.click();
      }
    }catch(err){alert("Export failed: "+err.message);}
    finally{setExporting(false);}
  };

  const opts=[
    {key:"map",   icon:"map",    label:"Map only",       desc:"High-resolution PNG of the map"},
    {key:"dashboard",icon:"chart",label:"Full dashboard", desc:"Entire dashboard as PNG"},
    {key:"pdf",   icon:"export", label:"PDF document",   desc:"Full dashboard as landscape PDF"},
  ];

  return(
    <Modal title="Export" onClose={onClose} width={360}>
      <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
        {opts.map(opt=>(
          <button key={opt.key} onClick={()=>doExport(opt.key)} disabled={exporting}
            style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",
              background:"var(--panel2)",border:"1.5px solid var(--border)",
              borderRadius:12,cursor:exporting?"not-allowed":"pointer",
              textAlign:"left",width:"100%",transition:"all 0.15s"}}
            onMouseEnter={e=>{if(!exporting){e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.background="var(--accent-soft)";}}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--panel2)";}}>
            <div style={{width:40,height:40,borderRadius:10,background:"var(--panel3)",
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Icon name={opt.icon} size={20} color="var(--accent)"/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:3,fontFamily:"Inter,DM Sans,sans-serif"}}>{opt.label}</div>
              <div style={{fontSize:11,color:"var(--text-muted)",fontFamily:"Inter,DM Sans,sans-serif"}}>{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div style={{padding:"10px 18px",borderTop:"1px solid var(--border)",fontSize:11,
        color:"var(--text-muted)",textAlign:"center",fontFamily:"Inter,DM Sans,sans-serif"}}>
        Modal closes before capture — exports are clean
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   LAYOUT PICKER MODAL
═══════════════════════════════════════════ */
function LayoutPicker({onPick,onClose}){
  return(
    <Modal title="Dashboard Layout" subtitle="Choose how to arrange your workspace" onClose={onClose} width={480}>
      <div style={{padding:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {Object.entries(LAYOUT_TEMPLATES).map(([key,tpl])=>(
          <button key={key} onClick={()=>{onPick(key);onClose();}}
            style={{padding:"20px 16px",background:"var(--panel2)",
              border:"1.5px solid var(--border)",borderRadius:14,cursor:"pointer",
              textAlign:"center",transition:"all 0.15s",fontFamily:"inherit"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.background="var(--accent-soft)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--panel2)";}}>
            <div style={{fontSize:32,marginBottom:10}}>{tpl.icon}</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:4,fontFamily:"Inter,DM Sans,sans-serif"}}>{tpl.label}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",fontFamily:"Inter,DM Sans,sans-serif"}}>{tpl.desc}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   MAP OVERLAY  — controls/UI only, no mapDiv
   The actual Leaflet div is always mounted in
   Dashboard and CSS-positioned over this slot.
═══════════════════════════════════════════ */
function MapOverlay({layers,basemap,basemapOpen,setBasemapOpen,setBasemap,
  mapRef,isDark,measureMode,setMeasureMode,measureResult,setMeasureResult}){
  return(
    <>
      <NorthArrow/>
      {/* Toolbar */}
      <div style={{position:"absolute",left:12,top:12,zIndex:500,display:"flex",gap:7}}>
        <div style={{position:"relative"}}>
          <Btn onClick={()=>setBasemapOpen(p=>!p)} active={basemapOpen}>
            <Icon name="map" size={13} color={basemapOpen?"#fff":"var(--accent)"}/> {basemap}
            <Icon name="chevD" size={11} color={basemapOpen?"#fff":"var(--text-muted)"}/>
          </Btn>
          {basemapOpen&&(
            <div style={{position:"absolute",top:42,left:0,background:"var(--panel)",
              border:"1.5px solid var(--border)",borderRadius:12,overflow:"hidden",
              boxShadow:"0 12px 40px var(--shadow)",zIndex:600,minWidth:140}}>
              {Object.keys(BASEMAPS).map(name=>(
                <button key={name} onClick={()=>{setBasemap(name);setBasemapOpen(false);}}
                  style={{display:"flex",alignItems:"center",gap:8,width:"100%",
                    padding:"10px 16px",textAlign:"left",
                    background:basemap===name?"var(--accent-soft)":"transparent",
                    color:basemap===name?"var(--accent)":"var(--text)",
                    fontSize:12,fontWeight:basemap===name?700:400,
                    border:"none",borderBottom:"1px solid var(--border)",
                    cursor:"pointer",fontFamily:"Inter,DM Sans,sans-serif"}}>
                  {basemap===name&&<Icon name="check" size={12} color="var(--accent)"/>}{name}
                </button>
              ))}
            </div>
          )}
        </div>
        {[{mode:"distance",label:"Distance",icon:"ruler"},{mode:"area",label:"Area",icon:"area"}].map(m=>(
          <Btn key={m.mode} onClick={()=>setMeasureMode(p=>p===m.mode?null:m.mode)} active={measureMode===m.mode}>
            <Icon name={m.icon} size={13} color={measureMode===m.mode?"#fff":"var(--text-muted)"}/>{m.label}
          </Btn>
        ))}
      </div>
      {measureResult&&(
        <div style={{position:"absolute",left:"50%",top:60,transform:"translateX(-50%)",zIndex:500,
          background:"var(--panel)",border:"1.5px solid var(--accent)",borderRadius:10,
          padding:"10px 20px",fontSize:14,fontWeight:700,color:"var(--accent)",
          boxShadow:"0 6px 24px var(--shadow)",display:"flex",alignItems:"center",gap:12}}>
          📐 {measureResult}
          <button onClick={()=>{setMeasureResult("");setMeasureMode(null);}}
            style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)"}}>
            <Icon name="x" size={14}/>
          </button>
        </div>
      )}
      {measureMode&&!measureResult&&(
        <div style={{position:"absolute",left:"50%",top:60,transform:"translateX(-50%)",zIndex:500,
          background:"rgba(26,43,74,0.92)",border:"1px solid rgba(200,146,42,0.3)",borderRadius:10,
          padding:"8px 18px",fontSize:12,color:"rgba(255,255,255,0.85)",fontWeight:500}}>
          {measureMode==="distance"?"Click points to measure distance":"Click 3+ points to measure area"}
        </div>
      )}
      {/* Right controls */}
      <div style={{position:"absolute",right:14,bottom:38,zIndex:500,display:"flex",flexDirection:"column",gap:7}}>
        {[["zIn",()=>mapRef.current?.zoomIn()],["zOut",()=>mapRef.current?.zoomOut()],
          ["home",()=>mapRef.current?.setView(RWANDA.center,RWANDA.zoom)]].map(([ic,fn])=>(
          <button key={ic} onClick={fn}
            style={{width:38,height:38,borderRadius:10,background:"var(--panel)",
              border:"1.5px solid var(--border)",cursor:"pointer",display:"flex",
              alignItems:"center",justifyContent:"center",color:"var(--text-muted)",
              boxShadow:"0 2px 8px var(--shadow)",transition:"all 0.12s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-muted)";}}>
            <Icon name={ic} size={16}/>
          </button>
        ))}
        <GeolocateButton mapRef={mapRef}/>
        <GeocoderSearch mapRef={mapRef}/>
      </div>
      {/* Status bar */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:24,
        background:isDark?"rgba(15,25,35,0.92)":"rgba(255,255,255,0.92)",
        borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",
        justifyContent:"flex-end",padding:"0 12px",zIndex:499}}>
        <span style={{fontSize:10,color:"var(--text-muted)",opacity:0.8}}>
          {["Satellite","Hybrid"].includes(basemap)?"© Google":"© OpenStreetMap contributors"}
        </span>
      </div>
      {!layers.length&&(
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
          justifyContent:"center",pointerEvents:"none",zIndex:400}}>
          <div style={{background:isDark?"rgba(15,25,35,0.93)":"rgba(255,255,255,0.96)",
            border:"1.5px solid var(--border)",borderRadius:18,padding:"32px 48px",textAlign:"center",
            boxShadow:"0 24px 64px var(--shadow)"}}>
            <svg width="48" height="48" viewBox="0 0 36 36" style={{margin:"0 auto"}}>
              <polygon points="18,3 33,30 3,30" fill="var(--navy)" stroke="var(--accent)" strokeWidth="1.5"/>
              <polygon points="18,10 26,25 10,25" fill="var(--accent)" opacity="0.85"/>
            </svg>
            <div style={{marginTop:16,fontSize:16,fontWeight:800,color:"var(--text)"}}>No data loaded</div>
            <div style={{marginTop:8,fontSize:12,color:"var(--text-muted)",lineHeight:1.8}}>
              Upload shapefile, GeoJSON or CSV<br/>using <strong>Add Data</strong> above
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* MapPanel kept for compatibility — delegates to MapSlot */
function MapPanel({mapDivRef,...rest}){
  return(
    <div style={{position:"relative",width:"100%",height:"100%",overflow:"hidden"}}>
      <MapSlot mapProps={{...rest,mapDivRef}} isDark={rest.isDark}/>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAP SLOT — placeholder div that positions
   the persistent Leaflet mapDiv over itself.
═══════════════════════════════════════════ */
function MapSlot({mapProps,isDark,gridArea,style={}}){
  const slotRef=useRef(null);

  useEffect(()=>{
    const slot=slotRef.current;
    const mapDiv=mapProps.mapDivRef?.current;
    if(!slot||!mapDiv) return;

    function reposition(){
      const host=document.getElementById("geocore-app-root");
      if(!host) return;
      const sr=slot.getBoundingClientRect();
      const hr=host.getBoundingClientRect();
      mapDiv.style.position="absolute";
      mapDiv.style.top   =(sr.top -hr.top )+"px";
      mapDiv.style.left  =(sr.left-hr.left)+"px";
      mapDiv.style.width =sr.width+"px";
      mapDiv.style.height=sr.height+"px";
      mapDiv.style.display="block";
      mapDiv.style.zIndex="10";
      mapProps.mapRef?.current?.invalidateSize({animate:false});
    }

    // Run immediately then again after layout settles
    reposition();
    const t1=setTimeout(reposition,80);
    const t2=setTimeout(reposition,300);

    const ro=new ResizeObserver(reposition);
    ro.observe(slot);
    window.addEventListener("resize",reposition);

    return()=>{
      clearTimeout(t1);clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener("resize",reposition);
      // Hide the mapDiv when this slot is unmounted
      if(mapDiv) mapDiv.style.display="none";
    };
  },[]);

  const areaStyle=gridArea?{gridArea,...style}:style;
  return(
    <div ref={slotRef} style={{width:"100%",height:"100%",position:"relative",...areaStyle}}>
      <MapOverlay {...mapProps} isDark={isDark}/>
    </div>
  );
}

/* Wrapper for map slot in dashboard layouts */
function MapSlotWrapper({gridArea,mapProps,isDark}){
  return(
    <div style={{gridArea,overflow:"hidden",position:"relative",
      border:"1px solid var(--border)",borderRadius:4}}>
      <MapSlot mapProps={mapProps} isDark={isDark}/>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DASHBOARD LAYOUT VIEW
   Renders selected layout template with
   independently configured widgets per slot.
═══════════════════════════════════════════ */
function LayoutView({layoutKey,slots,onSlotChange,layers,visibleFeatsByLayer,mapProps,isDark,dashRef,applyFilters}){
  const tpl=LAYOUT_TEMPLATES[layoutKey];

  // Map slot names to grid-area values per template
  const slotAreas={
    classic:  {sidebar:"sidebar", map:"map"},
    dual:     {left:"left", map:"map", right:"right"},
    grid:     {tl:"tl", tr:"tr", bl:"bl", br:"br"},
    focus:    {map:"map", c1:"c1", c2:"c2", c3:"c3"},
  };
  const areas=slotAreas[layoutKey]||{};

  const renderSlot=(slotKey)=>{
    const slotCfg=slots[slotKey]||{type:"chart",layerId:"",field:"",chartType:"bar",chartMode:"count"};
    if(slotCfg.type==="map") return(
      <MapSlotWrapper key="map-slot" gridArea={areas[slotKey]} mapProps={mapProps} isDark={isDark}/>
    );
    if(slotCfg.type==="legend") return(
      <div style={{gridArea:areas[slotKey],overflow:"hidden",background:"var(--panel)",
        border:"1px solid var(--border)",borderRadius:4,display:"flex",flexDirection:"column"}}>
        <SlotHeader slotKey={slotKey} slotCfg={slotCfg} onSlotChange={onSlotChange} layers={layers}/>
        <LegendWidget layers={layers} visibleFeatsByLayer={visibleFeatsByLayer}
          config={slotCfg} onConfigChange={p=>onSlotChange(slotKey,{...slotCfg,...p})}/>
      </div>
    );
    // chart (default)
    return(
      <div style={{gridArea:areas[slotKey],overflow:"hidden",background:"var(--panel)",
        border:"1px solid var(--border)",borderRadius:4,display:"flex",flexDirection:"column"}}>
        <SlotHeader slotKey={slotKey} slotCfg={slotCfg} onSlotChange={onSlotChange} layers={layers}/>
        <div style={{flex:1,minHeight:0,overflow:"hidden"}}>
          <ChartWidget layers={layers} visibleFeatsByLayer={visibleFeatsByLayer}
            config={slotCfg} onConfigChange={p=>onSlotChange(slotKey,{...slotCfg,...p})}
            isDark={isDark} compact={true} applyFilters={applyFilters}/>
        </div>
      </div>
    );
  };

  return(
    <div ref={dashRef} style={{
      display:"grid",
      gridTemplateAreas:tpl.areas,
      gridTemplateColumns:tpl.cols,
      gridTemplateRows:tpl.rows,
      width:"100%",height:"100%",gap:4,padding:4,
      background:"var(--bg)",overflow:"hidden",
    }}>
      {Object.keys(areas).map(slotKey=>renderSlot(slotKey))}
    </div>
  );
}

function SlotHeader({slotKey,slotCfg,onSlotChange,layers}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{padding:"6px 10px",borderBottom:"1px solid var(--border)",flexShrink:0,
      display:"flex",alignItems:"center",justifyContent:"space-between",
      background:"var(--panel2)"}}>
      <span style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",
        letterSpacing:"0.06em",fontFamily:"Inter,DM Sans,sans-serif",textTransform:"uppercase"}}>
        {slotCfg.type==="map"?"Map":slotCfg.type==="legend"?"Legend":`Chart`}
      </span>
      <div style={{position:"relative"}}>
        <button onClick={()=>setOpen(p=>!p)}
          style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:"2px 6px",
            borderRadius:5,display:"flex",alignItems:"center",gap:4,fontSize:10,fontFamily:"inherit"}}>
          <Icon name="edit2" size={11}/>
        </button>
        {open&&(
          <div style={{position:"absolute",top:24,right:0,background:"var(--panel)",
            border:"1.5px solid var(--border)",borderRadius:10,overflow:"hidden",
            boxShadow:"0 8px 32px var(--shadow)",zIndex:600,minWidth:150}}
            onClick={e=>e.stopPropagation()}>
            <div style={{padding:"8px 12px",borderBottom:"1px solid var(--border)",
              fontSize:10,fontWeight:700,color:"var(--text-muted)",letterSpacing:"0.06em",
              fontFamily:"Inter,DM Sans,sans-serif"}}>WIDGET TYPE</div>
            {["chart","legend","map"].map(t=>(
              <button key={t} onClick={()=>{onSlotChange(slotKey,{...slotCfg,type:t});setOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 14px",
                  background:slotCfg.type===t?"var(--accent-soft)":"transparent",
                  color:slotCfg.type===t?"var(--accent)":"var(--text)",
                  fontSize:12,fontWeight:slotCfg.type===t?700:400,
                  border:"none",borderBottom:"1px solid var(--border)",cursor:"pointer",
                  fontFamily:"Inter,DM Sans,sans-serif",textTransform:"capitalize"}}>
                {slotCfg.type===t&&<Icon name="check" size={12} color="var(--accent)"/>}{t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TILE LAYER MODAL
   Adds an XYZ/TMS/WMS tile layer by URL
═══════════════════════════════════════════ */
function TileLayerModal({onAdd,onClose,layerCount}){
  const [name,setName]=useState("Tile Layer");
  const [url,setUrl]=useState("");
  const [tms,setTms]=useState(false);
  const [opacity,setOpacity]=useState(1);
  const [attrib,setAttrib]=useState("");
  const [preset,setPreset]=useState("");

  const PRESETS=[
    {label:"Custom URL…",value:""},
    {label:"OSM Standard",url:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",name:"OSM Standard"},
    {label:"ESRI World Imagery",url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",name:"ESRI Imagery",tms:true},
    {label:"Stamen Terrain",url:"https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",name:"Stamen Terrain"},
    {label:"CartoDB Voyager",url:"https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",name:"Voyager"},
  ];

  const pickPreset=v=>{
    setPreset(v);
    const p=PRESETS.find(p=>p.label===v);
    if(p?.url){setUrl(p.url);setName(p.name||"Tile Layer");setTms(p.tms||false);}
  };

  const valid=url.trim().length>0&&(url.includes("{z}")||url.includes("{Z}"));

  const submit=()=>{
    if(!valid) return;
    onAdd({
      id:Date.now()+Math.random(),
      name:name.trim()||"Tile Layer",
      type:"tile",
      tileUrl:url.trim(),
      tileTMS:tms,
      tileOpacity:opacity,
      tileAttrib:attrib.trim(),
      visible:true,
      color:"#888",
      geomType:"Tile",
    });
    onClose();
  };

  const inp=extra=>({background:"var(--panel2)",border:"1.5px solid var(--border)",
    borderRadius:8,padding:"8px 12px",fontSize:12,color:"var(--text)",
    fontFamily:"Inter,DM Sans,sans-serif",outline:"none",width:"100%",...extra});

  return(
    <Modal title="Add Tile Layer" subtitle="XYZ, TMS, or WMS tile service" onClose={onClose} width={480}>
      <div style={{padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
        {/* Presets */}
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5,fontFamily:"Inter,DM Sans,sans-serif"}}>QUICK PRESET</label>
          <select value={preset} onChange={e=>pickPreset(e.target.value)} style={inp()}>
            {PRESETS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}
          </select>
        </div>
        {/* Name */}
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5,fontFamily:"Inter,DM Sans,sans-serif"}}>LAYER NAME</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="My tile layer" style={inp()}/>
        </div>
        {/* URL */}
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5,fontFamily:"Inter,DM Sans,sans-serif"}}>TILE URL TEMPLATE <span style={{color:"var(--accent)"}}>*</span></label>
          <input value={url} onChange={e=>setUrl(e.target.value)}
            placeholder="https://example.com/tiles/{z}/{x}/{y}.png"
            style={inp({fontFamily:"monospace",fontSize:11,borderColor:url&&!valid?"var(--danger)":"var(--border)"})}/>
          {url&&!valid&&<div style={{fontSize:11,color:"var(--danger)",marginTop:4,fontFamily:"Inter,DM Sans,sans-serif"}}>URL must contain {"{z}"}, {"{x}"}, {"{y}"} placeholders</div>}
          <div style={{fontSize:10,color:"var(--text-muted)",marginTop:4,fontFamily:"Inter,DM Sans,sans-serif"}}>For WMS: use GetMap URL with BBOX=&#123;bbox-epsg-3857&#125;</div>
        </div>
        {/* TMS toggle + opacity */}
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <label style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5,fontFamily:"Inter,DM Sans,sans-serif"}}>OPACITY</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="range" min="0" max="1" step="0.05" value={opacity} onChange={e=>setOpacity(+e.target.value)} style={{flex:1}}/>
              <span style={{fontSize:12,fontWeight:700,color:"var(--accent)",minWidth:32,fontFamily:"monospace"}}>{Math.round(opacity*100)}%</span>
            </div>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5,fontFamily:"Inter,DM Sans,sans-serif"}}>TMS</label>
            <button onClick={()=>setTms(p=>!p)}
              style={{padding:"7px 14px",borderRadius:8,fontSize:11,fontWeight:700,border:"1.5px solid var(--border)",
                cursor:"pointer",fontFamily:"Inter,DM Sans,sans-serif",
                background:tms?"var(--accent)":"var(--panel2)",color:tms?"#fff":"var(--text-muted)"}}>
              {tms?"TMS ON":"TMS OFF"}
            </button>
          </div>
        </div>
        {/* Attribution */}
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5,fontFamily:"Inter,DM Sans,sans-serif"}}>ATTRIBUTION (optional)</label>
          <input value={attrib} onChange={e=>setAttrib(e.target.value)} placeholder="© My Data Source" style={inp()}/>
        </div>
      </div>
      <div style={{padding:"12px 18px",borderTop:"1px solid var(--border)",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={{padding:"8px 20px",borderRadius:9,border:"1.5px solid var(--border)",background:"transparent",color:"var(--text-muted)",cursor:"pointer",fontSize:12,fontFamily:"Inter,DM Sans,sans-serif"}}>Cancel</button>
        <button onClick={submit} disabled={!valid}
          style={{padding:"8px 24px",borderRadius:9,border:"none",background:valid?"var(--accent)":"var(--border)",
            color:valid?"#fff":"var(--text-muted)",cursor:valid?"pointer":"not-allowed",fontSize:12,fontWeight:700,fontFamily:"Inter,DM Sans,sans-serif"}}>
          Add Layer
        </button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   ANALYSIS MODAL
   Buffer, Centroid, Dissolve tools
═══════════════════════════════════════════ */
function AnalysisModal({layers,onAddLayer,onClose}){
  const [tool,setTool]=useState("buffer");
  const [srcId,setSrcId]=useState(layers[0]?.id||"");
  const [bufDist,setBufDist]=useState(500);
  const [bufUnit,setBufUnit]=useState("meters");
  const [bufSteps,setBufSteps]=useState(64);
  const [dissolveField,setDissolveField]=useState("");
  const [outName,setOutName]=useState("");
  const [running,setRunning]=useState(false);
  const [error,setError]=useState("");

  const srcLayer=layers.find(l=>String(l.id)===String(srcId))||layers[0];
  const fields=useMemo(()=>Object.keys(srcLayer?.geojson?.features?.[0]?.properties||{}),[srcLayer]);

  const TOOLS=[
    {id:"buffer",  label:"Buffer",    icon:"⬡", desc:"Expand features outward by a distance"},
    {id:"centroid",label:"Centroid",  icon:"⊙", desc:"Convert polygons/lines to centre points"},
    {id:"dissolve",label:"Dissolve",  icon:"⬟", desc:"Merge features sharing the same field value"},
  ];

  const run=async()=>{
    if(!srcLayer||!window.turf){setError("Turf.js not loaded yet, please wait a moment.");return;}
    setRunning(true);setError("");
    try{
      const turf=window.turf;
      let result;
      const name=outName.trim()||`${srcLayer.name}_${tool}`;

      if(tool==="buffer"){
        const rawDist=Math.abs(bufDist); // ensure positive → always outward
        const distKm=bufUnit==="meters"?rawDist/1000:bufUnit==="km"?rawDist:rawDist*1.60934;
        if(distKm<=0){setError("Buffer distance must be greater than 0.");setRunning(false);return;}
        // Buffer each feature individually to avoid winding-order issues with some polygon types
        const buffered=srcLayer.geojson.features.map(f=>{
          try{ return turf.buffer(f,distKm,{units:"kilometers",steps:bufSteps}); }catch{return null;}
        }).filter(Boolean);
        result={type:"FeatureCollection",features:buffered};
      } else if(tool==="centroid"){
        const centroids=srcLayer.geojson.features.map(f=>{
          try{
            const c=turf.centroid(f,{properties:f.properties});
            return c;
          }catch{return null;}
        }).filter(Boolean);
        result={type:"FeatureCollection",features:centroids};
      } else if(tool==="dissolve"){
        if(!dissolveField){setError("Select a field to dissolve by.");setRunning(false);return;}
        result=turf.dissolve(srcLayer.geojson,{propertyName:dissolveField});
      }

      if(!result?.features?.length){setError("Result has no features — check input layer.");setRunning(false);return;}

      const newLayer={
        id:Date.now()+Math.random(),
        name,
        geojson:result,
        visible:true,
        type:"vector",
        geomType:detectGeomType(result),
        color:CHART_PALETTE[layers.length%CHART_PALETTE.length],
      };
      onAddLayer(newLayer);
      onClose();
    }catch(e){setError("Analysis failed: "+e.message);}
    finally{setRunning(false);}
  };

  const inp=extra=>({background:"var(--panel2)",border:"1.5px solid var(--border)",
    borderRadius:8,padding:"7px 11px",fontSize:12,color:"var(--text)",
    fontFamily:"Inter,DM Sans,sans-serif",outline:"none",...extra});
  const Lbl=({children})=>(
    <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
      marginBottom:5,fontFamily:"Inter,DM Sans,sans-serif",letterSpacing:"0.06em"}}>{children}</div>
  );

  return(
    <Modal title="Analysis Tools" subtitle="Create new layers from spatial operations" onClose={onClose} width={460}>
      {/* Tool tabs */}
      <div style={{display:"flex",borderBottom:"1.5px solid var(--border)",padding:"0 18px",gap:4,overflowX:"auto"}}>
        {TOOLS.map(t=>(
          <button key={t.id} onClick={()=>{setTool(t.id);setError("");}}
            style={{padding:"10px 14px",border:"none",background:"none",cursor:"pointer",
              fontFamily:"Inter,DM Sans,sans-serif",fontSize:12,fontWeight:tool===t.id?700:400,
              color:tool===t.id?"var(--accent)":"var(--text-muted)",
              borderBottom:tool===t.id?"2.5px solid var(--accent)":"2.5px solid transparent",
              whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div style={{padding:"14px 18px",flex:1,overflowY:"auto"}}>
        {/* Tool description */}
        <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:14,padding:"8px 12px",
          background:"var(--panel2)",borderRadius:8,fontFamily:"Inter,DM Sans,sans-serif",
          borderLeft:"3px solid var(--accent)"}}>
          {TOOLS.find(t=>t.id===tool)?.desc}
        </div>

        {/* Source layer */}
        <div style={{marginBottom:12}}>
          <Lbl>INPUT LAYER</Lbl>
          <select value={srcId} onChange={e=>setSrcId(e.target.value)} style={inp({width:"100%"})}>
            {layers.filter(l=>l.type!=="tile").map(l=>(
              <option key={l.id} value={String(l.id)}>{l.name} ({l.geomType})</option>
            ))}
          </select>
        </div>

        {/* Tool-specific controls */}
        {tool==="buffer"&&(
          <>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{flex:2}}>
                <Lbl>DISTANCE</Lbl>
                <input type="number" value={bufDist} min="0" onChange={e=>setBufDist(+e.target.value)} style={inp({width:"100%"})}/>
              </div>
              <div style={{flex:1}}>
                <Lbl>UNIT</Lbl>
                <select value={bufUnit} onChange={e=>setBufUnit(e.target.value)} style={inp({width:"100%"})}>
                  <option value="meters">Meters</option>
                  <option value="km">Kilometers</option>
                  <option value="miles">Miles</option>
                </select>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <Lbl>SMOOTHNESS (steps: {bufSteps})</Lbl>
              <input type="range" min="8" max="128" step="8" value={bufSteps}
                onChange={e=>setBufSteps(+e.target.value)} style={{width:"100%"}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--text-muted)",marginTop:2,fontFamily:"monospace"}}>
                <span>8 (fast)</span><span>64 (smooth)</span><span>128 (precise)</span>
              </div>
            </div>
          </>
        )}
        {tool==="dissolve"&&(
          <div style={{marginBottom:12}}>
            <Lbl>DISSOLVE BY FIELD</Lbl>
            <select value={dissolveField} onChange={e=>setDissolveField(e.target.value)} style={inp({width:"100%"})}>
              <option value="">— select field —</option>
              {fields.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4,fontFamily:"Inter,DM Sans,sans-serif"}}>
              Features sharing the same value in this field will be merged.
            </div>
          </div>
        )}
        {tool==="centroid"&&(
          <div style={{padding:"8px 12px",background:"var(--accent-soft)",borderRadius:8,
            fontSize:12,color:"var(--accent)",fontFamily:"Inter,DM Sans,sans-serif",marginBottom:12}}>
            Creates a point at the geometric centre of each feature. All original attributes are preserved.
          </div>
        )}

        {/* Output name */}
        <div style={{marginBottom:12}}>
          <Lbl>OUTPUT LAYER NAME</Lbl>
          <input value={outName} onChange={e=>setOutName(e.target.value)}
            placeholder={`${srcLayer?.name||"layer"}_${tool}`}
            style={inp({width:"100%"})}/>
        </div>

        {error&&(
          <div style={{padding:"8px 12px",background:"rgba(224,82,82,0.1)",border:"1px solid var(--danger)",
            borderRadius:8,fontSize:12,color:"var(--danger)",fontFamily:"Inter,DM Sans,sans-serif",marginBottom:8}}>
            ⚠ {error}
          </div>
        )}
      </div>
      <div style={{padding:"12px 18px",borderTop:"1px solid var(--border)",display:"flex",gap:10,justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,color:"var(--text-muted)",fontFamily:"Inter,DM Sans,sans-serif"}}>
          Result added as a new layer
        </span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{padding:"8px 20px",borderRadius:9,border:"1.5px solid var(--border)",background:"transparent",color:"var(--text-muted)",cursor:"pointer",fontSize:12,fontFamily:"Inter,DM Sans,sans-serif"}}>Cancel</button>
          <button onClick={run} disabled={running||!srcLayer}
            style={{padding:"8px 24px",borderRadius:9,border:"none",display:"flex",alignItems:"center",gap:7,
              background:(running||!srcLayer)?"var(--border)":"var(--accent)",
              color:(running||!srcLayer)?"var(--text-muted)":"#fff",
              cursor:(running||!srcLayer)?"not-allowed":"pointer",fontSize:12,fontWeight:700,fontFamily:"Inter,DM Sans,sans-serif"}}>
            {running&&<div style={{width:13,height:13,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
            {running?"Running…":"Run "+TOOLS.find(t=>t.id===tool)?.label}
          </button>
        </div>
      </div>
    </Modal>
  );
}


function ProjectsPage({onOpen,theme,onThemeToggle}){
  const [projects,setProjects]=useState([]);
  const [creating,setCreating]=useState(false);
  const [newName,setNewName]=useState("");
  const [loading,setLoading]=useState(true);
  const isDark=theme==="dark";

  useEffect(()=>{dbGetAll().then(p=>{setProjects(p.sort((a,b)=>b.updatedAt-a.updatedAt));setLoading(false);}).catch(()=>setLoading(false));;},[]);

  const createProject=async()=>{
    if(!newName.trim()) return;
    const proj={
      id:Date.now()+"_"+Math.random().toString(36).slice(2),
      name:newName.trim(),createdAt:Date.now(),updatedAt:Date.now(),
      layers:[],filters:[],basemap:"Satellite",logoUrl:null,
      showLabels:false,labelField:"",
      customColorMap:{},customShapeMap:{},customOpacityMap:{},customSizeMap:{},
      customOutlineColorMap:{},customOutlineWidthMap:{},customHollowMap:{},layerOpacity:{},
      primaryLayerId:null,primaryField:"",
      sidebarCharts:[{id:"c1",layerId:null,field:"",chartType:"bar",chartMode:"count"}],
      layoutKey:"classic",layoutSlots:{},
    };
    await dbPut(proj);setProjects(p=>[proj,...p]);
    setNewName("");setCreating(false);onOpen(proj);
  };

  const deleteProject=async(id,e)=>{
    e.stopPropagation();
    if(!window.confirm("Delete this project?")) return;
    await dbDelete(id);setProjects(p=>p.filter(x=>x.id!==id));
  };

  const fmt=ts=>new Date(ts).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});

  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",fontFamily:"Inter,DM Sans,sans-serif",color:"var(--text)"}}>
      <nav style={{height:60,background:"var(--panel)",borderBottom:"1.5px solid var(--border)",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 32px",position:"sticky",top:0,zIndex:50,
        boxShadow:"0 2px 12px var(--shadow)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <svg width="36" height="36" viewBox="0 0 36 36">
            <polygon points="18,3 33,30 3,30" fill="var(--navy)" stroke="var(--accent)" strokeWidth="1.5"/>
            <polygon points="18,10 26,25 10,25" fill="var(--accent)" opacity="0.85"/>
          </svg>
          <div>
            <div style={{fontSize:16,fontWeight:800,letterSpacing:"-0.01em",color:"var(--text)",lineHeight:1}}>
              GeoCore <span style={{color:"var(--accent)"}}>Platform</span>
            </div>
            <div style={{fontSize:10,color:"var(--text-muted)",letterSpacing:"0.06em",marginTop:1}}>
              TRINITY METALS · SPATIAL INTELLIGENCE
            </div>
          </div>
        </div>
        <button onClick={onThemeToggle}
          style={{width:36,height:36,borderRadius:10,background:"var(--panel2)",
            border:"1.5px solid var(--border)",cursor:"pointer",display:"flex",
            alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>
          <Icon name={isDark?"sun":"moon"} size={16}/>
        </button>
      </nav>

      <div style={{background:isDark?"var(--panel)":"var(--navy)",
        padding:"48px 32px 36px",borderBottom:"1.5px solid var(--border)"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",color:"var(--accent)",marginBottom:10}}>
            SPATIAL INTELLIGENCE PLATFORM
          </div>
          <h1 style={{fontSize:32,fontWeight:800,letterSpacing:"-0.02em",lineHeight:1.15,
            marginBottom:12,color:isDark?"var(--text)":"#fff"}}>
            Rutongo · Nyakabingo · Musha
          </h1>
          <p style={{fontSize:14,lineHeight:1.8,maxWidth:540,
            color:isDark?"var(--text-muted)":"rgba(255,255,255,0.72)"}}>
            Manage spatial data projects for all mine sites. Upload shapefiles, GeoJSON or CSV —
            multi-layer dashboards, area analytics, and custom layout views.
          </p>
        </div>
      </div>

      <div style={{padding:"40px 32px",maxWidth:960,margin:"0 auto"}}>
        <div style={{marginBottom:32}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:14}}>PROJECTS</div>
          {creating?(
            <div style={{display:"flex",gap:10,alignItems:"center",maxWidth:520}}>
              <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")createProject();if(e.key==="Escape")setCreating(false);}}
                placeholder="e.g. Rutongo Land Use 2024"
                style={{flex:1,background:"var(--panel)",border:"1.5px solid var(--accent)",borderRadius:10,
                  padding:"11px 16px",fontSize:14,color:"var(--text)",fontFamily:"inherit",outline:"none",
                  boxShadow:"0 0 0 3px var(--accent-soft)"}}/>
              <button onClick={createProject}
                style={{height:44,padding:"0 24px",background:"var(--accent)",border:"none",
                  borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff",fontFamily:"inherit"}}>
                CREATE
              </button>
              <button onClick={()=>setCreating(false)}
                style={{height:44,width:44,background:"transparent",border:"1.5px solid var(--border)",
                  borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                  color:"var(--text-muted)"}}>
                <Icon name="x" size={16}/>
              </button>
            </div>
          ):(
            <button onClick={()=>setCreating(true)}
              style={{display:"flex",alignItems:"center",gap:8,height:44,padding:"0 24px",
                background:"var(--accent)",border:"none",borderRadius:10,cursor:"pointer",
                fontSize:13,fontWeight:700,color:"#fff",fontFamily:"inherit",
                boxShadow:"0 4px 14px rgba(200,146,42,0.35)"}}>
              <Icon name="plus" size={16} color="#fff"/> New Project
            </button>
          )}
        </div>

        {loading?(
          <div style={{display:"flex",alignItems:"center",gap:12,padding:48,fontSize:14,color:"var(--text-muted)"}}>
            <div style={{width:20,height:20,border:"2px solid var(--accent)",borderTopColor:"transparent",
              borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
            Loading projects…
          </div>
        ):projects.length===0?(
          <div style={{textAlign:"center",padding:"72px 32px",opacity:0.35}}>
            <Icon name="folder" size={52} color="var(--text-muted)"/>
            <div style={{marginTop:18,fontSize:16,fontWeight:600}}>No projects yet</div>
            <div style={{marginTop:8,fontSize:13,color:"var(--text-muted)"}}>Create your first project above</div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(268px,1fr))",gap:18}}>
            {projects.map(proj=>(
              <div key={proj.id} onClick={()=>onOpen(proj)}
                style={{background:"var(--panel)",border:"1.5px solid var(--border)",borderRadius:14,
                  padding:22,cursor:"pointer",transition:"all 0.18s",boxShadow:"0 2px 8px var(--shadow)"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 10px 32px var(--shadow)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 8px var(--shadow)";}}>
                <div style={{width:44,height:44,borderRadius:12,background:"var(--accent-soft)",
                  border:"1.5px solid var(--border)",display:"flex",alignItems:"center",
                  justifyContent:"center",marginBottom:14}}>
                  <Icon name="map" size={22} color="var(--accent)"/>
                </div>
                <div style={{fontSize:15,fontWeight:700,marginBottom:5,overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.name}</div>
                <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:12}}>
                  {proj.layers?.length||0} layer{proj.layers?.length!==1?"s":""} · {fmt(proj.updatedAt)}
                </div>
                {proj.layers?.length>0&&(
                  <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                    {proj.layers.slice(0,8).map((l,i)=>(
                      <div key={i} title={l.name} style={{width:9,height:9,
                        borderRadius:l.geomType==="Polygon"?"2px":l.geomType==="Line"?"1px":"50%",
                        background:l.color||CHART_PALETTE[i%CHART_PALETTE.length]}}/>
                    ))}
                    {proj.layers.length>8&&<span style={{fontSize:10,color:"var(--text-muted)"}}>+{proj.layers.length-8}</span>}
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:"var(--accent)",fontWeight:700,letterSpacing:"0.04em"}}>Open →</span>
                  <button onClick={e=>deleteProject(proj.id,e)}
                    style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",
                      padding:4,opacity:0.4,transition:"opacity 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                    onMouseLeave={e=>e.currentTarget.style.opacity="0.4"}>
                    <Icon name="trash" size={14}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{borderTop:"1px solid var(--border)",padding:"18px 32px",textAlign:"center",
        fontSize:11,color:"var(--text-muted)",letterSpacing:"0.06em",fontFamily:"Inter,DM Sans,sans-serif"}}>
        GeoCore v7 · Trinity Metals Spatial Intelligence · All data stored locally · No login required
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DASHBOARD  (main editor + layout view)
═══════════════════════════════════════════ */
function Dashboard({project:initProject,onBack,theme,onThemeToggle}){
  const mapRef=useRef(null),mapDivRef=useRef(null),tileRef=useRef(null);
  const geoLayerRef=useRef(null),labelLayerRef=useRef(null),measureRef=useRef(null);
  const tileLayersRef=useRef({}); // id→L.tileLayer for custom tile layers
  const boundsTimer=useRef(null),saveTimer=useRef(null),dashRef=useRef(null);
  const editorBodyRef=useRef(null);

  const [project]       =useState(initProject);
  const [layers,setLayers]=useState(initProject.layers||[]);
  // Migrate old flat filter format [{id,field,op,val}] → new group format
  const migrateFilters=raw=>{
    if(!Array.isArray(raw)||!raw.length) return [];
    // Already new format — has .rules array
    if(raw[0]?.rules) return raw;
    // Old format — wrap each rule in its own OR group
    return raw.map(f=>({
      id:f.id||Date.now()+Math.random(),
      layerId:"all",groupOp:"OR",
      rules:[{id:(f.id||Date.now())+1,field:f.field||"",op:f.op==="="?"=":"=",val:f.val||"",vals:f.val?[f.val]:[]}]
    }));
  };

  const [filters,setFilters]=useState(()=>migrateFilters(initProject.filters||[]));

  // Per-layer visible features — keyed by String(layer.id)
  // Pre-populate with all features so charts & counts show immediately
  const [visibleFeatsByLayer,setVisibleFeatsByLayer]=useState(()=>{
    const init={};
    (initProject.layers||[]).forEach(l=>{
      if(l.geojson?.features) init[String(l.id)]=l.geojson.features;
    });
    return init;
  });

  // All layer features map for FilterPanel per-layer value previews
  const allLayerFeatures=useMemo(()=>{
    const m={};
    layers.forEach(l=>{if(l.geojson?.features) m[String(l.id)]=l.geojson.features;});
    return m;
  },[layers]);

  // Sidebar charts — each is fully self-contained
  const [sidebarCharts,setSidebarCharts]=useState(
    initProject.sidebarCharts?.length
      ? initProject.sidebarCharts
      : [{id:"c1",layerId:null,field:"",chartType:"bar",chartMode:"count"}]
  );

  // Symbology — per layer, per category: { [layerId]: { [cat]: value } }
  const [customColorMap,setCustomColorMap]=useState(initProject.customColorMap||{});
  const [customShapeMap,setCustomShapeMap]=useState(initProject.customShapeMap||{});
  const [customOpacityMap,setCustomOpacityMap]=useState(initProject.customOpacityMap||{});
  const [customSizeMap,setCustomSizeMap]=useState(initProject.customSizeMap||{});
  const [customOutlineColorMap,setCustomOutlineColorMap]=useState(initProject.customOutlineColorMap||{});
  const [customOutlineWidthMap,setCustomOutlineWidthMap]=useState(initProject.customOutlineWidthMap||{});
  const [customHollowMap,setCustomHollowMap]=useState(initProject.customHollowMap||{});
  const [layerOpacity,setLayerOpacity]=useState(initProject.layerOpacity||{});

  // Which layer drives map symbology
  const [primaryLayerId,setPrimaryLayerId]=useState(initProject.primaryLayerId||null);
  const [primaryField,setPrimaryField]=useState(initProject.primaryField||"");
  // Remembers the chosen classification field per layer, so switching layers
  // and switching back restores the same field (and therefore the same
  // category keys used by the per-layer custom symbol maps).
  const [primaryFieldMap,setPrimaryFieldMap]=useState(initProject.primaryFieldMap||{});

  // Per-layer symbol accessors — derive after primaryLayerId is declared
  // customColorMap shape: { [layerId]: { [cat]: value } }
  // These are computed inline in render; defined as stable refs via useCallback later.

  // Dashboard layout
  const [layoutKey,setLayoutKey]=useState(initProject.layoutKey||"classic");
  const [layoutSlots,setLayoutSlots]=useState(initProject.layoutSlots||{});
  const [viewMode,setViewMode]=useState("editor"); // "editor" | "dashboard"
  const [layoutPickerOpen,setLayoutPickerOpen]=useState(false);
  const [chartsHidden,setChartsHidden]=useState(false);

  // Map
  const [basemap,setBasemap]=useState(initProject.basemap||"Satellite");
  const [basemapOpen,setBasemapOpen]=useState(false);
  const [measureMode,setMeasureMode]=useState(null);
  const [measureResult,setMeasureResult]=useState("");
  const [showLabels,setShowLabels]=useState(initProject.showLabels||false);
  const [labelField,setLabelField]=useState(initProject.labelField||"");

  // UI
  const [projectTitle,setProjectTitle]=useState(initProject.name||"Untitled");
  const [editTitle,setEditTitle]=useState(false);
  const [logoUrl,setLogoUrl]=useState(initProject.logoUrl||null);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [saving,setSaving]=useState(false);
  const [layerPanelOpen,setLayerPanelOpen]=useState(false);
  const [symbolEditorOpen,setSymbolEditorOpen]=useState(false);
  const [filterPanelOpen,setFilterPanelOpen]=useState(false);
  const [exportOpen,setExportOpen]=useState(false);
  const [tileModalOpen,setTileModalOpen]=useState(false);
  const [analysisOpen,setAnalysisOpen]=useState(false);
  const [coordDisplay,setCoordDisplay]=useState("—");

  const logoInputRef=useRef(null);
  const isDark=theme==="dark";

  // Active layer for editor sidebar (separate from map primary layer)
  const activeLayer=useMemo(()=>layers.find(l=>String(l.id)===String(primaryLayerId))||layers[0],[layers,primaryLayerId]);
  const geomType=useMemo(()=>detectGeomType(activeLayer?.geojson),[activeLayer]);
  const fields=useMemo(()=>Object.keys(activeLayer?.geojson?.features?.[0]?.properties||{}),[activeLayer]);
  const totalFeatures=useMemo(()=>layers.filter(l=>l.visible).reduce((s,l)=>s+(l.geojson?.features?.length||0),0),[layers]);
  const totalVisible=Object.values(visibleFeatsByLayer).reduce((s,a)=>s+a.length,0);

  /* CSS vars */
  useEffect(()=>{Object.entries(THEMES[theme]).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));},[theme]);

  /* Global CSS */
  useEffect(()=>{
    if(document.getElementById("geocore-css")) return;
    const el=document.createElement("style");el.id="geocore-css";
    el.textContent=`
      *{box-sizing:border-box;margin:0;padding:0}
      body,html,#root{height:100%;width:100%;overflow:hidden}
      .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:transparent!important;box-shadow:none!important}
      .leaflet-popup-content{margin:0!important}
      .leaflet-control-zoom{border:1.5px solid var(--border)!important;border-radius:10px!important;overflow:hidden;box-shadow:0 2px 8px var(--shadow)!important}
      .leaflet-control-zoom a{background:var(--panel)!important;color:var(--text)!important;border-bottom:1px solid var(--border)!important;font-size:16px!important;line-height:30px!important;width:32px!important;height:32px!important}
      .leaflet-control-zoom a:hover{background:var(--panel2)!important;color:var(--accent)!important}
      .leaflet-bar{border:none!important}
      .geo-div-icon,.geo-label{background:none!important;border:none!important;box-shadow:none!important}
      .leaflet-control-scale-line{background:var(--panel)!important;color:var(--text-muted)!important;border-color:var(--border)!important;font-size:10px!important;font-family:Inter,DM Sans,sans-serif!important;padding:2px 6px!important}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
      ::-webkit-scrollbar-thumb:hover{background:var(--text-muted)}
      input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:4px;background:var(--border);outline:none}
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--accent);cursor:pointer;border:2px solid var(--panel)}
      @keyframes spin{to{transform:rotate(360deg)}}
      select{outline:none}
    `;
    document.head.appendChild(el);
  },[]);

  /* Auto-save */
  const saveProject=useCallback(async()=>{
    setSaving(true);
    try{
      await dbPut({...project,name:projectTitle,layers,filters,basemap,logoUrl,
        showLabels,labelField,sidebarCharts,
        customColorMap,customShapeMap,customOpacityMap,customSizeMap,
        customOutlineColorMap,customOutlineWidthMap,customHollowMap,
        layerOpacity,
        primaryLayerId,primaryField,primaryFieldMap,layoutKey,layoutSlots,updatedAt:Date.now()});
    }catch(e){console.error(e);}finally{setSaving(false);}
  },[project,projectTitle,layers,filters,basemap,logoUrl,showLabels,labelField,
     sidebarCharts,customColorMap,customShapeMap,customOpacityMap,customSizeMap,
     customOutlineColorMap,customOutlineWidthMap,customHollowMap,
     layerOpacity,primaryLayerId,primaryField,primaryFieldMap,layoutKey,layoutSlots]);

  useEffect(()=>{clearTimeout(saveTimer.current);saveTimer.current=setTimeout(saveProject,2000);},[
    layers,filters,sidebarCharts,customColorMap,customShapeMap,customOpacityMap,customSizeMap,
    customOutlineColorMap,customOutlineWidthMap,customHollowMap,
    layerOpacity,basemap,projectTitle,showLabels,labelField,primaryLayerId,primaryField,primaryFieldMap,layoutKey,layoutSlots]);

  /* Always-fresh ref so the Leaflet moveend listener never captures a stale closure */
  const updateAllVisibleRef=useRef(null);

  /* Init Leaflet */
  useEffect(()=>{
    if(!mapDivRef.current) return;
    if(mapRef.current){mapRef.current.remove();mapRef.current=null;}
    const L=window.L;
    mapDivRef.current.style.display="none";
    mapDivRef.current.style.position="absolute";
    mapDivRef.current.style.zIndex="10";
    const map=L.map(mapDivRef.current,{center:RWANDA.center,zoom:RWANDA.zoom,zoomControl:false,preferCanvas:true});
    tileRef.current=L.tileLayer(BASEMAPS[basemap],{maxZoom:20}).addTo(map);
    L.control.scale({imperial:false,position:"bottomleft"}).addTo(map);
    map.on("mousemove",e=>setCoordDisplay(`${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`));
    // Call through ref — always uses the latest updateAllVisible (no stale closure)
    map.on("moveend zoomend",()=>{
      clearTimeout(boundsTimer.current);
      boundsTimer.current=setTimeout(()=>updateAllVisibleRef.current(map.getBounds()),130);
    });
    mapRef.current=map;
    return()=>{if(mapRef.current){mapRef.current.remove();mapRef.current=null;}};
  },[]);

  /* Invalidate map size whenever layout changes (view toggle, sidebar hide, layout switch) */
  useEffect(()=>{
    if(!mapRef.current) return;
    // Double rAF ensures the DOM has fully reflowed
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      mapRef.current?.invalidateSize({animate:false});
    }));
  },[viewMode,chartsHidden,layoutKey]);

  /* Basemap */
  useEffect(()=>{
    if(!mapRef.current||!tileRef.current) return;
    tileRef.current.remove();
    tileRef.current=window.L.tileLayer(BASEMAPS[basemap],{maxZoom:20}).addTo(mapRef.current);
  },[basemap]);

  /* Measure */
  useEffect(()=>{
    if(!mapRef.current) return;
    const L=window.L,map=mapRef.current;
    if(measureRef.current){map.off("click",measureRef.current.fn);measureRef.current?.layer?.remove();}
    if(!measureMode){setMeasureResult("");measureRef.current=null;map.getContainer().style.cursor="";return;}
    const pts=[];let layer=null;
    const fn=e=>{
      pts.push(e.latlng);if(layer)layer.remove();
      if(measureMode==="distance"){
        layer=L.polyline(pts,{color:"#C8922A",weight:3,dashArray:"8 5"}).addTo(map);
        if(pts.length>1){let d=0;for(let i=1;i<pts.length;i++)d+=pts[i-1].distanceTo(pts[i]);
          setMeasureResult(d>1000?`${(d/1000).toFixed(2)} km`:`${Math.round(d)} m`);}
      }else{
        layer=L.polygon(pts,{color:"#C8922A",weight:2,fillColor:"#C8922A",fillOpacity:0.12}).addTo(map);
        if(pts.length>2){
          let a=0;const n=pts.length;
          for(let i=0;i<n;i++){const p1=pts[i],p2=pts[(i+1)%n];
            a+=p1.lng*Math.PI/180*Math.sin(p2.lat*Math.PI/180)-p2.lng*Math.PI/180*Math.sin(p1.lat*Math.PI/180);}
          const am=Math.abs(a)*6371008.8**2/2;
          setMeasureResult(am>=1e6?`${(am/1e6).toFixed(3)} km²`:am>=1e4?`${(am/1e4).toFixed(2)} ha`:`${Math.round(am)} m²`);
        }
      }
      measureRef.current={...measureRef.current,layer};
    };
    map.on("click",fn);measureRef.current={fn,layer:null};
    map.getContainer().style.cursor="crosshair";
    return()=>{map.off("click",fn);layer?.remove();map.getContainer().style.cursor="";};
  },[measureMode]);

  /* Filters */
  const applyFilters=useCallback((features,layerId="all")=>{
    if(!filters.length) return features;
    return features.filter(f=>passesAllFilters(filters,f,layerId));
  },[filters]);

  const updateAllVisible=useCallback(bounds=>{
    const result={};
    layers.filter(l=>l.type!=="tile").forEach(layer=>{
      if(!layer.geojson) return;
      const raw=(layer.geojson.features||[]).filter(f=>{
        if(!f.geometry) return false;
        const c=f.geometry.coordinates,gt=f.geometry.type;
        if(gt==="Point")return bounds.contains([c[1],c[0]]);
        if(gt==="MultiPoint")return c.some(p=>bounds.contains([p[1],p[0]]));
        if(gt==="LineString")return c.some(p=>bounds.contains([p[1],p[0]]));
        if(gt==="MultiLineString")return c.flat().some(p=>bounds.contains([p[1],p[0]]));
        if(gt==="Polygon")return c[0].some(p=>bounds.contains([p[1],p[0]]));
        if(gt==="MultiPolygon")return c.flat(2).some(p=>bounds.contains([p[1],p[0]]));
        return true;
      });
      result[String(layer.id)]=applyFilters(raw,String(layer.id));
    });
    setVisibleFeatsByLayer(result);
  },[layers,applyFilters]);

  useEffect(()=>{updateAllVisibleRef.current=updateAllVisible;},[updateAllVisible]);

  useEffect(()=>{
    if(!mapRef.current) return;
    // Use timeout to ensure map has rendered the new layer first
    const tid=setTimeout(()=>{
      try{
        const b=mapRef.current.getBounds();
        if(b)updateAllVisible(b);
      }catch{}
    },50);
    return()=>clearTimeout(tid);
  },[layers,applyFilters]);

  /* Redraw map */
  useEffect(()=>{
    if(!mapRef.current) return;
    const L=window.L;
    if(geoLayerRef.current){geoLayerRef.current.remove();geoLayerRef.current=null;}
    if(labelLayerRef.current){labelLayerRef.current.remove();labelLayerRef.current=null;}
    const vis=layers.filter(l=>l.visible&&l.type!=="tile");if(!vis.length) return;

    // Build per-layer color maps on the fly
    // customColorMap shape: { [layerId]: { [cat]: color } }
    const primaryLayer=layers.find(l=>String(l.id)===String(primaryLayerId))||layers[0];

    // Pre-compute base color maps for all visible layers
    const layerBaseMaps={};
    vis.forEach(l=>{
      const lid=String(l.id);
      layerBaseMaps[lid]=buildColorMap(l.geojson?.features||[],primaryField);
    });

    const allFeats=vis.flatMap(l=>{
      const layerFeats=(l.geojson?.features||[]).map(f=>({
        ...f,_lid:l.id,_lcolor:l.color,_lgeom:l.geomType||"Point",
        _isPrimary:String(l.id)===String(primaryLayer?.id),
      }));
      return applyFilters(layerFeats,String(l.id));
    });
    const toRender=allFeats;

    geoLayerRef.current=L.geoJSON({type:"FeatureCollection",features:toRender},{
      style:f=>{
        const lid=String(f._lid);
        const lCustomColors=customColorMap[lid]||{};
        const lCustomOutlineColors=customOutlineColorMap[lid]||{};
        const lCustomOutlineWidths=customOutlineWidthMap[lid]||{};
        const lCustomHollow=customHollowMap[lid]||{};
        const lCustomOpacity=customOpacityMap[lid]||{};
        const baseColors=layerBaseMaps[lid]||{};
        const mergedColors={...baseColors,...lCustomColors};
        const val=primaryField&&f.properties?.[primaryField]?String(f.properties[primaryField]):null;
        const fillCol=(val&&mergedColors[val])||f._lcolor||"#C8922A";
        const outlineCol=(val&&lCustomOutlineColors[val])||fillCol;
        const outlineW=(val&&lCustomOutlineWidths[val])||( f._lgeom==="Line"?2.5:1.5);
        const hollow=val&&lCustomHollow[val];
        const opacity=hollow?0:(val?(lCustomOpacity[val]??0.85):0.85);
        const lop=layerOpacity[f._lid]??1;
        return{
          color:outlineCol,
          weight:outlineW,
          fillColor:hollow?"transparent":fillCol,
          fillOpacity:opacity*lop,
          opacity:lop,
        };
      },
      pointToLayer:(f,latlng)=>{
        const lid=String(f._lid);
        const lCustomColors=customColorMap[lid]||{};
        const lCustomShapes=customShapeMap[lid]||{};
        const lCustomSizes=customSizeMap[lid]||{};
        const baseColors=layerBaseMaps[lid]||{};
        const mergedColors={...baseColors,...lCustomColors};
        const val=primaryField&&f.properties?.[primaryField]?String(f.properties[primaryField]):null;
        const col=(val&&mergedColors[val])||f._lcolor||"#C8922A";
        const shape=(val&&lCustomShapes[val])||"circle";
        const sz=(val&&lCustomSizes[val])||16;
        return L.marker(latlng,{
          icon:L.divIcon({html:makePointSVG(shape,col,sz),className:"geo-div-icon",iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]}),
          opacity:layerOpacity[f._lid]??1,
        });
      },
      onEachFeature:(f,layer)=>{
        const props=f.properties||{};
        const rows=Object.entries(props).filter(([k])=>!k.startsWith("_")).slice(0,12).map(([k,v])=>
          `<div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid #ddd8cc">
            <span style="color:#5a6e85;min-width:90px;font-size:11px;flex-shrink:0;font-family:Inter,sans-serif">${k}</span>
            <span style="color:#1A2B4A;font-size:11px;word-break:break-all;font-family:Inter,sans-serif">${String(v)}</span>
          </div>`).join("");
        layer.bindPopup(
          `<div style="background:#fff;border:1.5px solid #d8d3c8;border-radius:10px;padding:14px;min-width:220px">
            <div style="color:#C8922A;font-weight:700;margin-bottom:10px;font-size:12px;font-family:Inter,sans-serif;letter-spacing:.04em">FEATURE PROPERTIES</div>
            ${rows||"<span style='color:#888;font-size:11px'>No properties</span>"}
          </div>`,{maxWidth:320,className:"geo-popup"}
        );
      },
    }).addTo(mapRef.current);

    /* Labels — FIX: use iconSize:null so div sizes itself naturally */
    if(showLabels&&labelField){
      const lg=L.layerGroup();
      toRender.forEach(f=>{
        const lbl=f.properties?.[labelField];if(!lbl) return;
        let latlng=null;
        try{const gt=f.geometry?.type;
          if(gt==="Point")latlng=L.latLng(f.geometry.coordinates[1],f.geometry.coordinates[0]);
          else latlng=L.geoJSON(f).getBounds().getCenter();
        }catch{}
        if(!latlng) return;
        L.marker(latlng,{
          icon:L.divIcon({
            // No iconSize constraint — div sizes to content, fixing label truncation
            html:`<div style="display:inline-block;background:rgba(26,43,74,0.88);color:#C8922A;font-size:10px;line-height:1.4;padding:3px 8px;border-radius:5px;white-space:nowrap;border:1px solid rgba(200,146,42,0.4);font-family:Inter,DM Sans,sans-serif;pointer-events:none;font-weight:600">${String(lbl)}</div>`,
            className:"geo-label",
            iconSize:null,   // ← KEY FIX: let the div size itself
            iconAnchor:[0,20],
          }),interactive:false,
        }).addTo(lg);
      });
      lg.addTo(mapRef.current);labelLayerRef.current=lg;
    }
  },[layers,customColorMap,customShapeMap,customOpacityMap,customSizeMap,
     customOutlineColorMap,customOutlineWidthMap,customHollowMap,
     layerOpacity,primaryLayerId,primaryField,showLabels,labelField,applyFilters]);

  /* Sync custom tile layers (type:"tile") on the map */
  useEffect(()=>{
    if(!mapRef.current) return;
    const L=window.L;
    const map=mapRef.current;
    const existing=tileLayersRef.current;

    // Remove tile layers that are no longer in state
    Object.keys(existing).forEach(id=>{
      if(!layers.find(l=>String(l.id)===id&&l.type==="tile")){
        existing[id]?.remove();
        delete existing[id];
      }
    });

    // Add/update tile layers
    layers.filter(l=>l.type==="tile").forEach(l=>{
      const lid=String(l.id);
      if(existing[lid]) {
        // Update opacity and visibility
        existing[lid].setOpacity(l.visible?(l.tileOpacity??1):0);
      } else if(l.tileUrl) {
        const tl=L.tileLayer(l.tileUrl,{
          maxZoom:22,opacity:l.visible?(l.tileOpacity??1):0,
          attribution:l.tileAttrib||"",
          tms:l.tileTMS||false,
          zIndex:5,
        }).addTo(map);
        existing[lid]=tl;
      }
    });
  },[layers]);
  useEffect(()=>{
    if(!mapRef.current||!activeLayer?.geojson?.features?.length) return;
    try{const b=window.L.geoJSON(activeLayer.geojson).getBounds();if(b.isValid())mapRef.current.fitBounds(b,{padding:[40,40]});}catch{}
  },[activeLayer?.id]);

  /* File upload */
  const processFile=async file=>{
    const ext=file.name.split(".").pop().toLowerCase();
    const name=file.name.replace(/\.[^.]+$/,"");
    setLoadMsg(`Parsing ${file.name}…`);
    let geojson;

    if(ext==="zip") {
      geojson=await window.shp(await file.arrayBuffer());
    } else if(ext==="geojson"||ext==="json") {
      geojson=JSON.parse(await file.text());
    } else if(ext==="csv"){
      const res=window.Papa.parse(await file.text(),{header:true,dynamicTyping:true,skipEmptyLines:true});
      const latK=["lat","latitude","y","LAT","LATITUDE"].find(k=>res.meta.fields?.includes(k));
      const lonK=["lon","lng","longitude","x","LON","LNG","LONGITUDE"].find(k=>res.meta.fields?.includes(k));
      if(!latK||!lonK) throw new Error("CSV needs lat/lon columns");
      geojson={type:"FeatureCollection",features:res.data.filter(d=>d[latK]&&d[lonK]).map(d=>({
        type:"Feature",properties:d,geometry:{type:"Point",coordinates:[+d[lonK],+d[latK]]},
      }))};
    } else if(ext==="kml") {
      const text=await file.text();
      const dom=new DOMParser().parseFromString(text,"text/xml");
      geojson=window.toGeoJSON.kml(dom);
    } else if(ext==="kmz") {
      const zip=await window.JSZip.loadAsync(await file.arrayBuffer());
      // Find the first .kml entry inside the KMZ
      const kmlName=Object.keys(zip.files).find(n=>n.toLowerCase().endsWith(".kml"));
      if(!kmlName) throw new Error("No KML found inside KMZ");
      const kmlText=await zip.files[kmlName].async("string");
      const dom=new DOMParser().parseFromString(kmlText,"text/xml");
      geojson=window.toGeoJSON.kml(dom);
    } else {
      throw new Error("Unsupported format: "+ext+". Supported: .zip (Shapefile), .geojson, .json, .csv, .kml, .kmz");
    }

    // Ensure FeatureCollection
    if(geojson.type==="Feature") geojson={type:"FeatureCollection",features:[geojson]};
    if(!geojson.features) throw new Error("Could not parse features from "+file.name);

    const gType=detectGeomType(geojson);
    return{id:Date.now()+Math.random(),name,geojson,visible:true,geomType:gType,
      type:"vector", // explicit type for future tile layer distinction
      color:CHART_PALETTE[layers.length%CHART_PALETTE.length]};
  };

  const handleUpload=async e=>{
    const files=Array.from(e.target.files);if(!files.length) return;
    setLoading(true);
    try{
      for(const file of files){
        const layer=await processFile(file);
        // Use functional state update to avoid stale closure
        setLayers(prev=>{
          const next=[...prev,layer];
          // Set primary layer to first upload
          if(prev.length===0){
            setPrimaryLayerId(String(layer.id));
            const f0=Object.keys(layer.geojson?.features?.[0]?.properties||{})[0];
            if(f0){
              setPrimaryField(f0);
              setLabelField(f0);
              const defaultMode=layer.geomType==="Polygon"?"area":"count";
              setSidebarCharts(pc=>pc.map((c,i)=>i===0
                ?{...c,layerId:String(layer.id),field:f0,chartMode:defaultMode}:c));
            }
          }
          return next;
        });
      }
    }catch(err){alert("Error: "+err.message);}
    finally{setLoading(false);setLoadMsg("");e.target.value="";}
  };

  const toggleLayer=id=>setLayers(p=>p.map(l=>l.id===id?{...l,visible:!l.visible}:l));
  const removeLayer=id=>setLayers(p=>p.filter(l=>l.id!==id));
  const addLayer=layer=>setLayers(p=>[...p,layer]);

  const addSidebarChart=()=>{
    if(sidebarCharts.length>=4) return;
    const l=layers[0];
    const f=Object.keys(l?.geojson?.features?.[0]?.properties||{})[0]||"";
    setSidebarCharts(p=>[...p,{id:"c"+Date.now(),layerId:l?String(l.id):null,
      field:f,chartType:"bar",chartMode:l?.geomType==="Polygon"?"area":"count"}]);
  };
  const removeSidebarChart=id=>setSidebarCharts(p=>p.filter(c=>c.id!==id));
  const updateSidebarChart=(id,patch)=>setSidebarCharts(p=>p.map(c=>c.id===id?{...c,...patch}:c));

  const updateSlot=(slotKey,cfg)=>setLayoutSlots(p=>({...p,[slotKey]:cfg}));

  // Initialise layout slots when layout changes
  useEffect(()=>{
    const defaultSlotContent={
      classic:{sidebar:{type:"chart"},map:{type:"map"}},
      dual:{left:{type:"chart"},map:{type:"map"},right:{type:"chart"}},
      grid:{tl:{type:"chart"},tr:{type:"map"},bl:{type:"chart"},br:{type:"legend"}},
      focus:{map:{type:"map"},c1:{type:"chart"},c2:{type:"chart"},c3:{type:"legend"}},
    };
    setLayoutSlots(prev=>{
      const defaults=defaultSlotContent[layoutKey]||{};
      const merged={};
      Object.keys(defaults).forEach(k=>{merged[k]=prev[k]||{...defaults[k],
        layerId:layers[0]?String(layers[0].id):null,
        field:Object.keys(layers[0]?.geojson?.features?.[0]?.properties||{})[0]||"",
        chartType:"bar",chartMode:layers[0]?.geomType==="Polygon"?"area":"count"};});
      return merged;
    });
  },[layoutKey]);

  /* Map props bundled for MapPanel */
  const mapProps={mapDivRef,layers,visibleFeatsByLayer,
    customColorMap,customShapeMap,customOpacityMap,customSizeMap,
    customOutlineColorMap,customOutlineWidthMap,customHollowMap,
    layerOpacity,primaryLayerId,primaryField,applyFilters,basemap,showLabels,labelField,
    measureMode,setMeasureMode,measureResult,setMeasureResult,
    basemapOpen,setBasemapOpen,setBasemap,mapRef};

  /* ═══ RENDER ═══ */
  return(
    <div id="geocore-app-root" data-maphost="true" style={{display:"flex",flexDirection:"column",height:"100vh",
      position:"relative",overflow:"hidden",
      background:"var(--bg)",fontFamily:"Inter,DM Sans,sans-serif",color:"var(--text)"}}>

      {/* TOPBAR */}
      <header style={{height:54,background:"var(--panel)",borderBottom:"1.5px solid var(--border)",
        display:"flex",alignItems:"center",padding:"0 14px",flexShrink:0,zIndex:100,gap:10,
        boxShadow:"0 2px 10px var(--shadow)"}}>
        <button onClick={onBack} title="Back to projects"
          style={{width:34,height:34,borderRadius:9,background:"var(--panel2)",
            border:"1.5px solid var(--border)",cursor:"pointer",display:"flex",
            alignItems:"center",justifyContent:"center",color:"var(--text-muted)",flexShrink:0}}>
          <Icon name="back" size={15}/>
        </button>
        <div onClick={()=>logoInputRef.current?.click()} style={{cursor:"pointer",flexShrink:0}} title="Upload logo">
          {logoUrl
            ?<img src={logoUrl} alt="logo" style={{height:32,maxWidth:90,objectFit:"contain",borderRadius:6}}/>
            :<div style={{width:32,height:32,borderRadius:8,border:"1.5px dashed var(--border)",
                display:"flex",alignItems:"center",justifyContent:"center",opacity:0.5,background:"var(--panel2)"}}>
                <Icon name="image" size={14} color="var(--text-muted)"/>
              </div>
          }
          <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={e=>{
            const f=e.target.files?.[0];if(f)setLogoUrl(URL.createObjectURL(f));
          }}/>
        </div>
        <div style={{width:1,height:22,background:"var(--border)",flexShrink:0}}/>
        {editTitle
          ?<input autoFocus value={projectTitle} onChange={e=>setProjectTitle(e.target.value)}
              onBlur={()=>setEditTitle(false)} onKeyDown={e=>e.key==="Enter"&&setEditTitle(false)}
              style={{background:"transparent",border:"none",outline:"none",color:"var(--text)",
                fontFamily:"inherit",fontSize:14,fontWeight:700,width:240}}/>
          :<span onClick={()=>setEditTitle(true)} title="Click to edit"
              style={{fontSize:14,fontWeight:700,cursor:"text",color:"var(--text)",
                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:260}}>
              {projectTitle}
            </span>
        }
        {saving&&<span style={{fontSize:10,color:"var(--text-muted)",flexShrink:0,fontStyle:"italic"}}>saving…</span>}

        {/* Stats */}
        <div style={{display:"flex",gap:24,alignItems:"center",margin:"0 auto"}}>
          {[["Layers",layers.length],["Total",totalFeatures.toLocaleString()],["Visible",totalVisible.toLocaleString()]].map(([l,v])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,color:"var(--accent)",lineHeight:1}}>{v}</div>
              <div style={{fontSize:9,color:"var(--text-muted)",letterSpacing:"0.08em",marginTop:2,fontWeight:600}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{display:"flex",gap:7,alignItems:"center",flexShrink:0}}>
          {loading&&(
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--text-muted)"}}>
              <div style={{width:13,height:13,border:"2px solid var(--accent)",borderTopColor:"transparent",
                borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
              {loadMsg}
            </div>
          )}
          <button onClick={onThemeToggle}
            style={{width:34,height:34,borderRadius:9,background:"var(--panel2)",
              border:"1.5px solid var(--border)",cursor:"pointer",display:"flex",
              alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>
            <Icon name={isDark?"sun":"moon"} size={14}/>
          </button>
          {/* View toggle */}
          <Btn onClick={()=>{
            setViewMode(p=>{
              const next=p==="editor"?"dashboard":"editor";
              // Invalidate after DOM settles
              setTimeout(()=>mapRef.current?.invalidateSize({animate:false}),120);
              setTimeout(()=>mapRef.current?.invalidateSize({animate:false}),400);
              return next;
            });
          }}
            active={viewMode==="dashboard"}
            title={viewMode==="editor"?"Switch to Dashboard View":"Switch to Editor"}>
            <Icon name={viewMode==="editor"?"view":"edit2"} size={13}
              color={viewMode==="dashboard"?"#fff":"var(--text-muted)"}/>
            {viewMode==="editor"?"Dashboard View":"Editor"}
          </Btn>
          {viewMode==="dashboard"&&(
            <Btn onClick={()=>setLayoutPickerOpen(true)} title="Change layout">
              <Icon name="layout" size={13} color="var(--text-muted)"/>
              {LAYOUT_TEMPLATES[layoutKey]?.label||"Layout"}
            </Btn>
          )}
          <Btn onClick={()=>setExportOpen(true)}>
            <Icon name="export" size={13} color="var(--text-muted)"/> Export
          </Btn>
          <Btn onClick={()=>setAnalysisOpen(true)} title="Spatial analysis tools">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
            </svg>
            Analysis
          </Btn>
          <Btn onClick={()=>setLayerPanelOpen(p=>!p)} active={layerPanelOpen}>
            <Icon name="layers" size={13} color={layerPanelOpen?"#fff":"var(--text-muted)"}/> Layers
          </Btn>
          {/* Split Add Data: vector file upload + tile layer */}
          <div style={{display:"flex",height:36,borderRadius:10,overflow:"hidden",
            boxShadow:"0 4px 12px rgba(200,146,42,0.35)"}}>
            <label style={{display:"flex",alignItems:"center",gap:6,background:"var(--accent)",
              color:"#fff",padding:"0 14px",cursor:"pointer",
              fontSize:12,fontWeight:700,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>
              <Icon name="upload" size={14} color="#fff"/> Add Data
              <input type="file" multiple hidden accept=".zip,.geojson,.json,.csv,.kml,.kmz" onChange={handleUpload}/>
            </label>
            <button onClick={()=>setTileModalOpen(true)} title="Add tile/raster layer"
              style={{background:"var(--accent2)",border:"none",borderLeft:"1px solid rgba(255,255,255,0.2)",
                padding:"0 10px",cursor:"pointer",display:"flex",alignItems:"center",color:"#fff"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* PERSISTENT MAP DIV — always in DOM, positioned by JS into the current map slot */}
      <div ref={mapDivRef} id="leaflet-persistent-map"
        style={{position:"absolute",zIndex:10,background:"transparent"}}/>

      {/* BODY */}
      <div ref={editorBodyRef} style={{display:"flex",flex:1,overflow:"hidden",position:"relative"}}>
        {viewMode==="dashboard"?(
          /* ═══ DASHBOARD LAYOUT VIEW ═══ */
          <div ref={dashRef} style={{flex:1,overflow:"hidden"}}>
            <LayoutView
              layoutKey={layoutKey}
              slots={layoutSlots}
              onSlotChange={updateSlot}
              layers={layers}
              visibleFeatsByLayer={visibleFeatsByLayer}
              mapProps={mapProps}
              isDark={isDark}
              dashRef={dashRef}
              applyFilters={applyFilters}
            />
          </div>
        ):(
          /* ═══ EDITOR VIEW ═══ */
          <>
            {/* Sidebar */}
            {!chartsHidden&&(
            <div style={{width:380,flexShrink:0,background:"var(--panel)",
              borderRight:"1.5px solid var(--border)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {/* Sidebar header */}
              <div style={{padding:"10px 16px",borderBottom:"1.5px solid var(--border)",
                display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Icon name="chart" size={15} color="var(--accent)"/>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Analytics</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {layers.length>0&&(
                    <button onClick={()=>setSymbolEditorOpen(true)}
                      style={{display:"flex",alignItems:"center",gap:5,background:"var(--panel2)",
                        border:"1.5px solid var(--border)",borderRadius:7,padding:"4px 10px",
                        cursor:"pointer",fontSize:10,fontWeight:600,color:"var(--text-muted)",fontFamily:"inherit"}}>
                      <Icon name="palette" size={11}/> Symbols
                    </button>
                  )}
                  {layers.length>0&&(()=>{
                    const activeRules=filters.reduce((n,g)=>n+g.rules.filter(r=>
                      r.op==="in"||r.op==="not_in"?r.vals?.length>0:!!r.val).length,0);
                    return(
                    <button onClick={()=>setFilterPanelOpen(true)}
                      style={{display:"flex",alignItems:"center",gap:5,
                        background:activeRules?"var(--accent)":"var(--panel2)",
                        border:`1.5px solid ${activeRules?"var(--accent)":"var(--border)"}`,
                        borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:600,
                        color:activeRules?"#fff":"var(--text-muted)",fontFamily:"inherit"}}>
                      <Icon name="filter" size={11} color={activeRules?"#fff":"var(--text-muted)"}/>
                      {activeRules?`${activeRules} Filter`:"Filter"}
                    </button>
                    );
                  })()}
                </div>
              </div>

              {/* Map symbology source */}
              {layers.length>0&&(
                <div style={{padding:"10px 16px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
                  <label style={{fontSize:10,fontWeight:600,color:"var(--text-muted)",
                    letterSpacing:"0.08em",display:"block",marginBottom:6}}>
                    MAP SYMBOLOGY LAYER · <span style={{color:"var(--accent)"}}>{geomType}</span>
                  </label>
                  <div style={{display:"flex",gap:6}}>
                    <select value={String(primaryLayerId||"")}
                      onChange={e=>{
                        const lid=e.target.value;
                        setPrimaryLayerId(lid);
                        const l=layers.find(x=>String(x.id)===lid);
                        const remembered=primaryFieldMap[lid];
                        const f0=Object.keys(l?.geojson?.features?.[0]?.properties||{})[0];
                        const f=remembered||f0;
                        if(f){setPrimaryField(f);setLabelField(f);}
                      }}
                      style={{...ss(),flex:1}}>
                      {layers.map(l=><option key={l.id} value={String(l.id)}>{l.name}</option>)}
                    </select>
                    <select value={primaryField||""}
                      onChange={e=>{
                        const f=e.target.value;
                        setPrimaryField(f);
                        setPrimaryFieldMap(p=>({...p,[String(primaryLayerId)]:f}));
                      }}
                      style={{...ss(),flex:1}}>
                      <option value="">— field —</option>
                      {fields.map(f=><option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Labels */}
              {layers.length>0&&fields.length>0&&(
                <div style={{padding:"8px 16px",borderBottom:"1px solid var(--border)",
                  display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  <button onClick={()=>setShowLabels(p=>!p)}
                    style={{display:"flex",alignItems:"center",gap:5,
                      background:showLabels?"var(--accent-soft)":"transparent",
                      border:`1.5px solid ${showLabels?"var(--accent)":"var(--border)"}`,
                      borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:600,
                      color:showLabels?"var(--accent)":"var(--text-muted)",fontFamily:"inherit",flexShrink:0}}>
                    <Icon name="label" size={12} color={showLabels?"var(--accent)":"var(--text-muted)"}/>
                    Labels
                  </button>
                  {showLabels&&(
                    <select value={labelField} onChange={e=>setLabelField(e.target.value)}
                      style={{...ss(),flex:1}}>
                      {fields.map(f=><option key={f} value={f}>{f}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* Chart panels */}
              <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
                {!layers.length?(
                  <div style={{height:"100%",display:"flex",flexDirection:"column",
                    alignItems:"center",justifyContent:"center",opacity:0.3,gap:16,padding:40}}>
                    <Icon name="db" size={48} color="var(--text-muted)"/>
                    <div style={{textAlign:"center",fontSize:13,lineHeight:1.8,color:"var(--text-muted)"}}>
                      Upload a shapefile, GeoJSON<br/>or CSV to begin
                    </div>
                  </div>
                ):(
                  <>
                    {sidebarCharts.map((chart,ci)=>(
                      <div key={chart.id} style={{position:"relative"}}>
                        {sidebarCharts.length>1&&(
                          <button onClick={()=>removeSidebarChart(chart.id)}
                            style={{position:"absolute",top:10,right:10,zIndex:10,
                              background:"none",border:"none",cursor:"pointer",
                              color:"var(--text-muted)",padding:3}}>
                            <Icon name="x" size={13}/>
                          </button>
                        )}
                        {/* Each ChartWidget is fully self-contained: picks its own layer */}
                        <ChartWidget
                          layers={layers}
                          visibleFeatsByLayer={visibleFeatsByLayer}
                          config={chart}
                          onConfigChange={patch=>updateSidebarChart(chart.id,patch)}
                          isDark={isDark}
                          compact={false}
                          applyFilters={applyFilters}
                        />
                      </div>
                    ))}
                    {sidebarCharts.length<4&&(
                      <button onClick={addSidebarChart}
                        style={{width:"100%",padding:"12px 16px",background:"transparent",border:"none",
                          borderBottom:"1px solid var(--border)",cursor:"pointer",
                          display:"flex",alignItems:"center",gap:8,color:"var(--text-muted)",
                          fontSize:12,fontFamily:"inherit",justifyContent:"center",fontWeight:600,
                          transition:"background 0.12s"}}
                        onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <Icon name="plus" size={14}/> Add Chart Panel
                      </button>
                    )}

                    {/* Legend for primary layer */}
                    {primaryField&&layers.length>0&&(()=>{
                      const baseColors=buildColorMap(activeLayer?.geojson?.features||[],primaryField);
                      const mergedColors={...baseColors,...customColorMap};
                      const cats=Object.keys(mergedColors);
                      if(!cats.length) return null;
                      const visFeats=visibleFeatsByLayer[String(activeLayer?.id)]||[];
                      return(
                        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)"}}>
                          <div style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",
                            letterSpacing:"0.08em",marginBottom:10,textTransform:"uppercase"}}>
                            Legend · {primaryField}
                            <span style={{marginLeft:8,color:"var(--accent)",fontWeight:600}}>{geomType}</span>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:7}}>
                            {cats.map(val=>{
                              const col=mergedColors[val];
                              const shape=customShapeMap[val]||"circle";
                              const cnt=visFeats.filter(f=>String(f.properties?.[primaryField])===val).length;
                              return(
                                <div key={val} style={{display:"flex",alignItems:"center",gap:9}}>
                                  <span dangerouslySetInnerHTML={{__html:legendSwatch(geomType,col,shape,22,14)}}
                                    style={{flexShrink:0,display:"flex",alignItems:"center"}}/>
                                  <span style={{flex:1,fontSize:12,color:"var(--text)",overflow:"hidden",
                                    textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{val}</span>
                                  <span style={{fontSize:11,color:"var(--text-muted)",fontFamily:"monospace",flexShrink:0}}>{cnt}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Sidebar footer */}
              <div style={{borderTop:"1.5px solid var(--border)",padding:"8px 16px",flexShrink:0,
                background:"var(--panel)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"var(--text-muted)"}}>
                  {totalVisible.toLocaleString()} visible / {totalFeatures.toLocaleString()} total
                </span>
                <span style={{fontSize:10,color:"var(--accent)",fontWeight:700,letterSpacing:"0.06em"}}>GEOCORE v7</span>
              </div>
            </div>
            )}
            {/* Collapse/expand sidebar toggle */}
            <button onClick={()=>setChartsHidden(p=>!p)} title={chartsHidden?"Show analytics panel":"Hide analytics panel"}
              style={{position:"absolute",left:chartsHidden?0:380,top:"50%",transform:"translateY(-50%)",
                zIndex:200,width:16,height:48,background:"var(--panel2)",
                border:"1.5px solid var(--border)",borderLeft:chartsHidden?"1.5px solid var(--border)":"none",
                borderRadius:chartsHidden?"0 6px 6px 0":"0 6px 6px 0",
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                color:"var(--text-muted)",padding:0,transition:"left 0.18s"}}>
              <Icon name={chartsHidden?"chevR":"chevL"} size={11}/>
            </button>

            {/* Map — uses MapSlot to position the persistent mapDivRef */}
            <div ref={dashRef} style={{flex:1,position:"relative",overflow:"hidden"}}>
              <MapSlot mapProps={mapProps} isDark={isDark}/>
              {/* Coordinate display */}
              <div style={{position:"absolute",bottom:26,left:0,right:0,height:22,
                background:isDark?"rgba(15,25,35,0.88)":"rgba(255,255,255,0.88)",
                borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",
                padding:"0 14px",zIndex:499}}>
                <span style={{fontSize:11,color:"var(--text-muted)",fontFamily:"monospace"}}>📍 {coordDisplay}</span>
              </div>
            </div>
          </>
        )}

        {/* LAYER PANEL */}
        {layerPanelOpen&&(
          <div style={{position:"absolute",right:0,top:0,bottom:0,width:290,
            background:"var(--panel)",borderLeft:"1.5px solid var(--border)",
            zIndex:600,display:"flex",flexDirection:"column",
            boxShadow:"-4px 0 24px var(--shadow)"}}>
            <div style={{padding:"13px 16px",borderBottom:"1.5px solid var(--border)",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Icon name="layers" size={15} color="var(--accent)"/>
                <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Layer Manager</span>
              </div>
              <button onClick={()=>setLayerPanelOpen(false)}
                style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:4}}>
                <Icon name="x" size={16}/>
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
              {!layers.length?<EmptyMsg>No layers loaded</EmptyMsg>
                :layers.map(layer=>(
                <div key={layer.id}
                  style={{padding:"11px 16px",
                    borderLeft:`3px solid ${String(layer.id)===String(primaryLayerId)?"var(--accent)":"transparent"}`,
                    background:String(layer.id)===String(primaryLayerId)?"var(--accent-soft)":"transparent",
                    transition:"all 0.12s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:8}}
                    onClick={()=>{
                      const lid=String(layer.id);
                      setPrimaryLayerId(lid);
                      const remembered=primaryFieldMap[lid];
                      const f0=Object.keys(layer.geojson?.features?.[0]?.properties||{})[0];
                      const f=remembered||f0;
                      if(f){setPrimaryField(f);setLabelField(f);}
                    }}>
                    <div style={{width:12,height:12,
                      borderRadius:layer.type==="tile"?"2px":layer.geomType==="Polygon"?"3px":layer.geomType==="Line"?"2px":"50%",
                      background:layer.type==="tile"?"var(--text-muted)":layer.color,flexShrink:0,
                      border:layer.type==="tile"?"2px dashed var(--border)":"none"}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{layer.name}</div>
                      <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>
                        {layer.type==="tile"
                          ?<span style={{color:"var(--accent)"}}>Tile Layer · {layer.tileUrl?.slice(0,30)}…</span>
                          :`${layer.geomType||"?"} · ${(layer.geojson?.features?.length||0).toLocaleString()} features`}
                      </div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();toggleLayer(layer.id);}}
                      style={{background:"none",border:"none",cursor:"pointer",
                        color:layer.visible?"var(--accent)":"var(--text-muted)",padding:3}}>
                      <Icon name={layer.visible?"eye":"eyeOff"} size={15}/>
                    </button>
                    <button onClick={e=>{e.stopPropagation();removeLayer(layer.id);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",padding:3}}>
                      <Icon name="trash" size={14}/>
                    </button>
                  </div>
                  {/* Opacity row — for tile layers, controls tileOpacity */}
                  <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:22}}>
                    <Icon name="opacity" size={11} color="var(--text-muted)"/>
                    {layer.type==="tile"?(
                      <input type="range" min="0" max="1" step="0.05"
                        value={layer.tileOpacity??1}
                        onChange={e=>setLayers(p=>p.map(l=>l.id===layer.id?{...l,tileOpacity:+e.target.value}:l))}
                        style={{flex:1}}/>
                    ):(
                      <input type="range" min="0" max="1" step="0.05"
                        value={layerOpacity[layer.id]??1}
                        onChange={e=>setLayerOpacity(p=>({...p,[layer.id]:+e.target.value}))}
                        style={{flex:1}}/>
                    )}
                    <span style={{fontSize:10,color:"var(--text-muted)",minWidth:26,textAlign:"right",fontFamily:"monospace"}}>
                      {Math.round(((layer.type==="tile"?layer.tileOpacity:layerOpacity[layer.id])??1)*100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{borderTop:"1px solid var(--border)",padding:12}}>
              <label style={{display:"flex",alignItems:"center",gap:8,background:"var(--panel2)",
                border:"1.5px dashed var(--border)",borderRadius:10,padding:"10px 14px",
                cursor:"pointer",fontSize:12,color:"var(--text-muted)",justifyContent:"center",fontWeight:600}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-muted)";}}>
                <Icon name="plus" size={14}/> Add Layer
                <input type="file" multiple hidden accept=".zip,.geojson,.json,.csv,.kml,.kmz" onChange={handleUpload}/>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {symbolEditorOpen&&(
        <SymbolEditor
          layer={activeLayer}
          customColorMap={customColorMap[String(activeLayer?.id)]||{}}
          customShapeMap={customShapeMap[String(activeLayer?.id)]||{}}
          customOpacityMap={customOpacityMap[String(activeLayer?.id)]||{}}
          customSizeMap={customSizeMap[String(activeLayer?.id)]||{}}
          customOutlineColorMap={customOutlineColorMap[String(activeLayer?.id)]||{}}
          customOutlineWidthMap={customOutlineWidthMap[String(activeLayer?.id)]||{}}
          customHollowMap={customHollowMap[String(activeLayer?.id)]||{}}
          primaryField={primaryField}
          onColorChange={(cat,col)=>setCustomColorMap(p=>({...p,[String(activeLayer?.id)]:{...(p[String(activeLayer?.id)]||{}),[cat]:col}}))}
          onShapeChange={(cat,shape)=>setCustomShapeMap(p=>({...p,[String(activeLayer?.id)]:{...(p[String(activeLayer?.id)]||{}),[cat]:shape}}))}
          onOpacityChange={(cat,val)=>setCustomOpacityMap(p=>({...p,[String(activeLayer?.id)]:{...(p[String(activeLayer?.id)]||{}),[cat]:val}}))}
          onSizeChange={(cat,val)=>setCustomSizeMap(p=>({...p,[String(activeLayer?.id)]:{...(p[String(activeLayer?.id)]||{}),[cat]:val}}))}
          onOutlineColorChange={(cat,val)=>setCustomOutlineColorMap(p=>({...p,[String(activeLayer?.id)]:{...(p[String(activeLayer?.id)]||{}),[cat]:val}}))}
          onOutlineWidthChange={(cat,val)=>setCustomOutlineWidthMap(p=>({...p,[String(activeLayer?.id)]:{...(p[String(activeLayer?.id)]||{}),[cat]:val}}))}
          onHollowChange={(cat,val)=>setCustomHollowMap(p=>({...p,[String(activeLayer?.id)]:{...(p[String(activeLayer?.id)]||{}),[cat]:val}}))}
          onClose={()=>setSymbolEditorOpen(false)}
        />
      )}
      {filterPanelOpen&&(
        <FilterPanel
          layers={layers}
          features={activeLayer?.geojson?.features||[]}
          allLayerFeatures={allLayerFeatures}
          filters={filters}
          onFiltersChange={setFilters}
          onClose={()=>setFilterPanelOpen(false)}
        />
      )}
      {exportOpen&&(
        <ExportModal
          dashboardRef={dashRef}
          mapDivRef={mapDivRef}
          mapRef={mapRef}
          editorRef={editorBodyRef}
          projectTitle={projectTitle}
          onClose={()=>setExportOpen(false)}
        />
      )}
      {layoutPickerOpen&&(
        <LayoutPicker
          onPick={key=>setLayoutKey(key)}
          onClose={()=>setLayoutPickerOpen(false)}
        />
      )}
      {tileModalOpen&&(
        <TileLayerModal
          layerCount={layers.length}
          onAdd={layer=>{addLayer(layer);}}
          onClose={()=>setTileModalOpen(false)}
        />
      )}
      {analysisOpen&&(
        <AnalysisModal
          layers={layers}
          onAddLayer={addLayer}
          onClose={()=>setAnalysisOpen(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ROOT
═══════════════════════════════════════════ */
export default function App(){
  const [ready,setReady]=useState(false);
  const [screen,setScreen]=useState("projects");
  const [project,setProject]=useState(null);
  const [theme,setTheme]=useState(()=>localStorage.getItem("geocore_theme")||"dark");

  useEffect(()=>{
    Object.entries(THEMES[theme]).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
    localStorage.setItem("geocore_theme",theme);
  },[theme]);

  useEffect(()=>{
    if(document.getElementById("geocore-root-css")) return;
    const el=document.createElement("style");el.id="geocore-root-css";
    el.textContent=`*{box-sizing:border-box;margin:0;padding:0}body,html,#root{height:100%;width:100%;font-family:Inter,'DM Sans',sans-serif}@keyframes spin{to{transform:rotate(360deg)}}@keyframes loadbar{0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}`;
    document.head.appendChild(el);
    if(!document.querySelector('link[href*="fonts.googleapis"]')){
      const l=document.createElement("link");l.rel="stylesheet";
      l.href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(l);
    }
  },[]);

  useEffect(()=>{
    loadStyle(CDN.leaflet_css);
    Promise.all([
      loadScript(CDN.leaflet_js),loadScript(CDN.papaparse),
      loadScript(CDN.chartjs),loadScript(CDN.shpjs),
      loadScript(CDN.html2canvas),loadScript(CDN.jspdf),
      loadScript(CDN.togeojson),loadScript(CDN.jszip),loadScript(CDN.turf),
    ]).then(()=>{setReady(true);return loadScript(CDN.leaflet_image);}).catch(console.error);
  },[]);

  const toggleTheme=()=>setTheme(t=>t==="dark"?"light":"dark");

  if(!ready) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"100vh",background:"#0f1923",gap:20}}>
      <svg width="52" height="52" viewBox="0 0 36 36">
        <polygon points="18,3 33,30 3,30" fill="#1A2B4A" stroke="#C8922A" strokeWidth="1.5"/>
        <polygon points="18,10 26,25 10,25" fill="#C8922A" opacity="0.85"/>
      </svg>
      <div style={{color:"#C8922A",fontFamily:"Inter,sans-serif",fontSize:15,fontWeight:700,letterSpacing:"0.04em"}}>
        Loading GeoCore…
      </div>
      <div style={{width:180,height:3,background:"#1c2a3d",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",background:"#C8922A",borderRadius:3,animation:"loadbar 1.8s ease-in-out infinite"}}/>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes loadbar{0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}`}</style>
    </div>
  );

  if(screen==="projects")
    return <ProjectsPage onOpen={p=>{setProject(p);setScreen("dashboard");}} theme={theme} onThemeToggle={toggleTheme}/>;

  if(!project) return null;

  return <Dashboard key={project.id} project={project} onBack={()=>{setScreen("projects");setProject(null);}} theme={theme} onThemeToggle={toggleTheme}/>;
}