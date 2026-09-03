const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let type = 'Aadhaar Card';
let file = null;
let currentRisk = null;
let currentVerification = null;
let records = JSON.parse(localStorage.getItem('idshield') || '[]');
let logs = JSON.parse(localStorage.getItem('idlogs') || '[]');

function toast(message) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = message;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

function log(message) {
  logs.unshift(new Date().toLocaleString() + ' — ' + message);
  localStorage.setItem('idlogs', JSON.stringify(logs));
  renderLogs();
}

function nav(page) {
  $$('.page').forEach(x => x.classList.remove('active'));
  const target = $('#' + page);
  if (target) target.classList.add('active');
  $$('nav button').forEach(x => x.classList.toggle('active', x.dataset.page === page));
  $('#sidebar')?.classList.remove('open');
  if (page === 'dashboard') renderDash();
  if (page === 'verifications') renderHistory();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-page]');
  if (b) nav(b.dataset.page);
});

$('#menu')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('open'));
$('#logout')?.addEventListener('click', () => { log('Logout'); toast('Signed out of demo session'); });
$('#bell')?.addEventListener('click', () => toast('6 notifications'));

const types = ['Aadhaar Card','PAN Card','Passport','Driving Licence','Voter ID','Government ID','Other Document'];

function makeTypes(id) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = types.map(x => `
    <button type="button" class="type ${x === type ? 'selected' : ''}" data-type="${x}">
      ▣<small>${x}</small>
    </button>`).join('');
  el.onclick = e => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    type = b.dataset.type;
    makeTypes('#types');
    makeTypes('#mainTypes');
    updateButtons();
  };
}
makeTypes('#types');
makeTypes('#mainTypes');

function valid(f) {
  if (!f) return 'Please select an image/document first.';
  if (f.size > 10 * 1024 * 1024) return 'Maximum file size is 10MB.';
  const okType = ['image/jpeg','image/png','application/pdf'].includes(f.type);
  const okExt = /\.(jpg|jpeg|png|pdf)$/i.test(f.name);
  if (!okType && !okExt) return 'Only JPG, JPEG, PNG and PDF files are supported.';
  return '';
}

function updateButtons() {
  const ready = !!file;
  if ($('#nextUpload')) $('#nextUpload').disabled = !ready;
  if ($('#dashboardSubmit')) $('#dashboardSubmit').disabled = !ready;
}

function showFileInfo() {
  if (!file) return;
  const html = `<div class="fileinfo">✓ ${file.name} · ${(file.size / 1048576).toFixed(2)} MB</div>`;
  if ($('#info')) $('#info').innerHTML = html;
  if ($('#mainInfo')) $('#mainInfo').innerHTML = html;
}

function showPreview() {
  const preview = $('#preview');
  if (!preview || !file) return;
  const url = URL.createObjectURL(file);
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    preview.innerHTML = `<iframe title="Document preview" src="${url}"></iframe>`;
  } else {
    preview.innerHTML = `<img src="${url}" alt="Uploaded document preview">`;
  }
}

function setFile(selectedFile) {
  const error = valid(selectedFile);
  if (error) {
    toast(error);
    return false;
  }
  file = selectedFile;
  showFileInfo();
  showPreview();
  updateButtons();
  log('Uploaded ' + file.name);
  toast('Document uploaded successfully');
  return true;
}

// File pickers: inputs are hidden and opened only by the Browse buttons.
$('#browse')?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  $('#file')?.click();
});

$('#mainBrowse')?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  $('#mainFile')?.click();
});

$('#file')?.addEventListener('change', e => {
  if (e.target.files?.[0]) setFile(e.target.files[0]);
});

$('#mainFile')?.addEventListener('change', e => {
  if (e.target.files?.[0]) setFile(e.target.files[0]);
});

function setupDrop(id) {
  const zone = $(id);
  if (!zone) return;
  ['dragenter','dragover'].forEach(name => zone.addEventListener(name, e => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add('drag-active');
  }));
  ['dragleave','drop'].forEach(name => zone.addEventListener(name, e => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('drag-active');
  }));
  zone.addEventListener('drop', e => {
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) setFile(dropped);
  });
}
setupDrop('#drop');
setupDrop('#mainDrop');

