(() => {
  "use strict";

  /* ---------- Keys ---------- */
  const KEY_SUBJECTS  = "aula.materias";
  const KEY_TASKS     = "aula.tareas";
  const KEY_GRADES    = "aula.notas";
  const KEY_EXAMS     = "aula.examenes";
  const KEY_REMINDERS = "aula.recordatorios";
  const KEY_SEEDED    = "aula.seed.v2";
  const KEY_NOTIFIED  = "aula.notified";

  /* ---------- Constantes ---------- */
  const COLORS   = ["#2563eb","#7c3aed","#16a34a","#ea580c","#dc2626","#eab308","#0891b2","#db2777"];
  const DAYS     = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
  const DOW_SHORT = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const MONTHS   = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const HOURS    = [7,8,9,10,11,12,13,14,15,16,17,18,19];

  const PRIORITY_LABEL  = { urgente:"Urgente", alta:"Alta", media:"Media", baja:"Baja" };
  const TIPO_LABEL = {
    parcial:"Parcial", quiz:"Quiz", taller:"Taller", exposicion:"Exposición",
    trabajo:"Trabajo", proyecto:"Proyecto", participacion:"Participación",
    laboratorio:"Laboratorio", otro:"Otro"
  };
  const CATEGORIA_LABEL = { personal:"Personal", academico:"Académico", entrega:"Entrega", reunion:"Reunión", otro:"Otro" };
  const PREP_LABEL = { "sin-iniciar":"Sin iniciar", "en-progreso":"En progreso", listo:"Listo" };
  const URGENCY_LABEL  = { normal:"Normal", proximo:"Próximo", importante:"Importante", urgente:"Urgente", realizado:"Realizado" };

  /* ---------- Lucide icon helper ---------- */
  // Returns <i data-lucide="name"> which gets replaced by lucide.createIcons()
  const ic = (name, size = 16, extra = "") =>
    `<i data-lucide="${name}" style="width:${size}px;height:${size}px;display:inline-flex;flex-shrink:0;vertical-align:middle;${extra}"></i>`;

  /* ---------- Estado ---------- */
  const state = {
    view: "dashboard",
    subjectId: null,
    subjectTab: "notas",
    calMode: "mes",
    calDate: new Date(),
    filter: "todas",
    filterSubject: "",
    filterPriority: "",
    filterDate: "",
    search: "",
    reminderFilter: "proximos",
    examFilter: "proximos",
    modalColor: COLORS[0],
  };

  /* ---------- localStorage ---------- */
  const load = (key, fallback) => {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
    catch { return fallback; }
  };
  const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  /* ---------- Datos ---------- */
  let subjects = load(KEY_SUBJECTS, []).map(s => {
    // Migrar formato de horarios antiguo
    if (s.dias && !s.horarios) {
      s.horarios = s.dias.map(d => ({ dia: d, horaInicio: s.horaInicio || "08:00", horaFin: s.horaFin || "10:00" }));
      delete s.dias; delete s.horaInicio; delete s.horaFin;
    }
    if (s.notaMinima === undefined) s.notaMinima = 3.0;
    if (s.escalaMax  === undefined) s.escalaMax  = 5.0;
    return s;
  });

  let tasks     = load(KEY_TASKS,     []);
  let grades    = load(KEY_GRADES,    []);
  let exams     = load(KEY_EXAMS,     []);
  let reminders = load(KEY_REMINDERS, []);
  let notifiedTasks = load(KEY_NOTIFIED, {});

  /* ---------- Persistencia ---------- */
  const saveGrades    = () => save(KEY_GRADES, grades);
  const saveExams     = () => save(KEY_EXAMS,  exams);
  const saveReminders = () => save(KEY_REMINDERS, reminders);

  const persist = () => {
    save(KEY_SUBJECTS, subjects);
    save(KEY_TASKS, tasks);
    saveGrades(); saveExams(); saveReminders();
    checkNotifications();
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Seed ---------- */
  function seed() {
    if (localStorage.getItem(KEY_SEEDED)) return;
    localStorage.setItem(KEY_SEEDED, "1");
    if (subjects.length || tasks.length) return;

    const day  = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISO(d); };
    const mkS  = (nombre, profesor, color, horarios) =>
      ({ id: uid(), nombre, profesor, color, horarios, notaMinima: 3.0, escalaMax: 5.0 });

    const calc = mkS("Cálculo",    "Dr. Ramírez",  "#7c3aed", [{ dia:"Lunes",    horaInicio:"08:00", horaFin:"10:00" },{ dia:"Miércoles", horaInicio:"08:00", horaFin:"10:00" }]);
    const fin  = mkS("Finanzas",   "Lic. Morales", "#2563eb", [{ dia:"Martes",   horaInicio:"14:00", horaFin:"16:00" },{ dia:"Jueves",    horaInicio:"14:00", horaFin:"16:00" }]);
    const est  = mkS("Estadística","Dra. Vargas",  "#16a34a", [{ dia:"Viernes",  horaInicio:"10:00", horaFin:"12:00" }]);
    subjects = [calc, fin, est];

    // Notas Cálculo
    const g1 = { id:uid(), materiaId:calc.id, nombre:"Parcial 1",   tipo:"parcial",  nota:4.0, porcentaje:20, fecha:day(-30), estado:"evaluado",  examId:null };
    const g2 = { id:uid(), materiaId:calc.id, nombre:"Quiz 1",      tipo:"quiz",     nota:3.5, porcentaje:10, fecha:day(-20), estado:"evaluado",  examId:null };
    const g3 = { id:uid(), materiaId:calc.id, nombre:"Trabajo",     tipo:"trabajo",  nota:4.5, porcentaje:15, fecha:day(-10), estado:"evaluado",  examId:null };
    const g4 = { id:uid(), materiaId:calc.id, nombre:"Parcial 2",   tipo:"parcial",  nota:null,porcentaje:25, fecha:day(20),  estado:"pendiente", examId:null };
    // Notas Finanzas
    const g5 = { id:uid(), materiaId:fin.id,  nombre:"Quiz 1",      tipo:"quiz",     nota:3.8, porcentaje:15, fecha:day(-15), estado:"evaluado",  examId:null };
    const g6 = { id:uid(), materiaId:fin.id,  nombre:"Taller 1",    tipo:"taller",   nota:4.2, porcentaje:10, fecha:day(-8),  estado:"evaluado",  examId:null };
    const g7 = { id:uid(), materiaId:fin.id,  nombre:"Parcial 1",   tipo:"parcial",  nota:null,porcentaje:30, fecha:day(10),  estado:"pendiente", examId:null };
    // Notas Estadística
    const g8 = { id:uid(), materiaId:est.id,  nombre:"Parcial 1",   tipo:"parcial",  nota:4.1, porcentaje:25, fecha:day(-25), estado:"evaluado",  examId:null };
    const g9 = { id:uid(), materiaId:est.id,  nombre:"Laboratorio", tipo:"laboratorio", nota:3.9, porcentaje:15, fecha:day(-12), estado:"evaluado", examId:null };
    const g10= { id:uid(), materiaId:est.id,  nombre:"Proyecto",    tipo:"proyecto", nota:null,porcentaje:30, fecha:day(25),  estado:"pendiente", examId:null };
    grades = [g1, g2, g3, g4, g5, g6, g7, g8, g9, g10];

    // Exámenes
    const ex1 = { id:uid(), materiaId:calc.id, nombre:"Parcial 2 Cálculo", fecha:day(20), hora:"08:00", porcentaje:25, temas:["Derivadas","Regla de la cadena","Optimización"], notas:"Revisar ejercicios capítulo 5", preparacion:"en-progreso", gradeId:g4.id };
    g4.examId = ex1.id;
    const ex2 = { id:uid(), materiaId:fin.id,  nombre:"Parcial 1 Finanzas", fecha:day(10), hora:"14:00", porcentaje:30, temas:["VPN","TIR","Flujo de caja"], notas:"", preparacion:"sin-iniciar", gradeId:g7.id };
    g7.examId = ex2.id;
    const ex3 = { id:uid(), materiaId:est.id,  nombre:"Proyecto Final Estadística", fecha:day(25), hora:"10:00", porcentaje:30, temas:["Regresión","Análisis descriptivo"], notas:"", preparacion:"sin-iniciar", gradeId:g10.id };
    g10.examId = ex3.id;
    exams = [ex1, ex2, ex3];

    // Recordatorios
    reminders = [
      { id:uid(), titulo:"Hablar con el decano", descripcion:"Tema: situación académica del semestre", fecha:day(1), hora:"07:40", materiaId:null, categoria:"reunion", prioridad:"urgente", estado:"pendiente", fechaCreacion:new Date().toISOString() },
      { id:uid(), titulo:"Estudiar derivadas", descripcion:"Preparar el Parcial 2 de Cálculo", fecha:day(3), hora:"18:00", materiaId:calc.id, categoria:"academico", prioridad:"alta", estado:"pendiente", fechaCreacion:new Date().toISOString() },
      { id:uid(), titulo:"Entregar formulario de matrícula", descripcion:"", fecha:day(5), hora:"12:00", materiaId:null, categoria:"entrega", prioridad:"media", estado:"pendiente", fechaCreacion:new Date().toISOString() },
    ];

    // Tareas
    const mkT = (titulo, mid, fecha, hora, prioridad, estado, desc = "") =>
      ({ id:uid(), titulo, descripcion:desc, materiaId:mid, fecha, hora, prioridad, estado, fechaCreacion:new Date().toISOString() });
    tasks = [
      mkT("Taller de derivadas",    calc.id, day(1),  "18:00", "alta",  "pendiente", "Ejercicios 1 a 20 del capítulo 4."),
      mkT("Entrega proyecto final", fin.id,  day(4),  "23:59", "alta",  "progreso",  "Prototipo navegable + presentación."),
      mkT("Presentación oral",      est.id,  day(6),  "10:00", "media", "pendiente", "Tema libre, 5 minutos."),
      mkT("Ejercicios capítulo 3",  calc.id, day(-3), "18:00", "media", "completada"),
    ];

    persist();
  }

  /* ---------- Utilidades de fecha ---------- */
  const toISO    = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const todayISO = () => toISO(new Date());
  const parseISO = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
  const fmtDate  = (iso) => { const d = parseISO(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const fmtDateFull = (iso) => {
    const d = parseISO(iso);
    return `${DAYS[dowIndex(d)]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  };
  const fmtTime = (hhmm) => {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const suffix = h >= 12 ? "p. m." : "a. m.";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2,"0")} ${suffix}`;
  };
  const dowIndex = (date) => (date.getDay() + 6) % 7;

  /* ---------- Funciones académicas ---------- */
  function daysUntil(fechaISO) {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = parseISO(fechaISO); target.setHours(0,0,0,0);
    return Math.round((target - today) / 86400000);
  }

  function urgencyLevel(days) {
    if (days < 0)   return "realizado";
    if (days <= 2)  return "urgente";
    if (days <= 5)  return "importante";
    if (days <= 10) return "proximo";
    return "normal";
  }

  // Icon per urgency level (Lucide names)
  const URGENCY_ICON = {
    normal:    "calendar",
    proximo:   "bell",
    importante:"triangle-alert",
    urgente:   "circle-alert",
    realizado: "circle-check",
  };

  // Icon per priority level (Lucide names)
  const PRIORITY_ICON = {
    urgente: "triangle-alert",
    alta:    "chevrons-up",
    media:   "minus",
    baja:    "chevron-down",
  };

  function calcSubjectStats(materiaId) {
    const all = grades.filter(g => g.materiaId === materiaId);
    const evaluated = all.filter(g => g.estado === "evaluado" && g.nota !== null);
    const regPending = all.filter(g => g.estado === "pendiente" || g.nota === null);

    const pctEv = evaluated.reduce((s,g) => s + Number(g.porcentaje), 0);
    const pctReg = regPending.reduce((s,g) => s + Number(g.porcentaje), 0);
    const pctSin = Math.max(0, 100 - pctEv - pctReg);

    const acumulada = evaluated.reduce((s,g) => s + Number(g.nota) * Number(g.porcentaje) / 100, 0);
    const promedio  = pctEv > 0 ? acumulada / (pctEv / 100) : null;

    return {
      acumulada:                    Math.round(acumulada * 1000) / 1000,
      promedioActual:               promedio !== null ? Math.round(promedio * 100) / 100 : null,
      porcentajeEvaluado:           Math.round(pctEv  * 10) / 10,
      porcentajePendiente:          Math.round((100 - pctEv) * 10) / 10,
      porcentajeRegistradoPendiente:Math.round(pctReg * 10) / 10,
      porcentajeSinAsignar:         Math.round(pctSin * 10) / 10,
      totalGrades: all.length,
    };
  }

  function calcProjection(materiaId, meta) {
    const s = subjects.find(x => x.id === materiaId);
    if (!s) return null;
    const st = calcSubjectStats(materiaId);
    const restante = 100 - st.porcentajeEvaluado;

    if (restante <= 0) {
      const ok = st.acumulada >= meta;
      return { alcanzable:ok, logrado:true, notaNecesaria:null,
        mensaje: ok ? `Ya alcanzaste ${st.acumulada.toFixed(2)} / ${s.escalaMax}. Meta cumplida.`
                    : `La materia ya está completamente evaluada. Tu nota final es ${st.acumulada.toFixed(2)}.` };
    }
    const nn = (meta - st.acumulada) / (restante / 100);
    if (nn <= 0)       return { alcanzable:true,  logrado:true,  notaNecesaria:0,
      mensaje:"Ya tienes asegurada esta meta. Aunque obtengas cero en el porcentaje restante, tu nota acumulada ya es suficiente." };
    if (nn > s.escalaMax) return { alcanzable:false, logrado:false, notaNecesaria:Math.round(nn*100)/100,
      mensaje:`Con las notas actuales ya no es matemáticamente posible alcanzar ${meta} en esta materia.` };
    return { alcanzable:true, logrado:false, notaNecesaria:Math.round(nn*100)/100,
      mensaje:`Necesitas promediar ${(Math.round(nn*100)/100).toFixed(2)} en el ${restante.toFixed(1)}% restante para terminar con ${meta}.` };
  }

  /* ---------- Notificaciones ---------- */
  async function checkNotifications() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted" && Notification.permission !== "denied")
      await Notification.requestPermission();
    if (Notification.permission !== "granted") return;
    const today = todayISO();
    const d1 = new Date(); d1.setDate(d1.getDate()+1); const tom = toISO(d1);
    const d2 = new Date(); d2.setDate(d2.getDate()+2); const dat = toISO(d2);
    tasks.forEach(t => {
      if (t.estado === "completada") return;
      let ns = notifiedTasks[t.id] || [];
      const notify = (type, msg) => { if (!ns.includes(type)) { new Notification("Aula", { body:msg }); ns.push(type); notifiedTasks[t.id] = ns; save(KEY_NOTIFIED, notifiedTasks); } };
      if (t.fecha === dat)   notify("2_days", `Faltan 2 días para: ${t.titulo}`);
      else if (t.fecha === tom) notify("1_day",  `Falta 1 día para: ${t.titulo}`);
      else if (t.fecha === today) notify("today", `¡Entrega HOY!: ${t.titulo}`);
    });
  }

  /* ---------- Lógica de tareas ---------- */
  const isOverdue  = (t) => t.estado !== "completada" && new Date(`${t.fecha}T${t.hora||"23:59"}`) < new Date();
  const isToday    = (t) => t.fecha === todayISO();
  const subjectOf  = (t) => subjects.find(s => s.id === t.materiaId) || { nombre:"Sin materia", color:"#94a3b8" };
  const sortByDate = (list) => [...list].sort((a,b) => `${a.fecha}${a.hora||""}`.localeCompare(`${b.fecha}${b.hora||""}`));

  function counters() {
    return {
      hoy:       tasks.filter(t => isToday(t) && t.estado !== "completada").length,
      pendientes:tasks.filter(t => t.estado !== "completada" && !isOverdue(t)).length,
      completadas:tasks.filter(t => t.estado === "completada").length,
      vencidas:  tasks.filter(isOverdue).length,
    };
  }

  function toggleTask(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    t.estado = t.estado === "completada" ? "pendiente" : "completada";
    persist(); render();
  }
  async function deleteTask(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    if (await customConfirm(`¿Eliminar la tarea "${t.titulo}"?`)) {
      tasks = tasks.filter(x => x.id !== id); persist(); render();
    }
  }

  /* ---------- Render helpers ---------- */
  const $ = (html) => { const tpl = document.createElement("template"); tpl.innerHTML = html.trim(); return tpl.content.firstElementChild; };
  const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function getNoteClass(nota, minima, maxima) {
    if (nota === null || nota === undefined) return "pending";
    if (nota >= minima * 1.2) return "high";
    if (nota >= minima)       return "mid";
    return "low";
  }

  function priorityBadge(p) {
    return `<span class="priority-label ${p}">${ic(PRIORITY_ICON[p] || "minus", 12)} ${PRIORITY_LABEL[p]}</span>`;
  }

  function statusBadge(t) {
    if (t.estado === "completada") return `<span class="badge completada">${ic("circle-check",12)} Completada</span>`;
    if (isOverdue(t))              return `<span class="badge vencida">${ic("clock",12)} Vencida</span>`;
    if (t.estado === "progreso")   return `<span class="badge progreso">${ic("loader",12)} En progreso</span>`;
    return `<span class="badge">${ic("circle",12)} Pendiente</span>`;
  }

  function taskRow(t) {
    const s = subjectOf(t);
    const done = t.estado === "completada";
    const node = $(`
      <article class="task ${done?"done":""} ${isOverdue(t)?"overdue":""}">
        <div class="task-color" style="background:${s.color}"></div>
        <button class="check ${done?"on":""}" title="${done?"Marcar pendiente":"Marcar completada"}" aria-label="${done?"Marcar pendiente":"Marcar completada"}">
          ${ic("check", 14)}
        </button>
        <div class="task-main">
          <div class="task-subject" style="color:${s.color}">${esc(s.nombre)}</div>
          <div class="task-title">${esc(t.titulo)}</div>
          <div class="task-meta">
            <span class="task-meta-item">${ic("calendar",13)} ${fmtDate(t.fecha)}</span>
            <span class="task-meta-item">${ic("clock",13)} ${fmtTime(t.hora)}</span>
            ${priorityBadge(t.prioridad)}
            ${statusBadge(t)}
          </div>
        </div>
        <div class="task-side"><div class="menu-wrap"><button class="icon-btn" data-menu aria-label="Más opciones">${ic("ellipsis-vertical",18)}</button></div></div>
      </article>
    `);
    node.querySelector(".check").addEventListener("click", e => { e.stopPropagation(); toggleTask(t.id); });
    node.querySelector(".task-main").addEventListener("click", () => openDetail(t.id));
    node.querySelector("[data-menu]").addEventListener("click", e => { e.stopPropagation(); openRowMenu(node.querySelector(".menu-wrap"), t.id); });
    lc();
    return node;
  }

  function openRowMenu(wrap, id) {
    document.querySelectorAll(".menu").forEach(m => m.remove());
    const menu = $(`<div class="menu">
      <button data-a="edit">${ic("pencil",15)} Editar</button>
      <button data-a="del" class="danger">${ic("trash-2",15)} Eliminar</button>
    </div>`);
    const rect = wrap.getBoundingClientRect();
    menu.style.cssText = `position:fixed;top:${rect.bottom+4}px;right:${window.innerWidth-rect.right}px;z-index:200;`;
    menu.addEventListener("click", e => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "edit") openTaskModal(id);
      if (a === "del")  deleteTask(id);
      menu.remove();
    });
    document.body.appendChild(menu);
    lc();
    setTimeout(() => document.addEventListener("click", () => menu.remove(), { once:true }), 0);
  }

  /* ---------- Lucide init shortcut ---------- */
  const lc = () => { if (window.lucide) lucide.createIcons(); };

  /* ---------- Vistas ---------- */
  const content = document.getElementById("content");

  function render() {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === state.view));
    content.innerHTML = "";
    const views = {
      dashboard:    viewDashboard,
      calendar:     viewCalendar,
      subjects:     viewSubjects,
      subjectDetail:viewSubjectDetail,
      tasks:        viewTasks,
      schedule:     viewSchedule,
      stats:        viewStats,
      reminders:    viewReminders,
      exams:        viewExams,
    };
    (views[state.view] || viewDashboard)();
    lc();
    attachCustomSelects();
    attachCustomPickers();
  }

  function header(title, subtitle, actionLabel, onAction) {
    const node = $(`
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

  /* ===== DASHBOARD ===== */
  function viewDashboard() {
    const userName = localStorage.getItem("aula.perfil") || "Camailo";
    header(`Hola, ${esc(userName)}`, "Tu resumen académico de hoy.", `${ic()} + Nueva tarea`, () => openTaskModal());
    // Fix btn content
    const btn = content.querySelector(".page-head .btn-primary");
    if (btn) { btn.innerHTML = `${ic("plus",16)} Nueva tarea`; }

    // Alertas de exámenes próximos (≤ 10 días)
    const alertExams = sortByDate(exams.filter(e => { const d = daysUntil(e.fecha); return d >= 0 && d <= 10; }));
    if (alertExams.length) {
      const wrap = $('<div style="margin-bottom:24px;display:flex;flex-direction:column;gap:8px;"></div>');
      alertExams.slice(0, 3).forEach(e => {
        const s   = subjects.find(x => x.id === e.materiaId);
        const days = daysUntil(e.fecha);
        const urg  = urgencyLevel(days);
        const cls  = urg === "urgente" ? "urgente" : urg === "importante" ? "importante" : "proximo";
        const daysText = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`;
        wrap.appendChild($(`
          <div class="alert-banner ${cls}">
            ${ic(URGENCY_ICON[urg], 20)}
            <div class="alert-banner-body">
              <div class="alert-banner-title">${esc(e.nombre)}${s ? ` · ${esc(s.nombre)}` : ""} — ${daysText}</div>
              <div class="alert-banner-desc">Vale el ${e.porcentaje}% de la materia.${e.temas?.length ? ` Temas: ${e.temas.slice(0,3).join(", ")}.` : ""}</div>
            </div>
          </div>
        `));
      });
      content.appendChild(wrap);
    }

    // Recordatorios urgentes de hoy/mañana
    const urgentReminders = sortByDate(reminders.filter(r => {
      const days = daysUntil(r.fecha);
      return r.estado === "pendiente" && (r.prioridad === "urgente" || r.prioridad === "alta") && days >= 0 && days <= 1;
    }));
    if (urgentReminders.length) {
      urgentReminders.forEach(r => {
        const days = daysUntil(r.fecha);
        const cls  = r.prioridad === "urgente" ? "urgente" : "importante";
        const wrap = $(`
          <div class="alert-banner ${cls}" style="margin-bottom:8px;cursor:pointer;">
            ${ic(PRIORITY_ICON[r.prioridad], 20)}
            <div class="alert-banner-body">
              <div class="alert-banner-title">${esc(r.titulo)} ${priorityBadge(r.prioridad)}</div>
              <div class="alert-banner-desc">${days === 0 ? "Hoy" : "Mañana"} · ${fmtTime(r.hora)}</div>
            </div>
          </div>
        `);
        wrap.addEventListener("click", () => openReminderModal(r.id));
        content.appendChild(wrap);
      });
    }

    // Recordatorios de hoy
    const todayReminders = sortByDate(reminders.filter(r => r.fecha === todayISO() && r.estado === "pendiente" && r.prioridad !== "urgente" && r.prioridad !== "alta"));
    if (todayReminders.length) {
      content.appendChild($(`<h2 class="section-title">${ic("bookmark",18)} Para hoy</h2>`));
      const rWrap = $('<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;"></div>');
      todayReminders.forEach(r => {
        const item = $(`
          <div class="today-reminder">
            <span class="time">${fmtTime(r.hora)}</span>
            <span class="text">${esc(r.titulo)}</span>
            ${priorityBadge(r.prioridad)}
          </div>
        `);
        item.addEventListener("click", () => openReminderModal(r.id));
        rWrap.appendChild(item);
      });
      content.appendChild(rWrap);
    }

    // Stats rápidas
    const c = counters();
    const nextExam = sortByDate(exams.filter(e => daysUntil(e.fecha) >= 0))[0];
    const topRow = $('<div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:32px;"></div>');
    topRow.appendChild($(`<div class="stat accent"><b>${c.hoy}</b><span>Tareas para hoy</span></div>`));
    topRow.appendChild($(`<div class="stat"><b>${c.pendientes}</b><span>Pendientes</span></div>`));
    topRow.appendChild($(`<div class="stat ok"><b>${c.completadas}</b><span>Completadas</span></div>`));
    if (nextExam) {
      const s = subjects.find(x => x.id === nextExam.materiaId);
      const days = daysUntil(nextExam.fecha);
      const urg  = urgencyLevel(days);
      topRow.appendChild($(`<div class="stat ${urg==="urgente"?"danger":urg==="importante"?"warning":"accent"}">
        <b>${days === 0 ? "HOY" : days}</b>
        <span>días para ${esc(nextExam.nombre)}${s ? ` (${esc(s.nombre)})` : ""}</span>
      </div>`));
    }
    content.appendChild(topRow);

    // Cards de materias
    if (subjects.length) {
      content.appendChild($(`<h2 class="section-title">${ic("book-open",18)} Mis materias</h2>`));
      const subGrid = $('<div class="card-grid" style="margin-bottom:32px;"></div>');
      subjects.forEach(s => {
        const st = calcSubjectStats(s.id);
        const nextEx = sortByDate(exams.filter(e => e.materiaId === s.id && daysUntil(e.fecha) >= 0))[0];
        const avg = st.promedioActual;
        const avgCls = avg === null ? "" : avg >= s.notaMinima * 1.2 ? "good" : avg >= s.notaMinima ? "warn" : "danger-text";
        const card = $(`
          <div class="dash-subject-card">
            <div class="color-strip" style="background:${s.color}"></div>
            <div class="dash-subject-card-inner">
              <div class="dash-subject-name">
                <span class="dot" style="background:${s.color};width:10px;height:10px"></span>${esc(s.nombre)}
              </div>
              <div class="dash-subject-stats">
                <div class="dash-stat-item">
                  <span class="dash-stat-label">Promedio actual</span>
                  <span class="dash-stat-value subject-stat-value ${avgCls}">${avg !== null ? avg.toFixed(2) : "—"}</span>
                </div>
                <div class="dash-stat-item">
                  <span class="dash-stat-label">Acumulado</span>
                  <span class="dash-stat-value">${st.acumulada.toFixed(2)}</span>
                </div>
                <div class="dash-stat-item">
                  <span class="dash-stat-label">Evaluado</span>
                  <span class="dash-stat-value" style="color:var(--primary)">${st.porcentajeEvaluado}%</span>
                </div>
                <div class="dash-stat-item">
                  <span class="dash-stat-label">Pendiente</span>
                  <span class="dash-stat-value" style="color:var(--text-muted)">${st.porcentajePendiente}%</span>
                </div>
              </div>
              ${nextEx ? `<div class="next-exam">${ic("calendar-clock",13)} <strong>${esc(nextEx.nombre)}</strong> · en ${daysUntil(nextEx.fecha)} días</div>` : ""}
            </div>
          </div>
        `);
        card.addEventListener("click", () => { state.subjectId = s.id; state.subjectTab = "notas"; state.view = "subjectDetail"; render(); });
        subGrid.appendChild(card);
      });
      content.appendChild(subGrid);
    }

    // Próximas tareas
    content.appendChild($(`<h2 class="section-title">${ic("circle-check",18)} Próximas tareas</h2>`));
    const list = $('<div class="task-list"></div>');
    const upcoming = sortByDate(tasks.filter(t => t.estado !== "completada" && t.fecha >= todayISO())).slice(0, 5);
    if (!upcoming.length) {
      list.appendChild($(`
        <div class="empty">
          <div class="empty-icon-svg">${ic("party-popper",40)}</div>
          <h3>Sin tareas pendientes</h3>
          <p>Estás completamente al día.</p>
        </div>
      `));
    }
    upcoming.forEach(t => list.appendChild(taskRow(t)));
    content.appendChild(list);

    const overdue = sortByDate(tasks.filter(isOverdue));
    if (overdue.length) {
      content.appendChild($(`<h2 class="section-title">${ic("triangle-alert",18)} Vencidas</h2>`));
      const ol = $('<div class="task-list"></div>');
      overdue.forEach(t => ol.appendChild(taskRow(t)));
      content.appendChild(ol);
    }
  }

  /* ===== RECORDATORIOS ===== */
  function viewReminders() {
    header("Recordatorios", "Tus recordatorios personales y académicos.", `${ic("plus",16)} Nuevo recordatorio`, () => openReminderModal());
    content.querySelector(".page-head .btn-primary").innerHTML = `${ic("plus",16)} Nuevo recordatorio`;

    const filters = [
      { k:"hoy",        label:"Hoy" },
      { k:"proximos",   label:"Próximos" },
      { k:"urgentes",   label:"Urgentes" },
      { k:"completados",label:"Completados" },
      { k:"todos",      label:"Todos" },
    ];
    const bar = $(`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
      ${filters.map(f => `<button class="chip ${state.reminderFilter===f.k?"active":""}" data-rf="${f.k}">${f.label}</button>`).join("")}
    </div>`);
    bar.querySelectorAll("[data-rf]").forEach(b => b.onclick = () => { state.reminderFilter = b.dataset.rf; render(); });
    content.appendChild(bar);

    let filtered = [...reminders];
    const today  = todayISO();
    if (state.reminderFilter === "hoy")        filtered = filtered.filter(r => r.fecha === today);
    if (state.reminderFilter === "proximos")   filtered = filtered.filter(r => r.fecha >= today && r.estado === "pendiente");
    if (state.reminderFilter === "urgentes")   filtered = filtered.filter(r => r.prioridad === "urgente" && r.estado === "pendiente");
    if (state.reminderFilter === "completados") filtered = filtered.filter(r => r.estado === "completado");
    filtered = sortByDate(filtered);

    const grid = $('<div class="reminders-grid"></div>');
    if (!filtered.length) {
      grid.appendChild($(`
        <div class="empty">
          <div class="empty-icon-svg">${ic("bell-off",40)}</div>
          <h3>Sin recordatorios aquí</h3>
          <p>Crea tu primer recordatorio para mantenerte organizado.</p>
        </div>
      `));
    } else {
      filtered.forEach(r => grid.appendChild(reminderCard(r)));
    }
    content.appendChild(grid);
  }

  function reminderCard(r) {
    const s    = r.materiaId ? subjects.find(x => x.id === r.materiaId) : null;
    const done = r.estado === "completado";
    const node = $(`
      <div class="reminder-card priority-${r.prioridad} ${done?"done-card":""}">
        <button class="reminder-check ${done?"on":""}" title="${done?"Marcar pendiente":"Marcar completado"}" aria-label="${done?"Marcar pendiente":"Marcar completado"}">
          ${ic("check", 13)}
        </button>
        <div class="reminder-content">
          <div class="reminder-title">${esc(r.titulo)}</div>
          ${r.descripcion ? `<div class="reminder-desc">${esc(r.descripcion)}</div>` : ""}
          <div class="reminder-meta">
            <span class="reminder-meta-item">${ic("calendar",13)} ${fmtDateFull(r.fecha)}</span>
            ${r.hora ? `<span class="reminder-meta-item">${ic("clock",13)} ${fmtTime(r.hora)}</span>` : ""}
            ${s ? `<span class="reminder-meta-item" style="color:${s.color};font-weight:600">${ic("book-open",13)} ${esc(s.nombre)}</span>` : ""}
            <span class="cat-badge ${r.categoria}">${CATEGORIA_LABEL[r.categoria]||r.categoria}</span>
            ${priorityBadge(r.prioridad)}
          </div>
        </div>
        <div class="reminder-side">
          <div class="menu-wrap"><button class="icon-btn" data-menu aria-label="Más opciones">${ic("ellipsis-vertical",18)}</button></div>
        </div>
      </div>
    `);
    node.querySelector(".reminder-check").addEventListener("click", () => {
      r.estado = r.estado === "completado" ? "pendiente" : "completado";
      saveReminders(); render();
    });
    node.querySelector("[data-menu]").addEventListener("click", e => {
      e.stopPropagation();
      document.querySelectorAll(".menu").forEach(m => m.remove());
      const wrap = node.querySelector(".menu-wrap");
      const menu = $(`<div class="menu">
        <button data-a="edit">${ic("pencil",15)} Editar</button>
        <button data-a="del" class="danger">${ic("trash-2",15)} Eliminar</button>
      </div>`);
      const rect = wrap.getBoundingClientRect();
      menu.style.cssText = `position:fixed;top:${rect.bottom+4}px;right:${window.innerWidth-rect.right}px;z-index:200;`;
      menu.addEventListener("click", async ev => {
        const a = ev.target.closest("[data-a]")?.dataset.a;
        if (a === "edit") openReminderModal(r.id);
        if (a === "del") { if (await customConfirm(`¿Eliminar "${r.titulo}"?`)) { reminders = reminders.filter(x => x.id !== r.id); saveReminders(); render(); } }
        menu.remove();
      });
      document.body.appendChild(menu);
      lc();
      setTimeout(() => document.addEventListener("click", () => menu.remove(), { once:true }), 0);
    });
    return node;
  }

  /* ===== EXÁMENES ===== */
  function viewExams() {
    header("Exámenes", "Tus próximos exámenes, parciales y evaluaciones.", `${ic("plus",16)} Nuevo examen`, () => openExamModal());
    content.querySelector(".page-head .btn-primary").innerHTML = `${ic("plus",16)} Nuevo examen`;

    const filters = [
      { k:"proximos",   label:"Próximos" },
      { k:"todos",      label:"Todos" },
      { k:"realizados", label:"Realizados" },
    ];
    const bar = $(`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
      ${filters.map(f => `<button class="chip ${state.examFilter===f.k?"active":""}" data-ef="${f.k}">${f.label}</button>`).join("")}
    </div>`);
    bar.querySelectorAll("[data-ef]").forEach(b => b.onclick = () => { state.examFilter = b.dataset.ef; render(); });
    content.appendChild(bar);

    let filtered = [...exams];
    if (state.examFilter === "proximos")   filtered = filtered.filter(e => daysUntil(e.fecha) >= 0);
    if (state.examFilter === "realizados") filtered = filtered.filter(e => daysUntil(e.fecha) < 0);
    filtered = sortByDate(filtered);

    const grid = $('<div class="exams-grid"></div>');
    if (!filtered.length) {
      grid.appendChild($(`
        <div class="empty">
          <div class="empty-icon-svg">${ic("calendar-x",40)}</div>
          <h3>Sin exámenes aquí</h3>
          <p>Registra tus próximos exámenes para hacer seguimiento y countdown.</p>
        </div>
      `));
    } else {
      filtered.forEach(e => grid.appendChild(examCard(e)));
    }
    content.appendChild(grid);
  }

  function examCard(e) {
    const s    = subjects.find(x => x.id === e.materiaId);
    const days = daysUntil(e.fecha);
    const urg  = urgencyLevel(days);
    const daysDisplay = days < 0 ? "Realizado" : days === 0 ? "HOY" : String(days);
    const daysUnit = days < 0 ? "" : days === 0 ? "" : days === 1 ? "día" : "días";
    const linkedGrade = e.gradeId ? grades.find(g => g.id === e.gradeId) : null;

    const node = $(`
      <div class="exam-card urgency-${urg}">
        <div class="exam-header">
          <div class="exam-title-block">
            <div class="exam-name">${esc(e.nombre)}</div>
            <div class="exam-subject" style="color:${s?.color||"var(--primary)"}">
              <span class="dot" style="background:${s?.color||"var(--primary)"}"></span>
              ${s ? esc(s.nombre) : "Sin materia"}
            </div>
          </div>
          <div class="exam-countdown">
            <div class="exam-days urgency-${urg}">${daysDisplay}</div>
            <div class="exam-days-label">${daysUnit || (days < 0 ? "Realizado" : "Hoy")}</div>
          </div>
        </div>
        <div class="exam-info">
          <span class="exam-info-item">${ic("calendar",14)} ${fmtDate(e.fecha)}${e.hora ? " · "+fmtTime(e.hora) : ""}</span>
          ${e.porcentaje ? `<span class="badge">${ic("percent",11)} ${e.porcentaje}% de la materia</span>` : ""}
          <span class="urgency-badge urgency-${urg}">${ic(URGENCY_ICON[urg],12)} ${URGENCY_LABEL[urg]}</span>
          <span class="prep-badge ${e.preparacion}">${ic(e.preparacion==="listo"?"check-circle":e.preparacion==="en-progreso"?"loader":"circle",12)} ${PREP_LABEL[e.preparacion]}</span>
        </div>
        ${e.temas?.length ? `
          <div class="exam-topics">
            <div class="exam-topics-label">Temas</div>
            <div class="exam-topics-list">${e.temas.map(t => `<span class="topic-chip">${esc(t)}</span>`).join("")}</div>
          </div>
        ` : ""}
        ${e.notas ? `<div style="font-size:13px;color:var(--text-muted);margin-top:8px;display:flex;align-items:center;gap:6px;">${ic("notebook",14)} ${esc(e.notas)}</div>` : ""}
        ${linkedGrade ? `
          <div style="margin-top:10px;font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
            ${linkedGrade.nota !== null
              ? `${ic("check-circle",14)} <span>Nota registrada: <strong style="color:var(--success)">${linkedGrade.nota}</strong></span>`
              : `${ic("link",14)} <span>Vinculado con actividad: <strong>${esc(linkedGrade.nombre)}</strong></span>`
            }
          </div>
        ` : ""}
        <div class="exam-actions"></div>
      </div>
    `);

    const actions = node.querySelector(".exam-actions");
    const editBtn = $(`<button class="btn btn-ghost btn-sm">${ic("pencil",14)} Editar</button>`);
    editBtn.onclick = () => openExamModal(e.id);
    actions.appendChild(editBtn);

    if (linkedGrade && days < 0 && linkedGrade.nota === null) {
      const gBtn = $(`<button class="btn btn-success btn-sm">${ic("clipboard-check",14)} Ingresar nota</button>`);
      gBtn.onclick = () => openGradeModal(linkedGrade.materiaId, linkedGrade.id, true);
      actions.appendChild(gBtn);
    }

    const delBtn = $(`<button class="btn btn-danger btn-sm">${ic("trash-2",14)} Eliminar</button>`);
    delBtn.onclick = async () => {
      if (await customConfirm(`¿Eliminar "${e.nombre}"?`)) {
        exams = exams.filter(x => x.id !== e.id);
        if (e.gradeId) { const g = grades.find(x => x.id === e.gradeId); if (g) g.examId = null; }
        saveExams(); saveGrades(); render();
      }
    };
    actions.appendChild(delBtn);
    return node;
  }

  /* ===== MATERIAS ===== */
  function viewSubjects() {
    header("Materias", "Gestiona tus materias y consulta tu rendimiento académico.", `${ic("plus",16)} Nueva materia`, () => openSubjectModal());
    content.querySelector(".page-head .btn-primary").innerHTML = `${ic("plus",16)} Nueva materia`;

    const grid = $('<div class="card-grid"></div>');
    if (!subjects.length) {
      grid.appendChild($(`
        <div class="empty">
          <div class="empty-icon-svg">${ic("book-open",40)}</div>
          <h3>Sin materias</h3>
          <p>Crea tu primera materia para comenzar a registrar notas y hacer seguimiento.</p>
        </div>
      `));
    }
    subjects.forEach(s => {
      const st   = calcSubjectStats(s.id);
      const pend = tasks.filter(t => t.materiaId === s.id && t.estado !== "completada").length;
      const avg  = st.promedioActual;
      const avgCls = avg === null ? "" : avg >= s.notaMinima * 1.2 ? "good" : avg >= s.notaMinima ? "warn" : "danger-text";
      const appr   = approvalStatus(avg, s.notaMinima);

      const card = $(`
        <article class="card subject-card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
            <span class="dot" style="background:${s.color};width:16px;height:16px"></span>
            <div class="menu-wrap"><button class="icon-btn" data-menu aria-label="Opciones">${ic("ellipsis-vertical",18)}</button></div>
          </div>
          <h3 style="margin-top:10px;font-size:17px">${esc(s.nombre)}</h3>
          ${s.profesor ? `<div class="kv">${ic("user",13)} <b>${esc(s.profesor)}</b></div>` : ""}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
            <span class="scale-pill">${ic("ruler",12)} 0 – ${s.escalaMax}</span>
            ${appr ? `<span class="approval-badge ${appr.cls}" style="font-size:11px;">${ic(appr.icon,12)} ${appr.above ? "Aprobando" : "Por debajo"}</span>` : ""}
          </div>
          <div class="subject-stats">
            <div class="subject-stat-item">
              <span class="subject-stat-label">Promedio actual</span>
              <span class="subject-stat-value ${avgCls}">${avg !== null ? avg.toFixed(2) : "—"}</span>
              <span class="subject-stat-sub">/ ${s.escalaMax} · mín. ${s.notaMinima}</span>
            </div>
            <div class="subject-stat-item">
              <span class="subject-stat-label">Acumulado</span>
              <span class="subject-stat-value">${st.acumulada.toFixed(2)}</span>
              <span class="subject-stat-sub">/ ${s.escalaMax}</span>
            </div>
          </div>
          <div class="subject-progress-bar">
            <div class="bar-labels">
              <span style="color:var(--primary);font-weight:600">${st.porcentajeEvaluado}% evaluado</span>
              <span style="color:var(--text-muted)">${st.porcentajePendiente}% pendiente</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill-evaluated" style="width:${st.porcentajeEvaluado}%"></div>
              <div class="progress-fill-registered" style="left:${st.porcentajeEvaluado}%;width:${st.porcentajeRegistradoPendiente}%"></div>
            </div>
          </div>
          <div style="margin-top:12px"><span class="badge">${pend} tareas pendientes</span></div>
        </article>
      `);
      card.addEventListener("click", () => { state.subjectId = s.id; state.subjectTab = "notas"; state.view = "subjectDetail"; render(); });
      card.querySelector("[data-menu]").addEventListener("click", e => {
        e.stopPropagation();
        const wrap = card.querySelector(".menu-wrap");
        document.querySelectorAll(".menu").forEach(m => m.remove());
        const menu = $(`<div class="menu">
          <button data-a="edit">${ic("pencil",15)} Editar</button>
          <button data-a="del" class="danger">${ic("trash-2",15)} Eliminar</button>
        </div>`);
        menu.addEventListener("click", async ev => {
          ev.stopPropagation();
          const a = ev.target.closest("[data-a]")?.dataset.a;
          if (a === "edit") openSubjectModal(s.id);
          if (a === "del") {
            if (await customConfirm(`¿Eliminar "${s.nombre}" y todas sus notas y tareas?`)) {
              subjects   = subjects.filter(x => x.id !== s.id);
              tasks      = tasks.filter(t => t.materiaId !== s.id);
              grades     = grades.filter(g => g.materiaId !== s.id);
              exams      = exams.filter(e => e.materiaId !== s.id);
              reminders  = reminders.filter(r => r.materiaId !== s.id);
              persist(); render();
            }
          }
          menu.remove();
        });
        wrap.appendChild(menu);
        lc();
        setTimeout(() => document.addEventListener("click", () => menu.remove(), { once:true }), 0);
      });
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  /* ===== DETALLE MATERIA ===== */
  function approvalStatus(avg, notaMinima) {
    if (avg === null) return null;
    const above = avg >= notaMinima;
    return {
      above,
      icon:  above ? "shield-check" : "shield-alert",
      cls:   above ? "approval-above" : "approval-below",
      text:  above ? `Por encima del mínimo (${notaMinima})` : `Por debajo del mínimo requerido (${notaMinima})`,
    };
  }

  function viewSubjectDetail() {
    const s = subjects.find(x => x.id === state.subjectId);
    if (!s) { state.view = "subjects"; return render(); }

    const back = $(`<button class="btn btn-ghost btn-sm" style="margin-bottom:14px;gap:6px;">${ic("arrow-left",16)} Volver</button>`);
    back.onclick = () => { state.view = "subjects"; render(); };
    content.appendChild(back);

    const st  = calcSubjectStats(s.id);
    const avg = st.promedioActual;
    const avgCls = avg === null ? "" : avg >= s.notaMinima * 1.2 ? "good" : avg >= s.notaMinima ? "warn" : "danger-text";
    const appr = approvalStatus(avg, s.notaMinima);

    const header = $(`
      <div class="subject-detail-header">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <h1 style="display:flex;align-items:center;gap:10px;font-size:clamp(22px,3vw,30px)">
            <span class="dot" style="background:${s.color};width:16px;height:16px;flex-shrink:0"></span>
            ${esc(s.nombre)}
          </h1>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" id="editSubjectBtn">${ic("pencil",14)} Editar materia</button>
            <button class="btn btn-primary btn-sm" id="addGradeBtn">${ic("plus",14)} Actividad</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 0;">
          <p style="color:var(--text-muted);font-size:14px;margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${s.profesor ? `<span style="display:inline-flex;align-items:center;gap:5px;">${ic("user",13)} ${esc(s.profesor)}</span>` : ""}
            ${s.horarios?.length ? `<span style="display:inline-flex;align-items:center;gap:5px;">${ic("clock",13)} ${s.horarios.map(h=>`${h.dia.slice(0,3)} ${fmtTime(h.horaInicio)}-${fmtTime(h.horaFin)}`).join(", ")}</span>` : ""}
          </p>
          <span class="scale-pill">${ic("ruler",13)} 0 – ${s.escalaMax} &nbsp;·&nbsp; ${ic("target",13)} Mínimo ${s.notaMinima}</span>
          ${appr ? `<span class="approval-badge ${appr.cls}">${ic(appr.icon,13)} ${appr.text}</span>` : ""}
        </div>
        <div class="subject-detail-stats">
          <div class="subject-detail-stat">
            <span class="subject-detail-stat-label">
              Promedio actual
              <span class="tooltip-wrap">
                <span class="tooltip-icon">${ic("info",11)}</span>
                <span class="tooltip-text">Tu rendimiento sobre el porcentaje ya evaluado. No representa tu nota definitiva.</span>
              </span>
            </span>
            <span class="subject-detail-stat-value ${avgCls}">${avg !== null ? avg.toFixed(2) : "—"}</span>
            <span class="subject-detail-stat-sub">de ${s.escalaMax} posibles</span>
          </div>
          <div class="subject-detail-stat">
            <span class="subject-detail-stat-label">
              Nota acumulada
              <span class="tooltip-wrap">
                <span class="tooltip-icon">${ic("info",11)}</span>
                <span class="tooltip-text">Cuánto llevas acumulado sobre la nota final total (100%) de la materia.</span>
              </span>
            </span>
            <span class="subject-detail-stat-value">${st.acumulada.toFixed(2)}</span>
            <span class="subject-detail-stat-sub">de ${s.escalaMax} definitivos</span>
          </div>
          <div class="subject-detail-stat">
            <span class="subject-detail-stat-label">Evaluado</span>
            <span class="subject-detail-stat-value" style="color:var(--primary)">${st.porcentajeEvaluado}%</span>
          </div>
          <div class="subject-detail-stat">
            <span class="subject-detail-stat-label">Pendiente</span>
            <span class="subject-detail-stat-value" style="color:var(--text-muted)">${st.porcentajePendiente}%</span>
          </div>
        </div>
        <div class="subject-detail-progress">
          <div class="progress-labels-row">
            <span style="color:var(--primary);font-weight:600">${st.porcentajeEvaluado}% evaluado</span>
            ${st.porcentajeRegistradoPendiente > 0 ? `<span style="color:var(--warning);font-weight:600">${st.porcentajeRegistradoPendiente}% pendiente de nota</span>` : ""}
            <span style="color:var(--text-muted)">${st.porcentajeSinAsignar}% sin asignar</span>
          </div>
          <div class="progress-big-track">
            <div class="progress-big-evaluated" style="width:${st.porcentajeEvaluado}%"></div>
            <div class="progress-big-registered" style="left:${st.porcentajeEvaluado}%;width:${st.porcentajeRegistradoPendiente}%"></div>
          </div>
          <div class="progress-legend">
            <div class="progress-legend-item"><div class="legend-dot" style="background:var(--primary)"></div>Evaluado</div>
            <div class="progress-legend-item"><div class="legend-dot" style="background:var(--warning);opacity:.6"></div>Pendiente de nota</div>
            <div class="progress-legend-item"><div class="legend-dot" style="background:var(--border)"></div>Sin asignar</div>
          </div>
        </div>
      </div>
    `);
    header.querySelector("#editSubjectBtn").onclick = () => openSubjectModal(s.id);
    header.querySelector("#addGradeBtn").onclick    = () => openGradeModal(s.id);
    content.appendChild(header);

    // Tabs
    const tabs = $(`
      <div class="tabs">
        <button class="tab ${state.subjectTab==="notas"?"active":""}"      data-tab="notas">${ic("clipboard-list",15)} Notas</button>
        <button class="tab ${state.subjectTab==="proyeccion"?"active":""}" data-tab="proyeccion">${ic("target",15)} Proyección</button>
        <button class="tab ${state.subjectTab==="tareas"?"active":""}"     data-tab="tareas">${ic("circle-check",15)} Tareas</button>
        <button class="tab ${state.subjectTab==="examenes"?"active":""}"   data-tab="examenes">${ic("file-text",15)} Exámenes</button>
        <button class="tab ${state.subjectTab==="info"?"active":""}"       data-tab="info">${ic("info",15)} Info</button>
      </div>
    `);
    tabs.querySelectorAll(".tab").forEach(b => b.onclick = () => { state.subjectTab = b.dataset.tab; render(); });
    content.appendChild(tabs);

    if (state.subjectTab === "notas")       renderGradesTab(s, st);
    else if (state.subjectTab === "proyeccion") renderProjectionTab(s, st);
    else if (state.subjectTab === "tareas") renderSubjectTasksTab(s);
    else if (state.subjectTab === "examenes") renderSubjectExamsTab(s);
    else if (state.subjectTab === "info")   renderSubjectInfoTab(s, st);
  }

  function renderGradesTab(s, st) {
    const addBtn = $(`<button class="btn btn-primary" style="margin-bottom:16px">${ic("plus",14)} Agregar actividad</button>`);
    addBtn.onclick = () => openGradeModal(s.id);
    content.appendChild(addBtn);

    const myGrades = grades.filter(g => g.materiaId === s.id);
    if (!myGrades.length) {
      content.appendChild($(`
        <div class="empty">
          <div class="empty-icon-svg">${ic("clipboard-list",40)}</div>
          <h3>Sin actividades registradas</h3>
          <p>Agrega tu primera actividad para comenzar a calcular tu rendimiento académico.</p>
        </div>
      `));
      return;
    }

    const tableWrap = $('<div class="grades-section"><div class="grades-table-wrap"></div></div>');
    const table = $(`
      <table class="grades-table">
        <thead>
          <tr>
            <th>Actividad</th>
            <th>Tipo</th>
            <th>Nota</th>
            <th>%</th>
            <th>Aporte</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
        <tfoot>
          <tr>
            <td colspan="2"><strong>Total</strong></td>
            <td><strong>${st.promedioActual !== null ? st.promedioActual.toFixed(2) : "—"}</strong> <span style="font-size:11px;font-weight:400;color:var(--text-muted)">promedio</span></td>
            <td><strong>${st.porcentajeEvaluado}%</strong></td>
            <td><strong>${st.acumulada.toFixed(2)}</strong> <span style="font-size:11px;font-weight:400;color:var(--text-muted)">/ ${s.escalaMax}</span></td>
            <td colspan="3" style="color:var(--text-muted);font-size:13px">Pendiente: ${st.porcentajePendiente}%</td>
          </tr>
        </tfoot>
      </table>
    `);

    const tbody = table.querySelector("tbody");
    sortByDate(myGrades).forEach(g => {
      const aporte   = g.nota !== null ? (Number(g.nota) * Number(g.porcentaje) / 100) : null;
      const noteClass = g.nota !== null ? getNoteClass(Number(g.nota), s.notaMinima, s.escalaMax) : "pending";
      const tr = $(`
        <tr>
          <td style="font-weight:600">${esc(g.nombre)}</td>
          <td><span class="tipo-badge ${g.tipo}">${TIPO_LABEL[g.tipo]||g.tipo}</span></td>
          <td class="grade-nota ${noteClass}">${g.nota !== null ? Number(g.nota).toFixed(2) : "Pendiente"}</td>
          <td style="font-weight:600">${g.porcentaje}%</td>
          <td class="grade-aporte ${aporte===null?"pending":""}">${aporte !== null ? aporte.toFixed(3) : "—"}</td>
          <td><span class="badge ${g.estado==="evaluado"?"evaluado":"pendiente-badge"}">${g.estado==="evaluado"?"Evaluado":"Pendiente"}</span></td>
          <td style="color:var(--text-muted);font-size:13px">${g.fecha ? fmtDate(g.fecha) : "—"}</td>
          <td>
            <div class="grade-actions">
              ${g.nota === null ? `<button data-a="grade" title="Ingresar nota" aria-label="Ingresar nota">${ic("clipboard-check",15)}</button>` : ""}
              <button data-a="edit" title="Editar" aria-label="Editar">${ic("pencil",15)}</button>
              <button data-a="del" class="danger" title="Eliminar" aria-label="Eliminar">${ic("trash-2",15)}</button>
            </div>
          </td>
        </tr>
      `);
      tr.querySelector("[data-a='edit']")?.addEventListener("click", () => openGradeModal(s.id, g.id));
      tr.querySelector("[data-a='del']")?.addEventListener("click", async () => {
        if (await customConfirm(`¿Eliminar "${g.nombre}"?`)) {
          grades = grades.filter(x => x.id !== g.id);
          if (g.examId) { const ex = exams.find(x => x.id === g.examId); if (ex) ex.gradeId = null; }
          saveGrades(); saveExams(); render();
        }
      });
      tr.querySelector("[data-a='grade']")?.addEventListener("click", () => openGradeModal(s.id, g.id, true));
      tbody.appendChild(tr);
    });

    tableWrap.querySelector(".grades-table-wrap").appendChild(table);
    content.appendChild(tableWrap);
  }

  function renderProjectionTab(s, st) {
    const panel = $(`
      <div class="projection-panel">
        <h3>${ic("target",18)} Proyección de nota final</h3>
        <p style="color:var(--text-muted);font-size:14px;margin:0 0 16px;line-height:1.6;">
          Calcula qué nota necesitas en el porcentaje restante para alcanzar tu meta.
          Actualmente llevas <strong>${st.acumulada.toFixed(2)}</strong> acumulado
          con el <strong>${st.porcentajeEvaluado}%</strong> evaluado.
        </p>

        <!-- Acceso rápido: ¿qué necesito para aprobar? -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
          <button class="btn btn-ghost btn-sm" id="projApproveBtn">
            ${ic("shield-check",14)} ¿Qué necesito para aprobar? (${s.notaMinima})
          </button>
          <button class="btn btn-ghost btn-sm" id="projClearBtn">${ic("rotate-ccw",14)} Meta personalizada</button>
        </div>

        <div class="projection-input-row">
          <div class="field" style="flex:1;min-width:160px;">
            <span>Meta de nota final <span style="color:var(--text-muted);font-size:12px;font-weight:400">(máx. ${s.escalaMax})</span></span>
            <input type="number" id="projectionMeta" step="0.1" min="0" max="${s.escalaMax}" placeholder="${s.notaMinima}" value="${s.notaMinima}" />
          </div>
          <button class="btn btn-primary" id="calcProjectionBtn">Calcular</button>
        </div>
        <div id="projectionResult"></div>
      </div>
    `);

    const metaInput = panel.querySelector("#projectionMeta");
    const resultDiv = panel.querySelector("#projectionResult");

    const doCalc = () => {
      const meta = parseFloat(metaInput.value);
      if (isNaN(meta) || meta < 0 || meta > s.escalaMax) {
        resultDiv.innerHTML = `<div class="projection-result impossible" style="margin-top:16px">${ic("triangle-alert",20)}<div class="projection-result-body">Ingresa una meta válida entre 0 y ${s.escalaMax}.</div></div>`;
        lc(); return;
      }
      const proj = calcProjection(s.id, meta);
      if (!proj) return;
      let cls, iconName;
      if (!proj.alcanzable) { cls = "impossible"; iconName = "circle-x"; }
      else if (proj.notaNecesaria <= 0) { cls = "achieved"; iconName = "circle-check"; }
      else { cls = "reachable"; iconName = "trending-up"; }

      resultDiv.innerHTML = `
        <div class="projection-result ${cls}" style="margin-top:16px">
          ${ic(iconName, 20)}
          <div class="projection-result-body">
            ${proj.notaNecesaria && proj.notaNecesaria > 0 ? `<b>${proj.notaNecesaria.toFixed(2)} / ${s.escalaMax}</b>` : ""}
            ${proj.mensaje}
          </div>
        </div>
      `;
      lc();
    };

    panel.querySelector("#projApproveBtn").onclick = () => {
      metaInput.value = s.notaMinima;
      doCalc();
    };
    panel.querySelector("#projClearBtn").onclick = () => {
      metaInput.value = s.notaMinima;
      resultDiv.innerHTML = "";
      metaInput.focus();
    };
    panel.querySelector("#calcProjectionBtn").onclick = doCalc;
    metaInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); doCalc(); } });
    content.appendChild(panel);
    setTimeout(doCalc, 50);
  }

  function renderSubjectTasksTab(s) {
    const addBtn = $(`<button class="btn btn-primary" style="margin-bottom:16px">${ic("plus",14)} Agregar tarea</button>`);
    addBtn.onclick = () => openTaskModal(null, { materiaId: s.id });
    content.appendChild(addBtn);

    const mine = tasks.filter(t => t.materiaId === s.id);
    const groups = [
      ["Pendientes", sortByDate(mine.filter(t => t.estado !== "completada"))],
      ["Completadas", sortByDate(mine.filter(t => t.estado === "completada"))],
    ];
    groups.forEach(([label, list]) => {
      content.appendChild($(`<h2 class="section-title">${label}</h2>`));
      const box = $('<div class="task-list"></div>');
      if (!list.length) box.appendChild($(`<div class="empty" style="padding:24px">Sin tareas en este estado.</div>`));
      list.forEach(t => box.appendChild(taskRow(t)));
      content.appendChild(box);
    });
  }

  function renderSubjectExamsTab(s) {
    const addBtn = $(`<button class="btn btn-primary" style="margin-bottom:16px">${ic("plus",14)} Agregar examen</button>`);
    addBtn.onclick = () => openExamModal(null, s.id);
    content.appendChild(addBtn);

    const myExams = sortByDate(exams.filter(e => e.materiaId === s.id));
    if (!myExams.length) {
      content.appendChild($(`
        <div class="empty">
          <div class="empty-icon-svg">${ic("calendar-x",40)}</div>
          <h3>Sin exámenes</h3>
          <p>Agrega exámenes para hacer seguimiento del countdown y los temas.</p>
        </div>
      `));
      return;
    }
    const grid = $('<div class="exams-grid"></div>');
    myExams.forEach(e => grid.appendChild(examCard(e)));
    content.appendChild(grid);
  }

  function renderSubjectInfoTab(s, st) {
    const avg  = st.promedioActual;
    const appr = approvalStatus(avg, s.notaMinima);
    const editScaleBtn = $(`
      <section class="card">
        <h3 style="font-size:15px;margin-bottom:16px;display:flex;align-items:center;gap:8px;justify-content:space-between;">
          <span style="display:flex;align-items:center;gap:8px;">${ic("sliders-horizontal",16)} Configuración académica</span>
          <button class="btn btn-ghost btn-sm" id="editScaleBtn">${ic("pencil",14)} Editar</button>
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:20px;margin-bottom:20px;">
          <div class="subject-detail-stat">
            <span class="subject-detail-stat-label">${ic("trending-up",13)} Escala</span>
            <span class="subject-detail-stat-value">0 – ${s.escalaMax}</span>
            <span class="subject-detail-stat-sub">Nota máxima posible</span>
          </div>
          <div class="subject-detail-stat">
            <span class="subject-detail-stat-label">${ic("target",13)} Mínimo para aprobar</span>
            <span class="subject-detail-stat-value">${s.notaMinima}</span>
            <span class="subject-detail-stat-sub">de ${s.escalaMax}</span>
          </div>
          ${appr ? `<div class="subject-detail-stat">
            <span class="subject-detail-stat-label">${ic("shield",13)} Estado</span>
            <span class="approval-badge ${appr.cls}" style="margin-top:4px;display:inline-flex;">${ic(appr.icon,13)} ${appr.text}</span>
          </div>` : ""}
        </div>
        <hr style="border:0;border-top:1px solid var(--border);margin:0 0 16px;">
        <div class="kv">Nombre<br><b>${esc(s.nombre)}</b></div>
        <div class="kv">Profesor<br><b>${esc(s.profesor||"—")}</b></div>
        <div class="kv">Horarios<br><b>${s.horarios?.length ? s.horarios.map(h=>`${h.dia}: ${fmtTime(h.horaInicio)} – ${fmtTime(h.horaFin)}`).join("<br>") : "—"}</b></div>
        <div class="kv">Actividades registradas<br><b>${st.totalGrades}</b></div>
        <div class="kv">Tareas totales<br><b>${tasks.filter(t=>t.materiaId===s.id).length}</b></div>
      </section>
    `);
    editScaleBtn.querySelector("#editScaleBtn").onclick = () => openSubjectModal(s.id);
    content.appendChild(editScaleBtn);
  }

  /* ===== CALENDARIO ===== */
  function viewCalendar() {
    header("Calendario", "Tus entregas organizadas por fecha.", `${ic("plus",16)} Nueva tarea`, () => openTaskModal());
    content.querySelector(".page-head .btn-primary").innerHTML = `${ic("plus",16)} Nueva tarea`;

    const head = $(`
      <div class="cal-head">
        <div class="cal-nav">
          <button class="btn btn-ghost btn-sm" data-prev>${ic("chevron-left",16)}</button>
          <div class="cal-title"></div>
          <button class="btn btn-ghost btn-sm" data-next>${ic("chevron-right",16)}</button>
          <button class="btn btn-ghost btn-sm" data-today>Hoy</button>
        </div>
        <div class="cal-nav">
          ${["mes","semana","día"].map(m=>`<button class="chip ${state.calMode===m?"active":""}" data-mode="${m}">${m[0].toUpperCase()+m.slice(1)}</button>`).join("")}
        </div>
      </div>
    `);
    content.appendChild(head);
    head.querySelector("[data-prev]").onclick = () => step(-1);
    head.querySelector("[data-next]").onclick = () => step(1);
    head.querySelector("[data-today]").onclick = () => { state.calDate = new Date(); render(); };
    head.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { state.calMode = b.dataset.mode; render(); });
    const d = state.calDate;
    const title = head.querySelector(".cal-title");
    if (state.calMode === "mes") title.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    else if (state.calMode === "semana") title.textContent = `Semana del ${fmtDate(toISO(startOfWeek(d)))}`;
    else title.textContent = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

    if (state.calMode === "mes") renderMonth();
    else if (state.calMode === "semana") renderRange(startOfWeek(d), 7);
    else renderRange(new Date(d), 1);

    function step(dir) {
      const dd = new Date(state.calDate);
      if (state.calMode === "mes") dd.setMonth(dd.getMonth()+dir);
      else if (state.calMode === "semana") dd.setDate(dd.getDate()+7*dir);
      else dd.setDate(dd.getDate()+dir);
      state.calDate = dd; render();
    }
  }

  function startOfWeek(date) { const d = new Date(date); d.setDate(d.getDate()-dowIndex(d)); return d; }

  function eventChip(t) {
    const s = subjectOf(t);
    const node = $(`<div class="cal-ev ${t.estado==="completada"?"done":""}" style="background:${s.color}1a;color:${s.color}"><span class="dot" style="background:${s.color};width:8px;height:8px;flex-shrink:0"></span> ${esc(t.titulo)}</div>`);
    node.addEventListener("click", () => openDetail(t.id));
    return node;
  }

  function renderMonth() {
    const d = state.calDate;
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const start = startOfWeek(first);
    const grid  = $('<div class="cal-grid"></div>');
    DOW_SHORT.forEach(n => grid.appendChild($(`<div class="cal-dow">${n}</div>`)));
    for (let i = 0; i < 42; i++) {
      const day = new Date(start); day.setDate(start.getDate()+i);
      const iso = toISO(day);
      const cell = $(`<div class="cal-cell ${day.getMonth()!==d.getMonth()?"out":""} ${iso===todayISO()?"today":""}"><div class="cal-daynum">${day.getDate()}</div></div>`);
      sortByDate(tasks.filter(t => t.fecha === iso)).forEach(t => cell.appendChild(eventChip(t)));
      cell.addEventListener("dblclick", () => openTaskModal(null, { fecha:iso }));
      grid.appendChild(cell);
    }
    content.appendChild(grid);
  }

  function renderRange(startDate, days) {
    const wrap = $('<div class="task-list"></div>');
    for (let i = 0; i < days; i++) {
      const day = new Date(startDate); day.setDate(startDate.getDate()+i);
      const iso = toISO(day);
      const dayTasks = sortByDate(tasks.filter(t => t.fecha === iso));
      const card = $(`<section class="card"><h3 style="font-size:15px">${DAYS[dowIndex(day)]} ${fmtDate(iso)}${iso===todayISO()?" · Hoy":""}</h3><div class="task-list" style="margin-top:12px"></div></section>`);
      const list = card.querySelector(".task-list");
      if (!dayTasks.length) list.appendChild($('<div class="empty" style="padding:20px">Sin tareas este día.</div>'));
      dayTasks.forEach(t => list.appendChild(taskRow(t)));
      wrap.appendChild(card);
    }
    content.appendChild(wrap);
  }

  /* ===== TAREAS ===== */
  function viewTasks() {
    header("Mis tareas", "Filtra, busca y administra todos tus pendientes.", `${ic("plus",16)} Nueva tarea`, () => openTaskModal());
    content.querySelector(".page-head .btn-primary").innerHTML = `${ic("plus",16)} Nueva tarea`;

    const bar = $(`
      <section class="card" style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${["todas","hoy","pendientes","completadas","vencidas"].map(f=>`<button class="chip ${state.filter===f?"active":""}" data-f="${f}">${f[0].toUpperCase()+f.slice(1)}</button>`).join("")}
        </div>
        <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
          <div style="position:relative;display:flex;align-items:center;">
            ${ic("search",14)}
            <input class="inp" data-k="search" placeholder="Buscar tarea..." value="${esc(state.search)}" style="padding-left:32px;position:absolute;left:0;right:0;" />
          </div>
          <select data-k="filterSubject" class="inp">
            <option value="">Todas las materias</option>
            ${subjects.map(s=>`<option value="${s.id}" ${state.filterSubject===s.id?"selected":""}>${esc(s.nombre)}</option>`).join("")}
          </select>
          <select data-k="filterPriority" class="inp">
            <option value="">Toda prioridad</option>
            ${["urgente","alta","media","baja"].map(p=>`<option value="${p}" ${state.filterPriority===p?"selected":""}>${PRIORITY_LABEL[p]}</option>`).join("")}
          </select>
          <input type="date" data-k="filterDate" value="${state.filterDate}" class="inp" />
        </div>
      </section>
    `);
    // Fix search icon placement
    const searchWrap = bar.querySelector('[data-k="search"]').parentElement;
    const icon = searchWrap.querySelector("[data-lucide]");
    if (icon) { icon.style.cssText = "position:absolute;left:10px;z-index:1;width:15px;height:15px;color:var(--text-muted);pointer-events:none;"; }
    bar.querySelectorAll("input,select").forEach(i => {
      i.addEventListener("change", () => { state[i.dataset.k] = i.value; render(); });
      if (i.dataset.k === "search") i.addEventListener("input", () => { state.search = i.value; renderFilteredList(); });
    });
    bar.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { state.filter = b.dataset.f; render(); });
    content.appendChild(bar);

    const list = $('<div class="task-list" id="filteredList" style="margin-top:18px"></div>');
    content.appendChild(list);
    renderFilteredList();
  }

  function filteredTasks() {
    let list = tasks.slice();
    if (state.filter === "hoy")         list = list.filter(isToday);
    if (state.filter === "pendientes")  list = list.filter(t => t.estado !== "completada" && !isOverdue(t));
    if (state.filter === "completadas") list = list.filter(t => t.estado === "completada");
    if (state.filter === "vencidas")    list = list.filter(isOverdue);
    if (state.filterSubject)  list = list.filter(t => t.materiaId === state.filterSubject);
    if (state.filterPriority) list = list.filter(t => t.prioridad === state.filterPriority);
    if (state.filterDate)     list = list.filter(t => t.fecha === state.filterDate);
    if (state.search.trim()) { const q = state.search.toLowerCase(); list = list.filter(t => t.titulo.toLowerCase().includes(q)||(t.descripcion||"").toLowerCase().includes(q)); }
    return sortByDate(list);
  }

  function renderFilteredList() {
    const list = document.getElementById("filteredList"); if (!list) return;
    list.innerHTML = "";
    const items = filteredTasks();
    if (!items.length) list.appendChild($(`
      <div class="empty">
        <div class="empty-icon-svg">${ic("search-x",40)}</div>
        <h3>Sin resultados</h3>
        <p>No se encontraron tareas con esos filtros.</p>
      </div>
    `));
    items.forEach(t => list.appendChild(taskRow(t)));
    lc();
  }

  /* ===== HORARIO ===== */
  function viewSchedule() {
    header("Horario", "Tu semana académica de un vistazo.", `${ic("plus",16)} Nueva materia`, () => openSubjectModal());
    content.querySelector(".page-head .btn-primary").innerHTML = `${ic("plus",16)} Nueva materia`;

    const wrap = $('<div class="sched-wrap"><div class="sched"></div></div>');
    const grid = wrap.querySelector(".sched");
    const cols  = DAYS.slice(0, 6);
    grid.appendChild($('<div class="sched-h"></div>'));
    cols.forEach(d => grid.appendChild($(`<div class="sched-h">${d}</div>`)));
    HOURS.forEach(h => {
      grid.appendChild($(`<div class="sched-hour">${fmtTime(`${String(h).padStart(2,"0")}:00`)}</div>`));
      cols.forEach(day => {
        const slot = $('<div class="sched-slot"></div>');
        subjects.forEach(s => (s.horarios||[]).forEach(ho => {
          if (ho.dia === day && Number(ho.horaInicio.split(":")[0]) === h) {
            const start  = Number(ho.horaInicio.split(":")[0]) + Number(ho.horaInicio.split(":")[1])/60;
            const end    = Number(ho.horaFin.split(":")[0])   + Number(ho.horaFin.split(":")[1])/60;
            const height = Math.max(0.5, end-start)*56-4;
            const block  = $(`<div class="sched-block" style="background:${s.color};height:${height}px"><b>${esc(s.nombre)}</b><small>${fmtTime(ho.horaInicio)} – ${fmtTime(ho.horaFin)}</small><br><small>${esc(s.profesor||"")}</small></div>`);
            block.addEventListener("click", () => { state.subjectId = s.id; state.view = "subjectDetail"; render(); });
            slot.appendChild(block);
          }
        }));
        grid.appendChild(slot);
      });
    });
    content.appendChild(wrap);
  }

  /* ===== ESTADÍSTICAS ===== */
  function viewStats() {
    header("Estadísticas", "Tu productividad académica calculada automáticamente.");
    const c = counters();
    const total = tasks.length || 1;
    const pct   = Math.round((c.completadas/total)*100);
    content.appendChild($(`
      <section class="card">
        <h3 style="font-size:15px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">${ic("bar-chart-2",16)} Progreso general de tareas</h3>
        <div class="ring">${pct}%</div>
        <div style="color:var(--text-muted);font-size:13.5px;margin:4px 0 12px">Tareas completadas</div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </section>
    `));
    content.appendChild($(`
      <div class="stat-grid" style="margin-top:16px">
        <div class="stat"><b>${c.pendientes}</b><span>Pendientes</span></div>
        <div class="stat ok"><b>${c.completadas}</b><span>Completadas</span></div>
        <div class="stat danger"><b>${c.vencidas}</b><span>Vencidas</span></div>
      </div>
    `));
    content.appendChild($(`<h2 class="section-title">${ic("graduation-cap",18)} Rendimiento por materia</h2>`));
    const box = $('<div style="display:flex;flex-direction:column;gap:20px"></div>');
    if (!subjects.length) box.appendChild($('<div class="empty">Crea materias para ver su rendimiento.</div>'));
    subjects.forEach(s => {
      const st   = calcSubjectStats(s.id);
      const mine = tasks.filter(t => t.materiaId===s.id);
      const done = mine.filter(t => t.estado==="completada").length;
      const p    = mine.length ? Math.round((done/mine.length)*100) : 0;
      const avg  = st.promedioActual;
      const avgCls = avg === null ? "" : avg >= s.notaMinima * 1.2 ? "good" : avg >= s.notaMinima ? "warn" : "danger-text";
      box.appendChild($(`
        <div class="card" style="padding:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:14px">
            <h3 style="display:flex;align-items:center;gap:8px;font-size:16px">
              <span class="dot" style="background:${s.color}"></span>${esc(s.nombre)}
            </h3>
            <div style="display:flex;gap:16px">
              <div style="text-align:center">
                <div class="subject-stat-value ${avgCls}" style="font-size:22px">${avg !== null ? avg.toFixed(2) : "—"}</div>
                <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em">Promedio</div>
              </div>
              <div style="text-align:center">
                <div style="font-size:22px;font-weight:700;font-family:var(--font-display)">${st.acumulada.toFixed(2)}</div>
                <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em">Acumulado</div>
              </div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
            <span>Evaluado: <b>${st.porcentajeEvaluado}%</b></span>
            <span style="color:var(--text-muted)">Tareas: ${done}/${mine.length} (${p}%)</span>
          </div>
          <div class="progress"><i style="width:${st.porcentajeEvaluado}%;background:${s.color}"></i></div>
        </div>
      `));
    });
    content.appendChild(box);
  }

  /* ---------- Modales ---------- */
  const subjectModal  = document.getElementById("subjectModal");
  const taskModal     = document.getElementById("taskModal");
  const detailModal   = document.getElementById("detailModal");
  const reminderModal = document.getElementById("reminderModal");
  const examModal     = document.getElementById("examModal");
  const gradeModal    = document.getElementById("gradeModal");
  const subjectForm   = document.getElementById("subjectForm");
  const taskForm      = document.getElementById("taskForm");
  const reminderForm  = document.getElementById("reminderForm");
  const examForm      = document.getElementById("examForm");
  const gradeForm     = document.getElementById("gradeForm");
  const confirmModal  = document.getElementById("confirmModal");
  const alertModal    = document.getElementById("alertModal");

  const closeModal = (m) => { m.hidden = true; };
  document.querySelectorAll(".modal-overlay").forEach(m => {
    m.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(m); });
  });

  function customAlert(msg) {
    return new Promise(resolve => {
      document.getElementById("alertMessage").textContent = msg;
      alertModal.hidden = false; lc();
      const chk = setInterval(() => { if (alertModal.hidden) { clearInterval(chk); resolve(); } }, 50);
      document.getElementById("alertOk").onclick = () => { alertModal.hidden = true; };
    });
  }
  function customConfirm(msg) {
    return new Promise(resolve => {
      document.getElementById("confirmMessage").textContent = msg;
      confirmModal.hidden = false; lc();
      let val = false;
      const chk = setInterval(() => { if (confirmModal.hidden) { clearInterval(chk); resolve(val); } }, 50);
      document.getElementById("confirmOk").onclick     = () => { val = true;  confirmModal.hidden = true; };
      document.getElementById("confirmCancel").onclick = () => { val = false; confirmModal.hidden = true; };
    });
  }

  /* ----- Modal Materia ----- */
  const swatches = document.getElementById("colorSwatches");
  COLORS.forEach(c => {
    const b = $(`<button type="button" class="swatch" style="background:${c}" data-color="${c}"></button>`);
    b.onclick = () => { state.modalColor = c; paintSwatches(); };
    swatches.appendChild(b);
  });
  const paintSwatches = () => swatches.querySelectorAll(".swatch").forEach(b => b.classList.toggle("sel", b.dataset.color === state.modalColor));

  const scheduleList = document.getElementById("scheduleList");
  document.getElementById("addScheduleBtn").onclick = () => addScheduleRow();

  function addScheduleRow(h = { dia:"Lunes", horaInicio:"08:00", horaFin:"10:00" }) {
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.style.cssText = "display:flex;gap:8px;align-items:center;";
    row.innerHTML = `
      <select class="inp schedule-dia" style="flex:1">${DAYS.map(d=>`<option value="${d}" ${d===h.dia?"selected":""}>${d}</option>`).join("")}</select>
      <input type="time" class="inp schedule-inicio" value="${h.horaInicio}" />
      <span style="color:var(--text-muted);font-size:13px">a</span>
      <input type="time" class="inp schedule-fin" value="${h.horaFin}" />
      <button type="button" class="icon-btn" style="color:var(--danger)" onclick="this.parentElement.remove()" title="Eliminar horario" aria-label="Eliminar horario">${ic("x",16)}</button>
    `;
    scheduleList.appendChild(row);
    attachCustomSelects(); attachCustomPickers(); lc();
  }

  function openSubjectModal(id = null) {
    const s = subjects.find(x => x.id === id);
    subjectForm.reset();
    subjectForm.id.value       = s ? s.id : "";
    subjectForm.nombre.value   = s?.nombre || "";
    subjectForm.profesor.value = s?.profesor || "";
    subjectForm.notaMinima.value = s?.notaMinima ?? 3.0;
    subjectForm.escalaMax.value  = s?.escalaMax  ?? 5.0;
    state.modalColor = s?.color || COLORS[0];
    paintSwatches();
    scheduleList.innerHTML = "";
    const horarios = s?.horarios?.length ? s.horarios : [{ dia:"Lunes", horaInicio:"08:00", horaFin:"10:00" }];
    horarios.forEach(h => addScheduleRow(h));
    document.getElementById("subjectModalTitle").textContent = s ? "Editar materia" : "Nueva materia";
    subjectModal.hidden = false; attachCustomSelects(); attachCustomPickers(); lc();
  }

  subjectForm.addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(subjectForm);
    const id = f.get("id");
    const escalaMax  = parseFloat(f.get("escalaMax"));
    const notaMinima = parseFloat(f.get("notaMinima"));

    // Validaciones de escala
    if (isNaN(escalaMax) || escalaMax <= 0) {
      await customAlert("La nota máxima debe ser un número mayor que 0."); return;
    }
    if (isNaN(notaMinima) || notaMinima < 0) {
      await customAlert("La nota mínima para aprobar no puede ser negativa."); return;
    }
    if (notaMinima > escalaMax) {
      await customAlert("La nota mínima para aprobar no puede ser mayor que la nota máxima de la materia."); return;
    }
    // Validar conflicto con notas existentes al reducir escalaMax
    if (id) {
      const maxExisting = grades
        .filter(g => g.materiaId === id && g.nota !== null)
        .reduce((m, g) => Math.max(m, Number(g.nota)), 0);
      if (maxExisting > escalaMax) {
        await customAlert(`No puedes establecer una nota máxima de ${escalaMax} porque ya existen calificaciones superiores a ese valor (${maxExisting}). Revisa las notas registradas antes de modificar la escala.`);
        return;
      }
    }

    const horarios = [];
    scheduleList.querySelectorAll(".schedule-row").forEach(row => {
      const dia    = row.querySelector(".schedule-dia")?.value;
      const inicio = row.querySelector(".schedule-inicio")?.value;
      const fin    = row.querySelector(".schedule-fin")?.value;
      if (dia && inicio && fin) horarios.push({ dia, horaInicio:inicio, horaFin:fin });
    });
    const data = {
      nombre:     f.get("nombre").trim(),
      profesor:   f.get("profesor").trim(),
      color:      state.modalColor,
      horarios,
      notaMinima,
      escalaMax,
    };
    if (id) Object.assign(subjects.find(s => s.id === id), data);
    else subjects.push({ id:uid(), ...data });
    persist(); closeModal(subjectModal); render();
  });

  /* ----- Modal Tarea ----- */
  async function openTaskModal(id = null, defaults = {}) {
    if (!subjects.length) { await customAlert("Primero crea una materia."); openSubjectModal(); return; }
    const t = tasks.find(x => x.id === id);
    document.getElementById("taskSubjectSelect").innerHTML = subjects.map(s => `<option value="${s.id}">${esc(s.nombre)}</option>`).join("");
    taskForm.reset();
    taskForm.id.value          = t ? t.id : "";
    taskForm.titulo.value      = t?.titulo || "";
    taskForm.materiaId.value   = t?.materiaId || defaults.materiaId || subjects[0].id;
    taskForm.descripcion.value = t?.descripcion || "";
    taskForm.fecha.value       = t?.fecha || defaults.fecha || todayISO();
    taskForm.hora.value        = t?.hora || "18:00";
    taskForm.prioridad.value   = t?.prioridad || "media";
    taskForm.estado.value      = t?.estado || "pendiente";
    document.getElementById("taskModalTitle").textContent = t ? "Editar tarea" : "Nueva tarea";
    document.getElementById("taskSubmit").textContent     = t ? "Guardar cambios" : "Crear tarea";
    taskModal.hidden = false; attachCustomSelects(); lc();
  }

  taskForm.addEventListener("submit", e => {
    e.preventDefault();
    const f    = new FormData(taskForm);
    const data = { titulo:f.get("titulo").trim(), descripcion:f.get("descripcion").trim(), materiaId:f.get("materiaId"), fecha:f.get("fecha"), hora:f.get("hora"), prioridad:f.get("prioridad"), estado:f.get("estado") };
    const id   = f.get("id");
    if (id) Object.assign(tasks.find(t => t.id === id), data);
    else tasks.push({ id:uid(), ...data, fechaCreacion:new Date().toISOString() });
    persist(); closeModal(taskModal); render();
  });

  /* ----- Modal Detalle Tarea ----- */
  function openDetail(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    const s = subjectOf(t);
    const body = document.getElementById("detailBody");
    body.innerHTML = `
      <div class="task-subject" style="color:${s.color};font-weight:600;display:flex;align-items:center;gap:6px;">${ic("book-open",14)} ${esc(s.nombre)}</div>
      <h2 style="font-size:20px;margin:8px 0">${esc(t.titulo)}</h2>
      <p style="color:var(--text-muted);font-size:14px;margin:0 0 12px">${esc(t.descripcion)||"Sin descripción."}</p>
      <div class="task-meta">
        <span class="task-meta-item">${ic("calendar",13)} ${fmtDate(t.fecha)}</span>
        <span class="task-meta-item">${ic("clock",13)} ${fmtTime(t.hora)}</span>
        ${priorityBadge(t.prioridad)}
        ${statusBadge(t)}
      </div>
      <div class="modal-foot" style="padding:0;border:0;margin-top:20px">
        <button class="btn btn-danger" data-a="del">${ic("trash-2",14)} Eliminar</button>
        <button class="btn btn-ghost" data-a="edit">${ic("pencil",14)} Editar</button>
        <button class="btn btn-primary" data-a="toggle">${t.estado==="completada"?"Marcar pendiente":"Marcar completada"}</button>
      </div>
    `;
    body.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      closeModal(detailModal);
      if (a === "del")    deleteTask(t.id);
      if (a === "edit")   openTaskModal(t.id);
      if (a === "toggle") toggleTask(t.id);
    });
    detailModal.hidden = false; lc();
  }

  /* ----- Modal Recordatorio ----- */
  function openReminderModal(id = null) {
    const r = reminders.find(x => x.id === id);
    reminderForm.reset();
    reminderForm.id.value          = r ? r.id : "";
    reminderForm.titulo.value      = r?.titulo || "";
    reminderForm.descripcion.value = r?.descripcion || "";
    reminderForm.fecha.value       = r?.fecha || todayISO();
    reminderForm.hora.value        = r?.hora || "08:00";
    reminderForm.categoria.value   = r?.categoria || "personal";
    reminderForm.prioridad.value   = r?.prioridad || "media";
    const sel = document.getElementById("reminderSubjectSelect");
    sel.innerHTML = `<option value="">Sin materia</option>${subjects.map(s=>`<option value="${s.id}" ${r?.materiaId===s.id?"selected":""}>${esc(s.nombre)}</option>`).join("")}`;
    document.getElementById("reminderModalTitle").textContent = r ? "Editar recordatorio" : "Nuevo recordatorio";
    document.getElementById("reminderSubmit").textContent     = r ? "Guardar cambios" : "Crear recordatorio";
    reminderModal.hidden = false; attachCustomSelects(); lc();
  }

  reminderForm.addEventListener("submit", e => {
    e.preventDefault();
    const f    = new FormData(reminderForm);
    const data = {
      titulo:      f.get("titulo").trim(),
      descripcion: f.get("descripcion").trim(),
      fecha:       f.get("fecha"),
      hora:        f.get("hora"),
      materiaId:   f.get("materiaId") || null,
      categoria:   f.get("categoria"),
      prioridad:   f.get("prioridad"),
    };
    const id = f.get("id");
    if (id) Object.assign(reminders.find(r => r.id === id), data);
    else reminders.push({ id:uid(), ...data, estado:"pendiente", fechaCreacion:new Date().toISOString() });
    saveReminders(); closeModal(reminderModal); render();
  });

  /* ----- Modal Examen ----- */
  function openExamModal(id = null, presetMateriaId = null) {
    if (!subjects.length) { customAlert("Primero crea una materia."); return; }
    const e   = exams.find(x => x.id === id);
    const sel = document.getElementById("examSubjectSelect");
    sel.innerHTML = subjects.map(s => `<option value="${s.id}">${esc(s.nombre)}</option>`).join("");
    examForm.reset();
    examForm.id.value          = e ? e.id : "";
    examForm.gradeId.value     = e?.gradeId || "";
    examForm.materiaId.value   = e?.materiaId || presetMateriaId || subjects[0].id;
    examForm.nombre.value      = e?.nombre || "";
    examForm.fecha.value       = e?.fecha || "";
    examForm.hora.value        = e?.hora || "08:00";
    examForm.porcentaje.value  = e?.porcentaje || "";
    examForm.preparacion.value = e?.preparacion || "sin-iniciar";
    examForm.temas.value       = e?.temas?.join("\n") || "";
    examForm.notas.value       = e?.notas || "";
    document.getElementById("examLinkField").style.display = e ? "none" : "";
    const chk = document.getElementById("examCreateGrade");
    if (chk) chk.checked = !e;
    document.getElementById("examModalTitle").textContent = e ? "Editar examen" : "Nuevo examen";
    document.getElementById("examSubmit").textContent     = e ? "Guardar cambios" : "Crear examen";
    examModal.hidden = false; attachCustomSelects(); lc();
  }

  examForm.addEventListener("submit", async e => {
    e.preventDefault();
    const f    = new FormData(examForm);
    const createGrade = document.getElementById("examCreateGrade")?.checked;
    const temas = f.get("temas").trim().split("\n").map(t => t.trim()).filter(Boolean);
    const pct   = parseFloat(f.get("porcentaje")) || 0;
    const materiaId = f.get("materiaId");
    const data = { materiaId, nombre:f.get("nombre").trim(), fecha:f.get("fecha"), hora:f.get("hora"), porcentaje:pct, temas, notas:f.get("notas").trim(), preparacion:f.get("preparacion") };
    const id = f.get("id");
    let gradeId = f.get("gradeId") || null;

    if (id) {
      Object.assign(exams.find(ex => ex.id === id), { ...data, gradeId });
    } else {
      if (createGrade && pct > 0) {
        const currentTotal = grades.filter(g => g.materiaId === materiaId).reduce((s,g) => s + Number(g.porcentaje), 0);
        if (currentTotal + pct > 100) {
          await customAlert(`No puedes asignar ${pct}%. La materia ya tiene ${currentTotal.toFixed(1)}% asignado. Solo quedan ${(100-currentTotal).toFixed(1)}%.`);
          return;
        }
        const newGrade = { id:uid(), materiaId, nombre:data.nombre, tipo:"parcial", nota:null, porcentaje:pct, fecha:data.fecha, estado:"pendiente", examId:null };
        gradeId = newGrade.id;
        grades.push(newGrade);
      }
      const newExam = { id:uid(), ...data, gradeId };
      if (gradeId) { const g = grades.find(x => x.id === gradeId); if (g) g.examId = newExam.id; }
      exams.push(newExam);
    }
    persist(); closeModal(examModal); render();
  });

  /* ----- Modal Nota/Actividad ----- */
  function openGradeModal(materiaId, gradeId = null, focusNota = false) {
    const g = gradeId ? grades.find(x => x.id === gradeId) : null;
    const s = subjects.find(x => x.id === materiaId);
    gradeForm.reset();
    gradeForm.id.value         = g ? g.id : "";
    gradeForm.materiaId.value  = materiaId;
    gradeForm.examId.value     = g?.examId || "";
    gradeForm.nombre.value     = g?.nombre || "";
    gradeForm.tipo.value       = g?.tipo || "parcial";
    gradeForm.estado.value     = g?.estado || "evaluado";
    gradeForm.nota.value       = g?.nota ?? "";
    gradeForm.porcentaje.value = g?.porcentaje || "";
    gradeForm.fecha.value      = g?.fecha || todayISO();
    const infoDiv = document.getElementById("gradePortionInfo");
    const currentTotal = grades.filter(x => x.materiaId === materiaId && x.id !== gradeId).reduce((s,x) => s + Number(x.porcentaje), 0);
    const available    = 100 - currentTotal;
    infoDiv.style.display = "flex";
    infoDiv.innerHTML = `${ic("info",16)} Porcentaje disponible en <strong>${s?.nombre || "esta materia"}</strong>: ${available.toFixed(1)}%`;
    document.getElementById("gradeModalTitle").textContent = g ? (focusNota ? "Ingresar nota" : "Editar actividad") : "Nueva actividad";
    document.getElementById("gradeSubmit").textContent     = g ? "Guardar cambios" : "Guardar actividad";
    gradeModal.hidden = false; attachCustomSelects(); lc();
    if (focusNota) setTimeout(() => document.getElementById("gradeNotaInput")?.focus(), 150);
  }

  gradeForm.addEventListener("submit", async e => {
    e.preventDefault();
    const f    = new FormData(gradeForm);
    const id   = f.get("id");
    const materiaId = f.get("materiaId");
    const pct  = parseFloat(f.get("porcentaje"));
    const nota = f.get("nota").trim() !== "" ? parseFloat(f.get("nota")) : null;
    const estado = nota !== null ? "evaluado" : (f.get("estado") || "pendiente");
    const currentTotal = grades.filter(x => x.materiaId === materiaId && x.id !== id).reduce((s,x) => s + Number(x.porcentaje), 0);
    if (currentTotal + pct > 100.001) {
      await customAlert(`No puedes asignar ${pct}%. La materia ya tiene ${currentTotal.toFixed(1)}% asignado. Solo quedan ${(100-currentTotal).toFixed(1)}%.`);
      return;
    }
    const data = { materiaId, nombre:f.get("nombre").trim(), tipo:f.get("tipo"), nota, porcentaje:pct, fecha:f.get("fecha"), estado, examId:f.get("examId")||null };
    if (id) Object.assign(grades.find(x => x.id === id), data);
    else grades.push({ id:uid(), ...data });
    saveGrades(); closeModal(gradeModal); render();
  });

  /* ---------- Navegación ---------- */
  document.getElementById("nav").addEventListener("click", e => {
    const btn = e.target.closest(".nav-item");
    if (btn?.dataset.view) go(btn.dataset.view);
  });

  function go(view) {
    state.view = view;
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").hidden = true;
    render();
  }

  const sidebar = document.getElementById("sidebar");
  const scrim   = document.getElementById("scrim");
  document.getElementById("menuToggle").onclick = () => {
    sidebar.classList.toggle("open");
    scrim.hidden = !sidebar.classList.contains("open");
  };
  scrim.onclick = () => { sidebar.classList.remove("open"); scrim.hidden = true; };
  document.querySelectorAll("[data-new-task]").forEach(b => b.onclick = () => openTaskModal());

  /* ---------- Custom Select Component ---------- */
  const csPortal = document.createElement("div");
  csPortal.className = "cs-portal";
  csPortal.setAttribute("role", "listbox");
  document.body.appendChild(csPortal);

  let csActiveWrap = null, csActiveSel = null, csFocusedIndex = -1, csOptions = [];

  function csClose() {
    csPortal.style.display = "none";
    csPortal.innerHTML = "";
    if (csActiveWrap) {
      csActiveWrap.classList.remove("open");
      const head = csActiveWrap.querySelector(".custom-select-head");
      if (head) head.setAttribute("aria-expanded", "false");
    }
    csActiveWrap = null; csActiveSel = null; csFocusedIndex = -1; csOptions = [];
  }

  function csOpen(wrap, sel, head) {
    if (csActiveWrap === wrap) { csClose(); return; }
    csClose();
    csActiveSel = sel; csActiveWrap = wrap;
    wrap.classList.add("open");
    head.setAttribute("aria-expanded", "true");
    csPortal.innerHTML = "";
    
    csOptions = Array.from(sel.options);
    csFocusedIndex = Math.max(0, sel.selectedIndex);
    
    csOptions.forEach((opt, idx) => {
      const isSelected = sel.value === opt.value;
      const item = document.createElement("div");
      item.className = "custom-select-item" + (isSelected ? " selected" : "");
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", isSelected);
      item.innerHTML = `<span>${esc(opt.textContent)}</span>${isSelected ? ic("check", 14) : ""}`;
      
      item.onmousedown = ev => { 
        ev.preventDefault(); ev.stopPropagation(); 
        sel.value = opt.value; sel.dispatchEvent(new Event("change")); 
        csClose(); 
      };
      
      item.onmouseenter = () => {
        csFocusedIndex = idx;
        updateCsFocus();
      };
      
      csPortal.appendChild(item);
    });
    
    // Posicionamiento inteligente
    const rect = head.getBoundingClientRect();
    const portalMaxHeight = 250;
    let top = rect.bottom + 4;
    
    csPortal.style.display = "flex";
    if (top + portalMaxHeight > window.innerHeight && rect.top - portalMaxHeight > 0) {
      // Abrir hacia arriba si no hay espacio abajo
      top = rect.top - csPortal.offsetHeight - 4;
    }
    
    Object.assign(csPortal.style, { left: rect.left + "px", top: top + "px", width: rect.width + "px" });
    updateCsFocus();
    lc();
  }

  function updateCsFocus() {
    const items = csPortal.querySelectorAll(".custom-select-item");
    items.forEach((it, i) => {
      it.classList.toggle("focused", i === csFocusedIndex);
      if (i === csFocusedIndex) {
        // Asegurar que el elemento enfocado esté visible en el scroll
        const pRect = csPortal.getBoundingClientRect();
        const iRect = it.getBoundingClientRect();
        if (iRect.bottom > pRect.bottom) csPortal.scrollTop += iRect.bottom - pRect.bottom;
        else if (iRect.top < pRect.top) csPortal.scrollTop -= pRect.top - iRect.top;
      }
    });
  }

  function attachCustomSelects() {
    document.querySelectorAll("select:not([data-customized])").forEach(sel => {
      sel.setAttribute("data-customized", "true");
      sel.style.display = "none";
      
      const wrap = document.createElement("div");
      wrap.className = "custom-select";
      
      const head = document.createElement("div");
      head.className = "custom-select-head";
      head.setAttribute("tabindex", "0");
      head.setAttribute("role", "combobox");
      head.setAttribute("aria-expanded", "false");
      head.setAttribute("aria-haspopup", "listbox");
      
      const valObj = document.createElement("span");
      const updateVal = () => { 
        const opt = sel.options[sel.selectedIndex]; 
        valObj.textContent = opt ? opt.textContent : ""; 
      };
      updateVal();
      sel.addEventListener("change", updateVal);
      
      const chevron = document.createElement("i");
      chevron.setAttribute("data-lucide", "chevron-down");
      chevron.style.cssText = "width:16px;height:16px;flex-shrink:0;";
      
      head.appendChild(valObj); head.appendChild(chevron);
      
      // Accesibilidad por teclado
      head.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (csActiveWrap === wrap) {
            if (csFocusedIndex >= 0 && csFocusedIndex < csOptions.length) {
              sel.value = csOptions[csFocusedIndex].value;
              sel.dispatchEvent(new Event("change"));
            }
            csClose();
          } else {
            csOpen(wrap, sel, head);
          }
        } else if (e.key === "Escape") {
          if (csActiveWrap === wrap) { e.preventDefault(); csClose(); head.focus(); }
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          if (csActiveWrap !== wrap) csOpen(wrap, sel, head);
          else { csFocusedIndex = Math.min(csOptions.length - 1, csFocusedIndex + 1); updateCsFocus(); }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (csActiveWrap !== wrap) csOpen(wrap, sel, head);
          else { csFocusedIndex = Math.max(0, csFocusedIndex - 1); updateCsFocus(); }
        } else if (e.key === "Tab") {
          if (csActiveWrap === wrap) csClose();
        }
      });
      
      const observer = new MutationObserver(() => { updateVal(); if (csActiveSel===sel) csOpen(wrap,sel,head); });
      observer.observe(sel, { childList:true });
      
      head.onmousedown = ev => { ev.preventDefault(); ev.stopPropagation(); csOpen(wrap, sel, head); head.focus(); };
      
      wrap.appendChild(head);
      sel.parentNode.insertBefore(wrap, sel.nextSibling);
    });
    lc();
  }

  document.addEventListener("mousedown", e => {
    if (csActiveWrap && !csActiveWrap.contains(e.target) && !csPortal.contains(e.target)) csClose();
  });
  
  // Cerrar portales al hacer scroll en contenedores principales o resize
  window.addEventListener("resize", csClose, { passive: true });
  document.addEventListener("scroll", e => {
    if (csActiveWrap && !csPortal.contains(e.target) && e.target !== csPortal) csClose();
  }, { capture: true, passive: true });

  /* ---------- Custom Date & Time Pickers ---------- */
  function csOpenDate(wrap, input, head) {
    if (csActiveWrap === wrap) { csClose(); return; }
    csClose();
    csActiveSel = input; csActiveWrap = wrap;
    wrap.classList.add("open");
    head.setAttribute("aria-expanded", "true");
    csPortal.innerHTML = "";
    
    let currentDate = input.value ? new Date(input.value + "T00:00:00") : new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();
    
    const renderCal = (y, m) => {
      csPortal.innerHTML = "";
      
      const header = document.createElement("div");
      header.className = "cs-cal-header";
      
      const btnPrev = document.createElement("button");
      btnPrev.type = "button";
      btnPrev.innerHTML = ic("chevron-left", 16);
      btnPrev.onclick = (e) => { e.stopPropagation(); m--; if(m<0){m=11;y--;} renderCal(y,m); lc(); };
      
      const title = document.createElement("div");
      title.className = "cs-cal-title";
      title.textContent = MONTHS[m].charAt(0).toUpperCase() + MONTHS[m].slice(1) + " " + y;
      
      const btnNext = document.createElement("button");
      btnNext.type = "button";
      btnNext.innerHTML = ic("chevron-right", 16);
      btnNext.onclick = (e) => { e.stopPropagation(); m++; if(m>11){m=0;y++;} renderCal(y,m); lc(); };
      
      header.appendChild(btnPrev); header.appendChild(title); header.appendChild(btnNext);
      csPortal.appendChild(header);
      
      const grid = document.createElement("div");
      grid.className = "cs-cal-grid";
      
      ["Do","Lu","Ma","Mi","Ju","Vi","Sa"].forEach(d => {
        const cell = document.createElement("div");
        cell.className = "cs-cal-dow";
        cell.textContent = d;
        grid.appendChild(cell);
      });
      
      const firstDay = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m+1, 0).getDate();
      
      for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement("div"));
      }
      
      const today = new Date();
      for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement("div");
        cell.className = "cs-cal-day";
        const cellDate = new Date(y, m, i);
        if (input.value === toISO(cellDate)) cell.classList.add("selected");
        if (today.toDateString() === cellDate.toDateString()) cell.classList.add("today");
        cell.textContent = i;
        cell.onclick = (e) => {
          e.stopPropagation();
          input.value = toISO(cellDate);
          input.dispatchEvent(new Event("change"));
          csClose();
        };
        grid.appendChild(cell);
      }
      
      csPortal.appendChild(grid);
    };
    
    renderCal(currentYear, currentMonth);
    
    const rect = head.getBoundingClientRect();
    const portalMaxHeight = 320;
    let top = rect.bottom + 4;
    csPortal.style.display = "flex";
    if (top + portalMaxHeight > window.innerHeight && rect.top - portalMaxHeight > 0) {
      top = rect.top - csPortal.offsetHeight - 4;
    }
    Object.assign(csPortal.style, { left: rect.left + "px", top: top + "px", width: "260px" });
    lc();
  }

  function csOpenTime(wrap, input, head) {
    if (csActiveWrap === wrap) { csClose(); return; }
    csClose();
    csActiveSel = input; csActiveWrap = wrap;
    wrap.classList.add("open");
    head.setAttribute("aria-expanded", "true");
    csPortal.innerHTML = "";
    
    const timeContainer = document.createElement("div");
    timeContainer.className = "cs-time-container";
    
    const colH = document.createElement("div"); colH.className = "cs-time-col";
    const colM = document.createElement("div"); colM.className = "cs-time-col";
    const colA = document.createElement("div"); colA.className = "cs-time-col";
    
    let currentH = "12", currentM = "00", currentA = "AM";
    if (input.value) {
      const parts = input.value.split(":");
      let h24 = parseInt(parts[0], 10);
      currentM = parts[1];
      if (h24 >= 12) {
        currentA = "PM";
        currentH = h24 > 12 ? (h24 - 12).toString().padStart(2, "0") : "12";
      } else {
        currentA = "AM";
        currentH = h24 === 0 ? "12" : h24.toString().padStart(2, "0");
      }
    }
    
    const updateInput = () => {
      let h24 = parseInt(currentH, 10);
      if (currentA === "PM" && h24 !== 12) h24 += 12;
      if (currentA === "AM" && h24 === 12) h24 = 0;
      input.value = `${h24.toString().padStart(2, "0")}:${currentM}`;
      input.dispatchEvent(new Event("change"));
    };
    
    for(let i=1; i<=12; i++) {
      const hStr = i.toString().padStart(2, "0");
      const item = document.createElement("div");
      item.className = "cs-time-item" + (currentH === hStr ? " selected" : "");
      item.textContent = hStr;
      item.onclick = (e) => {
        e.stopPropagation();
        currentH = hStr;
        updateInput();
        Array.from(colH.children).forEach(c => c.classList.remove("selected"));
        item.classList.add("selected");
      };
      colH.appendChild(item);
    }
    
    for(let i=0; i<60; i+=5) {
      const mStr = i.toString().padStart(2, "0");
      const item = document.createElement("div");
      item.className = "cs-time-item" + (currentM === mStr ? " selected" : "");
      item.textContent = mStr;
      item.onclick = (e) => {
        e.stopPropagation();
        currentM = mStr;
        updateInput();
        Array.from(colM.children).forEach(c => c.classList.remove("selected"));
        item.classList.add("selected");
      };
      colM.appendChild(item);
    }
    
    ["AM", "PM"].forEach(aStr => {
      const item = document.createElement("div");
      item.className = "cs-time-item" + (currentA === aStr ? " selected" : "");
      item.textContent = aStr;
      item.onclick = (e) => {
        e.stopPropagation();
        currentA = aStr;
        updateInput();
        Array.from(colA.children).forEach(c => c.classList.remove("selected"));
        item.classList.add("selected");
        csClose();
      };
      colA.appendChild(item);
    });
    
    timeContainer.appendChild(colH);
    timeContainer.appendChild(colM);
    timeContainer.appendChild(colA);
    csPortal.appendChild(timeContainer);
    
    const rect = head.getBoundingClientRect();
    const portalMaxHeight = 220;
    let top = rect.bottom + 4;
    csPortal.style.display = "flex";
    if (top + portalMaxHeight > window.innerHeight && rect.top - portalMaxHeight > 0) {
      top = rect.top - csPortal.offsetHeight - 4;
    }
    Object.assign(csPortal.style, { left: rect.left + "px", top: top + "px", width: Math.max(160, rect.width) + "px" });
    
    const selH = colH.querySelector(".selected");
    if(selH) colH.scrollTop = selH.offsetTop - colH.offsetHeight/2;
    const selM = colM.querySelector(".selected");
    if(selM) colM.scrollTop = selM.offsetTop - colM.offsetHeight/2;
  }

  function attachCustomPickers() {
    document.querySelectorAll("input[type='date']:not([data-customized]), input[type='time']:not([data-customized])").forEach(input => {
      input.setAttribute("data-customized", "true");
      input.style.display = "none";
      
      const isTime = input.type === "time";
      const wrap = document.createElement("div");
      wrap.className = "custom-select";
      
      const head = document.createElement("div");
      head.className = "custom-select-head";
      head.setAttribute("tabindex", "0");
      head.setAttribute("aria-expanded", "false");
      
      const valObj = document.createElement("span");
      const updateVal = () => { 
        if (!input.value) { valObj.textContent = "Seleccionar"; return; }
        if (isTime) {
          valObj.textContent = fmtTime(input.value);
        } else {
          const d = new Date(input.value + "T00:00:00");
          valObj.textContent = `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
        }
      };
      updateVal();
      input.addEventListener("change", updateVal);
      
      // Interceptar input.value = "..." por JS
      const origDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      Object.defineProperty(input, 'value', {
        get() { return origDescriptor.get.call(input); },
        set(val) { origDescriptor.set.call(input, val); updateVal(); }
      });
      
      const icon = document.createElement("i");
      icon.setAttribute("data-lucide", isTime ? "clock" : "calendar");
      icon.style.cssText = "width:16px;height:16px;flex-shrink:0;color:var(--text-muted);";
      
      head.appendChild(valObj); head.appendChild(icon);
      
      head.onmousedown = ev => { 
        ev.preventDefault(); ev.stopPropagation(); 
        if (isTime) csOpenTime(wrap, input, head); 
        else csOpenDate(wrap, input, head); 
        head.focus(); 
      };
      
      wrap.appendChild(head);
      input.parentNode.insertBefore(wrap, input.nextSibling);
    });
    lc();
  }

  /* ---------- Init ---------- */
  document.documentElement.setAttribute("data-theme", "dark");
  seed();
  checkNotifications();
  render();
  attachCustomSelects();
  attachCustomPickers();
})();
