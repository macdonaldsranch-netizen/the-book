import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup, GoogleAuthProvider, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
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
  .cal-grid { display:grid; grid-template-columns:70px 88px 1fr 1fr; border:1px solid var(--border); border-radius:14px; overflow:hidden; }
  .cal-header { font-size:0.73rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; padding:10px 14px; background:var(--card); border-bottom:1px solid var(--border); }
  .cal-time { font-size:0.78rem; font-weight:700; color:var(--accent); padding:10px 12px; border-bottom:1px solid var(--border); background:var(--card); display:flex; align-items:flex-start; }
  .cal-cell { padding:6px 10px; border-bottom:1px solid var(--border); border-left:1px solid var(--border); min-height:52px; vertical-align:top; }
  .cal-cell:empty::after { content:'—'; color:var(--muted); opacity:0.4; font-size:0.78rem; }
  .cal-totals-col { padding:6px 10px; border-bottom:1px solid var(--border); border-left:1px solid var(--border); min-height:52px; display:flex; flex-direction:column; justify-content:center; gap:5px; }
  .tot-chip { display:inline-flex; align-items:center; gap:4px; font-size:0.76rem; font-weight:700; white-space:nowrap; }
  .tot-chip .tot-num { font-size:0.88rem; }
  .tot-chip.tot-a { color:var(--accent2); }
  .tot-chip.tot-c { color:var(--accent3); }
  .day-totals-bar { display:flex; gap:18px; align-items:center; background:var(--card); border:1px solid var(--border); border-radius:10px; padding:8px 16px; margin-bottom:12px; font-size:0.82rem; }
  .day-totals-bar .dtb-label { font-weight:600; color:var(--muted); margin-right:4px; }
  .day-totals-bar .dtb-a { color:var(--accent2); font-weight:700; }
  .day-totals-bar .dtb-c { color:var(--accent3); font-weight:700; }
  .day-totals-bar .dtb-t { color:var(--accent);  font-weight:700; }
  .cal-res-pill { border:1px solid; border-radius:8px; padding:5px 9px; margin-bottom:4px; font-size:0.80rem; }
  .cal-res-pill.booked { background:rgba(255,107,107,0.08) !important; border-color:rgba(255,107,107,0.22) !important; }
  .cal-res-sentence { font-size:0.77rem; color:var(--muted); margin-top:2px; line-height:1.5; }
  .cal-note-pill { background:rgba(143,124,255,0.08); border:1px solid rgba(143,124,255,0.20); border-radius:8px; padding:5px 9px; margin-bottom:4px; font-size:0.80rem; }
  .attendance-btn { font-size:0.70rem; padding:2px 8px; border-radius:6px; border:1px solid var(--border2); background:transparent; cursor:pointer; margin-top:3px; font-family:inherit; color:var(--muted); }
  .attendance-btn.checked-in { background:rgba(92,230,154,0.12); color:var(--success); border-color:rgba(92,230,154,0.3); }
  .attendance-btn.no-show    { background:rgba(255,107,107,0.12); color:var(--danger);  border-color:rgba(255,107,107,0.3); }
  tr.cancelled td { opacity:0.5; text-decoration:line-through; }
  tr.cancelled td:last-child { text-decoration:none; opacity:1; }

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

  /* Activity log table */
  .act-table { width:100%; border-collapse:collapse; }
  .act-table th { text-align:left; font-size:0.74rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); padding:10px 14px; border-bottom:1px solid var(--border2); white-space:nowrap; }
  .act-table td { padding:10px 14px; border-bottom:1px solid var(--border); vertical-align:top; }
  .act-table tr:last-child td { border-bottom:none; }
  .act-table tr:hover td { background:rgba(128,128,128,0.04); }
  .act-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:6px; font-size:0.75rem; font-weight:600; white-space:nowrap; }
  .act-badge-res { background:rgba(97,243,211,0.12); color:var(--accent); }
  .act-badge-apt { background:rgba(143,124,255,0.12); color:var(--accent2); }
  .act-badge-sys { background:rgba(255,217,112,0.12); color:var(--warn); }
  .act-badge-usr { background:rgba(255,107,107,0.12); color:var(--danger); }
  .act-change { font-size:0.76rem; color:var(--muted); background:rgba(128,128,128,0.06); border-radius:4px; padding:1px 6px; }

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

  /* Slot availability panel */
  .slot-avail { border-radius:12px; padding:12px 14px; border:1px solid; transition:background 200ms, border-color 200ms; }
  .slot-avail-title { font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; opacity:0.7; margin-bottom:6px; }
  .slot-avail-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:8px; }
  .slot-avail-status { font-size:0.88rem; font-weight:700; }
  .slot-avail-count { font-size:0.82rem; font-weight:500; opacity:0.8; }
  .slot-avail-bar-track { height:7px; border-radius:99px; background:rgba(148,163,184,0.18); overflow:hidden; margin-bottom:8px; }
  .slot-avail-bar-fill  { height:100%; border-radius:99px; transition:width 250ms ease; }
  .slot-avail-chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
  .slot-avail-chip { font-size:0.73rem; padding:2px 8px; border-radius:6px; background:rgba(148,163,184,0.10); }
  .slot-avail-warning { margin-top:8px; padding:8px 10px; border-radius:8px; font-size:0.80rem; font-weight:600; display:flex; align-items:center; gap:6px; background:rgba(255,107,107,0.12); color:#ff6b6b; border:1px solid rgba(255,107,107,0.28); }
  .slot-avail.sa-open   { background:rgba(61,214,181,0.07); border-color:rgba(61,214,181,0.28); color:#3dd6b5; }
  .slot-avail.sa-busy   { background:rgba(255,154,60,0.08);  border-color:rgba(255,154,60,0.32);  color:#ff9a3c; }
  .slot-avail.sa-full   { background:rgba(255,107,107,0.08); border-color:rgba(255,107,107,0.30); color:#ff6b6b; }

  /* SMS compose */
  .tpl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px; margin-bottom:16px; }
  .tpl-btn { padding:10px 12px; border-radius:12px; border:1px solid var(--border2); background:transparent; color:var(--ink); cursor:pointer; font-family:inherit; font-size:0.82rem; text-align:left; transition:all 130ms; }
  .tpl-btn:hover { border-color:var(--accent); color:var(--accent); background:rgba(97,243,211,0.06); }
  .tpl-btn.active { border-color:var(--accent); background:rgba(97,243,211,0.10); color:var(--accent); }
  .tpl-btn-icon { font-size:1.1rem; margin-bottom:4px; display:block; }
  .msg-preview { padding:10px 14px; border-radius:10px; background:rgba(148,163,184,0.07); border:1px solid var(--border2); font-size:0.84rem; color:var(--muted); font-style:italic; line-height:1.5; white-space:pre-wrap; margin-top:4px; }
  .token-chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
  .token-chip { font-size:0.72rem; padding:2px 7px; border-radius:6px; border:1px dashed var(--border2); color:var(--muted); cursor:pointer; font-family:monospace; transition:all 100ms; }
  .token-chip:hover { border-color:var(--accent); color:var(--accent); background:rgba(97,243,211,0.06); }
  .recip-list { margin-top:12px; border:1px solid var(--border); border-radius:12px; overflow:hidden; }
  .recip-row { display:flex; align-items:center; gap:12px; padding:9px 14px; border-bottom:1px solid var(--border); font-size:0.84rem; }
  .recip-row:last-child { border-bottom:none; }
  .recip-name { font-weight:600; flex:1; }
  .recip-meta { color:var(--muted); font-size:0.78rem; }

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
    .cal-grid { grid-template-columns:54px 76px 1fr; }
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
  if (r.durationMinutes) parts.push(`${r.durationMinutes}-min ${r.rideType === 'Custom' && r.customRideType ? r.customRideType : (r.rideType || '')} ride`);
  if (r.depositAmount)   parts.push(`$${Number(r.depositAmount).toFixed(2)} deposit`);
  if (r.discountAmount)  parts.push(`-$${Number(r.discountAmount).toFixed(2)} discount${r.discountReason ? ` (${r.discountReason})` : ''}`);
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
  rideType:'Group', customRideType:'', firstName:'', lastName:'', phoneNumber:'',
  adultCount:1, childCount:0, childAges:'',
  depositAmount:'', discountAmount:'', discountReason:'', cardType:'', cardLast4:'',
  specialRequests:'', notes:'', guideCount:1,
  bookedToCapacity:false, textConfirmationStatus:'Pending',
  followUpStatus:'Pending', attendanceStatus:null, status:'active',
};

const RIDE_COLORS = {
  Group:      { bg:'rgba(97,243,211,0.09)',  border:'rgba(97,243,211,0.30)',  text:'#3dd6b5' },
  Private:    { bg:'rgba(143,124,255,0.10)', border:'rgba(143,124,255,0.32)', text:'#a394ff' },
  Sunset:     { bg:'rgba(255,160,60,0.10)',  border:'rgba(255,160,60,0.32)',  text:'#ff9a3c' },
  Moonlight:  { bg:'rgba(80,140,255,0.10)',  border:'rgba(80,140,255,0.30)',  text:'#7ab2ff' },
  Contract:   { bg:'rgba(92,230,154,0.10)',  border:'rgba(92,230,154,0.30)',  text:'#5ce69a' },
  Stagecoach: { bg:'rgba(200,150,60,0.12)',  border:'rgba(200,150,60,0.30)',  text:'#c8963c' },
  Hayride:    { bg:'rgba(255,210,60,0.10)',  border:'rgba(255,210,60,0.30)',  text:'#c8a000' },
  Train:      { bg:'rgba(255,100,100,0.10)', border:'rgba(255,100,100,0.30)', text:'#ff6464' },
  Custom:     { bg:'rgba(148,163,184,0.10)', border:'rgba(148,163,184,0.28)', text:'#8fa0b8' },
  Kids:       { bg:'rgba(97,243,211,0.09)',  border:'rgba(97,243,211,0.30)',  text:'#3dd6b5' },
  Pony:       { bg:'rgba(255,125,209,0.10)', border:'rgba(255,125,209,0.28)', text:'#ff7dd1' },
};
function rideStyle(type) { return RIDE_COLORS[type] || RIDE_COLORS.Group; }
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

// ─── Modal wrapper component ─────────────────────────────────────────────────
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

// ── SMS message templates ─────────────────────────────────────────────────────
const SMS_TEMPLATES = [
  {
    id: 'confirm',
    label: 'Booking Confirmation',
    icon: '✅',
    body: 'Hi {firstName}! Your {rideType} ride is confirmed for {reservationDate} at {startTime} ({totalRiders} riders). Confirmation: {confirmationNumber}. See you soon — MacDonald\'s Ranch!',
  },
  {
    id: 'reminder',
    label: 'Day-Before Reminder',
    icon: '🔔',
    body: 'Hi {firstName}, just a friendly reminder — your {rideType} ride is tomorrow at {startTime}. Please arrive 15 min early. Questions? Call us! Conf#: {confirmationNumber}.',
  },
  {
    id: 'weather',
    label: 'Weather / Delay Notice',
    icon: '⛅',
    body: 'Hi {firstName}, heads-up: we\'re monitoring weather conditions for your ride on {reservationDate} at {startTime}. We\'ll reach out if anything changes. Thank you for your patience!',
  },
  {
    id: 'cancelled',
    label: 'Cancellation Notice',
    icon: '❌',
    body: 'Hi {firstName}, unfortunately your {rideType} ride on {reservationDate} at {startTime} (Conf# {confirmationNumber}) has been cancelled. Please contact us to reschedule. Sorry for the inconvenience.',
  },
  {
    id: 'followup',
    label: 'Post-Ride Follow-Up',
    icon: '⭐',
    body: 'Hi {firstName}, thank you for joining us for the {rideType} ride! We hope you had a wonderful time. We\'d love a review — and hope to see you again soon! – MacDonald\'s Ranch',
  },
  {
    id: 'custom',
    label: 'Custom Message',
    icon: '✏️',
    body: '',
  },
];

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
  const [overrideCap,  setOverrideCap]  = useState(false);

  const [showInvite,      setShowInvite]      = useState(false);
  const [inviteForm,      setInviteForm]      = useState({ email:'', password:'', role:'staff' });
  const [showChangePass,  setShowChangePass]  = useState(false);
  const [changePassForm,  setChangePassForm]  = useState({ current:'', next:'', confirm:'' });
  const [showSetPass,     setShowSetPass]     = useState(null);  // user object being edited
  const [setPassVal,      setSetPassVal]      = useState('');
  const [users,        setUsers]        = useState([]);

  // ─ Messaging (SMS)
  const EMPTY_MSG = { recipientType:'date', date:today(), phone:'', time:'', timeFrom:'', timeTo:'', dateFrom:'', dateTo:'', message:'' };
  const [msgForm,      setMsgForm]      = useState({ ...EMPTY_MSG });
  const [msgSending,   setMsgSending]   = useState(false);
  const [showMsgModal, setShowMsgModal] = useState(false);   // quick-send from a reservation
  const [msgModalRes,  setMsgModalRes]  = useState(null);    // the reservation being messaged
  const [quickMsgTpl,  setQuickMsgTpl]  = useState('');      // selected template id
  const [quickMsgText, setQuickMsgText] = useState('');      // message text in quick-send modal

  // ─ Mobile sidebar
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  // ─ Activity log filters & view
  const [actSearch,     setActSearch]     = useState('');
  const [actActionType, setActActionType] = useState('All Actions');
  const [actDateFrom,   setActDateFrom]   = useState('');
  const [actDateTo,     setActDateTo]     = useState('');
  const [actViewMode,   setActViewMode]   = useState('table');   // 'table' | 'feed'
  const [actCategory,   setActCategory]   = useState('all');    // 'all' | 'reservations' | 'appointments' | 'system' | 'users'

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
  const todayRes = reservations.filter(r => r.reservationDate === todayStr && r.status !== 'cancelled');
  const todayRiders = todayRes.reduce((s, r) => s + (r.totalRiders || 0), 0);
  const calRes = reservations.filter(r => r.reservationDate === calDate && r.status !== 'cancelled')
                             .sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
  const calApt = appointments.filter(a => a.appointmentDate === calDate)
                             .sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
  const maxRiders = capacity?.maxRiders ?? 20;

  // ── Slot availability (reactive to resForm fields) ────────────────────────────
  const slotRes = (resForm.reservationDate && resForm.startTime)
    ? reservations.filter(r =>
        r.reservationDate === resForm.reservationDate &&
        r.startTime       === resForm.startTime &&
        r.status !== 'cancelled' &&
        r.id !== editingResId
      )
    : [];
  const slotBooked    = slotRes.reduce((s, r) => s + (r.totalRiders || 0), 0);
  const formRiders    = Number(resForm.adultCount || 0) + Number(resForm.childCount || 0);
  const slotProjected = slotBooked + formRiders;
  const slotFillPct   = Math.min(100, Math.round(slotBooked    / maxRiders * 100));
  const slotProjPct   = Math.min(100, Math.round(slotProjected / maxRiders * 100));
  const slotLevel     = slotProjected > maxRiders ? 'sa-full' : slotProjected >= maxRiders * 0.75 ? 'sa-busy' : 'sa-open';
  const slotBarColor  = slotLevel === 'sa-open' ? '#3dd6b5' : slotLevel === 'sa-busy' ? '#ff9a3c' : '#ff6b6b';
  const slotStatusTxt = slotLevel === 'sa-full' ? `⚠ Over capacity` : slotLevel === 'sa-busy' ? '⚡ Filling up' : '✓ Available';

  const filteredRes = reservations.filter(r => {
    if (!showCancelled && r.status === 'cancelled') return false;
    const q = search.toLowerCase();
    return !q || [r.firstName, r.lastName, r.phoneNumber, r.confirmationNumber, r.rideType]
      .some(v => v?.toLowerCase().includes(q));
  });
  const cancelledCount = reservations.filter(r => r.status === 'cancelled').length;

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
    setOverrideCap(false);
    setShowResForm(true);
  }
  function openEditRes(r) {
    setEditingResId(r.id);
    setResForm({ ...r });
    setOverrideCap(false);
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
      discountAmount:  Number(resForm.discountAmount || 0),
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

  // ── User management ───────────────────────────────────────────────────────────
  async function submitInvite(e) {
    e.preventDefault();
    if (!inviteForm.password || inviteForm.password.length < 6)
      return toast('Password must be at least 6 characters', 'error');
    try {
      await api.inviteUser(inviteForm);
      toast(`${inviteForm.email} added as ${inviteForm.role}`);
      setShowInvite(false);
      setInviteForm({ email:'', password:'', role:'staff' });
      api.listUsers().then(setUsers).catch(() => {});
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitSetPass(e) {
    e.preventDefault();
    if (!setPassVal || setPassVal.length < 6)
      return toast('Password must be at least 6 characters', 'error');
    try {
      await api.setUserPassword(showSetPass.id, setPassVal);
      toast(`Password updated for ${showSetPass.email}`);
      setShowSetPass(null);
      setSetPassVal('');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitChangePass(e) {
    e.preventDefault();
    if (changePassForm.next !== changePassForm.confirm)
      return toast('New passwords do not match', 'error');
    if (changePassForm.next.length < 6)
      return toast('Password must be at least 6 characters', 'error');
    try {
      // Re-authenticate first (Firebase requires recent login for password change)
      const credential = EmailAuthProvider.credential(fireUser.email, changePassForm.current);
      await reauthenticateWithCredential(fireUser, credential);
      await updatePassword(fireUser, changePassForm.next);
      toast('Password changed successfully');
      setShowChangePass(false);
      setChangePassForm({ current:'', next:'', confirm:'' });
    } catch (err) {
      const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Current password is incorrect'
        : err.message;
      toast(msg, 'error');
    }
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

  // ── SMS send handler ──────────────────────────────────────────────────
  async function submitMsg(e, overrideBody) {
    if (e) e.preventDefault();
    setMsgSending(true);
    try {
      const f = overrideBody || msgForm;
      const body = { message: f.message };
      if (f.recipientType === 'date')       { body.date = f.date; }
      if (f.recipientType === 'time')       { body.date = f.date; body.time = f.time; }
      if (f.recipientType === 'timerange')  { body.date = f.date; body.time_from = f.timeFrom; body.time_to = f.timeTo; }
      if (f.recipientType === 'daterange')  { body.date_from = f.dateFrom; body.date_to = f.dateTo; }
      if (f.recipientType === 'phone')      { body.to = f.phone; }
      if (f.recipientType === 'reservation'){ body.reservation_id = f.reservationId; }
      const r = await api.sendSms(body);
      const detail = r.skipped > 0 ? ` (${r.skipped} duplicate${r.skipped!==1?'s':''} skipped)` : '';
      if (r.failed > 0) toast(`⚠ Sent ${r.sent}, failed ${r.failed}${detail}`, 'error');
      else toast(`✅ Sent ${r.sent} message${r.sent !== 1 ? 's' : ''}${detail}`);
      if (!overrideBody) setMsgForm(f2 => ({ ...f2, message: '' }));
      else { setShowMsgModal(false); setMsgModalRes(null); }
    } catch(err) { toast(err.message, 'error'); }
    finally { setMsgSending(false); }
  }

  // ── Quick-send from a reservation ─────────────────────────────────────
  function openMsgForRes(r) {
    setMsgModalRes(r);
    setQuickMsgTpl('');
    setQuickMsgText('');
    setShowMsgModal(true);
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
                  {['Group','Private','Sunset','Moonlight','Contract','Stagecoach','Hayride','Train','Custom'].map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              {resForm.rideType === 'Custom' && (
                <Field label="Custom Ride Description" full>
                  <input value={resForm.customRideType} placeholder="Describe the ride type…" onChange={e => setResForm({...resForm, customRideType:e.target.value})} />
                </Field>
              )}
              <Field label="Date"><input type="date" required value={resForm.reservationDate} onChange={e => setResForm({...resForm, reservationDate:e.target.value})} /></Field>
              <Field label="Start Time">
                <select value={resForm.startTime} onChange={e => setResForm({...resForm, startTime:e.target.value})}>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
                </select>
              </Field>

              {/* ── Slot availability panel ── */}
              {resForm.reservationDate && resForm.startTime && (
                <div className={`slot-avail ${slotLevel}`} style={{gridColumn:'1/-1'}}>
                  <div className="slot-avail-title">Slot Availability</div>
                  <div className="slot-avail-row">
                    <span className="slot-avail-status">
                      {slotStatusTxt} — {fmtTime(resForm.startTime)}, {fmtDate(resForm.reservationDate)}
                    </span>
                    <span className="slot-avail-count">
                      {slotProjected} / {maxRiders} riders{formRiders > 0 && slotBooked > 0 ? ` (${slotBooked} existing + ${formRiders} this booking)` : formRiders > 0 ? ` (${formRiders} this booking)` : ''}
                    </span>
                  </div>
                  <div className="slot-avail-bar-track">
                    <div className="slot-avail-bar-fill" style={{width:`${slotProjPct}%`, background:slotBarColor}} />
                  </div>
                  {slotRes.length > 0 ? (
                    <div>
                      <div style={{fontSize:'0.76rem', opacity:0.7, marginBottom:4}}>Already booked at this time:</div>
                      <div className="slot-avail-chips">
                        {slotRes.map(r => (
                          <span key={r.id} className="slot-avail-chip" style={{color:'var(--muted)'}}>
                            {r.firstName} {r.lastName} · {r.rideType} · {r.totalRiders} rider{r.totalRiders !== 1 ? 's' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{fontSize:'0.78rem', opacity:0.65}}>No other bookings at this time — slot is open.</div>
                  )}
                  {slotProjected > maxRiders && (
                    <div className="slot-avail-warning">
                      ⚠️ This booking would exceed the {maxRiders}-rider daily capacity by {slotProjected - maxRiders}.
                      Check the box below to save anyway.
                    </div>
                  )}
                </div>
              )}
              <Field label="Duration (min)">
                <select value={resForm.durationMinutes} onChange={e => setResForm({...resForm, durationMinutes:Number(e.target.value)})}>
                  {[15,30,45,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </Field>
              <Field label="Adults"><input type="number" min={0} value={resForm.adultCount} onChange={e => setResForm({...resForm, adultCount:Number(e.target.value)})} /></Field>
              <Field label="Children"><input type="number" min={0} value={resForm.childCount} onChange={e => setResForm({...resForm, childCount:Number(e.target.value)})} /></Field>
              <Field label="Child Ages"><input value={resForm.childAges} placeholder="e.g. 6, 8, 10" onChange={e => setResForm({...resForm, childAges:e.target.value})} /></Field>
              <Field label="Deposit ($)"><input type="number" min={0} step="0.01" value={resForm.depositAmount} onChange={e => setResForm({...resForm, depositAmount:e.target.value})} /></Field>
              <Field label="Discount ($)"><input type="number" min={0} step="0.01" value={resForm.discountAmount} placeholder="0.00" onChange={e => setResForm({...resForm, discountAmount:e.target.value})} /></Field>
              <Field label="Discount Reason"><input value={resForm.discountReason} placeholder="e.g. Birthday, Returning guest…" onChange={e => setResForm({...resForm, discountReason:e.target.value})} /></Field>
              <Field label="Card Type">
                <select value={resForm.cardType} onChange={e => setResForm({...resForm, cardType:e.target.value})}>
                  {['','Visa','Mastercard','Amex','Discover','Cash','Check','Pay in Full','Comped'].map(c => <option key={c} value={c}>{c||'—'}</option>)}
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
            <div style={{marginTop:20}}>
              {slotProjected > maxRiders && (
                <label style={{display:'flex', alignItems:'center', gap:8, fontSize:'0.83rem', color:'#ff6b6b', fontWeight:600, marginBottom:12, cursor:'pointer'}}>
                  <input type="checkbox" checked={overrideCap} onChange={e => setOverrideCap(e.target.checked)}
                    style={{width:15, height:15, accentColor:'#ff6b6b'}} />
                  I understand this exceeds capacity — save anyway
                </label>
              )}
              <div style={{display:'flex', gap:10}}>
                <Btn type="submit" variant="primary"
                  disabled={slotProjected > maxRiders && !overrideCap}>
                  {editingResId ? 'Save Changes' : 'Create Reservation'}
                </Btn>
                <Btn onClick={() => { setShowResForm(false); setOverrideCap(false); }}>Cancel</Btn>
              </div>
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

      {/* Add staff user modal */}
      {showInvite && (
        <Modal title="Add Staff User" onClose={() => setShowInvite(false)}>
          <form onSubmit={submitInvite}>
            <div className="form-grid">
              <Field label="Email" full><input type="email" required autoComplete="off" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email:e.target.value})} /></Field>
              <Field label="Password"><input type="password" required minLength={6} autoComplete="new-password" value={inviteForm.password} placeholder="Min. 6 characters" onChange={e => setInviteForm({...inviteForm, password:e.target.value})} /></Field>
              <Field label="Role">
                <select value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role:e.target.value})}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="user">User (read-only)</option>
                </select>
              </Field>
            </div>
            <p style={{fontSize:'0.80rem', color:'var(--muted)', marginTop:10, marginBottom:0}}>The user can log in immediately with this email and password, and change their password any time after logging in.</p>
            <div style={{marginTop:16, display:'flex', gap:10}}>
              <Btn type="submit" variant="primary">Create Account</Btn>
              <Btn onClick={() => setShowInvite(false)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Admin: set password for another user */}
      {showSetPass && (
        <Modal title={`Set Password — ${showSetPass.email}`} onClose={() => { setShowSetPass(null); setSetPassVal(''); }}>
          <form onSubmit={submitSetPass}>
            <Field label="New Password">
              <input type="password" required minLength={6} autoComplete="new-password" value={setPassVal} placeholder="Min. 6 characters" onChange={e => setSetPassVal(e.target.value)} />
            </Field>
            <p style={{fontSize:'0.80rem', color:'var(--muted)', marginTop:10, marginBottom:0}}>The user can log in with this new password immediately.</p>
            <div style={{marginTop:16, display:'flex', gap:10}}>
              <Btn type="submit" variant="primary">Set Password</Btn>
              <Btn onClick={() => { setShowSetPass(null); setSetPassVal(''); }}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Current user: change own password */}
      {showChangePass && (
        <Modal title="Change My Password" onClose={() => { setShowChangePass(false); setChangePassForm({ current:'', next:'', confirm:'' }); }}>
          <form onSubmit={submitChangePass}>
            <div className="form-grid">
              <Field label="Current Password" full><input type="password" required autoComplete="current-password" value={changePassForm.current} onChange={e => setChangePassForm({...changePassForm, current:e.target.value})} /></Field>
              <Field label="New Password"><input type="password" required minLength={6} autoComplete="new-password" value={changePassForm.next} placeholder="Min. 6 characters" onChange={e => setChangePassForm({...changePassForm, next:e.target.value})} /></Field>
              <Field label="Confirm New Password"><input type="password" required minLength={6} autoComplete="new-password" value={changePassForm.confirm} onChange={e => setChangePassForm({...changePassForm, confirm:e.target.value})} /></Field>
            </div>
            <div style={{marginTop:16, display:'flex', gap:10}}>
              <Btn type="submit" variant="primary">Change Password</Btn>
              <Btn onClick={() => { setShowChangePass(false); setChangePassForm({ current:'', next:'', confirm:'' }); }}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick-send from a reservation */}
      {showMsgModal && msgModalRes && (
        <Modal title={`📲 Send Message — ${msgModalRes.firstName} ${msgModalRes.lastName}`}
               onClose={() => { setShowMsgModal(false); setMsgModalRes(null); setQuickMsgTpl(''); setQuickMsgText(''); }}>
          <div style={{marginBottom:12, fontSize:'0.85rem', color:'var(--muted)'}}>
            <strong>📞</strong>&nbsp;
            {msgModalRes.phoneNumber
              ? msgModalRes.phoneNumber
              : <span style={{color:'var(--danger)', fontWeight:600}}>⚠ No phone number on this reservation — cannot send SMS</span>}
            &nbsp;·&nbsp;{fmtTime(msgModalRes.startTime)} on {fmtDate(msgModalRes.reservationDate)}&nbsp;·&nbsp;{msgModalRes.rideType}
          </div>

          {/* Template picker */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:'0.75rem', color:'var(--muted)', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em'}}>Template</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {SMS_TEMPLATES.map(t => (
                <button key={t.id} type="button"
                  style={{padding:'5px 12px', borderRadius:8, border:'1px solid',
                    borderColor: quickMsgTpl === t.id ? 'var(--accent)' : 'var(--border2)',
                    background:  quickMsgTpl === t.id ? 'rgba(97,243,211,0.10)' : 'transparent',
                    color:       quickMsgTpl === t.id ? 'var(--accent)' : 'var(--ink)',
                    cursor:'pointer', fontFamily:'inherit', fontSize:'0.80rem'}}
                  onClick={() => {
                    setQuickMsgTpl(t.id);
                    setQuickMsgText(t.id === 'custom' ? '' : t.body);
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={async e => {
            e.preventDefault();
            if (!quickMsgText.trim()) return;
            setMsgSending(true);
            try {
              const fields = ['firstName','lastName','phoneNumber','confirmationNumber','rideType',
                'reservationDate','startTime','durationMinutes','adultCount','childCount','totalRiders','specialRequests'];
              const resolved = fields.reduce(
                (s, k) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), msgModalRes[k] ?? ''), quickMsgText
              );
              const res = await api.sendSms({ message: resolved, reservation_id: msgModalRes.id });
              if (res.failed > 0) toast('⚠ Message failed to send', 'error');
              else toast(`✅ Message sent to ${msgModalRes.firstName} ${msgModalRes.lastName}`);
              setShowMsgModal(false);
              setMsgModalRes(null);
              setQuickMsgTpl('');
              setQuickMsgText('');
            } catch(err) { toast(err.message, 'error'); }
            finally { setMsgSending(false); }
          }}>
            <Field label={`Message${quickMsgText ? ` (${quickMsgText.length} chars)` : ''}`} full>
              <textarea rows={5} required value={quickMsgText}
                placeholder="Pick a template above or type a message…"
                onChange={e => setQuickMsgText(e.target.value)} />
            </Field>

            {/* Live preview with this guest's data */}
            {quickMsgText && msgModalRes && (
              <Field label="Preview (with this guest's data)" full>
                <div className="msg-preview">
                  {['firstName','lastName','phoneNumber','confirmationNumber','rideType',
                    'reservationDate','startTime','durationMinutes','adultCount','childCount','totalRiders','specialRequests']
                    .reduce((s, k) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), msgModalRes[k] ?? ''), quickMsgText)}
                </div>
              </Field>
            )}

            <div style={{marginTop:16, display:'flex', gap:10}}>
              <Btn type="submit" variant="primary"
                disabled={msgSending || !quickMsgText.trim() || !msgModalRes.phoneNumber}>
                {msgSending ? 'Sending…' : '📲 Send'}
              </Btn>
              <Btn type="button" onClick={() => { setShowMsgModal(false); setMsgModalRes(null); setQuickMsgTpl(''); setQuickMsgText(''); }}>
                Cancel
              </Btn>
            </div>
          </form>
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
              onClick={() => setShowChangePass(true)}
              style={{padding:'8px 12px', background:'transparent', border:'1px solid var(--border2)', borderRadius:6, color:'var(--muted)', cursor:'pointer', fontSize:12, textAlign:'left', fontFamily:'inherit'}}
            >
              🔑 Change Password
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
                      <div key={r.id} className="board-card" style={{borderLeft:`3px solid ${rideStyle(r.rideType).border}`}}>
                        <div className="board-time">{fmtTime(r.startTime)}</div>
                        <div className="board-body">
                          <div className="board-title">{r.firstName} {r.lastName}</div>
                          <div className="board-sentence">{resSentence(r)}</div>
                        </div>
                        <span className="badge" style={{background:rideStyle(r.rideType).bg, borderColor:rideStyle(r.rideType).border, color:rideStyle(r.rideType).text, border:'1px solid'}}>
                          {r.rideType}{r.rideType === 'Custom' && r.customRideType ? `: ${r.customRideType}` : ''}
                        </span>
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
                {cancelledCount > 0 && (
                  <button onClick={() => setShowCancelled(v => !v)} style={{background:'transparent', border:'1px solid var(--border2)', borderRadius:8, padding:'5px 12px', fontSize:'0.78rem', cursor:'pointer', color: showCancelled ? 'var(--danger)' : 'var(--muted)', fontFamily:'inherit'}}>
                    {showCancelled ? '✕ Hide Cancelled' : `Show Cancelled (${cancelledCount})`}
                  </button>
                )}
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
                        <tr key={r.id} className={r.status === 'cancelled' ? 'cancelled' : ''}>
                          <td><Badge color="teal">{r.confirmationNumber}</Badge></td>
                          <td className="td-name"><strong>{r.firstName} {r.lastName}</strong><small>{r.phoneNumber}</small></td>
                          <td>{fmtDate(r.reservationDate)}</td>
                          <td>{fmtTime(r.startTime)}</td>
                          <td>{r.totalRiders}</td>
                          <td>
                            <span className="badge" style={{background:rideStyle(r.rideType).bg, borderColor:rideStyle(r.rideType).border, color:rideStyle(r.rideType).text, border:'1px solid'}}>
                              {r.rideType}{r.rideType === 'Custom' && r.customRideType ? `: ${r.customRideType}` : ''}
                            </span>
                          </td>
                          <td>
                            {r.status !== 'cancelled' ? (
                              <button className={`attendance-btn ${r.attendanceStatus||''}`} onClick={() => cycleAttendance(r)}>
                                {attendanceLabel(r.attendanceStatus)}
                              </button>
                            ) : <span style={{fontSize:'0.75rem', color:'var(--danger)', fontWeight:600}}>Cancelled</span>}
                          </td>
                          <td style={{maxWidth:280, fontSize:'0.77rem', color:'var(--muted)'}}>{resSentence(r)}</td>
                          <td>
                            <div className="td-actions">
                              {r.status !== 'cancelled' && <Btn variant="ghost" size="sm" onClick={() => openEditRes(r)}>Edit</Btn>}
                              <Btn variant="ghost" size="sm" onClick={() => openMsgForRes(r)}>📲</Btn>
                              {isAdmin && r.status !== 'cancelled' && <Btn variant="danger" size="sm" onClick={() => deleteRes(r.id)}>Cancel</Btn>}
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

              {/* Day totals summary bar */}
              {calRes.length > 0 && (() => {
                const dayAdults   = calRes.reduce((s, r) => s + (r.adultCount  || 0), 0);
                const dayChildren = calRes.reduce((s, r) => s + (r.childCount  || 0), 0);
                return (
                  <div className="day-totals-bar">
                    <span><span className="dtb-label">Day total —</span></span>
                    <span><span className="dtb-label">Adults:</span><span className="dtb-a"> {dayAdults}</span></span>
                    <span><span className="dtb-label">Children:</span><span className="dtb-c"> {dayChildren}</span></span>
                    <span><span className="dtb-label">Riders:</span><span className="dtb-t"> {dayAdults + dayChildren}</span></span>
                    <span style={{color:'var(--muted)', fontSize:'0.78rem'}}>across {calRes.length} reservation{calRes.length !== 1 ? 's' : ''}</span>
                  </div>
                );
              })()}

              {/* Time-slot grid — matches the paper copy layout */}
              <div className="cal-grid">
                          <div className="cal-header">Time</div>
                <div className="cal-header">Totals</div>
                <div className="cal-header">Reservations</div>
                <div className="cal-header cal-staff-col">Staff / Notes</div>

                {TIME_SLOTS.map(slot => {
                  const slotRes = calRes.filter(r => r.startTime === slot);
                  const slotApt = calApt.filter(a => a.startTime === slot);
                  if (slotRes.length === 0 && slotApt.length === 0) return null;
                  const totalAdults   = slotRes.reduce((s, r) => s + (r.adultCount  || 0), 0);
                  const totalChildren = slotRes.reduce((s, r) => s + (r.childCount  || 0), 0);
                  return (
                    <React.Fragment key={slot}>
                      <div className="cal-time">{fmtTime(slot)}</div>
                      <div className="cal-totals-col">
                        {slotRes.length > 0 && <>
                          <span className="tot-chip tot-a"><span className="tot-num">{totalAdults}</span> adults</span>
                          <span className="tot-chip tot-c"><span className="tot-num">{totalChildren}</span> children</span>
                        </>}
                      </div>
                      <div className="cal-cell">
                        {slotRes.map(r => (
                          <div key={r.id} className={`cal-res-pill${r.bookedToCapacity?' booked':''}`}
                            style={{background:rideStyle(r.rideType).bg, borderColor:rideStyle(r.rideType).border}}>
                            <strong>{r.firstName} {r.lastName}</strong>
                            <span style={{marginLeft:6, fontSize:'0.70rem', fontWeight:600, color:rideStyle(r.rideType).text}}>{r.rideType}{r.rideType==='Custom'&&r.customRideType?`: ${r.customRideType}`:''}</span>
                            <div className="cal-res-sentence">{resSentence(r)}</div>
                            <button className={`attendance-btn ${r.attendanceStatus||''}`} onClick={() => cycleAttendance(r)}>
                              {attendanceLabel(r.attendanceStatus)}
                            </button>
                            {r.phoneNumber && (
                              <button style={{marginLeft:6, fontSize:'0.72rem', background:'transparent', border:'none', cursor:'pointer', color:'var(--accent)', padding:'2px 4px'}}
                                onClick={() => openMsgForRes(r)}
                                title={`Send message to ${r.firstName}`}>📲</button>
                            )}
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
          {view === 'messages' && (() => {
            // ── helpers ──────────────────────────────────────────────────────
            function resolvePreview(text, r) {
              if (!r) return text;
              const fields = {firstName:'', lastName:'', phoneNumber:'', confirmationNumber:'', rideType:'',
                reservationDate:'', startTime:'', durationMinutes:'', adultCount:'', childCount:'',
                totalRiders:'', specialRequests:'', guideCount:''};
              return Object.keys(fields).reduce(
                (s, k) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), r[k] ?? ''), text
              );
            }
            // compute recipients list for preview
            function getRecipients() {
              if (msgForm.recipientType === 'date' && msgForm.date) {
                return reservations.filter(r => r.reservationDate === msgForm.date && r.status !== 'cancelled');
              }
              if (msgForm.recipientType === 'time' && msgForm.date && msgForm.time) {
                return reservations.filter(r => r.reservationDate === msgForm.date && r.startTime === msgForm.time && r.status !== 'cancelled');
              }
              if (msgForm.recipientType === 'timerange' && msgForm.date && msgForm.timeFrom && msgForm.timeTo) {
                return reservations.filter(r =>
                  r.reservationDate === msgForm.date && r.status !== 'cancelled'
                  && msgForm.timeFrom <= (r.startTime || '') && (r.startTime || '') <= msgForm.timeTo
                );
              }
              if (msgForm.recipientType === 'daterange' && msgForm.dateFrom && msgForm.dateTo) {
                return reservations.filter(r => r.reservationDate >= msgForm.dateFrom && r.reservationDate <= msgForm.dateTo && r.status !== 'cancelled');
              }
              return [];
            }
            const recipientList = getRecipients();
            const reachable = recipientList.filter(r => r.phoneNumber);
            const unreachable = recipientList.filter(r => !r.phoneNumber);
            const previewRes = reachable[0] || null;
            const ALL_TOKENS = ['firstName','lastName','phoneNumber','confirmationNumber','rideType',
              'reservationDate','startTime','totalRiders','adultCount','childCount','specialRequests'];

            return (
              <>
                <div className="page-title">
                  📲 Messages
                  <span>Send SMS to guests via Twilio</span>
                </div>

                {/* ── Template Picker ────────────────────────────────────── */}
                <Card title="Message Template" style={{marginBottom:16}}>
                  <div className="tpl-grid">
                    {SMS_TEMPLATES.map(t => (
                      <button key={t.id} type="button"
                        className={`tpl-btn${msgForm.message === t.body && t.id !== 'custom' ? ' active' : ''}`}
                        onClick={() => {
                          if (t.id !== 'custom') setMsgForm(f => ({ ...f, message: t.body }));
                          else setMsgForm(f => ({ ...f, message: '' }));
                        }}>
                        <span className="tpl-btn-icon">{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div style={{fontSize:'0.76rem', color:'var(--muted)', marginBottom:4}}>
                    Available tokens — click to insert at cursor:
                  </div>
                  <div className="token-chips" id="msg-token-chips">
                    {ALL_TOKENS.map(tk => (
                      <span key={tk} className="token-chip"
                        onClick={() => {
                          const ta = document.getElementById('msg-textarea');
                          if (!ta) { setMsgForm(f => ({ ...f, message: (f.message || '') + `{${tk}}` })); return; }
                          const s = ta.selectionStart, e2 = ta.selectionEnd;
                          const val = ta.value;
                          const next = val.slice(0,s) + `{${tk}}` + val.slice(e2);
                          setMsgForm(f => ({ ...f, message: next }));
                          setTimeout(() => { ta.focus(); ta.setSelectionRange(s + tk.length + 2, s + tk.length + 2); }, 0);
                        }}>
                        {`{${tk}}`}
                      </span>
                    ))}
                  </div>
                </Card>

                {/* ── Compose ────────────────────────────────────────────── */}
                <Card title="Compose & Send">
                  <form onSubmit={submitMsg}>
                    <div className="form-grid">
                      {/* Recipient type */}
                      <Field label="Send To" full>
                        <select value={msgForm.recipientType}
                          onChange={e => setMsgForm(f => ({ ...f, recipientType: e.target.value }))}>
                          <option value="date">All reservations on a date</option>
                          <option value="time">All reservations on a date at a specific time</option>
                          <option value="timerange">All reservations on a date within a time range</option>
                          <option value="daterange">All reservations in a date range</option>
                          <option value="phone">Specific phone number</option>
                        </select>
                      </Field>

                      {/* Date selector (used by date, time, timerange types) */}
                      {(msgForm.recipientType === 'date' || msgForm.recipientType === 'time' || msgForm.recipientType === 'timerange') && (
                        <Field label="Date">
                          <input type="date" required value={msgForm.date}
                            onChange={e => setMsgForm(f => ({ ...f, date: e.target.value }))} />
                        </Field>
                      )}
                      {/* Specific time */}
                      {msgForm.recipientType === 'time' && (
                        <Field label="Time">
                          <select required value={msgForm.time}
                            onChange={e => setMsgForm(f => ({ ...f, time: e.target.value }))}>
                            <option value="">Select time…</option>
                            {TIME_SLOTS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
                          </select>
                        </Field>
                      )}
                      {/* Time range */}
                      {msgForm.recipientType === 'timerange' && (
                        <>
                          <Field label="From Time">
                            <select required value={msgForm.timeFrom}
                              onChange={e => setMsgForm(f => ({ ...f, timeFrom: e.target.value }))}>
                              <option value="">Select…</option>
                              {TIME_SLOTS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
                            </select>
                          </Field>
                          <Field label="To Time">
                            <select required value={msgForm.timeTo}
                              onChange={e => setMsgForm(f => ({ ...f, timeTo: e.target.value }))}>
                              <option value="">Select…</option>
                              {TIME_SLOTS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
                            </select>
                          </Field>
                        </>
                      )}
                      {/* Date range */}
                      {msgForm.recipientType === 'daterange' && (
                        <>
                          <Field label="From Date">
                            <input type="date" required value={msgForm.dateFrom}
                              onChange={e => setMsgForm(f => ({ ...f, dateFrom: e.target.value }))} />
                          </Field>
                          <Field label="To Date">
                            <input type="date" required value={msgForm.dateTo}
                              onChange={e => setMsgForm(f => ({ ...f, dateTo: e.target.value }))} />
                          </Field>
                        </>
                      )}
                      {/* Phone */}
                      {msgForm.recipientType === 'phone' && (
                        <Field label="Phone Number">
                          <input type="tel" required placeholder="+15550001234"
                            value={msgForm.phone}
                            onChange={e => setMsgForm(f => ({ ...f, phone: e.target.value }))} />
                        </Field>
                      )}

                      {/* Message textarea */}
                      <Field label={`Message${msgForm.message ? ` (${msgForm.message.length} chars)` : ''}`} full>
                        <textarea id="msg-textarea" required rows={5}
                          placeholder="Type a message or pick a template above…"
                          value={msgForm.message}
                          onChange={e => setMsgForm(f => ({ ...f, message: e.target.value }))}
                        />
                        {msgForm.message.length > 160 && (
                          <div style={{fontSize:'0.77rem', color:'var(--warning, #ff9a3c)', marginTop:4}}>
                            ⚠ Over 160 chars — this will be sent as {Math.ceil(msgForm.message.length / 153)} parts
                          </div>
                        )}
                      </Field>

                      {/* Live preview with first recipient's data */}
                      {msgForm.message && (
                        <Field label="Message Preview" full>
                          <div className="msg-preview">
                            {resolvePreview(msgForm.message, previewRes || {})}
                          </div>
                          {previewRes && (
                            <div style={{fontSize:'0.75rem', color:'var(--muted)', marginTop:4}}>
                              Preview shown with data from {previewRes.firstName} {previewRes.lastName}
                            </div>
                          )}
                        </Field>
                      )}
                    </div>

                    <div style={{marginTop:16, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
                      <Btn type="submit" variant="primary" disabled={msgSending || !msgForm.message.trim()}>
                        {msgSending ? 'Sending…' : `📲 Send${reachable.length > 0 ? ` to ${reachable.length} recipient${reachable.length!==1?'s':''}` : ' SMS'}`}
                      </Btn>
                      <Btn type="button" variant="ghost" onClick={() => setMsgForm({ ...EMPTY_MSG })}>
                        Clear
                      </Btn>
                      <span style={{fontSize:'0.78rem', color:'var(--muted)'}}>
                        Sent via Twilio · guests can reply STOP to opt out
                      </span>
                    </div>
                  </form>
                </Card>

                {/* ── Recipient Preview ──────────────────────────────────── */}
                {recipientList.length > 0 && (
                  <Card title={`Recipients (${reachable.length} reachable${unreachable.length > 0 ? `, ${unreachable.length} no phone` : ''})`} style={{marginTop:16}}>
                    <div className="recip-list">
                      {reachable.map(r => (
                        <div key={r.id} className="recip-row">
                          <span className="recip-name">{r.firstName} {r.lastName}</span>
                          <span className="recip-meta">{fmtTime(r.startTime)} · {r.rideType}</span>
                          <span className="recip-meta">{r.phoneNumber}</span>
                          <Badge color="green">✓ Reachable</Badge>
                        </div>
                      ))}
                      {unreachable.map(r => (
                        <div key={r.id} className="recip-row" style={{opacity:0.55}}>
                          <span className="recip-name">{r.firstName} {r.lastName}</span>
                          <span className="recip-meta">{fmtTime(r.startTime)} · {r.rideType}</span>
                          <span className="recip-meta">—</span>
                          <Badge color="red">✗ No phone</Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            );
          })()}

          {/* ── ACTIVITY LOG ── */}
          {view === 'activity' && (() => {
            const ACTION_TYPES = [
              'All Actions',
              'Reservation created', 'Reservation updated', 'Reservation cancelled', 'Reservation deleted',
              'Attendance updated',
              'Appointment added', 'Appointment updated', 'Appointment deleted',
              'Capacity updated', 'Settings updated',
              'User invited', 'Role updated', 'User activated', 'User deactivated',
              'Password reset link generated',
            ];

            const CATEGORY_ACTIONS = {
              all:          null,
              reservations: ['Reservation created', 'Reservation updated', 'Reservation cancelled', 'Reservation deleted', 'Attendance updated'],
              appointments: ['Appointment added', 'Appointment updated', 'Appointment deleted'],
              system:       ['Capacity updated', 'Settings updated'],
              users:        ['User invited', 'Role updated', 'User activated', 'User deactivated', 'Password reset link generated'],
            };

            const ACTION_ICONS = {
              'Reservation created':   '📋',
              'Reservation updated':   '✏️',
              'Reservation cancelled': '🚫',
              'Reservation deleted':   '🗑️',
              'Attendance updated':    '✅',
              'Appointment added':     '📅',
              'Appointment updated':   '✏️',
              'Appointment deleted':   '🗑️',
              'Capacity updated':      '🔢',
              'Settings updated':      '⚙️',
              'User invited':          '👤',
              'Role updated':          '🔑',
              'User activated':        '✓',
              'User deactivated':      '⊘',
              'Password reset link generated': '🔒',
            };

            const actionCatColor = (action) => {
              if (!action) return 'usr';
              if (action.startsWith('Reservation') || action === 'Attendance updated') return 'res';
              if (action.startsWith('Appointment')) return 'apt';
              if (action === 'Capacity updated' || action === 'Settings updated') return 'sys';
              return 'usr';
            };

            // Detail format: "TB-001 — Name on date | Field: old→new; Field2: old2→new2"
            const parseDetail = (detail) => {
              if (!detail) return { base: '', changes: [] };
              const idx = detail.indexOf(' | ');
              if (idx === -1) return { base: detail, changes: [] };
              return {
                base:    detail.slice(0, idx),
                changes: detail.slice(idx + 3).split('; ').filter(Boolean),
              };
            };

            const catActions = CATEGORY_ACTIONS[actCategory];
            const filtered = activity.filter(a => {
              if (catActions && !catActions.includes(a.action)) return false;
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

            const CATS = [
              { key:'all',          label:'All' },
              { key:'reservations', label:'Reservations' },
              { key:'appointments', label:'Appointments' },
              { key:'system',       label:'System' },
              { key:'users',        label:'Users' },
            ];

            return (
              <>
                <div className="page-title">
                  Activity Log
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    <span style={{fontSize:'0.8rem', color:'var(--muted)', fontWeight:400}}>{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
                    <div style={{display:'flex', border:'1px solid var(--border2)', borderRadius:8, overflow:'hidden'}}>
                      <button onClick={() => setActViewMode('table')} style={{padding:'5px 12px', fontSize:'0.78rem', fontWeight:600, fontFamily:'inherit', border:'none', cursor:'pointer', background: actViewMode==='table' ? 'var(--accent)' : 'transparent', color: actViewMode==='table' ? '#071420' : 'var(--muted)'}}>
                        ⊞ Table
                      </button>
                      <button onClick={() => setActViewMode('feed')} style={{padding:'5px 12px', fontSize:'0.78rem', fontWeight:600, fontFamily:'inherit', border:'none', cursor:'pointer', background: actViewMode==='feed' ? 'var(--accent)' : 'transparent', color: actViewMode==='feed' ? '#071420' : 'var(--muted)'}}>
                        ☰ Feed
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category tabs */}
                <div style={{display:'flex', gap:6, marginBottom:12, flexWrap:'wrap'}}>
                  {CATS.map(c => (
                    <button key={c.key} onClick={() => { setActCategory(c.key); setActActionType('All Actions'); }}
                      style={{padding:'5px 14px', borderRadius:20, fontSize:'0.80rem', fontWeight:600, fontFamily:'inherit', cursor:'pointer', border:'1px solid', borderColor: actCategory===c.key ? 'var(--accent)' : 'var(--border2)', background: actCategory===c.key ? 'rgba(97,243,211,0.12)' : 'transparent', color: actCategory===c.key ? 'var(--accent)' : 'var(--muted)', transition:'all 130ms'}}>
                      {c.label}
                    </button>
                  ))}
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
                    {actCategory === 'all' && (
                      <select
                        className="pill-select"
                        value={actActionType}
                        onChange={e => setActActionType(e.target.value)}
                        style={{flex:1, minWidth:180}}
                      >
                        {ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    )}
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
                  : actViewMode === 'table'
                    ? (
                        <Card style={{padding:0, overflow:'hidden'}}>
                          <div className="tbl-wrap">
                            <table className="act-table">
                              <thead>
                                <tr>
                                  <th style={{width:150}}>Date &amp; Time</th>
                                  <th style={{width:200}}>Action</th>
                                  <th>Detail</th>
                                  <th style={{width:260}}>Changes</th>
                                  <th style={{width:170}}>Staff</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.map(a => {
                                  const { base, changes } = parseDetail(a.detail);
                                  const cat = actionCatColor(a.action);
                                  return (
                                    <tr key={a.id}>
                                      <td style={{fontSize:'0.78rem', color:'var(--muted)', whiteSpace:'nowrap'}}>
                                        {fmtTs(a.timestamp)}
                                      </td>
                                      <td>
                                        <span className={`act-badge act-badge-${cat}`}>
                                          {ACTION_ICONS[a.action] || '•'} {a.action}
                                        </span>
                                      </td>
                                      <td style={{fontSize:'0.83rem'}}>
                                        {base || a.detail}
                                      </td>
                                      <td>
                                        {changes.length > 0
                                          ? <div style={{display:'flex', flexDirection:'column', gap:3}}>
                                              {changes.map((c, i) => (
                                                <span key={i} className="act-change">{c}</span>
                                              ))}
                                            </div>
                                          : <span style={{color:'var(--border2)', fontSize:'0.75rem'}}>—</span>
                                        }
                                      </td>
                                      <td style={{fontSize:'0.78rem', color:'var(--muted)'}}>{a.actor || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                      )
                    : (
                        filtered.map(a => (
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
                      )
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
                                onClick={() => { setShowSetPass(u); setSetPassVal(''); }}
                              >
                                🔑 Set Password
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
