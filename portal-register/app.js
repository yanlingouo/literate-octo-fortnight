const $ = id => document.getElementById(id);
const state = (text, kind = '') => { $('status').textContent = text; $('status').dataset.kind = kind; };
function parsePortal(text) {
  const matches = [...String(text).matchAll(/https:\/\/link\.ingress\.com\/portal\/([a-f0-9]{32}\.[a-f0-9]+)(?=$|[\s/?#)\]}>，。])/gi)];
  const ids = [...new Set(matches.map(m => m[1].toLowerCase()))];
  if (ids.length !== 1) throw new Error(ids.length ? '一次請分享一座塔。' : '請提供有效的 Ingress Portal 分享連結。');
  return { id: ids[0], url: 'https://link.ingress.com/portal/' + ids[0] };
}
function sendPortal(portal) {
  const endpoint = window.PORTAL_CONFIG.endpoint;
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint)) throw new Error('主辦方尚未設定登記服務，請依 README 完成部署。');
  return new Promise((resolve, reject) => {
    const nonce = crypto.randomUUID();
    const iframe = document.createElement('iframe'); iframe.name = 'portal_' + nonce; iframe.hidden = true; iframe.title = '登記服務';
    const form = document.createElement('form'); form.method = 'POST'; form.action = endpoint; form.target = iframe.name; form.hidden = true;
    const data = { nonce, origin: location.origin, url: portal.url };
    for (const [name, value] of Object.entries(data)) { const input = document.createElement('input'); input.name = name; input.value = value; form.append(input); }
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); form.remove(); iframe.remove(); };
    const receive = event => {
      if (!/^https:\/\/[a-z0-9-]+\.script\.googleusercontent\.com$/.test(event.origin) && event.origin !== 'https://script.google.com' && event.origin !== 'https://script.googleusercontent.com') return;
      if (!event.data || event.data.nonce !== nonce || event.data.type !== 'portal-result') return;
      cleanup(); resolve(event.data);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('未收到登記結果。可能已送出，請連線後再次查重確認；不要改用原表單重送。')); }, 60000);
    window.addEventListener('message', receive); document.body.append(iframe, form); form.submit();
  });
}
let busy = false;
async function register(event) {
  event?.preventDefault(); if (busy) return;
  try {
    const portal = parsePortal($('portal').value); $('guid').textContent = 'Portal ID · ' + portal.id;
    if (!navigator.onLine) throw new Error('目前離線，請連上網路再登記。');
    busy = true; $('submit').disabled = true; $('portal').disabled = true; state('正在查重，未登記才會送出…');
    const result = await sendPortal(portal);
    state(result.message || '服務沒有提供結果，請稍後重試。', result.status === 'submitted' ? 'success' : 'error');
  } catch (error) { state(error.message, 'error'); }
  finally { busy = false; $('submit').disabled = false; $('portal').disabled = false; }
}
$('register').addEventListener('submit', register);
const home = new URL('./', location.href); $('shortcut').textContent = home.href + '?url=';
const params = new URLSearchParams(location.search);
const shared = ['url','text','title'].map(key => params.get(key) || '').join('\n').trim();
if (shared) { $('portal').value = shared; history.replaceState(null, '', home.pathname); register(); }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => state('分享接收功能未啟用，仍可貼上連結登記。', 'error'));
let installPrompt;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
$('install').addEventListener('click', async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; $('install').hidden = true; } });
