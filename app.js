const app = document.querySelector("#app");
const KEY = "life-system-v1";
const statuses = ["CALM", "ENERGETIC", "TIRED", "FOCUSED", "UNSTABLE", "UNKNOWN"];
const statusJapanese = { CALM:"穏やか", ENERGETIC:"元気", TIRED:"疲れている", FOCUSED:"集中している", UNSTABLE:"不安定", UNKNOWN:"まだわからない" };
const state = JSON.parse(localStorage.getItem(KEY) || "null") || { log: [], player: { level: 1, exp: 120, hp: 86, energy: 72, focus: 61 } };
const dateKey = () => new Date().toLocaleDateString("en-CA");
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c]);

function phase(hour) { return hour < 5 ? "NIGHT" : hour < 11 ? "MORNING" : hour < 17 ? "AFTERNOON" : hour < 21 ? "EVENING" : "NIGHT"; }
function season(month) { return month >= 5 && month <= 7 ? "SUMMER" : month >= 8 && month <= 10 ? "AUTUMN" : month <= 1 || month === 11 ? "WINTER" : "SPRING"; }
function boot() {
  app.innerHTML = `<section class="boot"><div><div class="orb"><span>SYNC</span></div><h1>LIFE SYSTEM</h1><p class="sub">real world interface</p><div class="progress"><i></i></div><p id="boot-copy">世界との接続を準備しています…</p></div></section>`;
  const copies = ["世界との接続を準備しています…", "プレイヤーを確認しています…", "前回の世界を復元しています…"];
  let i = 0; const timer = setInterval(() => { i++; const el = document.querySelector("#boot-copy"); if (el) el.textContent = copies[i] || copies.at(-1); }, 580);
  setTimeout(() => { clearInterval(timer); renderHome(); if (!state.status?.[dateKey()]) showStatus(); }, 1900);
}

