let portalMap, portalLayer, mapBusy=false;
function initMap() {
  if (!window.L) { document.getElementById('map-status').textContent='地圖元件未載入，請檢查網路後重新整理。'; return false; }
  if (portalMap) return true;
  portalMap = L.map('map').setView([24.1477,120.6736],12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(portalMap);
  portalLayer = L.featureGroup().addTo(portalMap);
  return true;
}
async function loadMap() {
  if(mapBusy || !initMap()) return;
  mapBusy=true; const button=document.getElementById('map-refresh'),status=document.getElementById('map-status');
  button.disabled=true; status.textContent='正在讀取登記資料並解析座標…';
  try {
    const result=await sendPortal(null,'map');
    if(result.status!=='map') throw new Error(result.message || '後端尚未更新地圖功能，請重新部署。');
    portalLayer.clearLayers();
    for(const portal of result.portals) {
      const popup=document.createElement('div');
      const title=document.createElement('strong'); title.textContent='已登記的塔'; popup.append(title,document.createElement('br'));
      const id=document.createElement('small'); id.textContent=portal.id; popup.append(id,document.createElement('br'));
      for(const [label,url] of [['Intel Map','https://intel.ingress.com/intel?pll='+portal.lat+','+portal.lng],['Ingress','https://link.ingress.com/portal/'+portal.id]]) {
        const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener noreferrer';popup.append(link,document.createTextNode('　'));
      }
      L.circleMarker([portal.lat,portal.lng],{radius:8,color:'#0c6067',fillColor:'#47d0c0',fillOpacity:.9,weight:2}).bindPopup(popup).addTo(portalLayer);
    }
    if(result.portals.length) portalMap.fitBounds(portalLayer.getBounds(),{padding:[24,24],maxZoom:16});
    status.textContent=`共 ${result.total} 座已登記 · ${result.portals.length} 座已標示 · ${result.unlocated} 座位置待確認。`+(result.remaining ? ` 尚有 ${result.remaining} 座待解析，請按「更新地圖」繼續。` : '')+(result.total===0?' 目前沒有登記資料。':'');
    document.getElementById('map-updated').textContent='更新時間：'+new Date(result.updatedAt).toLocaleString('zh-TW');
  } catch(error) {status.textContent=error.message+'（若有舊標記，仍保留上次結果。）';}
  finally {mapBusy=false;button.disabled=false;}
}
document.getElementById('map-refresh').addEventListener('click',loadMap);
document.getElementById('map-open').addEventListener('click',()=>{
  document.getElementById('map-panel').hidden=false;
  document.getElementById('map-panel').scrollIntoView({behavior:'smooth'});
  loadMap();
});
