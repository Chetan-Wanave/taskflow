(function () {
  const STORAGE_KEY = 'todo-app-items';
  let todos = load();
  let filter = 'all';
  let query = '';
  let dragId = null;

  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const due = document.getElementById('due');
  const priority = document.getElementById('priority');
  const search = document.getElementById('search');
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  const count = document.getElementById('count');
  const filters = document.getElementById('filters');
  const clearBtn = document.getElementById('clear');

  document.getElementById('today').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function formatDue(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const opts = { month: 'short', day: 'numeric' };
    if (y !== new Date().getFullYear()) opts.year = 'numeric';
    return date.toLocaleDateString(undefined, opts);
  }

  function render() {
    list.innerHTML = '';
    const q = query.trim().toLowerCase();
    const visible = todos.filter(t => {
      const byFilter = filter === 'all' ? true : filter === 'active' ? !t.done : t.done;
      const byQuery = !q || t.text.toLowerCase().includes(q);
      return byFilter && byQuery;
    });

    for (const todo of visible) {
      const li = document.createElement('li');
      li.className = 'item' + (todo.done ? ' done' : '');
      if (todo.priority && todo.priority !== 'none') li.classList.add('p-' + todo.priority);
      li.dataset.id = todo.id;
      li.draggable = true;

      const check = document.createElement('button');
      check.className = 'check';
      check.textContent = '✓';
      check.title = todo.done ? 'Mark as active' : 'Mark as done';
      check.addEventListener('click', () => {
        todo.done = !todo.done;
        save(); render();
      });

      const body = document.createElement('div');
      body.className = 'body';

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = todo.text;
      label.addEventListener('dblclick', () => startEdit(body, label, todo));
      body.appendChild(label);

      if (todo.due) {
        const chip = document.createElement('span');
        chip.className = 'due';
        chip.textContent = formatDue(todo.due);
        if (!todo.done && todo.due < todayISO()) {
          chip.classList.add('overdue');
          chip.textContent += ' · overdue';
        }
        body.appendChild(chip);
      }

      const del = document.createElement('button');
      del.className = 'delete';
      del.textContent = '×';
      del.title = 'Delete';
      del.addEventListener('click', () => {
        todos = todos.filter(t => t !== todo);
        save(); render();
      });

      li.append(check, body, del);

      li.addEventListener('dragstart', e => {
        dragId = todo.id;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      li.addEventListener('dragend', () => {
        dragId = null;
        li.classList.remove('dragging');
      });
      li.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      li.addEventListener('drop', e => {
        e.preventDefault();
        if (dragId === null || dragId === todo.id) return;
        const from = todos.findIndex(t => t.id === dragId);
        const to = todos.findIndex(t => t.id === todo.id);
        if (from === -1 || to === -1) return;
        const [moved] = todos.splice(from, 1);
        todos.splice(to, 0, moved);
        save(); render();
      });

      list.appendChild(li);
    }

    empty.hidden = visible.length > 0;
    empty.textContent = q ? 'No tasks match your search.' : 'Nothing here — add a task above.';
    const remaining = todos.filter(t => !t.done).length;
    count.textContent = remaining === 1 ? '1 task left' : remaining + ' tasks left';
  }

  function startEdit(body, label, todo) {
    const edit = document.createElement('input');
    edit.className = 'label-edit';
    edit.value = todo.text;
    body.replaceChild(edit, label);
    edit.focus();
    edit.setSelectionRange(edit.value.length, edit.value.length);

    let cancelled = false;
    function commit() {
      const text = edit.value.trim();
      if (!cancelled && text) todo.text = text;
      save(); render();
    }
    edit.addEventListener('blur', commit);
    edit.addEventListener('keydown', e => {
      if (e.key === 'Enter') edit.blur();
      if (e.key === 'Escape') { cancelled = true; edit.blur(); }
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    todos.unshift({
      id: Date.now(),
      text,
      done: false,
      priority: priority.value,
      due: due.value || null
    });
    input.value = '';
    due.value = '';
    priority.value = 'none';
    save(); render();
    input.focus();
  });

  search.addEventListener('input', () => {
    query = search.value;
    render();
  });
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      search.value = '';
      query = '';
      render();
    }
  });

  filters.addEventListener('click', e => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    for (const b of filters.querySelectorAll('button')) {
      b.classList.toggle('active', b === btn);
    }
    render();
  });

  clearBtn.addEventListener('click', () => {
    todos = todos.filter(t => !t.done);
    save(); render();
  });

  render();
})();
