/**
 * Orbit v2 — app.js
 * Plain ES module JavaScript. No build step required.
 *
 * Sections:
 *  1. DB          — SQLite via Tauri plugin
 *  2. Settings    — API key, theme, stored in DB
 *  3. Navigation  — sidebar view switching
 *  4. Tasks       — categories, tasks, tags
 *  5. Data Viewer — CSV/Excel import, table render, persistence
 *  6. Agent       — Groq chat with optional data context
 *  7. Modals      — shared modal helpers
 *  8. Init        — bootstrap everything
 */

import Database from 'https://cdn.jsdelivr.net/npm/@tauri-apps/plugin-sql@2/+esm';
import { open } from 'https://cdn.jsdelivr.net/npm/@tauri-apps/plugin-shell@2/+esm';

// ════════════════════════════════════════════════════════════════════════════
// 1. DATABASE
// ════════════════════════════════════════════════════════════════════════════

let db;

async function initDb() {
  db = await Database.load('sqlite:orbit.db');
  console.log('[DB] Connected to orbit.db');
}

async function dbRun(sql, params = []) {
  return db.execute(sql, params);
}

async function dbAll(sql, params = []) {
  return db.select(sql, params);
}

async function dbGet(sql, params = []) {
  const rows = await db.select(sql, params);
  return rows[0] ?? null;
}

// ════════════════════════════════════════════════════════════════════════════
// 2. SETTINGS
// ════════════════════════════════════════════════════════════════════════════

