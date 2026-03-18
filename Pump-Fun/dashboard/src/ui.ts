/**
 * NemoClaw Operations Dashboard — Server-rendered SPA
 *
 * Full operations dashboard with:
 * - System overview (wallet, RPC, model, sandbox)
 * - Service health cards with real-time status
 * - Process management (start/stop/restart)
 * - Live log viewer with stream filtering
 * - Real-time event feed via SSE
 */

import type { DashboardConfig } from './config.js';

export function renderDashboard(config: DashboardConfig): string {
  const maskedRpc = config.solanaRpcUrl.replace(/api-key=[^&]+/, 'api-key=***');
  const shortWallet = config.walletAddress
    ? `${config.walletAddress.slice(0, 4)}...${config.walletAddress.slice(-4)}`
    : 'not set';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NemoClaw Dashboard</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0f;--bg2:#101018;--bg3:#16161f;--bg4:#1e1e2a;--bg5:#262636;
  --border:#252535;--border2:#353550;
  --text:#e0e0f0;--text2:#9090b0;--text3:#606080;
  --accent:#7c5cfc;--accent2:#9b7cff;--accent-glow:rgba(124,92,252,0.12);
  --green:#22c55e;--green-bg:rgba(34,197,94,0.1);
  --red:#ef4444;--red-bg:rgba(239,68,68,0.1);
  --yellow:#eab308;--yellow-bg:rgba(234,179,8,0.1);
  --blue:#3b82f6;--blue-bg:rgba(59,130,246,0.1);
  --orange:#f97316;
  --radius:10px;--radius-sm:6px;
  --shadow:0 2px 16px rgba(0,0,0,0.3);
  --font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  --mono:'SF Mono','Cascadia Code','Fira Code','Menlo',monospace;
}
html{font-family:var(--font);background:var(--bg);color:var(--text);font-size:13px;line-height:1.5}
body{min-height:100vh;overflow-x:hidden}
a{color:var(--accent2);text-decoration:none}
button{font-family:var(--font);cursor:pointer;border:none;border-radius:var(--radius-sm);font-size:12px}
input,select{font-family:var(--font);font-size:12px;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;outline:none}
input:focus,select:focus{border-color:var(--accent)}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--border2)}

/* ── Layout ──────────────────────────────────────────── */
.app{display:grid;grid-template-rows:auto 1fr;min-height:100vh}
.header{
  background:var(--bg2);border-bottom:1px solid var(--border);
  padding:12px 20px;display:flex;align-items:center;gap:14px;
  position:sticky;top:0;z-index:100;backdrop-filter:blur(12px);
}
.header h1{font-size:16px;font-weight:700;letter-spacing:-.3px}
.header h1 .claw{color:var(--accent2)}
.header .tag{font-size:10px;padding:2px 8px;border-radius:8px;background:var(--accent-glow);color:var(--accent2);font-weight:600;letter-spacing:.5px}
.header .spacer{flex:1}
.header .conn{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2)}
.header .conn .dot{width:7px;height:7px;border-radius:50%;background:var(--text3);transition:background .3s}
.header .conn .dot.live{background:var(--green);box-shadow:0 0 6px rgba(34,197,94,0.4);animation:pulse 2s infinite}
.header .btn{padding:5px 12px;background:var(--bg4);color:var(--text2);border:1px solid var(--border);transition:all .15s}
.header .btn:hover{background:var(--bg5);color:var(--text);border-color:var(--accent)}

@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes fadeIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}

.main{display:grid;grid-template-columns:1fr 340px;overflow:hidden;height:calc(100vh - 48px)}
@media(max-width:1024px){.main{grid-template-columns:1fr;grid-template-rows:1fr 320px}}

/* ── Left: Content ───────────────────────────────────── */
.content{overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:20px}

