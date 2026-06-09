let START_URL = 'http://localhost:3000/api/workflows/start';

const $input = document.getElementById('input');
const $start = document.getElementById('start');
const $copy = document.getElementById('copyId');
const $approve = document.getElementById('approve');
const $progressTimeline = document.getElementById('progressTimeline');
const $inputSection = document.getElementById('inputSection');
const $progressSection = document.getElementById('progressSection');
const $resultsSection = document.getElementById('resultsSection');
const $resultDetails = document.getElementById('resultDetails');

let currentId = null;
let pollHandle = null;

async function startWorkflow() {
  $start.disabled = true;
  const input = $input.value || '';
  if (!input.trim()) {
    alert('Please provide job details or description');
    $start.disabled = false;
    return;
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const origin = (tabs && tabs[0] && tabs[0].url) ? new URL(tabs[0].url).origin : 'http://localhost:3000';
    START_URL = origin + '/api/workflows/start';
    
    const res = await fetch(START_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });
    const j = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(j));
    
    currentId = j.id;
    $copy.disabled = false;
    $approve.disabled = false;
    $inputSection.style.display = 'none';
    $progressSection.style.display = 'block';
    
    pollWorkflow(currentId);
  } catch (err) {
    alert('Error: ' + (err.message || err));
  } finally {
    $start.disabled = false;
  }
}

async function pollWorkflow(id) {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = setInterval(async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const origin = (tabs && tabs[0] && tabs[0].url) ? new URL(tabs[0].url).origin : 'http://localhost:3000';
      const r = await fetch(`${origin}/api/workflows/${id}`);
      const j = await r.json();
      renderProgress(j);
      if (j.status === 'complete' || j.status === 'approved') {
        clearInterval(pollHandle);
        pollHandle = null;
        renderResults(j);
      }
    } catch (err) {
      console.error('poll error', err);
    }
  }, 500);
}

async function approveWorkflow() {
  if (!currentId) return;
  $approve.disabled = true;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const origin = (tabs && tabs[0] && tabs[0].url) ? new URL(tabs[0].url).origin : 'http://localhost:3000';
    const r = await fetch(`${origin}/api/workflows/${currentId}/approve`, { method: 'POST' });
    const j = await r.json();
    renderProgress(j);
    alert('Workflow approved!');
  } catch (err) {
    alert('Approve error: ' + err.message);
  } finally {
    $approve.disabled = false;
  }
}

function renderProgress(wf) {
  if (!wf || !Array.isArray(wf.tasks)) return;
  
  $progressTimeline.innerHTML = '';
  wf.tasks.forEach((task) => {
    const item = document.createElement('div');
    item.className = `timeline-item ${task.status}`;
    
    let statusText = '';
    if (task.status === 'pending') statusText = 'Pending';
    else if (task.status === 'running') statusText = 'Working...';
    else if (task.status === 'done') statusText = '✓ Done';
    else if (task.status === 'error') statusText = '✗ Error';
    
    item.innerHTML = `
      <div class="timeline-icon">${task.icon || '•'}</div>
      <div class="timeline-content">
        <div class="timeline-title">${task.agent}</div>
        <div class="timeline-desc">${task.description || ''}</div>
        <div class="timeline-status">${statusText}</div>
      </div>
    `;
    $progressTimeline.appendChild(item);
  });
}

function renderResults(wf) {
  $resultsSection.style.display = 'block';
  $resultDetails.innerHTML = '';
  
  wf.tasks.forEach((task) => {
    if (task.status === 'done' && task.result) {
      const item = document.createElement('div');
      item.className = 'result-item';
      
      let resultText = '';
      if (task.agent === 'resume-writer' && task.result.text) {
        resultText = task.result.text;
      } else if (task.agent === 'role-matcher' && Array.isArray(task.result.matches)) {
        resultText = task.result.matches.join(', ');
      } else if (task.agent === 'social-composer' && task.result.post) {
        resultText = task.result.post;
      } else {
        resultText = JSON.stringify(task.result).substring(0, 100);
      }
      
      item.innerHTML = `
        <div class="result-title">${task.icon} ${task.agent}</div>
        <div style="font-size: 11px; margin-top: 4px; color: #475569">${resultText}</div>
      `;
      $resultDetails.appendChild(item);
    }
  });
}

$start.addEventListener('click', startWorkflow);
$copy.addEventListener('click', () => { if (currentId) navigator.clipboard.writeText(currentId).catch(()=>{}); });
$approve.addEventListener('click', approveWorkflow);

// Auto-extract page content when popup opens
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) return;
  chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => {
      // Extract main content (job description, article, etc.)
      let content = '';
      
      // Try common job posting elements
      const selectors = [
        '[data-testid="job-details"]',
        '.job-description',
        '[data-job-description]',
        'article',
        'main',
        '.content',
        '#content'
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          content = el.innerText || el.textContent;
          if (content && content.length > 50) break;
        }
      }
      
      // Fallback: get selected text or first paragraph
      if (!content || content.length < 50) {
        const sel = window.getSelection().toString();
        if (sel && sel.length > 20) {
          content = sel;
        } else {
          const p = document.querySelector('p, article, main');
          content = p ? (p.innerText || p.textContent) : '';
        }
      }
      
      return content.substring(0, 500);
    }
  }, (results) => {
    try {
      const content = results?.[0]?.result;
      if (content && content.length > 20) {
        $input.value = content;
        $input.placeholder = 'Job description detected! Click "Start Workflow" to analyze.';
      }
    } catch (e) {
      console.log('Could not auto-extract content');
    }
  });
});
