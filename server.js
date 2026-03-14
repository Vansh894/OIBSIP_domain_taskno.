/**
 * Daily To-Do App — Node.js v22 compatible
 * Zero external dependencies. Uses only built-in Node.js modules.
 * Run: node server.js
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT      = 3000;
const DATA_FILE = path.join(__dirname, 'tasks.json');

// ── helpers ────────────────────────────────────────────────────────────────

function loadTasks() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('⚠️  Could not read tasks.json — starting fresh.', e.message);
  }
  return [];
}

function saveTasks(tasks) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (e) {
    console.error('⚠️  Could not save tasks.json:', e.message);
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end',  () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type'  : 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ── route handler ──────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  const url    = req.url;
  const method = req.method;

  // ── serve the HTML page ────────────────────────────────────────────────
  if (method === 'GET' && (url === '/' || url === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // ── GET  /tasks  → return all ─────────────────────────────────────────
  if (method === 'GET' && url === '/tasks') {
    send(res, 200, loadTasks());
    return;
  }

  // ── POST /tasks  → create ─────────────────────────────────────────────
  if (method === 'POST' && url === '/tasks') {
    const body = await readBody(req);
    const text = (body.text || '').trim();
    if (!text) { send(res, 400, { error: 'Task text is required.' }); return; }

    const tasks = loadTasks();
    const task  = {
      id         : uid(),
      text,
      completed  : false,
      addedAt    : new Date().toISOString(),
      completedAt: null,
    };
    tasks.unshift(task);
    saveTasks(tasks);
    send(res, 201, task);
    return;
  }

  // ── PATCH /tasks/:id  → update text or toggle complete ────────────────
  if (method === 'PATCH' && url.startsWith('/tasks/')) {
    const id    = url.slice('/tasks/'.length);
    const body  = await readBody(req);
    const tasks = loadTasks();
    const idx   = tasks.findIndex(t => t.id === id);

    if (idx === -1) { send(res, 404, { error: 'Task not found.' }); return; }

    const task = tasks[idx];

    if (typeof body.text === 'string') {
      const text = body.text.trim();
      if (!text) { send(res, 400, { error: 'Task text cannot be empty.' }); return; }
      task.text = text;
    }

    if (typeof body.completed === 'boolean') {
      task.completed   = body.completed;
      task.completedAt = body.completed ? new Date().toISOString() : null;
    }

    tasks[idx] = task;
    saveTasks(tasks);
    send(res, 200, task);
    return;
  }

  // ── DELETE /tasks/:id ─────────────────────────────────────────────────
  if (method === 'DELETE' && url.startsWith('/tasks/')) {
    const id    = url.slice('/tasks/'.length);
    let tasks   = loadTasks();
    const before = tasks.length;
    tasks = tasks.filter(t => t.id !== id);
    if (tasks.length === before) { send(res, 404, { error: 'Task not found.' }); return; }
    saveTasks(tasks);
    send(res, 200, { ok: true });
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────
  send(res, 404, { error: 'Not found.' });
}

// ── start server ───────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    console.error('❌ Server error:', err.message);
    send(res, 500, { error: 'Internal server error.' });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✅  To-Do App is running!');
  console.log('');
  console.log(`  👉  Open your browser and go to:  http://localhost:${PORT}`);
  console.log('');
  console.log('  Press Ctrl + C to stop the server.');
  console.log('');
});