/* System info bar */
.sys-bar{display:flex;flex-wrap:wrap;gap:8px}
.sys-chip{
  display:flex;align-items:center;gap:6px;
  padding:6px 12px;background:var(--bg2);border:1px solid var(--border);
  border-radius:20px;font-size:11px;color:var(--text2);white-space:nowrap;
}
.sys-chip .label{color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-size:10px}
.sys-chip .val{color:var(--text);font-family:var(--mono);font-weight:500}
.sys-chip.ok .val{color:var(--green)}
.sys-chip.warn .val{color:var(--yellow)}

/* Stats row */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.stat{
  background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
  padding:14px;display:flex;flex-direction:column;gap:2px;transition:border-color .2s;
}
.stat:hover{border-color:var(--border2)}
.stat .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);font-weight:600}
.stat .val{font-size:24px;font-weight:700;font-family:var(--mono)}
.stat .sub{font-size:10px;color:var(--text2)}
.stat.green .val{color:var(--green)}
.stat.red .val{color:var(--red)}
.stat.yellow .val{color:var(--yellow)}
.stat.blue .val{color:var(--blue)}

/* Section */
.section{display:flex;flex-direction:column;gap:10px}
.section-hdr{display:flex;align-items:center;gap:10px}
.section-hdr h2{font-size:13px;font-weight:600;color:var(--text)}
.section-hdr .cnt{font-size:10px;padding:2px 8px;border-radius:8px;background:var(--bg3);color:var(--text2)}

/* Process cards */
.procs{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px}
.proc{
  background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
  padding:14px;display:flex;flex-direction:column;gap:8px;
  transition:all .2s;position:relative;overflow:hidden;
}
.proc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--border);transition:background .3s}
.proc.running::before{background:var(--green)}
.proc.starting::before{background:var(--yellow);animation:pulse 1s infinite}
.proc.crashed::before{background:var(--red)}
.proc.stopped::before{background:var(--text3)}
.proc:hover{border-color:var(--border2);box-shadow:var(--shadow)}

.proc .top{display:flex;align-items:center;gap:8px}
.proc .icon{width:32px;height:32px;border-radius:var(--radius-sm);display:grid;place-items:center;font-size:16px;background:var(--bg4)}
.proc .name{font-weight:600;font-size:13px;flex:1}
.proc .badge{
  font-size:10px;padding:2px 8px;border-radius:8px;
  font-weight:600;text-transform:uppercase;letter-spacing:.4px;
}
.proc.running .badge{background:var(--green-bg);color:var(--green)}
.proc.starting .badge{background:var(--yellow-bg);color:var(--yellow)}
.proc.crashed .badge{background:var(--red-bg);color:var(--red)}
.proc.stopped .badge{background:var(--bg4);color:var(--text3)}
.proc.stopping .badge{background:var(--yellow-bg);color:var(--yellow)}

.proc .desc{font-size:11px;color:var(--text2);line-height:1.4}
.proc .meta{
  display:flex;gap:12px;font-size:10px;color:var(--text3);
  border-top:1px solid var(--border);padding-top:6px;font-family:var(--mono);
}
.proc .actions{display:flex;gap:4px;margin-top:2px}
.proc .actions button{
  padding:4px 10px;font-size:10px;font-weight:600;
  border:1px solid var(--border);background:var(--bg4);color:var(--text2);
  transition:all .15s;
}
.proc .actions button:hover{background:var(--bg5);color:var(--text);border-color:var(--accent)}
.proc .actions button.start{color:var(--green);border-color:rgba(34,197,94,0.3)}
.proc .actions button.start:hover{background:var(--green-bg);border-color:var(--green)}
.proc .actions button.stop{color:var(--red);border-color:rgba(239,68,68,0.3)}
.proc .actions button.stop:hover{background:var(--red-bg);border-color:var(--red)}
.proc .actions button.logs{color:var(--blue);border-color:rgba(59,130,246,0.3)}
.proc .actions button.logs:hover{background:var(--blue-bg);border-color:var(--blue)}

