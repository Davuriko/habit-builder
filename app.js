/* Habit Builder - pelacak goals harian
   Data disimpan di localStorage, berjalan offline & di semua device. */

(() => {
  "use strict";

  const STORE_KEY = "habitBuilder.v1";
  const MONTHS = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const PALETTE = [
    "#141414",
    "#1f9d55",
    "#2d6cdf",
    "#e0710b",
    "#8e44ad",
    "#c0392b",
    "#16a085",
    "#d4a017",
  ];

  const DEFAULT_HABITS = [
    "Bangun pagi",
    "Olahraga",
    "Baca buku",
    "Minum air 2L",
    "Belajar",
    "Tidur cukup",
  ];

  // ---------- State ----------
  let state = load();
  const view = { year: new Date().getFullYear(), month: new Date().getMonth() };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* ignore corrupt data */
    }
    return {
      habits: DEFAULT_HABITS.map((name, i) => ({
        id: uid(),
        name,
        color: PALETTE[i % PALETTE.length],
      })),
      // checks["YYYY-M"][habitId] = { "day": true }
      checks: {},
    };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function uid() {
    return "h" + Math.random().toString(36).slice(2, 9);
  }

  function monthKey(y = view.year, m = view.month) {
    return `${y}-${m}`;
  }

  function daysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
  }

  function getMonthChecks() {
    const k = monthKey();
    if (!state.checks[k]) state.checks[k] = {};
    return state.checks[k];
  }

  function isChecked(habitId, day) {
    const mc = state.checks[monthKey()];
    return !!(mc && mc[habitId] && mc[habitId][day]);
  }

  function toggle(habitId, day) {
    const mc = getMonthChecks();
    if (!mc[habitId]) mc[habitId] = {};
    if (mc[habitId][day]) delete mc[habitId][day];
    else mc[habitId][day] = true;
    save();
  }

  // ---------- DOM refs ----------
  const el = (id) => document.getElementById(id);
  const monthTitle = el("monthTitle");
  const habitList = el("habitList");
  const trackerTable = el("trackerTable");

  // ---------- Rendering ----------
  function renderAll() {
    renderMonthTitle();
    renderHabits();
    renderTracker();
    renderOverview();
  }

  function renderMonthTitle() {
    monthTitle.textContent = `${MONTHS[view.month]} ${view.year}`;
  }

  function renderHabits() {
    habitList.innerHTML = "";
    if (state.habits.length === 0) {
      const li = document.createElement("li");
      li.className = "empty-hint";
      li.textContent = "Belum ada habit. Tambahkan goals harianmu di atas.";
      habitList.appendChild(li);
      return;
    }
    const total = daysInMonth(view.year, view.month);
    state.habits.forEach((h) => {
      const done = countHabitDone(h.id);
      const li = document.createElement("li");

      const color = document.createElement("span");
      color.className = "habit-color";
      color.style.background = h.color;

      const name = document.createElement("span");
      name.className = "habit-name";
      name.textContent = h.name;

      const stat = document.createElement("span");
      stat.className = "habit-stat";
      stat.textContent = `${done}/${total}`;

      const del = document.createElement("button");
      del.className = "habit-del";
      del.type = "button";
      del.title = "Hapus habit";
      del.textContent = "✕";
      del.addEventListener("click", () => removeHabit(h.id));

      li.append(color, name, stat, del);
      habitList.appendChild(li);
    });
  }

  function countHabitDone(habitId) {
    const mc = state.checks[monthKey()];
    if (!mc || !mc[habitId]) return 0;
    return Object.keys(mc[habitId]).length;
  }

  function renderTracker() {
    const y = view.year,
      m = view.month;
    const total = daysInMonth(y, m);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;
    const todayDate = today.getDate();

    trackerTable.innerHTML = "";

    if (state.habits.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.textContent = "Tambahkan habit untuk mulai melacak.";
      td.style.padding = "16px";
      td.style.color = "#6b6b6b";
      tr.appendChild(td);
      trackerTable.appendChild(tr);
      return;
    }

    // Header
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "corner";
    corner.textContent = "Habit";
    hr.appendChild(corner);

    for (let d = 1; d <= total; d++) {
      const th = document.createElement("th");
      const wd = new Date(y, m, d).getDay();
      const isToday = isCurrentMonth && d === todayDate;
      if (isToday) th.classList.add("today");
      th.innerHTML = `${d}<small>${isToday ? "•" : DAYS_SHORT[wd][0]}</small>`;
      hr.appendChild(th);
    }
    const rateHead = document.createElement("th");
    rateHead.textContent = "%";
    hr.appendChild(rateHead);
    thead.appendChild(hr);
    trackerTable.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");
    state.habits.forEach((h) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      const dot = `<span class="habit-color" style="display:inline-block;vertical-align:middle;margin-right:8px;background:${h.color}"></span>`;
      th.innerHTML = dot + escapeHtml(h.name);
      tr.appendChild(th);

      let done = 0;
      for (let d = 1; d <= total; d++) {
        const td = document.createElement("td");
        const wd = new Date(y, m, d).getDay();
        if (wd === 0 || wd === 6) td.classList.add("weekend");
        if (isCurrentMonth && d === todayDate) td.classList.add("today-col");

        const cell = document.createElement("div");
        cell.className = "cell";
        const checked = isChecked(h.id, d);
        if (checked) {
          cell.classList.add("checked");
          done++;
        }
        cell.style.setProperty("--done", h.color);
        if (checked) {
          cell.style.background = h.color;
          cell.style.borderColor = h.color;
        }
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-label", `${h.name} tanggal ${d}`);
        cell.addEventListener("click", () => {
          toggle(h.id, d);
          renderTracker();
          renderOverview();
          renderHabits();
        });
        td.appendChild(cell);
        tr.appendChild(td);
      }

      const rate = document.createElement("td");
      rate.className = "row-rate";
      rate.textContent = Math.round((done / total) * 100) + "%";
      tr.appendChild(rate);

      tbody.appendChild(tr);
    });
    trackerTable.appendChild(tbody);
  }

  function renderOverview() {
    const y = view.year,
      m = view.month;
    const total = daysInMonth(y, m);
    const habitCount = state.habits.length;

    let totalChecks = 0;
    let bestStreak = 0;

    // per-day completeness for month progress & streak
    let daysFullyDone = 0;
    let currentStreak = 0;

    for (let d = 1; d <= total; d++) {
      let dayDone = 0;
      state.habits.forEach((h) => {
        if (isChecked(h.id, d)) {
          dayDone++;
          totalChecks++;
        }
      });
      const complete = habitCount > 0 && dayDone === habitCount;
      if (complete) {
        daysFullyDone++;
        currentStreak++;
        if (currentStreak > bestStreak) bestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    const maxChecks = total * habitCount;
    const percent = maxChecks ? Math.round((totalChecks / maxChecks) * 100) : 0;

    el("monthPercent").textContent = percent + "%";
    el("monthProgress").style.width = percent + "%";
    el("daysDone").textContent = daysFullyDone;
    el("daysTotal").textContent = total;
    el("streak").textContent = bestStreak;
    el("habitCount").textContent = habitCount;
  }

  function escapeHtml(s) {
    return s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  // ---------- Actions ----------
  function addHabit(name) {
    name = name.trim();
    if (!name) return;
    const color = PALETTE[state.habits.length % PALETTE.length];
    state.habits.push({ id: uid(), name, color });
    save();
    renderAll();
  }

  function removeHabit(id) {
    if (!confirm("Hapus habit ini? Riwayat centangnya juga akan hilang."))
      return;
    state.habits = state.habits.filter((h) => h.id !== id);
    Object.keys(state.checks).forEach((k) => {
      delete state.checks[k][id];
    });
    save();
    renderAll();
  }

  function changeMonth(delta) {
    let m = view.month + delta;
    let y = view.year;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    view.month = m;
    view.year = y;
    renderAll();
  }

  function resetMonth() {
    if (!confirm(`Hapus semua centang di ${MONTHS[view.month]} ${view.year}?`))
      return;
    delete state.checks[monthKey()];
    save();
    renderAll();
  }

  // ---------- Theme ----------
  const THEME_KEY = "habitBuilder.theme";
  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.setAttribute(
      "data-theme",
      dark ? "dark" : "light",
    );
    const btn = el("themeBtn");
    if (btn) btn.textContent = dark ? "☀️" : "🌙";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0e0f12" : "#111111");
  }
  function initTheme() {
    let t = null;
    try {
      t = localStorage.getItem(THEME_KEY);
    } catch (e) {}
    if (!t) {
      t =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }
    applyTheme(t);
  }
  function toggleTheme() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = dark ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
    applyTheme(next);
  }

  // ---------- Export / Import ----------
  function exportData() {
    const payload = {
      app: "HabitBuilder",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `habit-builder-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = parsed && parsed.data ? parsed.data : parsed;
        if (!incoming || !Array.isArray(incoming.habits)) {
          alert("File tidak valid. Pastikan file backup Habit Builder.");
          return;
        }
        if (!confirm("Impor akan mengganti semua data saat ini. Lanjutkan?"))
          return;
        state = {
          habits: incoming.habits,
          checks: incoming.checks || {},
        };
        save();
        renderAll();
        alert("Data berhasil diimpor.");
      } catch (e) {
        alert("Gagal membaca file. Format JSON tidak valid.");
      }
    };
    reader.readAsText(file);
  }

  // ---------- Events ----------
  el("prevMonth").addEventListener("click", () => changeMonth(-1));
  el("nextMonth").addEventListener("click", () => changeMonth(1));
  monthTitle.addEventListener("click", () => {
    view.year = new Date().getFullYear();
    view.month = new Date().getMonth();
    renderAll();
  });
  el("resetMonth").addEventListener("click", resetMonth);

  el("themeBtn").addEventListener("click", toggleTheme);
  el("exportBtn").addEventListener("click", exportData);
  el("importBtn").addEventListener("click", () => el("importFile").click());
  el("importFile").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importData(file);
    e.target.value = "";
  });

  el("addHabitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = el("habitInput");
    addHabit(input.value);
    input.value = "";
    input.focus();
  });

  // ---------- PWA install ----------
  let deferredPrompt = null;
  const installBtn = el("installBtn");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  // ---------- Init ----------
  initTheme();
  renderAll();
})();
