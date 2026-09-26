import { WINDOW_MS, decimal, eventTime, eventId, windowMetrics, pricePoints } from './metrics.js';
import { recordDemo } from './record-demo.js';

const $ = id => document.getElementById(id);
const state = { socket: null, events: [], seen: new Set(), gaps: 0, total: 0, connectedAt: null, lastAt: null, status: 'idle', mint: null, deliberatelyClosed: false };
const base58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const signaturePattern = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

function setStatus(kind, label) { state.status = kind; $('status').className = `status ${kind}`; $('status-text').textContent = label; }
function money(value) { return new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:value < 1 ? 4 : 0}).format(value); }
function age(ms) { if (ms === null) return '—'; const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000)); return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds/60)}m ${seconds%60}s ago`; }

function renderChart() {
  const points = pricePoints(state.events, Date.now());
  const line = $('price-line');
  if (!points.length) { line.setAttribute('points', ''); $('last-price').textContent = '—'; return; }
  const low = Math.min(...points), high = Math.max(...points);
  const span = high - low || high * .001 || 1;
  line.setAttribute('points', points.map((price, i) => `${points.length === 1 ? 300 : i * 600/(points.length-1)},${174 - (price-low)/span*154}`).join(' '));
  $('last-price').textContent = money(points.at(-1));
  $('chart-note').textContent = `${points.length} observed price ${points.length === 1 ? 'point' : 'points'} in this browser’s five-minute window. Gaps are not interpolated.`;
}

function render() {
  const now = Date.now();
  const recent = windowMetrics(state.events, now);
  $('volume').textContent = state.connectedAt ? money(recent.volume) : '—';
  $('ratio').textContent = state.connectedAt ? (recent.ratio === null ? '—' : `${recent.ratio.toFixed(2)}×`) : '—';
  $('swaps').textContent = state.connectedAt ? String(recent.swaps) : '—';
  $('removals').textContent = state.connectedAt ? String(recent.removals) : '—';
  $('last-event').textContent = age(state.lastAt);
  $('gaps').textContent = String(state.gaps);
  $('total').textContent = String(state.total);
  const stale = state.connectedAt && now - (state.lastAt ?? state.connectedAt) > 30_000;
  if (state.connectedAt && state.socket?.readyState === WebSocket.OPEN) {
    if (stale && state.status === 'live') setStatus('warn', 'QUIET / CHECK FEED');
    else if (!stale && state.status === 'warn') setStatus('live', 'LIVE');
  }
  if (state.connectedAt) {
    $('coverage').textContent = `Session began ${new Date(state.connectedAt).toLocaleTimeString()}. ${state.gaps ? `${state.gaps} connection gap(s); totals are incomplete.` : 'Counts cover this connected tab only.'}`;
    $('integrity-callout').textContent = state.gaps ? 'A disconnect interrupted observation. Do not read these totals as a complete market history.' : stale ? 'No recent matching event. This may be a quiet market or a delayed feed; zero observed swaps is not proof of zero on-chain swaps.' : state.lastAt ? 'Feed is receiving matching events. Figures still reflect only events delivered to this browser.' : 'Connected, waiting for the first matching event. No price or volume is inferred yet.';
  }
  renderChart();
  // Keep the rolling calculation bounded while retaining a few recent source rows.
  if (state.events.length > 2000) { state.events = state.events.filter(item => item.at >= now - WINDOW_MS).slice(-500); state.seen = new Set(state.events.map(item => eventId(item.event)).filter(Boolean)); }
}

function appendEvent(event, at) {
  const row = document.createElement('div'); row.className = 'event-row';
  const first = document.createElement('div'); const detail = document.createElement('div'); const proof = document.createElement('div');
  const time = document.createElement('span'); time.className = 'event-time'; time.textContent = new Date(at).toLocaleTimeString();
  const type = document.createElement('span'); type.className = `event-type ${event.type === 'liquidity' && event.kind === 'remove' ? 'remove' : ''}`; type.textContent = event.type.toUpperCase();
  first.append(time, type);
  if (event.type === 'swap') detail.textContent = `${(event.side || 'unknown').toUpperCase()} · ${money(Math.max(0, decimal(event.volume_usd) ?? 0))} observed · ${event.dex || 'DEX unknown'}`;
  else if (event.type === 'liquidity') detail.textContent = `${(event.kind || 'change').toUpperCase()} liquidity · ${event.dex || 'DEX unknown'}`;
  else if (event.type === 'surge') detail.textContent = `Surge trigger · ${event.multiple ?? '—'}× reported baseline`;
  else if (event.type === 'radar') detail.textContent = 'Radar activity alert';
  else detail.textContent = 'Token metadata update';
  if (typeof event.signature === 'string' && signaturePattern.test(event.signature)) { const link = document.createElement('a'); link.href = `https://solscan.io/tx/${event.signature}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'SOLSCAN ↗'; proof.append(link); }
  else proof.textContent = '—';
  row.append(first, detail, proof);
  if ($('events').firstElementChild?.classList.contains('empty')) $('events').replaceChildren();
  $('events').prepend(row);
  while ($('events').children.length > 30) $('events').lastElementChild.remove();
}

