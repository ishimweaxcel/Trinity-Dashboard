import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   CDN
═══════════════════════════════════════════════════════════ */
const CDN = {
  leaflet_css:  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  leaflet_js:   "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  leaflet_draw_css: "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css",
  leaflet_draw: "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js",
  papaparse:    "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js",
  chartjs:      "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
  shpjs:        "https://cdn.jsdelivr.net/npm/shpjs@4.0.4/dist/shp.js",
  html2canvas:  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  jspdf:        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
};

/* ═══════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════ */
const THEMES = {
  dark: {
    "--bg":"#0e0e0c","--panel":"#161614","--panel2":"#1c1c1a","--panel3":"#222220",
    "--border":"#2a2a28","--text":"#d4d2ca","--text-muted":"#888780",
    "--accent":"#E8B84B","--accent2":"#c49a35","--hover":"rgba(232,184,75,0.07)",
    "--danger":"#e05252","--success":"#4ecdc4","--shadow":"rgba(0,0,0,0.65)",
  },
  light: {
    "--bg":"#eeeae2","--panel":"#ffffff","--panel2":"#f5f3ee","--panel3":"#ebe8e0",
    "--border":"#dedad2","--text":"#2c2b28","--text-muted":"#7a7870",
    "--accent":"#b8861a","--accent2":"#9a6e10","--hover":"rgba(184,134,26,0.08)",
    "--danger":"#c0392b","--success":"#27ae60","--shadow":"rgba(0,0,0,0.14)",
  },
};

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const PALETTE = [
  "#E8B84B","#4ECDC4","#FF6B6B","#45B7D1","#96CEB4","#F7A35C",
  "#8085E9","#F15C80","#2ECC71","#E74C3C","#3498DB","#9B59B6",
  "#1ABC9C","#E67E22","#BDC3C7","#E91E63","#00BCD4","#8BC34A",
];
const SHAPES = ["circle","square","triangle","diamond","star","cross","hexagon"];
const BASEMAPS = {
  "Satellite":   "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  "Hybrid":      "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  "Topographic": "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  "Street":      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "Dark":        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  "Light":       "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};
const DB_NAME = "geocore_v4";
const DB_VERSION = 1;

/* ═══════════════════════════════════════════════════════════
   INDEXEDDB HELPERS
═══════════════════════════════════════════════════════════ */
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function dbGetAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction("projects", "readonly");
    const req = tx.objectStore("projects").getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function dbPut(obj) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction("projects", "readwrite");
    const req = tx.objectStore("projects").put(obj);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction("projects", "readwrite");
    const req = tx.objectStore("projects").delete(id);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

