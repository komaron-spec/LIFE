const app = document.querySelector("#app");
const KEY = "life-system-v1";
const GOOGLE_CLIENT_ID = "291554576381-l0f7qpi546iofbgqggvhuvh5a6uqm1aj.apps.googleusercontent.com";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
let calendarTokenClient;
const statuses = ["CALM", "ENERGETIC", "TIRED", "FOCUSED", "UNSTABLE", "UNKNOWN"];
const statusJapanese = { CALM:"穏やか", ENERGETIC:"元気", TIRED:"疲れている", FOCUSED:"集中している", UNSTABLE:"不安定", UNKNOWN:"まだわからない" };
const soundtrackLibrary = [
  { id:"login", scene:"起動ログイン", role:"起床 / WORLD LOGIN", track:"0ybO4uDO7FzOVWaASzcmCD", tone:"morning" },
  { id:"equip", scene:"装備フェーズ", role:"身支度", track:"4YxR5rzn3iDVPDYZSBMA0q", tone:"morning" },
  { id:"meal", scene:"回復＆味覚フェーズ", role:"食事", track:"6qIVSaqR4Sk8e4NfagI3SW", tone:"home" },
  { id:"campus", scene:"キャンパスエリア", role:"大学", track:"0NMdTDx7LCJdm3ioJ1cDcg", tone:"day" },
  { id:"homeDay", scene:"ホームエリア", role:"HOME / DAY", track:"19CjH6tQjeW70DPuC9AoNq", tone:"home" },
  { id:"homeNight", scene:"ホームエリア", role:"HOME / NIGHT", track:"08DzdMtaEC8ySbunP3ncw8", tone:"night" },
  { id:"sleep", scene:"スリープフェーズ", role:"寝る準備", track:"40ylzMzusmG45S4bdDSnPz", tone:"night" },
  { id:"logout", scene:"ログアウト", role:"就寝", track:"5bmw5BjTqXBEusbrv4bEnQ", tone:"night" },
  { id:"mission", scene:"ミッション達成", role:"ACHIEVEMENT", track:"6G3h0xcjO34xUrdqlqZ049", tone:"morning" },
  { id:"homeMorning", scene:"ホームエリア", role:"HOME / MORNING", track:"3qFn1r1xdXMGzcVJdqGwnj", tone:"morning" },
  { id:"walk", scene:"ワールドエリア探索", role:"徒歩 / EXPLORATION", track:"26vNftUsty2Gr4dStjmlng", tone:"day" },
  { id:"bath", scene:"バスタイム", role:"RECOVERY", track:"1HWp3T9mxQxd4UAPjkAjRE", tone:"home" },
  { id:"shop", scene:"ショップ", role:"SHOP", track:"60oFLtrgr39Rlnb5KiQkDt", tone:"day" }
];
const state = JSON.parse(localStorage.getItem(KEY) || "null") || { log: [], player: { level: 1, exp: 120, hp: 86, energy: 72, focus: 61 } };
let homeClock;
const dateKey = () => new Date().toLocaleDateString("en-CA");
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c]);
function calendarTime(event) { const value = event.start?.dateTime || event.start?.date; if (!value) return "—"; if (!event.start?.dateTime) return "ALL DAY"; return new Date(value).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:false }); }
function upcomingCalendarEvent() { return state.calendar?.events?.find((event) => new Date(event.end?.dateTime || event.end?.date) >= new Date()) || state.calendar?.events?.[0]; }
function calendarLogState(event) { const now = new Date(); const start = new Date(event.start?.dateTime || event.start?.date); const end = new Date(event.end?.dateTime || event.end?.date); if (end < now) return ["COMPLETE", "完了した予定", "complete"]; if (start <= now) return ["ACTIVE", "いま進行中", "active"]; return ["UPCOMING", "これからの予定", "upcoming"]; }
function calendarLogDate(event) { const value = event.start?.dateTime || event.start?.date; return value ? new Date(value).toLocaleDateString("ja-JP", { month:"long", day:"numeric", weekday:"short" }) : "DATE UNKNOWN"; }
async function loadCalendarEvents(accessToken) {
  const now = new Date(); const since = new Date(now); const until = new Date(now); since.setDate(since.getDate() - 30); until.setDate(until.getDate() + 14);
  const params = new URLSearchParams({ timeMin:since.toISOString(), timeMax:until.toISOString(), singleEvents:"true", orderBy:"startTime", maxResults:"100" });
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers:{ Authorization:`Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("calendar request failed");
  const data = await response.json();
  state.calendar = { events:(data.items || []).map((event) => ({ id:event.id, title:event.summary || "UNTITLED EVENT", start:event.start, end:event.end, location:event.location || "" })), syncedAt:new Date().toISOString() };
  save();
}
function connectGoogleCalendar(returnPage = "system") {
  if (!window.google?.accounts?.oauth2) { alert("Google認可の読み込みを待っています。少ししてからもう一度押してください。"); return; }
  calendarTokenClient ||= window.google.accounts.oauth2.initTokenClient({ client_id:GOOGLE_CLIENT_ID, scope:CALENDAR_SCOPE, callback:async (response) => { if (response.error) return; try { await loadCalendarEvents(response.access_token); renderPage(returnPage); } catch { alert("Google Calendarを読み込めませんでした。認可設定を確認してください。"); } } });
  calendarTokenClient.requestAccessToken({ prompt:"" });
}
const icon = (name) => {
  const paths = {
    location: '<path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>',
    sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    cloud: '<path d="M6.3 18h10.2a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.7 1.2A3 3 0 0 0 6.3 18Z"/>',
    rain: '<path d="M6.3 15.5h10.2a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.7 1.2A3 3 0 0 0 6.3 15.5Z"/><path d="m8 18-1 2m5-2-1 2m5-2-1 2"/>',
    moon: '<path d="M19.5 15.5A7.5 7.5 0 0 1 8.5 4.5 7.5 7.5 0 1 0 19.5 15.5Z"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    haze: '<path d="M4 9h16M6 13h12M4 17h16"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.haze}</svg>`;
};
const pageNav = (active) => `<nav class="page-nav glass" aria-label="LIFE SYSTEM navigation">${[["world","WORLD"],["player","PLAYER"],["navigator","NAVI"],["log","LOG"],["sound","SOUND"],["system","SYSTEM"]].map(([name,label]) => `<button class="${active === name ? "is-active" : ""}" data-page="${name}" aria-current="${active === name ? "page" : "false"}">${label}</button>`).join("")}</nav>`;
function weatherIcon(weather) { if (/RAIN|DRIZZLE|SHOWER|THUNDER/.test(weather)) return "rain"; if (/CLEAR/.test(weather)) return "sun"; if (/CLOUD|OVERCAST/.test(weather)) return "cloud"; return "haze"; }
function phaseIcon(value) { return /NIGHT/.test(value) ? "moon" : /MORNING|AFTERNOON|EVENING/.test(value) ? "clock" : "clock"; }

function phase(hour) { return hour < 5 ? "NIGHT" : hour < 11 ? "MORNING" : hour < 17 ? "AFTERNOON" : hour < 21 ? "EVENING" : "NIGHT"; }
function season(month) { return month >= 5 && month <= 7 ? "SUMMER" : month >= 8 && month <= 10 ? "AUTUMN" : month <= 1 || month === 11 ? "WINTER" : "SPRING"; }
function navigatorBrief(world = state.world || {}, player = state.player) {
  const notes = [];
  const weather = world.weather || "";
  const isNight = /NIGHT/.test(world.phase || phase(new Date().getHours()));
  if (/RAIN|DRIZZLE|THUNDER/.test(weather)) notes.push({ tag:"CAUTION", title:"RAIN EVENT ACTIVE", copy:"雨の世界です。移動時は少しだけ慎重に。", tone:"rain" });
  if (player.energy <= 40) notes.push({ tag:"RECOVERY", title:"ENERGY LOW", copy:"安全地帯で、次の行動をゆっくり選びましょう。", tone:"rest" });
  if (player.focus <= 40) notes.push({ tag:"FOCUS", title:"SIGNAL IS QUIET", copy:"ひとつだけ決めると、世界が少し見えやすくなります。", tone:"focus" });
  if (isNight) notes.push({ tag:"NIGHT PHASE", title:"NIGHT HAS BEGUN", copy:"夜の世界です。今日の出来事を記録するのに向いています。", tone:"night" });
  if (/UNAVAILABLE|NOT SYNCED|UNKNOWN/.test(world.location || "")) notes.push({ tag:"OBSERVE", title:"WORLD SIGNAL WAITING", copy:"SYNCすると、現在の世界をより詳しく観測できます。", tone:"signal" });
  if (!notes.length) notes.push({ tag:"GUIDANCE", title:"WORLD IS STABLE", copy:"いまのペースで大丈夫。気になった景色をひとつ観測してみてください。", tone:"calm" });
  return notes[0];
}
function navigatorGreeting(world, player) {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "おはようございます、プレイヤー。" : hour < 18 ? "こんにちは、プレイヤー。" : "おかえりなさい、プレイヤー。";
  const details = [];
  if (world.location && !/UNAVAILABLE|NOT SYNCED/.test(world.location)) details.push(`${world.location} / ${world.phase}`);
  if (world.weather && world.weather !== "WEATHER UNAVAILABLE") details.push(`${world.weather} · ${world.temperature}°`);
  const mission = upcomingCalendarEvent();
  if (mission) details.push(`NEXT: ${calendarTime(mission)} ${mission.title}`);
  else details.push(player.energy <= 45 ? "ENERGYが低めです。ゆっくり始めましょう。" : "WORLD SIGNALSは安定しています。");
  return { greeting, details:details.slice(0, 3) };
}
function playerProfile() {
  const records = state.log.length;
  const discoveries = state.discoveries?.length || 0;
  const p = state.player;
  const effects = [];
  if (p.energy >= 70) effects.push(["WELL RESTED", "ENERGYが安定しています", "good"]);
  if (p.focus >= 70) effects.push(["FOCUSED", "集中しやすい状態です", "focus"]);
  if (p.energy <= 40) effects.push(["TIRED", "少し休息が必要です", "low"]);
  if (p.focus <= 40) effects.push(["SCATTERED", "情報を減らすとよさそうです", "low"]);
  if (!effects.length) effects.push(["BALANCED", "いまの状態を維持しています", "calm"]);
  return {
    name: state.profile?.name || "PLAYER ONE",
    title: p.level >= 5 ? "WORLD EXPLORER" : p.level >= 3 ? "FIELD WALKER" : "WORLD WALKER",
    effects,
    abilities: [["OBSERVATION", Math.min(99, 34 + records * 3), "世界の変化に気づく力"], ["EXPLORATION", Math.min(99, 24 + discoveries * 11), "新しい場所を見つける力"], ["RECORDING", Math.min(99, 28 + records * 5), "世界を記録する力"]]
  };
}
function currentPlayerState(world = state.world || {}) {
  const p = state.player;
  const hour = new Date().getHours();
  const night = /NIGHT/.test(world.phase || phase(hour));
  const rain = /RAIN|DRIZZLE|THUNDER/.test(world.weather || "");
  const energy = Math.max(15, Math.min(100, p.energy + (night ? -8 : hour < 11 ? 5 : 0)));
  const focus = Math.max(15, Math.min(100, p.focus + (night ? -4 : hour < 11 ? 6 : 0)));
  const spirit = Math.max(15, Math.min(100, Math.round((energy + focus) / 2) + (rain ? 2 : 0)));
  const social = state.player.social ?? 64;
  const effects = [...playerProfile().effects];
  if (night) effects.unshift(["NIGHT PHASE", "ENERGYがゆっくり低下する時間帯です。", "low"]);
  if (rain) effects.unshift(["RAIN WORLD", "静かな観測に向いた空模様です。", "focus"]);
  return { hp:p.hp, energy, focus, spirit, social, effects:effects.slice(0, 3) };
}
function coreGrowth() {
  state.growth ||= { creativity:12, discipline:8, curiosity:15, communication:6, resilience:9 };
  return state.growth;
}
function weekKey() { const now = new Date(); const start = new Date(now.getFullYear(), 0, 1); return `${now.getFullYear()}-${Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)}`; }
function growthReview() {
  const cutoff = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA");
  const recent = state.log.filter((entry) => entry.day >= cutoff);
  const discoveries = recent.filter((entry) => entry.kind === "DISCOVERY").length;
  const records = recent.filter((entry) => /EVENT|DISCOVERY|ENCOUNTER/.test(entry.kind)).length;
  const creativity = records ? Math.max(1, Math.min(3, Math.ceil(records / 3))) : 0;
  const curiosity = discoveries || (recent.length ? 1 : 0);
  const discipline = new Set(recent.map((entry) => entry.day)).size;
  return [["creativity", "CREATIVITY", creativity], ["curiosity", "CURIOSITY", Math.min(3, curiosity)], ["discipline", "DISCIPLINE", Math.min(2, discipline)]].filter(([, , gain]) => gain > 0);
}
function soundtrackFor(world = state.world || {}) {
  const location = world.location || "";
  const hour = new Date().getHours();
  const byId = (id) => soundtrackLibrary.find((track) => track.id === id);
  if (hour < 5) return byId("logout");
  if (hour < 8) return byId("login");
  if (hour < 10) return byId("equip");
  if (/UNIVERSITY|CAMPUS/.test(location)) return byId("campus");
  if (/HOME|HOUSE/.test(location) && hour < 11) return byId("homeMorning");
  if (/HOME|HOUSE/.test(location) && hour >= 21) return byId("sleep");
  if (/HOME|HOUSE/.test(location) && hour >= 17) return byId("homeNight");
  if (/HOME|HOUSE/.test(location)) return byId("homeDay");
  return byId("walk");
}
function isUsableWorldValue(value) { return value && !/UNAVAILABLE|UNKNOWN|NOT SYNCED|GPS LOCKED/.test(String(value)); }
function detectWorldEvents(previous, current, now) {
  const detected = [];
  const event = (kind, title, detail) => detected.push({ id:crypto.randomUUID(), day:dateKey(), time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind, title, detail });
  if (previous) {
    if (isUsableWorldValue(previous.location) && isUsableWorldValue(current.location) && previous.location !== current.location) event("EVENT", "LOCATION UPDATED", `${previous.location} → ${current.location}`);
    if (isUsableWorldValue(previous.weather) && isUsableWorldValue(current.weather) && previous.weather !== current.weather) event("EVENT", "WEATHER SHIFT DETECTED", `${previous.weather} → ${current.weather}`);
    if (previous.phase && current.phase && previous.phase !== current.phase) event("EVENT", `${current.phase} PHASE BEGUN`, `WORLD TIME shifted from ${previous.phase}.`);
    if (Number.isFinite(Number(previous.temperature)) && Number.isFinite(Number(current.temperature)) && Math.abs(Number(previous.temperature) - Number(current.temperature)) >= 4) event("EVENT", "TEMPERATURE SHIFT", `${previous.temperature}° → ${current.temperature}°`);
  }
  if (isUsableWorldValue(current.location)) {
    state.discoveries ||= [];
    const locationKey = `${current.location} / ${current.region || ""}`;
    if (!state.discoveries.includes(locationKey)) { state.discoveries.push(locationKey); state.lastDiscovery = true; event("DISCOVERY", "NEW LOCATION DISCOVERED", `${current.location} has been added to your world.`); }
  }
  return detected;
}
function boot() {
  clearInterval(homeClock);
  app.innerHTML = `<section class="boot"><div class="boot-world"><div class="orb"><span>SYNC</span></div><h1>LIFE SYSTEM</h1><p class="sub">real world interface</p><div class="progress"><i></i></div><p id="boot-copy">世界との接続を準備しています…</p></div></section>`;
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
  state.lastDiscovery = false;
  const detectedEvents = detectWorldEvents(state.world, world, now);
  state.world = world;
  const title = world.weather !== "WEATHER UNAVAILABLE" ? `${world.weather} detected` : "World sync completed";
  const today = dateKey();
  state.lastSyncEvents = detectedEvents.length;
  if (detectedEvents.length) state.log.unshift(...detectedEvents);
  else if (!state.log.some((e) => e.day === today && e.title === title)) state.log.unshift({ id:crypto.randomUUID(), day:today, time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"EVENT", title, detail:world.ambience });
  save(); renderSync(detectedEvents.length ? `${detectedEvents.length} NEW EVENT${detectedEvents.length > 1 ? "S" : ""} DETECTED` : "WORLD SYNC COMPLETE"); setTimeout(renderHome, detectedEvents.length ? 1350 : 700);
}
function applyWorldAtmosphere(world) {
  app.dataset.phase = String(world.phase || phase(new Date().getHours())).toLowerCase();
  app.dataset.weather = /RAIN|DRIZZLE|THUNDER/.test(world.weather || "") ? "rain" : /CLOUD|OVERCAST|FOG/.test(world.weather || "") ? "cloud" : "clear";
}
function activateGlassPhysics(scope = app) {
  scope.querySelectorAll(".card, .detail-card, .sound-player, .navigator-message").forEach((card) => {
    const shine = (event) => { const rect = card.getBoundingClientRect(); card.style.setProperty("--shine-x", `${((event.clientX - rect.left) / rect.width) * 100}%`); card.style.setProperty("--shine-y", `${((event.clientY - rect.top) / rect.height) * 100}%`); card.classList.add("glass-active"); };
    card.addEventListener("pointermove", shine);
    card.addEventListener("pointerdown", shine);
    card.addEventListener("pointerleave", () => card.classList.remove("glass-active"));
    card.addEventListener("pointerup", () => setTimeout(() => card.classList.remove("glass-active"), 500));
  });
}
function renderSync(copy) { clearInterval(homeClock); app.innerHTML = `<section class="boot"><div class="boot-world"><div class="orb"><span>SYNC</span></div><h1>LIFE SYSTEM</h1><p class="sub">world sync in progress</p><div class="progress"><i></i></div><p>${esc(copy)}</p></div></section>`; }
function showStatus() {
  const modal = document.createElement("section"); modal.className = "status-dialog";
  modal.innerHTML = `<div class="dialog glass"><p class="eyebrow">day start status</p><h2>今日は、どんな状態で<br>世界に入りますか？</h2><p class="dialog-copy">いまの自分にいちばん近いものを選んでください。</p><div class="choices">${statuses.map((s) => `<button class="choice" data-status="${s}"><b>${s}</b><span>${statusJapanese[s]}</span></button>`).join("")}</div></div>`;
  modal.addEventListener("click", (e) => { const value = e.target.closest("[data-status]")?.dataset.status; if (!value) return; state.status ||= {}; state.status[dateKey()] = value; state.log.unshift({id:crypto.randomUUID(),day:dateKey(),time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),kind:"STATUS",title:`WORLD ENTRY: ${value}`,detail:`DAY START STATUS — ${statusJapanese[value]}`}); save(); modal.remove(); renderHome(); }); document.body.append(modal);
}
function renderHome() {
  const w = state.world || { location:"WORLD NOT SYNCED", region:"SYNCを押して世界に入る", weather:"UNKNOWN", temperature:"—", phase:phase(new Date().getHours()), season:season(new Date().getMonth()), ambience:"最初のWORLD SYNCを待っています。" };
  applyWorldAtmosphere(w);
  const now = new Date(); const p = state.player; const events = state.log.filter((e) => e.day === dateKey()).slice(0,3); const nav = navigatorBrief(w, p); const soundtrack = soundtrackFor(w); const activeTrack = soundtrackLibrary.find((track) => track.id === state.soundtrackId) || soundtrack; const nextMission = upcomingCalendarEvent(); const greeting = navigatorGreeting(w, p);
  app.innerHTML = `<div class="shell home-enter" data-page="home"><header class="header"><div><p class="eyebrow">world time</p><p class="clock">${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})}</p><p class="date">${now.toLocaleDateString([], {weekday:"long",day:"numeric",month:"long"})}</p></div><button id="sync" class="sync glass"><span class="eyebrow">sync</span><time>${w.syncedAt ? new Date(w.syncedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "READY"}</time></button></header>${pageNav("world")}<div class="stack">
  <button class="card glass navigator-greeting" data-page="navigator"><div class="navigator-greeting-head"><i></i><p class="eyebrow">navigator / online</p><span>OPEN →</span></div><strong>${esc(greeting.greeting)}</strong><div class="greeting-signals">${greeting.details.map((detail) => `<span>${esc(detail)}</span>`).join("")}</div></button>
  <section class="card glass world-card"><div class="section-head"><p class="eyebrow">world state</p><p class="world-live"><i></i>LIVE</p></div><div class="world-hero"><div class="location-mark">${icon("location")}</div><div class="place"><div><h2>${esc(w.location)}</h2><p class="region">${esc(w.region)}</p></div><span class="temperature">${esc(w.temperature)}°</span></div></div><div class="tiles visual-tiles"><div class="tile"><span class="tile-icon season-icon">${icon("sun")}</span><p class="eyebrow">season</p><b>${esc(w.season)}</b></div><div class="tile"><span class="tile-icon">${icon(phaseIcon(w.phase))}</span><p class="eyebrow">phase</p><b>${esc(w.phase)}</b></div><div class="tile weather-tile"><span class="tile-icon">${icon(weatherIcon(w.weather))}</span><p class="eyebrow">weather</p><b>${esc(w.weather)}</b></div></div><p class="ambience">${esc(w.ambience)}</p></section>
  ${nextMission ? `<button class="card glass next-mission-card" data-page="world"><div class="section-head"><p class="eyebrow">next world mission</p><span>CALENDAR</span></div><div><time>${calendarTime(nextMission)}</time><div><strong>${esc(nextMission.title)}</strong><p>${esc(nextMission.location || "GOOGLE CALENDAR EVENT")}</p></div><b>→</b></div></button>` : ""}
  <section class="card glass ${state.lastSyncEvents ? "events-new" : ""} ${state.lastDiscovery ? "discovery-detected" : ""}"><div class="section-head"><p class="eyebrow">event / discovery</p><p class="event-engine-live"><i></i>${state.lastSyncEvents ? `${state.lastSyncEvents} NEW` : `AUTO · ${events.length}`}</p></div>${state.lastDiscovery ? `<p class="discovery-banner">✦ NEW DISCOVERY UNLOCKED</p>` : state.lastSyncEvents ? `<p class="new-events-banner">WORLD SYNCで新しい変化を検知しました</p>` : ""}${events.length ? events.map((e) => `<div class="log-entry"><p class="eyebrow">${esc(e.kind)} · ${esc(e.time)}</p><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p></div>`).join("") : `<div class="event"><i class="signal"></i><p>まだ新しいシグナルはありません。<br>SYNCすると、いまの世界を観測できます。</p></div>`}</section>
  <button class="card glass navigator-preview" data-page="navigator"><div class="navigator-preview-core"><i></i><p class="eyebrow">navigator · ${esc(nav.tag)}</p></div><strong>${esc(nav.title)}</strong><p>${esc(nav.copy)}</p><span>OPEN NAVIGATOR →</span></button>
  <button class="card glass card-button" data-page="player"><div class="player"><div><p class="eyebrow">player</p><h2>${esc(playerProfile().name)}</h2><p class="region">${playerProfile().title} · DAY START: ${esc(state.status?.[dateKey()] || "UNKNOWN")}</p></div><div class="level glass"><span class="eyebrow">lv</span><strong>${p.level}</strong></div></div><div class="bar"><label>exp <span>${p.exp} / 500</span></label><i><span style="width:${p.exp / 5}%"></span></i></div><div class="three">${[["hp",p.hp,"#f4b9cc"],["energy",p.energy,"#bfe5d0"],["focus",p.focus,"#b8e5f2"]].map(([name,value,color]) => `<div class="bar"><label>${name}<span>${value}</span></label><i><span style="width:${value}%;background:${color}"></span></i></div>`).join("")}</div><p class="arrow">OPEN PLAYER →</p></button>
  <button class="card glass card-button now-playing-card" data-page="sound"><p class="eyebrow">now playing</p><div class="now"><i class="art ${activeTrack.tone}"></i><div><p><strong>${esc(activeTrack.scene)}</strong></p><small>${esc(activeTrack.role)} · ${state.soundtrackId ? "PLAYER SELECTED" : "WORLD SUGGESTION"}</small></div></div><p class="now-suggestion">OPEN SOUND PLAYER →</p></button>
  <button class="card glass card-button" data-page="log"><div class="section-head"><p class="eyebrow">calendar log</p><p class="eyebrow">${state.calendar?.events?.length || 0} events</p></div><p class="ambience">Google Calendarから届く、この世界のタイムライン。</p><p class="arrow">OPEN LOG →</p></button></div>
  <nav class="action-dock glass" aria-label="LIFE SYSTEM actions"><button data-page="log"><b>予定を見る</b></button><button data-action="observe"><b>世界を観測</b></button><button data-action="complete"><b>一日を閉じる</b></button></nav></div>`;
  document.querySelector("#sync").addEventListener("click", sync);
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => openView(button.dataset.action)));
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.page)));
  app.querySelectorAll(".header, .stack > .card, .action-dock").forEach((element, index) => element.style.setProperty("--enter-delay", `${index * 75}ms`));
  activateGlassPhysics();
  clearInterval(homeClock);
  homeClock = setInterval(() => {
    const clock = app.querySelector(".clock");
    const date = app.querySelector(".date");
    const nowLive = new Date();
    if (clock) clock.textContent = nowLive.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:false });
    if (date) date.textContent = nowLive.toLocaleDateString([], { weekday:"long", day:"numeric", month:"long" });
  }, 1000);
}