function handleMessage(raw) {
  let event; try { event = JSON.parse(raw); } catch { return; }
  if (!event || typeof event !== 'object') return;
  if (event.type === 'error') { setStatus('warn', 'FEED ERROR'); $('integrity-callout').textContent = `Solami reported: ${String(event.message || 'unknown error').slice(0,160)}`; return; }
  if (!['swap','liquidity','surge','radar','metadata'].includes(event.type)) return;
  // The server performs mint filtering. Check explicit mint fields as defense
  // against a malformed/unfiltered stream; liquidity may use base_mint.
  const mint = event.mint ?? event.base_mint;
  if (mint && mint !== state.mint) return;
  const id = eventId(event);
  if (id && state.seen.has(id)) return;
  if (id) state.seen.add(id);
  const at = eventTime(event, Date.now());
  state.events.push({event, at}); state.total++; state.lastAt = Date.now();
  appendEvent(event, at); render();
}

function closeStream() {
  if (state.socket) { state.deliberatelyClosed = true; state.socket.close(); state.socket = null; }
}

function connectDirect(key,mint) {
  const url=new URL('wss://ws.solami.dev/data/subscribe');
  url.searchParams.set('chain','solana');url.searchParams.set('api_key',key);url.searchParams.set('address',mint);url.searchParams.set('type','swap,liquidity,surge,radar,metadata');
  const socket=new WebSocket(url);state.socket=socket;
  const timeout=setTimeout(()=>{if(state.socket===socket&&socket.readyState===WebSocket.CONNECTING){setStatus('warn','CONNECTION TIMEOUT');socket.close();}},12000);
  socket.onopen=()=>{clearTimeout(timeout);if(state.socket!==socket)return;state.connectedAt=Date.now();setStatus('live','LIVE');$('disconnect-button').hidden=false;$('record-button').hidden=false;render();};
  socket.onmessage=message=>{if(state.socket===socket)handleMessage(message.data);};
  socket.onerror=()=>{if(state.socket===socket){setStatus('warn','CONNECTION ERROR');$('integrity-callout').textContent='Browser WebSocket error. Check your key and DataApi role.';}};
  socket.onclose=event=>{clearTimeout(timeout);if(state.socket!==socket)return;state.socket=null;$('disconnect-button').hidden=true;$('record-button').hidden=true;if(!state.deliberatelyClosed&&state.connectedAt)state.gaps++;setStatus('warn','FEED CLOSED');$('integrity-callout').textContent=`WebSocket closed (${event.code}). ${event.reason || 'No reason supplied.'}`;render();};
}

function connect(event) {
  event.preventDefault();
  const mint = $('mint').value.trim(); const key = $('key').value.trim();
  if (!base58.test(mint)) { $('mint').setCustomValidity('Enter a Solana base58 mint address.'); $('mint').reportValidity(); return; }
  $('mint').setCustomValidity('');
  if (!key) return;
  closeStream();
  state.events = []; state.seen = new Set(); state.gaps = 0; state.total = 0; state.connectedAt = null; state.lastAt = null; state.mint = mint; state.deliberatelyClosed = false;
  $('events').replaceChildren(); const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Waiting for matching mainnet events…'; $('events').append(empty);
  $('key').value = ''; // do not retain a second DOM copy or persist to storage
  setStatus('warn','CONNECTING');
  connectDirect(key,mint); render();
}

$('connect-form').addEventListener('submit', connect);
$('record-button').addEventListener('click', async () => {
  const button=$('record-button');button.disabled=true;
  try { await recordDemo(()=>state,seconds=>{button.textContent=`Recording live demo · ${seconds}s / 125s`;});
    button.textContent='Demo downloaded';
  } catch(error) { button.textContent='Recording failed';$('integrity-callout').textContent=`Recording failed: ${error.message}`; }
  finally {setTimeout(()=>{button.disabled=false;button.textContent='Record 2-minute live demo';},3000);}
});
$('disconnect-button').addEventListener('click', () => { closeStream(); $('disconnect-button').hidden = true; $('record-button').hidden = true; setStatus('idle','DISCONNECTED'); render(); });
setInterval(render, 1000);