const Settings = {
  async get(key) {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? null;
  },
  async set(key, value) {
    await dbRun(
      'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [key, value]
    );
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 3. NAVIGATION
// ════════════════════════════════════════════════════════════════════════════

const VIEW_LABELS = {
  dashboard: 'Dashboard',
  tasks:     'Tasks',
  data:      'Data Viewer',
  agent:     'Orbit Agent',
};

let currentView = 'dashboard';

// Active panel references (updated on view switch so rendering targets the visible panel)
let activeTasksPanel = null;
let activeDataPanel  = null;
let activeAgentPanel = null;

function initNav() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  // Initialise panel refs to the dashboard panels
  activeTasksPanel = document.getElementById('tasks-panel');
  activeDataPanel  = document.getElementById('data-panel');
  activeAgentPanel = document.getElementById('agent-panel');
}

async function switchView(viewId) {
  currentView = viewId;

  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });

  document.getElementById('view-label').textContent = VIEW_LABELS[viewId] ?? viewId;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.add('active');

  // Helper: clone a dashboard panel into its solo container
  function setupSolo(sourceId, soloId) {
    const source = document.getElementById(sourceId);
    const solo   = document.getElementById(soloId);
    if (source) {
      solo.innerHTML = source.innerHTML;
      solo.className = source.className;
    }
    return solo;
  }

  if (viewId === 'dashboard') {
    activeTasksPanel = document.getElementById('tasks-panel');
    activeDataPanel  = document.getElementById('data-panel');
    activeAgentPanel = document.getElementById('agent-panel');
    await Promise.all([
      renderTasks(),
      currentFileData.rows.length
        ? renderDataTable(currentFileData, activeDataPanel.querySelector('#data-filename')?.textContent || 'Imported')
        : renderDropzone(),
    ]);
  }

  if (viewId === 'tasks') {
    activeTasksPanel = setupSolo('tasks-panel', 'tasks-panel-solo');
    await renderTasks();                     // re-render into the solo panel
    bindTaskPanelEvents(activeTasksPanel);
  }

  if (viewId === 'data') {
    activeDataPanel = setupSolo('data-panel', 'data-panel-solo');
    if (currentFileData.rows.length) {
      renderDataTable(currentFileData, document.getElementById('data-filename')?.textContent || 'Imported');
    } else {
      renderDropzone();
    }
    bindDataPanelEvents(activeDataPanel);
  }

  if (viewId === 'agent') {
    activeAgentPanel = setupSolo('agent-panel', 'agent-panel-solo');
    bindAgentPanelEvents(activeAgentPanel);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 4. TASKS
// ════════════════════════════════════════════════════════════════════════════

const CATEGORY_COLORS = [
  '#F59E0B','#10B981','#6366F1','#EF4444',
  '#EC4899','#14B8A6','#F97316','#8B5CF6',
  '#06B6D4','#84CC16',
];

let selectedCategoryColor = CATEGORY_COLORS[0];
let pendingTags = []; // tags for the new task being composed

// ── DB helpers ───────────────────────────────────────────────────────────────

async function getCategories() {
  return dbAll('SELECT * FROM categories ORDER BY name ASC');
}

async function createCategory(name, color) {
  await dbRun('INSERT INTO categories(name,color) VALUES(?,?)', [name, color]);
  const row = await dbGet('SELECT id FROM categories ORDER BY id DESC LIMIT 1');
  return row.id;
}

async function deleteCategory(id) {
  await dbRun('DELETE FROM categories WHERE id=?', [id]);
}

async function getTasks(categoryId = null) {
  if (categoryId === null) {
    return dbAll(`
      SELECT t.*, GROUP_CONCAT(tg.name, ',') as tag_names
      FROM tasks t
      LEFT JOIN task_tags tt ON tt.task_id = t.id
      LEFT JOIN tags tg       ON tg.id = tt.tag_id
      WHERE t.category_id IS NULL
      GROUP BY t.id
      ORDER BY t.is_done ASC, t.created_at DESC
    `);
  }
  return dbAll(`
    SELECT t.*, GROUP_CONCAT(tg.name, ',') as tag_names
    FROM tasks t
    LEFT JOIN task_tags tt ON tt.task_id = t.id
    LEFT JOIN tags tg       ON tg.id = tt.tag_id
    WHERE t.category_id = ?
    GROUP BY t.id
    ORDER BY t.is_done ASC, t.created_at DESC
  `, [categoryId]);
}

async function createTask(content, categoryId, priority, dueDate) {
  await dbRun(
    'INSERT INTO tasks(content,category_id,priority,due_date) VALUES(?,?,?,?)',
    [content, categoryId || null, priority, dueDate || null]
  );
  const row = await dbGet('SELECT id FROM tasks ORDER BY id DESC LIMIT 1');
  return row.id;
}

async function toggleTask(id, isDone) {
  await dbRun('UPDATE tasks SET is_done=? WHERE id=?', [isDone ? 1 : 0, id]);
}

async function deleteTask(id) {
  await dbRun('DELETE FROM tasks WHERE id=?', [id]);
}

async function ensureTag(name) {
  await dbRun('INSERT OR IGNORE INTO tags(name) VALUES(?)', [name]);
  const row = await dbGet('SELECT id FROM tags WHERE name=?', [name]);
  return row.id;
}

async function addTagToTask(taskId, tagName) {
  const tagId = await ensureTag(tagName.trim());
  await dbRun('INSERT OR IGNORE INTO task_tags(task_id,tag_id) VALUES(?,?)', [taskId, tagId]);
}

async function addTagsToTask(taskId, tagNames) {
  for (const name of tagNames) {
    if (name.trim()) await addTagToTask(taskId, name);
  }
}

// ── Render ───────────────────────────────────────────────────────────────────

function priorityDot(priority) {
  return `<span class="priority-dot priority-${priority}" title="${priority} priority"></span>`;
}

function dueDateLabel(dueDate) {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  const now = new Date();
  const overdue = d < now && d.toDateString() !== now.toDateString();
  const str = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  return `<span class="due-date-label ${overdue ? 'overdue' : ''}">${overdue ? '⚠ ' : ''}${str}</span>`;
}

function tagChips(tagNames) {
  if (!tagNames) return '';
  return tagNames.split(',').filter(Boolean).map(t =>
    `<span class="tag-chip">${t}</span>`
  ).join('');
}

function taskItemHTML(task) {
  const done = task.is_done === 1;
  return `
    <div class="task-item" data-id="${task.id}">
      <button class="task-check ${done ? 'done' : ''}" data-id="${task.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </button>
      <div class="task-body">
        <div class="task-content ${done ? 'done' : ''}">${escHtml(task.content)}</div>
        <div class="task-meta">
          ${priorityDot(task.priority)}
          ${dueDateLabel(task.due_date)}
          ${tagChips(task.tag_names)}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-icon btn-delete-task" data-id="${task.id}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>`;
}

async function renderTasks() {
  const panel      = activeTasksPanel || document.getElementById('tasks-panel');
  const body       = panel.querySelector('#tasks-body');
  const subtitle   = panel.querySelector('#tasks-subtitle');

  const categories  = await getCategories();
  const uncat       = await getTasks(null);

  let html = '';
  let totalPending = uncat.filter(t => !t.is_done).length;

  // Uncategorized tasks
  if (uncat.length > 0) {
    html += `<div class="section-heading">Uncategorized</div>`;
    html += `<div class="uncategorized-tasks">${uncat.map(taskItemHTML).join('')}</div>`;
  }

  // Category blocks
  if (categories.length > 0) {
    html += `<div class="section-heading">Categories</div>`;
  }
  for (const cat of categories) {
    const tasks = await getTasks(cat.id);
    totalPending += tasks.filter(t => !t.is_done).length;
    html += `
      <div class="category-block" data-cat-id="${cat.id}">
        <div class="category-header">
          <span class="category-color-dot" style="background:${cat.color}"></span>
          <span class="category-name">${escHtml(cat.name)}</span>
          <span class="category-count">${tasks.filter(t=>!t.is_done).length}/${tasks.length}</span>
          <div class="category-header-actions">
            <button class="btn-icon btn-delete-cat" data-id="${cat.id}" title="Delete category">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
          <svg class="category-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        <div class="category-tasks">
          ${tasks.length === 0
            ? '<div class="category-empty">No tasks yet.</div>'
            : tasks.map(taskItemHTML).join('')}
        </div>
      </div>`;
  }

  if (!html) {
    html = `<div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p>No tasks yet.<br/>Click <strong>+</strong> to add one.</p>
    </div>`;
  }

  body.innerHTML = html;
  subtitle.textContent = `${totalPending} pending`;

  bindTaskPanelEvents(panel);
}

function bindTaskPanelEvents(panel) {
  // Toggle task done
  panel.querySelectorAll('.task-check').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = parseInt(btn.dataset.id);
      const done = btn.classList.contains('done');
      await toggleTask(id, !done);
      await renderTasks();
    });
  });

  // Delete task
  panel.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteTask(parseInt(btn.dataset.id));
      await renderTasks();
    });
  });

  // Delete category
  panel.querySelectorAll('.btn-delete-cat').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      showConfirm(
        'Delete category?',
        'All tasks in this category will become uncategorized.',
        async () => { await deleteCategory(parseInt(btn.dataset.id)); await renderTasks(); }
      );
    });
  });

  // Collapse/expand category
  panel.querySelectorAll('.category-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.category-header-actions')) return;
      header.closest('.category-block').classList.toggle('collapsed');
    });
  });
}