async function reverseGeocode(lat, lon) {
  const nominatim = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1&accept-language=en`;
  try {
    const data = await fetch(nominatim).then((r) => r.ok ? r.json() : Promise.reject());
    const address = data.address || {};
    const locality = address.city || address.town || address.village || address.county || address.state;
    if (locality) return { location: String(locality).toUpperCase(), region: [address.state, address.country].filter(Boolean).join(" / ").toUpperCase() || "CURRENT AREA" };
  } catch { /* Try the secondary public resolver below. */ }
  const fallback = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;
  const data = await fetch(fallback).then((r) => r.ok ? r.json() : Promise.reject());
  const locality = data.city || data.locality || data.principalSubdivision;
  if (!locality) throw new Error("no place");
  return { location: String(locality).toUpperCase(), region: [data.principalSubdivision, data.countryName].filter(Boolean).join(" / ").toUpperCase() || "CURRENT AREA" };
}
async function weather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
  const data = await fetch(url).then((r) => r.ok ? r.json() : Promise.reject());
  const code = data.current?.weather_code;
  const names = { 0:"CLEAR", 1:"MAINLY CLEAR", 2:"PARTLY CLOUDY", 3:"OVERCAST", 45:"FOG", 48:"FOG", 51:"LIGHT DRIZZLE", 53:"DRIZZLE", 55:"HEAVY DRIZZLE", 61:"LIGHT RAIN", 63:"RAIN", 65:"HEAVY RAIN", 71:"SNOW", 80:"RAIN SHOWERS", 95:"THUNDERSTORM" };
  return { weather: names[code] || "LOCAL CONDITIONS", temperature: Math.round(data.current?.temperature_2m) };
}
function getPosition() { return new Promise((resolve, reject) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:true, timeout:20000, maximumAge:0 }) : reject()); }
async function sync() {
  const button = document.querySelector("#sync"); if (button) button.disabled = true;
  renderSync("Reading local conditions…");
  const now = new Date();
  const world = { location:"LOCATION UNAVAILABLE", region:"位置情報なしで同期", weather:"WEATHER UNAVAILABLE", temperature:"—", phase:phase(now.getHours()), season:season(now.getMonth()), ambience:"位置情報なしで世界へ入りました。次回の同期で、いつでも再取得できます。", syncedAt:now.toISOString() };
  try {
    const pos = await getPosition();
    world.location = "GPS LOCKED";
    world.region = `${pos.coords.latitude.toFixed(3)} / ${pos.coords.longitude.toFixed(3)}`;
    const [place, conditions] = await Promise.allSettled([reverseGeocode(pos.coords.latitude, pos.coords.longitude), weather(pos.coords.latitude, pos.coords.longitude)]);
    if (place.status === "fulfilled") Object.assign(world, place.value);
    if (conditions.status === "fulfilled") Object.assign(world, conditions.value);
    world.ambience = world.weather === "WEATHER UNAVAILABLE" ? "現在地を確認しました。天気情報は今は取得できません。" : `現在の空模様：${world.weather}`;
  } catch { world.ambience = "位置情報なしで世界へ入りました。準備ができたら、もう一度SYNCできます。"; }
  state.world = world;
  const title = world.weather !== "WEATHER UNAVAILABLE" ? `${world.weather} detected` : "World sync completed";
  const today = dateKey();
  if (!state.log.some((e) => e.day === today && e.title === title)) state.log.unshift({ id:crypto.randomUUID(), day:today, time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"EVENT", title, detail:world.ambience });
  save(); renderSync("WORLD SYNC COMPLETE"); setTimeout(renderHome, 700);
}
function renderSync(copy) { app.innerHTML = `<section class="boot"><div><div class="orb"><span>SYNC</span></div><h1>LIFE SYSTEM</h1><p class="sub">world sync in progress</p><div class="progress"><i></i></div><p>${esc(copy)}</p></div></section>`; }
function showStatus() {
  const modal = document.createElement("section"); modal.className = "status-dialog";
  modal.innerHTML = `<div class="dialog glass"><p class="eyebrow">day start status</p><h2>今日は、どんな状態で<br>世界に入りますか？</h2><p class="dialog-copy">いまの自分にいちばん近いものを選んでください。</p><div class="choices">${statuses.map((s) => `<button class="choice" data-status="${s}"><b>${s}</b><span>${statusJapanese[s]}</span></button>`).join("")}</div></div>`;
  modal.addEventListener("click", (e) => { const value = e.target.closest("[data-status]")?.dataset.status; if (!value) return; state.status ||= {}; state.status[dateKey()] = value; state.log.unshift({id:crypto.randomUUID(),day:dateKey(),time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),kind:"STATUS",title:`WORLD ENTRY: ${value}`,detail:`DAY START STATUS — ${statusJapanese[value]}`}); save(); modal.remove(); renderHome(); }); document.body.append(modal);
}
function renderHome() {
  const w = state.world || { location:"WORLD NOT SYNCED", region:"SYNCを押して世界に入る", weather:"UNKNOWN", temperature:"—", phase:phase(new Date().getHours()), season:season(new Date().getMonth()), ambience:"最初のWORLD SYNCを待っています。" };
  const now = new Date(); const p = state.player; const events = state.log.filter((e) => e.day === dateKey()).slice(0,3);
  app.innerHTML = `<div class="shell"><header class="header"><div><p class="eyebrow">world time</p><p class="clock">${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})}</p><p class="date">${now.toLocaleDateString([], {weekday:"long",day:"numeric",month:"long"})}</p></div><button id="sync" class="sync glass"><span class="eyebrow">sync</span><time>${w.syncedAt ? new Date(w.syncedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "READY"}</time></button></header><div class="stack">
  <section class="card glass"><div class="section-head"><p class="eyebrow">world state <span class="jp-label">世界の状態</span></p><p class="eyebrow">${esc(w.phase)}</p></div><div class="place"><div><h2>${esc(w.location)}</h2><p class="region">${esc(w.region)}</p></div><span class="temperature">${esc(w.temperature)}°</span></div><div class="tiles"><div class="tile"><p class="eyebrow">season <span class="jp-label">季節</span></p><b>${esc(w.season)}</b></div><div class="tile"><p class="eyebrow">phase <span class="jp-label">時間帯</span></p><b>${esc(w.phase)}</b></div><div class="tile"><p class="eyebrow">weather <span class="jp-label">天気</span></p><b>${esc(w.weather)}</b></div></div><p class="ambience">${esc(w.ambience)}</p></section>
  <section class="card glass"><div class="section-head"><p class="eyebrow">event / discovery <span class="jp-label">最近の出来事</span></p><p class="eyebrow">${events.length} detected</p></div>${events.length ? events.map((e) => `<div class="log-entry"><p class="eyebrow">${esc(e.kind)} · ${esc(e.time)}</p><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p></div>`).join("") : `<div class="event"><i class="signal"></i><p>まだ新しいシグナルはありません。<br>SYNCすると、いまの世界を観測できます。</p></div>`}</section>
  <section class="card glass"><div class="player"><div><p class="eyebrow">player <span class="jp-label">プレイヤー</span></p><h2>PLAYER ONE</h2><p class="region">DAY START: ${esc(state.status?.[dateKey()] || "UNKNOWN")} <span class="jp-inline">${statusJapanese[state.status?.[dateKey()] || "UNKNOWN"]}</span></p></div><div class="level glass"><span class="eyebrow">lv</span><strong>${p.level}</strong></div></div><div class="bar"><label>exp <span>${p.exp} / 500</span></label><i><span style="width:${p.exp / 5}%"></span></i></div><div class="three">${[["hp",p.hp,"#f4b9cc"],["energy",p.energy,"#bfe5d0"],["focus",p.focus,"#b8e5f2"]].map(([name,value,color]) => `<div class="bar"><label>${name}<span>${value}</span></label><i><span style="width:${value}%;background:${color}"></span></i></div>`).join("")}</div></section>
  <section class="card glass"><p class="eyebrow">now playing</p><div class="now"><i class="art"></i><div><p><strong>Untitled Ambient</strong></p><small>YOUR SOUNDTRACK · LOCAL</small></div></div></section>
  <section class="card glass"><div class="section-head"><p class="eyebrow">world log <span class="jp-label">世界の記録</span></p><p class="eyebrow">${state.log.length} entries</p></div><p class="ambience">この端末に記録された、あなたの世界で起きたこと。</p></section></div></div>`;
  document.querySelector("#sync").addEventListener("click", sync);
}
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
boot();