function navigate(page) {
  const screen = app.querySelector(".shell");
  if (!screen || screen.dataset.page === page) return;
  screen.classList.add("page-exit");
  setTimeout(() => renderPage(page), 240);
}

function renderPage(page) {
  clearInterval(homeClock);
  const w = state.world || { location:"WORLD NOT SYNCED", region:"SYNCを押して世界に入る", weather:"UNKNOWN", temperature:"—", phase:phase(new Date().getHours()), season:season(new Date().getMonth()), ambience:"最初のWORLD SYNCを待っています。" };
  const todayEvents = state.log.filter((event) => event.day === dateKey());
  const now = new Date();
  applyWorldAtmosphere(w);
  let content = "";
  if (page === "world") content = `<section class="page-hero world-page-hero"><p class="eyebrow">real world / live</p><h1>WORLD</h1><p>いま、この場所で進行している世界。</p><div class="world-orbital"><span class="location-mark">${icon("location")}</span><div><strong>${esc(w.location)}</strong><small>${esc(w.region)}</small></div><b>${esc(w.temperature)}°</b></div></section><section class="detail-card glass"><p class="eyebrow">world conditions</p><div class="condition-list"><div><span>${icon(phaseIcon(w.phase))}</span><p>TIME<b>${esc(w.phase)}</b></p></div><div><span>${icon(weatherIcon(w.weather))}</span><p>WEATHER<b>${esc(w.weather)}</b></p></div><div><span>${icon("sun")}</span><p>SEASON<b>${esc(w.season)}</b></p></div></div><p class="ambience">${esc(w.ambience)}</p><button class="primary-action" id="page-sync">SYNC WORLD</button></section>`;
  if (page === "player") { const profile = playerProfile(); const current = currentPlayerState(w); const growth = coreGrowth(); const review = growthReview(); const reviewed = state.growthReviewWeek === weekKey(); content = `<section class="page-hero player-hero"><p class="eyebrow">character profile</p><h1>PLAYER</h1><p>現実を歩く、あなた自身のステータス。</p><div class="player-portrait"><div class="player-level-ring" style="--level-progress:${state.player.exp / 5}%"><div class="level glass"><span class="eyebrow">lv</span><strong>${state.player.level}</strong></div></div><div><strong>${esc(profile.name)}</strong><small>${profile.title}<br>DAY START · ${esc(state.status?.[dateKey()] || "UNKNOWN")}</small></div></div></section><section class="detail-card glass player-identity"><div class="section-head"><p class="eyebrow">player identity</p><span>LOCAL PROFILE</span></div><input id="player-name" maxlength="24" value="${esc(profile.name)}" aria-label="プレイヤー名"><button class="subtle-action" id="save-player-name">SAVE IDENTITY</button></section><section class="detail-card glass"><div class="section-head"><p class="eyebrow">current status</p><span class="live-status"><i></i>LIVE</span></div><p class="status-intro">いまの時間・天気・PLAYER状態から変化します。</p><div class="parameter-list">${[["HP",current.hp,"#f4b9cc"],["ENERGY",current.energy,"#bfe5d0"],["FOCUS",current.focus,"#b8e5f2"],["SPIRIT",current.spirit,"#d8ccff"],["SOCIAL",current.social,"#f5d5a9"]].map(([label,value,color]) => `<div><p><span>${label}</span><b>${value}</b></p><i><span style="width:${value}%;background:${color}"></span></i></div>`).join("")}</div></section><section class="detail-card glass"><p class="eyebrow">status effects</p><div class="effect-list">${current.effects.map(([name,copy,tone]) => `<div class="effect ${tone}"><i></i><div><strong>${name}</strong><p>${copy}</p></div></div>`).join("")}</div></section><section class="detail-card glass core-growth"><div class="section-head"><p class="eyebrow">core growth</p><span>LONG TERM</span></div><p class="status-intro">数週間〜数か月で変化する、あなたの土台。</p><div class="growth-grid">${[["creativity","CREATIVITY","INT / MAGIC"],["discipline","DISCIPLINE","WILL / STAMINA"],["curiosity","CURIOSITY","PERCEPTION"],["communication","COMMUNICATION","CHA"],["resilience","RESILIENCE","VIT"]].map(([key,label,role]) => `<div><b>${growth[key]}</b><span>${label}</span><small>${role}</small></div>`).join("")}</div></section><section class="detail-card glass growth-review"><div class="section-head"><p class="eyebrow">growth review</p><span>${reviewed ? "COMPLETE" : "WEEKLY"}</span></div>${reviewed ? `<p class="status-intro">今週の成長は確定済みです。次の週にまた観測します。</p>` : review.length ? `<p class="status-intro">最近のWORLD LOGから、成長候補を検出しました。</p><div class="review-gains">${review.map(([, label, gain]) => `<span>${label}<b>+${gain}</b></span>`).join("")}</div><button class="primary-action" id="apply-growth">APPLY GROWTH</button>` : `<p class="status-intro">記録やDISCOVERYが増えると、成長候補が現れます。</p>`}</section>`; }
  if (page === "navigator") { const brief = navigatorBrief(w); content = `<section class="page-hero navigator-hero"><p class="eyebrow">personal world navigator</p><h1>NAVIGATOR</h1><p>現実のシグナルを読み、いまのあなたを補佐します。</p><div class="navigator-core ${brief.tone}"><i></i><span>ONLINE<br><b>LOCAL INTELLIGENCE</b></span><em><u></u><u></u><u></u><u></u></em></div></section><section class="navigator-message glass ${brief.tone}"><p class="eyebrow">${brief.tag}</p><h2>${brief.title}</h2><p>${brief.copy}</p><span class="navigator-scan">ANALYZING WORLD SIGNALS</span></section><section class="detail-card glass"><p class="eyebrow">signals read</p><div class="navigator-signals"><span>${esc(w.location || "LOCATION UNKNOWN")}<small>LOCATION</small></span><span>${esc(w.weather || "WEATHER UNKNOWN")}<small>WEATHER</small></span><span>${state.player.energy}<small>ENERGY</small></span><span>${state.player.focus}<small>FOCUS</small></span></div><button class="primary-action" id="refresh-navigator">OBSERVE AGAIN</button></section><p class="navigator-note">このNAVIGATORは端末内のデータだけで観測します。外部AI・課金・データ送信はありません。</p>`; }
  if (page === "log") { const calendarEvents = state.calendar?.events || []; content = `<section class="page-hero"><p class="eyebrow">google calendar / timeline</p><h1>PLAYER LOG</h1><p>Google Calendarが記録する、あなたの世界のタイムライン。</p><div class="log-stat"><b>${calendarEvents.length}</b><span>CALENDAR<br>EVENTS</span></div></section>${calendarEvents.length ? `<section class="detail-card glass full-log calendar-timeline"><div class="section-head"><p class="eyebrow">world schedule</p><span>30 DAYS BACK · 14 DAYS AHEAD</span></div>${[...calendarEvents].reverse().map((event) => { const [label,copy,tone] = calendarLogState(event); return `<article class="calendar-entry ${tone}"><p class="eyebrow">${esc(calendarLogDate(event))} · ${esc(calendarTime(event))} · <span>${label}</span></p><strong>${esc(event.title)}</strong><p>${esc(event.location || copy)}</p></article>`; }).join("")}</section>` : `<section class="detail-card glass calendar-link"><p class="eyebrow">calendar not connected</p><strong>予定をLOGに読み込もう</strong><p>手入力は必要ありません。Google Calendarを連携して更新すると、予定がPLAYER LOGになります。</p><button class="primary-action" data-page="system">GO TO CALENDAR SETUP</button></section>`}`; }
  if (page === "sound") { const suggested = soundtrackFor(w); const selected = soundtrackLibrary.find((track) => track.id === state.soundtrackId) || suggested; content = `<section class="page-hero sound-hero ${suggested.tone}"><p class="eyebrow">real world soundtrack</p><h1>SOUND</h1><p>いまの現実に、世界の音楽を重ねる。</p><div class="sound-visual"><i></i><i></i><i></i><i></i><i></i></div></section><section class="sound-player glass ${suggested.tone}"><div class="section-head"><p class="eyebrow">world recommendation</p><span>AUTO</span></div><h2>${esc(suggested.scene)}</h2><p>${esc(suggested.role)} · いまの時間と場所から提案</p><iframe title="${esc(suggested.scene)} Spotify player" src="https://open.spotify.com/embed/track/${suggested.track}?utm_source=generator" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe><button class="primary-action" id="use-recommendation">SET AS NOW PLAYING</button></section>${selected.id !== suggested.id ? `<section class="detail-card glass selected-track"><p class="eyebrow">now playing</p><strong>${esc(selected.scene)}</strong><span>${esc(selected.role)}</span></section>` : ""}<section class="detail-card glass soundtrack-library"><div class="section-head"><p class="eyebrow">my soundtrack</p><span>${soundtrackLibrary.length} SCENES</span></div><p class="status-intro">シーンを選ぶと、いまのBGMとして固定できます。</p><div class="track-list">${soundtrackLibrary.map((track) => `<button class="track-choice ${selected.id === track.id ? "selected" : ""}" data-track="${track.id}"><i class="${track.tone}"></i><div><b>${esc(track.scene)}</b><span>${esc(track.role)}</span></div><em>${selected.id === track.id ? "NOW" : "SELECT"}</em></button>`).join("")}</div><button class="subtle-action" id="auto-soundtrack">RETURN TO AUTO SUGGESTION</button></section>`; }
  if (page === "system") { const calendar = state.calendar; content = `<section class="page-hero"><p class="eyebrow">life system settings</p><h1>SYSTEM</h1><p>現実とLIFE SYSTEMをつなぐ設定。</p><div class="system-status"><i></i><span>WORLD INTERFACE<br><b>ONLINE</b></span></div></section><section class="detail-card glass calendar-link"><div class="section-head"><p class="eyebrow">google calendar</p><span>${calendar ? "LINKED" : "NOT CONNECTED"}</span></div><strong>${calendar ? "WORLD SCHEDULE READY" : "CONNECT YOUR SCHEDULE"}</strong><p>${calendar ? `${calendar.events.length} calendar events · ${new Date(calendar.syncedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} synced` : "予定を読み取り、PLAYER LOGとWORLD MISSIONとして表示します。"}</p><button class="primary-action" id="connect-calendar">${calendar ? "REFRESH CALENDAR" : "CONNECT GOOGLE CALENDAR"}</button></section><section class="detail-card glass system-list"><button id="system-sync"><span>WORLD SYNC</span><small>現在地・天気を更新</small><b>→</b></button><button id="system-status"><span>DAY START STATUS</span><small>今日の状態を選び直す</small><b>→</b></button><div><span>PLAYER LOG</span><small>GOOGLE CALENDAR ONLY · 手入力なし</small></div></section>`; }
  app.innerHTML = `<div class="shell page-shell page-enter" data-page="${page}"><header class="page-header"><button class="home-button" data-home>← <span>HOME</span></button><p class="eyebrow">LIFE SYSTEM</p></header>${pageNav(page)}<main class="page-content">${content}</main></div>`;
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.page)));
  app.querySelector("[data-home]").addEventListener("click", () => { const shell = app.querySelector(".shell"); shell.classList.add("page-exit"); setTimeout(renderHome, 240); });
  app.querySelector("#page-sync")?.addEventListener("click", sync);
  app.querySelector("#system-sync")?.addEventListener("click", sync);
  app.querySelector("#system-status")?.addEventListener("click", showStatus);
  app.querySelector("#connect-calendar")?.addEventListener("click", () => connectGoogleCalendar("system"));
  app.querySelector("#save-player-name")?.addEventListener("click", () => { const name = app.querySelector("#player-name").value.trim(); if (!name) return; state.profile ||= {}; state.profile.name = name.toUpperCase(); save(); renderPage("player"); });
  app.querySelector("#apply-growth")?.addEventListener("click", () => { growthReview().forEach(([key,, gain]) => { state.growth[key] = Math.min(99, state.growth[key] + gain); }); state.growthReviewWeek = weekKey(); state.log.unshift({ id:crypto.randomUUID(), day:dateKey(), time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"SYSTEM", title:"CORE GROWTH UPDATED", detail:"Weekly growth review completed." }); save(); renderPage("player"); });
  app.querySelector("#refresh-navigator")?.addEventListener("click", () => { const shell = app.querySelector(".page-shell"); shell.classList.add("navigator-refresh"); setTimeout(() => renderPage("navigator"), 360); });
  app.querySelectorAll("[data-track]").forEach((button) => button.addEventListener("click", () => { state.soundtrackId = button.dataset.track; delete state.soundtrack; save(); renderPage("sound"); }));
  app.querySelector("#use-recommendation")?.addEventListener("click", () => { state.soundtrackId = soundtrackFor(w).id; delete state.soundtrack; save(); renderPage("sound"); });
  app.querySelector("#auto-soundtrack")?.addEventListener("click", () => { delete state.soundtrackId; delete state.soundtrack; save(); renderPage("sound"); });
  activateGlassPhysics();
}

