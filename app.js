(() => {
  const STORAGE_KEY = 'et_events';

  // ── State ──────────────────────────────────────────────
  let events = load();
  let filter = 'all';

  // ── DOM refs ───────────────────────────────────────────
  const form        = document.getElementById('eventForm');
  const titleInput  = document.getElementById('title');
  const dateInput   = document.getElementById('date');
  const timeInput   = document.getElementById('time');
  const descInput   = document.getElementById('description');
  const list        = document.getElementById('eventList');
  const empty       = document.getElementById('emptyState');
  const totalEl     = document.getElementById('totalCount');
  const pendingEl   = document.getElementById('pendingCount');
  const completedEl = document.getElementById('completedCount');
  const filterBtns  = document.querySelectorAll('.filter-btn');
  const toast       = document.getElementById('toast');

  // ── Init ───────────────────────────────────────────────
  dateInput.value = todayStr();
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  render();

  // ── Form submit ────────────────────────────────────────
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;

    const event = {
      id: crypto.randomUUID(),
      title: titleInput.value.trim(),
      date: dateInput.value,
      time: timeInput.value,
      description: descInput.value.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    events.unshift(event);
    save();
    render();
    form.reset();
    dateInput.value = todayStr();
    showToast('Event added');
  });

  // ── Filter buttons ─────────────────────────────────────
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  // ── Render ─────────────────────────────────────────────
  function render() {
    const filtered = events.filter(ev => {
      if (filter === 'pending')   return !ev.completed;
      if (filter === 'completed') return ev.completed;
      return true;
    });

    // Sort: incomplete first, then by date+time, completed at bottom
    filtered.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const da = new Date(`${a.date}T${a.time || '00:00'}`);
      const db = new Date(`${b.date}T${b.time || '00:00'}`);
      return da - db;
    });

    list.innerHTML = '';

    if (filtered.length === 0) {
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      filtered.forEach(ev => list.appendChild(buildCard(ev)));
    }

    // Stats always use all events
    const total     = events.length;
    const completed = events.filter(e => e.completed).length;
    const pending   = total - completed;
    totalEl.textContent     = total;
    pendingEl.textContent   = pending;
    completedEl.textContent = completed;
  }

  // ── Build event card ───────────────────────────────────
  function buildCard(ev) {
    const card = document.createElement('div');
    card.className = `event-card${ev.completed ? ' completed' : ''}`;
    card.dataset.id = ev.id;

    const dateLabel = formatDate(ev.date);
    const timeLabel = ev.time ? formatTime(ev.time) : '';
    const dayStatus = getDayStatus(ev.date);

    card.innerHTML = `
      <div class="event-body">
        <div class="event-header">
          <span class="event-title">${esc(ev.title)}</span>
          <div class="event-actions">
            ${ev.completed ? '<span class="badge-done">DONE</span>' : ''}
            <button class="btn-icon complete" title="${ev.completed ? 'Mark pending' : 'Mark complete'}" data-action="toggle">
              ${ev.completed ? '&#8635;' : '&#10003;'}
            </button>
            <button class="btn-icon delete" title="Delete event" data-action="delete">&#128465;</button>
          </div>
        </div>
        <div class="event-meta">
          <span class="meta-chip${dayStatus === 'today' ? ' today' : dayStatus === 'past' ? ' past' : ''}">
            &#128197; ${esc(dateLabel)}
          </span>
          ${timeLabel ? `<span class="meta-chip">&#128336; ${esc(timeLabel)}</span>` : ''}
        </div>
        ${ev.description ? `<p class="event-desc">${esc(ev.description)}</p>` : ''}
      </div>
    `;

    card.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleComplete(ev.id));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteEvent(ev.id));

    return card;
  }

  // ── Actions ────────────────────────────────────────────
  function toggleComplete(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    ev.completed = !ev.completed;
    save();
    render();
    showToast(ev.completed ? 'Marked as done' : 'Marked as pending');
  }

  function deleteEvent(id) {
    events = events.filter(e => e.id !== id);
    save();
    render();
    showToast('Event deleted');
  }

  // ── Validation ─────────────────────────────────────────
  function validate() {
    let ok = true;

    [titleInput, dateInput].forEach(el => el.classList.remove('invalid'));

    if (!titleInput.value.trim()) {
      titleInput.classList.add('invalid');
      titleInput.focus();
      ok = false;
    }
    if (!dateInput.value) {
      dateInput.classList.add('invalid');
      if (ok) dateInput.focus();
      ok = false;
    }

    return ok;
  }

  // ── Persistence ────────────────────────────────────────
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  // ── Helpers ────────────────────────────────────────────
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getDayStatus(dateStr) {
    const today = todayStr();
    if (dateStr === today) return 'today';
    if (dateStr < today)  return 'past';
    return 'future';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diff = Math.round((dt - today) / 86400000);
    if (diff === 0)  return 'Today';
    if (diff === 1)  return 'Tomorrow';
    if (diff === -1) return 'Yesterday';

    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: dt.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 250);
    }, 2200);
  }
})();