/* ═══════════════════════════════════════════════════════════
   SVG ICON MAKER (map markers)
═══════════════════════════════════════════════════════════ */
function makeIconSVG(shape, color, size = 16) {
  const r = size / 2;
  let inner = "";
  switch (shape) {
    case "square":
      inner = `<rect x="1" y="1" width="${size-2}" height="${size-2}" rx="2" fill="${color}" stroke="#111" stroke-width="1"/>`;
      break;
    case "triangle":
      inner = `<polygon points="${r},1 ${size-1},${size-1} 1,${size-1}" fill="${color}" stroke="#111" stroke-width="1"/>`;
      break;
    case "diamond":
      inner = `<polygon points="${r},1 ${size-1},${r} ${r},${size-1} 1,${r}" fill="${color}" stroke="#111" stroke-width="1"/>`;
      break;
    case "star": {
      const pts = Array.from({length:10},(_,i)=>{
        const a=(i*Math.PI)/5-Math.PI/2, rad=i%2===0?r-1:r*0.42;
        return `${r+rad*Math.cos(a)},${r+rad*Math.sin(a)}`;
      });
      inner = `<polygon points="${pts.join(" ")}" fill="${color}" stroke="#111" stroke-width="0.8"/>`;
      break;
    }
    case "cross":
      inner = `<line x1="${r}" y1="2" x2="${r}" y2="${size-2}" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>
               <line x1="2" y1="${r}" x2="${size-2}" y2="${r}" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`;
      break;
    case "hexagon": {
      const hp = Array.from({length:6},(_,i)=>{
        const a=(Math.PI/3)*i-Math.PI/6;
        return `${r+(r-1.5)*Math.cos(a)},${r+(r-1.5)*Math.sin(a)}`;
      });
      inner = `<polygon points="${hp.join(" ")}" fill="${color}" stroke="#111" stroke-width="1"/>`;
      break;
    }
    default:
      inner = `<circle cx="${r}" cy="${r}" r="${r-1}" fill="${color}" stroke="#111" stroke-width="1"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;
}

/* ═══════════════════════════════════════════════════════════
   SCRIPT LOADER
═══════════════════════════════════════════════════════════ */
const _loaded = new Set();
function loadScript(src) {
  if (_loaded.has(src)) return Promise.resolve();
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) { _loaded.add(src); return Promise.resolve(); }
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => { _loaded.add(src); res(); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
function loadStyle(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href;
    document.head.appendChild(l);
  }
}

/* ═══════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════ */
const IP = {
  upload:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  layers:   <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  chart:    <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  map:      <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
  x:        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  image:    <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
  trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
  eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff:   <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
  chevD:    <><polyline points="6 9 12 15 18 9"/></>,
  chevU:    <><polyline points="18 15 12 9 6 15"/></>,
  db:       <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
  zIn:      <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  zOut:     <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  home:     <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  sun:      <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
  moon:     <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
  palette:  <><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2v-.5c0-.55.45-1 1-1h1c2.76 0 5-2.24 5-5 0-5.52-4.48-10-10-10z"/></>,
  save:     <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
  export:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  folder:   <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>,
  ruler:    <><line x1="4" y1="21" x2="21" y2="4"/><line x1="4" y1="21" x2="9" y2="16"/><line x1="21" y1="4" x2="16" y2="9"/><line x1="14" y1="3" x2="3" y2="14"/></>,
  filter:   <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
  label:    <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
  edit:     <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  back:     <><polyline points="15 18 9 12 15 6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 1.95 3.64l-1.36.37a8 8 0 0 0-1.57-2.93l.98-.97zm-14.14 0l.98.97a8 8 0 0 0-1.57 2.93l-1.36-.37A10 10 0 0 1 4.93 4.93zM4.93 19.07l.97-.98a8 8 0 0 0 2.93 1.57l-.37 1.36a10 10 0 0 1-3.53-1.95zm14.14 0a10 10 0 0 1-3.53 1.95l-.37-1.36a8 8 0 0 0 2.93-1.57l.97.98z"/></>,
  check:    <><polyline points="20 6 9 17 4 12"/></>,
};
const Icon = ({ name, size=16, color="currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {IP[name]}
  </svg>
);

/* ═══════════════════════════════════════════════════════════
   CHART PANEL
═══════════════════════════════════════════════════════════ */
function ChartPanel({ data, field, chartType, colorMap, isDark, height=240 }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !field || chartType === "table") return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (!data?.length) return;

    const counts = {};
    data.forEach(f => { const v=String(f.properties?.[field]??"N/A"); counts[v]=(counts[v]||0)+1; });
    let labels = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).slice(0,20);
    const colors = labels.map(l => colorMap[l]||"#888");
    const tc = isDark?"#c9c8c0":"#3d3d3a";
    const gc = isDark?"#2a2a28":"#e8e6e0";

    chartRef.current = new window.Chart(canvasRef.current.getContext("2d"),{
      type: chartType==="area"?"line":chartType==="donut"?"doughnut":chartType,
      data:{
        labels,
        datasets:[{
          data: labels.map(l=>counts[l]),
          backgroundColor: chartType==="line"?"transparent":colors.map(c=>c+"CC"),
          borderColor: colors, borderWidth: chartType==="line"?2:1,
          tension:0.4, fill:chartType==="area",
          pointRadius:(chartType==="line"||chartType==="area")?4:0,
          pointBackgroundColor:colors,
        }],
      },
      options:{
        responsive:true, maintainAspectRatio:false, animation:false,
        plugins:{
          legend:{ display:chartType==="pie"||chartType==="donut", position:"bottom",
            labels:{color:tc,font:{size:10},padding:8,boxWidth:12} },
          tooltip:{ backgroundColor:isDark?"#1c1c1a":"#fff",
            titleColor:tc, bodyColor:tc,
            borderColor:isDark?"#3a3a38":"#d8d6d0", borderWidth:1 },
        },
        scales:(chartType==="pie"||chartType==="donut")?{}:{
          x:{ ticks:{color:tc,font:{size:9},maxRotation:40}, grid:{color:gc} },
          y:{ ticks:{color:tc,font:{size:9}}, grid:{color:gc}, beginAtZero:true },
        },
      },
    });
    return () => { if(chartRef.current){chartRef.current.destroy();chartRef.current=null;} };
  },[data,field,chartType,colorMap,isDark]);

  if (chartType==="table") return null;
  return (
    <div style={{height,position:"relative",minHeight:height}}>
      {(!data?.length&&field) && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:11,color:"var(--text-muted)",opacity:0.5}}>
          No visible features
        </div>
      )}
      <canvas ref={canvasRef} style={{width:"100%",height:"100%"}}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TABLE PANEL
═══════════════════════════════════════════════════════════ */
function TablePanel({ data, field, colorMap }) {
  if (!data?.length||!field) return null;
  const counts={};
  data.forEach(f=>{const v=String(f.properties?.[field]??"N/A");counts[v]=(counts[v]||0)+1;});
  const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,60);
  const total=data.length||1;
  return (
    <div style={{overflowY:"auto",flex:1,fontSize:12}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"var(--panel)"}}>
            {["Value","Count","%",""].map(h=>(
              <th key={h} style={{padding:"7px 10px",textAlign:h==="Value"?"left":"right",
                color:"var(--text-muted)",fontWeight:500,fontSize:10}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([val,cnt],i)=>{
            const pct=((cnt/total)*100).toFixed(1);
            const col=colorMap[val]||PALETTE[i%PALETTE.length];
            return (
              <tr key={val} style={{borderBottom:"1px solid var(--border)"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"6px 10px",color:"var(--text)",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{width:9,height:9,borderRadius:"50%",background:col,flexShrink:0,display:"inline-block"}}/>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120}}>{val}</span>
                </td>
                <td style={{padding:"6px 10px",textAlign:"right",color:"var(--text)",fontVariantNumeric:"tabular-nums"}}>{cnt}</td>
                <td style={{padding:"6px 10px",textAlign:"right",color:"var(--text-muted)"}}>{pct}%</td>
                <td style={{padding:"6px 10px"}}>
                  <div style={{height:4,borderRadius:3,background:"var(--border)",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:3}}/>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SYMBOL EDITOR MODAL
═══════════════════════════════════════════════════════════ */
function SymbolEditor({ colorMap, shapeMap, opacityMap, onColorChange, onShapeChange, onOpacityChange, onClose }) {
  const cats = Object.keys(colorMap);
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",
      justifyContent:"center",background:"rgba(0,0,0,0.6)"}} onClick={onClose}>
      <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:14,
        width:380,maxHeight:"78vh",display:"flex",flexDirection:"column",
        boxShadow:"0 24px 64px var(--shadow)"}} onClick={e=>e.stopPropagation()}>

        <div style={{padding:"13px 16px",borderBottom:"1px solid var(--border)",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Icon name="palette" size={14} color="var(--accent)"/>
            <span style={{fontSize:12,fontWeight:700,letterSpacing:"0.08em",color:"var(--text-muted)"}}>SYMBOL EDITOR</span>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)"}}>
            <Icon name="x" size={16}/>
          </button>
        </div>

        {/* Column headers */}
        <div style={{display:"grid",gridTemplateColumns:"24px 1fr 80px 70px",gap:8,
          padding:"8px 16px",borderBottom:"1px solid var(--border)",
          fontSize:10,color:"var(--text-muted)",letterSpacing:"0.08em"}}>
          <span>CLR</span><span>CATEGORY</span><span>SHAPE</span><span>OPACITY</span>
        </div>

        <div style={{overflowY:"auto",flex:1}}>
          {cats.length===0?(
            <div style={{padding:28,textAlign:"center",fontSize:12,color:"var(--text-muted)"}}>
              Select a field first to enable symbol editing
            </div>
          ):cats.map(cat=>(
            <div key={cat} style={{display:"grid",gridTemplateColumns:"24px 1fr 80px 70px",
              gap:8,padding:"9px 16px",borderBottom:"1px solid var(--border)",
              alignItems:"center"}}>
              {/* Colour */}
              <div style={{position:"relative",width:22,height:22,borderRadius:"50%",
                background:colorMap[cat],border:"2px solid var(--border)",overflow:"hidden",cursor:"pointer"}}>
                <input type="color" value={colorMap[cat]} onChange={e=>onColorChange(cat,e.target.value)}
                  style={{opacity:0,position:"absolute",inset:0,width:"100%",height:"100%",cursor:"pointer",padding:0}}/>
              </div>
              {/* Name */}
              <span style={{fontSize:11,color:"var(--text)",overflow:"hidden",
                textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat}</span>
              {/* Shape */}
              <select value={shapeMap[cat]||"circle"} onChange={e=>onShapeChange(cat,e.target.value)}
                style={{background:"var(--panel2)",border:"1px solid var(--border)",color:"var(--text)",
                  borderRadius:5,padding:"3px 5px",fontSize:10,fontFamily:"inherit",cursor:"pointer",width:"100%"}}>
                {SHAPES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              {/* Opacity */}
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <input type="range" min="0" max="1" step="0.05"
                  value={opacityMap[cat]??0.7}
                  onChange={e=>onOpacityChange(cat,+e.target.value)}
                  style={{width:44}}/>
                <span style={{fontSize:9,color:"var(--text-muted)",minWidth:22,textAlign:"right"}}>
                  {Math.round((opacityMap[cat]??0.7)*100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:"9px 16px",borderTop:"1px solid var(--border)",fontSize:10,
          color:"var(--text-muted)",textAlign:"center"}}>
          Click colour swatch · Choose shape · Drag slider for polygon/line fill opacity
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FILTER PANEL
═══════════════════════════════════════════════════════════ */
function FilterPanel({ fields, features, filters, onFiltersChange, onClose }) {
  const [field, setField]   = useState(fields[0]||"");
  const [op,    setOp]      = useState("=");
  const [val,   setVal]     = useState("");
  const uniqueVals = useMemo(()=>{
    if(!field||!features?.length) return [];
    return [...new Set(features.map(f=>String(f.properties?.[field]??"")).filter(Boolean))].sort().slice(0,50);
  },[field,features]);

  const add = () => {
    if(!field||!val) return;
    onFiltersChange([...filters,{id:Date.now(),field,op,val}]);
    setVal("");
  };
  const remove = id => onFiltersChange(filters.filter(f=>f.id!==id));

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",
      justifyContent:"center",background:"rgba(0,0,0,0.6)"}} onClick={onClose}>
      <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:14,
        width:400,maxHeight:"75vh",display:"flex",flexDirection:"column",
        boxShadow:"0 24px 64px var(--shadow)"}} onClick={e=>e.stopPropagation()}>

        <div style={{padding:"13px 16px",borderBottom:"1px solid var(--border)",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Icon name="filter" size={14} color="var(--accent)"/>
            <span style={{fontSize:12,fontWeight:700,letterSpacing:"0.08em",color:"var(--text-muted)"}}>ATTRIBUTE FILTER</span>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)"}}>
            <Icon name="x" size={16}/>
          </button>
        </div>

        {/* Add filter row */}
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",gap:6,flexWrap:"wrap"}}>
          <select value={field} onChange={e=>setField(e.target.value)}
            style={{flex:2,background:"var(--panel2)",border:"1px solid var(--border)",color:"var(--text)",
              borderRadius:6,padding:"6px 8px",fontSize:11,fontFamily:"inherit"}}>
            {fields.map(f=><option key={f} value={f}>{f}</option>)}
          </select>
          <select value={op} onChange={e=>setOp(e.target.value)}
            style={{flex:"0 0 56px",background:"var(--panel2)",border:"1px solid var(--border)",color:"var(--text)",
              borderRadius:6,padding:"6px 4px",fontSize:11,fontFamily:"inherit"}}>
            {["=","≠","contains","starts"].map(o=><option key={o} value={o}>{o}</option>)}
          </select>
          <select value={val} onChange={e=>setVal(e.target.value)}
            style={{flex:2,background:"var(--panel2)",border:"1px solid var(--border)",color:"var(--text)",
              borderRadius:6,padding:"6px 8px",fontSize:11,fontFamily:"inherit"}}>
            <option value="">— pick value —</option>
            {uniqueVals.map(v=><option key={v} value={v}>{v}</option>)}
          </select>
          <button onClick={add}
            style={{flex:"0 0 36px",background:"var(--accent)",border:"none",borderRadius:6,
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#0e0e0c"}}>
            <Icon name="plus" size={14} color="#0e0e0c"/>
          </button>
        </div>

        {/* Active filters */}
        <div style={{flex:1,overflowY:"auto",padding:filters.length?"8px 16px":0}}>
          {filters.length===0?(
            <div style={{padding:28,textAlign:"center",fontSize:12,color:"var(--text-muted)",opacity:0.5}}>
              No filters applied — all features visible
            </div>
          ):filters.map(f=>(
            <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,
              padding:"8px 10px",marginBottom:6,background:"var(--panel2)",
              border:"1px solid var(--border)",borderRadius:8}}>
              <span style={{flex:1,fontSize:11,color:"var(--text)"}}>
                <span style={{color:"var(--accent)",fontWeight:600}}>{f.field}</span>
                {" "}<span style={{color:"var(--text-muted)"}}>{f.op}</span>{" "}
                <span style={{color:"var(--success)"}}>"{f.val}"</span>
              </span>
              <button onClick={()=>remove(f.id)}
                style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",padding:2}}>
                <Icon name="x" size={13}/>
              </button>
            </div>
          ))}
        </div>
        {filters.length>0&&(
          <div style={{padding:"10px 16px",borderTop:"1px solid var(--border)",
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:"var(--text-muted)"}}>
              {filters.length} active filter{filters.length>1?"s":""}
            </span>
            <button onClick={()=>onFiltersChange([])}
              style={{fontSize:11,color:"var(--danger)",background:"none",border:"none",cursor:"pointer"}}>
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXPORT MODAL
═══════════════════════════════════════════════════════════ */
function ExportModal({ dashboardRef, mapDivRef, projectTitle, onClose }) {
  const [exporting, setExporting] = useState(false);
  const [done, setDone]           = useState("");

  const doExport = async (mode) => {
    setExporting(true); setDone("");
    try {
      const h2c = window.html2canvas;
      const jsPDF = window.jspdf?.jsPDF;
      let canvas;

      if (mode==="map") {
        canvas = await h2c(mapDivRef.current, { useCORS:true, allowTaint:true, scale:2 });
      } else {
        canvas = await h2c(dashboardRef.current, { useCORS:true, allowTaint:true, scale:2 });
      }

      if (mode==="pdf") {
        const pdf = new jsPDF({ orientation:"landscape", unit:"px", format:[canvas.width/2,canvas.height/2] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width/2, canvas.height/2);
        pdf.save(`${projectTitle||"geocore"}.pdf`);
      } else {
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `${projectTitle||"geocore"}_${mode}.png`;
        a.click();
      }
      setDone(mode);
    } catch(err) {
      console.error(err); alert("Export error: "+err.message);
    } finally { setExporting(false); }
  };

  const options = [
    { key:"map",       icon:"map",    label:"Map only",      desc:"Exports the map canvas as PNG" },
    { key:"dashboard", icon:"chart",  label:"Full dashboard", desc:"Exports map + sidebar as PNG" },
    { key:"pdf",       icon:"export", label:"PDF",            desc:"Full dashboard as PDF document" },
  ];

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",
      justifyContent:"center",background:"rgba(0,0,0,0.6)"}} onClick={onClose}>
      <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:14,
        width:360,boxShadow:"0 24px 64px var(--shadow)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"13px 16px",borderBottom:"1px solid var(--border)",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Icon name="export" size={14} color="var(--accent)"/>
            <span style={{fontSize:12,fontWeight:700,letterSpacing:"0.08em",color:"var(--text-muted)"}}>EXPORT</span>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)"}}>
            <Icon name="x" size={16}/>
          </button>
        </div>
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
          {options.map(opt=>(
            <button key={opt.key} onClick={()=>doExport(opt.key)} disabled={exporting}
              style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",
                background:done===opt.key?"var(--hover)":"var(--panel2)",
                border:`1px solid ${done===opt.key?"var(--success)":"var(--border)"}`,
                borderRadius:10,cursor:exporting?"not-allowed":"pointer",
                textAlign:"left",transition:"all 0.15s",width:"100%"}}>
              <div style={{width:36,height:36,borderRadius:8,background:"var(--panel3)",
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {done===opt.key
                  ?<Icon name="check" size={18} color="var(--success)"/>
                  :<Icon name={opt.icon} size={18} color="var(--accent)"/>
                }
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:2}}>{opt.label}</div>
                <div style={{fontSize:10,color:"var(--text-muted)"}}>{opt.desc}</div>
              </div>
              {exporting&&<div style={{marginLeft:"auto",width:14,height:14,border:"2px solid var(--accent)",
                borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
            </button>
          ))}
        </div>
        <div style={{padding:"10px 16px",borderTop:"1px solid var(--border)",fontSize:10,
          color:"var(--text-muted)",textAlign:"center"}}>
          Exports reflect exactly what you see on screen
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROJECTS LANDING PAGE
═══════════════════════════════════════════════════════════ */
function ProjectsPage({ onOpen, theme, onThemeToggle }) {
  const [projects,  setProjects]  = useState([]);
  const [creating,  setCreating]  = useState(false);
  const [newName,   setNewName]   = useState("");
  const [loading,   setLoading]   = useState(true);
  const [deleting,  setDeleting]  = useState(null);
  const isDark = theme==="dark";

  useEffect(()=>{
    dbGetAll().then(p=>{
      setProjects(p.sort((a,b)=>b.updatedAt-a.updatedAt));
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[]);

  const createProject = async () => {
    if(!newName.trim()) return;
    const proj = {
      id: Date.now()+"_"+Math.random().toString(36).slice(2),
      name: newName.trim(),
      createdAt: Date.now(), updatedAt: Date.now(),
      layers:[], chartField:"", chartType:"bar", basemap:"Satellite",
      colorMap:{}, shapeMap:{}, opacityMap:{}, filters:[],
      charts:[{id:"c1",field:"",type:"bar"}],
      logoUrl:null, showLabels:false,
    };
    await dbPut(proj);
    setProjects(p=>[proj,...p]);
    setNewName(""); setCreating(false);
    onOpen(proj);
  };

  const deleteProject = async (id, e) => {
    e.stopPropagation();
    if(!window.confirm("Delete this project? This cannot be undone.")) return;
    setDeleting(id);
    await dbDelete(id);
    setProjects(p=>p.filter(x=>x.id!==id));
    setDeleting(null);
  };

  const fmt = ts => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
  };

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",fontFamily:"'DM Mono','Courier New',monospace",color:"var(--text)"}}>
      {/* Nav */}
      <nav style={{height:56,background:"var(--panel)",borderBottom:"1px solid var(--border)",
        display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:32,height:32,borderRadius:8,background:"var(--accent)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Icon name="map" size={17} color="#0e0e0c"/>
          </div>
          <span style={{fontSize:15,fontWeight:700,letterSpacing:"0.04em"}}>
            GEO<span style={{color:"var(--accent)"}}>CORE</span>
          </span>
          <span style={{fontSize:10,color:"var(--text-muted)",letterSpacing:"0.1em",
            background:"var(--panel2)",border:"1px solid var(--border)",
            borderRadius:4,padding:"2px 8px"}}>v4</span>
        </div>
        <button onClick={onThemeToggle}
          style={{width:34,height:34,borderRadius:8,background:"var(--panel2)",
            border:"1px solid var(--border)",cursor:"pointer",display:"flex",
            alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>
          <Icon name={isDark?"sun":"moon"} size={15}/>
        </button>
      </nav>

      {/* Hero */}
      <div style={{padding:"64px 32px 40px",maxWidth:900,margin:"0 auto"}}>
        <div style={{marginBottom:40}}>
          <h1 style={{fontSize:32,fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.2,marginBottom:12}}>
            Mining GIS Dashboard
          </h1>
          <p style={{fontSize:14,color:"var(--text-muted)",lineHeight:1.7,maxWidth:520}}>
            Create and manage spatial data visualisation projects. Upload shapefiles, GeoJSON, or CSV data
            and build interactive maps with charts and analytics.
          </p>
        </div>

        {/* Create section */}
        <div style={{marginBottom:40}}>
          {creating?(
            <div style={{display:"flex",gap:10,alignItems:"center",maxWidth:480}}>
              <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")createProject();if(e.key==="Escape")setCreating(false);}}
                placeholder="Project name e.g. Exploration Zone A"
                style={{flex:1,background:"var(--panel)",border:"1px solid var(--accent)",
                  borderRadius:8,padding:"10px 14px",fontSize:13,color:"var(--text)",
                  fontFamily:"inherit",outline:"none"}}/>
              <button onClick={createProject}
                style={{height:40,padding:"0 20px",background:"var(--accent)",border:"none",
                  borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,color:"#0e0e0c",
                  fontFamily:"inherit"}}>
                CREATE
              </button>
              <button onClick={()=>setCreating(false)}
                style={{height:40,width:40,background:"transparent",border:"1px solid var(--border)",
                  borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                  color:"var(--text-muted)"}}>
                <Icon name="x" size={15}/>
              </button>
            </div>
          ):(
            <button onClick={()=>setCreating(true)}
              style={{display:"flex",alignItems:"center",gap:8,height:42,padding:"0 22px",
                background:"var(--accent)",border:"none",borderRadius:8,cursor:"pointer",
                fontSize:12,fontWeight:700,color:"#0e0e0c",fontFamily:"inherit",letterSpacing:"0.06em"}}>
              <Icon name="plus" size={15} color="#0e0e0c"/>
              NEW PROJECT
            </button>
          )}
        </div>

        {/* Projects grid */}
        {loading?(
          <div style={{display:"flex",alignItems:"center",gap:12,padding:40,
            fontSize:13,color:"var(--text-muted)"}}>
            <div style={{width:18,height:18,border:"2px solid var(--accent)",borderTopColor:"transparent",
              borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
            Loading projects…
          </div>
        ):projects.length===0?(
          <div style={{textAlign:"center",padding:"64px 32px",opacity:0.4}}>
            <Icon name="folder" size={48} color="var(--text-muted)"/>
            <div style={{marginTop:16,fontSize:14}}>No projects yet</div>
            <div style={{marginTop:6,fontSize:12,color:"var(--text-muted)"}}>Create your first project to get started</div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
            {projects.map(proj=>(
              <div key={proj.id} onClick={()=>onOpen(proj)}
                style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:12,
                  padding:"20px",cursor:"pointer",transition:"all 0.18s",position:"relative",
                  boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px var(--shadow)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.12)";}}>
                {/* Project icon */}
                <div style={{width:44,height:44,borderRadius:10,background:"var(--hover)",
                  border:"1px solid var(--border)",display:"flex",alignItems:"center",
                  justifyContent:"center",marginBottom:14}}>
                  <Icon name="map" size={20} color="var(--accent)"/>
                </div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:4,overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.name}</div>
                <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:12}}>
                  {proj.layers?.length||0} layer{proj.layers?.length!==1?"s":""} ·{" "}
                  Updated {fmt(proj.updatedAt)}
                </div>
                {/* Layer dots */}
                {proj.layers?.length>0&&(
                  <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
                    {proj.layers.slice(0,6).map((l,i)=>(
                      <div key={i} style={{width:8,height:8,borderRadius:"50%",background:l.color||PALETTE[i%PALETTE.length]}}/>
                    ))}
                    {proj.layers.length>6&&<span style={{fontSize:9,color:"var(--text-muted)"}}>+{proj.layers.length-6}</span>}
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,color:"var(--accent)",fontWeight:600,letterSpacing:"0.06em"}}>
                    OPEN →
                  </span>
                  <button onClick={e=>deleteProject(proj.id,e)}
                    disabled={deleting===proj.id}
                    style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",
                      padding:4,opacity:0.5,transition:"opacity 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                    onMouseLeave={e=>e.currentTarget.style.opacity="0.5"}>
                    <Icon name="trash" size={13}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{borderTop:"1px solid var(--border)",padding:"20px 32px",
        textAlign:"center",fontSize:10,color:"var(--text-muted)",letterSpacing:"0.08em"}}>
        GEOCORE v4 · All data stored locally in your browser · No login required
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD  (main app)
═══════════════════════════════════════════════════════════ */
function Dashboard({ project: initialProject, onBack, theme, onThemeToggle }) {
  /* ── refs ── */
  const mapRef        = useRef(null);
  const mapDivRef     = useRef(null);
  const tileRef       = useRef(null);
  const geoLayerRef   = useRef(null);
  const labelLayerRef = useRef(null);
  const measureRef    = useRef(null);
  const boundsTimer   = useRef(null);
  const saveTimer     = useRef(null);
  const dashRef       = useRef(null);

  /* ── project state ── */
  const [project,      setProject]      = useState(initialProject);
  const [layers,       setLayers]       = useState(initialProject.layers||[]);
  const [activeLayer,  setActiveLayer]  = useState(initialProject.layers?.[0]||null);
  const [visibleFeats, setVisibleFeats] = useState([]);
  const [featureCount, setFeatureCount] = useState(0);
  const [filters,      setFilters]      = useState(initialProject.filters||[]);

  /* analytics - support multiple chart panels */
  const [charts, setCharts] = useState(
    initialProject.charts?.length ? initialProject.charts
    : [{id:"c1", field:initialProject.chartField||"", type:initialProject.chartType||"bar"}]
  );

  /* symbology */
  const [colorMap,   setColorMap]   = useState(initialProject.colorMap||{});
  const [shapeMap,   setShapeMap]   = useState(initialProject.shapeMap||{});
  const [opacityMap, setOpacityMap] = useState(initialProject.opacityMap||{});

  /* ui */
  const [basemap,      setBasemap]      = useState(initialProject.basemap||"Satellite");
  const [projectTitle, setProjectTitle] = useState(initialProject.name||"Untitled");
  const [editTitle,    setEditTitle]    = useState(false);
  const [logoUrl,      setLogoUrl]      = useState(initialProject.logoUrl||null);
  const [loading,      setLoading]      = useState(false);
  const [loadMsg,      setLoadMsg]      = useState("");
  const [saving,       setSaving]       = useState(false);
  const [sideOpen,     setSideOpen]     = useState(true);
  const [basemapOpen,  setBasemapOpen]  = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [symbolEditorOpen, setSymbolEditorOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen]   = useState(false);
  const [exportOpen,   setExportOpen]   = useState(false);
  const [measureMode,  setMeasureMode]  = useState(null); // null | "distance" | "area"
  const [measureResult,setMeasureResult]= useState("");
  const [showLabels,   setShowLabels]   = useState(initialProject.showLabels||false);
  const [labelField,   setLabelField]   = useState(initialProject.labelField||"");
  const [coordDisplay, setCoordDisplay] = useState("---, ---");
  const [activeChartField, setActiveChartField] = useState(charts[0]?.field||"");

  const logoInputRef = useRef(null);
  const isDark = theme==="dark";

  /* ── CSS vars ── */
  useEffect(()=>{
    const vars=THEMES[theme];
    Object.entries(vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  },[theme]);

  /* ── Inject global CSS ── */
  useEffect(()=>{
    if(document.getElementById("geocore-css")) return;
    const el=document.createElement("style");
    el.id="geocore-css";
    el.textContent=`
      *{box-sizing:border-box;margin:0;padding:0}
      body,html,#root{height:100%;width:100%;overflow:hidden}
      .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:transparent!important;box-shadow:none!important}
      .leaflet-popup-content{margin:0!important}
      .leaflet-control-zoom{border:1px solid var(--border)!important;border-radius:8px!important;overflow:hidden}
      .leaflet-control-zoom a{background:var(--panel)!important;color:var(--text)!important;border-bottom:1px solid var(--border)!important}
      .leaflet-control-zoom a:hover{background:var(--panel2)!important}
      .leaflet-bar{border:none!important}
      .geo-div-icon{background:none!important;border:none!important}
      .geo-label{background:transparent!important;border:none!important;box-shadow:none!important}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#44443f;border-radius:4px}
      input[type=range]{-webkit-appearance:none;width:100%;height:3px;border-radius:3px;background:var(--border);outline:none}
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--accent);cursor:pointer}
      @keyframes spin{to{transform:rotate(360deg)}}
      .leaflet-draw-toolbar a{background-color:var(--panel)!important;color:var(--text)!important;}
    `;
    document.head.appendChild(el);
  },[]);

  /* ── Auto-save to IndexedDB (debounced 2s) ── */
  const saveProject = useCallback(async (patch={}) => {
    setSaving(true);
    const data = {
      ...project, ...patch,
      name:projectTitle, layers, filters, charts,
      colorMap, shapeMap, opacityMap,
      basemap, logoUrl, showLabels, labelField,
      updatedAt: Date.now(),
    };
    try { await dbPut(data); } catch(e){ console.error("Save failed",e); }
    finally { setSaving(false); }
  },[project,projectTitle,layers,filters,charts,colorMap,shapeMap,opacityMap,basemap,logoUrl,showLabels,labelField]);

  useEffect(()=>{
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>saveProject(),2000);
  },[layers,filters,charts,colorMap,shapeMap,opacityMap,basemap,projectTitle,showLabels,labelField]);

  /* ── Init Leaflet ── */
  useEffect(()=>{
    if(!mapDivRef.current||mapRef.current) return;
    const L=window.L;
    const map=L.map(mapDivRef.current,{center:[0,20],zoom:3,zoomControl:false,preferCanvas:true});
    tileRef.current=L.tileLayer(BASEMAPS[basemap],{maxZoom:20}).addTo(map);
    mapRef.current=map;

    // Scale bar
    L.control.scale({imperial:false,position:"bottomleft"}).addTo(map);

    // Coordinate display
    map.on("mousemove",e=>{
      setCoordDisplay(`${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
    });

    // Bounds change
    map.on("moveend zoomend",()=>{
      clearTimeout(boundsTimer.current);
      boundsTimer.current=setTimeout(()=>updateVisible(map.getBounds()),130);
    });
  },[]);

  /* ── Basemap switch ── */
  useEffect(()=>{
    if(!mapRef.current||!tileRef.current) return;
    tileRef.current.remove();
    tileRef.current=window.L.tileLayer(BASEMAPS[basemap],{maxZoom:20}).addTo(mapRef.current);
  },[basemap]);

  /* ── Measure tool ── */
  useEffect(()=>{
    if(!mapRef.current) return;
    const L=window.L; const map=mapRef.current;
    if(measureRef.current){map.off("click",measureRef.current.handler);if(measureRef.current.layer)measureRef.current.layer.remove();}
    if(!measureMode){setMeasureResult("");measureRef.current=null;return;}

    const pts=[]; let layer=null;
    const handler=e=>{
      pts.push(e.latlng);
      if(layer) layer.remove();
      if(measureMode==="distance"){
        layer=L.polyline(pts,{color:"#E8B84B",weight:2.5,dashArray:"6 4"}).addTo(map);
        if(pts.length>1){
          let d=0;for(let i=1;i<pts.length;i++) d+=pts[i-1].distanceTo(pts[i]);
          setMeasureResult(d>1000?`${(d/1000).toFixed(2)} km`:`${d.toFixed(0)} m`);
        }
      } else {
        layer=L.polygon(pts,{color:"#E8B84B",weight:2,fillColor:"#E8B84B",fillOpacity:0.15}).addTo(map);
        if(pts.length>2){
          const area=L.GeometryUtil?.geodesicArea?.(pts)||0;
          setMeasureResult(area>1000000?`${(area/1000000).toFixed(3)} km²`:`${area.toFixed(0)} m²`);
        }
      }
      measureRef.current={...measureRef.current,layer};
    };
    map.on("click",handler);
    measureRef.current={handler,layer:null,pts};
    map.getContainer().style.cursor="crosshair";
    return ()=>{ map.off("click",handler); map.getContainer().style.cursor=""; if(layer)layer.remove(); };
  },[measureMode]);

  /* ── Filter features ── */
  const applyFilters = useCallback((features) => {
    if(!filters.length) return features;
    return features.filter(f=>{
      return filters.every(fi=>{
        const val=String(f.properties?.[fi.field]??"");
        if(fi.op==="=")        return val===fi.val;
        if(fi.op==="≠")        return val!==fi.val;
        if(fi.op==="contains") return val.toLowerCase().includes(fi.val.toLowerCase());
        if(fi.op==="starts")   return val.toLowerCase().startsWith(fi.val.toLowerCase());
        return true;
      });
    });
  },[filters]);

  /* ── Visible features ── */
  const updateVisible=useCallback((bounds)=>{
    if(!activeLayer?.geojson) return;
    const raw=(activeLayer.geojson.features||[]).filter(f=>{
      if(!f.geometry) return false;
      const c=f.geometry.coordinates,gt=f.geometry.type;
      if(gt==="Point")          return bounds.contains([c[1],c[0]]);
      if(gt==="MultiPoint")     return c.some(p=>bounds.contains([p[1],p[0]]));
      if(gt==="LineString")     return c.some(p=>bounds.contains([p[1],p[0]]));
      if(gt==="MultiLineString")return c.flat().some(p=>bounds.contains([p[1],p[0]]));
      if(gt==="Polygon")        return c[0].some(p=>bounds.contains([p[1],p[0]]));
      if(gt==="MultiPolygon")   return c.flat(2).some(p=>bounds.contains([p[1],p[0]]));
      return true;
    });
    const filtered=applyFilters(raw);
    setVisibleFeats(filtered);
    setFeatureCount(filtered.length);
  },[activeLayer,applyFilters]);

  useEffect(()=>{
    if(!mapRef.current||!activeLayer){setVisibleFeats([]);setFeatureCount(0);return;}
    updateVisible(mapRef.current.getBounds());
  },[activeLayer,updateVisible,filters]);

  /* ── Auto colorMap + shapeMap on field change ── */
  const primaryField = charts[0]?.field || "";
  useEffect(()=>{
    if(!activeLayer?.geojson||!primaryField) return;
    const vals=[...new Set((activeLayer.geojson.features||[]).map(f=>String(f.properties?.[primaryField]??"N/A")))];
    setColorMap(prev=>{const n={};vals.forEach((v,i)=>{n[v]=prev[v]||PALETTE[i%PALETTE.length];});return n;});
    setShapeMap(prev=>{const n={};vals.forEach((v,i)=>{n[v]=prev[v]||SHAPES[i%SHAPES.length];});return n;});
    setOpacityMap(prev=>{const n={};vals.forEach(v=>{n[v]=prev[v]??0.7;});return n;});
  },[activeLayer,primaryField]);

  /* ── Redraw map layer ── */
  useEffect(()=>{
    if(!mapRef.current) return;
    const L=window.L;
    if(geoLayerRef.current){geoLayerRef.current.remove();geoLayerRef.current=null;}
    if(labelLayerRef.current){labelLayerRef.current.remove();labelLayerRef.current=null;}

    const vis=layers.filter(l=>l.visible);
    if(!vis.length) return;

    const allFeatures=vis.flatMap(l=>(l.geojson?.features||[]).map(f=>({...f,_lid:l.id,_lcolor:l.color})));
    const toRender=applyFilters(allFeatures);

    geoLayerRef.current=L.geoJSON({type:"FeatureCollection",features:toRender},{
      style:f=>{
        const val=primaryField&&f.properties?.[primaryField]?String(f.properties[primaryField]):null;
        const col=(val&&colorMap[val])||f._lcolor||"#E8B84B";
        const opacity=val?(opacityMap[val]??0.7):0.7;
        return{color:col,weight:2.2,fillColor:col,fillOpacity:opacity,opacity:0.9};
      },
      pointToLayer:(f,latlng)=>{
        const val=primaryField&&f.properties?.[primaryField]?String(f.properties[primaryField]):null;
        const col=(val&&colorMap[val])||f._lcolor||"#E8B84B";
        const shape=(val&&shapeMap[val])||"circle";
        return L.marker(latlng,{
          icon:L.divIcon({html:makeIconSVG(shape,col,16),className:"geo-div-icon",iconSize:[16,16],iconAnchor:[8,8]}),
        });
      },
      onEachFeature:(f,layer)=>{
        const props=f.properties||{};
        const rows=Object.entries(props).slice(0,12).map(([k,v])=>
          `<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #252523">
            <span style="color:#888;min-width:90px;font-size:10px;flex-shrink:0">${k}</span>
            <span style="color:#ccc;font-size:10px;word-break:break-all">${String(v)}</span>
          </div>`
        ).join("");
        layer.bindPopup(
          `<div style="background:#1a1a18;border:1px solid #333;border-radius:8px;padding:12px;min-width:220px;font-family:monospace">
            <div style="color:#E8B84B;font-weight:700;margin-bottom:8px;font-size:11px;letter-spacing:.08em">FEATURE PROPERTIES</div>
            ${rows}
          </div>`,{maxWidth:300,className:"geo-popup"}
        );
      },
    }).addTo(mapRef.current);

    /* Labels */
    if(showLabels&&labelField) {
      const labelLayer=L.layerGroup();
      toRender.forEach(f=>{
        const lbl=f.properties?.[labelField];
        if(!lbl) return;
        let latlng=null;
        try {
          const gt=f.geometry.type;
          if(gt==="Point") latlng=L.latLng(f.geometry.coordinates[1],f.geometry.coordinates[0]);
          else if(gt==="Polygon") latlng=L.geoJSON(f).getBounds().getCenter();
          else if(gt==="MultiPolygon") latlng=L.geoJSON(f).getBounds().getCenter();
        } catch{}
        if(!latlng) return;
        L.marker(latlng,{
          icon:L.divIcon({
            html:`<div style="background:rgba(14,14,12,0.82);color:#E8B84B;font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap;border:1px solid rgba(232,184,75,0.3);font-family:monospace;pointer-events:none">${lbl}</div>`,
            className:"geo-label",iconAnchor:[0,-10],
          }),
          interactive:false,
        }).addTo(labelLayer);
      });
      labelLayer.addTo(mapRef.current);
      labelLayerRef.current=labelLayer;
    }
  },[layers,colorMap,shapeMap,opacityMap,primaryField,showLabels,labelField,applyFilters]);

  /* ── Fit bounds on new layer ── */
  useEffect(()=>{
    if(!mapRef.current||!activeLayer?.geojson?.features?.length) return;
    try{const b=window.L.geoJSON(activeLayer.geojson).getBounds();if(b.isValid())mapRef.current.fitBounds(b,{padding:[40,40]});}catch{}
  },[activeLayer?.id]);

  /* ── File processing ── */
  const processFile=async(file)=>{
    const ext=file.name.split(".").pop().toLowerCase();
    const name=file.name.replace(/\.[^.]+$/,"");
    setLoadMsg(`Parsing ${file.name}…`);
    let geojson;
    if(ext==="zip"){
      geojson=await window.shp(await file.arrayBuffer());
    } else if(ext==="geojson"||ext==="json"){
      geojson=JSON.parse(await file.text());
    } else if(ext==="csv"){
      const res=window.Papa.parse(await file.text(),{header:true,dynamicTyping:true,skipEmptyLines:true});
      const latK=["lat","latitude","y","LAT","LATITUDE"].find(k=>res.meta.fields?.includes(k));
      const lonK=["lon","lng","longitude","x","LON","LNG","LONGITUDE"].find(k=>res.meta.fields?.includes(k));
      if(!latK||!lonK) throw new Error("CSV needs lat/lon columns");
      geojson={type:"FeatureCollection",features:res.data.filter(d=>d[latK]&&d[lonK]).map(d=>({
        type:"Feature",properties:d,geometry:{type:"Point",coordinates:[+d[lonK],+d[latK]]},
      }))};
    } else throw new Error("Unsupported: "+ext);

    // Strip geometry from serialized layer (store only properties for IndexedDB size limit)
    const stripped={...geojson,features:geojson.features.map(f=>({...f}))};
    return{id:Date.now()+Math.random(),name,geojson:stripped,visible:true,color:PALETTE[layers.length%PALETTE.length]};
  };

  const handleUpload=async(e)=>{
    const files=Array.from(e.target.files);
    if(!files.length) return;
    setLoading(true);
    try{
      for(const file of files){
        const layer=await processFile(file);
        setLayers(prev=>{
          const next=[...prev,layer];
          setActiveLayer(layer);
          const f0=Object.keys(layer.geojson?.features?.[0]?.properties||{})[0];
          if(f0){
            setCharts(prev2=>prev2.map((c,i)=>i===0?{...c,field:f0}:c));
            setLabelField(f0);
          }
          return next;
        });
      }
    }catch(err){alert("Error: "+err.message);}
    finally{setLoading(false);setLoadMsg("");e.target.value="";}
  };

  const toggleLayer=id=>setLayers(prev=>prev.map(l=>l.id===id?{...l,visible:!l.visible}:l));
  const removeLayer=id=>{setLayers(prev=>{const next=prev.filter(l=>l.id!==id);if(activeLayer?.id===id)setActiveLayer(next[0]||null);return next;});};

  const addChart=()=>{
    if(charts.length>=3) return;
    const f=Object.keys(activeLayer?.geojson?.features?.[0]?.properties||{})[0]||"";
    setCharts(prev=>[...prev,{id:"c"+Date.now(),field:f,type:"bar"}]);
  };
  const removeChart=id=>setCharts(prev=>prev.filter(c=>c.id!==id));
  const updateChart=(id,patch)=>setCharts(prev=>prev.map(c=>c.id===id?{...c,...patch}:c));

  const fields=useMemo(()=>Object.keys(activeLayer?.geojson?.features?.[0]?.properties||{}),[activeLayer]);
  const totalFeatures=useMemo(()=>layers.filter(l=>l.visible).reduce((s,l)=>s+(l.geojson?.features?.length||0),0),[layers]);

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <div ref={dashRef} style={{display:"flex",flexDirection:"column",height:"100vh",
      background:"var(--bg)",fontFamily:"'DM Mono','Courier New',monospace",
      color:"var(--text)",transition:"background 0.2s,color 0.2s"}}>

      {/* ═══ TOPBAR ═══ */}
      <header style={{height:52,background:"var(--panel)",borderBottom:"1px solid var(--border)",
        display:"flex",alignItems:"center",padding:"0 12px",flexShrink:0,zIndex:100,gap:10}}>

        {/* Back */}
        <button onClick={onBack} title="Back to projects"
          style={{width:32,height:32,borderRadius:7,background:"var(--panel2)",
            border:"1px solid var(--border)",cursor:"pointer",display:"flex",
            alignItems:"center",justifyContent:"center",color:"var(--text-muted)",flexShrink:0}}>
          <Icon name="back" size={15}/>
        </button>

        {/* Logo */}
        <div onClick={()=>logoInputRef.current?.click()} style={{cursor:"pointer",flexShrink:0}}>
          {logoUrl
            ?<img src={logoUrl} alt="logo" style={{height:30,maxWidth:80,objectFit:"contain",borderRadius:4}}/>
            :<div style={{width:30,height:30,borderRadius:6,border:"1px dashed var(--border)",
                display:"flex",alignItems:"center",justifyContent:"center",opacity:0.4}}>
                <Icon name="image" size={13} color="var(--text-muted)"/>
              </div>
          }
          <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={e=>{
            const f=e.target.files?.[0];if(f)setLogoUrl(URL.createObjectURL(f));
          }}/>
        </div>

        <div style={{width:1,height:22,background:"var(--border)",flexShrink:0}}/>

        {/* Title */}
        {editTitle
          ?<input autoFocus value={projectTitle} onChange={e=>setProjectTitle(e.target.value)}
              onBlur={()=>setEditTitle(false)} onKeyDown={e=>e.key==="Enter"&&setEditTitle(false)}
              style={{background:"transparent",border:"none",outline:"none",color:"var(--text)",
                fontFamily:"inherit",fontSize:13,fontWeight:600,letterSpacing:"0.04em",width:220}}/>
          :<span onClick={()=>setEditTitle(true)} title="Click to edit"
              style={{fontSize:13,fontWeight:600,letterSpacing:"0.04em",cursor:"text",
                color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:240}}>
              {projectTitle}
            </span>
        }

        {/* Save indicator */}
        {saving&&<span style={{fontSize:9,color:"var(--text-muted)",letterSpacing:"0.08em",flexShrink:0}}>SAVING…</span>}

        {/* Stats */}
        <div style={{display:"flex",gap:20,alignItems:"center",marginLeft:"auto"}}>
          {[["Layers",layers.length],["Features",totalFeatures.toLocaleString()],["Visible",featureCount.toLocaleString()]].map(([lbl,val])=>(
            <div key={lbl} style={{textAlign:"center"}}>
              <div style={{fontSize:15,fontWeight:700,color:"var(--accent)",lineHeight:1}}>{val}</div>
              <div style={{fontSize:8,color:"var(--text-muted)",letterSpacing:"0.1em",marginTop:1}}>{lbl.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Right actions */}
        <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:"auto",flexShrink:0}}>
          {loading&&(
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"var(--text-muted)"}}>
              <div style={{width:13,height:13,border:"2px solid var(--accent)",borderTopColor:"transparent",
                borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
              {loadMsg}
            </div>
          )}
          <button onClick={onThemeToggle}
            style={{width:32,height:32,borderRadius:7,background:"var(--panel2)",border:"1px solid var(--border)",
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>
            <Icon name={isDark?"sun":"moon"} size={14}/>
          </button>
          <button onClick={()=>setExportOpen(true)}
            style={{height:32,padding:"0 12px",borderRadius:7,background:"var(--panel2)",
              border:"1px solid var(--border)",cursor:"pointer",display:"flex",alignItems:"center",
              gap:5,color:"var(--text)",fontSize:10,fontFamily:"inherit",fontWeight:600}}>
            <Icon name="export" size={13}/> EXPORT
          </button>
          <button onClick={()=>setLayerPanelOpen(p=>!p)}
            style={{height:32,padding:"0 12px",borderRadius:7,
              background:layerPanelOpen?"var(--panel2)":"transparent",
              border:"1px solid var(--border)",cursor:"pointer",display:"flex",alignItems:"center",
              gap:5,color:"var(--text)",fontSize:10,fontFamily:"inherit",fontWeight:600}}>
            <Icon name="layers" size={13}/> LAYERS
          </button>
          <label style={{display:"flex",alignItems:"center",gap:5,background:"var(--accent)",
            color:"#0e0e0c",padding:"0 12px",height:32,borderRadius:7,cursor:"pointer",
            fontSize:10,fontWeight:700,letterSpacing:"0.07em",whiteSpace:"nowrap"}}>
            <Icon name="upload" size={13} color="#0e0e0c"/> ADD DATA
            <input type="file" multiple hidden accept=".zip,.geojson,.json,.csv" onChange={handleUpload}/>
          </label>
        </div>
      </header>

      {/* ═══ BODY ═══ */}
      <div style={{display:"flex",flex:1,overflow:"hidden",position:"relative"}}>

        {/* ── SIDEBAR ── */}
        <div style={{width:sideOpen?330:0,minWidth:0,transition:"width 0.28s ease",
          background:"var(--panel)",borderRight:"1px solid var(--border)",
          display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
          <div style={{width:330,height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Sidebar header */}
            <div style={{padding:"9px 14px",borderBottom:"1px solid var(--border)",
              display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <Icon name="chart" size={13} color="var(--accent)"/>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"var(--text-muted)"}}>ANALYTICS</span>
              </div>
              <div style={{display:"flex",gap:5}}>
                {Object.keys(colorMap).length>0&&(
                  <button onClick={()=>setSymbolEditorOpen(true)}
                    style={{display:"flex",alignItems:"center",gap:4,background:"var(--panel2)",
                      border:"1px solid var(--border)",borderRadius:5,padding:"3px 8px",
                      cursor:"pointer",fontSize:9,color:"var(--text-muted)",fontFamily:"inherit"}}>
                    <Icon name="palette" size={11}/> SYMBOLS
                  </button>
                )}
                {activeLayer&&(
                  <button onClick={()=>setFilterPanelOpen(true)}
                    style={{display:"flex",alignItems:"center",gap:4,
                      background:filters.length?"var(--accent)":"var(--panel2)",
                      border:`1px solid ${filters.length?"var(--accent)":"var(--border)"}`,
                      borderRadius:5,padding:"3px 8px",cursor:"pointer",
                      fontSize:9,color:filters.length?"#0e0e0c":"var(--text-muted)",fontFamily:"inherit"}}>
                    <Icon name="filter" size={11} color={filters.length?"#0e0e0c":"var(--text-muted)"}/>
                    {filters.length?`${filters.length} FILTER`:"FILTER"}
                  </button>
                )}
              </div>
            </div>

            {/* Layer selector */}
            {layers.length>0&&(
              <div style={{padding:"8px 14px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
                <label style={{fontSize:9,color:"var(--text-muted)",letterSpacing:"0.1em",display:"block",marginBottom:4}}>ACTIVE LAYER</label>
                <select value={activeLayer?.id||""}
                  onChange={e=>{const l=layers.find(x=>String(x.id)===e.target.value);if(l){setActiveLayer(l);const f0=Object.keys(l.geojson?.features?.[0]?.properties||{})[0];if(f0)setCharts(p=>p.map((c,i)=>i===0?{...c,field:f0}:c));}}}
                  style={{width:"100%",background:"var(--panel2)",border:"1px solid var(--border)",
                    color:"var(--text)",borderRadius:6,padding:"6px 10px",fontSize:11,fontFamily:"inherit"}}>
                  {layers.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}

            {/* Labels */}
            {activeLayer&&fields.length>0&&(
              <div style={{padding:"7px 14px",borderBottom:"1px solid var(--border)",
                display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                <button onClick={()=>setShowLabels(p=>!p)}
                  style={{display:"flex",alignItems:"center",gap:5,background:showLabels?"var(--hover)":"transparent",
                    border:`1px solid ${showLabels?"var(--accent)":"var(--border)"}`,borderRadius:5,
                    padding:"3px 8px",cursor:"pointer",fontSize:9,
                    color:showLabels?"var(--accent)":"var(--text-muted)",fontFamily:"inherit",flexShrink:0}}>
                  <Icon name="label" size={11} color={showLabels?"var(--accent)":"var(--text-muted)"}/>
                  LABELS
                </button>
                {showLabels&&(
                  <select value={labelField} onChange={e=>setLabelField(e.target.value)}
                    style={{flex:1,background:"var(--panel2)",border:"1px solid var(--border)",
                      color:"var(--text)",borderRadius:5,padding:"4px 8px",fontSize:10,fontFamily:"inherit"}}>
                    {fields.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Chart panels */}
            <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
              {!activeLayer?(
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
                  justifyContent:"center",opacity:0.28,gap:14,padding:32,height:"100%"}}>
                  <Icon name="db" size={40} color="var(--text-muted)"/>
                  <div style={{textAlign:"center",fontSize:11,lineHeight:1.7,color:"var(--text-muted)"}}>
                    Upload a shapefile, GeoJSON<br/>or CSV to begin
                  </div>
                </div>
              ):(
                <>
                  {charts.map((chart,ci)=>(
                    <div key={chart.id} style={{borderBottom:"1px solid var(--border)",padding:"10px 14px"}}>
                      {/* Chart controls */}
                      <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
                        <select value={chart.field} onChange={e=>updateChart(chart.id,{field:e.target.value})}
                          style={{flex:1,background:"var(--panel2)",border:"1px solid var(--border)",
                            color:"var(--text)",borderRadius:5,padding:"5px 8px",fontSize:10,fontFamily:"inherit"}}>
                          <option value="">— select field —</option>
                          {fields.map(f=><option key={f} value={f}>{f}</option>)}
                        </select>
                        <select value={chart.type} onChange={e=>updateChart(chart.id,{type:e.target.value})}
                          style={{background:"var(--panel2)",border:"1px solid var(--border)",color:"var(--text)",
                            borderRadius:5,padding:"5px 6px",fontSize:10,fontFamily:"inherit",width:66}}>
                          {["bar","pie","donut","line","area","table"].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                        {charts.length>1&&(
                          <button onClick={()=>removeChart(chart.id)}
                            style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:3}}>
                            <Icon name="x" size={13}/>
                          </button>
                        )}
                      </div>
                      {/* Chart or table */}
                      {chart.type==="table"
                        ?<TablePanel data={visibleFeats} field={chart.field} colorMap={colorMap}/>
                        :<ChartPanel data={visibleFeats} field={chart.field} chartType={chart.type}
                            colorMap={colorMap} isDark={isDark} height={200}/>
                      }
                    </div>
                  ))}

                  {/* Add chart button */}
                  {charts.length<3&&(
                    <button onClick={addChart}
                      style={{width:"100%",padding:"10px 14px",background:"transparent",
                        border:"none",borderBottom:"1px solid var(--border)",cursor:"pointer",
                        display:"flex",alignItems:"center",gap:6,color:"var(--text-muted)",
                        fontSize:10,fontFamily:"inherit",justifyContent:"center"}}>
                      <Icon name="plus" size={12}/> ADD CHART PANEL
                    </button>
                  )}

                  {/* Legend */}
                  {Object.keys(colorMap).length>0&&(
                    <div style={{padding:"10px 14px"}}>
                      <div style={{fontSize:9,color:"var(--text-muted)",letterSpacing:"0.1em",marginBottom:7}}>
                        LEGEND — {primaryField}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {Object.entries(colorMap).map(([val,col])=>{
                          const shape=shapeMap[val]||"circle";
                          const cnt=visibleFeats.filter(f=>String(f.properties?.[primaryField])===val).length;
                          return(
                            <div key={val} style={{display:"flex",alignItems:"center",gap:7,fontSize:11}}>
                              <span dangerouslySetInnerHTML={{__html:makeIconSVG(shape,col,12)}}
                                style={{flexShrink:0,display:"flex",alignItems:"center"}}/>
                              <span style={{color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",
                                whiteSpace:"nowrap",flex:1,fontSize:10}}>{val}</span>
                              <span style={{color:"var(--text-muted)",fontSize:9,flexShrink:0}}>{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sidebar footer */}
            <div style={{borderTop:"1px solid var(--border)",padding:"6px 14px",flexShrink:0,
              fontSize:9,color:"var(--text-muted)",display:"flex",justifyContent:"space-between"}}>
              <span>{featureCount.toLocaleString()} visible / {totalFeatures.toLocaleString()}</span>
              <span style={{color:"var(--accent)"}}>GEOCORE v4</span>
            </div>
          </div>
        </div>

        {/* ── MAP ── */}
        <div style={{flex:1,position:"relative",overflow:"hidden"}}>
          <div ref={mapDivRef} style={{width:"100%",height:"100%"}}/>

          {/* Map toolbar (top-left) */}
          <div style={{position:"absolute",left:12,top:12,zIndex:500,display:"flex",gap:6}}>
            {/* Sidebar toggle */}
            <button onClick={()=>setSideOpen(p=>!p)}
              style={{width:32,height:32,background:"var(--panel)",border:"1px solid var(--border)",
                borderRadius:7,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                color:"var(--text-muted)"}}>
              <Icon name={sideOpen?"chevU":"chevD"} size={15}/>
            </button>

            {/* Basemap picker */}
            <div style={{position:"relative"}}>
              <button onClick={()=>setBasemapOpen(p=>!p)}
                style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:7,
                  height:32,padding:"0 10px",cursor:"pointer",display:"flex",alignItems:"center",
                  gap:5,color:"var(--text)",fontSize:10,fontFamily:"inherit",fontWeight:600}}>
                <Icon name="map" size={12} color="var(--accent)"/> {basemap} <Icon name="chevD" size={11}/>
              </button>
              {basemapOpen&&(
                <div style={{position:"absolute",top:36,left:0,background:"var(--panel)",
                  border:"1px solid var(--border)",borderRadius:8,overflow:"hidden",
                  boxShadow:"0 8px 24px var(--shadow)",zIndex:600,minWidth:130}}>
                  {Object.keys(BASEMAPS).map(name=>(
                    <button key={name} onClick={()=>{setBasemap(name);setBasemapOpen(false);}}
                      style={{display:"block",width:"100%",padding:"8px 14px",textAlign:"left",
                        background:basemap===name?"var(--hover)":"transparent",
                        color:basemap===name?"var(--accent)":"var(--text)",
                        fontSize:11,border:"none",borderBottom:"1px solid var(--border)",
                        cursor:"pointer",fontFamily:"inherit"}}>
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Measure tools */}
            {[
              {mode:"distance",label:"Distance",icon:"ruler"},
              {mode:"area",    label:"Area",    icon:"filter"},
            ].map(m=>(
              <button key={m.mode} onClick={()=>setMeasureMode(p=>p===m.mode?null:m.mode)}
                title={`Measure ${m.label}`}
                style={{height:32,padding:"0 10px",background:measureMode===m.mode?"var(--accent)":"var(--panel)",
                  border:`1px solid ${measureMode===m.mode?"var(--accent)":"var(--border)"}`,
                  borderRadius:7,cursor:"pointer",display:"flex",alignItems:"center",gap:5,
                  color:measureMode===m.mode?"#0e0e0c":"var(--text-muted)",
                  fontSize:10,fontFamily:"inherit",fontWeight:600}}>
                <Icon name={m.icon} size={12} color={measureMode===m.mode?"#0e0e0c":"var(--text-muted)"}/>
                {m.label}
              </button>
            ))}
          </div>

          {/* Measure result bubble */}
          {measureResult&&(
            <div style={{position:"absolute",left:"50%",top:60,transform:"translateX(-50%)",zIndex:500,
              background:"var(--panel)",border:"1px solid var(--accent)",borderRadius:8,
              padding:"8px 16px",fontSize:13,fontWeight:700,color:"var(--accent)",
              boxShadow:"0 4px 16px var(--shadow)"}}>
              {measureResult}
              <button onClick={()=>{setMeasureResult("");setMeasureMode(null);}}
                style={{marginLeft:12,background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)"}}>
                <Icon name="x" size={13}/>
              </button>
            </div>
          )}

          {/* Measure instruction */}
          {measureMode&&!measureResult&&(
            <div style={{position:"absolute",left:"50%",top:60,transform:"translateX(-50%)",zIndex:500,
              background:"rgba(14,14,12,0.88)",border:"1px solid var(--border)",borderRadius:8,
              padding:"7px 14px",fontSize:11,color:"var(--text-muted)"}}>
              {measureMode==="distance"?"Click to add points · ":"Click ≥3 points to measure area · "}
              Click again to continue
            </div>
          )}

          {/* Zoom + home (right) */}
          <div style={{position:"absolute",right:14,bottom:44,zIndex:500,display:"flex",flexDirection:"column",gap:5}}>
            {[["zIn",()=>mapRef.current?.zoomIn()],["zOut",()=>mapRef.current?.zoomOut()],
              ["home",()=>mapRef.current?.setView([0,20],3)]].map(([ic,fn])=>(
              <button key={ic} onClick={fn}
                style={{width:32,height:32,borderRadius:7,background:"var(--panel)",
                  border:"1px solid var(--border)",cursor:"pointer",display:"flex",
                  alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>
                <Icon name={ic} size={14}/>
              </button>
            ))}
          </div>

          {/* Coordinate + attribution bar */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:26,
            background:"rgba(14,14,12,0.78)",borderTop:"1px solid var(--border)",
            display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"0 12px",zIndex:499,fontSize:10,fontFamily:"monospace"}}>
            <span style={{color:"var(--text-muted)"}}>📍 {coordDisplay}</span>
            <span style={{color:"rgba(128,128,128,0.6)"}}>
              {["Satellite","Hybrid"].includes(basemap)?"© Google":"© OpenStreetMap contributors"}
            </span>
          </div>

          {/* Empty state */}
          {!layers.length&&(
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
              justifyContent:"center",pointerEvents:"none",zIndex:400}}>
              <div style={{background:isDark?"rgba(14,14,12,0.9)":"rgba(238,234,226,0.95)",
                border:"1px solid var(--border)",borderRadius:16,padding:"32px 48px",textAlign:"center"}}>
                <Icon name="map" size={44} color="var(--accent)"/>
                <div style={{marginTop:16,fontSize:15,fontWeight:700,letterSpacing:"0.04em"}}>No data loaded</div>
                <div style={{marginTop:8,fontSize:11,color:"var(--text-muted)",lineHeight:1.7}}>
                  Upload shapefile (.zip), GeoJSON or CSV<br/>using ADD DATA above
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── LAYER PANEL ── */}
        {layerPanelOpen&&(
          <div style={{position:"absolute",right:0,top:0,bottom:0,width:270,
            background:"var(--panel)",borderLeft:"1px solid var(--border)",zIndex:600,
            display:"flex",flexDirection:"column"}}>
            <div style={{padding:"11px 14px",borderBottom:"1px solid var(--border)",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <Icon name="layers" size={13} color="var(--accent)"/>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"var(--text-muted)"}}>LAYER MANAGER</span>
              </div>
              <button onClick={()=>setLayerPanelOpen(false)}
                style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:3}}>
                <Icon name="x" size={15}/>
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"5px 0"}}>
              {!layers.length
                ?<div style={{padding:28,textAlign:"center",fontSize:11,color:"var(--text-muted)",opacity:0.5}}>No layers loaded</div>
                :layers.map(layer=>(
                  <div key={layer.id} onClick={()=>setActiveLayer(layer)}
                    style={{padding:"9px 14px",cursor:"pointer",
                      borderLeft:`3px solid ${activeLayer?.id===layer.id?"var(--accent)":"transparent"}`,
                      background:activeLayer?.id===layer.id?"var(--hover)":"transparent",
                      display:"flex",alignItems:"center",gap:9,transition:"all 0.12s"}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:layer.color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{layer.name}</div>
                      <div style={{fontSize:9,color:"var(--text-muted)",marginTop:1}}>{(layer.geojson?.features?.length||0).toLocaleString()} features</div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();toggleLayer(layer.id);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:layer.visible?"var(--accent)":"var(--text-muted)",padding:3}}>
                      <Icon name={layer.visible?"eye":"eyeOff"} size={13}/>
                    </button>
                    <button onClick={e=>{e.stopPropagation();removeLayer(layer.id);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",padding:3}}>
                      <Icon name="trash" size={13}/>
                    </button>
                  </div>
                ))
              }
            </div>
            <div style={{borderTop:"1px solid var(--border)",padding:10}}>
              <label style={{display:"flex",alignItems:"center",gap:7,background:"var(--panel2)",
                border:"1px dashed var(--border)",borderRadius:7,padding:"9px 12px",
                cursor:"pointer",fontSize:10,color:"var(--text-muted)",justifyContent:"center"}}>
                <Icon name="plus" size={13}/> Add Layer
                <input type="file" multiple hidden accept=".zip,.geojson,.json,.csv" onChange={handleUpload}/>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {symbolEditorOpen&&(
        <SymbolEditor colorMap={colorMap} shapeMap={shapeMap} opacityMap={opacityMap}
          onColorChange={(cat,col)=>setColorMap(p=>({...p,[cat]:col}))}
          onShapeChange={(cat,shape)=>setShapeMap(p=>({...p,[cat]:shape}))}
          onOpacityChange={(cat,val)=>setOpacityMap(p=>({...p,[cat]:val}))}
          onClose={()=>setSymbolEditorOpen(false)}/>
      )}
      {filterPanelOpen&&(
        <FilterPanel fields={fields}
          features={activeLayer?.geojson?.features||[]}
          filters={filters} onFiltersChange={setFilters}
          onClose={()=>setFilterPanelOpen(false)}/>
      )}
      {exportOpen&&(
        <ExportModal dashboardRef={dashRef} mapDivRef={mapDivRef}
          projectTitle={projectTitle} onClose={()=>setExportOpen(false)}/>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT — boot CDN then show Projects or Dashboard
═══════════════════════════════════════════════════════════ */
export default function App() {
  const [ready,   setReady]   = useState(false);
  const [screen,  setScreen]  = useState("projects"); // "projects" | "dashboard"
  const [project, setProject] = useState(null);
  const [theme,   setTheme]   = useState(()=>localStorage.getItem("geocore_theme")||"dark");

  /* Apply theme tokens globally */
  useEffect(()=>{
    const vars=THEMES[theme];
    Object.entries(vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
    localStorage.setItem("geocore_theme",theme);
  },[theme]);

  /* Inject global CSS */
  useEffect(()=>{
    if(document.getElementById("geocore-css")) return;
    const el=document.createElement("style");
    el.id="geocore-css";
    el.textContent=`
      *{box-sizing:border-box;margin:0;padding:0}
      body,html,#root{height:100%;width:100%;font-family:'DM Mono','Courier New',monospace}
      @keyframes spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(el);
  },[]);

  /* Load CDN */
  useEffect(()=>{
    loadStyle(CDN.leaflet_css);
    loadStyle(CDN.leaflet_draw_css);
    Promise.all([
      loadScript(CDN.leaflet_js),
      loadScript(CDN.papaparse),
      loadScript(CDN.chartjs),
      loadScript(CDN.shpjs),
      loadScript(CDN.html2canvas),
      loadScript(CDN.jspdf),
    ]).then(()=>{
      // Load leaflet draw after leaflet
      return loadScript(CDN.leaflet_draw);
    }).then(()=>setReady(true)).catch(console.error);
  },[]);

  const openProject = proj => { setProject(proj); setScreen("dashboard"); };
  const goBack      = ()    => { setScreen("projects"); setProject(null); };
  const toggleTheme = ()    => setTheme(t=>t==="dark"?"light":"dark");

  if(!ready) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      height:"100vh",background:"#0e0e0c",color:"#E8B84B",
      fontFamily:"'DM Mono','Courier New',monospace",gap:12,fontSize:14}}>
      <div style={{width:20,height:20,border:"2px solid #E8B84B",borderTopColor:"transparent",
        borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      Loading GeoCore v4…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(screen==="projects")
    return <ProjectsPage onOpen={openProject} theme={theme} onThemeToggle={toggleTheme}/>;

  return <Dashboard project={project} onBack={goBack} theme={theme} onThemeToggle={toggleTheme}/>;
}
