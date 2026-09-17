import { useEffect, useMemo, useRef, useState } from "react";
import { View, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

import { radius as radiusTokens } from "@/src/theme";
import type { RoutePoint } from "@/src/lib/format";

// Interactive satellite map (Esri World Imagery, no API key) rendered inside a
// WebView with Leaflet. The neon route is drawn on top and can be updated live
// during tracking. Works on iOS/Android including Expo Go; on web it degrades
// gracefully to the tiles that the browser can load.
export function SatelliteMap({
  points,
  fill = false,
  height = 240,
  rounded = true,
  follow = false,
  interactive = true,
  initialCenter,
  style,
}: {
  points: RoutePoint[];
  fill?: boolean;
  height?: number;
  rounded?: boolean;
  follow?: boolean;
  interactive?: boolean;
  initialCenter?: { latitude: number; longitude: number } | null;
  style?: ViewStyle;
}) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const center = useMemo(() => {
    if (points && points.length) return { latitude: points[0].latitude, longitude: points[0].longitude };
    if (initialCenter) return initialCenter;
    return { latitude: -23.5874, longitude: -46.6576 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#0D0E12}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var INT = ${interactive ? "true" : "false"};
  var map = L.map('map',{zoomControl:INT,attributionControl:false,dragging:INT,scrollWheelZoom:INT,doubleClickZoom:INT,touchZoom:INT,boxZoom:INT,keyboard:false});
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,maxNativeZoom:18}).addTo(map);
  map.setView([${center.latitude}, ${center.longitude}], 15);
  var line = L.polyline([], {color:'#00E65C', weight:5, opacity:0.95, lineJoin:'round', lineCap:'round'}).addTo(map);
  var startM=null, endM=null, userInteracted=false;
  map.on('zoomstart dragstart', function(){ userInteracted=true; });
  window.__setRoute = function(pts, follow){
    var ll = pts.map(function(p){ return [p.latitude, p.longitude]; });
    line.setLatLngs(ll);
    if(!ll.length) return;
    if(!startM){ startM = L.circleMarker(ll[0], {radius:7,color:'#00E65C',weight:2,fillColor:'#00E65C',fillOpacity:1}).addTo(map); }
    else { startM.setLatLng(ll[0]); }
    var last = ll[ll.length-1];
    if(ll.length>1){
      if(!endM){ endM = L.circleMarker(last, {radius:7,color:'#00E65C',weight:3,fillColor:'#0D0E12',fillOpacity:1}).addTo(map); }
      else { endM.setLatLng(last); }
    }
    if(follow){ if(!userInteracted){ map.panTo(last, {animate:true}); } }
    else { try{ map.fitBounds(line.getBounds().pad(0.25)); }catch(e){} }
  };
  document.addEventListener('message', handle);
  window.addEventListener('message', handle);
  function handle(e){ try{ var d=JSON.parse(e.data); if(d && d.points){ window.__setRoute(d.points, d.follow); } }catch(err){} }
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ready');
</script></body></html>`,
    [center.latitude, center.longitude, interactive],
  );

  useEffect(() => {
    if (!ready || !webRef.current) return;
    const pts = (points || []).map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    webRef.current.injectJavaScript(`window.__setRoute(${JSON.stringify(pts)}, ${follow}); true;`);
  }, [points, follow, ready]);

  const containerStyle: ViewStyle = fill
    ? { flex: 1, borderRadius: rounded ? radiusTokens.md : 0, overflow: "hidden", backgroundColor: "#0D0E12" }
    : { height, borderRadius: rounded ? radiusTokens.md : 0, overflow: "hidden", backgroundColor: "#0D0E12" };

  return (
    <View style={[containerStyle, style]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        overScrollMode="never"
        androidLayerType="hardware"
        mixedContentMode="always"
        onMessage={() => setReady(true)}
        style={{ flex: 1, backgroundColor: "#0D0E12" }}
      />
    </View>
  );
}
