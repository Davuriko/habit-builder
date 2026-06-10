/**
 * reward-engine.js
 * Sistem Reward & Badge untuk Habit Builder
 * Terhubung ke app.js — tidak mengubah struktur data utama (habitBuilder.v1).
 * Data reward disimpan terpisah di localStorage key "rewardData_v1".
 *
 * CARA PAKAI (dipanggil dari app.js):
 *   RewardEngine.onHabitChecked(habitId, allHabits, date) // tiap habit dicentang
 *   RewardEngine.onDayComplete(done, total, date)          // saat semua habit selesai
 *   RewardEngine.onNoteSaved()                             // tiap catatan disimpan
 *   RewardEngine.onMoneySaved(amount)                      // tiap ada tabungan
 *   RewardEngine.refresh()                                 // perbarui widget/header
 */

const RewardEngine = (() => {
  /* ─────────────── KONFIGURASI POIN ─────────────── */
  const POINTS = {
    HABIT_CHECK: 10, // tiap habit dicentang
    DAY_PERFECT: 50, // semua habit selesai 1 hari
    STREAK_BONUS: 5, // per hari streak (kumulatif)
    NOTE_SAVED: 5, // tiap catatan disimpan
    MONEY_SAVED: 20, // tiap ada tabungan hari ini
  };

  /* ─────────────── DEFINISI BADGE ─────────────── */
  const BADGE_DEFS = [
    // — STREAK —
    {
      id: "streak_3",
      icon: "🔥",
      name: "Semangat!",
      desc: "Streak 3 hari berturut-turut",
      cat: "streak",
      check: (s) => s.currentStreak >= 3,
    },
    {
      id: "streak_7",
      icon: "⚡",
      name: "Satu Minggu",
      desc: "Streak 7 hari berturut-turut",
      cat: "streak",
      check: (s) => s.currentStreak >= 7,
    },
    {
      id: "streak_14",
      icon: "💪",
      name: "Dua Minggu",
      desc: "Streak 14 hari berturut-turut",
      cat: "streak",
      check: (s) => s.currentStreak >= 14,
    },
    {
      id: "streak_30",
      icon: "🏅",
      name: "Satu Bulan",
      desc: "Streak 30 hari berturut-turut",
      cat: "streak",
      check: (s) => s.currentStreak >= 30,
    },
    {
      id: "streak_100",
      icon: "👑",
      name: "Legenda",
      desc: "Streak 100 hari berturut-turut",
      cat: "streak",
      check: (s) => s.currentStreak >= 100,
    },

    // — HABIT SELESAI —
    {
      id: "perfect_1",
      icon: "⭐",
      name: "Hari Sempurna",
      desc: "Selesaikan semua habit 1 hari",
      cat: "habit",
      check: (s) => s.perfectDays >= 1,
    },
    {
      id: "perfect_7",
      icon: "🌟",
      name: "Minggu Sempurna",
      desc: "Selesaikan semua habit 7 hari",
      cat: "habit",
      check: (s) => s.perfectDays >= 7,
    },
    {
      id: "perfect_30",
      icon: "✨",
      name: "Bulan Sempurna",
      desc: "Selesaikan semua habit 30 hari",
      cat: "habit",
      check: (s) => s.perfectDays >= 30,
    },
    {
      id: "habit_50",
      icon: "🎯",
      name: "Half Century",
      desc: "50 total habit terselesaikan",
      cat: "habit",
      check: (s) => s.totalChecks >= 50,
    },
    {
      id: "habit_200",
      icon: "🚀",
      name: "Dua Ratus!",
      desc: "200 total habit terselesaikan",
      cat: "habit",
      check: (s) => s.totalChecks >= 200,
    },

    // — CATATAN —
    {
      id: "note_1",
      icon: "📝",
      name: "Penulis Pemula",
      desc: "Simpan catatan pertama",
      cat: "catatan",
      check: (s) => s.totalNotes >= 1,
    },
    {
      id: "note_10",
      icon: "📓",
      name: "Rajin Nulis",
      desc: "10 catatan tersimpan",
      cat: "catatan",
      check: (s) => s.totalNotes >= 10,
    },
    {
      id: "note_50",
      icon: "📚",
      name: "Penulis Sejati",
      desc: "50 catatan tersimpan",
      cat: "catatan",
      check: (s) => s.totalNotes >= 50,
    },
    {
      id: "note_100",
      icon: "🖊️",
      name: "Jurnal Harian",
      desc: "100 catatan tersimpan",
      cat: "catatan",
      check: (s) => s.totalNotes >= 100,
    },

    // — KEUANGAN —
    {
      id: "saver_1",
      icon: "💰",
      name: "Mulai Menabung",
      desc: "Pertama kali ada tabungan",
      cat: "keuangan",
      check: (s) => s.savingDays >= 1,
    },
    {
      id: "saver_7",
      icon: "💳",
      name: "Hemat Seminggu",
      desc: "Ada tabungan 7 hari berbeda",
      cat: "keuangan",
      check: (s) => s.savingDays >= 7,
    },
    {
      id: "saver_30",
      icon: "🏦",
      name: "Investor Muda",
      desc: "Ada tabungan 30 hari berbeda",
      cat: "keuangan",
      check: (s) => s.savingDays >= 30,
    },

    // — LEVEL POIN —
    {
      id: "pts_100",
      icon: "🌱",
      name: "Benih",
      desc: "Kumpulkan 100 poin",
      cat: "level",
      check: (s) => s.totalPoints >= 100,
    },
    {
      id: "pts_500",
      icon: "🌿",
      name: "Tumbuh",
      desc: "Kumpulkan 500 poin",
      cat: "level",
      check: (s) => s.totalPoints >= 500,
    },
    {
      id: "pts_1000",
      icon: "🌳",
      name: "Pohon Kuat",
      desc: "Kumpulkan 1.000 poin",
      cat: "level",
      check: (s) => s.totalPoints >= 1000,
    },
    {
      id: "pts_5000",
      icon: "🏆",
      name: "Juara",
      desc: "Kumpulkan 5.000 poin",
      cat: "level",
      check: (s) => s.totalPoints >= 5000,
    },
  ];

  /* ─────────────── DEFINISI LEVEL ─────────────── */
  const LEVELS = [
    { name: "Pemula", minPts: 0, icon: "🌱", color: "#6b7280" },
    { name: "Konsisten", minPts: 200, icon: "🌿", color: "#16a34a" },
    { name: "Berdedikasi", minPts: 600, icon: "🌳", color: "#0891b2" },
    { name: "Ahli Habit", minPts: 1500, icon: "⚡", color: "#7c3aed" },
    { name: "Master Habit", minPts: 4000, icon: "🏆", color: "#b45309" },
    { name: "Legenda", minPts: 8000, icon: "👑", color: "#dc2626" },
  ];

  /* ─────────────── STORAGE ─────────────── */
  const KEY = "rewardData_v1";

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      return d ? Object.assign(defaultState(), d) : defaultState();
    } catch {
      return defaultState();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function defaultState() {
    return {
      totalPoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      perfectDays: 0,
      totalChecks: 0,
      totalNotes: 0,
      savingDays: 0,
      earnedBadges: [],
      lastActiveDate: null,
      savingDates: [],
      perfectDates: [],
      pointLog: [],
    };
  }

  /* ─────────────── CORE ─────────────── */
  function addPoints(amount, reason) {
    const data = load();
    data.totalPoints += amount;
    data.pointLog.unshift({ date: today(), amount, reason });
    if (data.pointLog.length > 100) data.pointLog.length = 100;
    save(data);
    return data.totalPoints;
  }

  function checkAndAwardBadges() {
    const data = load();
    const newBadges = [];
    BADGE_DEFS.forEach((def) => {
      if (!data.earnedBadges.includes(def.id) && def.check(data)) {
        data.earnedBadges.push(def.id);
        newBadges.push(def);
      }
    });
    if (newBadges.length > 0) {
      save(data);
      newBadges.forEach((badge) => showBadgePopup(badge));
    }
    return newBadges;
  }

  function updateStreak(dateStr) {
    const data = load();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = fmtDate(yesterday);

    if (data.lastActiveDate === dateStr) {
      // sudah dihitung hari ini
    } else if (data.lastActiveDate === yStr) {
      data.currentStreak += 1;
    } else {
      data.currentStreak = 1;
    }
    if (data.currentStreak > data.longestStreak) {
      data.longestStreak = data.currentStreak;
    }
    data.lastActiveDate = dateStr;
    save(data);
    return data.currentStreak;
  }

  /* ─────────────── PUBLIC API ─────────────── */
  function onHabitChecked(habitId, allHabits = [], dateStr = today()) {
    const data = load();
    data.totalChecks += 1;
    save(data);

    addPoints(POINTS.HABIT_CHECK, "Habit selesai");
    updateStreak(dateStr);

    const streak = load().currentStreak;
    if (streak > 1) {
      addPoints(
        POINTS.STREAK_BONUS * (streak - 1),
        `Streak bonus ×${streak - 1}`,
      );
    }
    checkAndAwardBadges();
    _refreshUI();
  }

  function onDayComplete(done, total, dateStr = today()) {
    if (total === 0 || done < total) return;
    const data = load();
    // Dedup: hanya hitung 1× per tanggal.
    if (data.perfectDates.includes(dateStr)) {
      _refreshUI();
      return;
    }
    data.perfectDates.push(dateStr);
    data.perfectDays = data.perfectDates.length;
    save(data);

    addPoints(POINTS.DAY_PERFECT, "Hari sempurna!");
    checkAndAwardBadges();
    showCelebration(
      "🎉 Hari Sempurna!",
      `Semua ${total} habit selesai hari ini!`,
    );
    _refreshUI();
  }

  function onNoteSaved() {
    const data = load();
    data.totalNotes += 1;
    save(data);

    addPoints(POINTS.NOTE_SAVED, "Catatan disimpan");
    checkAndAwardBadges();
    _refreshUI();
  }

  function onMoneySaved(amount) {
    if (!amount || amount <= 0) return;
    const data = load();
    const dateStr = today();
    if (!data.savingDates.includes(dateStr)) {
      data.savingDates.push(dateStr);
      data.savingDays = data.savingDates.length;
      save(data);
      addPoints(POINTS.MONEY_SAVED, "Ada tabungan hari ini");
      checkAndAwardBadges();
    }
    _refreshUI();
  }

  /* ─────────────── GETTERS ─────────────── */
  function getStats() {
    return load();
  }

  function getCurrentLevel() {
    const { totalPoints } = load();
    let lvl = LEVELS[0];
    for (const l of LEVELS) {
      if (totalPoints >= l.minPts) lvl = l;
    }
    const idx = LEVELS.indexOf(lvl);
    const next = LEVELS[idx + 1] || null;
    const progress = next
      ? Math.round(
          ((totalPoints - lvl.minPts) / (next.minPts - lvl.minPts)) * 100,
        )
      : 100;
    return { ...lvl, progress, nextLevel: next, totalPoints };
  }

  function getAllBadges() {
    const { earnedBadges } = load();
    return BADGE_DEFS.map((b) => ({
      ...b,
      earned: earnedBadges.includes(b.id),
      earnedAt: null,
    }));
  }

  /* ─────────────── POPUP BADGE ─────────────── */
  function showBadgePopup(badge) {
    const old = document.getElementById("rw-badge-popup");
    if (old) old.remove();

    // Kirim juga sebagai notifikasi sistem (jika manajer notif tersedia).
    if (typeof NotifManager !== "undefined") {
      try {
        NotifManager.notifyNewBadge(badge.name, badge.icon);
      } catch (e) {}
    }

    const popup = document.createElement("div");
    popup.id = "rw-badge-popup";
    popup.innerHTML = `
      <div style="
        position:fixed; bottom:110px; left:50%; transform:translateX(-50%) translateY(20px);
        background:#1a1a2e; color:#fff;
        padding:14px 20px; border-radius:16px;
        display:flex; align-items:center; gap:12px;
        z-index:9999; opacity:0;
        transition:all 0.35s cubic-bezier(.34,1.56,.64,1);
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        max-width:320px; width:calc(100% - 40px);
        pointer-events:none;
      ">
        <span style="font-size:32px;line-height:1;">${badge.icon}</span>
        <div>
          <div style="font-size:10px;letter-spacing:1px;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:2px;">Badge baru terbuka!</div>
          <div style="font-size:15px;font-weight:700;">${badge.name}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px;">${badge.desc}</div>
        </div>
      </div>`;
    document.body.appendChild(popup);

    const inner = popup.firstElementChild;
    requestAnimationFrame(() => {
      inner.style.opacity = "1";
      inner.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(() => {
      inner.style.opacity = "0";
      inner.style.transform = "translateX(-50%) translateY(-10px)";
      setTimeout(() => popup.remove(), 400);
    }, 3500);
  }

  function showCelebration(title, subtitle) {
    const old = document.getElementById("rw-celebration");
    if (old) old.remove();

    const el = document.createElement("div");
    el.id = "rw-celebration";
    el.innerHTML = `
      <div style="
        position:fixed; top:0;left:0;right:0;bottom:0;
        display:flex;align-items:center;justify-content:center;
        z-index:10000; pointer-events:none;
      ">
        <div id="rw-cel-card" style="
          background:#fff; border-radius:20px;
          padding:28px 32px; text-align:center;
          opacity:0; transform:scale(0.8);
          transition:all 0.4s cubic-bezier(.34,1.56,.64,1);
          max-width:280px; box-shadow:0 12px 40px rgba(0,0,0,0.25);
        ">
          <div style="font-size:48px;margin-bottom:10px;">🎉</div>
          <div style="font-size:20px;font-weight:700;color:#1a1a2e;">${title}</div>
          <div style="font-size:14px;color:#6b7280;margin-top:6px;">${subtitle}</div>
        </div>
      </div>`;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      const card = document.getElementById("rw-cel-card");
      if (card) {
        card.style.opacity = "1";
        card.style.transform = "scale(1)";
      }
    });
    setTimeout(() => {
      const card = document.getElementById("rw-cel-card");
      if (card) {
        card.style.opacity = "0";
        card.style.transform = "scale(0.9)";
      }
      setTimeout(() => el.remove(), 400);
    }, 2500);
  }

  /* ─────────────── REFRESH WIDGET/HEADER ─────────────── */
  function _refreshUI() {
    const lvl = getCurrentLevel();
    const stats = getStats();
    _set("rw-total-points", lvl.totalPoints.toLocaleString("id-ID"));
    _set("rw-streak", stats.currentStreak);
    _set("rw-level-name", `${lvl.icon} ${lvl.name}`);
    _set("rw-level-progress", lvl.progress + "%");
    _set("rw-badge-count", stats.earnedBadges.length);
    const bar = document.getElementById("rw-progress-bar");
    if (bar) bar.style.width = lvl.progress + "%";
  }

  function _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ─────────────── HELPER TANGGAL ─────────────── */
  function today() {
    return fmtDate(new Date());
  }
  function fmtDate(d) {
    // tanggal lokal (bukan UTC) supaya streak akurat
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  document.addEventListener("DOMContentLoaded", _refreshUI);

  return {
    onHabitChecked,
    onDayComplete,
    onNoteSaved,
    onMoneySaved,
    refresh: _refreshUI,
    getStats,
    getCurrentLevel,
    getAllBadges,
    LEVELS,
    BADGE_DEFS,
    showBadgePopup,
    showCelebration,
  };
})();
