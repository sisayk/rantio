// Maps on Android: OpenStreetMap drawn by Leaflet in a web view, as on the website.
// (react-native-maps on Android needs a Google Maps key and billing account; this needs
// neither.) Same components and look as maps.tsx: price pins, a green home pin.
import { type ComponentType, type Ref, useEffect, useRef, useState } from "react";
import { Linking, View, type ViewStyle } from "react-native";
import { WebView as WebViewClass, type WebViewMessageEvent, type WebViewProps } from "react-native-webview";

import { type Listing, listingCurrency } from "@/lib/listings";
import { useMoney } from "@/state/money";
import { colors } from "@/theme";
import { LEAFLET_CSS, LEAFLET_JS } from "@/ui/leaflet.generated";

// The library's class type collapses to `never` under TypeScript 6; this is its plain shape.
type WebRef = { injectJavaScript: (script: string) => void };
const WebView = WebViewClass as unknown as ComponentType<WebViewProps & { ref?: Ref<WebRef> }>;

// Tiles are asked for "from" the website, as OpenStreetMap's tile policy expects a referer.
const BASE = "https://stugora.fi/";

const MARK = `<svg viewBox="0 0 40 40" width="26" height="26"><path d="M15 4 6 17h4.5L5 25h20l-5.5-8H24L15 4Z" fill="#fff"/><path d="M14 25v4h2v-4" fill="#fff"/><path d="M21 25V17l6.5-5 6.5 5v8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><path d="M3 31c2.5-1.6 5-1.6 7.5 0s5 1.6 7.5 0 5-1.6 7.5 0 5 1.6 7.5 0 3.5-1.6 4 0M7 35.5c2-1.2 4-1.2 6 0s4 1.2 6 0 4-1.2 6 0 4 1.2 6 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;

function page(script: string, interactive: boolean) {
  const still = interactive ? "" : "dragging:false,touchZoom:false,doubleClickZoom:false,scrollWheelZoom:false,boxZoom:false,keyboard:false,tap:false,";
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>${LEAFLET_CSS}
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${colors.greenTint}}
.leaflet-container{font-family:sans-serif;background:${colors.greenTint}}
.leaflet-control-attribution{font-size:10px}
.at{width:0;height:0}
.pin{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;background:#fff;color:${colors.ink};font:700 14px/1 sans-serif;padding:7px 10px;border-radius:999px;border:0.5px solid rgba(0,0,0,.12);box-shadow:0 2px 5px rgba(0,0,0,.22)}
.pin.on{background:${colors.ink};color:#fff;transform:translate(-50%,-50%) scale(1.08)}
.home{position:absolute;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:24px;background:${colors.green};border:3px solid #fff;box-sizing:border-box;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 7px rgba(0,0,0,.28)}
</style></head><body><div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
var map=L.map("map",{zoomControl:false,${still}attributionControl:true});
map.attributionControl.setPrefix(false);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
function send(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m))}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
${script}
</script></body></html>`;
}

const COTTAGES = page(
  `map.setView([62,15],4);
var layer=L.layerGroup().addTo(map);
map.on("click",function(){send({type:"tap"})});
window.stugora={pins:function(list,fit,top,bottom){
  layer.clearLayers();
  list.forEach(function(p){
    var icon=L.divIcon({className:"at",iconSize:[0,0],html:'<span class="pin'+(p.on?" on":"")+'">'+esc(p.text)+"</span>"});
    L.marker([p.lat,p.lng],{icon:icon,zIndexOffset:p.on?1000:0,keyboard:false}).on("click",function(){send({type:"select",id:p.id})}).addTo(layer);
  });
  if(fit&&list.length){
    map.fitBounds(L.latLngBounds(list.map(function(p){return[p.lat,p.lng]})),{paddingTopLeft:[40,top+40],paddingBottomRight:[40,bottom+40],maxZoom:11,animate:true});
  }
}};
send({type:"ready"});`,
  true,
);

/** Keeps links (the OpenStreetMap credit) out of the map: they open in the browser. */
function stayOnMap(req: { url: string }) {
  if (req.url === BASE || req.url.startsWith("about:") || req.url.startsWith("data:")) return true;
  void Linking.openURL(req.url);
  return false;
}

type CottagesMapProps = {
  listings: Listing[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  style?: ViewStyle;
  bottomPadding?: number;
  topPadding?: number;
};

export function CottagesMap({ listings, selected, onSelect, style, bottomPadding = 0, topPadding = 0 }: CottagesMapProps) {
  const web = useRef<WebRef>(null);
  const fitted = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const money = useMoney();

  const pins = listings.map((l) => {
    const price = money.show(l.price, listingCurrency(l));
    return {
      id: l.id,
      lat: l.lat,
      lng: l.lng,
      on: l.id === selected,
      text: price.converted ? `≈${price.text}` : price.text,
    };
  });
  const json = JSON.stringify(pins);
  const ids = listings.map((l) => l.id).join(",");

  // Redraw the pins when they change; show them all whenever the set changes (a category, a search).
  useEffect(() => {
    if (!ready) return;
    const fit = fitted.current !== ids;
    fitted.current = ids;
    web.current?.injectJavaScript(`window.stugora&&window.stugora.pins(${json},${fit},${topPadding},${bottomPadding});true;`);
  }, [ready, json, ids, topPadding, bottomPadding]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as {
        type: string;
        id?: string;
      };
      if (msg.type === "ready") setReady(true);
      else if (msg.type === "select" && msg.id) onSelect(msg.id);
      else if (msg.type === "tap") onSelect(null);
    } catch {
      // not ours
    }
  };

  return (
    <View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.greenTint,
        },
        style,
      ]}
    >
      <WebView
        ref={web}
        source={{ html: COTTAGES, baseUrl: BASE }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={stayOnMap}
        setSupportMultipleWindows={false}
        overScrollMode="never"
        style={{ flex: 1, backgroundColor: colors.greenTint }}
      />
    </View>
  );
}

/** One cottage's spot, for its page. Not interactive; tapping the frame opens the phone's maps app. */
export function PinMap({ lat, lng, style }: { lat: number; lng: number; style?: ViewStyle }) {
  const html = page(
    `map.setView([${Number(lat)},${Number(lng)}],11);
L.marker([${Number(lat)},${Number(lng)}],{icon:L.divIcon({className:"at",iconSize:[0,0],html:'<span class="home">${MARK}</span>'}),keyboard:false,interactive:false}).addTo(map);`,
    false,
  );
  return (
    <View style={[{ overflow: "hidden", backgroundColor: colors.greenTint }, style]} pointerEvents="none">
      <WebView
        source={{ html, baseUrl: BASE }}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={stayOnMap}
        scrollEnabled={false}
        overScrollMode="never"
        style={{ flex: 1, backgroundColor: colors.greenTint }}
      />
    </View>
  );
}