/* Service health cards */
.svcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.svc{
  background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
  padding:12px;display:flex;flex-direction:column;gap:6px;transition:all .2s;
  position:relative;overflow:hidden;
}
.svc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;transition:background .3s}
.svc.healthy::before{background:var(--green)}
.svc.degraded::before{background:var(--yellow)}
.svc.down::before{background:var(--red)}
.svc.unknown::before{background:var(--text3)}
.svc:hover{border-color:var(--border2)}
.svc .svc-top{display:flex;align-items:center;gap:6px}
.svc .svc-name{font-weight:600;font-size:12px;flex:1}
.svc .svc-status{font-size:9px;padding:2px 6px;border-radius:6px;font-weight:600;text-transform:uppercase}
.svc.healthy .svc-status{background:var(--green-bg);color:var(--green)}
.svc.degraded .svc-status{background:var(--yellow-bg);color:var(--yellow)}
.svc.down .svc-status{background:var(--red-bg);color:var(--red)}
.svc.unknown .svc-status{background:var(--bg4);color:var(--text3)}
.svc .svc-desc{font-size:10px;color:var(--text2)}
.svc .svc-meta{font-size:10px;color:var(--text3);font-family:var(--mono)}

/* ── Log viewer modal ────────────────────────────────── */
.log-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,0.7);
  display:none;z-index:200;padding:24px;
}
.log-overlay.open{display:grid;place-items:center}
.log-panel{
  background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
  width:100%;max-width:900px;height:80vh;display:flex;flex-direction:column;
  box-shadow:0 8px 48px rgba(0,0,0,0.5);
}
.log-header{
  padding:12px 16px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:10px;flex-shrink:0;
}
.log-header h3{font-size:14px;font-weight:600;flex:1}
.log-header .filter-group{display:flex;gap:4px}
.log-header .filter-btn{
  padding:3px 8px;font-size:10px;font-weight:600;
  background:var(--bg4);color:var(--text3);border:1px solid var(--border);
  transition:all .15s;
}
.log-header .filter-btn.active{background:var(--accent-glow);color:var(--accent2);border-color:var(--accent)}
.log-header .filter-btn:hover{color:var(--text)}
.log-close{padding:4px 10px;background:var(--bg4);color:var(--text2);border:1px solid var(--border)}
.log-close:hover{background:var(--red-bg);color:var(--red);border-color:var(--red)}

.log-body{flex:1;overflow-y:auto;padding:4px 0;font-family:var(--mono);font-size:11px}
.log-line{
  padding:1px 16px;display:flex;gap:8px;line-height:1.6;
  transition:background .1s;white-space:pre-wrap;word-break:break-all;
}
.log-line:hover{background:var(--bg4)}
.log-line .ts{color:var(--text3);flex-shrink:0;font-size:10px;min-width:70px}
.log-line .stream{flex-shrink:0;font-size:9px;width:44px;text-align:center;padding:1px 0;border-radius:3px;font-weight:600}
.log-line .stream.stdout{color:var(--green);background:var(--green-bg)}
.log-line .stream.stderr{color:var(--red);background:var(--red-bg)}
.log-line .stream.system{color:var(--blue);background:var(--blue-bg)}
.log-line .msg{flex:1;color:var(--text)}
.log-line.stderr .msg{color:#fca5a5}

.log-footer{
  padding:8px 16px;border-top:1px solid var(--border);
  display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text3);flex-shrink:0;
}
.log-footer .auto-scroll{display:flex;align-items:center;gap:4px}
.log-footer label{cursor:pointer}

/* ── Right: Event Feed ───────────────────────────────── */
.sidebar{
  background:var(--bg2);border-left:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;
}
@media(max-width:1024px){.sidebar{border-left:none;border-top:1px solid var(--border)}}