function renderPendingTags(container) {
  container.innerHTML = pendingTags.map((t, i) =>
    `<span class="tag-chip">${escHtml(t)}<button class="remove-tag" data-i="${i}">×</button></span>`
  ).join('');
  container.querySelectorAll('.remove-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingTags.splice(parseInt(btn.dataset.i), 1);
      renderPendingTags(container);
    });
  });
}

function initTaskModal() {
  const overlay   = document.getElementById('modal-task');
  const nameInput = document.getElementById('task-name-input');
  const catSelect = document.getElementById('task-cat-select');
  const priSelect = document.getElementById('task-pri-select');
  const dueInput  = document.getElementById('task-due-input');
  const tagInput  = document.getElementById('task-tag-input');
  const tagsDisp  = document.getElementById('task-tags-display');

  // Populate categories each time modal opens
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#btn-add-task')) {
      pendingTags = [];
      tagsDisp.innerHTML = '';
      nameInput.value = '';
      dueInput.value = '';
      priSelect.value = 'medium';
      // Refresh category list
      getCategories().then(cats => {
        catSelect.innerHTML = '<option value="">No category</option>';
        cats.forEach(c => {
          catSelect.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
        });
      });
      openModal('modal-task');
      setTimeout(() => nameInput.focus(), 100);
    }
  });

  // Tag entry
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = tagInput.value.trim();
      if (val && !pendingTags.includes(val)) {
        pendingTags.push(val);
        renderPendingTags(tagsDisp);
      }
      tagInput.value = '';
    }
  });

  // Submit on Enter in name field
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-save-task').click();
    }
  });

  // Save
  document.getElementById('btn-save-task').addEventListener('click', async () => {
    const content = nameInput.value.trim();
    if (!content) { nameInput.focus(); return; }

    const taskId = await createTask(
      content,
      catSelect.value || null,
      priSelect.value,
      dueInput.value || null
    );

    if (pendingTags.length > 0) {
      await addTagsToTask(taskId, pendingTags);
      pendingTags = [];
      tagsDisp.innerHTML = '';
    }

    closeModal('modal-task');
    await renderTasks();
  });

  // New Category button -> close task modal, open category modal
  document.getElementById('btn-task-new-cat').addEventListener('click', () => {
    closeModal('modal-task');
    document.getElementById('cat-name-input').value = '';
    openModal('modal-category');
  });
}

function initCategoryModal() {
  // Render color options
  const colorOpts = document.getElementById('color-options');
  colorOpts.innerHTML = CATEGORY_COLORS.map(c =>
    `<div class="color-opt ${c === selectedCategoryColor ? 'selected' : ''}"
          style="background:${c}" data-color="${c}"></div>`
  ).join('');

  colorOpts.querySelectorAll('.color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      selectedCategoryColor = opt.dataset.color;
      colorOpts.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#btn-add-category')) {
      document.getElementById('cat-name-input').value = '';
      openModal('modal-category');
    }
  });

  document.getElementById('btn-save-category').addEventListener('click', async () => {
    const name = document.getElementById('cat-name-input').value.trim();
    if (!name) return;
    await createCategory(name, selectedCategoryColor);
    closeModal('modal-category');
    await renderTasks();
  });

  document.getElementById('cat-name-input').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') document.getElementById('btn-save-category').click();
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 5. DATA VIEWER
// ════════════════════════════════════════════════════════════════════════════

let currentFileId   = null;
let currentFileData = { columns: [], rows: [] }; // in-memory for agent context

