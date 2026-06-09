const START_URL = 'http://localhost:3000/api/workflows/start';

const $input = document.getElementById('input');
const $start = document.getElementById('start');
const $copy = document.getElementById('copyId');
const $approve = document.getElementById('approve');
const $status = document.getElementById('status');

let currentId = null;
let pollHandle = null;

async function startWorkflow() {
  setStatus('starting...');
  $start.disabled = true;
  try {
    const res = await fetch(START_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: $input.value || '' }) });
    const j = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(j));
    currentId = j.id;
    $copy.disabled = false;
    $approve.disabled = false;
    pollWorkflow(currentId);
  } catch (err) {
    setStatus('error: ' + (err.message || err));
  } finally {
    $start.disabled = false;
  }
}

async function pollWorkflow(id) {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = setInterval(async () => {
    try {
      const r = await fetch(`http://localhost:3000/api/workflows/${id}`);
      const j = await r.json();
      renderWorkflow(j);
      if (j.status === 'complete' || j.status === 'approved') {
        clearInterval(pollHandle);
        pollHandle = null;
      }
    } catch (err) {
      setStatus('poll error');
    }
  }, 800);
}

async function approveWorkflow() {
  if (!currentId) return;
  setStatus('approving...');
  try {
    const r = await fetch(`http://localhost:3000/api/workflows/${currentId}/approve`, { method: 'POST' });
    const j = await r.json();
    renderWorkflow(j);
  } catch (err) {
    setStatus('approve error');
  }
}

function renderWorkflow(wf) {
  if (!wf) return setStatus('no workflow');
  const el = document.createElement('div');
  el.innerHTML = '';
  const header = document.createElement('div');
  header.innerHTML = `<strong>id:</strong> ${wf.id} <br/><strong>status:</strong> ${wf.status}`;
  el.appendChild(header);
  if (Array.isArray(wf.tasks)) {
    wf.tasks.forEach(t => {
      const d = document.createElement('div');
      d.className = 'task';
      d.innerHTML = `<strong>${t.agent}</strong> — ${t.status}<pre>${JSON.stringify(t.result||{},null,2)}</pre>`;
      el.appendChild(d);
    });
  }
  $status.innerHTML = '';
  $status.appendChild(el);
}

function setStatus(s) {
  $status.textContent = s;
}

$start.addEventListener('click', startWorkflow);
$copy.addEventListener('click', () => { if (currentId) navigator.clipboard.writeText(currentId).catch(()=>{}); });
$approve.addEventListener('click', approveWorkflow);

// Auto-fill from page selection via background message (optional)
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) return;
  chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, func: () => window.getSelection().toString() }, (res) => {
    try {
      const sel = res?.[0]?.result;
      if (sel) $input.value = sel;
    } catch {}
  });
});