.sidebar-hdr{
  padding:12px 14px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:6px;flex-shrink:0;
}
.sidebar-hdr h3{font-size:12px;font-weight:600;flex:1}
.sidebar-hdr .live{width:5px;height:5px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
.sidebar-hdr .cnt{font-size:10px;padding:2px 6px;border-radius:6px;background:var(--bg4);color:var(--text2)}

.events{flex:1;overflow-y:auto;padding:4px}
.ev{
  padding:8px 10px;border-radius:var(--radius-sm);margin-bottom:2px;
  border-left:2px solid transparent;transition:background .1s;cursor:default;
  animation:fadeIn .2s ease;
}
.ev:hover{background:var(--bg4)}
.ev.health_change{border-left-color:var(--blue)}
.ev.info{border-left-color:var(--text3)}
.ev.error{border-left-color:var(--red)}
.ev.launch{border-left-color:var(--accent)}
.ev.claim{border-left-color:var(--green)}

.ev .ev-time{font-size:9px;color:var(--text3);font-family:var(--mono)}
.ev .ev-title{font-size:11px;font-weight:500;margin-top:1px;line-height:1.3}
.ev .ev-svc{font-size:9px;color:var(--text3);margin-top:1px}
.ev .ev-detail{font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:2px}

.empty{color:var(--text3);font-size:11px;text-align:center;padding:32px 12px}

/* ── Auth Modal ──────────────────────────────────────── */
.auth-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);display:grid;place-items:center;z-index:1000}
.auth-modal{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:28px;width:340px;max-width:90vw}
.auth-modal h2{font-size:16px;margin-bottom:6px;color:var(--accent2)}
.auth-modal p{font-size:11px;color:var(--text2);margin-bottom:16px}
.auth-modal input{width:100%;padding:8px 12px;margin-bottom:10px;font-family:var(--mono)}
.auth-modal .btn-auth{width:100%;padding:8px;background:var(--accent);color:#fff;font-weight:600;font-size:12px}
.auth-modal .btn-auth:hover{opacity:.85}
.auth-modal .err{color:var(--red);font-size:10px;margin-top:6px;display:none}
.hidden{display:none !important}
</style>
</head>
<body>
<div class="app">
  <header class="header">
    <h1>Nemo<span class="claw">Claw</span></h1>
    <span class="tag">OPS</span>
    <div class="spacer"></div>
    <div class="conn" id="connStatus">
      <span class="dot" id="connDot"></span>
      <span id="connText">Connecting</span>
    </div>
    <button class="btn" id="btnRefresh">Refresh</button>
  </header>

  <div class="main">
    <div class="content">
      <!-- System info -->
      <div class="sys-bar" id="sysBar">
        <div class="sys-chip"><span class="label">Sandbox</span><span class="val">${esc(config.sandboxName || '—')}</span></div>
        <div class="sys-chip"><span class="label">Model</span><span class="val">${esc(config.inferenceModel)}</span></div>
        <div class="sys-chip"><span class="label">Provider</span><span class="val">${esc(config.inferenceProvider)}</span></div>
        <div class="sys-chip"><span class="label">Wallet</span><span class="val">${esc(shortWallet)}</span></div>
        <div class="sys-chip"><span class="label">RPC</span><span class="val">${esc(maskedRpc.length > 35 ? maskedRpc.slice(0, 35) + '...' : maskedRpc)}</span></div>
      </div>

      <!-- Stats -->
      <div class="stats" id="statsRow">
        <div class="stat green" id="statRunning"><div class="lbl">Running</div><div class="val">—</div><div class="sub">processes</div></div>
        <div class="stat" id="statStopped"><div class="lbl">Stopped</div><div class="val">—</div><div class="sub">processes</div></div>
        <div class="stat" id="statHealthy"><div class="lbl">Healthy</div><div class="val">—</div><div class="sub">services</div></div>
        <div class="stat blue" id="statEvents"><div class="lbl">Events</div><div class="val">—</div><div class="sub">captured</div></div>
        <div class="stat" id="statUptime"><div class="lbl">Uptime</div><div class="val">—</div><div class="sub">dashboard</div></div>
      </div>

      <!-- Processes -->
      <div class="section">
        <div class="section-hdr">
          <h2>Processes</h2>
          <span class="cnt" id="procCount">0</span>
        </div>
        <div class="procs" id="procGrid">
          <div class="empty">No processes registered</div>
        </div>
      </div>

      <!-- Services -->
      <div class="section">
        <div class="section-hdr">
          <h2>Service Health</h2>
          <span class="cnt" id="svcCount">0</span>
        </div>
        <div class="svcs" id="svcGrid">
          <div class="empty">No external services configured</div>
        </div>
      </div>
    </div>

    <!-- Event feed -->
    <div class="sidebar">
      <div class="sidebar-hdr">
        <span class="live"></span>
        <h3>Event Feed</h3>
        <span class="cnt" id="eventCount">0</span>
      </div>
      <div class="events" id="eventFeed">
        <div class="empty">Waiting for events...</div>
      </div>
    </div>
  </div>
</div>

<!-- Log viewer modal -->
<div class="log-overlay" id="logOverlay">
  <div class="log-panel">
    <div class="log-header">
      <h3 id="logTitle">Logs</h3>
      <div class="filter-group">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="stdout">stdout</button>
        <button class="filter-btn" data-filter="stderr">stderr</button>
        <button class="filter-btn" data-filter="system">system</button>
      </div>
      <button class="log-close" id="logClose">Close</button>
    </div>
    <div class="log-body" id="logBody"></div>
    <div class="log-footer">
      <div class="auto-scroll">
        <input type="checkbox" id="autoScroll" checked>
        <label for="autoScroll">Auto-scroll</label>
      </div>
      <span id="logLineCount">0 lines</span>
      <div class="spacer" style="flex:1"></div>
      <button class="filter-btn" id="logClear">Clear</button>
    </div>
  </div>
</div>

<!-- Auth modal -->
<div class="auth-overlay hidden" id="authOverlay">
  <div class="auth-modal">
    <h2>Authentication</h2>
    <p>Enter your dashboard API key.</p>
    <input type="password" id="authInput" placeholder="API Key" autocomplete="off"/>
    <button class="btn-auth" id="authBtn">Continue</button>
    <div class="err" id="authError">Invalid key</div>
  </div>
</div>

<script>
(function(){
'use strict';

let apiKey = localStorage.getItem('nemo_key') || '';
let processes = [];
let procDefs = [];
let services = [];
let events = [];
let eventSource = null;
let stats = {};
let currentLogProcess = null;
let logFilter = 'all';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const PROC_ICONS = {};
const EVENT_ICONS = {
  health_change:'\\u{1f504}', info:'\\u{2139}\\ufe0f', error:'\\u{274c}',
  claim:'\\u{1f4b0}', launch:'\\u{1f680}', graduation:'\\u{1f393}',
  whale_trade:'\\u{1f40b}', fee_distribution:'\\u{1f4b8}', cto:'\\u{1f451}',
};

// ── Auth ────────────────────────────────────────────────
function headers(){
  const h = {'Content-Type':'application/json'};
  if(apiKey) h['X-API-Key'] = apiKey;
  return h;
}

async function checkAuth(){
  try{
    const r = await fetch('/api/stats',{headers:headers()});
    if(r.status===401){$('#authOverlay').classList.remove('hidden');return false}
    $('#authOverlay').classList.add('hidden');
    return true;
  }catch{return false}
}

$('#authBtn').addEventListener('click', async()=>{
  apiKey=$('#authInput').value.trim();
  if(!apiKey)return;
  localStorage.setItem('nemo_key',apiKey);
  if(await checkAuth()){$('#authError').style.display='none';init()}
  else{$('#authError').style.display='block';localStorage.removeItem('nemo_key')}
});
$('#authInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#authBtn').click()});

// ── API ─────────────────────────────────────────────────
async function fetchStats(){
  try{
    const r=await fetch('/api/stats',{headers:headers()});
    if(!r.ok)return;
    stats=await r.json();
    renderStats();
  }catch{}
}

async function fetchProcesses(){
  try{
    const r=await fetch('/api/processes',{headers:headers()});
    if(!r.ok)return;
    const d=await r.json();
    processes=d.processes||[];
    procDefs=d.definitions||[];
    renderProcesses();
  }catch{}
}

async function fetchServices(){
  try{
    const r=await fetch('/api/services',{headers:headers()});
    if(!r.ok)return;
    const d=await r.json();
    services=d.services||[];
    renderServices();
  }catch{}
}

async function fetchEvents(){
  try{
    const r=await fetch('/api/events?limit=50',{headers:headers()});
    if(!r.ok)return;
    const d=await r.json();
    events=d.events||[];
    renderEvents();
  }catch{}
}

async function processAction(id,action){
  try{
    const r=await fetch('/api/processes/'+id+'/'+action,{method:'POST',headers:headers()});
    const d=await r.json();
    if(!r.ok){console.error(d.error);return}
    fetchProcesses();
  }catch(e){console.error(e)}
}

// ── SSE ─────────────────────────────────────────────────
function connectSSE(){
  if(eventSource)eventSource.close();
  eventSource=new EventSource('/api/events/stream');
  eventSource.onopen=()=>{
    $('#connDot').classList.add('live');
    $('#connText').textContent='Live';
  };
  eventSource.onmessage=e=>{
    try{
      const d=JSON.parse(e.data);
      if(d.type==='init'){
        if(d.services){services=d.services;renderServices()}
        if(d.processes){processes=d.processes;procDefs=d.processDefinitions||procDefs;renderProcesses()}
        if(d.recentEvents){events=d.recentEvents;renderEvents()}
      } else if(d.type==='process_update'){
        processes=d.processes;renderProcesses();
      } else {
        events.unshift(d);
        if(events.length>200)events.pop();
        prependEvent(d);
        if(d.type==='health_change')fetchServices();
      }
      fetchStats();
    }catch{}
  };
  eventSource.onerror=()=>{
    $('#connDot').classList.remove('live');
    $('#connText').textContent='Reconnecting';
    setTimeout(connectSSE,5000);
  };
}

// ── Render ──────────────────────────────────────────────
function renderStats(){
  setStat('statRunning',stats.processesRunning??'—');
  setStat('statStopped',stats.processesStopped??'—');
  setStat('statHealthy',stats.healthy??'—');
  setStat('statEvents',stats.totalEvents??'—');
  setStat('statUptime',fmtDur(stats.uptimeMs||0));

  const sr=$('#statRunning');
  sr.classList.remove('green','red','yellow');
  if((stats.processesRunning||0)>0)sr.classList.add('green');

  const sh=$('#statHealthy');
  sh.classList.remove('green','red','yellow');
  if(stats.totalServices>0){
    if(stats.healthy===stats.totalServices)sh.classList.add('green');
    else if(stats.down>0)sh.classList.add('red');
    else sh.classList.add('yellow');
  }
}

function setStat(id,v){const c=document.getElementById(id);if(c)c.querySelector('.val').textContent=v}

function renderProcesses(){
  const grid=$('#procGrid');
  if(!processes.length){grid.innerHTML='<div class="empty">No processes registered</div>';return}
  grid.innerHTML=processes.map(p=>{
    const def=procDefs.find(d=>d.id===p.id)||{};
    const icon=def.icon||'\\u{1f4e6}';
    const desc=def.description||'';
    const isRunning=p.status==='running'||p.status==='starting';
    return \`
    <div class="proc \${p.status}" data-id="\${esc(p.id)}">
      <div class="top">
        <div class="icon">\${icon}</div>
        <div class="name">\${esc(p.name||p.id)}</div>
        <div class="badge">\${p.status}</div>
      </div>
      <div class="desc">\${esc(desc)}</div>
      <div class="meta">
        \${p.pid?\`<span>PID \${p.pid}</span>\`:''}
        \${p.status==='running'&&p.uptimeMs?\`<span>\${fmtDur(p.uptimeMs)}</span>\`:''}
        \${p.restarts>0?\`<span>\${p.restarts} restarts</span>\`:''}
        <span>\${p.logCount} log lines</span>
      </div>
      <div class="actions">
        \${!isRunning?\`<button class="start" onclick="NC.start('\${esc(p.id)}')">Start</button>\`:''}
        \${isRunning?\`<button class="stop" onclick="NC.stop('\${esc(p.id)}')">Stop</button>\`:''}
        <button onclick="NC.restart('\${esc(p.id)}')">Restart</button>
        <button class="logs" onclick="NC.openLogs('\${esc(p.id)}')">Logs</button>
      </div>
    </div>\`;
  }).join('');
  $('#procCount').textContent=processes.length;
}

function renderServices(){
  const grid=$('#svcGrid');
  if(!services.length){grid.innerHTML='<div class="empty">No external services configured</div>';return}
  grid.innerHTML=services.map(s=>\`
    <div class="svc \${s.status}">
      <div class="svc-top">
        <div class="svc-name">\${esc(s.name)}</div>
        <div class="svc-status">\${s.status}</div>
      </div>
      <div class="svc-desc">\${esc(s.description)}</div>
      <div class="svc-meta">\${s.latencyMs}ms &middot; \${timeAgo(s.lastCheck)}</div>
    </div>
  \`).join('');
  $('#svcCount').textContent=services.length;
}

function renderEvents(){
  const feed=$('#eventFeed');
  if(!events.length){feed.innerHTML='<div class="empty">Waiting for events...</div>';return}
  feed.innerHTML=events.map(evHtml).join('');
  $('#eventCount').textContent=events.length;
}

function prependEvent(ev){
  const feed=$('#eventFeed');
  const empty=feed.querySelector('.empty');
  if(empty)empty.remove();
  const div=document.createElement('div');
  div.innerHTML=evHtml(ev);
  const node=div.firstElementChild;
  feed.prepend(node);
  while(feed.children.length>200)feed.lastChild.remove();
  $('#eventCount').textContent=feed.children.length;
}

function evHtml(ev){
  const icon=EVENT_ICONS[ev.type]||'\\u{1f4dd}';
  const detail=ev.details?.error||ev.details?.status||'';
  return \`<div class="ev \${ev.type}">
    <div class="ev-time">\${icon} \${fmtTime(ev.timestamp)}</div>
    <div class="ev-title">\${esc(ev.title)}</div>
    <div class="ev-svc">\${esc(ev.service)}</div>
    \${detail?\`<div class="ev-detail">\${esc(String(detail))}</div>\`:''}
  </div>\`;
}

// ── Log viewer ──────────────────────────────────────────
async function openLogs(id){
  currentLogProcess=id;
  const def=procDefs.find(d=>d.id===id)||{};
  $('#logTitle').textContent=(def.icon||'')+' '+(def.name||id)+' Logs';
  $('#logOverlay').classList.add('open');
  $('#logBody').innerHTML='';
  logFilter='all';
  $$('.filter-btn[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));

  try{
    const r=await fetch('/api/processes/'+id+'/logs?lines=500',{headers:headers()});
    if(!r.ok)return;
    const d=await r.json();
    const body=$('#logBody');
    (d.logs||[]).forEach(l=>appendLogLine(l));
    if($('#autoScroll').checked)body.scrollTop=body.scrollHeight;
    $('#logLineCount').textContent=(d.logs||[]).length+' lines';
  }catch{}

  // Start SSE for live logs
  startLogStream(id);
}

let logEventSource=null;
function startLogStream(id){
  if(logEventSource)logEventSource.close();
  logEventSource=new EventSource('/api/processes/'+id+'/stream');
  logEventSource.onmessage=e=>{
    try{
      const d=JSON.parse(e.data);
      if(d.type==='log'){
        appendLogLine(d);
        const body=$('#logBody');
        if($('#autoScroll').checked)body.scrollTop=body.scrollHeight;
        const count=body.querySelectorAll('.log-line').length;
        $('#logLineCount').textContent=count+' lines';
      }
    }catch{}
  };
}

function appendLogLine(entry){
  const body=$('#logBody');
  const div=document.createElement('div');
  div.className='log-line'+(entry.stream==='stderr'?' stderr':'');
  div.dataset.stream=entry.stream;
  if(logFilter!=='all'&&entry.stream!==logFilter)div.style.display='none';
  div.innerHTML=\`<span class="ts">\${fmtTime(entry.timestamp)}</span><span class="stream \${entry.stream}">\${entry.stream}</span><span class="msg">\${esc(entry.text)}</span>\`;
  body.appendChild(div);
  // Cap lines
  while(body.children.length>2000)body.firstChild.remove();
}

$('#logClose').addEventListener('click',()=>{
  $('#logOverlay').classList.remove('open');
  if(logEventSource){logEventSource.close();logEventSource=null}
  currentLogProcess=null;
});

$('#logOverlay').addEventListener('click',e=>{
  if(e.target===$('#logOverlay')){
    $('#logClose').click();
  }
});

$$('.filter-btn[data-filter]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    logFilter=btn.dataset.filter;
    $$('.filter-btn[data-filter]').forEach(b=>b.classList.toggle('active',b===btn));
    $$('#logBody .log-line').forEach(line=>{
      line.style.display=(logFilter==='all'||line.dataset.stream===logFilter)?'':'none';
    });
  });
});

$('#logClear').addEventListener('click',async()=>{
  if(!currentLogProcess)return;
  await fetch('/api/processes/'+currentLogProcess+'/logs',{method:'DELETE',headers:headers()});
  $('#logBody').innerHTML='';
  $('#logLineCount').textContent='0 lines';
});

// ── Refresh ─────────────────────────────────────────────
$('#btnRefresh').addEventListener('click',async()=>{
  $('#btnRefresh').disabled=true;
  $('#btnRefresh').textContent='...';
  try{
    await fetch('/api/services/refresh',{method:'POST',headers:headers()});
    await Promise.all([fetchProcesses(),fetchServices(),fetchStats(),fetchEvents()]);
  }finally{
    $('#btnRefresh').disabled=false;
    $('#btnRefresh').textContent='Refresh';
  }
});

// ── Utils ───────────────────────────────────────────────
function esc(s){if(!s)return '';const d=document.createElement('div');d.textContent=String(s);return d.innerHTML}
function fmtTime(ts){
  if(!ts)return '\\u2014';
  const d=new Date(ts);
  return d.toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function timeAgo(ts){
  if(!ts)return 'never';
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<5)return 'now';if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';
  return Math.floor(s/3600)+'h';
}
function fmtDur(ms){
  if(!ms||ms<0)return '\\u2014';
  const s=Math.floor(ms/1000);
  if(s<60)return s+'s';
  if(s<3600)return Math.floor(s/60)+'m '+s%60+'s';
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
  if(h<24)return h+'h '+m+'m';
  return Math.floor(h/24)+'d '+(h%24)+'h';
}

// ── Global API ──────────────────────────────────────────
window.NC={
  start:id=>processAction(id,'start'),
  stop:id=>processAction(id,'stop'),
  restart:id=>processAction(id,'restart'),
  openLogs:id=>openLogs(id),
};

// ── Init ────────────────────────────────────────────────
async function init(){
  await Promise.all([fetchProcesses(),fetchServices(),fetchStats(),fetchEvents()]);
  connectSSE();
  setInterval(fetchStats,10000);
  setInterval(fetchServices,30000);
}

checkAuth().then(ok=>{if(ok)init()});
})();
</script>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