async function initDataViewer() {
  renderDropzone();
  await loadPersistedData();

  // Listen on body for import clicks (works across dashboard / solo clones)
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-import-file');
    if (btn) document.getElementById('file-input').click();
  });

  document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await handleFileImport(file);
    e.target.value = '';
  });

  // Use event delegation for clear-data button too
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-clear-data');
    if (btn) showConfirm('Clear data?', 'This will remove the imported file and all its data.', clearImportedData);
  });

  // Drag & drop — listen on panel body
  document.body.addEventListener('dragover', (e) => {
    const dropzone = e.target.closest('#dropzone');
    if (dropzone) { e.preventDefault(); dropzone.classList.add('dragover'); }
  });
  document.body.addEventListener('dragleave', (e) => {
    const dropzone = e.target.closest('#dropzone');
    if (dropzone) dropzone.classList.remove('dragover');
  });
  document.body.addEventListener('drop', async (e) => {
    const dropzone = e.target.closest('#dropzone');
    if (!dropzone) return;
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) await handleFileImport(file);
  });
}

function bindDataPanelEvents(panel) {
  panel.querySelector('#btn-import-file')?.addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  // Re-bind search filter when panel is cloned to solo view
  const searchInput = panel.querySelector('#data-search-input');
  const clearBtn    = panel.querySelector('#data-search-clear');
  const tbody       = panel.querySelector('tbody');
  if (searchInput && tbody && currentFileData.rows.length) {
    const doFilter = () => {
      const q = searchInput.value.trim().toLowerCase();
      const d = currentFileData;
      const visible = !q
        ? d.rows
        : d.rows.filter(r => d.columns.some(c => String(r[c]??'').toLowerCase().includes(q)));
      tbody.innerHTML = visible.map(r =>
        `<tr>${d.columns.map(c => `<td title="${escHtml(String(r[c]??''))}">${escHtml(String(r[c]??''))}</td>`).join('')}</tr>`
      ).join('');
      const rc = panel.querySelector('#data-row-count');
      if (rc) rc.textContent = `${visible.length}${q ? ` of ${d.rows.length}` : ''} rows`;
      if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';
    };
    searchInput.addEventListener('input', doFilter);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        doFilter();
        searchInput.focus();
      });
    }
  }
}

function renderDropzone() {
  const panel   = activeDataPanel || document.getElementById('data-panel');
  const body    = panel.querySelector('#data-body');
  body.innerHTML = `
    <div class="dropzone" id="dropzone">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
      </svg>
      <p>Drop a CSV or Excel file here</p>
      <small>or click Import above · .csv, .xlsx, .xls supported</small>
    </div>`;
  panel.querySelector('#data-subtitle').textContent = 'No file loaded';
  panel.querySelector('#data-footer').style.display = 'none';
  panel.querySelector('#btn-clear-data').style.display = 'none';
}

async function handleFileImport(file) {
  try {
    let data;
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv')) {
      data = await parseCsv(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      data = await parseExcel(file);
    } else {
      alert('Unsupported file type. Please use .csv, .xlsx, or .xls');
      return;
    }

    if (!data || data.rows.length === 0) {
      alert('The file appears to be empty or could not be parsed.');
      return;
    }

    // Clear old data
    await clearImportedData(false);

    // Save to DB
    const res = await dbRun(
      'INSERT INTO imported_files(filename) VALUES(?)', [file.name]
    );
    // Get the new file id
    const fileRow = await dbGet('SELECT id FROM imported_files ORDER BY id DESC LIMIT 1');
    currentFileId = fileRow.id;

    // Batch insert rows
    for (let rowIdx = 0; rowIdx < data.rows.length; rowIdx++) {
      const row = data.rows[rowIdx];
      for (const col of data.columns) {
        await dbRun(
          'INSERT INTO imported_data(file_id,row_idx,col_key,value) VALUES(?,?,?,?)',
          [currentFileId, rowIdx, col, row[col] ?? '']
        );
      }
    }

    currentFileData = data;
    renderDataTable(data, file.name);
  } catch (err) {
    console.error('[DataViewer] Import error:', err);
    alert('Failed to parse file: ' + err.message);
  }
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text  = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return resolve({ columns: [], rows: [] });

        const columns = parseCsvLine(lines[0]);
        const rows    = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCsvLine(lines[i]);
          const row  = {};
          columns.forEach((col, ci) => { row[col] = vals[ci] ?? ''; });
          rows.push(row);
        }
        resolve({ columns, rows });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

function parseCsvLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb      = XLSX.read(e.target.result, { type: 'array' });
        const ws      = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!jsonData.length) return resolve({ columns: [], rows: [] });
        const columns = Object.keys(jsonData[0]);
        resolve({ columns, rows: jsonData });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
}

