import type { Activity } from "@/src/lib/format";
import {
  ACTIVITY_META,
  fmtDistance,
  fmtDistanceUnit,
  fmtDuration,
  fmtPace,
  fmtSpeed,
} from "@/src/lib/format";

// Builds a self-contained HTML page that composites a Strava-style share image
// on a <canvas>: satellite background (Esri World Imagery export, no key + CORS
// enabled) + neon route + workout stats + athlete name + ZoneTrack branding.
// It posts the resulting PNG back as a base64 data URL via postMessage.
export function buildShareHTML(activity: Activity, athleteName: string): string {
  const meta = ACTIVITY_META[activity.type];
  const isMoving = activity.type === "cycle";
  const distVal = `${fmtDistance(activity.distance_m)}`;
  const distUnit = fmtDistanceUnit(activity.distance_m).toUpperCase();
  const timeVal = fmtDuration(activity.duration_s);
  const perfVal = isMoving ? fmtSpeed(activity.avg_speed_kmh) : fmtPace(activity.avg_pace_s_per_km);
  const perfLabel = isMoving ? "KM/H" : "MIN/KM";
  const calories = `${Math.round(activity.calories ?? 0)}`;
  const dateStr = activity.created_at
    ? new Date(activity.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const zoneName = activity.zone?.name ?? "Zona livre";

  const points = (activity.route || []).map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  const fallback = activity.zone
    ? { latitude: activity.zone.latitude, longitude: activity.zone.longitude }
    : null;

  const data = {
    points,
    fallback,
    typeLabel: meta.label.toUpperCase(),
    distVal,
    distUnit,
    timeVal,
    perfVal,
    perfLabel,
    calories,
    dateStr,
    zoneName,
    athleteName,
  };

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Rajdhani:wght@600;700&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:#0D0E12}</style>
</head><body>
<canvas id="c" width="1080" height="1350"></canvas>
<script>
var D = ${JSON.stringify(data)};
var posted = false;
function post(o){ if(posted) return; posted = true; window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
var W = 1080, SAT = 1080, H = 1350;

// ---- bbox / projection ----
var pts = D.points || [];
var lats = pts.map(function(p){return p.latitude;});
var lngs = pts.map(function(p){return p.longitude;});
var latC, lngC, half;
if(pts.length >= 2){
  var minLa=Math.min.apply(null,lats), maxLa=Math.max.apply(null,lats);
  var minLo=Math.min.apply(null,lngs), maxLo=Math.max.apply(null,lngs);
  latC=(minLa+maxLa)/2; lngC=(minLo+maxLo)/2;
  var cos0=Math.cos(latC*Math.PI/180)||1;
  half=Math.max(maxLa-minLa,(maxLo-minLo)*cos0)/2*1.35;
  if(half<0.0008) half=0.0008;
} else {
  var c = D.fallback || (pts.length?{latitude:lats[0],longitude:lngs[0]}:{latitude:0,longitude:0});
  latC=c.latitude; lngC=c.longitude; half=0.004;
}
var cos=Math.cos(latC*Math.PI/180)||1;
var lngHalf=half/cos;
var latMin=latC-half, latMax=latC+half, lngMin=lngC-lngHalf, lngMax=lngC+lngHalf;
function proj(p){ return { x:(p.longitude-lngMin)/(lngMax-lngMin)*W, y:(latMax-p.latitude)/(latMax-latMin)*SAT }; }
var exportUrl='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox='+lngMin+','+latMin+','+lngMax+','+latMax+'&bboxSR=4326&imageSR=4326&size=1080,1080&format=png&transparent=false&f=image';

function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

function fallbackBg(){
  var g = ctx.createLinearGradient(0,0,W,SAT);
  g.addColorStop(0,'#161922'); g.addColorStop(1,'#0D0E12');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,SAT);
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=2;
  for(var i=1;i<6;i++){ ctx.beginPath(); ctx.moveTo(0,i*180); ctx.lineTo(W,i*180); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i*180,0); ctx.lineTo(i*180,SAT); ctx.stroke(); }
}

function drawRoute(){
  if(pts.length<2) return;
  ctx.save();
  ctx.shadowColor='rgba(0,230,92,0.8)'; ctx.shadowBlur=24;
  ctx.strokeStyle='#00E65C'; ctx.lineWidth=10; ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.beginPath();
  pts.forEach(function(p,i){ var q=proj(p); if(i===0)ctx.moveTo(q.x,q.y); else ctx.lineTo(q.x,q.y); });
  ctx.stroke();
  ctx.restore();
  var s=proj(pts[0]), e=proj(pts[pts.length-1]);
  ctx.fillStyle='#00E65C'; ctx.beginPath(); ctx.arc(s.x,s.y,14,0,7); ctx.fill();
  ctx.fillStyle='#0D0E12'; ctx.strokeStyle='#00E65C'; ctx.lineWidth=6;
  ctx.beginPath(); ctx.arc(e.x,e.y,14,0,7); ctx.fill(); ctx.stroke();
}

function text(t,x,y,font,color,align){ ctx.font=font; ctx.fillStyle=color; ctx.textAlign=align||'left'; ctx.textBaseline='alphabetic'; ctx.fillText(t,x,y); }

function overlay(){
  // top scrim
  var tg=ctx.createLinearGradient(0,0,0,240); tg.addColorStop(0,'rgba(13,14,18,0.75)'); tg.addColorStop(1,'rgba(13,14,18,0)');
  ctx.fillStyle=tg; ctx.fillRect(0,0,W,240);
  // brand + type
  text('ZONETRACK', 60, 96, "700 40px Rajdhani, sans-serif", '#00E65C', 'left');
  text(D.typeLabel, 60, 146, "700 30px Manrope, sans-serif", '#F8F9FA', 'left');

  // bottom scrim over satellite
  var bg=ctx.createLinearGradient(0,560,0,SAT); bg.addColorStop(0,'rgba(13,14,18,0)'); bg.addColorStop(0.7,'rgba(13,14,18,0.85)'); bg.addColorStop(1,'rgba(13,14,18,0.98)');
  ctx.fillStyle=bg; ctx.fillRect(0,560,W,SAT-560);

  // stats row over satellite
  var y=940;
  var cols=[[D.distVal,D.distUnit],[D.timeVal,'TEMPO'],[D.perfVal,D.perfLabel]];
  var cx=[210,540,870];
  for(var i=0;i<3;i++){
    text(cols[i][0], cx[i], y, "700 84px Rajdhani, sans-serif", '#F8F9FA', 'center');
    text(cols[i][1], cx[i], y+42, "700 26px Manrope, sans-serif", '#8A8D98', 'center');
  }

  // bottom panel
  ctx.fillStyle='#0D0E12'; ctx.fillRect(0,SAT,W,H-SAT);
  ctx.fillStyle='#00E65C'; ctx.fillRect(0,SAT,W,4);
  text(D.athleteName, 60, SAT+110, "800 46px Manrope, sans-serif", '#F8F9FA', 'left');
  text(D.zoneName + '  ·  ' + D.dateStr, 60, SAT+165, "500 30px Manrope, sans-serif", '#8A8D98', 'left');
  // calories chip
  ctx.fillStyle='#003314'; rr(W-330,SAT+70,270,90,45); ctx.fill();
  text('🔥 ' + D.calories + ' kcal', W-195, SAT+128, "700 34px Manrope, sans-serif", '#00E65C', 'center');
}

function finish(){
  drawRoute();
  overlay();
  var out;
  try { out = canvas.toDataURL('image/png'); }
  catch(err){
    // tainted (should not happen with CORS) -> redraw without satellite
    ctx.clearRect(0,0,W,H); fallbackBg(); drawRoute(); overlay();
    try { out = canvas.toDataURL('image/png'); } catch(e2){ post({type:'error',message:String(e2)}); return; }
  }
  post({type:'image', data: out});
}

var renderStarted=false;
function render(){
  if(renderStarted) return; renderStarted=true;
  var img = new Image();
  img.crossOrigin='anonymous';
  var handled=false;
  img.onload=function(){ if(handled)return; handled=true; ctx.drawImage(img,0,0,W,SAT); finish(); };
  img.onerror=function(){ if(handled)return; handled=true; fallbackBg(); finish(); };
  img.src=exportUrl;
  setTimeout(function(){ if(!handled){ handled=true; fallbackBg(); finish(); } }, 9000);
}

if(document.fonts && document.fonts.ready){
  Promise.all([
    document.fonts.load('700 84px Rajdhani'),
    document.fonts.load('800 46px Manrope'),
    document.fonts.load('700 30px Manrope')
  ]).catch(function(){}).then(function(){ render(); });
  setTimeout(render, 3500); // safety if fonts hang (render guards double-run via posted)
} else { render(); }
</script></body></html>`;
}