function clearFile() {
  file = null;
  currentRisk = null;
  currentVerification = null;
  if ($('#preview')) $('#preview').textContent = 'No document selected';
  if ($('#info')) $('#info').innerHTML = '';
  if ($('#mainInfo')) $('#mainInfo').innerHTML = '';
  if ($('#file')) $('#file').value = '';
  if ($('#mainFile')) $('#mainFile').value = '';
  updateButtons();
  goStep(1);
  toast('Document removed');
}

$('#remove')?.addEventListener('click', clearFile);
$('#replace')?.addEventListener('click', () => $('#mainFile')?.click());

function goStep(n) {
  $$('.wizard-panel').forEach(p => p.classList.toggle('active', Number(p.dataset.panel) === n));
  $$('#wizardSteps > *').forEach((x, i) => {
    x.classList.toggle('active', i < n);
    x.classList.toggle('current', i === n - 1);
  });
}

function fillInformation() {
  if (!file) return;
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  const name = /rahul/i.test(base) ? 'Rahul Kumar' : 'Applicant Name (OCR)';
  $('#extractedInfo').innerHTML = `
    <div><small>Full Name</small><b>${name}</b></div>
    <div><small>Document Number</small><b>Detected by OCR</b></div>
    <div><small>Date of Birth</small><b>Detected by OCR</b></div>
    <div><small>Address</small><b>Detected by OCR</b></div>
    <div><small>OCR Confidence</small><b>96%</b></div>
    <div><small>Name Match</small><b>✓ Match (demo)</b></div>`;
}

function runAnalysis() {
  if (!file) return;
  const suspicious = /fake|tamper|edited/i.test(file.name);
  currentRisk = suspicious ? 82 : 18;
  const status = suspicious ? 'Warning' : 'Passed';
  $('#analysisList').innerHTML = `
    <div>Document structure <b>${status}</b></div>
    <div>OCR quality <b>96% Passed</b></div>
    <div>Tampering detection <b>${suspicious ? 'Potential manipulation' : 'No major indicators'}</b></div>
    <div>Information consistency <b>${suspicious ? 'Review' : 'Passed'}</b></div>
    <div>Photo analysis <b>Passed</b></div>`;
}

function showResult() {
  if (currentRisk === null) runAnalysis();
  const level = currentRisk <= 30 ? 'Low Risk' : currentRisk <= 60 ? 'Medium Risk' : 'High Risk';
  $('#resultCard').innerHTML = `
    <div class="risk-circle">${currentRisk}</div>
    <div><h3>${level}</h3>
    <p>Risk Score: <b>${currentRisk}/100</b></p>
    <p>Recommendation: ${currentRisk > 60 ? 'Manual Verification Required' : 'Proceed to authorized verification'}</p></div>`;
}

function createVerification() {
  if (!file || currentRisk === null) return false;
  const level = currentRisk <= 30 ? 'Low Risk' : currentRisk <= 60 ? 'Medium Risk' : 'High Risk';
  const id = 'VER-' + Date.now().toString().slice(-8);
  currentVerification = {
    id, type, name: 'Applicant Name (OCR)', risk: currentRisk, level,
    date: new Date().toLocaleString(), file: file.name,
    findings: currentRisk > 60
      ? ['Possible text-region alteration detected','Document structure anomaly','Information consistency warning']
      : ['No significant manipulation indicators detected','OCR confidence high','Information fields internally consistent'],
    status: 'Ready for submission'
  };
  $('#finalSummary').innerHTML = `
    <b>Verification ID:</b> ${id}<br>
    <b>Document:</b> ${type}<br>
    <b>File:</b> ${file.name}<br>
    <b>Risk:</b> ${currentRisk}/100 — ${level}<br>
    <b>Status:</b> Ready for final submission`;
  return true;
}

// EXACT wizard flow: Upload -> Information -> Analysis -> Result -> Submit
$('#nextUpload')?.addEventListener('click', () => {
  if (!file) return toast('Please upload an image/document first.');
  fillInformation();
  goStep(2);
});

