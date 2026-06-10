/**
 * notification-manager.js  —  Habit Builder PWA
 *
 * Mengelola semua logika notifikasi di sisi halaman (bukan service worker):
 * minta izin, jadwal pengingat pagi/malam, cek streak, peringatan budget,
 * dan notifikasi instan (habit selesai, badge baru).
 *
 * Versi ini DIADAPTASI ke struktur data asli app (localStorage "habitBuilder.v1"):
 *   state.habits[]                  -> daftar habit { id, name, ... }
 *   state.checks["Y-M"][id][day]    -> centang habit (month 0-indexed, day = tanggal)
 *   state.notes[]                   -> catatan harian { date: "Y-M-D", ... }
 *   rewardData_v1.currentStreak     -> streak berjalan
 *
 * CARA PAKAI:
 *   <script src="notification-manager.js"></script>   (sebelum app.js)
 *   Lalu panggil NotifManager.init() saat app dimuat.
 */

const NotifManager = (() => {
  "use strict";

  /* ──────────────────────────── KONFIGURASI ──────────────────────────── */
  const CONFIG = {
    morningHour: 7,
    morningMinute: 0,
    eveningHour: 21,
    eveningMinute: 0,
    streakHour: 23,
    streakMinute: 0,
    budgetWarnPct: 80,

    KEY_STATE: "habitBuilder.v1",
    KEY_REWARD: "rewardData_v1",
    KEY_SETTINGS: "notifSettings_v1",
    KEY_LAST_MORN: "notifLastMorning",
    KEY_LAST_EVE: "notifLastEvening",
    KEY_LAST_STREAK: "notifLastStreak",
  };

  /* ──────────────────────────────── STATE ────────────────────────────── */
  let _sw = null;
  const _timers = {};

  /* ───────────────────────────────── INIT ────────────────────────────── */
  async function init() {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      console.warn("[NotifManager] Browser tidak mendukung notifikasi.");
      return;
    }
    try {
      _sw = await navigator.serviceWorker.ready;
    } catch (e) {
      console.warn("[NotifManager] Service worker belum siap:", e);
    }

    const settings = loadSettings();
    if (settings.morning) scheduleMorning();
    if (settings.evening) scheduleEvening();
    if (settings.streak) scheduleStreakCheck();

    _refreshSettingsUI();
    console.log("[NotifManager] Siap. Izin:", Notification.permission);
  }

  /* ────────────────────────── MINTA IZIN NOTIF ───────────────────────── */
  async function requestPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") {
      alert(
        "Izin notifikasi diblokir. Aktifkan lewat ikon kunci di address bar browser kamu.",
      );
      return false;
    }
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  /* ─────────── KIRIM NOTIF LOKAL (lewat SW, tanpa server) ─────────────── */
  async function sendLocal(title, body, options = {}) {
    const granted = await requestPermission();
    if (!granted) return;

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIF",
        notifType: options.notifType || "default",
        title,
        body,
        tag: options.tag || "habitapp-local",
        url: options.url || "./",
      });
    } else if (_sw && _sw.showNotification) {
      _sw.showNotification(title, {
        body,
        icon: "./icons/icon-192.png",
        tag: options.tag || "habitapp-local",
        data: { url: options.url || "./" },
      });
    } else {
      try {
        new Notification(title, { body, icon: "./icons/icon-192.png" });
      } catch (e) {}
    }
  }

  /* ─────────────────────── PENGINGAT TERJADWAL ───────────────────────── */
  function scheduleMorning() {
    clearNamedTimer("morning");
    const t = getTime("morning", CONFIG.morningHour, CONFIG.morningMinute);
    _timers.morning = setTimeout(async () => {
      const today = dateStr();
      if (localStorage.getItem(CONFIG.KEY_LAST_MORN) !== today) {
        localStorage.setItem(CONFIG.KEY_LAST_MORN, today);
        const { done, total } = habitsToday();
        if (!(done === total && total > 0)) {
          await sendLocal(
            "☀️ Selamat Pagi!",
            total === 0
              ? "Belum ada habit. Yuk tambahkan dan mulai hari produktif!"
              : `${total - done} dari ${total} habit belum selesai hari ini. Ayo mulai!`,
            { notifType: "habit", tag: "habit-morning", url: "./" },
          );
        }
      }
      scheduleMorning();
    }, t);
  }

  function scheduleEvening() {
    clearNamedTimer("evening");
    const t = getTime("evening", CONFIG.eveningHour, CONFIG.eveningMinute);
    _timers.evening = setTimeout(async () => {
      const today = dateStr();
      if (localStorage.getItem(CONFIG.KEY_LAST_EVE) !== today) {
        localStorage.setItem(CONFIG.KEY_LAST_EVE, today);
        const { done, total } = habitsToday();
        let body =
          done < total
            ? `Masih ada ${total - done} habit yang belum selesai.`
            : "Semua habit selesai! 🎉 Jangan lupa isi catatan harianmu.";
        if (notesToday() === 0) body += " Belum ada catatan hari ini.";
        await sendLocal("🌙 Malam — Recap Hari Ini", body, {
          notifType: "evening",
          tag: "evening-recap",
          url: "./",
        });
      }
      scheduleEvening();
    }, t);
  }

  function scheduleStreakCheck() {
    clearNamedTimer("streak");
    const t = getTime("streak", CONFIG.streakHour, CONFIG.streakMinute);
    _timers.streak = setTimeout(async () => {
      const today = dateStr();
      if (localStorage.getItem(CONFIG.KEY_LAST_STREAK) !== today) {
        const { done, total } = habitsToday();
        const streak = getStreak();
        if (done < total && total > 0 && streak > 0) {
          localStorage.setItem(CONFIG.KEY_LAST_STREAK, today);
          await sendLocal(
            `🔥 Streak ${streak} hari mau putus!`,
            `Selesaikan ${total - done} habit lagi sebelum tengah malam!`,
            { notifType: "streak", tag: "streak-alert", url: "./" },
          );
        }
      }
      scheduleStreakCheck();
    }, t);
  }

  /* ───────────────────────── PERINGATAN BUDGET ───────────────────────── */
  async function checkBudget(spent, budget, categoryName) {
    if (!budget || budget <= 0) return;
    if (!loadSettings().budget) return;

    const pct = (spent / budget) * 100;
    if (pct >= 100) {
      await sendLocal(
        `🚨 Anggaran ${categoryName} habis!`,
        `Pengeluaran sudah melampaui batas Rp${Number(budget).toLocaleString("id-ID")}.`,
        { notifType: "budget", tag: `budget-over-${categoryName}`, url: "./" },
      );
    } else if (pct >= CONFIG.budgetWarnPct) {
      await sendLocal(
        `⚠️ Anggaran ${categoryName} hampir habis`,
        `Sudah ${Math.round(pct)}% dari Rp${Number(budget).toLocaleString("id-ID")}. Hati-hati!`,
        { notifType: "budget", tag: `budget-warn-${categoryName}`, url: "./" },
      );
    }
  }

  /* ─────────────────────────── NOTIF INSTAN ──────────────────────────── */
  async function notifyHabitDone(habitName, streakDays) {
    if (!loadSettings().habitDone) return;
    await sendLocal(
      `✅ ${habitName} selesai!`,
      streakDays > 1
        ? `Streak ${streakDays} hari berturut-turut. Pertahankan!`
        : "Mantap! Satu kebiasaan baik terjaga.",
      { notifType: "habit", tag: "habit-done", url: "./" },
    );
  }

  async function notifyAllDone(totalHabits) {
    if (!loadSettings().habitDone) return;
    await sendLocal(
      "🎉 Semua Habit Selesai!",
      `${totalHabits} habit berhasil diselesaikan hari ini. Luar biasa!`,
      { notifType: "habit", tag: "all-done", url: "./" },
    );
  }

  async function notifyNewBadge(badgeName, badgeIcon) {
    await sendLocal(
      `${badgeIcon || "🏅"} Badge baru terbuka!`,
      `Kamu mendapatkan badge "${badgeName}". Lihat koleksimu!`,
      { tag: "new-badge", url: "./reward-page.html" },
    );
  }

  /* ───────────────────────────── PENGATURAN ──────────────────────────── */
  function defaultSettings() {
    return {
      morning: true,
      evening: true,
      streak: true,
      budget: true,
      habitDone: false,
    };
  }

  function loadSettings() {
    try {
      return Object.assign(
        defaultSettings(),
        JSON.parse(localStorage.getItem(CONFIG.KEY_SETTINGS)) || {},
      );
    } catch (e) {
      return defaultSettings();
    }
  }

  function saveSettings(s) {
    localStorage.setItem(CONFIG.KEY_SETTINGS, JSON.stringify(s));
  }

  async function toggleSetting(key, enable) {
    const granted = enable ? await requestPermission() : true;
    if (!granted) {
      _refreshSettingsUI();
      return false;
    }
    const s = loadSettings();
    s[key] = enable;
    saveSettings(s);

    if (enable) {
      if (key === "morning") scheduleMorning();
      if (key === "evening") scheduleEvening();
      if (key === "streak") scheduleStreakCheck();
    } else {
      clearNamedTimer(key);
    }
    _refreshSettingsUI();
    return true;
  }

  function getStatus() {
    return {
      permission: "Notification" in window ? Notification.permission : "unsupported",
      settings: loadSettings(),
      supported: "Notification" in window && "serviceWorker" in navigator,
    };
  }

  /* Perbarui kontrol di halaman pengaturan jika ada */
  function _refreshSettingsUI() {
    const s = loadSettings();
    Object.keys(s).forEach((key) => {
      const el = document.getElementById(`notif-${key}`);
      if (el) el.checked = s[key];
    });
    const permEl = document.getElementById("notif-permission-status");
    if (permEl && "Notification" in window) {
      const p = Notification.permission;
      permEl.textContent =
        p === "granted" ? "✅ Diizinkan" : p === "denied" ? "❌ Diblokir" : "⏳ Belum diminta";
      permEl.style.color =
        p === "granted" ? "#16a34a" : p === "denied" ? "#dc2626" : "#b45309";
    }
  }

  /* ─────────────────────────────── HELPERS ───────────────────────────── */
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.KEY_STATE)) || {};
    } catch (e) {
      return {};
    }
  }

  function todayParts() {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
  }

  function dateStr() {
    const { y, m, d } = todayParts();
    return `${y}-${m}-${d}`;
  }

  // Jumlah habit selesai hari ini, sesuai struktur state.checks["Y-M"][id][day]
  function habitsToday() {
    const s = loadState();
    const habits = Array.isArray(s.habits) ? s.habits : [];
    const { y, m, d } = todayParts();
    const mc = (s.checks && s.checks[`${y}-${m}`]) || {};
    let done = 0;
    habits.forEach((h) => {
      if (mc[h.id] && mc[h.id][d]) done++;
    });
    return { done, total: habits.length };
  }

  // Jumlah catatan hari ini (state.notes[].date == "Y-M-D")
  function notesToday() {
    const s = loadState();
    const notes = Array.isArray(s.notes) ? s.notes : [];
    const key = dateStr();
    return notes.filter((n) => n.date === key).length;
  }

  function getStreak() {
    try {
      const r = JSON.parse(localStorage.getItem(CONFIG.KEY_REWARD) || "{}");
      return r.currentStreak || 0;
    } catch (e) {
      return 0;
    }
  }

  // ms hingga jam:menit berikutnya; jika sudah lewat, jadwalkan besok
  function msUntil(hour, minute) {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }

  // Ambil jam custom (disimpan halaman pengaturan) atau default
  function getTime(period, defH, defM) {
    try {
      const t = JSON.parse(localStorage.getItem(`notifTime_${period}`));
      if (t && typeof t.hour === "number") return msUntil(t.hour, t.minute || 0);
    } catch (e) {}
    return msUntil(defH, defM);
  }

  function clearNamedTimer(name) {
    if (_timers[name]) {
      clearTimeout(_timers[name]);
      delete _timers[name];
    }
  }

  /* ───────────────────────────── PUBLIC API ──────────────────────────── */
  return {
    init,
    requestPermission,
    sendLocal,
    checkBudget,
    notifyHabitDone,
    notifyAllDone,
    notifyNewBadge,
    toggleSetting,
    getStatus,
    loadSettings,
  };
})();