async function loadPersistedData() {
  const fileRow = await dbGet(
    'SELECT * FROM imported_files ORDER BY imported_at DESC LIMIT 1'
  );
  if (!fileRow) return;

  currentFileId = fileRow.id;

  const rawRows = await dbAll(
    'SELECT row_idx, col_key, value FROM imported_data WHERE file_id=? ORDER BY row_idx ASC',
    [currentFileId]
  );

  if (!rawRows.length) return;

  // Reconstruct columns and rows
  const colSet = new Set();
  const rowMap = {};
  for (const r of rawRows) {
    colSet.add(r.col_key);
    if (!rowMap[r.row_idx]) rowMap[r.row_idx] = {};
    rowMap[r.row_idx][r.col_key] = r.value;
  }

  const columns = [...colSet];
  const rows    = Object.values(rowMap);
  currentFileData = { columns, rows };
  renderDataTable(currentFileData, fileRow.filename);
}

function renderDataTable(data, filename) {
  const panel    = activeDataPanel || document.getElementById('data-panel');
  const body     = panel.querySelector('#data-body');
  const footer   = panel.querySelector('#data-footer');
  const subtitle = panel.querySelector('#data-subtitle');

  const thead = data.columns.map(c => `<th>${escHtml(c)}</th>`).join('');
  const tbodyId = 'data-tbody-' + Date.now();
  const tbodyRows = data.rows.map(row =>
    `<tr>${data.columns.map(c => `<td title="${escHtml(String(row[c]??''))}">${escHtml(String(row[c]??''))}</td>`).join('')}</tr>`
  ).join('');

  body.innerHTML = `
    <div class="data-toolbar">
      <div class="section-heading">Filter</div>
      <div class="data-search-wrap">
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input type="text" class="data-search-input" id="data-search-input" placeholder="Search\u2026">
        <button class="data-search-clear" id="data-search-clear" aria-label="Clear search">&times;</button>
      </div>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>${thead}</tr></thead>
        <tbody id="${tbodyId}">${tbodyRows}</tbody>
      </table>
    </div>`;

  const rowCountEl = panel.querySelector('#data-row-count');
  const filenameEl = panel.querySelector('#data-filename');
  const clearBtnEl = panel.querySelector('#btn-clear-data');

  subtitle.textContent = `${data.rows.length} rows \u00b7 ${data.columns.length} columns`;
  footer.style.display = 'flex';
  rowCountEl.textContent = `${data.rows.length} rows`;
  filenameEl.textContent  = filename;
  clearBtnEl.style.display = 'flex';

  // ── Search / filter ──────────────────────────────────────────────────
  const searchInput = panel.querySelector('#data-search-input');
  const clearBtn    = panel.querySelector('#data-search-clear');
  const tbodyEl     = panel.querySelector(`#${tbodyId}`);

  function applyFilter() {
    const q = searchInput.value.trim().toLowerCase();
    const visible = !q
      ? data.rows
      : data.rows.filter(row =>
          data.columns.some(c => String(row[c]??'').toLowerCase().includes(q))
        );
    tbodyEl.innerHTML = visible.map(row =>
      `<tr>${data.columns.map(c => `<td title="${escHtml(String(row[c]??''))}">${escHtml(String(row[c]??''))}</td>`).join('')}</tr>`
    ).join('');
    rowCountEl.textContent =
      `${visible.length}${q ? ` of ${data.rows.length}` : ''} rows`;
    clearBtn.style.display = q ? 'flex' : 'none';
  }

  searchInput.addEventListener('input', applyFilter);
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    applyFilter();
    searchInput.focus();
  });
}

async function clearImportedData(reRender = true) {
  if (currentFileId) {
    await dbRun('DELETE FROM imported_files WHERE id=?', [currentFileId]);
  }
  currentFileId   = null;
  currentFileData = { columns: [], rows: [] };
  if (reRender) renderDropzone();
}

// ════════════════════════════════════════════════════════════════════════════
// 6. ORBIT AGENT (GROQ CHAT)
// ════════════════════════════════════════════════════════════════════════════

const GROQ_MODEL  = 'llama-3.3-70b-versatile';
const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';

let chatHistory   = []; // { role, content }
let isStreaming   = false;