$('#nextInformation')?.addEventListener('click', () => {
  if (!file) return toast('Please upload a document first.');
  runAnalysis();
  goStep(3);
});

$('#nextAnalysis')?.addEventListener('click', () => {
  if (currentRisk === null) runAnalysis();
  showResult();
  goStep(4);
});

$('#nextResult')?.addEventListener('click', () => {
  if (!createVerification()) return toast('Complete the verification first.');
  goStep(5);
});

$$('[data-back]').forEach(b => b.addEventListener('click', () => goStep(Number(b.dataset.back))));

$('#submitFinal')?.addEventListener('click', () => {
  if (!currentVerification) return toast('Complete all steps first.');
  currentVerification.status = 'Submitted';
  records.unshift(currentVerification);
  localStorage.setItem('idshield', JSON.stringify(records));
  renderReport(currentVerification);
  renderDash();
  renderHistory();
  log('Submitted verification ' + currentVerification.id);
  toast('Verification submitted successfully');
  nav('reports');
  goStep(1);
});

// Dashboard submit now starts the same wizard at Upload, never skips the upload stage.
$('#dashboardSubmit')?.addEventListener('click', () => {
  if (!file) return toast('Please upload an image/document first.');
  nav('verification');
  goStep(1);
  toast('Document ready. Click Next: Information.');
});

function renderDash() {
  const l = records.filter(r => r.risk <= 30).length;
  const m = records.filter(r => r.risk > 30 && r.risk <= 60).length;
  const h = records.filter(r => r.risk > 60).length;
  if ($('#total')) $('#total').textContent = records.length;
  if ($('#low')) $('#low').textContent = l;
  if ($('#med')) $('#med').textContent = m;
  if ($('#high')) $('#high').textContent = h;
  if ($('#recent')) $('#recent').innerHTML = records.slice(0,6).map(r => `
    <tr><td>${r.id}</td><td>${r.type}</td><td>${r.name}</td><td>${r.risk}/100</td><td>${r.level}</td><td>${r.date}</td></tr>`).join('') || '<tr><td colspan="6">No verifications yet.</td></tr>';
}

function renderHistory() {
  if (!$('#history')) return;
  const q = ($('#search')?.value || '').toLowerCase();
  const f = $('#filter')?.value || '';
  const a = records.filter(r => (!q || `${r.id} ${r.name} ${r.type}`.toLowerCase().includes(q)) && (!f || r.level === f));
  $('#history').innerHTML = a.map(r => `
    <tr><td>${r.id}</td><td>${r.type}</td><td>${r.name}</td><td>${r.risk}/100</td><td>${r.level}</td><td>${r.date}</td></tr>`).join('') || '<tr><td colspan="6">No matching records.</td></tr>';
}

$('#search')?.addEventListener('input', renderHistory);
$('#filter')?.addEventListener('change', renderHistory);

function renderReport(r) {
  if (!$('#report')) return;
  $('#report').innerHTML = `
    <div class="head"><h2>Verification Report · ${r.id}</h2><b>${r.risk}/100 — ${r.level}</b></div>
    <hr><p><b>Document:</b> ${r.type}</p><p><b>Extracted Name:</b> ${r.name}</p>
    <p><b>Uploaded File:</b> ${r.file}</p><p><b>Date:</b> ${r.date}</p>
    <h3>Analysis Findings</h3><ul>${r.findings.map(x => `<li>${x}</li>`).join('')}</ul>
    <p><b>Recommendation:</b> ${r.risk > 60 ? 'Manual Verification Required' : 'Proceed to authorized verification'}</p>
    <small>This is AI-assisted preliminary screening. Final verification remains with an authorized human officer.</small>`;
}

$('#print')?.addEventListener('click', () => window.print());

function renderLogs() {
  if ($('#audits')) $('#audits').innerHTML = logs.map(x => `<p>${x}</p>`).join('') || '<div class="empty">No audit activity.</div>';
}

renderDash();
renderHistory();
renderLogs();
updateButtons();
goStep(1);
