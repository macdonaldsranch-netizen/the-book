import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { firebaseAuth } from './firebase';

const googleProvider = new GoogleAuthProvider();
import * as api from './api';

// ─── Theme CSS variables ───────────────────────────────────────────────────────
const THEME_DARK = `
  :root {
    --bg:      #08111f; --bg2: #0d1b2e;
    --card:    rgba(13,24,42,0.92); --border: rgba(148,163,184,0.14);
    --border2: rgba(148,163,184,0.24); --ink: #e8efff; --muted: #7a90b0;
    --accent:  #61f3d3; --accent2: #8f7cff; --accent3: #ff7dd1;
    --warn:    #ffd970; --danger: #ff6b6b; --success: #5ce69a;
    --sidebar: 240px;
  }
  body { background: var(--bg); color: var(--ink); }
  .main {
    background:
      radial-gradient(ellipse at 0% 0%,   rgba(97,243,211,0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 100% 0%, rgba(143,124,255,0.07) 0%, transparent 50%),
      var(--bg);
  }
  .sidebar { background: rgba(5,10,22,0.80); }
  .field input, .field select, .field textarea { background: rgba(255,255,255,0.04); color: var(--ink); }
  .field select option { background: #0d1b2e; }
  .pill-select { background: rgba(255,255,255,0.04); }
  .pill-select option { background: #0d1b2e; }
  .btn-secondary { background: rgba(255,255,255,0.06); color: var(--ink); }
  .btn-secondary:hover { background: rgba(255,255,255,0.10); }
  .board-card { background: rgba(255,255,255,0.02); }
  .log-item   { background: rgba(255,255,255,0.02); }
  .login-wrap { background: radial-gradient(ellipse at top left, rgba(97,243,211,0.10) 0%, transparent 48%), radial-gradient(ellipse at bottom right, rgba(143,124,255,0.12) 0%, transparent 48%), #08111f; }
  .login-card { background: rgba(13,24,42,0.94); }
  .login-field input { background: rgba(255,255,255,0.05); color: var(--ink); }
`;

const THEME_LIGHT = `
  :root {
    --bg:      #f0f2f7; --bg2: #e8ebf3;
    --card:    #ffffff; --border: rgba(0,0,0,0.11);
    --border2: rgba(0,0,0,0.20); --ink: #111827; --muted: #4a5568;
    --accent:  #0d7a5f; --accent2: #5b3fc8; --accent3: #c2185b;
    --warn:    #92680a; --danger: #b91c1c; --success: #166534;
    --sidebar: 240px;
  }
  body { background: var(--bg); color: var(--ink); }
  .main { background: var(--bg); }
  .sidebar { background: #ffffff; border-right-color: rgba(0,0,0,0.12); }
  .logo-text { color: var(--ink); }
  .logo-sub  { color: var(--muted); }
  .nav-btn { color: #374151; }
  .nav-btn:hover { color: var(--ink); background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.12); }
  .nav-btn.active { color: var(--accent); background: rgba(13,122,95,0.10); border-color: rgba(13,122,95,0.30); font-weight:600; }
  .nav-section { color: #374151; opacity:1; font-weight:700; }
  .field input, .field select, .field textarea { background: #fff; color: var(--ink); border-color: rgba(0,0,0,0.18); }
  .field select option { background: #fff; color: #1a2233; }
  .pill-select { background: #fff; color: var(--ink); }
  .btn-secondary { background: rgba(0,0,0,0.06); color: var(--ink); border-color: rgba(0,0,0,0.14); }
  .btn-secondary:hover { background: rgba(0,0,0,0.10); }
  .board-card { background: #fff; }
  .log-item   { background: #fff; }
  .login-wrap { background: var(--bg); }
  .login-card { background: #fff; border-color: rgba(0,0,0,0.10); }
  .login-field input { background: #f9f9f9; color: var(--ink); }
`;