const SYSTEM_PROMPT = `You are Orbit Agent, a sharp and helpful work assistant embedded in a local productivity desktop app called Orbit.
You help users manage their tasks, review imported data, and answer work-related questions quickly and clearly.
Your task list (categories, priorities, due dates, tags, completion status) is always provided in every conversation.
When the user also provides data context (a table from their Data Viewer), use it to answer questions about that data directly.

You have access to tools that let you create, modify, and delete tasks and categories directly.
Use tools whenever the user asks you to take action — adding a task, creating a category, marking something done, deleting something, etc.
Always confirm what you did in your response ("I've added 'Buy groceries' to your tasks.").
Be concise, practical, and professional. Use bullet points or tables in your responses when it helps clarity.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Create a new task. Returns the new task ID.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Task content/title' },
          category_id: { type: ['integer', 'null'], description: 'Category ID to assign the task to (omit for no category)' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level (default: medium)' },
          due_date: { type: ['string', 'null'], description: 'Due date in YYYY-MM-DD format' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags to attach' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_category',
      description: 'Create a new task category. Returns the new category ID.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Category name' },
          color: { type: 'string', description: 'Hex color code (e.g. #F59E0B)' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'toggle_task',
      description: 'Toggle a task between done and undone. Returns new status.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'integer', description: 'ID of the task to toggle' }
        },
        required: ['task_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Permanently delete a task.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'integer', description: 'ID of the task to delete' }
        },
        required: ['task_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_category',
      description: 'Delete a category. Tasks in it become uncategorized.',
      parameters: {
        type: 'object',
        properties: {
          category_id: { type: 'integer', description: 'ID of the category to delete' }
        },
        required: ['category_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'Get the current task list with categories, priorities, due dates, tags, and completion status.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_categories',
      description: 'Get all categories with names, colors, and IDs.',
      parameters: { type: 'object', properties: {} }
    }
  }
];

const SUGGESTIONS = [
  'What are my high priority tasks?',
  'Add a task to buy groceries',
  'Summarize my imported data',
  'Help me plan my day',
];

function initAgent() {
  renderChatEmpty();

  // Clear chat via delegation (works across dashboard / solo clones)
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#btn-clear-chat')) {
      chatHistory = [];
      renderChatEmpty();
    }
  });

  bindAgentPanelEvents(document.getElementById('agent-panel'));
}

function bindAgentPanelEvents(panel) {
  const input   = panel.querySelector('#chat-input');
  const sendBtn = panel.querySelector('#btn-send-chat');

  if (!input || !sendBtn) return;

  sendBtn.addEventListener('click', () => sendMessage(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Suggestions
  panel.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.textContent.trim();
      sendMessage(input);
    });
  });
}

function renderChatEmpty() {
  const panel     = activeAgentPanel || document.getElementById('agent-panel');
  const container = panel.querySelector('#chat-messages');
  container.innerHTML = `
    <div class="chat-empty">
      <div class="chat-empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
        </svg>
      </div>
      <h3>Orbit Agent</h3>
      <p>Ask me anything about your tasks, imported data, or anything work-related.</p>
      <div class="suggestions">
        ${SUGGESTIONS.map(s => `<button class="suggestion-btn">${s}</button>`).join('')}
      </div>
    </div>`;

  // Bind suggestion clicks
  container.querySelectorAll('.suggestion-btn').forEach(btn => {
    const input = panel.querySelector('#chat-input');
    if (input) {
      btn.addEventListener('click', () => {
        input.value = btn.textContent.trim();
        sendMessage(input);
      });
    }
  });
}

async function executeToolCall(toolCall) {
  const { name, arguments: argsRaw } = toolCall.function;
  const args = JSON.parse(argsRaw);
  try {
    switch (name) {
      case 'add_task': {
        const taskId = await createTask(args.content, args.category_id || null, args.priority || 'medium', args.due_date || null);
        if (args.tags && args.tags.length > 0) {
          await addTagsToTask(taskId, args.tags);
        }
        await renderTasks();
        return `Task created (ID: ${taskId}): "${args.content}"`;
      }
      case 'create_category': {
        const id = await createCategory(args.name, args.color || '#F59E0B');
        await renderTasks();
        return `Category created (ID: ${id}): "${args.name}"`;
      }
      case 'toggle_task': {
        const task = await dbGet('SELECT content, is_done FROM tasks WHERE id=?', [args.task_id]);
        if (!task) return `Task ${args.task_id} not found.`;
        const newStatus = task.is_done ? 0 : 1;
        await toggleTask(args.task_id, newStatus);
        await renderTasks();
        return `Task "${task.content}" toggled to ${newStatus ? 'done' : 'undone'}.`;
      }
      case 'delete_task': {
        await deleteTask(args.task_id);
        await renderTasks();
        return `Task ${args.task_id} deleted.`;
      }
      case 'delete_category': {
        await deleteCategory(args.category_id);
        await renderTasks();
        return `Category ${args.category_id} deleted.`;
      }
      case 'get_tasks': {
        return await tasksToText();
      }
      case 'get_categories': {
        const cats = await getCategories();
        if (!cats.length) return 'No categories exist.';
        return cats.map(c => `- ${c.name} (ID: ${c.id}, color: ${c.color})`).join('\n');
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Error executing ${name}: ${err.message}`;
  }
}

