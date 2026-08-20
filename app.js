(() => {
  "use strict";

  /* ---------- Constantes ---------- */
  const KEY_SUBJECTS = "aula.materias";
  const KEY_TASKS = "aula.tareas";
  const KEY_SEEDED = "aula.seed";
  const KEY_NOTIFIED = "aula.notified";

  const COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#ea580c", "#dc2626", "#eab308", "#0891b2", "#db2777"];
  const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const DOW_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const PRIORITY_LABEL = { alta: "Alta", media: "Media", baja: "Baja" };
  const STATUS_LABEL = { pendiente: "Pendiente", progreso: "En progreso", completada: "Completada" };

  /* ---------- Estado ---------- */
  const state = {
    view: "dashboard",
    subjectId: null,
    subjectTab: "tareas",
    calMode: "mes",
    calDate: new Date(),
    filter: "todas",
    filterSubject: "",
    filterPriority: "",
    filterDate: "",
    search: "",
    modalColor: COLORS[0],
    modalDays: [],
  };

  /* ---------- localStorage ---------- */
  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  let subjects = load(KEY_SUBJECTS, []).map(s => {
    if (s.dias && !s.horarios) {
      s.horarios = s.dias.map(d => ({ dia: d, horaInicio: s.horaInicio || "08:00", horaFin: s.horaFin || "10:00" }));
      delete s.dias;
      delete s.horaInicio;
      delete s.horaFin;
    }
    return s;
  });
  let tasks = load(KEY_TASKS, []);
  let notifiedTasks = load(KEY_NOTIFIED, {});

  const persist = () => {
    save(KEY_SUBJECTS, subjects);
    save(KEY_TASKS, tasks);
    checkNotifications();
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Datos de prueba ---------- */
  function seed() {
    if (localStorage.getItem(KEY_SEEDED)) return;
    localStorage.setItem(KEY_SEEDED, "1");
    if (subjects.length || tasks.length) return;

    const mk = (nombre, profesor, color, horarios) => ({
      id: uid(), nombre, profesor, color, horarios,
    });
    const mat = mk("Matemáticas", "Carlos Gómez", "#2563eb", [{ dia: "Lunes", horaInicio: "08:00", horaFin: "10:00" }, { dia: "Miércoles", horaInicio: "08:00", horaFin: "10:00" }]);
    const dis = mk("Diseño", "Laura Ríos", "#7c3aed", [{ dia: "Martes", horaInicio: "14:00", horaFin: "16:00" }, { dia: "Jueves", horaInicio: "14:00", horaFin: "16:00" }]);
    const ing = mk("Inglés", "Ana Pérez", "#16a34a", [{ dia: "Viernes", horaInicio: "10:00", horaFin: "12:00" }]);
    subjects = [mat, dis, ing];

    const day = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return toISO(d);
    };
    const mkTask = (titulo, materiaId, fecha, hora, prioridad, estado, descripcion = "") => ({
      id: uid(), titulo, descripcion, materiaId, fecha, hora, prioridad, estado,
      fechaCreacion: new Date().toISOString(),
    });
    tasks = [
      mkTask("Taller de derivadas", mat.id, day(1), "18:00", "alta", "pendiente", "Ejercicios 1 a 20 del capítulo 4."),
      mkTask("Entrega proyecto final", dis.id, day(4), "23:59", "alta", "progreso", "Prototipo navegable + presentación."),
      mkTask("Presentación oral", ing.id, day(6), "10:00", "media", "pendiente", "Tema libre, 5 minutos."),
      mkTask("Ejercicios capítulo 3", mat.id, day(-3), "18:00", "media", "completada"),
      mkTask("Quiz de vocabulario", ing.id, day(-1), "09:00", "baja", "pendiente"),
    ];
    persist();
  }

  /* ---------- Utilidades de fecha ---------- */
  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayISO = () => toISO(new Date());
  const parseISO = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const fmtDate = (iso) => {
    const d = parseISO(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  const fmtTime = (hhmm) => {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
  };
  // Índice de día de la semana con lunes = 0
  const dowIndex = (date) => (date.getDay() + 6) % 7;

  /* ---------- Notificaciones ---------- */
  async function checkNotifications() {
    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      await Notification.requestPermission();
    }

    if (Notification.permission === "granted") {
      const today = new Date();
      const todayStr = toISO(today);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = toISO(tomorrow);

      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);
      const dayAfterStr = toISO(dayAfter);

      tasks.forEach(t => {
        if (t.estado === "completada") return;

        let notifState = notifiedTasks[t.id] || [];

        const notify = (type, message) => {
          if (!notifState.includes(type)) {
            new Notification("Aula", {
              body: message,
              icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236366f1%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z%22/></svg>"
            });
            notifState.push(type);
            notifiedTasks[t.id] = notifState;
            save(KEY_NOTIFIED, notifiedTasks);
          }
        };

        if (t.fecha === dayAfterStr) notify("2_days", `Faltan 2 días para: ${t.titulo}`);
        else if (t.fecha === tomorrowStr) notify("1_day", `Falta 1 día para: ${t.titulo}`);
        else if (t.fecha === todayStr) notify("today", `¡Entrega HOY!: ${t.titulo}`);
      });
    }
  }

  /* ---------- Lógica de tareas ---------- */
  const isOverdue = (t) => t.estado !== "completada" && new Date(`${t.fecha}T${t.hora || "23:59"}`) < new Date();
  const isToday = (t) => t.fecha === todayISO();
  const subjectOf = (t) => subjects.find((s) => s.id === t.materiaId) || { nombre: "Sin materia", color: "#94a3b8" };
  const sortByDate = (list) => [...list].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));

  function counters() {
    const pendientes = tasks.filter((t) => t.estado !== "completada" && !isOverdue(t)).length;
    return {
      hoy: tasks.filter((t) => isToday(t) && t.estado !== "completada").length,
      pendientes,
      completadas: tasks.filter((t) => t.estado === "completada").length,
      vencidas: tasks.filter(isOverdue).length,
    };
  }

  function toggleTask(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.estado = t.estado === "completada" ? "pendiente" : "completada";
    persist();
    render();
  }

  async function deleteTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    if (await customConfirm(`¿Estás seguro de que deseas eliminar la tarea "${t.titulo}"?`)) {
      tasks = tasks.filter((x) => x.id !== id);
      persist();
      render();
    }
  }

  function duplicateTask(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    tasks.push({ ...t, id: uid(), titulo: `${t.titulo} (copia)`, estado: "pendiente", fechaCreacion: new Date().toISOString() });
    persist();
    render();
  }

  /* ---------- Helpers de render ---------- */
  const el = (html) => {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  };
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function statusBadge(t) {
    if (t.estado === "completada") return '<span class="badge completada">✓ Completada</span>';
    if (isOverdue(t)) return '<span class="badge vencida">! Vencida</span>';
    if (t.estado === "progreso") return '<span class="badge progreso">En progreso</span>';
    return '<span class="badge">○ Pendiente</span>';
  }

  function taskRow(t) {
    const s = subjectOf(t);
    const done = t.estado === "completada";
    const node = el(`
      <article class="task ${done ? "done" : ""} ${isOverdue(t) ? "overdue" : ""}">
        <div class="task-color" style="background:${s.color}"></div>
        <button class="check ${done ? "on" : ""}" title="Marcar como completada">✓</button>
        <div class="task-main">
          <div class="task-subject" style="color:${s.color}">${esc(s.nombre)}</div>
          <div class="task-title">${esc(t.titulo)}</div>
          <div class="task-meta">
            <span style="display:inline-flex;align-items:center;gap:4px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> ${fmtDate(t.fecha)}</span>
            <span style="display:inline-flex;align-items:center;gap:4px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ${fmtTime(t.hora)}</span>
            <span class="badge ${t.prioridad}">Prioridad: ${PRIORITY_LABEL[t.prioridad]}</span>
            ${statusBadge(t)}
          </div>
        </div>
        <div class="task-side">
          <div class="menu-wrap">
            <button class="icon-btn" data-menu>⋮</button>
          </div>
        </div>
      </article>
    `);

    node.querySelector(".check").addEventListener("click", (e) => { e.stopPropagation(); toggleTask(t.id); });
    node.querySelector(".task-main").addEventListener("click", () => openDetail(t.id));
    node.querySelector("[data-menu]").addEventListener("click", (e) => {
      e.stopPropagation();
      openRowMenu(node.querySelector(".menu-wrap"), t.id);
    });
    return node;
  }

  function openRowMenu(wrap, id) {
    document.querySelectorAll(".menu").forEach((m) => m.remove());
    const menu = el(`
      <div class="menu">
        <button data-a="edit">Editar</button>
        <button data-a="del" class="danger">Eliminar</button>
      </div>
    `);

    // Portal: append to body so overflow:hidden on .task doesn't clip the menu
    const rect = wrap.getBoundingClientRect();
    menu.style.cssText = `position:fixed;top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;z-index:200;`;

    menu.addEventListener("click", (e) => {
      const a = e.target.dataset.a;
      if (a === "edit") openTaskModal(id);
      if (a === "del") deleteTask(id);
      menu.remove();
    });
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 0);
  }

  /* ---------- Vistas ---------- */
  const content = document.getElementById("content");

  function render() {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
    content.innerHTML = "";
    const views = {
      dashboard: viewDashboard,
      calendar: viewCalendar,
      subjects: viewSubjects,
      subjectDetail: viewSubjectDetail,
      tasks: viewTasks,
      schedule: viewSchedule,
      stats: viewStats
    };
    (views[state.view] || viewDashboard)();
  }

  function header(title, subtitle, actionLabel, onAction) {
    const node = el(`
      <div class="page-head">
        <div>
          <h1>${title}</h1>
          ${subtitle ? `<p>${subtitle}</p>` : ""}
        </div>
        ${actionLabel ? `<button class="btn btn-primary">${actionLabel}</button>` : ""}
      </div>
    `);
    if (actionLabel) node.querySelector("button").addEventListener("click", onAction);
    content.appendChild(node);
    return node;
  }

  /* --- Dashboard --- */
  function viewDashboard() {
    header("Hola Camailo", "Tus tareas al día, organizadas por materia y fecha.", "+ Nueva tarea", () => openTaskModal());
    const c = counters();
    content.appendChild(el(`
      <div class="stat-grid">
        <div class="stat accent"><b>${c.hoy}</b><span>Tareas para hoy</span></div>
        <div class="stat"><b>${c.pendientes}</b><span>Pendientes</span></div>
        <div class="stat ok"><b>${c.completadas}</b><span>Completadas</span></div>
        <div class="stat danger"><b>${c.vencidas}</b><span>Vencidas</span></div>
      </div>
    `));

    content.appendChild(el('<h2 class="section-title">Próximas tareas</h2>'));
    const list = el('<div class="task-list"></div>');
    const upcoming = sortByDate(tasks.filter((t) => t.estado !== "completada" && t.fecha >= todayISO())).slice(0, 6);
    if (!upcoming.length) list.appendChild(el('<div class="empty">No tienes tareas próximas. ¡Buen trabajo!</div>'));
    upcoming.forEach((t) => list.appendChild(taskRow(t)));
    content.appendChild(list);

    const overdue = sortByDate(tasks.filter(isOverdue));
    if (overdue.length) {
      content.appendChild(el('<h2 class="section-title">Vencidas</h2>'));
      const ol = el('<div class="task-list"></div>');
      overdue.forEach((t) => ol.appendChild(taskRow(t)));
      content.appendChild(ol);
    }
  }

  /* --- Calendario --- */
  function viewCalendar() {
    header("Calendario", "Tus entregas organizadas por fecha.", "+ Nueva tarea", () => openTaskModal());

    const head = el(`
      <div class="cal-head">
        <div class="cal-nav">
          <button class="btn btn-ghost btn-sm" data-prev>←</button>
          <div class="cal-title"></div>
          <button class="btn btn-ghost btn-sm" data-next>→</button>
          <button class="btn btn-ghost btn-sm" data-today>Hoy</button>
        </div>
        <div class="cal-nav">
          ${["mes", "semana", "día"].map((m) => `<button class="chip ${state.calMode === m ? "active" : ""}" data-mode="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}
        </div>
      </div>
    `);
    content.appendChild(head);

    const step = (dir) => {
      const d = new Date(state.calDate);
      if (state.calMode === "mes") d.setMonth(d.getMonth() + dir);
      else if (state.calMode === "semana") d.setDate(d.getDate() + 7 * dir);
      else d.setDate(d.getDate() + dir);
      state.calDate = d;
      render();
    };
    head.querySelector("[data-prev]").onclick = () => step(-1);
    head.querySelector("[data-next]").onclick = () => step(1);
    head.querySelector("[data-today]").onclick = () => { state.calDate = new Date(); render(); };
    head.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { state.calMode = b.dataset.mode; render(); }));

    const title = head.querySelector(".cal-title");
    const d = state.calDate;
    if (state.calMode === "mes") title.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    else if (state.calMode === "semana") title.textContent = `Semana del ${fmtDate(toISO(startOfWeek(d)))}`;
    else title.textContent = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

    if (state.calMode === "mes") renderMonth();
    else if (state.calMode === "semana") renderRange(startOfWeek(d), 7);
    else renderRange(new Date(d), 1);
  }

  function startOfWeek(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - dowIndex(d));
    return d;
  }

  function eventChip(t) {
    const s = subjectOf(t);
    const node = el(`
      <div class="cal-ev ${t.estado === "completada" ? "done" : ""}" style="background:${s.color}1a;color:${s.color}">
        <span class="dot" style="background:${s.color}"></span>
        <span class="lbl">${esc(s.nombre)} ·</span> ${esc(t.titulo)}
      </div>
    `);
    node.addEventListener("click", () => openDetail(t.id));
    return node;
  }

  function renderMonth() {
    const d = state.calDate;
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const start = startOfWeek(first);
    const grid = el('<div class="cal-grid"></div>');
    DOW_SHORT.forEach((n) => grid.appendChild(el(`<div class="cal-dow">${n}</div>`)));

    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const iso = toISO(day);
      const cell = el(`
        <div class="cal-cell ${day.getMonth() !== d.getMonth() ? "out" : ""} ${iso === todayISO() ? "today" : ""}">
          <div class="cal-daynum">${day.getDate()}</div>
        </div>
      `);
      sortByDate(tasks.filter((t) => t.fecha === iso)).forEach((t) => cell.appendChild(eventChip(t)));
      cell.addEventListener("dblclick", () => openTaskModal(null, { fecha: iso }));
      grid.appendChild(cell);
    }
    content.appendChild(grid);
  }

  function renderRange(startDate, days) {
    const wrap = el('<div class="task-list"></div>');
    for (let i = 0; i < days; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      const iso = toISO(day);
      const dayTasks = sortByDate(tasks.filter((t) => t.fecha === iso));
      const card = el(`
        <section class="card">
          <h3 style="font-size:15px">${DAYS[dowIndex(day)]} ${fmtDate(iso)}${iso === todayISO() ? " · Hoy" : ""}</h3>
          <div class="task-list" style="margin-top:12px"></div>
        </section>
      `);
      const list = card.querySelector(".task-list");
      if (!dayTasks.length) list.appendChild(el('<div class="empty">Sin tareas este día</div>'));
      dayTasks.forEach((t) => list.appendChild(taskRow(t)));
      wrap.appendChild(card);
    }
    content.appendChild(wrap);
  }

  /* --- Materias --- */
  function viewSubjects() {
    header("Materias", "Cada materia etiqueta tus tareas y te muestra qué días tienes clase.", "+ Nueva materia", () => openSubjectModal());
    const grid = el('<div class="card-grid"></div>');
    if (!subjects.length) grid.appendChild(el('<div class="empty">Aún no has creado materias.</div>'));

    subjects.forEach((s) => {
      const pend = tasks.filter((t) => t.materiaId === s.id && t.estado !== "completada").length;
      const card = el(`
        <article class="card subject-card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
            <span class="dot" style="background:${s.color};width:16px;height:16px"></span>
            <div class="menu-wrap"><button class="icon-btn" data-menu>⋮</button></div>
          </div>
          <h3 style="margin-top:10px;font-size:17px">${esc(s.nombre)}</h3>
          <div class="kv">Profesor<br><b>${esc(s.profesor || "—")}</b></div>
          <div class="kv">Horarios<br><b>${s.horarios && s.horarios.length ? s.horarios.map(h => `${h.dia.slice(0,3)} ${fmtTime(h.horaInicio)}-${fmtTime(h.horaFin)}`).join(', ') : "Sin horario"}</b></div>
          <div class="kv" style="margin-top:12px"><span class="badge">${pend} tareas pendientes</span></div>
        </article>
      `);
      card.addEventListener("click", () => { state.subjectId = s.id; state.subjectTab = "tareas"; state.view = "subjectDetail"; render(); });
      card.querySelector("[data-menu]").addEventListener("click", (e) => {
        e.stopPropagation();
        const wrap = card.querySelector(".menu-wrap");
        document.querySelectorAll(".menu").forEach((m) => m.remove());
        const menu = el('<div class="menu"><button data-a="edit">Editar</button><button data-a="del" class="danger">Eliminar</button></div>');
        menu.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          if (ev.target.dataset.a === "edit") openSubjectModal(s.id);
          if (ev.target.dataset.a === "del") {
            if (await customConfirm(`¿Eliminar "${s.nombre}" y sus tareas?`)) {
              subjects = subjects.filter((x) => x.id !== s.id);
              tasks = tasks.filter((t) => t.materiaId !== s.id);
              persist();
              render();
            }
          }
          menu.remove();
        });
        wrap.appendChild(menu);
        setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 0);
      });
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  function viewSubjectDetail() {
    const s = subjects.find((x) => x.id === state.subjectId);
    if (!s) { state.view = "subjects"; return render(); }

    const back = el('<button class="btn btn-ghost btn-sm" style="margin-bottom:14px; padding: 6px 14px; font-size: 18px; font-weight: bold;" title="Volver">&lt;</button>');
    back.onclick = () => { state.view = "subjects"; render(); };
    content.appendChild(back);

    content.appendChild(el(`
      <div class="page-head">
        <div>
          <h1><span class="dot" style="background:${s.color};width:14px;height:14px;margin-right:8px"></span>${esc(s.nombre)}</h1>
          <p>Profesor ${esc(s.profesor || "—")} · ${s.horarios && s.horarios.length ? s.horarios.map(h => `${h.dia.slice(0,3)} ${fmtTime(h.horaInicio)}-${fmtTime(h.horaFin)}`).join(', ') : "Sin horario"}</p>
        </div>
      </div>
    `));

    const tabs = el(`
      <div class="tabs">
        <button class="tab ${state.subjectTab === "tareas" ? "active" : ""}" data-tab="tareas">Tareas</button>
        <button class="tab ${state.subjectTab === "info" ? "active" : ""}" data-tab="info">Información</button>
      </div>
    `);
    tabs.querySelectorAll(".tab").forEach((b) => (b.onclick = () => { state.subjectTab = b.dataset.tab; render(); }));
    content.appendChild(tabs);

    if (state.subjectTab === "info") {
      content.appendChild(el(`
        <section class="card">
          <div class="kv">Nombre<br><b>${esc(s.nombre)}</b></div>
          <div class="kv">Profesor<br><b>${esc(s.profesor || "—")}</b></div>
          <div class="kv">Horarios<br><b>${s.horarios && s.horarios.length ? s.horarios.map(h => `${h.dia}: ${fmtTime(h.horaInicio)} – ${fmtTime(h.horaFin)}`).join('<br>') : "—"}</b></div>
          <div class="kv">Total de tareas<br><b>${tasks.filter((t) => t.materiaId === s.id).length}</b></div>
        </section>
      `));
      return;
    }

    const add = el('<button class="btn btn-primary" style="margin-bottom:16px">+ Agregar tarea</button>');
    add.onclick = () => openTaskModal(null, { materiaId: s.id });
    content.appendChild(add);

    const mine = tasks.filter((t) => t.materiaId === s.id);
    const groups = [
      ["Pendientes", sortByDate(mine.filter((t) => t.estado !== "completada"))],
      ["Completadas", sortByDate(mine.filter((t) => t.estado === "completada"))],
    ];
    groups.forEach(([label, list]) => {
      content.appendChild(el(`<h2 class="section-title">${label}</h2>`));
      const box = el('<div class="task-list"></div>');
      if (!list.length) box.appendChild(el('<div class="empty">Nada por aquí.</div>'));
      list.forEach((t) => box.appendChild(taskRow(t)));
      content.appendChild(box);
    });
  }

  /* --- Tareas --- */
  function viewTasks() {
    header("Mis tareas", "Filtra, busca y administra todos tus pendientes.", "+ Nueva tarea", () => openTaskModal());

    const bar = el(`
      <section class="card" style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${["todas", "hoy", "pendientes", "completadas", "vencidas"]
        .map((f) => `<button class="chip ${state.filter === f ? "active" : ""}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`)
        .join("")}
        </div>
        <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
          <input class="inp" data-k="search" placeholder="Buscar tarea..." value="${esc(state.search)}" />
          <select data-k="filterSubject">
            <option value="">Todas las materias</option>
            ${subjects.map((s) => `<option value="${s.id}" ${state.filterSubject === s.id ? "selected" : ""}>${esc(s.nombre)}</option>`).join("")}
          </select>
          <select data-k="filterPriority">
            <option value="">Toda prioridad</option>
            ${["alta", "media", "baja"].map((p) => `<option value="${p}" ${state.filterPriority === p ? "selected" : ""}>${PRIORITY_LABEL[p]}</option>`).join("")}
          </select>
          <input type="date" data-k="filterDate" value="${state.filterDate}" />
        </div>
      </section>
    `);
    bar.querySelectorAll("input,select").forEach((i) => {
      i.addEventListener("change", () => { state[i.dataset.k] = i.value; render(); });
      if (i.dataset.k === "search") {
        i.addEventListener("input", () => {
          state.search = i.value;
          renderFilteredList();
        });
      }
    });
    bar.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { state.filter = b.dataset.f; render(); }));
    content.appendChild(bar);

    const list = el('<div class="task-list" id="filteredList" style="margin-top:18px"></div>');
    content.appendChild(list);
    renderFilteredList();
    attachCustomSelects();
  }

  function filteredTasks() {
    let list = tasks.slice();
    if (state.filter === "hoy") list = list.filter(isToday);
    if (state.filter === "pendientes") list = list.filter((t) => t.estado !== "completada" && !isOverdue(t));
    if (state.filter === "completadas") list = list.filter((t) => t.estado === "completada");
    if (state.filter === "vencidas") list = list.filter(isOverdue);
    if (state.filterSubject) list = list.filter((t) => t.materiaId === state.filterSubject);
    if (state.filterPriority) list = list.filter((t) => t.prioridad === state.filterPriority);
    if (state.filterDate) list = list.filter((t) => t.fecha === state.filterDate);
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter((t) => t.titulo.toLowerCase().includes(q) || (t.descripcion || "").toLowerCase().includes(q));
    }
    return sortByDate(list);
  }

  function renderFilteredList() {
    const list = document.getElementById("filteredList");
    if (!list) return;
    list.innerHTML = "";
    const items = filteredTasks();
    if (!items.length) list.appendChild(el('<div class="empty">No se encontraron tareas con esos filtros.</div>'));
    items.forEach((t) => list.appendChild(taskRow(t)));
  }

  /* --- Horario --- */
  function viewSchedule() {
    header("Horario", "Tu semana académica de un vistazo.", "+ Nueva materia", () => openSubjectModal());
    const wrap = el('<div class="sched-wrap"><div class="sched"></div></div>');
    const grid = wrap.querySelector(".sched");
    const cols = DAYS.slice(0, 6);

    grid.appendChild(el('<div class="sched-h"></div>'));
    cols.forEach((d) => grid.appendChild(el(`<div class="sched-h">${d}</div>`)));

    HOURS.forEach((h) => {
      grid.appendChild(el(`<div class="sched-hour">${fmtTime(`${String(h).padStart(2, "0")}:00`)}</div>`));
      cols.forEach((day) => {
        const slot = el('<div class="sched-slot"></div>');
        let matches = [];
        subjects.forEach(s => {
          (s.horarios || []).forEach(h_obj => {
            if (h_obj.dia === day && Number(h_obj.horaInicio.split(":")[0]) === h) {
              matches.push({ s, h_obj });
            }
          });
        });
        
        matches.sort((a, b) => a.h_obj.horaInicio.localeCompare(b.h_obj.horaInicio)).forEach(({ s, h_obj }) => {
          const start = Number(h_obj.horaInicio.split(":")[0]) + Number(h_obj.horaInicio.split(":")[1]) / 60;
          const end = Number(h_obj.horaFin.split(":")[0]) + Number(h_obj.horaFin.split(":")[1]) / 60;
          const height = Math.max(0.5, end - start) * 56 - 4;
          const block = el(`
            <div class="sched-block" style="background:${s.color};height:${height}px">
              <b>${esc(s.nombre)}</b>
              <small>${fmtTime(h_obj.horaInicio)} – ${fmtTime(h_obj.horaFin)}</small><br>
              <small>${esc(s.profesor || "")}</small>
            </div>
          `);
          block.addEventListener("click", () => { state.subjectId = s.id; state.view = "subjectDetail"; render(); });
          slot.appendChild(block);
        });
        grid.appendChild(slot);
      });
    });
    content.appendChild(wrap);
  }

  /* --- Estadísticas --- */
  function viewStats() {
    header("Estadísticas", "Tu productividad académica calculada automáticamente.");
    const c = counters();
    const total = tasks.length || 1;
    const pct = Math.round((c.completadas / total) * 100);

    content.appendChild(el(`
      <section class="card">
        <h3 style="font-size:15px">Progreso general</h3>
        <div class="ring" style="margin:10px 0 4px">${pct}%</div>
        <div style="color:var(--muted);font-size:13.5px;margin-bottom:12px">Tareas completadas</div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </section>
    `));

    content.appendChild(el(`
      <div class="stat-grid" style="margin-top:16px">
        <div class="stat"><b>${c.pendientes}</b><span>Pendientes</span></div>
        <div class="stat ok"><b>${c.completadas}</b><span>Completadas</span></div>
        <div class="stat danger"><b>${c.vencidas}</b><span>Vencidas</span></div>
      </div>
    `));

    content.appendChild(el('<h2 class="section-title">Progreso por materia</h2>'));
    const box = el('<section class="card" style="display:flex;flex-direction:column;gap:16px"></section>');
    if (!subjects.length) box.appendChild(el('<div class="empty">Crea materias para ver su progreso.</div>'));
    subjects.forEach((s) => {
      const mine = tasks.filter((t) => t.materiaId === s.id);
      const done = mine.filter((t) => t.estado === "completada").length;
      const p = mine.length ? Math.round((done / mine.length) * 100) : 0;
      box.appendChild(el(`
        <div>
          <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px">
            <span><span class="dot" style="background:${s.color};margin-right:7px"></span>${esc(s.nombre)}</span>
            <b>${p}%</b>
          </div>
          <div class="progress"><i style="width:${p}%;background:${s.color}"></i></div>
        </div>
      `));
    });
    content.appendChild(box);
  }

  /* --- Configuración / Perfil --- */
  function viewSettings() {
    header("Configuración", "Preferencias y datos de la aplicación.");
    const card = el(`
      <section class="card">
        <div class="kv">Almacenamiento<br><b>localStorage del navegador</b></div>
        <div class="kv">Materias guardadas<br><b>${subjects.length}</b></div>
        <div class="kv">Tareas guardadas<br><b>${tasks.length}</b></div>
        <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">
          <button class="btn btn-ghost" data-export>Exportar datos</button>
          <button class="btn btn-danger" data-reset>Borrar todos los datos</button>
        </div>
      </section>
    `);
    card.querySelector("[data-export]").onclick = () => {
      const blob = new Blob([JSON.stringify({ subjects, tasks }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "aula-datos.json";
      a.click();
    };
    card.querySelector("[data-reset]").onclick = async () => {
      if (!(await customConfirm("Esto eliminará todas las materias y tareas. ¿Continuar?"))) return;
      subjects = []; tasks = []; persist(); render();
    };
    content.appendChild(card);
  }

  function viewProfile() {
    header("Perfil", "Tu información de estudiante.");
    const name = localStorage.getItem("aula.perfil") || "Estudiante";
    const card = el(`
      <section class="card" style="max-width:460px">
        <label class="field">
          <span>Nombre</span>
          <input id="profileName" value="${esc(name)}" />
        </label>
        <button class="btn btn-primary" style="margin-top:14px">Guardar</button>
      </section>
    `);
    card.querySelector("button").onclick = async () => {
      localStorage.setItem("aula.perfil", card.querySelector("#profileName").value);
      await customAlert("Perfil guardado");
    };
    content.appendChild(card);
  }

  /* ---------- Modales ---------- */
  const subjectModal = document.getElementById("subjectModal");
  const taskModal = document.getElementById("taskModal");
  const detailModal = document.getElementById("detailModal");
  const subjectForm = document.getElementById("subjectForm");
  const taskForm = document.getElementById("taskForm");

  const closeModal = (m) => {
    m.hidden = true;
    localStorage.removeItem("aula_activeModal");
  };
  document.querySelectorAll(".modal-overlay").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) closeModal(m);
    });
  });

  const confirmModal = document.getElementById("confirmModal");
  const alertModal = document.getElementById("alertModal");
  function customAlert(message) {
    return new Promise((resolve) => {
      document.getElementById("alertMessage").textContent = message;
      alertModal.hidden = false;
      const checkClose = setInterval(() => {
        if (alertModal.hidden) {
          clearInterval(checkClose);
          resolve();
        }
      }, 50);
      document.getElementById("alertOk").onclick = () => { alertModal.hidden = true; };
    });
  }

  function customConfirm(message) {
    return new Promise((resolve) => {
      document.getElementById("confirmMessage").textContent = message;
      confirmModal.hidden = false;
      let resolvedValue = false;
      const checkClose = setInterval(() => {
        if (confirmModal.hidden) {
          clearInterval(checkClose);
          resolve(resolvedValue);
        }
      }, 50);
      document.getElementById("confirmOk").onclick = () => { resolvedValue = true; confirmModal.hidden = true; };
      document.getElementById("confirmCancel").onclick = () => { resolvedValue = false; confirmModal.hidden = true; };
    });
  }

  // Selector de colores y días (materia)
  const swatches = document.getElementById("colorSwatches");
  COLORS.forEach((c) => {
    const b = el(`<button type="button" class="swatch" style="background:${c}" data-color="${c}"></button>`);
    b.onclick = () => { state.modalColor = c; paintSwatches(); };
    swatches.appendChild(b);
  });
  const paintSwatches = () => swatches.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("sel", b.dataset.color === state.modalColor));

  const scheduleList = document.getElementById("scheduleList");
  document.getElementById("addScheduleBtn").onclick = () => {
    addScheduleRow();
  };

  function addScheduleRow(h = { dia: "Lunes", horaInicio: "08:00", horaFin: "10:00" }) {
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.style.cssText = "display:flex; gap:8px; align-items:center;";
    row.innerHTML = `
      <select class="inp schedule-dia" style="flex:1">
        ${DAYS.map(d => `<option value="${d}" ${d === h.dia ? "selected" : ""}>${d}</option>`).join("")}
      </select>
      <input type="time" class="inp schedule-inicio" value="${h.horaInicio}" />
      <span style="color:var(--text-muted)">a</span>
      <input type="time" class="inp schedule-fin" value="${h.horaFin}" />
      <button type="button" class="icon-btn danger-hover" style="color:var(--danger)" onclick="this.parentElement.remove()" title="Eliminar horario">✕</button>
    `;
    scheduleList.appendChild(row);
    attachCustomSelects(); // Upgrade the newly added select
  }

  function openSubjectModal(id = null) {
    localStorage.setItem("aula_activeModal", JSON.stringify({ type: 'subject', id }));
    const s = subjects.find((x) => x.id === id);
    subjectForm.reset();
    subjectForm.id.value = s ? s.id : "";
    subjectForm.nombre.value = s?.nombre || "";
    subjectForm.profesor.value = s?.profesor || "";
    state.modalColor = s?.color || COLORS[0];
    paintSwatches();
    
    scheduleList.innerHTML = "";
    const horarios = s?.horarios && s.horarios.length ? s.horarios : [{ dia: "Lunes", horaInicio: "08:00", horaFin: "10:00" }];
    horarios.forEach(h => addScheduleRow(h));
    
    document.getElementById("subjectModalTitle").textContent = s ? "Editar materia" : "Nueva materia";
    subjectModal.hidden = false;
  }

  subjectForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(subjectForm);
    
    const horarios = [];
    scheduleList.querySelectorAll(".schedule-row").forEach(row => {
      const dia = row.querySelector(".schedule-dia")?.value;
      const inicio = row.querySelector(".schedule-inicio")?.value;
      const fin = row.querySelector(".schedule-fin")?.value;
      if (dia && inicio && fin) horarios.push({ dia, horaInicio: inicio, horaFin: fin });
    });

    const data = {
      nombre: f.get("nombre").trim(),
      profesor: f.get("profesor").trim(),
      color: state.modalColor,
      horarios: horarios,
    };
    const id = f.get("id");
    if (id) Object.assign(subjects.find((s) => s.id === id), data);
    else subjects.push({ id: uid(), ...data });
    persist();
    closeModal(subjectModal);
    render();
  });

  async function openTaskModal(id = null, defaults = {}) {
    localStorage.setItem("aula_activeModal", JSON.stringify({ type: 'task', id, defaults }));
    if (!subjects.length) {
      await customAlert("Primero crea una materia.");
      openSubjectModal();
      return;
    }
    const t = tasks.find((x) => x.id === id);
    const select = document.getElementById("taskSubjectSelect");
    select.innerHTML = subjects.map((s) => `<option value="${s.id}">${esc(s.nombre)}</option>`).join("");

    taskForm.reset();
    taskForm.id.value = t ? t.id : "";
    taskForm.titulo.value = t?.titulo || "";
    taskForm.materiaId.value = t?.materiaId || defaults.materiaId || subjects[0].id;
    taskForm.descripcion.value = t?.descripcion || "";
    taskForm.fecha.value = t?.fecha || defaults.fecha || todayISO();
    taskForm.hora.value = t?.hora || "18:00";
    taskForm.prioridad.value = t?.prioridad || "media";
    taskForm.estado.value = t?.estado || "pendiente";
    
    // Mostrar modal primero, luego sincronizar custom selects
    document.getElementById("taskModalTitle").textContent = t ? "Editar tarea" : "Nueva tarea";
    document.getElementById("taskSubmit").textContent = t ? "Guardar cambios" : "Crear tarea";
    taskModal.hidden = false;
    // Disparar evento change para que el custom select se actualice visualmente (ahora que está en el DOM)
    ["materiaId", "prioridad", "estado"].forEach(n => taskForm[n].dispatchEvent(new Event("change")));
  }

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(taskForm);
    const data = {
      titulo: f.get("titulo").trim(),
      descripcion: f.get("descripcion").trim(),
      materiaId: f.get("materiaId"),
      fecha: f.get("fecha"),
      hora: f.get("hora"),
      prioridad: f.get("prioridad"),
      estado: f.get("estado"),
    };
    const id = f.get("id");
    if (id) Object.assign(tasks.find((t) => t.id === id), data);
    else tasks.push({ id: uid(), ...data, fechaCreacion: new Date().toISOString() });
    persist();
    closeModal(taskModal);
    render();
  });

  function openDetail(id) {
    localStorage.setItem("aula_activeModal", JSON.stringify({ type: 'detail', id }));
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const s = subjectOf(t);
    const body = document.getElementById("detailBody");
    body.innerHTML = `
      <div class="task-subject" style="color:${s.color};font-weight:600">${esc(s.nombre)}</div>
      <h2 style="font-size:20px">${esc(t.titulo)}</h2>
      <p style="color:var(--muted);font-size:14px;margin:0">${esc(t.descripcion) || "Sin descripción."}</p>
      <div class="task-meta">
        <span style="display:inline-flex;align-items:center;gap:4px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> ${fmtDate(t.fecha)}</span>
        <span style="display:inline-flex;align-items:center;gap:4px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ${fmtTime(t.hora)}</span>
        <span class="badge ${t.prioridad}">Prioridad: ${PRIORITY_LABEL[t.prioridad]}</span>
        ${statusBadge(t)}
      </div>
      <div class="modal-foot">
        <button class="btn btn-danger" data-a="del">Eliminar</button>
        <button class="btn btn-ghost" data-a="edit">Editar</button>
        <button class="btn btn-primary" data-a="toggle">${t.estado === "completada" ? "Marcar pendiente" : "Marcar completada"}</button>
      </div>
    `;
    body.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => {
      const a = b.dataset.a;
      closeModal(detailModal);
      if (a === "del") deleteTask(t.id);
      if (a === "edit") openTaskModal(t.id);
      if (a === "toggle") toggleTask(t.id);
    }));
    detailModal.hidden = false;
  }

  /* ---------- Navegación ---------- */
  document.getElementById("nav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (btn && btn.dataset.view) go(btn.dataset.view);
  });

  function go(view) {
    state.view = view;
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").hidden = true;
    render();
  }

  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("scrim");
  document.getElementById("menuToggle").onclick = () => {
    sidebar.classList.toggle("open");
    scrim.hidden = !sidebar.classList.contains("open");
  };
  scrim.onclick = () => { sidebar.classList.remove("open"); scrim.hidden = true; };
  document.querySelectorAll("[data-new-task]").forEach((b) => (b.onclick = () => openTaskModal()));

  /* ---------- Custom Select Component ---------- */
  // Portal list element - shared, lives on body to avoid overflow clipping
  const csPortalList = document.createElement("div");
  csPortalList.className = "cs-portal";
  document.body.appendChild(csPortalList);

  let csActiveWrap = null;
  let csActiveSel = null;

  function csClose() {
    csPortalList.style.display = "none";
    csPortalList.innerHTML = "";
    if (csActiveWrap) csActiveWrap.classList.remove("open");
    csActiveWrap = null;
    csActiveSel = null;
  }

  function csOpen(wrap, sel, head) {
    csClose();
    csActiveSel = sel;
    csActiveWrap = wrap;
    wrap.classList.add("open");

    // Rebuild options
    csPortalList.innerHTML = "";
    Array.from(sel.options).forEach(opt => {
      const item = document.createElement("div");
      item.className = "custom-select-item" + (sel.value === opt.value ? " selected" : "");
      item.textContent = opt.textContent;
      item.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change"));
        csClose();
      };
      csPortalList.appendChild(item);
    });

    // Position portal below the head element
    const rect = head.getBoundingClientRect();
    Object.assign(csPortalList.style, {
      left: rect.left + "px",
      top: (rect.bottom + 4) + "px",
      width: rect.width + "px",
      display: "flex"
    });
  }

  function attachCustomSelects() {
    document.querySelectorAll("select:not([data-customized])").forEach(sel => {
      sel.setAttribute("data-customized", "true");
      sel.style.display = "none";

      const wrap = document.createElement("div");
      wrap.className = "custom-select";
      if (sel.classList.contains("inp")) wrap.classList.add("inp");

      const head = document.createElement("div");
      head.className = "custom-select-head";

      const valObj = document.createElement("span");
      const updateVal = () => {
        const opt = sel.options[sel.selectedIndex];
        valObj.textContent = opt ? opt.textContent : "";
      };
      updateVal();
      sel.addEventListener("change", updateVal);

      const icon = document.createElement("span");
      icon.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg>`;

      head.appendChild(valObj);
      head.appendChild(icon);

      // Refresh options if the underlying <select> changes (e.g. materias list)
      const observer = new MutationObserver(() => {
        updateVal();
        if (csActiveSel === sel) csOpen(wrap, sel, head);
      });
      observer.observe(sel, { childList: true });

      head.onclick = (e) => {
        e.stopPropagation();
        if (csActiveWrap === wrap) {
          csClose();
        } else {
          csOpen(wrap, sel, head);
        }
      };

      wrap.appendChild(head);
      sel.parentNode.insertBefore(wrap, sel.nextSibling);
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-select") && !csPortalList.contains(e.target)) {
      csClose();
    }
  });

  /* ---------- Init ---------- */
  document.documentElement.setAttribute("data-theme", "dark");


  seed();
  checkNotifications();
  render();

  const activeModalStr = localStorage.getItem("aula_activeModal");
  if (activeModalStr) {
    try {
      const activeModal = JSON.parse(activeModalStr);
      if (activeModal.type === 'subject') openSubjectModal(activeModal.id);
      else if (activeModal.type === 'task') openTaskModal(activeModal.id, activeModal.defaults);
      else if (activeModal.type === 'detail') openDetail(activeModal.id);
    } catch (e) {}
  }
  
  attachCustomSelects();
})();