function closeView() { document.querySelector(".view-layer")?.remove(); }
function openView(name) {
  const todayEvents = state.log.filter((event) => event.day === dateKey());
  const w = state.world || {};
  let content = "";
  if (name === "record") content = `<p class="eyebrow">record event</p><h2>世界で起きたことを<br>残しますか？</h2><p class="view-copy">短い一文で大丈夫です。LIFE SYSTEMが今日の記録に加えます。</p><div class="record-types">${["EVENT","DISCOVERY","ENCOUNTER"].map((kind, i) => `<button class="type-choice ${i === 0 ? "selected" : ""}" data-kind="${kind}">${kind}</button>`).join("")}</div><textarea id="event-note" maxlength="100" placeholder="例：新しいカフェに入った"></textarea><button class="primary-action" id="save-event">RECORD EVENT</button>`;
  if (name === "observe") content = `<p class="eyebrow">observe world</p><h2>いま、この世界は<br>こんな状態です。</h2><div class="observation"><p class="eyebrow">current world state</p><strong>${esc(w.location || "WORLD UNAVAILABLE")}</strong><p>${esc(w.region || "SYNCで現在地を観測できます")}</p><div class="observation-grid"><span>${esc(w.phase || "—")}<small>時間帯</small></span><span>${esc(w.weather || "—")}<small>天気</small></span><span>${esc(w.temperature ?? "—")}°<small>気温</small></span></div><p class="view-copy">${esc(w.ambience || "まだ世界は同期されていません。")}</p></div><button class="primary-action" id="close-observation">RETURN TO WORLD</button>`;
  if (name === "complete") content = `<p class="eyebrow">day complete</p><h2>今日の世界を<br>ここで閉じますか？</h2><div class="result-grid"><div><b>${todayEvents.length}</b><span>EVENTS</span></div><div><b>+${todayEvents.length * 20}</b><span>EXP</span></div><div><b>${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</b><span>WORLD TIME</span></div></div><div class="result-status"><p class="eyebrow">day start</p><strong>${esc(state.status?.[dateKey()] || "UNKNOWN")}</strong></div><button class="primary-action" id="finish-day">COMPLETE DAY</button>`;
  if (name === "log") content = `<p class="eyebrow">world log</p><h2>この世界で起きた<br>すべての記録。</h2><div class="full-log">${state.log.length ? state.log.map((e) => `<article><p class="eyebrow">${esc(e.day)} · ${esc(e.time)} · ${esc(e.kind)}</p><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p></article>`).join("") : "<p class=\"view-copy\">まだ記録はありません。</p>"}</div>`;
  if (name === "player") content = `<p class="eyebrow">player detail</p><h2>PLAYER ONE</h2><p class="view-copy">いまの状態を、プレイヤーとして見つめるための画面です。</p><div class="result-grid"><div><b>${state.player.hp}</b><span>HP</span></div><div><b>${state.player.energy}</b><span>ENERGY</span></div><div><b>${state.player.focus}</b><span>FOCUS</span></div></div>`;
  const layer = document.createElement("section"); layer.className = "view-layer";
  layer.innerHTML = `<div class="view-panel glass"><button class="view-close" aria-label="閉じる">← <span>BACK</span></button><div class="view-content">${content}</div></div>`;
  document.body.append(layer);
  requestAnimationFrame(() => layer.classList.add("is-open"));
  layer.querySelector(".view-close").addEventListener("click", closeView);
  layer.querySelectorAll(".type-choice").forEach((button) => button.addEventListener("click", () => { layer.querySelectorAll(".type-choice").forEach((item) => item.classList.remove("selected")); button.classList.add("selected"); }));
  layer.querySelector("#save-event")?.addEventListener("click", () => { const note = layer.querySelector("#event-note").value.trim(); if (!note) return; const kind = layer.querySelector(".type-choice.selected").dataset.kind; state.log.unshift({ id:crypto.randomUUID(), day:dateKey(), time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind, title:note, detail:"PLAYER RECORD" }); state.player.exp = Math.min(500, state.player.exp + 20); save(); closeView(); renderHome(); });
  layer.querySelector("#close-observation")?.addEventListener("click", closeView);
  layer.querySelector("#finish-day")?.addEventListener("click", () => { const title = "DAY COMPLETE"; if (!state.log.some((e) => e.day === dateKey() && e.title === title)) state.log.unshift({ id:crypto.randomUUID(), day:dateKey(), time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"SYSTEM", title, detail:`${todayEvents.length} events recorded · +${todayEvents.length * 20} EXP` }); save(); closeView(); renderHome(); });
}
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { updateViaCache:"none" }));
boot();