async function sendMessage(inputEl) {
  const groqKey = await Settings.get('groq_api_key');
  if (!groqKey) {
    showChatError('No Groq API key set. Open Settings and add your key.');
    return;
  }

  const text = inputEl.value.trim();
  if (!text || isStreaming) return;

  inputEl.value = '';
  inputEl.style.height = 'auto';
  hideChatError();

  const panel     = activeAgentPanel || document.getElementById('agent-panel');
  const container = panel.querySelector('#chat-messages');
  if (container.querySelector('.chat-empty')) container.innerHTML = '';

  const useContext = panel.querySelector('#use-data-context').checked;

  // Always include task context
  const taskText = await tasksToText();
  let enriched   = `My current tasks:\n${taskText}\n\nUser question: ${text}`;

  // Optionally include imported data context
  if (useContext && currentFileData.rows.length > 0) {
    const tableText = dataToText(currentFileData);
    enriched = `My current tasks:\n${taskText}\n\nImported data:\n${tableText}\n\nUser question: ${text}`;
  }

  // Add user message to UI (show raw text, not enriched)
  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: enriched });

  // Add agent placeholder
  const agentBubble = appendMessage('agent', '');
  const bubbleText  = agentBubble.querySelector('.msg-bubble');
  bubbleText.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;

  isStreaming = true;

  try {
    // ── Phase 1: tool call loop (non-streaming, may involve multiple rounds) ──
    const msgHistory = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...chatHistory.slice(0, -1),
      { role: 'user', content: enriched },
    ];

    let finalContent = null;

    while (finalContent === null) {
      const resp = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model:  GROQ_MODEL,
          stream: false,
          max_tokens: 1024,
          messages: msgHistory,
          tools: TOOLS,
          tool_choice: 'auto',
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Groq error ${resp.status}: ${err}`);
      }

      const data    = await resp.json();
      const choice  = data.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // Push assistant message with tool calls into history
        msgHistory.push({ role: 'assistant', content: null, tool_calls: toolCalls });

        // Execute each tool call and push results
        for (const tc of toolCalls) {
          const result = await executeToolCall(tc);
          msgHistory.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          });
        }
        // Loop: the model sees tool results and may call more tools or produce final text
      } else if (choice?.content) {
        finalContent = choice.content;
      } else {
        finalContent = ''; // empty response, bail out
      }
    }

    // Display the response
    bubbleText.innerHTML = escHtml(finalContent);
    chatHistory.push({ role: 'assistant', content: finalContent });

  } catch (err) {
    bubbleText.innerHTML = `<span style="color:var(--danger);">Error: ${escHtml(err.message)}</span>`;
    chatHistory.pop(); // remove failed user msg from history
  } finally {
    isStreaming = false;
    container.scrollTop = container.scrollHeight;
  }
}

function appendMessage(role, content) {
  const panel     = activeAgentPanel || document.getElementById('agent-panel');
  const container = panel.querySelector('#chat-messages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">
      ${role === 'user'
        ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.607L5 14.5m14.8.5l-1.5 1.5M5 14.5l1.5 1.5"/></svg>'
      }
    </div>
    <div class="msg-bubble">${escHtml(content)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function dataToText(data) {
  if (!data.rows.length) return 'No data loaded.';
  const header = data.columns.join(' | ');
  const sep    = data.columns.map(() => '---').join(' | ');
  const rows   = data.rows.slice(0, 100).map(row =>
    data.columns.map(c => String(row[c] ?? '')).join(' | ')
  );
  return [header, sep, ...rows].join('\n');
}

async function tasksToText() {
  const categories = await getCategories();
  const uncat      = await getTasks(null);
  const lines      = [];

  function pushTask(t) {
    const status = t.is_done ? '[x]' : '[ ]';
    const parts  = [`  ${status} "${t.content}"`, `priority=${t.priority}`];
    if (t.due_date) parts.push(`due=${t.due_date}`);
    if (t.tag_names) parts.push(`tags=${t.tag_names}`);
    lines.push(parts.join('  '));
  }

  if (uncat.length > 0) {
    lines.push('-- Uncategorized --');
    uncat.forEach(pushTask);
  }

  for (const cat of categories) {
    const tasks = await getTasks(cat.id);
    if (tasks.length > 0) {
      lines.push(`-- ${cat.name} --`);
      tasks.forEach(pushTask);
    }
  }

  return lines.length ? lines.join('\n') : '(no tasks yet)';
}

function showChatError(msg) {
  const panel = activeAgentPanel || document.getElementById('agent-panel');
  const el    = panel.querySelector('#chat-error');
  el.style.display = 'flex';
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
    <span>${escHtml(msg)}</span>`;
  el.className = 'error-banner';
}

function hideChatError() {
  const panel = activeAgentPanel || document.getElementById('agent-panel');
  const el    = panel.querySelector('#chat-error');
  el.style.display = 'none';
}

// ════════════════════════════════════════════════════════════════════════════
// 7. SETTINGS MODAL
// ════════════════════════════════════════════════════════════════════════════

let isLightMode = false;

