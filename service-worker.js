/* Service worker: caching agar app berjalan offline di semua device */
const CACHE = "habit-builder-v30";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./reward-engine.js",
  "./reward-page.html",
  "./notification-manager.js",
  "./notification-settings.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/nav-habit.png",
  "./icons/nav-rab.png",
  "./icons/nav-pencil.png",
  "./icons/nav-catatan.png",
  "./icons/nav-statistik.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {});
            return res;
          })
          .catch(() => cached)
      );
    }),
  );
});

/* ─────────────────────────────────────────────────────────────
 * NOTIFIKASI
 * Bagian di bawah ini menangani notifikasi tanpa server:
 *   • message (SHOW_NOTIF)  : halaman meminta SW menampilkan notif
 *   • push                  : jika nanti pakai Web Push server
 *   • notificationclick      : buka/focus halaman + aksi Snooze
 * ───────────────────────────────────────────────────────────── */
const NOTIF_ICON = "./icons/icon-192.png";

function buildNotifOptions(payload) {
  const base = {
    body: payload.body,
    icon: NOTIF_ICON,
    badge: NOTIF_ICON,
    tag: payload.tag || "habit-notif",
    data: payload.data || { url: "./" },
    vibrate: [200, 100, 200],
    renotify: true,
  };
  switch (payload.type) {
    case "habit":
      return {
        ...base,
        actions: [
          { action: "open", title: "📋 Buka App" },
          { action: "snooze", title: "⏰ Ingatkan 1 jam lagi" },
        ],
      };
    case "budget":
      return {
        ...base,
        actions: [
          { action: "open", title: "💰 Lihat Anggaran" },
          { action: "dismiss", title: "Tutup" },
        ],
      };
    case "evening":
      return {
        ...base,
        actions: [
          { action: "open", title: "📝 Isi Catatan" },
          { action: "open", title: "✅ Cek Habit" },
        ],
      };
    case "streak":
      return { ...base, vibrate: [300, 100, 300, 100, 300] };
    default:
      return base;
  }
}

/* Halaman mengirim perintah ke SW (tanpa server push) */
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;
  if (msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (msg.type === "SHOW_NOTIF") {
    event.waitUntil(
      self.registration.showNotification(
        msg.title,
        buildNotifOptions({
          type: msg.notifType || "default",
          body: msg.body,
          tag: msg.tag,
          data: { url: msg.url || "./" },
        }),
      ),
    );
  }
});

/* Web Push dari server (opsional — disiapkan untuk masa depan) */
self.addEventListener("push", (event) => {
  let payload = {
    type: "default",
    title: "🌿 Habit Builder",
    body: "Waktunya cek habit hari ini!",
    tag: "habit-default",
    data: { url: "./" },
  };
  if (event.data) {
    try {
      Object.assign(payload, event.data.json());
    } catch (e) {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(
      payload.title,
      buildNotifOptions(payload),
    ),
  );
});

/* Klik notifikasi: aksi Snooze 1 jam, atau buka/focus app */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "snooze") {
    event.waitUntil(
      new Promise((resolve) => {
        setTimeout(
          () => {
            self.registration.showNotification("⏰ Pengingat Habit", {
              body: "Kamu minta diingatkan lagi. Sekarang waktunya!",
              icon: NOTIF_ICON,
              tag: "habit-snooze",
            });
            resolve();
          },
          60 * 60 * 1000,
        );
      }),
    );
    return;
  }
  if (event.action === "dismiss") return;

  const targetUrl = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            if ("navigate" in client) client.navigate(targetUrl).catch(() => {});
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      }),
  );
});
