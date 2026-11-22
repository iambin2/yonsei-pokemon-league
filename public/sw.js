// 알림만 맡는다. fetch를 가로채지 않으므로 캐시도, 배포 새로고침(version.json)과의 충돌도 없다.
// 같은 주소의 알림은 tag로 하나만 남는다(같은 공지를 고쳐 다시 알려도 쌓이지 않는다, 2026-11-22).
self.addEventListener("push", event => {
  const { title, body, url } = event.data.json();
  event.waitUntil(self.registration.showNotification(title, { body, icon: "icon-192.png", tag: url || undefined, data: { url } }));
});

// 누르면 이미 열린 사이트 창이 있으면 그 창을 그 주소로 옮기고, 없을 때만 새 창을 연다(창이 알림마다 쌓이지 않게, 2026-11-22).
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || ".", self.registration.scope).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const mine = open.find(client => client.url.startsWith(self.registration.scope));
    if (mine) {
      try { await mine.focus(); await mine.navigate(target); return; } catch { /* a window that cannot be moved: open a new one */ }
    }
    await self.clients.openWindow(target);
  })());
});