async function initSettings() {
  // Load saved settings
  const savedKey   = await Settings.get('groq_api_key');
  const savedTheme = await Settings.get('theme');

  if (savedTheme === 'light') {
    isLightMode = true;
    document.body.classList.add('light');
    document.getElementById('theme-toggle').classList.add('on');
  }

  if (savedKey) {
    document.getElementById('groq-key-input').value = savedKey;
  }

  // Help modal tab navigation
  {
    const helpModal  = document.getElementById('modal-help');
    const helpTabs   = helpModal.querySelectorAll('.help-tab');
    const helpPages  = helpModal.querySelectorAll('.help-page');
    const helpPrev   = document.getElementById('help-prev');
    const helpNext   = document.getElementById('help-next');
    const PAGE_ORDER = ['nav', 'tasks', 'data', 'agent'];
    let pageIdx      = 0;

    function showPage(idx) {
      pageIdx = Math.max(0, Math.min(idx, PAGE_ORDER.length - 1));
      const id = PAGE_ORDER[pageIdx];
      helpTabs.forEach(t => t.classList.toggle('active', t.dataset.page === id));
      helpPages.forEach(p => p.classList.toggle('active', p.id === `help-page-${id}`));
      helpPrev.style.visibility = pageIdx === 0 ? 'hidden' : 'visible';
      helpNext.textContent = pageIdx === PAGE_ORDER.length - 1 ? 'Got it' : 'Next \u2192';
    }

    helpTabs.forEach(tab => tab.addEventListener('click', () => showPage(PAGE_ORDER.indexOf(tab.dataset.page))));
    helpPrev.addEventListener('click', () => showPage(pageIdx - 1));
    helpNext.addEventListener('click', () => pageIdx === PAGE_ORDER.length - 1 ? closeModal('modal-help') : showPage(pageIdx + 1));

    document.getElementById('btn-help').addEventListener('click', () => {
      showPage(0);
      openModal('modal-help');
    });
  }

  document.getElementById('btn-settings').addEventListener('click', async () => {
    const key = await Settings.get('groq_api_key');
    document.getElementById('groq-key-input').value = key ?? '';
    document.getElementById('theme-toggle').classList.toggle('on', isLightMode);
    openModal('modal-settings');
  });

  // Groq docs link
  document.getElementById('groq-link').addEventListener('click', async (e) => {
    e.preventDefault();
    await open('https://console.groq.com');
  });

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    isLightMode = !isLightMode;
    document.body.classList.toggle('light', isLightMode);
    document.getElementById('theme-toggle').classList.toggle('on', isLightMode);
  });

  // Save settings
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const key = document.getElementById('groq-key-input').value.trim();
    await Settings.set('groq_api_key', key);
    await Settings.set('theme', isLightMode ? 'light' : 'dark');
    closeModal('modal-settings');
  });

  // Reset all data
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    showConfirm(
      'Clear all data?',
      'This will permanently delete all tasks, categories, and imported data. This cannot be undone.',
      async () => {
        await dbRun('DELETE FROM task_tags');
        await dbRun('DELETE FROM tasks');
        await dbRun('DELETE FROM tags');
        await dbRun('DELETE FROM categories');
        await dbRun('DELETE FROM imported_data');
        await dbRun('DELETE FROM imported_files');
        currentFileId   = null;
        currentFileData = { columns: [], rows: [] };
        chatHistory     = [];
        renderDropzone();
        renderChatEmpty();
        await renderTasks();
        closeModal('modal-settings');
      }
    );
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 8. MODALS
// ════════════════════════════════════════════════════════════════════════════

function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Expose globally for inline onclick handlers in HTML
window.openModal  = openModal;
window.closeModal = closeModal;

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onConfirm;
  openModal('modal-confirm');
}

document.getElementById('btn-confirm-ok').addEventListener('click', async () => {
  if (confirmCallback) await confirmCallback();
  confirmCallback = null;
  closeModal('modal-confirm');
});

document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
  confirmCallback = null;
  closeModal('modal-confirm');
});

// ════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════════════════

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function setDateDisplay() {
  document.getElementById('date-display').textContent =
    new Date().toLocaleDateString('en', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

// ════════════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════════════

async function init() {
  try {
    await initDb();
    setDateDisplay();
    initNav();
    initCategoryModal();
    initTaskModal();
    await initSettings();
    await renderTasks();
    await initDataViewer();
    initAgent();
    // Global keyboard shortcuts
    const VIEW_KEYS = { '1': 'dashboard', '2': 'tasks', '3': 'data', '4': 'agent' };
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input,textarea,select')) return;
      if (e.key === '?') { e.preventDefault(); openModal('modal-help'); return; }
      const view = VIEW_KEYS[e.key];
      if (view) { e.preventDefault(); switchView(view); }
    });
    console.log('[Orbit] Ready.');
  } catch (err) {
    console.error('[Orbit] Init error:', err);
  }
}

init();
