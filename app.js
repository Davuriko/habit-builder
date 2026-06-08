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
    "#fdf10c",
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
    "Bereskan tempat tidur",
    "Mandi Pagi",
    "Sarapan Pagi",
    "Olahraga",
    "Mandi Sore",
    "Minum air 2L",
    "Tidur cukup",
  ];

  const DEFAULT_BUDGET_CATS = [
    { name: "Bensin", daily: 10000 },
    { name: "Makan", daily: 5000 },
    { name: "Jajan", daily: 10000 },
  ];

  // ---------- State ----------
  let state = normalize(load());
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

  // Ensure the state has every field the current app version expects.
  // Seeds sample budget categories only on a brand-new (no-budget) state.
  function normalize(s) {
    if (!s || typeof s !== "object") s = {};
    if (!Array.isArray(s.habits)) s.habits = [];
    if (!s.checks || typeof s.checks !== "object") s.checks = {};
    if (!s.budget || typeof s.budget !== "object") {
      s.budget = {
        cats: DEFAULT_BUDGET_CATS.map((c, i) => ({
          id: uid(),
          name: c.name,
          color: PALETTE[(i + 1) % PALETTE.length],
          daily: c.daily,
        })),
        // spend["YYYY-M-D"][catId] = jumlah pengeluaran (Rp) hari itu
        spend: {},
      };
    }
    if (!Array.isArray(s.budget.cats)) s.budget.cats = [];
    if (!s.budget.spend || typeof s.budget.spend !== "object")
      s.budget.spend = {};
    // extra[] = pemasukan tak terduga di luar kategori
    // { id, date: "YYYY-M-D", label, amount }
    if (!Array.isArray(s.budget.extra)) s.budget.extra = [];

    // catchup: pelacak progres kemarin yang terlewat
    // { addressed:{"Y-M-D":true}, lastPromptDay:"Y-M-D", log:[...] }
    if (!s.catchup || typeof s.catchup !== "object") {
      s.catchup = { addressed: {}, lastPromptDay: todayKey(), log: [] };
    }
    if (!s.catchup.addressed || typeof s.catchup.addressed !== "object")
      s.catchup.addressed = {};
    if (typeof s.catchup.lastPromptDay !== "string")
      s.catchup.lastPromptDay = "";
    if (!Array.isArray(s.catchup.log)) s.catchup.log = [];
    return s;
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

  // ---------- Catch-up (progres kemarin) helpers ----------
  // Info hari kemarin
  function prevDayInfo() {
    const t = new Date();
    t.setDate(t.getDate() - 1);
    const y = t.getFullYear(),
      m = t.getMonth(),
      d = t.getDate();
    return {
      y,
      m,
      d,
      key: `${y}-${m}-${d}`,
      label: `${DAYS_SHORT[t.getDay()]}, ${d} ${MONTHS[m]} ${y}`,
    };
  }

  // Daftar habit yang belum dicentang pada tanggal tertentu
  function missedHabitsOn(y, m, d) {
    const mc = state.checks[`${y}-${m}`];
    return state.habits.filter((h) => !(mc && mc[h.id] && mc[h.id][d]));
  }

  // Set/hapus centang pada tanggal spesifik (lintas bulan)
  function setCheckOn(y, m, d, habitId, val) {
    const k = `${y}-${m}`;
    if (!state.checks[k]) state.checks[k] = {};
    if (!state.checks[k][habitId]) state.checks[k][habitId] = {};
    if (val) state.checks[k][habitId][d] = true;
    else delete state.checks[k][habitId][d];
  }

  // ---------- Budget (RAB) helpers ----------
  function todayParts() {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
  }

  function todayKey() {
    const { y, m, d } = todayParts();
    return `${y}-${m}-${d}`;
  }

  function todayStartTime() {
    const { y, m, d } = todayParts();
    return new Date(y, m, d).getTime();
  }

  // Parse "YYYY-M-D" -> timestamp at local midnight
  function spendKeyTime(key) {
    const p = key.split("-").map(Number);
    if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return NaN;
    return new Date(p[0], p[1], p[2]).getTime();
  }

  function spentOn(catId, key) {
    const day = state.budget.spend[key];
    const v = day && day[catId];
    return typeof v === "number" && isFinite(v) ? v : 0;
  }

  // Sisa anggaran kategori untuk hari ini (bisa minus = nombok dari tabungan)
  function remainingToday(cat) {
    return cat.daily - spentOn(cat.id, todayKey());
  }

  // Tabungan terkumpul: akumulasi (anggaran - pengeluaran) dari hari-hari
  // yang sudah lewat. Sisa positif menambah, kekurangan mengurangi.
  function savings(cat) {
    const cutoff = todayStartTime();
    let total = 0;
    for (const key of Object.keys(state.budget.spend)) {
      const t = spendKeyTime(key);
      if (!isNaN(t) && t < cutoff) {
        total += cat.daily - spentOn(cat.id, key);
      }
    }
    return total;
  }

  // Saldo nyata saat ini = tabungan + sisa hari ini
  function available(cat) {
    return savings(cat) + remainingToday(cat);
  }

  function ensureTodaySpend() {
    const k = todayKey();
    if (!state.budget.spend[k]) state.budget.spend[k] = {};
    return state.budget.spend[k];
  }

  function formatRp(n) {
    const v = Math.round(Math.abs(n));
    return (n < 0 ? "−" : "") + "Rp" + v.toLocaleString("id-ID");
  }

  function addBudgetCat(name, daily) {
    name = (name || "").trim();
    daily = Math.max(0, Math.round(Number(daily) || 0));
    if (!name) return;
    const color = PALETTE[(state.budget.cats.length + 1) % PALETTE.length];
    state.budget.cats.push({ id: uid(), name, color, daily });
    save();
    renderBudget();
  }

  function removeBudgetCat(id) {
    if (!confirm("Hapus kategori ini beserta riwayat pengeluarannya?")) return;
    state.budget.cats = state.budget.cats.filter((c) => c.id !== id);
    Object.keys(state.budget.spend).forEach((k) => {
      delete state.budget.spend[k][id];
    });
    save();
    renderBudget();
  }

  function setCatDaily(id, daily) {
    const cat = state.budget.cats.find((c) => c.id === id);
    if (!cat) return;
    cat.daily = Math.max(0, Math.round(Number(daily) || 0));
    save();
    renderBudget();
  }

  function spendOnCat(id, amount) {
    amount = Math.round(Number(amount) || 0);
    if (!amount) return;
    const day = ensureTodaySpend();
    day[id] = Math.max(0, (day[id] || 0) + amount);
    save();
    renderBudget();
  }

  function resetCatToday(id) {
    const day = state.budget.spend[todayKey()];
    if (day && day[id]) {
      delete day[id];
      save();
      renderBudget();
    }
  }

  // ---------- Pemasukan tak terduga (extra income) ----------
  function extraTotal() {
    return state.budget.extra.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }

  function extraForKey(key) {
    return state.budget.extra.filter((e) => e.date === key);
  }

  // Total pengeluaran sepanjang waktu (semua hari, semua kategori)
  function expenseTotalAll() {
    let total = 0;
    Object.keys(state.budget.spend).forEach((key) => {
      const day = state.budget.spend[key];
      Object.keys(day).forEach((catId) => {
        const v = Number(day[catId]) || 0;
        if (v > 0) total += v;
      });
    });
    return total;
  }

  function addExtraIncome(dateStr, label, amount) {
    amount = Math.max(0, Math.round(Number(amount) || 0));
    label = (label || "").trim();
    if (!amount) return false;
    // dateStr berbentuk "YYYY-MM-DD" dari input type=date
    let key;
    if (dateStr) {
      const p = dateStr.split("-").map(Number);
      key = `${p[0]}-${p[1] - 1}-${p[2]}`;
    } else {
      key = todayKey();
    }
    state.budget.extra.push({
      id: uid(),
      date: key,
      label: label || "Pemasukan",
      amount,
    });
    save();
    renderBudget();
    renderIncomeModal();
    return true;
  }

  function removeExtraIncome(id) {
    state.budget.extra = state.budget.extra.filter((e) => e.id !== id);
    save();
    renderBudget();
    renderIncomeModal();
  }

  // ---------- DOM refs ----------
  const el = (id) => document.getElementById(id);
  const monthTitle = el("monthTitle");
  const habitList = el("habitList");
  const trackerTable = el("trackerTable");
  const catList = el("catList");

  // ---------- Rendering ----------
  function renderAll() {
    renderMonthTitle();
    renderHabits();
    renderTracker();
    renderOverview();
    renderChart();
    renderBudget();
    renderIncomeModal();
    renderExpenseModal();
    renderProgressLog();
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
    const todayStart = todayStartTime();

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

        const isPast = new Date(y, m, d).getTime() < todayStart;
        if (isPast) {
          // Hari yang sudah lewat dikunci — tidak bisa diisi manual lagi.
          cell.classList.add("locked");
          cell.setAttribute(
            "aria-label",
            `${h.name} tanggal ${d} (sudah lewat, terkunci)`,
          );
          cell.title = "Hari sudah lewat — terkunci";
        } else {
          cell.setAttribute("role", "button");
          cell.setAttribute("aria-label", `${h.name} tanggal ${d}`);
          cell.addEventListener("click", () => {
            toggle(h.id, d);
            renderTracker();
            renderOverview();
            renderChart();
            renderHabits();
          });
        }
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

  function renderChart() {
    const svg = el("progressChart");
    if (!svg) return;

    const y = view.year,
      m = view.month;
    const total = daysInMonth(y, m);
    const habitCount = state.habits.length;
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;
    const todayDate = today.getDate();

    // Data per hari: jumlah habit selesai & persentase
    const counts = [];
    const data = [];
    for (let d = 1; d <= total; d++) {
      let done = 0;
      state.habits.forEach((h) => {
        if (isChecked(h.id, d)) done++;
      });
      counts.push(done);
      data.push(habitCount ? (done / habitCount) * 100 : 0);
    }

    // Statistik ringkas di atas grafik
    const sumPct = data.reduce((a, b) => a + b, 0);
    const avg = total ? sumPct / total : 0;
    const bestDay = data.reduce((acc, v, i) => (v > acc.v ? { v, i } : acc), {
      v: -1,
      i: 0,
    });
    const activeDays = counts.filter((c) => c > 0).length;
    const bestCount =
      bestDay.v > 0
        ? data.filter((v) => Math.round(v) === Math.round(bestDay.v)).length
        : 0;
    const statsEl = el("chartStats");
    if (statsEl) {
      statsEl.innerHTML = "";
      const mk = (label, value) => {
        const box = document.createElement("div");
        box.className = "chart-stat";
        const l = document.createElement("span");
        l.className = "chart-stat-label";
        l.textContent = label;
        const v = document.createElement("strong");
        v.className = "chart-stat-value";
        v.textContent = value;
        box.append(l, v);
        return box;
      };
      statsEl.append(
        mk("Rata-rata harian", Math.round(avg) + "%"),
        mk("Hari aktif", `${activeDays}/${total}`),
        mk(
          "Hari terbaik",
          bestDay.v > 0 ? `${Math.round(bestDay.v)}% (${bestCount})` : "—",
        ),
      );
    }

    // Dimensi viewBox
    const W = 600,
      H = 240;
    const padL = 36,
      padR = 14,
      padT = 16,
      padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Lebar slot per hari (untuk bar & area hover)
    const slot = plotW / total;
    const xAt = (i) => padL + slot * (i + 0.5);
    const yAt = (v) => padT + plotH - (v / 100) * plotH;

    const NS = "http://www.w3.org/2000/svg";
    const mkEl = (name, attrs, cls) => {
      const e = document.createElementNS(NS, name);
      if (cls) e.setAttribute("class", cls);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    };
    svg.innerHTML = "";

    // Sorot kolom akhir pekan
    for (let d = 1; d <= total; d++) {
      const wd = new Date(y, m, d).getDay();
      if (wd === 0 || wd === 6) {
        svg.appendChild(
          mkEl(
            "rect",
            {
              x: padL + slot * (d - 1),
              y: padT,
              width: slot,
              height: plotH,
            },
            "chart-weekend",
          ),
        );
      }
    }

    // Gridlines + label sumbu Y tiap 25%
    [0, 25, 50, 75, 100].forEach((v) => {
      const gy = yAt(v);
      svg.appendChild(
        mkEl("line", { x1: padL, x2: W - padR, y1: gy, y2: gy }, "chart-grid"),
      );
      const lbl = mkEl(
        "text",
        { x: padL - 7, y: gy + 3, "text-anchor": "end" },
        "chart-axis",
      );
      lbl.textContent = v + "%";
      svg.appendChild(lbl);
    });

    // Bar jumlah habit selesai (skala relatif terhadap total habit)

    if (total > 0) {
      const linePts = data.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
      const areaPts = `${xAt(0)},${yAt(0)} ${linePts} ${xAt(total - 1)},${yAt(0)}`;

      svg.appendChild(mkEl("polygon", { points: areaPts }, "chart-area"));
      svg.appendChild(mkEl("polyline", { points: linePts }, "chart-line"));

      // Garis rata-rata (putus-putus)
      const ay = yAt(avg);
      svg.appendChild(
        mkEl("line", { x1: padL, x2: W - padR, y1: ay, y2: ay }, "chart-avg"),
      );

      // Titik per hari + sorot hari ini
      data.forEach((v, i) => {
        const day = i + 1;
        const isToday = isCurrentMonth && day === todayDate;
        const dot = mkEl(
          "circle",
          { cx: xAt(i), cy: yAt(v), r: isToday ? 4.5 : 2.6 },
          isToday ? "chart-dot chart-dot--today" : "chart-dot",
        );
        svg.appendChild(dot);
      });

      // Garis vertikal hari ini
      if (isCurrentMonth && todayDate <= total) {
        svg.appendChild(
          mkEl(
            "line",
            {
              x1: xAt(todayDate - 1),
              x2: xAt(todayDate - 1),
              y1: padT,
              y2: padT + plotH,
            },
            "chart-today-line",
          ),
        );
      }
    }

    // Label sumbu X (tiap 2 hari bila muat, jika tidak tiap 5)
    const step = total > 16 ? 5 : 2;
    for (let d = 1; d <= total; d += step) {
      const tx = mkEl(
        "text",
        { x: xAt(d - 1), y: H - 10, "text-anchor": "middle" },
        "chart-axis",
      );
      tx.textContent = d;
      svg.appendChild(tx);
    }

    // ---- Interaksi hover/tap: tooltip ----
    const tip = el("chartTooltip");
    const hoverLine = mkEl(
      "line",
      { x1: 0, x2: 0, y1: padT, y2: padT + plotH },
      "chart-hover-line",
    );
    hoverLine.style.display = "none";
    svg.appendChild(hoverLine);

    const focusDot = mkEl("circle", { r: 5 }, "chart-focus-dot");
    focusDot.style.display = "none";
    svg.appendChild(focusDot);

    const overlay = mkEl(
      "rect",
      { x: padL, y: padT, width: plotW, height: plotH, fill: "transparent" },
      "chart-overlay",
    );
    svg.appendChild(overlay);

    const showAt = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const xRatio = (clientX - rect.left) / rect.width;
      let idx = Math.floor(xRatio * total);
      if (idx < 0) idx = 0;
      if (idx > total - 1) idx = total - 1;
      const day = idx + 1;
      const wd = new Date(y, m, day).getDay();

      const cx = xAt(idx);
      hoverLine.setAttribute("x1", cx);
      hoverLine.setAttribute("x2", cx);
      hoverLine.style.display = "";
      focusDot.setAttribute("cx", cx);
      focusDot.setAttribute("cy", yAt(data[idx]));
      focusDot.style.display = "";

      if (tip) {
        tip.hidden = false;
        tip.innerHTML =
          `<strong>${DAYS_SHORT[wd]}, ${day} ${MONTHS[m]}</strong>` +
          `<span>${Math.round(data[idx])}% · ${counts[idx]}/${habitCount} habit</span>`;
        // Posisikan relatif ke chart-wrap
        const wrapRect = svg.parentElement.getBoundingClientRect();
        const px = (cx / W) * wrapRect.width;
        tip.style.left = px + "px";
        tip.style.top = (yAt(data[idx]) / H) * wrapRect.height + "px";
      }
    };
    const hide = () => {
      hoverLine.style.display = "none";
      focusDot.style.display = "none";
      if (tip) tip.hidden = true;
    };

    overlay.addEventListener("mousemove", (e) => showAt(e.clientX));
    overlay.addEventListener("mouseleave", hide);
    overlay.addEventListener("touchstart", (e) => {
      if (e.touches[0]) showAt(e.touches[0].clientX);
    });
    overlay.addEventListener("touchmove", (e) => {
      if (e.touches[0]) showAt(e.touches[0].clientX);
    });
    overlay.addEventListener("touchend", hide);
  }

  function renderBudget() {
    // Pastikan catatan hari ini ada agar sisanya ikut terbukukan esok hari.
    ensureTodaySpend();

    const t = new Date();
    const todayLabel = el("rabToday");
    if (todayLabel) {
      todayLabel.textContent = `${DAYS_SHORT[t.getDay()]}, ${t.getDate()} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
    }

    const cats = state.budget.cats;
    let totSavings = 0,
      totRemaining = 0,
      totAvailable = 0,
      totSpentToday = 0;
    const tKey = todayKey();
    cats.forEach((c) => {
      totSavings += savings(c);
      totRemaining += remainingToday(c);
      totAvailable += available(c);
      totSpentToday += spentOn(c.id, tKey);
    });

    setMoney("rabAvailable", totAvailable);
    setMoney("rabSavings", totSavings);
    setMoney("rabRemaining", totRemaining);
    setMoney("rabSpentToday", totSpentToday);
    setMoney("totalSavings", totAvailable + extraTotal());
    setMoney("totalExpense", expenseTotalAll());

    catList.innerHTML = "";
    if (cats.length === 0) {
      const li = document.createElement("li");
      li.className = "empty-hint";
      li.textContent =
        "Belum ada kategori. Tambahkan rencana anggaran harianmu di atas.";
      catList.appendChild(li);
      return;
    }

    cats.forEach((cat) => {
      const li = document.createElement("li");
      li.className = "cat-item";

      // Baris 1: warna, nama, hapus
      const row1 = document.createElement("div");
      row1.className = "cat-row1";

      const color = document.createElement("span");
      color.className = "habit-color";
      color.style.background = cat.color;

      const name = document.createElement("span");
      name.className = "cat-name";
      name.textContent = cat.name;

      const del = document.createElement("button");
      del.className = "habit-del";
      del.type = "button";
      del.title = "Hapus kategori";
      del.textContent = "✕";
      del.addEventListener("click", () => removeBudgetCat(cat.id));

      row1.append(color, name, del);

      // Baris 2: anggaran/hari, sisa hari ini, tabungan
      const row2 = document.createElement("div");
      row2.className = "cat-row2";

      const fBudget = field("Anggaran/hari");
      const dailyWrap = rpInput(cat.daily, "cat-daily");
      const dailyInput = dailyWrap.querySelector("input");
      dailyInput.addEventListener("change", () =>
        setCatDaily(cat.id, dailyInput.value),
      );
      fBudget.appendChild(dailyWrap);

      const rem = remainingToday(cat);
      const fRem = field("Sisa hari ini");
      const remVal = document.createElement("strong");
      remVal.className = "cat-amount " + (rem < 0 ? "neg" : "pos");
      remVal.textContent = formatRp(rem);
      fRem.appendChild(remVal);

      const spent = spentOn(cat.id, tKey);
      const fSpent = field("Pengeluaran hari ini");
      const spentVal = document.createElement("strong");
      spentVal.className = "cat-amount spend";
      spentVal.textContent = formatRp(spent);
      fSpent.appendChild(spentVal);

      const sav = savings(cat);
      const fSav = field("Tabungan");
      const savVal = document.createElement("strong");
      savVal.className = "cat-amount save " + (sav < 0 ? "neg" : "");
      savVal.textContent = formatRp(sav);
      fSav.appendChild(savVal);

      row2.append(fBudget, fSpent, fRem, fSav);

      // Baris 3: input pengeluaran + tombol
      const row3 = document.createElement("div");
      row3.className = "cat-row3";

      const spendWrap = rpInput("", "cat-spend");
      const spendInput = spendWrap.querySelector("input");
      spendInput.placeholder = "0";
      spendInput.min = "0";

      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "primary-btn";
      useBtn.textContent = "Pakai";
      const doUse = () => {
        spendOnCat(cat.id, spendInput.value);
        spendInput.value = "";
      };
      useBtn.addEventListener("click", doUse);
      spendInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doUse();
        }
      });

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "link-btn";
      resetBtn.textContent = "Reset hari";
      resetBtn.addEventListener("click", () => resetCatToday(cat.id));

      row3.append(spendWrap, useBtn, resetBtn);

      li.append(row1, row2, row3);
      catList.appendChild(li);
    });
  }

  function setMoney(id, n) {
    const node = el(id);
    if (!node) return;
    node.textContent = formatRp(n);
    node.classList.toggle("neg", n < 0);
  }

  function field(label) {
    const wrap = document.createElement("div");
    wrap.className = "cat-field";
    const span = document.createElement("span");
    span.className = "cat-field-label";
    span.textContent = label;
    wrap.appendChild(span);
    return wrap;
  }

  function rpInput(value, cls) {
    const wrap = document.createElement("div");
    wrap.className = "rp-input";
    const prefix = document.createElement("span");
    prefix.textContent = "Rp";
    const input = document.createElement("input");
    input.type = "number";
    input.step = "500";
    input.inputMode = "numeric";
    input.className = cls;
    if (value !== "" && value != null) input.value = value;
    wrap.append(prefix, input);
    return wrap;
  }

  // ---------- Modal rincian pemasukan ----------
  function openModalEl(overlay) {
    overlay.hidden = false;
    document.body.classList.add("modal-open");
    // Re-trigger animasi buka tiap kali dibuka
    overlay.classList.remove("opening");
    // force reflow agar animasi ulang
    void overlay.offsetWidth;
    overlay.classList.add("opening");
  }

  function openIncomeModal() {
    // Default tanggal pemasukan tak terduga = hari ini
    const dateInput = el("extraDate");
    if (dateInput) {
      const { y, m, d } = todayParts();
      dateInput.value = `${y}-${String(m + 1).padStart(2, "0")}-${String(
        d,
      ).padStart(2, "0")}`;
    }
    openModalEl(el("incomeModal"));
    renderIncomeModal();
  }

  function closeIncomeModal() {
    el("incomeModal").hidden = true;
    document.body.classList.remove("modal-open");
  }

  function renderIncomeModal() {
    const overlay = el("incomeModal");
    if (!overlay || overlay.hidden) return;

    const y = view.year,
      m = view.month;
    const total = daysInMonth(y, m);
    const cats = state.budget.cats;

    el("incomeModalTitle").textContent =
      `Rincian Pemasukan — ${MONTHS[m]} ${y}`;

    const listEl = el("incomeList");
    listEl.innerHTML = "";

    let monthTotal = 0;
    let anyRow = false;

    for (let d = 1; d <= total; d++) {
      const key = `${y}-${m}-${d}`;
      const hasSpend = !!state.budget.spend[key];
      const extras = extraForKey(key);
      if (!hasSpend && extras.length === 0) continue;

      // Item per kategori: sisa anggaran hari itu (pemasukan/defisit)
      const items = [];
      let dayTotal = 0;

      if (hasSpend) {
        cats.forEach((c) => {
          const leftover = c.daily - spentOn(c.id, key);
          if (leftover !== 0) {
            items.push({
              label: c.name,
              color: c.color,
              amount: leftover,
            });
            dayTotal += leftover;
          }
        });
      }

      extras.forEach((e) => {
        items.push({
          label: e.label,
          color: "var(--good)",
          amount: e.amount,
          extraId: e.id,
        });
        dayTotal += Number(e.amount) || 0;
      });

      if (items.length === 0) continue;
      anyRow = true;
      monthTotal += dayTotal;

      const wd = new Date(y, m, d).getDay();
      const dayBox = document.createElement("div");
      dayBox.className = "income-day";

      const head = document.createElement("div");
      head.className = "income-day-head";
      const dLabel = document.createElement("span");
      dLabel.className = "income-day-date";
      dLabel.textContent = `${DAYS_SHORT[wd]}, ${d} ${MONTHS[m]}`;
      const dSum = document.createElement("strong");
      dSum.className = "income-day-sum " + (dayTotal < 0 ? "neg" : "pos");
      dSum.textContent = formatRp(dayTotal);
      head.append(dLabel, dSum);
      dayBox.appendChild(head);

      items.forEach((it) => {
        const row = document.createElement("div");
        row.className = "income-item";

        const dot = document.createElement("span");
        dot.className = "income-dot";
        dot.style.background = it.color;

        const lbl = document.createElement("span");
        lbl.className = "income-item-label";
        lbl.textContent = it.label;

        const amt = document.createElement("span");
        amt.className = "income-item-amount " + (it.amount < 0 ? "neg" : "pos");
        amt.textContent = formatRp(it.amount);

        row.append(dot, lbl, amt);

        if (it.extraId) {
          const del = document.createElement("button");
          del.type = "button";
          del.className = "income-del";
          del.title = "Hapus pemasukan";
          del.textContent = "✕";
          del.addEventListener("click", () => removeExtraIncome(it.extraId));
          row.appendChild(del);
        }

        dayBox.appendChild(row);
      });

      listEl.appendChild(dayBox);
    }

    if (!anyRow) {
      const empty = document.createElement("div");
      empty.className = "empty-hint";
      empty.textContent =
        "Belum ada pemasukan bulan ini. Catat pengeluaran kategori atau tambah pemasukan tak terduga.";
      listEl.appendChild(empty);
    }

    setMoney("incomeMonthTotal", monthTotal);
  }

  // ---------- Modal rincian pengeluaran ----------
  function openExpenseModal() {
    openModalEl(el("expenseModal"));
    renderExpenseModal();
  }

  function closeExpenseModal() {
    el("expenseModal").hidden = true;
    document.body.classList.remove("modal-open");
  }

  function renderExpenseModal() {
    const overlay = el("expenseModal");
    if (!overlay || overlay.hidden) return;

    const y = view.year,
      m = view.month;
    const total = daysInMonth(y, m);
    const cats = state.budget.cats;

    el("expenseModalTitle").textContent =
      `Rincian Pengeluaran — ${MONTHS[m]} ${y}`;

    const listEl = el("expenseList");
    listEl.innerHTML = "";

    let monthTotal = 0;
    let anyRow = false;

    for (let d = 1; d <= total; d++) {
      const key = `${y}-${m}-${d}`;
      const day = state.budget.spend[key];
      if (!day) continue;

      const items = [];
      let dayTotal = 0;

      cats.forEach((c) => {
        const spent = spentOn(c.id, key);
        if (spent > 0) {
          items.push({ label: c.name, color: c.color, amount: spent });
          dayTotal += spent;
        }
      });

      if (items.length === 0) continue;
      anyRow = true;
      monthTotal += dayTotal;

      const wd = new Date(y, m, d).getDay();
      const dayBox = document.createElement("div");
      dayBox.className = "income-day";

      const head = document.createElement("div");
      head.className = "income-day-head";
      const dLabel = document.createElement("span");
      dLabel.className = "income-day-date";
      dLabel.textContent = `${DAYS_SHORT[wd]}, ${d} ${MONTHS[m]}`;
      const dSum = document.createElement("strong");
      dSum.className = "income-day-sum neg";
      dSum.textContent = formatRp(dayTotal);
      head.append(dLabel, dSum);
      dayBox.appendChild(head);

      items.forEach((it) => {
        const row = document.createElement("div");
        row.className = "income-item";

        const dot = document.createElement("span");
        dot.className = "income-dot";
        dot.style.background = it.color;

        const lbl = document.createElement("span");
        lbl.className = "income-item-label";
        lbl.textContent = it.label;

        const amt = document.createElement("span");
        amt.className = "income-item-amount neg";
        amt.textContent = formatRp(it.amount);

        row.append(dot, lbl, amt);
        dayBox.appendChild(row);
      });

      listEl.appendChild(dayBox);
    }

    if (!anyRow) {
      const empty = document.createElement("div");
      empty.className = "empty-hint";
      empty.textContent =
        "Belum ada pengeluaran bulan ini. Catat pemakaian uang lewat tombol Pakai di tiap kategori.";
      listEl.appendChild(empty);
    }

    setMoney("expenseMonthTotal", monthTotal);
  }

  // ---------- Catch-up: progres kemarin ----------
  const CATCHUP_OPTIONS = [
    { value: "lupa", label: "Saya lupa mengisinya", refill: true },
    { value: "sibuk", label: "Saya sedang sibuk", refill: true },
    { value: "berhalangan", label: "Saya sedang berhalangan", refill: false },
    { value: "lainnya", label: "Alasan lainnya", refill: false },
  ];
  const CATCHUP_CHEERS = [
    "Tidak apa-apa, hari baru adalah kesempatan baru. Semangat! 💪",
    "Langkah kecil tetap berarti. Lanjutkan, kamu hebat! ✨",
    "Konsistensi mengalahkan kesempurnaan. Ayo lanjut! 🚀",
    "Bangkit lagi lebih kuat. Aku percaya padamu! 🌟",
    "Setiap hari adalah progres. Tetap semangat! 🔥",
  ];

  let catchupTarget = null; // { y, m, d, key, label, missed:[habits] }
  let catchupReason = null;

  // Tampilkan pop-up bila kemarin ada progres yang terlewat (sekali per hari).
  function maybeShowCatchup() {
    if (state.habits.length === 0) return;
    const prev = prevDayInfo();
    const tk = todayKey();
    // Sudah pernah ditanyakan hari ini → jangan ganggu lagi.
    if (state.catchup.lastPromptDay === tk) return;
    // Hari kemarin sudah pernah dijawab.
    if (state.catchup.addressed[prev.key]) return;
    const missed = missedHabitsOn(prev.y, prev.m, prev.d);
    if (missed.length === 0) {
      // Tidak ada yang terlewat → tandai sudah dilihat hari ini.
      state.catchup.lastPromptDay = tk;
      save();
      return;
    }
    catchupTarget = { ...prev, missed };
    catchupReason = null;
    state.catchup.lastPromptDay = tk;
    save();
    openCatchupModal();
  }

  function openCatchupModal() {
    if (!catchupTarget) return;
    const intro = el("catchupIntro");
    if (intro) {
      intro.textContent =
        `Kemarin (${catchupTarget.label}) progresmu belum penuh. ` +
        `Apa kabar? Boleh cerita kenapa belum sempat terisi?`;
    }

    // Daftar progres yang terlewat
    const missedList = el("catchupMissedList");
    if (missedList) {
      missedList.innerHTML = "";
      catchupTarget.missed.forEach((h) => {
        const li = document.createElement("li");
        const dot = document.createElement("span");
        dot.className = "catchup-dot";
        dot.style.background = h.color;
        const name = document.createElement("span");
        name.textContent = h.name;
        li.append(dot, name);
        missedList.appendChild(li);
      });
    }

    // Opsi alasan
    const optsEl = el("catchupOptions");
    if (optsEl) {
      optsEl.innerHTML = "";
      CATCHUP_OPTIONS.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "catchup-option";
        btn.textContent = opt.label;
        btn.dataset.value = opt.value;
        btn.addEventListener("click", () => selectCatchupReason(opt));
        optsEl.appendChild(btn);
      });
    }

    // Reset bagian dinamis
    el("catchupReason").hidden = true;
    el("catchupReasonText").value = "";
    el("catchupRefill").hidden = true;
    el("catchupRefillList").innerHTML = "";
    el("catchupSend").disabled = true;
    el("catchupSuccess").hidden = true;

    openModalEl(el("catchupModal"));
  }

  function selectCatchupReason(opt) {
    catchupReason = opt;
    // Sorot opsi terpilih
    Array.from(el("catchupOptions").children).forEach((b) => {
      b.classList.toggle("selected", b.dataset.value === opt.value);
    });

    // Textarea hanya untuk "Alasan lainnya"
    el("catchupReason").hidden = opt.value !== "lainnya";

    // Checklist isi ulang hanya untuk "lupa" & "sibuk"
    const refillBox = el("catchupRefill");
    const refillList = el("catchupRefillList");
    refillList.innerHTML = "";
    if (opt.refill) {
      catchupTarget.missed.forEach((h) => {
        const lbl = document.createElement("label");
        lbl.className = "catchup-refill-item";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = h.id;
        const dot = document.createElement("span");
        dot.className = "catchup-dot";
        dot.style.background = h.color;
        const name = document.createElement("span");
        name.textContent = h.name;
        lbl.append(cb, dot, name);
        refillList.appendChild(lbl);
      });
      refillBox.hidden = false;
    } else {
      refillBox.hidden = true;
    }

    el("catchupSend").disabled = false;
  }

  function closeCatchupModal() {
    el("catchupModal").hidden = true;
    document.body.classList.remove("modal-open");
  }

  function submitCatchup() {
    if (!catchupTarget || !catchupReason) return;
    const { y, m, d, key, label } = catchupTarget;

    // Terapkan progres yang diisi ulang (untuk lupa/sibuk)
    const refilled = [];
    if (catchupReason.refill) {
      el("catchupRefillList")
        .querySelectorAll('input[type="checkbox"]:checked')
        .forEach((cb) => {
          const h = state.habits.find((x) => x.id === cb.value);
          if (h) {
            setCheckOn(y, m, d, h.id, true);
            refilled.push(h.name);
          }
        });
    }

    const note =
      catchupReason.value === "lainnya"
        ? el("catchupReasonText").value.trim()
        : "";

    // Simpan ke catatan progres
    state.catchup.log.unshift({
      key,
      label,
      reason: catchupReason.value,
      reasonLabel: catchupReason.label,
      note,
      refilled,
      at: Date.now(),
    });
    state.catchup.addressed[key] = true;
    save();
    renderAll();

    // Animasi pesan terkirim + penyemangat
    const cheer =
      CATCHUP_CHEERS[Math.floor(Math.random() * CATCHUP_CHEERS.length)];
    const successEl = el("catchupSuccess");
    el("catchupSuccessMsg").textContent = cheer;
    successEl.hidden = false;
    successEl.classList.remove("show");
    void successEl.offsetWidth;
    successEl.classList.add("show");

    setTimeout(closeCatchupModal, 2400);
  }

  // Tampilkan riwayat catatan progres (dari catch-up)
  function renderProgressLog() {
    const listEl = el("progressLog");
    if (!listEl) return;
    const log = state.catchup.log || [];

    const countEl = el("progressLogCount");
    if (countEl) {
      countEl.textContent = log.length ? `${log.length} catatan` : "";
    }

    listEl.innerHTML = "";

    if (log.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-hint";
      empty.textContent =
        "Belum ada catatan. Catatan muncul saat kamu menjawab pop-up progres kemarin.";
      listEl.appendChild(empty);
      return;
    }

    log.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "log-item";

      const head = document.createElement("div");
      head.className = "log-item-head";
      const date = document.createElement("span");
      date.className = "log-item-date";
      date.textContent = entry.label || entry.key;
      const reason = document.createElement("span");
      reason.className = "log-item-reason";
      reason.textContent = entry.reasonLabel || entry.reason || "";
      head.append(date, reason);
      item.appendChild(head);

      if (entry.note) {
        const note = document.createElement("div");
        note.className = "log-item-note";
        note.textContent = `“${entry.note}”`;
        item.appendChild(note);
      }

      if (entry.refilled && entry.refilled.length) {
        const refill = document.createElement("div");
        refill.className = "log-item-refill";
        refill.textContent = "Diisi ulang: " + entry.refilled.join(", ");
        item.appendChild(refill);
      }

      const del = document.createElement("button");
      del.className = "log-item-del";
      del.type = "button";
      del.setAttribute("aria-label", "Hapus catatan");
      del.title = "Hapus catatan";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        state.catchup.log = state.catchup.log.filter((e) => e !== entry);
        save();
        renderProgressLog();
      });
      item.appendChild(del);

      listEl.appendChild(item);
    });
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
        state = normalize({
          habits: incoming.habits,
          checks: incoming.checks || {},
          budget: incoming.budget,
        });
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

  el("addCatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = el("catName");
    const dailyInput = el("catDaily");
    addBudgetCat(nameInput.value, dailyInput.value);
    nameInput.value = "";
    dailyInput.value = "";
    nameInput.focus();
  });

  // ---------- Modal pemasukan ----------
  const savingsCard = el("savingsCard");
  if (savingsCard) {
    savingsCard.addEventListener("click", openIncomeModal);
    savingsCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openIncomeModal();
      }
    });
  }
  el("incomeModalClose").addEventListener("click", closeIncomeModal);
  el("incomeModal").addEventListener("click", (e) => {
    if (e.target === el("incomeModal")) closeIncomeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el("incomeModal").hidden) closeIncomeModal();
  });
  el("addExtraForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const dateInput = el("extraDate");
    const labelInput = el("extraLabel");
    const amountInput = el("extraAmount");
    const ok = addExtraIncome(
      dateInput.value,
      labelInput.value,
      amountInput.value,
    );
    if (ok) {
      labelInput.value = "";
      amountInput.value = "";
      labelInput.focus();
    }
  });

  // ---------- Modal pengeluaran ----------
  const expenseCard = el("expenseCard");
  if (expenseCard) {
    expenseCard.addEventListener("click", openExpenseModal);
    expenseCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openExpenseModal();
      }
    });
  }
  el("expenseModalClose").addEventListener("click", closeExpenseModal);
  el("expenseModal").addEventListener("click", (e) => {
    if (e.target === el("expenseModal")) closeExpenseModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el("expenseModal").hidden) closeExpenseModal();
  });

  // ---------- Modal catch-up (progres kemarin) ----------
  el("catchupClose").addEventListener("click", closeCatchupModal);
  el("catchupModal").addEventListener("click", (e) => {
    if (e.target === el("catchupModal")) closeCatchupModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el("catchupModal").hidden) closeCatchupModal();
  });
  el("catchupSend").addEventListener("click", submitCatchup);

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
  maybeShowCatchup();
})();
