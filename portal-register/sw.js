// 僅接收分享，不快取登記結果；離線時不會顯示登記成功。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const target = new URL('share', self.registration.scope);
  if (event.request.method !== 'POST' || new URL(event.request.url).pathname !== target.pathname) return;
  event.respondWith((async () => {
    const data = await event.request.formData();
    const home = new URL('./', self.registration.scope);
    for (const key of ['title', 'text', 'url']) if (data.get(key)) home.searchParams.set(key, String(data.get(key)));
    return Response.redirect(home.href, 303);
  })());
});
