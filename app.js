const app = document.querySelector("#app");
const KEY = "life-system-v1";
const statuses = ["CALM", "ENERGETIC", "TIRED", "FOCUSED", "UNSTABLE", "UNKNOWN"];
const state = JSON.parse(localStorage.getItem(KEY) || "null") || { log: [], player: { level: 1, exp: 120, hp: 86, energy: 72, focus: 61 } };
const dateKey = () => new Date().toLocaleDateString("en-CA");
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c]);

function phase(hour) { return hour < 5 ? "NIGHT" : hour < 11 ? "MORNING" : hour < 17 ? "AFTERNOON" : hour < 21 ? "EVENING" : "NIGHT"; }
function season(month) { return month >= 5 && month <= 7 ? "SUMMER" : month >= 8 && month <= 10 ? "AUTUMN" : month <= 1 || month === 11 ? "WINTER" : "SPRING"; }
function boot() {
  app.innerHTML = `<section class="boot"><div><div class="orb"><span>SYNC</span></div><h1>LIFE SYSTEM</h1><p class="sub">real world interface</p><div class="progress"><i></i></div><p id="boot-copy">Preparing world interface…</p></div></section>`;
  const copies = ["Preparing world interface…", "Locating player…", "Restoring last world state…"];
  let i = 0; const timer = setInterval(() => { i++; const el = document.querySelector("#boot-copy"); if (el) el.textContent = copies[i] || copies.at(-1); }, 580);
  setTimeout(() => { clearInterval(timer); renderHome(); if (!state.status?.[dateKey()]) showStatus(); }, 1900);
}