const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; }
  ::selection { background: rgba(97,243,211,0.22); }
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.25); border-radius:99px; }

  .shell { display:flex; min-height:100vh; }
  .sidebar {
    width: var(--sidebar); flex-shrink:0; position:sticky; top:0;
    height:100vh; overflow-y:auto; border-right:1px solid var(--border);
    backdrop-filter:blur(18px); display:flex; flex-direction:column;
    padding:20px 12px; gap:6px;
  }
  .logo { padding:10px 12px 20px; display:flex; align-items:center; gap:10px; }
  .logo-icon { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:grid; place-items:center; font-size:18px; flex-shrink:0; }
  .logo-text { font-size:1.1rem; font-weight:700; letter-spacing:-0.02em; color:var(--ink); }
  .logo-sub  { font-size:0.7rem; color:var(--muted); margin-top:1px; }
  .nav-btn { display:flex; align-items:center; gap:10px; width:100%; padding:11px 14px; border-radius:14px; border:1px solid transparent; background:transparent; color:var(--muted); font-size:0.88rem; font-weight:500; cursor:pointer; text-align:left; transition:all 140ms ease; }
  .nav-btn:hover { color:var(--ink); background:rgba(128,128,128,0.08); border-color:var(--border); }
  .nav-btn.active { color:var(--accent); background:rgba(97,243,211,0.08); border-color:rgba(97,243,211,0.22); }
  .nav-btn svg { width:17px; height:17px; flex-shrink:0; }
  .nav-section { padding:14px 14px 6px; font-size:0.68rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.08em; }

  .main { flex:1; min-width:0; padding:28px 32px; }
  .page-title { font-size:1.5rem; font-weight:700; letter-spacing:-0.03em; margin-bottom:20px; display:flex; align-items:center; gap:12px; }
  .page-title span { color:var(--muted); font-weight:400; font-size:0.9rem; letter-spacing:0; }

  .card { background:var(--card); border:1px solid var(--border); border-radius:18px; padding:20px 22px; backdrop-filter:blur(14px); }
  .card-title { font-size:0.8rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
  .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  .colstack { display:flex; flex-direction:column; gap:16px; }

  .stat-card { background:var(--card); border:1px solid var(--border); border-radius:18px; padding:20px 22px; position:relative; overflow:hidden; }
  .stat-card::before { content:''; position:absolute; top:-20px; right:-20px; width:80px; height:80px; border-radius:50%; background:currentColor; opacity:0.06; }
  .stat-label { font-size:0.75rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; }
  .stat-value { font-size:2.2rem; font-weight:700; letter-spacing:-0.04em; margin-top:6px; line-height:1; }
  .stat-sub   { font-size:0.75rem; color:var(--muted); margin-top:6px; }

  .form-grid   { display:grid; grid-template-columns:1fr 1fr; gap:12px 16px; }
  .form-grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px 16px; }
  .form-full   { grid-column:1/-1; }
  .field { display:flex; flex-direction:column; gap:5px; }
  .field label { font-size:0.76rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; }
  .field input, .field select, .field textarea { border:1px solid var(--border2); border-radius:10px; padding:9px 12px; font-size:0.88rem; font-family:inherit; outline:none; transition:border-color 120ms; width:100%; }
  .field input:focus, .field textarea:focus { border-color:var(--accent); }
  .field select { cursor:pointer; }
  .field textarea { resize:vertical; min-height:72px; }

  .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:10px; border:1px solid transparent; font-size:0.85rem; font-weight:600; cursor:pointer; font-family:inherit; transition:all 130ms ease; white-space:nowrap; }
  .btn-primary   { background:var(--accent); color:#071420; border-color:var(--accent); }
  .btn-primary:hover { filter:brightness(1.1); }
  .btn-danger    { background:rgba(255,107,107,0.12); color:var(--danger); border-color:rgba(255,107,107,0.3); }
  .btn-danger:hover { background:rgba(255,107,107,0.22); }
  .btn-ghost     { background:transparent; color:var(--muted); border-color:transparent; padding:6px 10px; }
  .btn-ghost:hover { color:var(--ink); background:rgba(128,128,128,0.08); }
  .btn-sm { padding:6px 12px; font-size:0.8rem; }
  .btn-icon { padding:7px; border-radius:8px; }

  .badge { display:inline-flex; align-items:center; padding:3px 9px; border-radius:99px; font-size:0.72rem; font-weight:600; letter-spacing:0.02em; white-space:nowrap; }
  .badge-green  { background:rgba(92,230,154,0.14);  color:var(--success); border:1px solid rgba(92,230,154,0.22); }
  .badge-teal   { background:rgba(97,243,211,0.12);  color:var(--accent);  border:1px solid rgba(97,243,211,0.22); }
  .badge-purple { background:rgba(143,124,255,0.12); color:var(--accent2); border:1px solid rgba(143,124,255,0.22); }
  .badge-warn   { background:rgba(255,217,112,0.12); color:var(--warn);    border:1px solid rgba(255,217,112,0.22); }
  .badge-red    { background:rgba(255,107,107,0.12); color:var(--danger);  border:1px solid rgba(255,107,107,0.22); }
  .badge-muted  { background:rgba(148,163,184,0.10); color:var(--muted);   border:1px solid var(--border); }

  .tbl-wrap { overflow-x:auto; margin:0 -2px; }
  table { width:100%; border-collapse:collapse; font-size:0.85rem; }
  th { text-align:left; padding:8px 12px; font-size:0.72rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid var(--border); white-space:nowrap; }
  td { padding:10px 12px; border-bottom:1px solid var(--border); vertical-align:middle; }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:rgba(128,128,128,0.04); }
  .td-name strong { display:block; font-weight:600; }
  .td-name small  { color:var(--muted); font-size:0.78rem; }
  .td-actions { display:flex; gap:6px; }

  .toolbar { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
  .search-wrap { position:relative; flex:1; min-width:200px; }
  .search-wrap svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--muted); }
  .search-wrap input { padding-left:32px; }
  .count-pill { background:rgba(97,243,211,0.10); border:1px solid rgba(97,243,211,0.2); color:var(--accent); border-radius:99px; padding:4px 12px; font-size:0.78rem; font-weight:600; }

  /* Day calendar */
  .cal-grid { display:grid; grid-template-columns:70px 1fr 1fr; border:1px solid var(--border); border-radius:14px; overflow:hidden; }
  .cal-header { font-size:0.73rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; padding:10px 14px; background:var(--card); border-bottom:1px solid var(--border); }
  .cal-time { font-size:0.78rem; font-weight:700; color:var(--accent); padding:10px 12px; border-bottom:1px solid var(--border); background:var(--card); display:flex; align-items:flex-start; }
  .cal-cell { padding:6px 10px; border-bottom:1px solid var(--border); border-left:1px solid var(--border); min-height:52px; vertical-align:top; }
  .cal-cell:empty::after { content:'—'; color:var(--muted); opacity:0.4; font-size:0.78rem; }
  .cal-res-pill { background:rgba(97,243,211,0.08); border:1px solid rgba(97,243,211,0.20); border-radius:8px; padding:5px 9px; margin-bottom:4px; font-size:0.80rem; }
  .cal-res-pill.booked { background:rgba(255,107,107,0.08); border-color:rgba(255,107,107,0.22); }
  .cal-res-sentence { font-size:0.77rem; color:var(--muted); margin-top:2px; line-height:1.5; }
  .cal-note-pill { background:rgba(143,124,255,0.08); border:1px solid rgba(143,124,255,0.20); border-radius:8px; padding:5px 9px; margin-bottom:4px; font-size:0.80rem; }
  .attendance-btn { font-size:0.70rem; padding:2px 8px; border-radius:6px; border:1px solid var(--border2); background:transparent; cursor:pointer; margin-top:3px; font-family:inherit; color:var(--muted); }
  .attendance-btn.checked-in { background:rgba(92,230,154,0.12); color:var(--success); border-color:rgba(92,230,154,0.3); }
  .attendance-btn.no-show    { background:rgba(255,107,107,0.12); color:var(--danger);  border-color:rgba(255,107,107,0.3); }

  .board-card { display:flex; gap:14px; align-items:flex-start; padding:13px 16px; border-radius:14px; border:1px solid var(--border); margin-bottom:8px; transition:border-color 120ms; }
  .board-card:hover { border-color:var(--border2); }
  .board-card.booked { border-left:3px solid var(--danger); }
  .board-time { font-size:0.8rem; font-weight:700; color:var(--accent); min-width:52px; }
  .board-body { flex:1; }
  .board-title { font-weight:600; font-size:0.88rem; }
  .board-meta  { font-size:0.78rem; color:var(--muted); margin-top:2px; }
  .board-sentence { font-size:0.79rem; color:var(--muted); margin-top:4px; line-height:1.5; }

  .log-item { padding:12px 14px; border-radius:12px; border:1px solid var(--border); margin-bottom:8px; }
  .log-action { font-weight:600; font-size:0.85rem; }
  .log-detail { font-size:0.82rem; color:var(--muted); margin-top:3px; }
  .log-ts     { font-size:0.72rem; color:var(--muted); margin-top:4px; }

  .conflict-banner { background:rgba(255,107,107,0.10); border:1px solid rgba(255,107,107,0.28); border-radius:10px; padding:10px 14px; color:var(--danger); font-size:0.83rem; font-weight:500; margin-bottom:12px; }

  .toast-area { position:fixed; bottom:24px; right:24px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
  .toast { background:var(--card); border:1px solid var(--border2); border-radius:12px; padding:12px 18px; display:flex; align-items:center; gap:10px; font-size:0.85rem; animation:slideIn 180ms ease; pointer-events:all; backdrop-filter:blur(18px); }
  .toast.success { border-color:rgba(92,230,154,0.35); }
  .toast.error   { border-color:rgba(255,107,107,0.35); }
  @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

  .divider { height:1px; background:var(--border); margin:20px 0; }
  .spacer  { height:16px; }
  .mt-16   { margin-top:16px; }
  .empty-state { text-align:center; padding:40px 20px; color:var(--muted); font-size:0.88rem; }
  .loading     { text-align:center; padding:60px 20px; color:var(--muted); }
  .flex-row    { display:flex; align-items:center; gap:10px; }
  .flex-between { display:flex; align-items:center; justify-content:space-between; }
  .pill-select { border:1px solid var(--border2); border-radius:10px; color:var(--ink); padding:8px 12px; font-size:0.84rem; font-family:inherit; outline:none; }

  /* Capacity badge */
  .cap-badge { padding:4px 12px; border-radius:8px; border:1px solid var(--border2); font-size:0.82rem; font-weight:600; cursor:pointer; background:transparent; color:var(--ink); font-family:inherit; }
  .cap-badge:hover { border-color:var(--accent); color:var(--accent); }

  /* Login */
  .login-wrap { min-height:100vh; display:grid; place-items:center; }
  .login-card { width:100%; max-width:400px; padding:40px 36px; border:1px solid var(--border); border-radius:24px; backdrop-filter:blur(20px); }
  .login-logo { display:flex; align-items:center; gap:12px; margin-bottom:28px; }
  .login-logo-icon { width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:grid; place-items:center; font-size:22px; }
  .login-title { font-size:1.4rem; font-weight:700; letter-spacing:-0.03em; }
  .login-sub   { font-size:0.78rem; color:var(--muted); margin-top:2px; }
  .login-field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .login-field label { font-size:0.75rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; }
  .login-field input { border:1px solid rgba(148,163,184,0.22); border-radius:10px; padding:11px 14px; font-size:0.92rem; font-family:inherit; outline:none; transition:border-color 120ms; width:100%; }
  .login-field input:focus { border-color:var(--accent); }
  .login-btn { width:100%; margin-top:8px; padding:12px; background:var(--accent); color:#071420; border:none; border-radius:10px; font-size:0.94rem; font-weight:700; cursor:pointer; font-family:inherit; transition:filter 130ms; }
  .login-btn:hover { filter:brightness(1.08); }
  .login-btn-google { width:100%; padding:12px; display:flex; align-items:center; justify-content:center; background:#fff; color:#3c4043; border:1px solid #dadce0; border-radius:10px; font-size:0.94rem; font-weight:600; cursor:pointer; font-family:inherit; transition:box-shadow 130ms; margin-bottom:4px; }
  .login-btn-google:hover { box-shadow:0 2px 8px rgba(0,0,0,0.18); }
  .login-btn-google:disabled { opacity:0.6; cursor:not-allowed; }
  .login-divider { display:flex; align-items:center; gap:10px; margin:14px 0; color:var(--muted); font-size:0.8rem; }
  .login-divider::before, .login-divider::after { content:''; flex:1; border-top:1px solid rgba(148,163,184,0.22); }
  .login-error { background:rgba(255,107,107,0.10); border:1px solid rgba(255,107,107,0.28); border-radius:9px; color:var(--danger); padding:9px 12px; font-size:0.82rem; margin-bottom:12px; text-align:center; }

  /* Admin screen */
  .role-badge-admin { color:var(--danger); }
  .role-badge-staff { color:var(--accent); }
  .role-badge-user  { color:var(--muted); }

  /* Theme toggle */
  .theme-toggle { font-size:0.75rem; padding:6px 10px; border-radius:8px; border:1px solid var(--border2); background:transparent; color:var(--muted); cursor:pointer; font-family:inherit; transition:all 130ms; }
  .theme-toggle:hover { background:rgba(128,128,128,0.08); color:var(--ink); }

  /* ── Mobile nav overlay ────────────────────────── */
  .mobile-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.50); z-index:199; }
  .hamburger {
    display:none; align-items:center; justify-content:center;
    position:fixed; top:12px; left:14px; z-index:300;
    background:var(--card); border:1px solid var(--border2); border-radius:10px;
    width:40px; height:40px; cursor:pointer; color:var(--ink); transition:all 130ms;
  }
  .hamburger:hover { border-color:var(--accent); color:var(--accent); }

  /* ── Responsive breakpoints ─────────────────────── */
  @media (max-width:768px) {
    .hamburger { display:flex; }
    .mobile-overlay { display:block; }
    .sidebar {
      position:fixed; left:0; top:0; z-index:200; height:100vh;
      transform:translateX(-100%); transition:transform 220ms ease;
    }
    .sidebar.open { transform:translateX(0); box-shadow:8px 0 32px rgba(0,0,0,0.45); }
    .main { padding:66px 14px 28px; }
    .page-title { font-size:1.15rem; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .grid2, .grid3, .grid4 { grid-template-columns:1fr; }
    .form-grid, .form-grid-3 { grid-template-columns:1fr; }
    .form-full { grid-column:1; }
    .stat-value { font-size:1.7rem; }
    .cal-grid { grid-template-columns:54px 1fr; }
    .cal-staff-col { display:none; }
    table { font-size:0.80rem; }
    th, td { padding:7px 8px; }
    .toast-area { bottom:16px; right:12px; left:12px; }
    .toast { font-size:0.82rem; }
    .tbl-wrap td .td-actions { flex-direction:column; }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
  catch { return d; }
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function fmtTs(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

/** Build a human-readable sentence for a reservation */
function resSentence(r) {
  const parts = [];
  const riders = [];
  if (r.adultCount) riders.push(`${r.adultCount} adult${r.adultCount > 1 ? 's' : ''}`);
  if (r.childCount) {
    const ages = r.childAges ? ` (ages: ${r.childAges})` : '';
    riders.push(`${r.childCount} child${r.childCount > 1 ? 'ren' : ''}${ages}`);
  }
  if (riders.length) parts.push(riders.join(', '));
  if (r.durationMinutes) parts.push(`${r.durationMinutes}-min ${r.rideType || ''} ride`);
  if (r.depositAmount)   parts.push(`$${Number(r.depositAmount).toFixed(2)} deposit`);
  if (r.cardType && r.cardLast4) parts.push(`${r.cardType} ···${r.cardLast4}`);
  if (r.specialRequests) parts.push(`Note: ${r.specialRequests}`);
  if (r.guideCount)      parts.push(`${r.guideCount} guide${r.guideCount > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

function generateTimeSlots() {
  const slots = [];
  for (let h = 6; h < 21; h++) {
    for (const m of [0, 30]) slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  }
  return slots;
}
const TIME_SLOTS = generateTimeSlots();

// ─── Small components ─────────────────────────────────────────────────────────
function Badge({ color = 'muted', children }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}
function Btn({ variant = 'secondary', size = '', onClick, type = 'button', disabled, children }) {
  return (
    <button type={type} className={`btn btn-${variant}${size ? ' btn-'+size : ''}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
function Card({ title, action, children }) {
  return (
    <div className="card">
      {(title || action) && <div className="card-title"><span>{title}</span>{action}</div>}
      {children}
    </div>
  );
}
function Field({ label, children, full }) {
  return (
    <div className={`field${full ? ' form-full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
function NavBtn({ icon, label, active, onClick }) {
  return (
    <button className={`nav-btn${active ? ' active' : ''}`} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      {label}
    </button>
  );
}

const ICONS = {
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  list:      'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  calendar:  'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  users:     'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  activity:  'M22 12h-4l-3 9L9 3l-3 9H2',
  settings:  'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  plus:      'M12 5v14M5 12h14',
  edit:      'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:     'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
  search:    'M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z',
  refresh:   'M1 4v6h6M23 20v-6h-6 M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15',
  check:     'M20 6L9 17l-5-5',
  sun:       'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 100 14A7 7 0 0012 5z',
  moon:      'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
  message:   'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  menu:      'M3 12h18M3 6h18M3 18h18',
  x:         'M18 6L6 18M6 6l12 12',
};

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastSetter = null;
function useToasts() {
  const [toasts, setToasts] = useState([]);
  _toastSetter = setToasts;
  return toasts;
}
function toast(msg, type = 'success') {
  if (!_toastSetter) return;
  const id = Date.now();
  _toastSetter(prev => [...prev, { id, msg, type }]);
  setTimeout(() => _toastSetter(prev => prev.filter(t => t.id !== id)), 3400);
}

// ─── Empty defaults ───────────────────────────────────────────────────────────
const EMPTY_RES = {
  reservationDate:'', startTime:'09:00', durationMinutes:60,
  rideType:'Group', firstName:'', lastName:'', phoneNumber:'',
  adultCount:1, childCount:0, childAges:'',
  depositAmount:'', cardType:'', cardLast4:'',
  specialRequests:'', notes:'', guideCount:1,
  bookedToCapacity:false, textConfirmationStatus:'Pending',
  followUpStatus:'Pending', attendanceStatus:null,
};
const EMPTY_APT = { title:'', owner:'', appointmentDate:today(), startTime:'09:00', endTime:'10:00', notes:'' };

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [err,      setErr]      = useState('');
  const [busy,     setBusy]     = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (ex) {
      setErr('Invalid email or password.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setErr('');
    setBusy(true);
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (ex) {
      if (ex.code !== 'auth/popup-closed-by-user') {
        setErr('Google sign-in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🐴</div>
          <div>
            <div className="login-title">The Book</div>
            <div className="login-sub">Trail Ride Reservations</div>
          </div>
        </div>
        {err && <div className="login-error">{err}</div>}
        <button className="login-btn-google" type="button" onClick={handleGoogle} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 48 48" style={{marginRight:8,flexShrink:0}}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>
        <div className="login-divider"><span>or</span></div>
        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required placeholder="you@example.com" />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <button className="login-btn" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const toasts = useToasts();

  // ── Auth state ───────────────────────────────────────────────────────────────
  const [fireUser, setFireUser] = useState(undefined); // undefined = loading
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (u) => {
      setFireUser(u || null);
      if (u) {
        const token = await u.getIdTokenResult();
        setUserRole(token.claims.role || 'user');
      }
    });
  }, []);

  // ── Theme ────────────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('tb_theme') === 'dark');

  useEffect(() => {
    const styleId = 'tb-theme-vars';
    let el = document.getElementById(styleId);
    if (!el) { el = document.createElement('style'); el.id = styleId; }
    el.textContent = darkMode ? THEME_DARK : THEME_LIGHT;
    document.head.appendChild(el); // always keep theme last so it overrides BASE_STYLES
    localStorage.setItem('tb_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const styleId = 'tb-base-styles';
    let el = document.getElementById(styleId);
    if (!el) { el = document.createElement('style'); el.id = styleId; document.head.appendChild(el); }
    el.textContent = BASE_STYLES;
  }, []);

  // ── App state ────────────────────────────────────────────────────────────────
  const [view,         setView]         = useState('dashboard');
  const [reservations, setReservations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [activity,     setActivity]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [calDate,      setCalDate]      = useState(today());
  const [capacity,     setCapacity]     = useState(null);
  const [search,       setSearch]       = useState('');

  const [showResForm,   setShowResForm]   = useState(false);
  const [editingResId,  setEditingResId]  = useState(null);
  const [resForm,       setResForm]       = useState({ ...EMPTY_RES, reservationDate: today() });

  const [showAptForm,  setShowAptForm]  = useState(false);
  const [editingAptId, setEditingAptId] = useState(null);
  const [aptForm,      setAptForm]      = useState({ ...EMPTY_APT });

  const [showCapModal, setShowCapModal] = useState(false);
  const [capEdit,      setCapEdit]      = useState(20);
  const [capNotes,     setCapNotes]     = useState('');

  const [showInvite,   setShowInvite]   = useState(false);
  const [inviteForm,   setInviteForm]   = useState({ email:'', password:'', role:'staff' });
  const [resetLink,    setResetLink]    = useState(null); // { email, link }
  const [users,        setUsers]        = useState([]);

  // ─ Messaging (SMS)
  const [msgForm,      setMsgForm]      = useState({ recipientType:'date', date:today(), phone:'', message:'' });
  const [msgSending,   setMsgSending]   = useState(false);

  // ─ Mobile sidebar
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  const isAdmin = userRole === 'admin';
  const isStaff = userRole === 'staff' || userRole === 'admin';

  // ── Load all ─────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!fireUser) return;
    setLoading(true);
    try {
      const [res, apt, act] = await Promise.all([
        api.getReservations(), api.getAppointments(), api.getActivity()
      ]);
      setReservations(res);
      setAppointments(apt);
      setActivity(act);
    } catch (e) { toast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, [fireUser]);

  useEffect(() => { if (fireUser) loadAll(); }, [fireUser, loadAll]);

  // Load capacity when calDate changes
  useEffect(() => {
    if (!fireUser) return;
    api.getCapacity(calDate).then(setCapacity).catch(() => {});
  }, [calDate, fireUser]);

  // Load users when admin opens admin view
  useEffect(() => {
    if (view === 'admin' && isAdmin) {
      api.listUsers().then(setUsers).catch(() => {});
    }
  }, [view, isAdmin]);

  // ── Auth guard ───────────────────────────────────────────────────────────────
  if (fireUser === undefined) return <div className="loading">Loading…</div>;
  if (fireUser === null)      return <LoginScreen />;
  if (!isStaff) return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign:'center' }}>
        <div style={{ fontSize:'2rem', marginBottom:16 }}>🔒</div>
        <div style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:8 }}>Access Restricted</div>
        <div style={{ color:'var(--muted)', fontSize:'0.88rem', marginBottom:20 }}>
          Your account ({fireUser.email}) does not have staff access.<br />Contact an admin to get access.
        </div>
        <Btn variant="secondary" onClick={() => signOut(firebaseAuth)}>Sign Out</Btn>
      </div>
    </div>
  );

  // ── Derived data ──────────────────────────────────────────────────────────────
  const todayStr = today();
  const todayRes = reservations.filter(r => r.reservationDate === todayStr);
  const todayRiders = todayRes.reduce((s, r) => s + (r.totalRiders || 0), 0);
  const calRes = reservations.filter(r => r.reservationDate === calDate)
                             .sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
  const calApt = appointments.filter(a => a.appointmentDate === calDate)
                             .sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
  const maxRiders = capacity?.maxRiders ?? 20;

  const filteredRes = reservations.filter(r => {
    const q = search.toLowerCase();
    return !q || [r.firstName, r.lastName, r.phoneNumber, r.confirmationNumber, r.rideType]
      .some(v => v?.toLowerCase().includes(q));
  });

  // ── Conflict detection ────────────────────────────────────────────────────────
  const conflicts = [];
  const byDate = {};
  for (const r of reservations) {
    if (!byDate[r.reservationDate]) byDate[r.reservationDate] = [];
    byDate[r.reservationDate].push(r);
  }
  for (const [d, arr] of Object.entries(byDate)) {
    const total = arr.reduce((s, r) => s + (r.totalRiders || 0), 0);
    const cap = maxRiders;
    if (total > cap) conflicts.push({ date: d, total, max: cap });
  }

  // ── Reservation form helpers ──────────────────────────────────────────────────
  function openNewRes(prefillDate) {
    setEditingResId(null);
    setResForm({ ...EMPTY_RES, reservationDate: prefillDate || today() });
    setShowResForm(true);
  }
  function openEditRes(r) {
    setEditingResId(r.id);
    setResForm({ ...r });
    setShowResForm(true);
  }
  async function submitRes(e) {
    e.preventDefault();
    const body = {
      ...resForm,
      adultCount:      Number(resForm.adultCount    || 0),
      childCount:      Number(resForm.childCount    || 0),
      durationMinutes: Number(resForm.durationMinutes || 60),
      depositAmount:   Number(resForm.depositAmount || 0),
      guideCount:      Number(resForm.guideCount    || 1),
    };
    try {
      if (editingResId) {
        await api.updateReservation(editingResId, body);
        toast('Reservation updated');
      } else {
        await api.createReservation(body);
        toast('Reservation created');
      }
      setShowResForm(false);
      loadAll();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function deleteRes(id) {
    if (!window.confirm('Cancel this reservation? It will be archived but never permanently deleted.')) return;
    try { await api.deleteReservation(id); toast('Reservation cancelled'); loadAll(); }
    catch (err) { toast(err.message, 'error'); }
  }

  // ── Attendance ────────────────────────────────────────────────────────────────
  async function cycleAttendance(r) {
    const next = r.attendanceStatus === 'checked-in' ? 'no-show'
                : r.attendanceStatus === 'no-show'    ? null
                : 'checked-in';
    try {
      await api.patchAttendance(r.id, next);
      setReservations(prev => prev.map(x => x.id === r.id ? { ...x, attendanceStatus: next } : x));
    } catch (err) { toast(err.message, 'error'); }
  }

  // ── Appointment form helpers ──────────────────────────────────────────────────
  function openNewApt(prefillDate) {
    setEditingAptId(null);
    setAptForm({ ...EMPTY_APT, appointmentDate: prefillDate || today() });
    setShowAptForm(true);
  }
  function openEditApt(a) {
    setEditingAptId(a.id);
    setAptForm({ ...a });
    setShowAptForm(true);
  }
  async function submitApt(e) {
    e.preventDefault();
    try {
      if (editingAptId) {
        await api.updateAppointment(editingAptId, aptForm);
        toast('Appointment updated');
      } else {
        await api.createAppointment(aptForm);
        toast('Appointment added');
      }
      setShowAptForm(false);
      loadAll();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function deleteApt(id) {
    if (!window.confirm('Remove this appointment?')) return;
    try { await api.deleteAppointment(id); toast('Appointment removed'); loadAll(); }
    catch (err) { toast(err.message, 'error'); }
  }

  // ── Capacity modal ────────────────────────────────────────────────────────────
  function openCapModal() {
    setCapEdit(maxRiders);
    setCapNotes(capacity?.notes || '');
    setShowCapModal(true);
  }
  async function saveCapacity() {
    try {
      await api.setCapacity(calDate, { maxRiders: Number(capEdit), notes: capNotes });
      const updated = await api.getCapacity(calDate);
      setCapacity(updated);
      setShowCapModal(false);
      toast('Capacity updated');
    } catch (err) { toast(err.message, 'error'); }
  }

  // ── User invite ───────────────────────────────────────────────────────────────
  async function submitInvite(e) {
    e.preventDefault();
    try {
      await api.inviteUser(inviteForm);
      toast(`${inviteForm.email} invited as ${inviteForm.role}`);
      setShowInvite(false);
      setInviteForm({ email:'', password:'', role:'staff' });
      api.listUsers().then(setUsers).catch(() => {});
    } catch (err) { toast(err.message, 'error'); }
  }

  async function toggleUserDisabled(u) {
    try {
      if (u.disabled) {
        await api.enableUser(u.id);
        setUsers(prev => prev.map(x => x.id === u.id ? {...x, disabled:false} : x));
        toast(`${u.email} activated`);
      } else {
        await api.disableUser(u.id);
        setUsers(prev => prev.map(x => x.id === u.id ? {...x, disabled:true} : x));
        toast(`${u.email} deactivated`, 'error');
      }
    } catch(err) { toast(err.message, 'error'); }
  }

  async function handleResetPassword(u) {
    try {
      const res = await api.resetUserPassword(u.id);
      setResetLink({ email: res.email, link: res.link });
    } catch(err) { toast(err.message, 'error'); }
  }

  // ── SMS send handler ──────────────────────────────────────────────────
  async function submitMsg(e) {
    e.preventDefault();
    setMsgSending(true);
    try {
      const body = { message: msgForm.message };
      if (msgForm.recipientType === 'date')  body.date = msgForm.date;
      if (msgForm.recipientType === 'phone') body.to   = msgForm.phone;
      const r = await api.sendSms(body);
      toast(`✅ Sent ${r.sent} message${r.sent !== 1 ? 's' : ''}`);
      setMsgForm(f => ({ ...f, message: '' }));
    } catch(err) { toast(err.message, 'error'); }
    finally { setMsgSending(false); }
  }

  // ── Modal wrapper component ───────────────────────────────────────────────────
  function Modal({ title, onClose, children }) {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', zIndex:1000, display:'grid', placeItems:'center', padding:20 }}>
        <div style={{ background:'var(--bg2)', borderRadius:20, padding:28, width:'100%', maxWidth:640, border:'1px solid var(--border2)', maxHeight:'90vh', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:'1.05rem' }}>{title}</div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'1.2rem' }}>✕</button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  // ── Attendance badge label ────────────────────────────────────────────────────
  function attendanceLabel(status) {
    if (status === 'checked-in') return '✓ Checked In';
    if (status === 'no-show')    return '✗ No Show';
    return '○ Mark';
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return <div className="loading">Loading The Book…</div>;

  return (
    <>
      {/* Toast area */}
      <div className="toast-area">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? '✓' : '✗'} {t.msg}
          </div>
        ))}
      </div>

      {/* Reservation form modal */}
      {showResForm && (
        <Modal title={editingResId ? 'Edit Reservation' : 'New Reservation'} onClose={() => setShowResForm(false)}>
          <form onSubmit={submitRes}>
            <div className="form-grid">
              <Field label="First Name"><input required value={resForm.firstName} onChange={e => setResForm({...resForm, firstName:e.target.value})} /></Field>
              <Field label="Last Name"><input  required value={resForm.lastName}  onChange={e => setResForm({...resForm, lastName:e.target.value})} /></Field>
              <Field label="Phone"><input value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber:e.target.value})} /></Field>
              <Field label="Ride Type">
                <select value={resForm.rideType} onChange={e => setResForm({...resForm, rideType:e.target.value})}>
                  {['Group','Private','Kids','Pony','Custom'].map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Date"><input type="date" required value={resForm.reservationDate} onChange={e => setResForm({...resForm, reservationDate:e.target.value})} /></Field>
              <Field label="Start Time">
                <select value={resForm.startTime} onChange={e => setResForm({...resForm, startTime:e.target.value})}>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
                </select>
              </Field>
              <Field label="Duration (min)">
                <select value={resForm.durationMinutes} onChange={e => setResForm({...resForm, durationMinutes:Number(e.target.value)})}>
                  {[30,45,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </Field>
              <Field label="Adults"><input type="number" min={0} value={resForm.adultCount} onChange={e => setResForm({...resForm, adultCount:Number(e.target.value)})} /></Field>
              <Field label="Children"><input type="number" min={0} value={resForm.childCount} onChange={e => setResForm({...resForm, childCount:Number(e.target.value)})} /></Field>
              <Field label="Child Ages"><input value={resForm.childAges} placeholder="e.g. 6, 8, 10" onChange={e => setResForm({...resForm, childAges:e.target.value})} /></Field>
              <Field label="Deposit ($)"><input type="number" min={0} step="0.01" value={resForm.depositAmount} onChange={e => setResForm({...resForm, depositAmount:e.target.value})} /></Field>
              <Field label="Card Type">
                <select value={resForm.cardType} onChange={e => setResForm({...resForm, cardType:e.target.value})}>
                  {['','Visa','Mastercard','Amex','Discover','Cash','Check'].map(c => <option key={c} value={c}>{c||'—'}</option>)}
                </select>
              </Field>
              <Field label="Card Last 4"><input maxLength={4} value={resForm.cardLast4} onChange={e => setResForm({...resForm, cardLast4:e.target.value})} /></Field>
              <Field label="Guides"><input type="number" min={0} value={resForm.guideCount} onChange={e => setResForm({...resForm, guideCount:Number(e.target.value)})} /></Field>
              <Field label="Text Confirmation">
                <select value={resForm.textConfirmationStatus} onChange={e => setResForm({...resForm, textConfirmationStatus:e.target.value})}>
                  {['Pending','Sent','Confirmed'].map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Follow Up">
                <select value={resForm.followUpStatus} onChange={e => setResForm({...resForm, followUpStatus:e.target.value})}>
                  {['Pending','Done','N/A'].map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Special Requests" full><textarea value={resForm.specialRequests} onChange={e => setResForm({...resForm, specialRequests:e.target.value})} /></Field>
              <Field label="Internal Notes" full><textarea value={resForm.notes} onChange={e => setResForm({...resForm, notes:e.target.value})} /></Field>
            </div>
            <div style={{marginTop:20, display:'flex', gap:10}}>
              <Btn type="submit" variant="primary">{editingResId ? 'Save Changes' : 'Create Reservation'}</Btn>
              <Btn onClick={() => setShowResForm(false)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Appointment form modal */}
      {showAptForm && (
        <Modal title={editingAptId ? 'Edit Appointment' : 'New Appointment'} onClose={() => setShowAptForm(false)}>
          <form onSubmit={submitApt}>
            <div className="form-grid">
              <Field label="Title" full><input required value={aptForm.title} onChange={e => setAptForm({...aptForm, title:e.target.value})} /></Field>
              <Field label="Owner / Staff"><input value={aptForm.owner} onChange={e => setAptForm({...aptForm, owner:e.target.value})} /></Field>
              <Field label="Date"><input type="date" required value={aptForm.appointmentDate} onChange={e => setAptForm({...aptForm, appointmentDate:e.target.value})} /></Field>
              <Field label="Start Time">
                <select value={aptForm.startTime} onChange={e => setAptForm({...aptForm, startTime:e.target.value})}>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
                </select>
              </Field>
              <Field label="End Time">
                <select value={aptForm.endTime} onChange={e => setAptForm({...aptForm, endTime:e.target.value})}>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
                </select>
              </Field>
              <Field label="Notes" full><textarea value={aptForm.notes} onChange={e => setAptForm({...aptForm, notes:e.target.value})} /></Field>
            </div>
            <div style={{marginTop:20, display:'flex', gap:10}}>
              <Btn type="submit" variant="primary">{editingAptId ? 'Save Changes' : 'Add Appointment'}</Btn>
              <Btn onClick={() => setShowAptForm(false)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Capacity modal */}
      {showCapModal && (
        <Modal title={`Capacity for ${fmtDate(calDate)}`} onClose={() => setShowCapModal(false)}>
          <div className="form-grid">
            <Field label="Max Riders">
              <input type="number" min={1} value={capEdit} onChange={e => setCapEdit(e.target.value)} />
            </Field>
            <Field label="Notes">
              <input value={capNotes} onChange={e => setCapNotes(e.target.value)} placeholder="Optional note" />
            </Field>
          </div>
          <div style={{marginTop:20, display:'flex', gap:10}}>
            <Btn variant="primary" onClick={saveCapacity}>Save</Btn>
            <Btn onClick={() => setShowCapModal(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* Invite user modal */}
      {showInvite && (
        <Modal title="Invite User" onClose={() => setShowInvite(false)}>
          <form onSubmit={submitInvite}>
            <div className="form-grid">
              <Field label="Email" full><input type="email" required value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email:e.target.value})} /></Field>
              <Field label="Temp Password"><input type="text" required value={inviteForm.password} onChange={e => setInviteForm({...inviteForm, password:e.target.value})} placeholder="They can change this later" /></Field>
              <Field label="Role">
                <select value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role:e.target.value})}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="user">User (read-only)</option>
                </select>
              </Field>
            </div>
            <div style={{marginTop:20, display:'flex', gap:10}}>
              <Btn type="submit" variant="primary">Send Invite</Btn>
              <Btn onClick={() => setShowInvite(false)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset password link modal */}
      {resetLink && (
        <Modal title="Password Reset Link" onClose={() => setResetLink(null)}>
          <p style={{fontSize:'0.88rem', color:'var(--muted)', marginBottom:14}}>
            Share this one-time link with <strong style={{color:'var(--ink)'}}>{resetLink.email}</strong> so they can set a new password. It expires in 1 hour.
          </p>
          <div style={{background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:10, padding:'10px 14px', wordBreak:'break-all', fontSize:'0.82rem', fontFamily:'monospace', color:'var(--ink)'}}>
            {resetLink.link}
          </div>
          <div style={{marginTop:16, display:'flex', gap:10}}>
            <Btn variant="primary" onClick={() => { navigator.clipboard.writeText(resetLink.link); toast('Link copied!'); }}>Copy Link</Btn>
            <Btn onClick={() => setResetLink(null)}>Close</Btn>
          </div>
        </Modal>
      )}

      {/* Shell */}
      <div className="shell">
        {/* Hamburger (mobile only) */}
        <button className="hamburger" aria-label="Open menu" onClick={() => setSidebarOpen(o => !o)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={sidebarOpen ? ICONS.x : ICONS.menu} />
          </svg>
        </button>

        {/* Mobile overlay */}
        {sidebarOpen && <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="logo">
            <div className="logo-icon">🐴</div>
            <div>
              <div className="logo-text">The Book</div>
              <div className="logo-sub">Trail Ride Reservations</div>
            </div>
          </div>

          <div className="nav-section">Menu</div>
          <NavBtn icon={ICONS.dashboard} label="Dashboard"    active={view==='dashboard'}    onClick={() => { setView('dashboard');    setSidebarOpen(false); }} />
          <NavBtn icon={ICONS.list}      label="Reservations" active={view==='reservations'} onClick={() => { setView('reservations'); setSidebarOpen(false); }} />
          <NavBtn icon={ICONS.users}     label="Staff Appts"  active={view==='appointments'} onClick={() => { setView('appointments'); setSidebarOpen(false); }} />
          <NavBtn icon={ICONS.calendar}  label="Day View"     active={view==='calendar'}     onClick={() => { setView('calendar');     setSidebarOpen(false); }} />
          <NavBtn icon={ICONS.message}   label="Messages"     active={view==='messages'}     onClick={() => { setView('messages');     setSidebarOpen(false); }} />

          {isAdmin && (
            <>
              <div className="nav-section">Admin</div>
              <NavBtn icon={ICONS.settings} label="Users"       active={view==='admin'}    onClick={() => { setView('admin');    setSidebarOpen(false); }} />
            </>
          )}

          <div className="nav-section" style={{marginTop:'auto'}}>Logs</div>
          <NavBtn icon={ICONS.activity}  label="Activity Log" active={view==='activity'}     onClick={() => { setView('activity'); setSidebarOpen(false); }} />

          <div style={{padding:'4px 12px', display:'flex', flexDirection:'column', gap:6}}>
            <button className="theme-toggle" onClick={() => setDarkMode(d => !d)}>
              {darkMode ? '☀ Light mode' : '☽ Dark mode'}
            </button>
            <button
              onClick={() => signOut(firebaseAuth)}
              style={{padding:'8px 12px', background:'transparent', border:'1px solid var(--border2)', borderRadius:6, color:'var(--muted)', cursor:'pointer', fontSize:12, textAlign:'left', fontFamily:'inherit'}}
            >
              🔓 Sign Out ({fireUser.email?.split('@')[0]})
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="main">

          {/* ── DASHBOARD ── */}
          {view === 'dashboard' && (
            <>
              <div className="page-title">
                Dashboard
                <span>{fmtDate(todayStr)}</span>
                <Btn variant="ghost" size="sm" onClick={loadAll}>↻ Refresh</Btn>
              </div>

              {conflicts.length > 0 && (
                <div className="conflict-banner">
                  ⚠ Capacity exceeded: {conflicts.map(c => `${fmtDate(c.date)} (${c.total}/${c.max} riders)`).join(' · ')}
                </div>
              )}

              <div className="grid4" style={{marginBottom:20}}>
                <div className="stat-card" style={{color:'var(--accent)'}}>
                  <div className="stat-label">Total Reservations</div>
                  <div className="stat-value">{reservations.length}</div>
                </div>
                <div className="stat-card" style={{color:'var(--accent2)'}}>
                  <div className="stat-label">Today's Reservations</div>
                  <div className="stat-value">{todayRes.length}</div>
                </div>
                <div className="stat-card" style={{color:'var(--warn)'}}>
                  <div className="stat-label">Today's Riders</div>
                  <div className="stat-value">{todayRiders}</div>
                  <div className="stat-sub">of {maxRiders} max</div>
                </div>
                <div className="stat-card" style={{color:'var(--success)'}}>
                  <div className="stat-label">Staff Appointments</div>
                  <div className="stat-value">{appointments.length}</div>
                </div>
              </div>

              <div className="grid2">
                <Card title="Today's Reservations" action={<Btn variant="ghost" size="sm" onClick={() => openNewRes(todayStr)}>+ New</Btn>}>
                  {todayRes.length === 0 ? <div className="empty-state">No reservations today</div> :
                    todayRes.map(r => (
                      <div key={r.id} className="board-card">
                        <div className="board-time">{fmtTime(r.startTime)}</div>
                        <div className="board-body">
                          <div className="board-title">{r.firstName} {r.lastName}</div>
                          <div className="board-sentence">{resSentence(r)}</div>
                        </div>
                        <Badge color={r.rideType === 'Private' ? 'purple' : 'teal'}>{r.rideType}</Badge>
                      </div>
                    ))
                  }
                </Card>
                <Card title="Recent Activity">
                  {activity.slice(0, 8).map(a => (
                    <div key={a.id} className="log-item">
                      <div className="log-action">{a.action}</div>
                      <div className="log-detail">{a.detail}</div>
                      <div className="log-ts">{fmtTs(a.timestamp)}{a.actor ? ` · ${a.actor}` : ''}</div>
                    </div>
                  ))}
                  {activity.length === 0 && <div className="empty-state">No activity yet</div>}
                </Card>
              </div>
            </>
          )}

          {/* ── RESERVATIONS LIST ── */}
          {view === 'reservations' && (
            <>
              <div className="page-title">
                Reservations
                <Btn variant="primary" onClick={() => openNewRes()}>+ New Reservation</Btn>
              </div>
              <div className="toolbar">
                <div className="search-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS.search}/></svg>
                  <input className="field input" placeholder="Search name, phone, confirmation…" value={search} onChange={e => setSearch(e.target.value)} style={{background:'var(--card)', border:'1px solid var(--border2)', borderRadius:10, padding:'9px 12px 9px 32px', color:'var(--ink)', width:'100%', fontFamily:'inherit', outline:'none'}} />
                </div>
                <span className="count-pill">{filteredRes.length} results</span>
              </div>
              <Card>
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Confirmation</th>
                        <th>Guest</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Riders</th>
                        <th>Type</th>
                        <th>Attendance</th>
                        <th>Details</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRes.length === 0 && <tr><td colSpan={9} className="empty-state">No reservations found</td></tr>}
                      {filteredRes.map(r => (
                        <tr key={r.id}>
                          <td><Badge color="teal">{r.confirmationNumber}</Badge></td>
                          <td className="td-name"><strong>{r.firstName} {r.lastName}</strong><small>{r.phoneNumber}</small></td>
                          <td>{fmtDate(r.reservationDate)}</td>
                          <td>{fmtTime(r.startTime)}</td>
                          <td>{r.totalRiders}</td>
                          <td><Badge color={r.rideType==='Private'?'purple':'teal'}>{r.rideType}</Badge></td>
                          <td>
                            <button className={`attendance-btn ${r.attendanceStatus||''}`} onClick={() => cycleAttendance(r)}>
                              {attendanceLabel(r.attendanceStatus)}
                            </button>
                          </td>
                          <td style={{maxWidth:280, fontSize:'0.77rem', color:'var(--muted)'}}>{resSentence(r)}</td>
                          <td>
                            <div className="td-actions">
                              <Btn variant="ghost" size="sm" onClick={() => openEditRes(r)}>Edit</Btn>
                              {isAdmin && <Btn variant="danger" size="sm" onClick={() => deleteRes(r.id)}>Cancel</Btn>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {/* ── APPOINTMENTS ── */}
          {view === 'appointments' && (
            <>
              <div className="page-title">
                Staff Appointments
                <Btn variant="primary" onClick={() => openNewApt()}>+ New Appointment</Btn>
              </div>
              <Card>
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr><th>Title</th><th>Owner</th><th>Date</th><th>Time</th><th>Notes</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {appointments.length === 0 && <tr><td colSpan={6} className="empty-state">No appointments</td></tr>}
                      {appointments.map(a => (
                        <tr key={a.id}>
                          <td><strong>{a.title}</strong></td>
                          <td>{a.owner}</td>
                          <td>{fmtDate(a.appointmentDate)}</td>
                          <td>{fmtTime(a.startTime)} – {fmtTime(a.endTime)}</td>
                          <td style={{fontSize:'0.82rem', color:'var(--muted)'}}>{a.notes}</td>
                          <td>
                            <div className="td-actions">
                              <Btn variant="ghost" size="sm" onClick={() => openEditApt(a)}>Edit</Btn>
                              <Btn variant="danger" size="sm" onClick={() => deleteApt(a.id)}>Remove</Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {/* ── DAY CALENDAR ── */}
          {view === 'calendar' && (
            <>
              <div className="page-title">
                Day View
                <input type="date" value={calDate} onChange={e => setCalDate(e.target.value)}
                  style={{background:'var(--card)', border:'1px solid var(--border2)', borderRadius:10, padding:'7px 12px', color:'var(--ink)', fontSize:'0.88rem', fontFamily:'inherit', outline:'none'}} />
                <span>{fmtDate(calDate)}</span>
                {isAdmin && (
                  <button className="cap-badge" onClick={openCapModal}>
                    👥 Cap: {maxRiders} riders {capacity?.notes ? `· ${capacity.notes}` : ''}
                  </button>
                )}
                <Btn variant="ghost" size="sm" onClick={() => openNewRes(calDate)}>+ Reservation</Btn>
                <Btn variant="ghost" size="sm" onClick={() => openNewApt(calDate)}>+ Staff Appt</Btn>
              </div>

              {/* Time-slot grid — matches the paper copy layout */}
              <div className="cal-grid">
                          <div className="cal-header">Time</div>
                <div className="cal-header">Reservations</div>
                <div className="cal-header cal-staff-col">Staff / Notes</div>

                {TIME_SLOTS.map(slot => {
                  const slotRes = calRes.filter(r => r.startTime === slot);
                  const slotApt = calApt.filter(a => a.startTime === slot);
                  if (slotRes.length === 0 && slotApt.length === 0) return null;
                  return (
                    <React.Fragment key={slot}>
                      <div className="cal-time">{fmtTime(slot)}</div>
                      <div className="cal-cell">
                        {slotRes.map(r => (
                          <div key={r.id} className={`cal-res-pill${r.bookedToCapacity?' booked':''}`}>
                            <strong>{r.firstName} {r.lastName}</strong>
                            <div className="cal-res-sentence">{resSentence(r)}</div>
                            <button className={`attendance-btn ${r.attendanceStatus||''}`} onClick={() => cycleAttendance(r)}>
                              {attendanceLabel(r.attendanceStatus)}
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="cal-cell cal-staff-col">
                        {slotApt.map(a => (
                          <div key={a.id} className="cal-note-pill">
                            <strong>{a.title}</strong>{a.owner ? ` — ${a.owner}` : ''}
                            {a.notes && <div style={{fontSize:'0.75rem', color:'var(--muted)', marginTop:2}}>{a.notes}</div>}
                          </div>
                        ))}
                        {slotRes.map(r => r.notes ? (
                          <div key={r.id+'n'} style={{fontSize:'0.77rem', color:'var(--muted)', marginTop:4}}>
                            📝 {r.notes}
                          </div>
                        ) : null)}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              {calRes.length === 0 && calApt.length === 0 && (
                <div className="empty-state" style={{marginTop:20}}>No events for {fmtDate(calDate)}</div>
              )}
            </>
          )}

          {/* ── MESSAGES ── */}
          {view === 'messages' && (
            <>
              <div className="page-title">
                📲 Messages
                <span>Send SMS to guests via Twilio</span>
              </div>

              <Card title="Compose Message">
                <form onSubmit={submitMsg}>
                  <div className="form-grid">
                    <Field label="Send To">
                      <select value={msgForm.recipientType} onChange={e => setMsgForm({...msgForm, recipientType:e.target.value})}>
                        <option value="date">All reservations on a date</option>
                        <option value="phone">Specific phone number</option>
                      </select>
                    </Field>

                    {msgForm.recipientType === 'date' && (
                      <Field label="Date">
                        <input type="date" required value={msgForm.date} onChange={e => setMsgForm({...msgForm, date:e.target.value})} />
                      </Field>
                    )}
                    {msgForm.recipientType === 'phone' && (
                      <Field label="Phone Number">
                        <input type="tel" required placeholder="(555) 000-0000" value={msgForm.phone} onChange={e => setMsgForm({...msgForm, phone:e.target.value})} />
                      </Field>
                    )}

                    <Field label="Message" full>
                      <textarea
                        required rows={4}
                        placeholder="Type your message to guests…"
                        value={msgForm.message}
                        onChange={e => setMsgForm({...msgForm, message:e.target.value})}
                      />
                    </Field>
                  </div>
                  <div style={{marginTop:16, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
                    <Btn type="submit" variant="primary" disabled={msgSending}>
                      {msgSending ? 'Sending…' : '📲 Send SMS'}
                    </Btn>
                    <span style={{fontSize:'0.78rem', color:'var(--muted)'}}>Sent via Twilio · guests can reply STOP to opt out</span>
                  </div>
                </form>
              </Card>

              {/* Recipient preview when sending by date */}
              {msgForm.recipientType === 'date' && msgForm.date && (
                <Card title={`Recipients — ${fmtDate(msgForm.date)}`} style={{marginTop:16}}>
                  {reservations.filter(r => r.reservationDate === msgForm.date).length === 0 ? (
                    <div className="empty-state">No reservations on this date</div>
                  ) : (
                    reservations.filter(r => r.reservationDate === msgForm.date).map(r => (
                      <div key={r.id} style={{display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:'1px solid var(--border)'}}>
                        <div style={{flex:1}}>
                          <strong style={{fontSize:'0.88rem'}}>{r.firstName} {r.lastName}</strong>
                          <span style={{color:'var(--muted)', fontSize:'0.80rem', marginLeft:10}}>{fmtTime(r.startTime)} · {r.rideType}</span>
                        </div>
                        <div style={{fontSize:'0.82rem', color:'var(--muted)'}}>{r.phoneNumber || <span style={{color:'var(--danger)'}}>No phone</span>}</div>
                        <Badge color={r.phoneNumber ? 'green' : 'red'}>{r.phoneNumber ? '✓ Reachable' : '✗ No phone'}</Badge>
                      </div>
                    ))
                  )}
                </Card>
              )}
            </>
          )}

          {/* ── ACTIVITY LOG ── */}
          {view === 'activity' && (() => {
            const ACTION_TYPES = [
              'All Actions',
              'Reservation created', 'Reservation updated', 'Reservation deleted',
              'Attendance updated',
              'Appointment added', 'Appointment updated', 'Appointment deleted',
              'Capacity updated', 'Settings updated',
              'User invited', 'Role updated', 'User activated', 'User deactivated',
              'Password reset link generated',
            ];
            const [actSearch,     setActSearch]     = React.useState('');
            const [actActionType, setActActionType] = React.useState('All Actions');
            const [actDateFrom,   setActDateFrom]   = React.useState('');
            const [actDateTo,     setActDateTo]     = React.useState('');

            const filtered = activity.filter(a => {
              if (actActionType !== 'All Actions' && a.action !== actActionType) return false;
              if (actDateFrom && a.timestamp < actDateFrom) return false;
              if (actDateTo   && a.timestamp > actDateTo + 'T23:59:59') return false;
              if (actSearch) {
                const q = actSearch.toLowerCase();
                if (!(a.action?.toLowerCase().includes(q) ||
                      a.detail?.toLowerCase().includes(q) ||
                      a.actor?.toLowerCase().includes(q))) return false;
              }
              return true;
            });

            const ACTION_ICONS = {
              'Reservation created':  '📋',
              'Reservation updated':  '✏️',
              'Reservation deleted':  '🗑️',
              'Attendance updated':   '✅',
              'Appointment added':    '📅',
              'Appointment updated':  '✏️',
              'Appointment deleted':  '🗑️',
              'Capacity updated':     '🔢',
              'Settings updated':     '⚙️',
              'User invited':         '👤',
              'Role updated':         '🔑',
              'User activated':       '✓',
              'User deactivated':     '⊘',
              'Password reset link generated': '🔒',
            };

            return (
              <>
                <div className="page-title">
                  Activity Log
                  <span>{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Filters */}
                <Card style={{marginBottom:16, padding:'14px 18px'}}>
                  <div style={{display:'flex', gap:10, flexWrap:'wrap', alignItems:'center'}}>
                    <div className="search-wrap" style={{minWidth:220, flex:2}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                      <input
                        placeholder="Search action, detail, user…"
                        value={actSearch}
                        onChange={e => setActSearch(e.target.value)}
                        style={{width:'100%', border:'1px solid var(--border2)', borderRadius:10, padding:'8px 12px', fontFamily:'inherit', fontSize:'0.85rem', color:'var(--ink)', background:'var(--card)', outline:'none'}}
                      />
                    </div>
                    <select
                      className="pill-select"
                      value={actActionType}
                      onChange={e => setActActionType(e.target.value)}
                      style={{flex:1, minWidth:180}}
                    >
                      {ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <div style={{display:'flex', alignItems:'center', gap:6, flex:1, minWidth:220}}>
                      <input
                        type="date"
                        value={actDateFrom}
                        onChange={e => setActDateFrom(e.target.value)}
                        style={{flex:1, border:'1px solid var(--border2)', borderRadius:10, padding:'8px 10px', fontFamily:'inherit', fontSize:'0.84rem', color:'var(--ink)', background:'var(--card)', outline:'none'}}
                      />
                      <span style={{color:'var(--muted)', fontSize:'0.82rem'}}>to</span>
                      <input
                        type="date"
                        value={actDateTo}
                        onChange={e => setActDateTo(e.target.value)}
                        style={{flex:1, border:'1px solid var(--border2)', borderRadius:10, padding:'8px 10px', fontFamily:'inherit', fontSize:'0.84rem', color:'var(--ink)', background:'var(--card)', outline:'none'}}
                      />
                    </div>
                    {(actSearch || actActionType !== 'All Actions' || actDateFrom || actDateTo) && (
                      <Btn variant="ghost" size="sm" onClick={() => { setActSearch(''); setActActionType('All Actions'); setActDateFrom(''); setActDateTo(''); }}>
                        ✕ Clear
                      </Btn>
                    )}
                  </div>
                </Card>

                {filtered.length === 0
                  ? <div className="empty-state">No events match your filters</div>
                  : filtered.map(a => (
                    <div key={a.id} className="log-item">
                      <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                        <span style={{fontSize:'1rem', lineHeight:'1.4', flexShrink:0}}>{ACTION_ICONS[a.action] || '•'}</span>
                        <div style={{flex:1}}>
                          <div className="log-action">{a.action}</div>
                          <div className="log-detail">{a.detail}</div>
                          <div className="log-ts">{fmtTs(a.timestamp)}{a.actor ? ` · ${a.actor}` : ''}</div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </>
            );
          })()}

          {/* ── ADMIN — USER MANAGEMENT ── */}
          {view === 'admin' && isAdmin && (
            <>
              <div className="page-title">
                User Management
                <Btn variant="primary" onClick={() => setShowInvite(true)}>+ Add User</Btn>
              </div>
              <Card>
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {users.length === 0 && <tr><td colSpan={5} className="empty-state">No users found</td></tr>}
                      {users.map(u => (
                        <tr key={u.id} style={{opacity: u.disabled ? 0.6 : 1}}>
                          <td style={{fontWeight:500}}>{u.email}</td>
                          <td>
                            <select
                              value={u.role}
                              onChange={async e => {
                                try {
                                  await api.setUserRole(u.id, e.target.value);
                                  setUsers(prev => prev.map(x => x.id === u.id ? {...x, role:e.target.value} : x));
                                  toast('Role updated');
                                } catch(err) { toast(err.message, 'error'); }
                              }}
                              style={{background:'var(--card)', border:'1px solid var(--border2)', borderRadius:8, padding:'5px 10px', color:'var(--ink)', fontFamily:'inherit', fontSize:'0.82rem', cursor:'pointer'}}
                            >
                              <option value="admin">Admin</option>
                              <option value="staff">Staff</option>
                              <option value="user">User</option>
                            </select>
                          </td>
                          <td>
                            {u.disabled
                              ? <span className="badge badge-red">Inactive</span>
                              : <span className="badge badge-green">Active</span>}
                          </td>
                          <td style={{fontSize:'0.78rem', color:'var(--muted)'}}>{fmtTs(u.createdAt)}</td>
                          <td>
                            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                              <Btn
                                variant={u.disabled ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => toggleUserDisabled(u)}
                              >
                                {u.disabled ? '✓ Activate' : '⊘ Deactivate'}
                              </Btn>
                              <Btn
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResetPassword(u)}
                              >
                                ↺ Reset Password
                              </Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

        </main>
      </div>
    </>
  );
}
