/* ScanID – shared logic.
   DEMO NOTE: all data is saved in this browser only (localStorage).
   A real backend/database is needed for use on several devices. */

var KEY_USERS = 'scanid_users', KEY_LOGS = 'scanid_logs', KEY_SESSION = 'scanid_session', KEY_RESULT = 'scanid_result';
var TOKEN_TTL = 5 * 60 * 1000; // a QR code stays valid for 5 minutes
var FIELDS = ['Software Engineering', 'Networks & Security', 'Accounting', 'Marketing', 'Nursing', 'Civil Engineering'];
var LEVELS = ['Level 1', 'Level 2', 'Level 3', 'HND 1', 'HND 2'];
var YEARS = ['2024/2025', '2025/2026', '2026/2027'];
var DEPARTMENTS = ['Student Affairs', 'Registry', 'Security', 'Administration', 'Academics'];
var TITLES = ['Verification Officer', 'Supervisor'];

/* ---------- helpers ---------- */
function read(key, fallback) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
function go(page) { window.location.href = page; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function initials(name) { return String(name).trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase(); }
function showMsg(id, text, type) { var el = document.getElementById(id); if (!el) return; el.textContent = text; el.className = 'msg ' + (type || 'error'); }
function fmtTime(iso) { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function isToday(iso) { return new Date(iso).toDateString() === new Date().toDateString(); }

/* ---------- users ---------- */
function getUsers() {
  var users = read(KEY_USERS, null);
  if (!users) {
    users = [
      { role: 'admin', fullname: 'System Admin', id: 'ADM001', email: 'adminschool@gmail.com', password: 'admin123', status: 'active' },
      { role: 'staff', fullname: 'Jean Takam', id: 'STF001', email: 'staff@school.edu', password: 'staff123', department: 'Student Affairs', title: 'Verification Officer', status: 'active' },
      { role: 'staff', fullname: 'Alice Nkeng', id: 'STF002', email: 'alice@school.edu', password: 'staff123', department: 'Registry', title: 'Supervisor', status: 'active' },
      { role: 'student', fullname: 'Mary Achu', id: 'ST2025-0142', email: 'mary@school.edu', password: 'student123', field: 'Software Engineering', level: 'HND 1', group: 'Day', year: '2025/2026', status: 'active' },
      { role: 'student', fullname: 'Paul Essomba', id: 'ST2025-0188', email: 'paul@school.edu', password: 'student123', field: 'Accounting', level: 'Level 2', group: 'Night', year: '2025/2026', status: 'active' },
      // two waiting requests so the Approvals page is not empty
      { role: 'student', fullname: 'Samuel Tabi', id: 'ST2025-0210', email: 'samuel@school.edu', password: 'student123', field: 'Networks & Security', level: 'Level 1', group: 'Day', year: '2025/2026', status: 'pending', created: new Date().toISOString() },
      { role: 'staff', fullname: 'Marc Fotso', id: 'STF003', email: 'marc@school.edu', password: 'staff123', department: 'Security', title: 'Verification Officer', status: 'pending', created: new Date().toISOString() }
    ];
    saveUsers(users);
  }
  var fixed = false;
  users.forEach(function (u) { if (u.role === 'admin' && u.email === 'admin@school.edu') { u.email = 'adminschool@gmail.com'; fixed = true; } });
  if (fixed) {
    saveUsers(users);
    var s = read(KEY_SESSION, null);
    if (s && s.email === 'admin@school.edu') write(KEY_SESSION, { email: 'adminschool@gmail.com' });
  }
  return users;
}
function saveUsers(users) { write(KEY_USERS, users); }
function currentUser() {
  var s = read(KEY_SESSION, null);
  if (!s) return null;
  return getUsers().filter(function (u) { return u.email === s.email; })[0] || null;
}
function requireRole(role) {
  var u = currentUser();
  if (!u || u.role !== role || u.status !== 'active') { go('login.html'); return null; }
  return u;
}
function homeFor(u) { return u.role === 'admin' ? 'admin.html' : u.role === 'staff' ? 'staff.html' : 'student.html'; }
function logout() { try { localStorage.removeItem(KEY_SESSION); } catch (e) {} go('login.html'); }
function togglePassword(btn) {
  var input = btn.parentElement.querySelector('input');
  var show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
}

/* ---------- login / register ---------- */
function login(email, password) {
  var u = getUsers().filter(function (x) { return x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password; })[0];
  if (!u) return { error: 'Wrong email or password.' };
  if (u.status === 'pending') return { error: 'Your account is waiting for admin approval. Please try again later.' };
  if (u.status === 'declined') return { error: 'Your registration was declined. Please contact the administrator.' };
  if (u.status === 'blocked') return { error: 'This account is blocked. Please contact the administrator.' };
  if (u.status !== 'active') return { error: 'This account is deactivated. Please contact the administrator.' };
  write(KEY_SESSION, { email: u.email });
  return { user: u };
}
// New accounts start as "pending" until an admin approves them.
function registerUser(data) {
  var users = getUsers();
  var email = data.email.trim().toLowerCase();
  if (users.some(function (u) { return u.email.toLowerCase() === email; })) return { error: 'This email is already registered.' };
  var u;
  if (data.role === 'staff') {
    u = { role: 'staff', fullname: data.fullname.trim(), id: 'STF' + String(Date.now()).slice(-6), email: email, password: data.password,
          department: data.department, title: 'Verification Officer', status: 'pending', created: new Date().toISOString() };
  } else {
    if (users.some(function (x) { return x.role === 'student' && x.id.toLowerCase() === data.id.trim().toLowerCase(); })) return { error: 'This ID number is already registered.' };
    u = { role: 'student', fullname: data.fullname.trim(), id: data.id.trim(), email: email, password: data.password,
          field: data.field, level: data.level, group: data.group, year: data.year, status: 'pending', created: new Date().toISOString() };
  }
  users.push(u);
  saveUsers(users);
  return { user: u };
}

/* ---------- QR verification ---------- */
function getLogs() { return read(KEY_LOGS, []); }
function addLog(entry) { var logs = getLogs(); logs.unshift(entry); write(KEY_LOGS, logs.slice(0, 300)); }

// A QR code holds only a short token: SCANID|<student id>|<time>. It shows no personal details.
function verifyToken(raw) {
  var me = currentUser();
  var parts = String(raw || '').trim().split('|');
  var res;
  if (parts.length !== 3 || parts[0] !== 'SCANID' || isNaN(+parts[2])) {
    res = { ok: false, reason: 'Invalid QR Code' };
  } else if (Date.now() - (+parts[2]) > TOKEN_TTL) {
    res = { ok: false, reason: 'Expired Token', id: parts[1] };
  } else {
    var s = getUsers().filter(function (u) { return u.role === 'student' && u.id === parts[1]; })[0];
    if (!s) res = { ok: false, reason: 'Student Record Not Found' };
    else if (s.status !== 'active') res = { ok: false, reason: 'Student account is blocked', id: s.id };
    else res = { ok: true, student: { fullname: s.fullname, id: s.id, field: s.field, level: s.level, group: s.group, year: s.year } };
  }
  var who = res.ok ? res.student.id + ' · ' + res.student.fullname : (res.id || 'Unknown token');
  addLog({ time: new Date().toISOString(), by: me ? me.fullname : 'Unknown', byEmail: me ? me.email : '', student: who, ok: res.ok, reason: res.reason || '' });
  write(KEY_RESULT, res);
  go(res.ok ? 'result-success.html' : 'result-failed.html');
}
function backHome() { var u = currentUser(); go(u && u.role === 'admin' ? 'admin.html#scanner' : 'staff.html'); }

/* ---------- camera scanner (uses jsQR) ---------- */
var scan = { stream: null, active: false };
function stopScanner() {
  scan.active = false;
  if (scan.stream) { scan.stream.getTracks().forEach(function (t) { t.stop(); }); scan.stream = null; }
}
function startScanner(root) {
  var video = root.querySelector('video'), dot = root.querySelector('.dot'), txt = root.querySelector('.status-text');
  function status(text, ok) { txt.textContent = text; dot.className = 'dot' + (ok ? '' : ' off'); }
  if (scan.active) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status('Camera not available here. Use "Enter Token Manually".', false); return;
  }
  if (typeof jsQR === 'undefined') {
    status('Scanner could not load (check your internet). Use manual entry.', false); return;
  }
  status('Starting camera…', false);
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (stream) {
    scan.stream = stream; scan.active = true;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.play();
    status('Camera Active – Place QR inside frame', true);
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    (function tick() {
      if (!scan.active) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) { stopScanner(); verifyToken(code.data); return; }
      }
      requestAnimationFrame(tick);
    })();
  }).catch(function () {
    status('Camera blocked. Allow camera access, or use "Enter Token Manually".', false);
  });
}
function toggleManual(root) { root.querySelector('.manual-box').classList.toggle('open'); }