async function reverseGeocode(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`;
  const data = await fetch(url).then((r) => r.ok ? r.json() : Promise.reject());
  const place = data.results?.[0];
  if (!place) throw new Error("no place");
  return { location: String(place.name || "CURRENT AREA").toUpperCase(), region: [place.admin1, place.country].filter(Boolean).join(" / ").toUpperCase() || "CURRENT AREA" };
}
async function weather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
  const data = await fetch(url).then((r) => r.ok ? r.json() : Promise.reject());
  const code = data.current?.weather_code;
  const names = { 0:"CLEAR", 1:"MAINLY CLEAR", 2:"PARTLY CLOUDY", 3:"OVERCAST", 45:"FOG", 48:"FOG", 51:"LIGHT DRIZZLE", 53:"DRIZZLE", 55:"HEAVY DRIZZLE", 61:"LIGHT RAIN", 63:"RAIN", 65:"HEAVY RAIN", 71:"SNOW", 80:"RAIN SHOWERS", 95:"THUNDERSTORM" };
  return { weather: names[code] || "LOCAL CONDITIONS", temperature: Math.round(data.current?.temperature_2m) };
}
function getPosition() { return new Promise((resolve, reject) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:false, timeout:9000, maximumAge:300000 }) : reject()); }
async function sync() {
  const button = document.querySelector("#sync"); if (button) button.disabled = true;
  renderSync("Reading local conditions…");
  const now = new Date();
  const world = { location:"LOCATION UNAVAILABLE", region:"SYNC WITHOUT LOCATION", weather:"WEATHER UNAVAILABLE", temperature:"—", phase:phase(now.getHours()), season:season(now.getMonth()), ambience:"The world is available. Location data can be enabled on a future sync.", syncedAt:now.toISOString() };
  try {
    const pos = await getPosition();
    const [place, conditions] = await Promise.allSettled([reverseGeocode(pos.coords.latitude, pos.coords.longitude), weather(pos.coords.latitude, pos.coords.longitude)]);
    if (place.status === "fulfilled") Object.assign(world, place.value);
    if (conditions.status === "fulfilled") Object.assign(world, conditions.value);
    world.ambience = world.weather === "WEATHER UNAVAILABLE" ? "Local position resolved. Weather signal is unavailable right now." : `Current conditions: ${world.weather.toLowerCase()}.`;
  } catch { world.ambience = "World entered without a location signal. You can try again whenever you are ready."; }
  state.world = world;
  const title = world.weather !== "WEATHER UNAVAILABLE" ? `${world.weather} detected` : "World sync completed";
  const today = dateKey();
  if (!state.log.some((e) => e.day === today && e.title === title)) state.log.unshift({ id:crypto.randomUUID(), day:today, time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"EVENT", title, detail:world.ambience });
  save(); renderSync("WORLD SYNC COMPLETE"); setTimeout(renderHome, 700);
}
function renderSync(copy) { app.innerHTML = `<section class="boot"><div><div class="orb"><span>SYNC</span></div><h1>LIFE SYSTEM</h1><p class="sub">world sync in progress</p><div class="progress"><i></i></div><p>${esc(copy)}</p></div></section>`; }
function showStatus() {
  const modal = document.createElement("section"); modal.className = "status-dialog";
  modal.innerHTML = `<div class="dialog glass"><p class="eyebrow">day start status</p><h2>HOW ARE YOU ENTERING<br>THE WORLD?</h2><div class="choices">${statuses.map((s) => `<button class="choice" data-status="${s}">${s}</button>`).join("")}</div></div>`;
  modal.addEventListener("click", (e) => { const value = e.target.dataset.status; if (!value) return; state.status ||= {}; state.status[dateKey()] = value; state.log.unshift({id:crypto.randomUUID(),day:dateKey(),time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),kind:"STATUS",title:`Entered the world: ${value}`,detail:"Day start status recorded."}); save(); modal.remove(); renderHome(); }); document.body.append(modal);
}
function renderHome() {
  const w = state.world || { location:"WORLD NOT SYNCED", region:"TAP SYNC TO BEGIN", weather:"UNKNOWN", temperature:"—", phase:phase(new Date().getHours()), season:season(new Date().getMonth()), ambience:"The world is waiting for its first sync." };
  const now = new Date(); const p = state.player; const events = state.log.filter((e) => e.day === dateKey()).slice(0,3);
  app.innerHTML = `<div class="shell"><header class="header"><div><p class="eyebrow">world time</p><p class="clock">${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})}</p><p class="date">${now.toLocaleDateString([], {weekday:"long",day:"numeric",month:"long"})}</p></div><button id="sync" class="sync glass"><span class="eyebrow">sync</span><time>${w.syncedAt ? new Date(w.syncedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "READY"}</time></button></header><div class="stack">
  <section class="card glass"><div class="section-head"><p class="eyebrow">world state</p><p class="eyebrow">${esc(w.phase)}</p></div><div class="place"><div><h2>${esc(w.location)}</h2><p class="region">${esc(w.region)}</p></div><span class="temperature">${esc(w.temperature)}°</span></div><div class="tiles"><div class="tile"><p class="eyebrow">season</p><b>${esc(w.season)}</b></div><div class="tile"><p class="eyebrow">phase</p><b>${esc(w.phase)}</b></div><div class="tile"><p class="eyebrow">weather</p><b>${esc(w.weather)}</b></div></div><p class="ambience">${esc(w.ambience)}</p></section>
  <section class="card glass"><div class="section-head"><p class="eyebrow">event / discovery</p><p class="eyebrow">${events.length} detected</p></div>${events.length ? events.map((e) => `<div class="log-entry"><p class="eyebrow">${esc(e.kind)} · ${esc(e.time)}</p><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p></div>`).join("") : `<div class="event"><i class="signal"></i><p>No signals in range yet.<br>Sync to observe the current world.</p></div>`}</section>
  <section class="card glass"><div class="player"><div><p class="eyebrow">player</p><h2>PLAYER ONE</h2><p class="region">DAY START: ${esc(state.status?.[dateKey()] || "UNKNOWN")}</p></div><div class="level glass"><span class="eyebrow">lv</span><strong>${p.level}</strong></div></div><div class="bar"><label>exp <span>${p.exp} / 500</span></label><i><span style="width:${p.exp / 5}%"></span></i></div><div class="three">${[["hp",p.hp,"#f4b9cc"],["energy",p.energy,"#bfe5d0"],["focus",p.focus,"#b8e5f2"]].map(([name,value,color]) => `<div class="bar"><label>${name}<span>${value}</span></label><i><span style="width:${value}%;background:${color}"></span></i></div>`).join("")}</div></section>
  <section class="card glass"><p class="eyebrow">now playing</p><div class="now"><i class="art"></i><div><p><strong>Untitled Ambient</strong></p><small>YOUR SOUNDTRACK · LOCAL</small></div></div></section>
  <section class="card glass"><div class="section-head"><p class="eyebrow">world log</p><p class="eyebrow">${state.log.length} entries</p></div><p class="ambience">Everything recorded in this world, kept on this device.</p></section></div></div>`;
  document.querySelector("#sync").addEventListener("click", sync);
}
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
boot();
