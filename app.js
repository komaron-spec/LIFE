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
  app.innerHTML = `<div class="shell home-enter"><header class="header"><div><p class="eyebrow">world time</p><p class="clock">${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})}</p><p class="date">${now.toLocaleDateString([], {weekday:"long",day:"numeric",month:"long"})}</p></div><button id="sync" class="sync glass"><span class="eyebrow">sync</span><time>${w.syncedAt ? new Date(w.syncedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "READY"}</time></button></header><div class="stack">
  <section class="card glass"><div class="section-head"><p class="eyebrow">world state <span class="jp-label">世界の状態</span></p><p class="eyebrow">${esc(w.phase)}</p></div><div class="place"><div><h2>${esc(w.location)}</h2><p class="region">${esc(w.region)}</p></div><span class="temperature">${esc(w.temperature)}°</span></div><div class="tiles"><div class="tile"><p class="eyebrow">season <span class="jp-label">季節</span></p><b>${esc(w.season)}</b></div><div class="tile"><p class="eyebrow">phase <span class="jp-label">時間帯</span></p><b>${esc(w.phase)}</b></div><div class="tile"><p class="eyebrow">weather <span class="jp-label">天気</span></p><b>${esc(w.weather)}</b></div></div><p class="ambience">${esc(w.ambience)}</p></section>
  <section class="card glass"><div class="section-head"><p class="eyebrow">event / discovery <span class="jp-label">最近の出来事</span></p><p class="eyebrow">${events.length} detected</p></div>${events.length ? events.map((e) => `<div class="log-entry"><p class="eyebrow">${esc(e.kind)} · ${esc(e.time)}</p><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p></div>`).join("") : `<div class="event"><i class="signal"></i><p>まだ新しいシグナルはありません。<br>SYNCすると、いまの世界を観測できます。</p></div>`}</section>
  <button class="card glass card-button" data-action="player"><div class="player"><div><p class="eyebrow">player <span class="jp-label">プレイヤー</span></p><h2>PLAYER ONE</h2><p class="region">DAY START: ${esc(state.status?.[dateKey()] || "UNKNOWN")} <span class="jp-inline">${statusJapanese[state.status?.[dateKey()] || "UNKNOWN"]}</span></p></div><div class="level glass"><span class="eyebrow">lv</span><strong>${p.level}</strong></div></div><div class="bar"><label>exp <span>${p.exp} / 500</span></label><i><span style="width:${p.exp / 5}%"></span></i></div><div class="three">${[["hp",p.hp,"#f4b9cc"],["energy",p.energy,"#bfe5d0"],["focus",p.focus,"#b8e5f2"]].map(([name,value,color]) => `<div class="bar"><label>${name}<span>${value}</span></label><i><span style="width:${value}%;background:${color}"></span></i></div>`).join("")}</div><p class="arrow">OPEN PLAYER →</p></button>
  <section class="card glass"><p class="eyebrow">now playing</p><div class="now"><i class="art"></i><div><p><strong>Untitled Ambient</strong></p><small>YOUR SOUNDTRACK · LOCAL</small></div></div></section>
  <button class="card glass card-button" data-action="log"><div class="section-head"><p class="eyebrow">world log <span class="jp-label">世界の記録</span></p><p class="eyebrow">${state.log.length} entries</p></div><p class="ambience">この端末に記録された、あなたの世界で起きたこと。</p><p class="arrow">OPEN LOG →</p></button></div>
  <nav class="action-dock glass" aria-label="LIFE SYSTEM actions"><button data-action="record"><b>＋ RECORD</b><span>記録する</span></button><button data-action="observe"><b>OBSERVE</b><span>世界を観測</span></button><button data-action="complete"><b>DAY END</b><span>一日を閉じる</span></button></nav></div>`;
  document.querySelector("#sync").addEventListener("click", sync);
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => openView(button.dataset.action)));
}

function closeView() { document.querySelector(".view-layer")?.remove(); }
function openView(name) {
  const todayEvents = state.log.filter((event) => event.day === dateKey());
  const w = state.world || {};
  let content = "";
  if (name === "record") content = `<p class="eyebrow">record event</p><h2>世界で起きたことを<br>残しますか？</h2><p class="view-copy">短い一文で大丈夫です。LIFE SYSTEMが今日の記録に加えます。</p><div class="record-types">${["EVENT","DISCOVERY","ENCOUNTER"].map((kind, i) => `<button class="type-choice ${i === 0 ? "selected" : ""}" data-kind="${kind}">${kind}</button>`).join("")}</div><textarea id="event-note" maxlength="100" placeholder="例：新しいカフェに入った"></textarea><button class="primary-action" id="save-event">RECORD EVENT <span>記録する</span></button>`;
  if (name === "observe") content = `<p class="eyebrow">observe world</p><h2>いま、この世界は<br>こんな状態です。</h2><div class="observation"><p class="eyebrow">current world state</p><strong>${esc(w.location || "WORLD UNAVAILABLE")}</strong><p>${esc(w.region || "SYNCで現在地を観測できます")}</p><div class="observation-grid"><span>${esc(w.phase || "—")}<small>時間帯</small></span><span>${esc(w.weather || "—")}<small>天気</small></span><span>${esc(w.temperature ?? "—")}°<small>気温</small></span></div><p class="view-copy">${esc(w.ambience || "まだ世界は同期されていません。")}</p></div><button class="primary-action" id="close-observation">RETURN TO WORLD <span>戻る</span></button>`;
  if (name === "complete") content = `<p class="eyebrow">day complete</p><h2>今日の世界を<br>ここで閉じますか？</h2><div class="result-grid"><div><b>${todayEvents.length}</b><span>EVENTS<br>出来事</span></div><div><b>+${todayEvents.length * 20}</b><span>EXP<br>経験値</span></div><div><b>${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</b><span>WORLD TIME<br>記録時刻</span></div></div><div class="result-status"><p class="eyebrow">day start</p><strong>${esc(state.status?.[dateKey()] || "UNKNOWN")} <span>${statusJapanese[state.status?.[dateKey()] || "UNKNOWN"]}</span></strong></div><button class="primary-action" id="finish-day">COMPLETE DAY <span>今日を完了する</span></button>`;
  if (name === "log") content = `<p class="eyebrow">world log</p><h2>この世界で起きた<br>すべての記録。</h2><div class="full-log">${state.log.length ? state.log.map((e) => `<article><p class="eyebrow">${esc(e.day)} · ${esc(e.time)} · ${esc(e.kind)}</p><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p></article>`).join("") : "<p class=\"view-copy\">まだ記録はありません。</p>"}</div>`;
  if (name === "player") content = `<p class="eyebrow">player detail</p><h2>PLAYER ONE</h2><p class="view-copy">いまの状態を、プレイヤーとして見つめるための画面です。</p><div class="result-grid"><div><b>${state.player.hp}</b><span>HP<br>コンディション</span></div><div><b>${state.player.energy}</b><span>ENERGY<br>エネルギー</span></div><div><b>${state.player.focus}</b><span>FOCUS<br>集中</span></div></div>`;
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
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
boot();
