import { japanAtlas, worldAtlas } from "./atlas-data.js";
import { skillNodes, skillDomains } from "./skills-data.js?v=2";

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
if (state.fieldScans) {
  delete state.fieldScans;
  state.log = (state.log || []).filter((entry) => entry.kind !== "SCAN");
  state.systemLog = (state.systemLog || []).filter((entry) => !/visual field registered|\/ scan \d+$/.test(entry.detail || ""));
  localStorage.setItem(KEY, JSON.stringify(state));
}
let homeClock;
let coreAmbientTimer;
const dateKey = () => new Date().toLocaleDateString("en-CA");
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const areaState = () => (state.areas ||= []);
const playDataState = () => (state.playData ||= { initializedAt:"2006-02-13", worldInstance:"EARTH-01", saveType:"CONTINUOUS" });
const dailySessionState = () => (state.dailySession ||= { day:dateKey(), startedAt:new Date(`${dateKey()}T00:00:00`).toISOString(), status:"active" });
function gameDay(now = new Date()) { const start = new Date(`${playDataState().initializedAt}T00:00:00`); return Math.max(1, Math.floor((new Date(now).setHours(0,0,0,0) - start) / 86400000) + 1); }
function formatPlayTime(now = new Date()) { const start = new Date(`${playDataState().initializedAt}T00:00:00`); let seconds = Math.max(0, Math.floor((now - start) / 1000)); const years = Math.floor(seconds / 31557600); seconds -= years * 31557600; const days = Math.floor(seconds / 86400); seconds -= days * 86400; const hours = Math.floor(seconds / 3600); seconds -= hours * 3600; const minutes = Math.floor(seconds / 60); return `${years}Y ${days}D ${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`; }
function sessionSummary(day = dateKey()) { const entries = (state.log || []).filter((entry) => entry.day === day); const transitions = entries.filter((entry) => /AREA ENTERED|AREA EXITED|WORLD TRANSITION|REGION CHANGED/.test(entry.title)); const discoveries = entries.filter((entry) => /DISCOVERY|CODEX UPDATED|TITLE ACQUIRED/.test(entry.title)); const events = entries.filter((entry) => entry.kind !== "SYSTEM" && entry.kind !== "WORLD"); return { events:events.length, areas:new Set(transitions.map((entry) => entry.detail.split(" → ").pop()).filter(Boolean)).size, discoveries:discoveries.length, entries:entries.length }; }
function ensureDailySession(now = new Date()) {
  const session = dailySessionState(); const today = dateKey();
  if (session.day === today) return session;
  const summary = sessionSummary(session.day);
  state.sessionHistory ||= [];
  if (!state.sessionHistory.some((entry) => entry.day === session.day)) state.sessionHistory.unshift({ day:session.day, completedAt:now.toISOString(), ...summary });
  state.sessionHistory = state.sessionHistory.slice(0,366);
  if (!(state.log || []).some((entry) => entry.day === session.day && entry.title === "DAY COMPLETE")) state.log.unshift({ id:crypto.randomUUID(), day:session.day, time:"24:00", kind:"SYSTEM", title:"DAY COMPLETE", detail:`${summary.events} EVENTS · ${summary.areas} AREAS · ${summary.discoveries} DISCOVERIES` });
  state.dailySession = { day:today, startedAt:new Date(`${today}T00:00:00`).toISOString(), status:"active" }; save(); return state.dailySession;
}
let systemAudio;
let idleTimer;
let homeBgm;
let homeBgmFade;
let homeBgmSceneId;
let fieldEntryAudio;
let celebrationAudio;
const feedbackSettings = () => (state.feedback ||= { sound:true });
const homeBgmSettings = () => (state.homeBgm ||= { enabled:true });
const celebrationState = () => (state.celebrations ||= { played:{}, pending:null });
function celebrationKey(kind, now = new Date()) { return `${dateKey(now)}:${kind}`; }
function queueCelebration(kind, label, detail, now = new Date()) {
  const celebrations = celebrationState(); const key = celebrationKey(kind, now);
  if (celebrations.played[key] || celebrations.pending) return false;
  celebrations.pending = { key, label, detail, queuedAt:now.toISOString() };
  recordSystemMessage({ level:3, title:"CELEBRATION EVENT", detail:`${label} — ${detail}`, target:"player" });
  save(); return true;
}
function scheduleLoginCelebration(now = new Date()) {
  const birthday = new Date(`${playDataState().initializedAt}T00:00:00`);
  if (birthday.getMonth() === now.getMonth() && birthday.getDate() === now.getDate()) return queueCelebration("birthday", "BIRTHDAY EVENT", "Happy birthday, PLAYER.", now);
  const milestones = [100, 1000, 5000, 7777, 10000]; const day = gameDay(now);
  if (milestones.includes(day)) return queueCelebration(`day-${day}`, "PLAY TIME MILESTONE", `DAY ${day.toLocaleString("en-US")} reached.`, now);
  return false;
}
function playPendingCelebration() {
  const celebrations = celebrationState(); const pending = celebrations.pending;
  if (!pending || (celebrationAudio && !celebrationAudio.paused)) return false;
  const resumeHomeBgm = Boolean(homeBgm && !homeBgm.paused && homeBgmSettings().enabled);
  if (resumeHomeBgm) fadeHomeBgm(.018, 260);
  celebrationAudio = new Audio("./assets/audio/celebration-event.mp3");
  celebrationAudio.loop = false; celebrationAudio.preload = "auto"; celebrationAudio.volume = .001;
  celebrationAudio.addEventListener("ended", () => { if (!homeBgmSettings().enabled) return; if (resumeHomeBgm) fadeHomeBgm(.16, 900); else startHomeBgm(); }, { once:true });
  celebrationAudio.play().then(() => {
    celebrations.played[pending.key] = new Date().toISOString(); celebrations.pending = null; save();
    const started = performance.now(); const fade = (time) => { const progress = Math.min(1, (time - started) / 850); celebrationAudio.volume = .28 * progress; if (progress < 1) requestAnimationFrame(fade); }; requestAnimationFrame(fade);
  }).catch(() => { if (resumeHomeBgm) fadeHomeBgm(.16, 400); });
  return true;
}
function isCampusArea(world = state.world || {}) { return Boolean(world.area?.registered && /CAMPUS|KGU|大学|キャンパス/i.test(String(world.area.name || ""))); }
function isOutsideHome(world = state.world || {}) { return Boolean(world.area?.type && world.area.type !== "home"); }
function isRainWorld(world = state.world || {}) { return /RAIN|DRIZZLE|SHOWER|THUNDER/i.test(String(world.weather || "")); }
function activeMealEvent(now = new Date()) {
  return (state.calendar?.events || []).find((event) => {
    const start = new Date(event.start?.dateTime || event.start?.date); const end = new Date(event.end?.dateTime || event.end?.date);
    return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && now < end && /朝食|昼食|夕食|食べる/.test(String(event.title || ""));
  });
}
const homeBgmScenes = [
  { id:"christmas-world", label:"CHRISTMAS WORLD", source:"./assets/audio/christmas-world.mp3", matches:(now) => now.getMonth() === 11 && [24,25].includes(now.getDate()) },
  { id:"meal-phase", label:"MEAL PHASE", source:"./assets/audio/meal-phase.mp3", matches:(now) => Boolean(activeMealEvent(now)) },
  { id:"rain-field", label:"RAIN / FIELD", source:"./assets/audio/rain-field.mp3", matches:(now, world) => isOutsideHome(world) && isRainWorld(world) },
  { id:"campus-day", label:"CAMPUS / DAY", source:"./assets/audio/campus-day.mp3", matches:(now, world) => isCampusArea(world) && ["MORNING","AFTERNOON"].includes(phase(now.getHours())) },
  { id:"home-deep-night", label:"HOME / DEEP NIGHT", source:"./assets/audio/home-deep-night.mp3", matches:(now) => { const minutes = now.getHours() * 60 + now.getMinutes(); return minutes >= 90 && minutes < 270; } },
  { id:"home-morning", label:"HOME / MORNING", source:"./assets/audio/home-morning.mp3", matches:(now) => now.getHours() >= 5 && now.getHours() < 11 },
  { id:"home-night", label:"HOME / NIGHT", source:"./assets/audio/home-night.mp3", matches:() => true }
];
function selectedHomeBgmScene(now = new Date(), world = state.world || {}) { return homeBgmScenes.find((scene) => scene.matches(now, world)) || homeBgmScenes.at(-1); }
function getHomeBgm(scene = selectedHomeBgmScene()) {
  if (!homeBgm) {
    homeBgm = new Audio(scene.source);
    homeBgmSceneId = scene.id;
    homeBgm.loop = true;
    homeBgm.preload = "auto";
    homeBgm.volume = 0.001;
  }
  return homeBgm;
}
function fadeHomeBgm(target, duration = 650, after) {
  const audio = getHomeBgm(); const from = audio.volume; const started = performance.now();
  cancelAnimationFrame(homeBgmFade);
  const frame = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    audio.volume = Math.max(0, Math.min(1, from + (target - from) * progress));
    if (progress < 1) homeBgmFade = requestAnimationFrame(frame); else after?.();
  };
  homeBgmFade = requestAnimationFrame(frame);
}
function startHomeBgm() {
  if (!homeBgmSettings().enabled) return Promise.resolve(false);
  syncHomeBgmScene();
  const audio = getHomeBgm();
  const playback = audio.play();
  return playback.then(() => { fadeHomeBgm(.16, 900); return true; }).catch(() => false);
}
function syncHomeBgmScene() {
  const next = selectedHomeBgmScene();
  if (!homeBgm || homeBgmSceneId === next.id) return;
  const audio = homeBgm; const keepPlaying = !audio.paused;
  fadeHomeBgm(0, 460, () => {
    audio.pause(); audio.src = next.source; audio.load(); audio.volume = 0.001; homeBgmSceneId = next.id;
    if (keepPlaying && homeBgmSettings().enabled) audio.play().then(() => fadeHomeBgm(.16, 820)).catch(() => {});
  });
}
function stopHomeBgm() {
  homeBgmSettings().enabled = false; save();
  if (!homeBgm) return;
  fadeHomeBgm(0, 360, () => homeBgm.pause());
}
function isMorningFieldEntry(previous = {}, next = {}, now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes < 540 && previous.area?.type === "home" && previous.area?.id !== next.area?.id;
}
function playMorningFieldEntry(previous, next, now = new Date()) {
  if (!isMorningFieldEntry(previous, next, now) || (fieldEntryAudio && !fieldEntryAudio.paused)) return;
  const key = `${dateKey()}:${previous.area.id}:morning-field-entry`;
  if (state.audioEvents?.[key]) return;
  const resumeHomeBgm = Boolean(homeBgm && !homeBgm.paused && homeBgmSettings().enabled);
  if (resumeHomeBgm) fadeHomeBgm(.025, 260);
  fieldEntryAudio = new Audio("./assets/audio/morning-field-entry.mp3");
  fieldEntryAudio.loop = false; fieldEntryAudio.preload = "auto"; fieldEntryAudio.volume = .001;
  fieldEntryAudio.addEventListener("ended", () => { if (resumeHomeBgm && homeBgmSettings().enabled) fadeHomeBgm(.16, 700); }, { once:true });
  fieldEntryAudio.play().then(() => { state.audioEvents ||= {}; state.audioEvents[key] = now.toISOString(); save(); const started = performance.now(); const fade = (time) => { const progress = Math.min(1, (time - started) / 800); fieldEntryAudio.volume = .24 * progress; if (progress < 1) requestAnimationFrame(fade); }; requestAnimationFrame(fade); }).catch(() => { if (resumeHomeBgm) fadeHomeBgm(.16, 400); });
}
function renderHomeBgmControl() {
  const enabled = homeBgmSettings().enabled;
  const scene = selectedHomeBgmScene();
  const title = scene.id === "christmas-world" ? "Cherry Berry Merry" : scene.id === "meal-phase" ? "Guruguru Usagi" : scene.id === "rain-field" ? "Blooming moon" : scene.id === "campus-day" ? "Koi is Love" : scene.id === "home-morning" ? "Midsummer cat" : scene.id === "home-deep-night" ? "Suger story" : "step by step - night arranged";
  return `<section class="detail-card glass home-bgm-control"><div class="section-head"><p class="eyebrow">local world audio</p><span>${enabled ? scene.label : "OFF"}</span></div><strong>HOME AMBIENCE</strong><p>${scene.label}：${title}。最初の操作後から小さな音量でループします。</p><button class="subtle-action" id="toggle-home-bgm">${enabled ? "HOME BGMを停止" : "HOME BGMを開始"}</button></section>`;
}
const notificationSettings = () => (state.notifications ||= { morning:true, evening:true, calendar:true, sent:{} });
const navigatorSettings = () => (state.navigator ||= { intervention:"standard" });
const interventionLevels = {
  minimal:{ rank:1, label:"MINIMAL", copy:"重要な見落としだけ" },
  standard:{ rank:2, label:"STANDARD", copy:"必要なときだけ補佐する" },
  active:{ rank:3, label:"ACTIVE", copy:"探索の機会も知らせる" },
  full:{ rank:4, label:"FULL NAVIGATION", copy:"利用できる情報を常に案内" }
};
const notificationPermission = () => ("Notification" in window ? Notification.permission : "unsupported");
async function showLifeNotification(title, body, tag = "life-system") {
  if (notificationPermission() !== "granted") return false;
  const payload = { type:"life-notify", title, options:{ body, tag, icon:"./icons/icon.svg", badge:"./icons/icon.svg" } };
  try { const registration = await navigator.serviceWorker.ready; registration.active?.postMessage(payload); return true; } catch { new Notification(title, payload.options); return true; }
}
async function requestLifeNotifications() {
  if (!("Notification" in window)) return "unsupported";
  const permission = await Notification.requestPermission(); save(); return permission;
}
function legacyCheckLifeReminders() {
  const settings = notificationSettings(); if (notificationPermission() !== "granted") return;
  const now = new Date(); const stamp = dateKey(); const hour = now.getHours(); const minute = now.getMinutes();
  const sendOnce = (key,title,body) => { if (settings.sent[key]) return; settings.sent[key] = now.toISOString(); save(); showLifeNotification(title, body, key); };
  if (settings.morning && hour === 8 && minute < 2) sendOnce(`${stamp}:morning`, "LIFE SYSTEM", "おはよう、プレイヤー。WORLD LOGINを開始できます。");
  if (settings.evening && hour === 21 && minute < 2) sendOnce(`${stamp}:evening`, "LIFE SYSTEM", "NIGHT PHASE。今日の世界を閉じますか？");
  if (settings.calendar) (state.calendar?.events || []).forEach((event) => { const start = new Date(event.start?.dateTime || event.start?.date); const minutes = Math.round((start - now) / 60000); const key = `${event.id}:${start.toISOString()}`; if (minutes > 0 && minutes <= 30) sendOnce(key, "次のWORLD MISSION", `${event.title}まであと${minutes}分です。`); });
}
function checkLifeReminders() {
  const settings = notificationSettings(); if (notificationPermission() !== "granted") return;
  const now = new Date(); const stamp = dateKey(); const hour = now.getHours(); const minute = now.getMinutes();
  const sendOnce = (key,title,body) => { if (settings.sent[key]) return; settings.sent[key] = now.toISOString(); save(); showLifeNotification(title, body, key); };
  const todayEvents = (state.calendar?.events || []).filter((event) => new Date(event.start?.dateTime || event.start?.date).toDateString() === now.toDateString());
  if (settings.morning && hour === 8 && minute < 2) {
    const first = todayEvents.find((event) => new Date(event.start?.dateTime || event.start?.date) > now);
    sendOnce(`${stamp}:morning`, "WORLD LOGIN", `おはよう、プレイヤー。\n${todayEvents.length ? `今日の固定EVENTは${todayEvents.length}件です。` : "今日はFREE ROAMです。"}${first ? `\n最初の予定：${calendarTime(first)} 《${first.title}》` : ""}`);
  }
  if (settings.evening && hour === 21 && minute < 2) sendOnce(`${stamp}:evening`, "NIGHT PHASE", "本日のSESSIONは夜へ移行しました。\n操作は必要ありません。");
  if (settings.calendar) (state.calendar?.events || []).forEach((event) => {
    const start = new Date(event.start?.dateTime || event.start?.date); const minutes = Math.round((start - now) / 60000); const key = `${event.id}:${start.toISOString()}`;
    if (minutes > 0 && minutes <= 30) {
      const sleep = /睡眠|就寝|寝る|SLEEP/i.test(event.title);
      const title = sleep ? "SLEEP PHASE" : minutes <= 5 ? "EVENT IMMINENT" : "NEXT EVENT";
      const phase = sleep ? "ログアウト準備を開始できます。" : minutes <= 5 ? "まもなく開始です。" : "準備できる時間があります。";
      sendOnce(key, title, `《${event.title}》まであと${minutes}分\n${event.location ? `場所：${event.location}\n` : ""}${phase}`);
    }
  });
}
function systemFeedback(kind = "select", page = "") {
  const settings = feedbackSettings();
  const categoryPitch = { world:330, player:245, navigator:465, archive:650, log:525, sound:720, system:365 };
  const patterns = { select:[[520,.028,0,"sine"]], confirm:[[430,.035,0,"sine"],[690,.07,.035,"sine"]], enter:[[categoryPitch[page] || 510,.035,0,"triangle"],[(categoryPitch[page] || 510) * 1.32,.065,.035,"sine"]], back:[[510,.035,0,"sine"],[330,.07,.035,"sine"]], scan:[[160,.18,0,"sine"],[220,.12,.06,"triangle"]], lock:[[175,.05,0,"square"]], discovery:[[610,.035,0,"sine"],[820,.055,.04,"sine"],[1040,.09,.085,"sine"]] };
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (settings.sound !== false && AudioContextConstructor) {
    systemAudio ||= new AudioContextConstructor(); const context = systemAudio; context.resume().catch(() => {});
    (patterns[kind] || patterns.select).forEach(([frequency,duration,offset,wave]) => { const oscillator = context.createOscillator(); const gain = context.createGain(); const start = context.currentTime + offset; oscillator.type = wave; oscillator.frequency.setValueAtTime(frequency, start); gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(.026, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + duration); oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + duration + .015); });
  }
}
function resetInterfaceIdle() { document.body.classList.remove("ui-idle"); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add("ui-idle"), 9000); }
document.addEventListener("pointerdown", resetInterfaceIdle, { passive:true });
document.addEventListener("keydown", resetInterfaceIdle);
app.addEventListener("click", (event) => {
  const control = event.target.closest("button");
  if (!control || control.matches("[data-page], [data-home], #sync, #page-sync, #system-sync, #toggle-sound")) return;
  systemFeedback(control.classList.contains("primary-action") ? "confirm" : "select");
});
function exportSaveData() {
  const payload = { app:"LIFE SYSTEM", version:1, exportedAt:new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `life-system-save-${dateKey()}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importSaveData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(String(reader.result)); const restored = backup?.state;
      if (backup?.app !== "LIFE SYSTEM" || !restored || typeof restored !== "object" || !restored.player || typeof restored.player !== "object") throw new Error("invalid backup");
      if (!confirm("現在のLIFE SYSTEMの進行を、このセーブデータで上書きして復元しますか？")) return;
      Object.keys(state).forEach((key) => delete state[key]);
      Object.entries(restored).filter(([key]) => !["__proto__", "prototype", "constructor"].includes(key)).forEach(([key,value]) => { state[key] = value; });
      save(); alert("セーブデータを復元しました。"); renderPage("system");
    } catch { alert("LIFE SYSTEMの正しいセーブデータを読み込めませんでした。"); }
  };
  reader.readAsText(file);
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c]);
const archiveState = () => (state.archive ||= { prefectures:{}, places:{}, countries:{} });
const systemLog = () => (state.systemLog ||= []);
const systemMessageMeta = {
  0:{ label:"AMBIENT", className:"ambient" }, 1:{ label:"LOG", className:"log" }, 2:{ label:"PROGRESS", className:"progress" }, 3:{ label:"UNLOCK", className:"unlock" }, 4:{ label:"PRIORITY", className:"priority" }
};
function recordSystemMessage({ level = 1, title, detail = "", target = "system" }) {
  const now = new Date();
  const entry = { id:crypto.randomUUID(), level, title, detail, target, date:dateKey(), time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), createdAt:now.toISOString() };
  systemLog().unshift(entry); state.systemLog = systemLog().slice(0,300);
  if (level >= 3 && notificationSettings().systemMessages !== false && notificationPermission() === "granted") showLifeNotification("SYSTEM", `${title}${detail ? ` — ${detail}` : ""}`, `system:${entry.id}`);
  return entry;
}
function messageFromWorldEvent(event) {
  if (/NEW WORLD REGION/.test(event.title)) return { level:3, title:"NEW WORLD GATE UNLOCKED", detail:event.detail, target:"archive" };
  if (/NEW AREA DISCOVERED/.test(event.title)) return { level:1, title:"NEW AREA DISCOVERED", detail:event.detail, target:"archive" };
  if (/CODEX UPDATED/.test(event.title)) return { level:1, title:"CODEX UPDATED", detail:event.detail, target:"archive" };
  if (/FIXED EVENT CLEARED/.test(event.title)) return { level:2, title:"FIXED EVENT CLEARED", detail:event.detail, target:"log" };
  if (/LOCATION UPDATED/.test(event.title)) return { level:1, title:"AREA TRANSITION DETECTED", detail:event.detail, target:"archive" };
  if (/PHASE BEGUN/.test(event.title)) return { level:0, title:event.title, detail:event.detail, target:"world" };
  if (/RAIN|WEATHER/.test(event.title)) return { level:0, title:"WORLD STATE UPDATED", detail:event.detail, target:"world" };
  return { level:1, title:event.title, detail:event.detail, target:"world" };
}
const titleCatalog = [
  { id:"first-link", name:"世界へ接続した者", rarity:"COMMON", condition:() => Boolean(state.world?.syncedAt) },
  { id:"first-area", name:"境界を越えた者", rarity:"COMMON", condition:() => Object.keys(archiveState().prefectures).length >= 1 },
  { id:"mission-runner", name:"約束を完了する者", rarity:"UNCOMMON", condition:() => worldEventMemory().cleared >= 1 },
  { id:"night-explorer", name:"夜を歩く者", rarity:"UNCOMMON", condition:() => /NIGHT/.test(state.world?.phase || "") },
  { id:"rain-walker", name:"雨の世界を進む者", rarity:"UNCOMMON", condition:() => /RAIN|DRIZZLE|THUNDER/.test(state.world?.weather || "") },
  { id:"atlas-awakening", name:"地図を広げる者", rarity:"RARE", condition:() => Object.keys(archiveState().prefectures).length >= 3 }
];
const titleState = () => (state.titles ||= { unlocked:{} });
const activeTitle = () => titleCatalog.find((title) => titleState().unlocked[title.id]) || null;
function evaluateTitleUnlocks(now = new Date()) {
  const titles = titleState();
  titleCatalog.forEach((title) => {
    if (titles.unlocked[title.id] || !title.condition()) return;
    titles.unlocked[title.id] = { acquiredAt:now.toISOString(), rarity:title.rarity };
    state.log.unshift({ id:crypto.randomUUID(), day:dateKey(), time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"TITLE", title:"TITLE ACQUIRED", detail:`《${title.name}》 / ${title.rarity}` });
    recordSystemMessage({ level:3, title:"TITLE ACQUIRED", detail:`《${title.name}》`, target:"player" });
    queueCelebration(`title-${title.id}`, "TITLE ACQUIRED", `《${title.name}》`, now);
  });
}
function renderTitleCollection() {
  const unlocked = titleState().unlocked;
  return `<section class="detail-card glass title-collection"><div class="section-head"><p class="eyebrow">equipped history</p><span>${Object.keys(unlocked).length} / ${titleCatalog.length}</span></div><strong>称号コレクション</strong><p>現実で条件を満たしたときだけ、PLAYERの履歴に加わります。</p><div>${titleCatalog.map((title) => unlocked[title.id] ? `<article class="unlocked"><i>✦</i><span><b>${esc(title.name)}</b><small>${title.rarity} · ${new Date(unlocked[title.id].acquiredAt).toLocaleDateString("ja-JP")}</small></span></article>` : `<article class="locked"><i>?</i><span><b>UNKNOWN TITLE</b><small>条件はまだ観測されていません</small></span></article>`).join("")}</div></section>`;
}
const skillState = () => { const skills = (state.skills ||= { selected:"human-basics", zoom:.72, mode:"build" }); skills.records ||= {}; skills.history ||= []; skills.mode ||= "build"; return skills; };
const skillStatusLabel = { locked:"未解放", known:"知っている", practising:"練習中", acquired:"習得済み", passive:"無意識に使える", dormant:"休眠中", mastered:"得意分野" };
function skillStatus(node) {
  const manual = skillState().records[node.id]?.status;
  if (manual) return manual;
  const archive = archiveState();
  const confirmed = new Set(["human-basics","human-basics-0","human-basics-5","human-basics-6","human-basics-11"]);
  if (Object.keys(archive.prefectures).length) ["world","world-0","world-1","world-2","world-4","world-7","world-10","world-11"].forEach((id) => confirmed.add(id));
  if ((state.calendar?.events || []).length) ["cognition","cognition-9","cognition-10","business","business-3","business-4"].forEach((id) => confirmed.add(id));
  if (node.id === "human-basics") return "passive";
  if (confirmed.has(node.id)) return node.kind === "cluster" ? "acquired" : node.id.startsWith("human-basics-") ? "passive" : "acquired";
  return "locked";
}
function skillEvidence(node) {
  if (node.id === "human-basics") return "PLAYER BASE / 生活の基礎能力として常時利用できます。";
  if (node.id.startsWith("world") && Object.keys(archiveState().prefectures).length) return "ATLASの実際の探索記録から、WORLD系の接続を確認しました。";
  if (["cognition","business"].includes(node.id) && (state.calendar?.events || []).length) return "カレンダー上の予定から、この領域に活動の記録があります。";
  return "この能力はまだ自動判定できません。実際の記録が増えると接続候補として現れます。";
}
function playerBuildAnalysis() {
  const weights = { locked:0, known:1, practising:2, acquired:3, passive:4, dormant:1, mastered:5 }; const roots = skillNodes.filter((node) => node.kind === "cluster"); const scores = Object.fromEntries(roots.map((node) => [node.id,0]));
  skillNodes.filter((node) => node.kind === "skill").forEach((node) => { const root = roots.find((item) => node.id.startsWith(`${item.id}-`)); if (root) scores[root.id] += weights[skillStatus(node)] || 0; });
  const ranked = roots.map((node) => ({ ...node, score:scores[node.id] || 0 })).filter((node) => node.score > 0).sort((a,b) => b.score - a.score); const has = (id) => (scores[id] || 0);
  let name = "可能性を育てるプレイヤー", copy = "経験を自分の力として記録しながら、まだ見えない枝へ進んでいます。", theme = "prism";
  if (has("digital") + has("creative") >= 5) { name = "情報を形にするクリエイター"; copy = "デジタルの力と表現力をつなぎ、アイデアを現実の形に変えていくビルドです。"; theme = "aurora"; }
  else if (has("digital") + has("cognition") >= 5) { name = "世界を解析するシステム使い"; copy = "情報を読み解き、仕組みにして扱う力が強いビルドです。"; theme = "signal"; }
  else if (has("language") + has("social") >= 5) { name = "言葉で世界をつなぐ人"; copy = "伝える・聞く・相手を理解する力から、世界との接続を作るビルドです。"; theme = "rose"; }
  else if (has("world") + has("physical") + has("nature") >= 5) { name = "現実世界を歩く探索者"; copy = "移動と観察を通じて、まだ見ぬ場所を自分の世界にしていくビルドです。"; theme = "mint"; }
  else if (has("creative") + has("performing") >= 5) { name = "表現を紡ぐアーティスト"; copy = "感覚と表現を重ねて、自分だけの世界観を生み出すビルドです。"; theme = "violet"; }
  const stats = [["知力","INT",["cognition","science","mathematics","computing","research"]],["感覚","PER",["cognition","world","nature","culture"]],["身体","AGI",["physical","world","outdoors","sports"]],["魅力","CHA",["language","social","performing","marketing"]],["活力","VIT",["physical","health","daily-life","caregiving"]],["創造","CRE",["creative","design","visual-arts","music","writing"]]].map(([label,code,ids]) => { const value = Math.min(99, Math.round(10 + ids.reduce((total,id) => total + has(id), 0) * 2.4)); return { label, code, value }; });
  const training = roots.filter((root) => skillNodes.some((node) => node.id.startsWith(`${root.id}-`) && skillStatus(node) === "practising")).map((node) => node.label).slice(0,3); const direction = training.length ? `${training.join("・")}を育てると、今のビルドがさらに広がります。` : ranked.length ? `${ranked.slice(0,2).map((node) => node.label).join(" × ")}の接続が、次の成長の起点です。` : "スキルをひとつ記録すると、あなたのビルド解析が始まります。";
  return { name, copy, theme, ranked:ranked.slice(0,4), stats, training, direction, count:skillNodes.filter((node) => node.kind === "skill" && skillStatus(node) !== "locked").length };
}
function renderEnhancedPlayer(w) {
  const profile = playerProfile(); const current = currentPlayerState(w); const growth = coreGrowth(); const build = playerBuildAnalysis(); return `<section class="page-hero player-hero build-hero ${build.theme}"><p class="eyebrow">character profile / live build</p><h1>PLAYER</h1><p>いまの状態と、長い時間をかけて作られてきたあなたのビルド。</p><div class="player-summary"><div><strong>${esc(profile.name)}</strong><small>${profile.title}<br>DAY START · ${esc(state.status?.[dateKey()] || "UNKNOWN")}</small></div><b><small>LV</small>${state.player.level}</b></div></section><section class="detail-card glass build-analysis ${build.theme}"><div class="section-head"><p class="eyebrow">現在のビルド <small>BUILD ANALYSIS</small></p><span>${build.count} SKILLS</span></div><div class="build-sigil"><i></i><i></i><i></i><b></b></div><h2>${build.name}</h2><p>${build.copy}</p><div class="build-domains">${build.ranked.length ? build.ranked.map((item) => `<div><span>${esc(item.label)}</span><i><b style="width:${Math.min(100,item.score * 12)}%"></b></i><small>${item.score}</small></div>`).join("") : `<p>SKILLで能力を記録すると、ここにあなたらしい傾向が現れます。</p>`}</div><button class="subtle-action" data-page="skills">自分のビルドを見る</button></section><section class="detail-card glass rpg-attributes ${build.theme}"><div class="section-head"><p class="eyebrow">基本能力 <small>RPG ATTRIBUTES</small></p><span>LIVE BUILD</span></div><div>${build.stats.map((stat) => `<article><span>${stat.label}<small>${stat.code}</small></span><b>${stat.value}</b><i><u style="width:${stat.value}%"></u></i></article>`).join("")}</div></section><section class="detail-card glass build-direction ${build.theme}"><div class="section-head"><p class="eyebrow">育成の方向 <small>NEXT DIRECTION</small></p><span>${build.training.length ? "TRAINING" : "CONNECTION"}</span></div><strong>${build.training.length ? build.training.join(" / ") : build.ranked.slice(0,2).map((item) => item.label).join(" × ") || "WORLD IS OPEN"}</strong><p>${build.direction}</p><button class="subtle-action" data-page="skills">スキルを探す</button></section><section class="detail-card glass"><div class="section-head"><p class="eyebrow">現在の状態 <small>CURRENT STATUS</small></p><span class="live-status"><i></i>LIVE</span></div><div class="parameter-list">${[["HP",current.hp,"#f4b9cc"],["ENERGY",current.energy,"#bfe5d0"],["FOCUS",current.focus,"#b8e5f2"],["SPIRIT",current.spirit,"#d8ccff"],["SOCIAL",current.social,"#f5d5a9"]].map(([label,value,color]) => `<div><p><span>${label}</span><b>${value}</b></p><i><span style="width:${value}%;background:${color}"></span></i></div>`).join("")}</div></section><section class="detail-card glass"><p class="eyebrow">状態効果 <small>STATUS EFFECT</small></p><div class="effect-list">${current.effects.map(([name,copy,tone]) => `<div class="effect ${tone}"><i></i><div><strong>${name}</strong><p>${copy}</p></div></div>`).join("")}</div></section><section class="detail-card glass core-growth"><div class="section-head"><p class="eyebrow">長期成長 <small>CORE GROWTH</small></p><span>LONG TERM</span></div><div class="growth-grid">${[["creativity","創造性","CRE"],["discipline","継続力","WIL"],["curiosity","好奇心","PER"],["communication","伝える力","CHA"],["resilience","回復力","VIT"]].map(([key,label,role]) => `<div><b>${growth[key]}</b><span>${label}</span><small>${role}</small></div>`).join("")}</div></section>`;
}
function distanceKm(lat1,lng1,lat2,lng2) { const rad = Math.PI / 180; const a = Math.sin((lat2-lat1)*rad/2) ** 2 + Math.cos(lat1*rad) * Math.cos(lat2*rad) * Math.sin((lng2-lng1)*rad/2) ** 2; return 12742 * Math.asin(Math.sqrt(a)); }
function archivePrefectureProgress(prefecture) {
  const archive = archiveState(); const record = archive.prefectures[prefecture.id];
  if (!record) return { percent:0, visits:0, syncs:0, seasons:0, night:false, landmark:false, components:[] };
  const visits = Number(record.visits) || 1; const syncs = Number(record.syncs) || visits; const seasons = Object.keys(record.seasons || {}).length; const night = Boolean(record.nightVisit); const landmark = Boolean(archive.places[`${prefecture.id}:landmark`]);
  const components = [["領域を発見",10,true],["再訪",Math.min(25,visits * 5),visits >= 5],["代表スポット",25,landmark],["夜の探索",15,night],["季節の再訪",Math.round(seasons / 4 * 25),seasons >= 4]];
  return { percent:Math.min(100, components.reduce((total,[,amount]) => total + amount,0)), visits, syncs, seasons, night, landmark, components };
}
function archivePrefectureState(prefecture) { const archive = archiveState(); if (!archive.prefectures[prefecture.id]) return "unknown"; return archivePrefectureProgress(prefecture).percent >= 100 ? "explored" : "discovered"; }
function syncArchiveDiscovery(world, now) {
  if (!Number.isFinite(world.latitude) || !Number.isFinite(world.longitude)) return [];
  const archive = archiveState(); const region = String(world.region || "").toUpperCase(); const events = [];
  const add = (kind,title,detail) => events.push({ id:crypto.randomUUID(), day:dateKey(), time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind, title, detail });
  const prefecture = japanAtlas.find((item) => region.includes(item.key));
  if (prefecture) {
    const before = archivePrefectureProgress(prefecture).percent;
    const isNew = !archive.prefectures[prefecture.id]; const record = archive.prefectures[prefecture.id] ||= { firstSeen:now.toISOString(), visits:0, syncs:0, seasons:{}, nightVisit:false };
    const lastVisit = new Date(record.lastVisitAt || 0); const firstRecordedVisit = !record.lastVisitAt;
    record.syncs = (Number(record.syncs) || 0) + 1; record.seasons ||= {}; record.seasons[world.season || season(now.getMonth())] = true;
    if (/NIGHT/.test(world.phase || "")) record.nightVisit = true;
    if (firstRecordedVisit) { record.visits = Math.max(1, Number(record.visits) || 0); record.lastVisitAt = now.toISOString(); }
    else if (now - lastVisit >= 3 * 60 * 60 * 1000) { record.visits = (Number(record.visits) || 0) + 1; record.lastVisitAt = now.toISOString(); }
    record.lastSeen = now.toISOString();
    if (isNew) { state.lastDiscovery = true; add("ARCHIVE", "NEW AREA DISCOVERED", `${prefecture.name} has been added to JAPAN ATLAS.`); }
    const after = archivePrefectureProgress(prefecture).percent;
    if (!isNew && after > before) add("ARCHIVE", "AREA SURVEY UPDATED", `${prefecture.name} exploration ${before}% → ${after}%`);
  }
  if (prefecture && !archive.places[`${prefecture.id}:landmark`] && distanceKm(world.latitude, world.longitude, prefecture.lat, prefecture.lng) <= 1.8) { archive.places[`${prefecture.id}:landmark`] = { firstSeen:now.toISOString() }; state.lastDiscovery = true; add("ARCHIVE", "PLACE CODEX UPDATED", `${prefecture.spot} / ${prefecture.name}`); }
  const country = worldAtlas.find((item) => region.includes(item.key));
  if (country && !archive.countries[country.key]) { archive.countries[country.key] = { firstSeen:now.toISOString() }; state.lastDiscovery = true; add("ARCHIVE", "NEW WORLD REGION DISCOVERED", `${country.name} has been added to WORLD ATLAS.`); }
  return events;
}
function renderAtlasProgressPanel(world) {
  const archive = archiveState(); const detected = japanAtlas.find((item) => String(world.region || "").toUpperCase().includes(item.key)); const selected = japanAtlas.find((item) => item.id === state.atlasSelected) || detected || japanAtlas.find((item) => item.id === "nara");
  const progress = archivePrefectureProgress(selected);
  return `<section class="detail-card glass atlas-progress-panel"><div class="section-head"><p class="eyebrow">area survey / detailed</p><span>${progress.percent}%</span></div><h2>${esc(selected.name)} 攻略度</h2><div class="atlas-progress-number"><b>${progress.percent}</b><span>%<small>EXPLORED</small></span></div><div class="atlas-progress-bar"><i style="width:${progress.percent}%"></i></div><div class="atlas-progress-conditions">${progress.components.map(([label,amount,done]) => `<div class="${done ? "complete" : ""}"><i></i><span>${label}</span><b>+${amount}%</b></div>`).join("")}</div><p>訪問 ${progress.visits}回 · SYNC ${progress.syncs}回 · 季節 ${progress.seasons}/4 · ${progress.night ? "夜の探索済み" : "夜の探索は未達成"}</p></section>`;
}
function calendarTime(event) { const value = event.start?.dateTime || event.start?.date; if (!value) return "—"; if (!event.start?.dateTime) return "ALL DAY"; return new Date(value).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:false }); }
function upcomingCalendarEvent() { return state.calendar?.events?.find((event) => new Date(event.end?.dateTime || event.end?.date) >= new Date()) || state.calendar?.events?.[0]; }
function calendarLogState(event) { const now = new Date(); const start = new Date(event.start?.dateTime || event.start?.date); const end = new Date(event.end?.dateTime || event.end?.date); if (end < now) return ["COMPLETE", "完了した予定", "complete"]; if (start <= now) return ["ACTIVE", "いま進行中", "active"]; return ["UPCOMING", "これからの予定", "upcoming"]; }
function calendarLogDate(event) { const value = event.start?.dateTime || event.start?.date; return value ? new Date(value).toLocaleDateString("ja-JP", { month:"long", day:"numeric", weekday:"short" }) : "DATE UNKNOWN"; }
const calendarViewMeta = { today:["TODAY","今日"], sixHours:["NEXT 6H","6時間以内"], day:["NEXT 24H","24時間以内"], upcoming:["UPCOMING","これからの予定"] };
function calendarTimelineEvents(view = "today") { const now = new Date(); const endOfToday = new Date(now); endOfToday.setHours(23,59,59,999); const horizon = new Date(now); if (view === "sixHours") horizon.setHours(horizon.getHours() + 6); if (view === "day") horizon.setHours(horizon.getHours() + 24); return (state.calendar?.events || []).filter((event) => { const start = new Date(event.start?.dateTime || event.start?.date); const end = new Date(event.end?.dateTime || event.end?.date); if (Number.isNaN(start) || Number.isNaN(end) || end < now) return false; if (view === "today") return start <= endOfToday; if (view === "sixHours" || view === "day") return start <= horizon; return true; }); }
async function loadCalendarEvents(accessToken) {
  const now = new Date(); const since = new Date(now); since.setHours(since.getHours() - 12); const until = new Date(now); until.setDate(until.getDate() + 14);
  const params = new URLSearchParams({ timeMin:since.toISOString(), timeMax:until.toISOString(), singleEvents:"true", orderBy:"startTime", maxResults:"100" });
  const listResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&showHidden=false&maxResults=250", { headers:{ Authorization:`Bearer ${accessToken}` } });
  if (!listResponse.ok) throw new Error("calendar list request failed");
  const calendarList = (await listResponse.json()).items || [];
  const calendars = calendarList.map((calendar) => ({ id:calendar.id, name:calendar.summaryOverride || calendar.summary || "UNTITLED CALENDAR", color:calendar.backgroundColor || "" }));
  const requests = await Promise.all(calendarList.map(async (calendar) => {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params}`, { headers:{ Authorization:`Bearer ${accessToken}` } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.items || []).map((event) => ({ id:`${calendar.id}:${event.id}`, title:event.summary || "UNTITLED EVENT", start:event.start, end:event.end, location:event.location || "", calendarName:calendar.summaryOverride || calendar.summary || "UNTITLED CALENDAR", calendarColor:calendar.backgroundColor || "" }));
  }));
  state.calendar = { calendars, events:requests.flat().sort((a,b) => new Date(a.start?.dateTime || a.start?.date) - new Date(b.start?.dateTime || b.start?.date)), syncedAt:new Date().toISOString() };
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
const pageNav = (active) => `<nav class="page-nav glass" aria-label="LIFE SYSTEM navigation">${[["world","WORLD"],["archive","ATLAS"],["player","PLAYER"],["skills","SKILL"],["navigator","NAVI"],["log","LOG"],["sound","SOUND"],["system","SYSTEM"]].map(([name,label]) => `<button class="${active === name ? "is-active" : ""}" data-page="${name}" aria-current="${active === name ? "page" : "false"}">${label}</button>`).join("")}</nav>`;
const swipePages = ["world","archive","player","skills","navigator","log","sound","system"];
function bindPageSwipe(page) {
  const shell = app.querySelector(".shell");
  if (!shell) return;
  const currentPage = page === "systemlog" ? "system" : page;
  const currentIndex = swipePages.indexOf(currentPage);
  if (currentIndex < 0) return;
  let start;
  shell.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) { start = undefined; return; }
    const target = event.target;
    if (target.closest("input, textarea, select, iframe, .skill-network-viewport, .page-nav, .action-dock, .view-layer")) { start = undefined; return; }
    const touch = event.touches[0];
    start = { x:touch.clientX, y:touch.clientY, at:Date.now() };
  }, { passive:true });
  shell.addEventListener("touchend", (event) => {
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0]; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; const elapsed = Date.now() - start.at;
    start = undefined;
    if (elapsed > 750 || Math.abs(dx) < 68 || Math.abs(dx) < Math.abs(dy) * 1.45) return;
    const nextIndex = currentIndex + (dx < 0 ? 1 : -1);
    const nextPage = swipePages[nextIndex];
    if (!nextPage) return;
    systemFeedback("select");
    navigate(nextPage, dx < 0 ? "forward" : "back");
  }, { passive:true });
}
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
function navigatorInsights(world = state.world || {}) {
  const now = new Date();
  const currentLevel = interventionLevels[navigatorSettings().intervention] || interventionLevels.standard;
  const events = calendarTimelineEvents("today");
  const next = upcomingCalendarEvent();
  const insights = [];
  const add = (item) => { if ((interventionLevels[item.level || "standard"]?.rank || 2) <= currentLevel.rank) insights.push(item); };
  const weather = String(world.weather || "");
  const minutesTo = (event) => Math.round((new Date(event.start?.dateTime || event.start?.date) - now) / 60000);
  if (now.getHours() < 11) add({ level:"standard", tone:"calm", tag:"TODAY FIELD", title:"本日のプレイフィールド", copy:events.length ? `固定EVENTは${events.length}件です。${next ? `最初のEVENTは ${calendarTime(next)}。` : ""}` : "本日の固定EVENTはまだありません。自由に行動できます。" });
  if (/RAIN|DRIZZLE|THUNDER/.test(weather)) add({ level:"minimal", tone:"rain", tag:"EQUIPMENT CHECK", title:"雨のシグナルを観測しました", copy:"移動するなら、必要な装備を確認できます。" });
  if (state.player.energy <= 40) add({ level:"minimal", tone:"rest", tag:"RECOVERY WINDOW", title:"回復の余白を確保できます", copy:"ENERGYが低めです。次の空き時間に10〜15分の離脱を入れる選択肢があります。" });
  if (next) {
    const minutes = minutesTo(next);
    if (minutes > 45) add({ level:"standard", tone:"signal", tag:"FREE ROAM AVAILABLE", title:"自由行動時間があります", copy:`次のEVENT「${next.title}」まで ${minutes}分。休憩・食事・探索に使えます。`, action:"archive", actionLabel:"探索を見る" });
    else if (minutes >= 0 && minutes <= 30) add({ level:"minimal", tone:"focus", tag:"SCHEDULE WINDOW", title:"次のEVENTが近づいています", copy:`「${next.title}」まであと${minutes}分です。移動や準備の余白を確認できます。`, action:"log", actionLabel:"予定を見る" });
  } else if (/HOME|HOUSE/.test(world.location || "")) add({ level:"standard", tone:"calm", tag:"HOME AREA", title:"HOME AREAに入りました", copy:"本日の固定EVENTは終了しています。FREE ROAMを選べます。", action:"skills", actionLabel:"育成を見る" });
  const tightGaps = events.slice(0, -1).filter((event, index) => {
    const end = new Date(event.end?.dateTime || event.end?.date);
    const start = new Date(events[index + 1].start?.dateTime || events[index + 1].start?.date);
    return start - end > 0 && start - end < 30 * 60000;
  }).length;
  if (tightGaps) add({ level:"standard", tone:"focus", tag:"RESOURCE FORECAST", title:"高負荷の区間を予測しています", copy:"予定の間に短い区間が続きます。次の余白で補給や休憩を入れると安心です。" });
  if (events.length >= 3) add({ level:"active", tone:"signal", tag:"TODAY LOAD", title:"本日のEVENT密度は高めです", copy:`残り${events.length}件の固定EVENTがあります。予定の合間は回復を優先する選択もできます。` });
  const unknownAreas = japanAtlas.length - Object.keys(archiveState().prefectures).length;
  if (unknownAreas && (!next || minutesTo(next) > 45)) add({ level:"active", tone:"signal", tag:"DISCOVERY OPPORTUNITY", title:"まだ見つけていない地域があります", copy:`JAPAN ATLASには未発見の地域が${unknownAreas}件あります。現在地のSYNCで探索が進みます。`, action:"archive", actionLabel:"ATLASを開く" });
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(23,59,59,999);
  const tomorrowFirst = (state.calendar?.events || []).find((event) => { const start = new Date(event.start?.dateTime || event.start?.date); return start > new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59) && start <= tomorrow; });
  if (now.getHours() >= 21 && tomorrowFirst) {
    const sleepHours = Math.max(0, (new Date(tomorrowFirst.start?.dateTime || tomorrowFirst.start?.date) - now) / 3600000 - 1);
    add({ level:"standard", tone:"night", tag:"NIGHT FORECAST", title:"明日の開始時刻を確認しました", copy:`最初のEVENTは ${calendarTime(tomorrowFirst)}。今からのSleep Windowは約${sleepHours.toFixed(1)}時間です。No action required.` });
  }
  if (!insights.length) insights.push({ level:"minimal", tone:"calm", tag:"NO ACTION REQUIRED", title:"現在、介入は必要ありません", copy:"予定・天気・PLAYER状態に大きな見落としはありません。世界をそのままプレイできます。" });
  return insights;
}
function renderEnhancedNavigator(world) {
  const insights = navigatorInsights(world); const lead = insights[0]; const level = interventionLevels[navigatorSettings().intervention] || interventionLevels.standard;
  const next = upcomingCalendarEvent(); const nextMinutes = next ? Math.max(0, Math.round((new Date(next.start?.dateTime || next.start?.date) - new Date()) / 60000)) : null;
  return `<section class="page-hero navigator-hero"><p class="eyebrow">personal world navigator</p><h1>L.I.F.E.</h1><p>必要がないときは黙る、現実世界の攻略補助。</p><div class="navigator-core ${lead.tone}"><i></i><span>ONLINE<br><b>${level.label}</b></span><em><u></u><u></u><u></u><u></u></em></div></section><section class="navigator-message glass ${lead.tone} navigator-intervention"><p class="eyebrow">${lead.tag}</p><h2>${lead.title}</h2><p>${lead.copy}</p>${lead.action ? `<button class="subtle-action navigator-action" data-page="${lead.action}">${lead.actionLabel}</button>` : ""}<span class="navigator-scan">READING WORLD SIGNALS</span></section><section class="navigator-now-grid"><article class="detail-card glass"><p class="eyebrow">next event</p><strong>${next ? esc(next.title) : "FREE ROAM"}</strong><span>${next ? `${calendarTime(next)} / あと${nextMinutes}分` : "固定EVENTはありません"}</span></article><article class="detail-card glass"><p class="eyebrow">today load</p><strong>${(state.calendar?.events || []).filter((event) => new Date(event.start?.dateTime || event.start?.date).toDateString() === new Date().toDateString()).length} EVENTS</strong><span>予定とPLAYER状態を照合中</span></article></section><section class="detail-card glass navigator-forecast"><div class="section-head"><p class="eyebrow">navigation forecast</p><span>${insights.length} SIGNALS</span></div>${insights.slice(1).map((item) => `<article class="${item.tone}"><i></i><div><small>${item.tag}</small><strong>${item.title}</strong><p>${item.copy}</p></div></article>`).join("") || `<p class="navigator-note">今は新しい助言はありません。必要なときだけL.I.F.E.が介入します。</p>`}</section><section class="detail-card glass"><p class="eyebrow">signals read</p><div class="navigator-signals"><span>${esc(world.location || "LOCATION UNKNOWN")}<small>LOCATION</small></span><span>${esc(world.weather || "WEATHER UNKNOWN")}<small>WEATHER</small></span><span>${state.player.energy}<small>ENERGY</small></span><span>${state.player.focus}<small>FOCUS</small></span></div><button class="primary-action" id="refresh-navigator">OBSERVE AGAIN</button></section><p class="navigator-note">L.I.F.E.は端末内の予定・位置・天気・PLAYER情報を照合します。外部AIへの送信や課金はありません。</p>`;
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
    title: activeTitle()?.name || (p.level >= 5 ? "WORLD EXPLORER" : p.level >= 3 ? "FIELD WALKER" : "WORLD WALKER"),
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
function moonIllumination(now = new Date()) {
  const cycle = 29.53058867; const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  return ((now.getTime() - knownNewMoon) / 86400000 % cycle + cycle) % cycle / cycle;
}
function renderWorldCore(world, current, nextMission) {
  const now = new Date(); const minutesNow = now.getHours() * 60 + now.getMinutes(); const dayFraction = minutesNow / 1440;
  const dayEvents = (state.calendar?.events || []).filter((event) => new Date(event.start?.dateTime || event.start?.date).toDateString() === now.toDateString()).slice(0,6);
  const objective = state.quests?.find((quest) => quest.status === "active"); const isOpen = state.coreExpanded === true;
  const clockMood = now.getHours() < 5 ? "deepnight" : now.getHours() < 9 ? "morning" : now.getHours() < 17 ? "day" : now.getHours() < 21 ? "evening" : "night";
  const weather = String(world.weather || "").toUpperCase(); const weatherMood = /THUNDER/.test(weather) ? "thunder" : /SNOW/.test(weather) ? "snow" : /RAIN|DRIZZLE|SHOWER/.test(weather) ? "rain" : /CLOUD|OVERCAST|FOG/.test(weather) ? "cloud" : "clear";
  const sunAngle = (dayFraction - .25) * 360; const sunX = 50 + Math.cos(sunAngle * Math.PI / 180) * 35; const sunY = 67 - Math.sin(sunAngle * Math.PI / 180) * 39;
  const moon = moonIllumination(now); const moonLight = 12 + Math.round(Math.abs(Math.cos(moon * Math.PI * 2)) * 76); const night = ["night","deepnight"].includes(clockMood);
  const stars = Array.from({ length:20 }, (_, index) => `<i style="--x:${8 + (index * 37) % 84}%;--y:${7 + (index * 53) % 57}%;--delay:-${index * .41}s"></i>`).join("");
  return `<section class="player-core world-core ${isOpen ? "is-open" : ""}" data-clock="${clockMood}" data-weather="${weatherMood}" data-season="${esc(world.season || "")}" aria-label="WORLD CORE"><div class="core-meta"><span>REAL WORLD / LIVE</span><b><i></i>LINK STABLE</b></div><div class="core-weather">${esc(world.temperature || "—")}° / ${esc(world.weather || "UNKNOWN")}</div><div class="core-shell"><div class="core-orbit core-orbit-a"></div><div class="core-orbit core-orbit-b"></div><div class="core-event-ring"><i class="core-time-hand" style="--clock-angle:${minutesNow / 1440 * 360}deg"></i>${dayEvents.map((event) => { const start = new Date(event.start?.dateTime || event.start?.date); const angle = (start.getHours() * 60 + start.getMinutes()) / 1440 * 360; return `<button class="core-event-marker ${nextMission?.id === event.id ? "is-next" : ""}" style="--event-angle:${angle}deg" data-page="log" aria-label="${esc(event.title)}"></button>`; }).join("")}</div><div class="world-globe" style="--sun-x:${sunX}%;--sun-y:${sunY}%;--moon-light:${moonLight}%"><i class="world-sky"></i><i class="world-stars">${stars}</i><i class="world-sun"></i><i class="world-moon"></i><i class="world-horizon"></i><i class="world-clouds"></i><i class="world-weather"></i><i class="world-caustic"></i><i class="world-glass-edge"></i><button class="core-center" id="toggle-player-core"><small>WORLD CORE</small><strong>${night ? "NIGHT SKY" : weatherMood === "rain" ? "RAIN WORLD" : "REAL WORLD"}</strong><b>${night ? "LUNAR SIGNAL" : "LIVE PROJECTION"}</b></button></div></div><div class="core-location"><small>YOU ARE HERE</small><strong>${esc(world.location || "WORLD")}</strong><span>${esc(world.region || "REAL WORLD")}</span></div><section class="core-objective"><small>CURRENT OBJECTIVE</small><strong>${objective ? esc(objective.title) : "FREE ROAM"}</strong><span>${objective ? "TRACKED QUEST" : "OPEN WORLD"}</span></section><section class="core-expanded"><div class="core-expanded-head"><p>WORLD CORE DATA</p><button id="close-player-core" aria-label="Close">×</button></div><div><span>LOCAL TIME</span><i><b style="width:${Math.round(dayFraction * 100)}%;background:#a9dded"></b></i><strong>${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})}</strong></div><div><span>WEATHER</span><i><b style="width:${weatherMood === "clear" ? 90 : weatherMood === "cloud" ? 57 : 35}%;background:#b8dff4"></b></i><strong>${esc(world.weather || "UNKNOWN")}</strong></div><div><span>MOON</span><i><b style="width:${moonLight}%;background:#d8ccff"></b></i><strong>${moonLight}%</strong></div><div><span>SEASON</span><i><b style="width:76%;background:#f4b9cc"></b></i><strong>${esc(world.season || "—")}</strong></div><button class="subtle-action" data-page="world">WORLD DETAILを開く</button></section></section>`;
}
function renderPlayerCore(world, current, nextMission) {
  const now = new Date(); const minutesNow = now.getHours() * 60 + now.getMinutes(); const nextStart = nextMission ? new Date(nextMission.start?.dateTime || nextMission.start?.date) : null; const freeMinutes = nextStart ? Math.max(0, Math.round((nextStart - now) / 60000)) : null;
  const clockAngle = minutesNow / 1440 * 360; const dayEvents = (state.calendar?.events || []).filter((event) => { const start = new Date(event.start?.dateTime || event.start?.date); return start.toDateString() === now.toDateString(); }).slice(0,6);
  const tones = ["#f2b6ca", "#afe0c4", "#a9dded", "#cbb8ed"]; const values = [current.hp,current.energy,current.focus,current.spirit]; const labels = ["HP","ENERGY","FOCUS","SPIRIT"]; const icons = { "WELL RESTED":"✦", "FOCUSED":"◌", "TIRED":"↓", "SCATTERED":"~", "NIGHT PHASE":"☾", "RAIN WORLD":"⌇", "BALANCED":"◉" };
  const objective = state.quests?.find((quest) => quest.status === "active"); const isOpen = state.coreExpanded === true; const clockMood = now.getHours() < 5 ? "deepnight" : now.getHours() < 9 ? "morning" : now.getHours() < 17 ? "day" : now.getHours() < 21 ? "evening" : "night"; const weatherMood = /RAIN|DRIZZLE|THUNDER/.test(world.weather || "") ? "rain" : /CLOUD|OVERCAST|FOG/.test(world.weather || "") ? "cloud" : "clear";
  return `<section class="player-core ${isOpen ? "is-open" : ""}" data-clock="${clockMood}" data-weather="${weatherMood}" aria-label="現在のPLAYER CORE"><div class="core-area-bg">${esc(world.location || "WORLD")}</div><div class="core-meta"><span>REAL WORLD / LIVE</span><b><i></i>LINK STABLE</b></div><div class="core-weather">${esc(world.temperature || "—")}° / ${esc(world.weather || "UNKNOWN")}</div><div class="core-shell"><div class="core-orbit core-orbit-a"></div><div class="core-orbit core-orbit-b"></div><div class="core-event-ring"><i class="core-time-hand" style="--clock-angle:${clockAngle}deg"></i>${dayEvents.map((event) => { const start = new Date(event.start?.dateTime || event.start?.date); const angle = (start.getHours() * 60 + start.getMinutes()) / 1440 * 360; return `<button class="core-event-marker ${nextMission?.id === event.id ? "is-next" : ""}" style="--event-angle:${angle}deg" data-page="log" aria-label="${esc(event.title)}"></button>`; }).join("")}</div><svg class="core-condition-ring" viewBox="0 0 200 200" aria-hidden="true"><circle class="core-ring-track" cx="100" cy="100" r="78"/>${values.map((value,index) => `<circle class="core-ring-arc" cx="100" cy="100" r="78" pathLength="100" style="--arc:${Math.max(4, value * .215)};--offset:${index * 25};--arc-color:${tones[index]}"/>`).join("")}</svg><div class="core-satellites">${current.effects.map(([name,,tone]) => `<span class="${tone}" title="${esc(name)}">${icons[name] || "•"}</span>`).join("")}</div><button class="core-center" id="toggle-player-core"><small>${nextMission ? "NEXT EVENT" : "WORLD PHASE"}</small><strong>${nextMission ? `${calendarTime(nextMission)}` : "FREE ROAM"}</strong><b>${nextMission ? (freeMinutes !== null ? `あと ${freeMinutes} MIN` : esc(nextMission.title)) : "OPEN WORLD"}</b><em>${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})}</em></button></div><div class="core-location"><small>YOU ARE HERE</small><strong>${esc(world.location || "WORLD")}</strong><span>${esc(world.region || "REAL WORLD")}</span></div><section class="core-objective"><small>CURRENT OBJECTIVE</small><strong>${objective ? esc(objective.title) : "FREE ROAM"}</strong><span>${objective ? "TRACKED QUEST" : "探索・休憩・次の選択はあなた次第"}</span></section><section class="core-expanded"><div class="core-expanded-head"><p>CONDITION DETAIL</p><button id="close-player-core" aria-label="閉じる">×</button></div>${values.map((value,index) => `<div><span>${labels[index]}</span><i><b style="width:${value}%;background:${tones[index]}"></b></i><strong>${value}</strong></div>`).join("")}<button class="subtle-action" data-page="player">PLAYER DETAILを開く</button></section></section>`;
}
function startCoreAmbientFeedback() {
  const core = app.querySelector(".player-core"); if (!core) return; clearTimeout(coreAmbientTimer);
  const parallax = (event) => { const rect = core.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width - .5) * 5; const y = ((event.clientY - rect.top) / rect.height - .5) * 5; core.style.setProperty("--grid-x", `${x}px`); core.style.setProperty("--grid-y", `${y}px`); };
  core.addEventListener("pointermove", parallax, { passive:true }); core.addEventListener("pointerleave", () => { core.style.setProperty("--grid-x", "0px"); core.style.setProperty("--grid-y", "0px"); });
  const schedule = () => { coreAmbientTimer = setTimeout(() => { if (!document.contains(core)) return; const shell = core.querySelector(".core-shell"); const center = core.querySelector(".core-center"); const link = core.querySelector(".core-meta b"); if (Math.random() < .7 && shell) { const signal = document.createElement("i"); signal.className = "core-transient-signal"; shell.append(signal); setTimeout(() => signal.remove(), 3600); } else { center?.classList.add("is-syncing"); link?.classList.add("is-syncing"); setTimeout(() => { center?.classList.remove("is-syncing"); link?.classList.remove("is-syncing"); }, 360); } schedule(); }, 16000 + Math.random() * 22000); };
  schedule();
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
function worldEventMemory() { return (state.worldEventMemory ||= { calendarCompleted:{}, total:0, discoveries:0, cleared:0 }); }
function detectCalendarCompletionEvents(now) {
  const memory = worldEventMemory(); const detected = [];
  (state.calendar?.events || []).forEach((event) => {
    const end = new Date(event.end?.dateTime || event.end?.date);
    if (Number.isNaN(end) || end > now) return;
    const key = `${event.id}:${end.toISOString()}`;
    if (memory.calendarCompleted[key]) return;
    memory.calendarCompleted[key] = now.toISOString(); memory.cleared += 1;
    detected.push({ id:crypto.randomUUID(), day:dateKey(), time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"MISSION", title:"FIXED EVENT CLEARED", detail:`${event.title} / ${calendarTime(event)}` });
  });
  const known = Object.keys(memory.calendarCompleted);
  if (known.length > 180) known.sort((a,b) => new Date(memory.calendarCompleted[a]) - new Date(memory.calendarCompleted[b])).slice(0, known.length - 180).forEach((key) => delete memory.calendarCompleted[key]);
  return detected;
}
function registerWorldEventProgress(events) {
  if (!events.length) return;
  const memory = worldEventMemory();
  memory.total += events.length;
  memory.discoveries += events.filter((event) => /DISCOVERED|CODEX UPDATED/.test(event.title)).length;
}
function renderWorldActivityTimeline() {
  const items = state.log.filter((event) => event.day === dateKey()).slice(0,10);
  const memory = worldEventMemory();
  return `<section class="detail-card glass world-activity-timeline"><div class="section-head"><p class="eyebrow">today's world activity</p><span>${items.length} EVENTS</span></div><p class="status-intro">予定だけではなく、SYNCで検出された移動・環境変化・DISCOVERYもここに積み重なります。</p><div>${items.length ? items.map((item) => `<article><time>${esc(item.time)}</time><span>${esc(item.kind)}</span><strong>${esc(item.title)}</strong><p>${esc(item.detail || "")}</p></article>`).join("") : `<p class="timeline-empty">まだWORLD EVENTはありません。SYNCすると、現実で起きた変化を検出します。</p>`}</div><small>SESSION TOTAL · ${memory.total} EVENTS / ${memory.discoveries} DISCOVERIES / ${memory.cleared} CLEARED</small></section>`;
}
function bindSkillNetworkGestures() {
  const viewport = app.querySelector("#skill-network-viewport");
  if (!viewport) return;
  let gesture = null;
  const distance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  const applyZoom = (next) => {
    const skills = skillState(); skills.zoom = Math.max(.5, Math.min(2.25, next));
    const scaler = viewport.querySelector(".skill-network-scaler"); const stage = viewport.querySelector(".skill-network-stage"); const output = app.querySelector(".network-controls span");
    if (scaler) { scaler.style.width = `${Math.round(1000 * skills.zoom)}px`; scaler.style.height = `${Math.round(720 * skills.zoom)}px`; }
    stage?.style.setProperty("--network-scale", skills.zoom);
    if (output) output.textContent = `${Math.round(skills.zoom * 100)}%`;
  };
  viewport.addEventListener("touchstart", (event) => { if (event.touches.length === 2) gesture = { distance:distance(event.touches), zoom:Number(skillState().zoom) || .72 }; }, { passive:true });
  viewport.addEventListener("touchmove", (event) => { if (!gesture || event.touches.length !== 2) return; event.preventDefault(); applyZoom(gesture.zoom * distance(event.touches) / gesture.distance); }, { passive:false });
  viewport.addEventListener("touchend", (event) => { if (gesture && event.touches.length < 2) { gesture = null; save(); } }, { passive:true });
}
function filterVisibleSkillResults(query) {
  const list = app.querySelector(".skill-discover-list");
  if (!list) return;
  const skills = skillState(); const keyword = String(query || "").trim().toLowerCase(); const domain = skills.domain || "all";
  const results = skillNodes.filter((node) => node.kind !== "composite" && (domain === "all" || node.domain === domain) && (!keyword || `${node.label} ${node.domain}`.toLowerCase().includes(keyword))).slice(0,80);
  list.innerHTML = results.length ? results.map((node) => `<button class="${skills.selected === node.id ? "is-selected" : ""}" data-skill-select="${node.id}"><i class="${skillStatus(node)}"></i><span>${esc(node.label)}<small>${esc(node.domain)}</small></span><b>${skillStatusLabel[skillStatus(node)]}</b></button>`).join("") : `<div class="empty-skill-state"><i></i><strong>一致するスキルがありません</strong><p>別の言葉や、ALL DOMAINSで探してみてください。</p></div>`;
  list.querySelectorAll("[data-skill-select]").forEach((button) => button.addEventListener("click", () => { skills.selected = button.dataset.skillSelect; skills.mode = "discover"; save(); renderPage("skills"); }));
}
function boot() {
  clearInterval(homeClock);
  scheduleLoginCelebration();
  app.innerHTML = `<section class="boot"><div class="boot-world"><div class="orb"><span>SYNC</span></div><h1>LIFE SYSTEM</h1><p class="sub">real world interface</p><div class="progress"><i></i></div><p id="boot-copy">世界との接続を準備しています…</p></div></section>`;
  const copies = ["世界との接続を準備しています…", "プレイヤーを確認しています…", "前回の世界を復元しています…"];
  let i = 0; const timer = setInterval(() => { i++; const el = document.querySelector("#boot-copy"); if (el) el.textContent = copies[i] || copies.at(-1); }, 580);
  setTimeout(() => { clearInterval(timer); renderHome(); if (!state.status?.[dateKey()]) showStatus(); }, 1900);
}

async function prefectureFromCoordinates(lat, lon) {
  try {
    const url = `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const data = await fetch(url).then((r) => r.ok ? r.json() : Promise.reject());
    const prefectureCode = Number(String(data.results?.muniCd || "").slice(0, 2));
    const prefecture = japanAtlas[prefectureCode - 1];
    return prefecture ? { name:prefecture.key, municipality:data.results?.lv01Nm || "" } : null;
  } catch { return null; }
}
async function reverseGeocode(lat, lon) {
  const prefecturePromise = prefectureFromCoordinates(lat, lon);
  const nominatim = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1&accept-language=en`;
  try {
    const data = await fetch(nominatim).then((r) => r.ok ? r.json() : Promise.reject());
    const address = data.address || {};
    const locality = address.city || address.town || address.village || address.county || address.state;
    const prefecture = await prefecturePromise;
    if (locality) return { location: String(locality).toUpperCase(), region: [prefecture?.name || address.state, address.country].filter(Boolean).join(" / ").toUpperCase() || "CURRENT AREA" };
  } catch { /* Try the secondary public resolver below. */ }
  const fallback = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;
  const data = await fetch(fallback).then((r) => r.ok ? r.json() : Promise.reject());
  const locality = data.city || data.locality || data.principalSubdivision;
  const prefecture = await prefecturePromise;
  if (!locality && !prefecture) throw new Error("no place");
  return { location: String(locality || prefecture.municipality || prefecture.name).toUpperCase(), region: [prefecture?.name || data.principalSubdivision, data.countryName || "JAPAN"].filter(Boolean).join(" / ").toUpperCase() || "CURRENT AREA" };
}
async function weather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
  const data = await fetch(url).then((r) => r.ok ? r.json() : Promise.reject());
  const code = data.current?.weather_code;
  const names = { 0:"CLEAR", 1:"MAINLY CLEAR", 2:"PARTLY CLOUDY", 3:"OVERCAST", 45:"FOG", 48:"FOG", 51:"LIGHT DRIZZLE", 53:"DRIZZLE", 55:"HEAVY DRIZZLE", 61:"LIGHT RAIN", 63:"RAIN", 65:"HEAVY RAIN", 71:"SNOW", 80:"RAIN SHOWERS", 95:"THUNDERSTORM" };
  return { weather: names[code] || "LOCAL CONDITIONS", temperature: Math.round(data.current?.temperature_2m) };
}
function getPosition() { return new Promise((resolve, reject) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:true, timeout:20000, maximumAge:0 }) : reject()); }
function worldArea(world = {}) {
  const latitude = Number(world.latitude); const longitude = Number(world.longitude);
  const matched = Number.isFinite(latitude) && Number.isFinite(longitude) ? areaState().filter((area) => distanceKm(latitude, longitude, area.latitude, area.longitude) * 1000 <= area.radius).sort((a,b) => distanceKm(latitude, longitude, a.latitude, a.longitude) - distanceKm(latitude, longitude, b.latitude, b.longitude))[0] : null;
  if (matched) return { id:matched.id, name:matched.name, type:matched.type, registered:true };
  return { id:`field:${String(world.location || "world").toLowerCase()}`, name:`FIELD / ${world.location || "WORLD"}`, type:"field", registered:false };
}
function detectWorldTransition(previous = {}, next = {}, now = new Date()) {
  if (!previous?.area?.id || previous.area.id === next.area?.id) return null;
  const regionChanged = previous.region && next.region && previous.region !== next.region;
  const previousName = previous.area.name || previous.location || "FIELD";
  const nextName = next.area.name || next.location || "FIELD";
  const title = regionChanged ? "REGION CHANGED" : next.area.registered ? "AREA ENTERED" : previous.area.registered ? "AREA EXITED" : "WORLD TRANSITION";
  const detail = regionChanged ? `${previous.region} → ${next.region}` : `${previousName} → ${nextName}`;
  state.pendingWorldTransition = { title, detail, area:nextName, at:now.toISOString() };
  return { id:crypto.randomUUID(), day:dateKey(), time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"WORLD", title, detail };
}
function persistArea({ name, type = "custom", radius = 180, latitude, longitude, sourceLabel = "現在地で登録" }) {
  const cleaned = String(name || "").trim().toUpperCase();
  if (!cleaned) throw new Error("area name required");
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) throw new Error("area coordinates required");
  const areas = areaState();
  if (type === "home") areas.splice(0, areas.length, ...areas.filter((area) => area.type !== "home"));
  const existing = areas.find((area) => area.name === cleaned);
  const record = { id:existing?.id || crypto.randomUUID(), name:cleaned, type, radius:Math.max(50, Math.min(1000, Number(radius) || 180)), latitude:Number(latitude), longitude:Number(longitude), sourceLabel:String(sourceLabel || "現在地で登録"), updatedAt:new Date().toISOString() };
  if (existing) Object.assign(existing, record); else areas.push(record);
  state.log.unshift({ id:crypto.randomUUID(), day:dateKey(), time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"SYSTEM", title:"AREA REGISTERED", detail:`${record.name} / ${record.radius}m radius` });
  recordSystemMessage({ level:1, title:"AREA REGISTERED", detail:record.name, target:"world" }); save();
  return record;
}
async function registerCurrentArea(options) {
  const pos = await getPosition(); return persistArea({ ...options, latitude:pos.coords.latitude, longitude:pos.coords.longitude });
}
async function registerSearchedArea({ query, ...options }) {
  const cleanQuery = String(query || "").trim(); if (!cleanQuery) throw new Error("place query required");
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ja&q=${encodeURIComponent(cleanQuery)}`;
  const results = await fetch(url).then((response) => response.ok ? response.json() : Promise.reject());
  const match = results?.[0]; if (!match) throw new Error("place not found");
  return persistArea({ ...options, latitude:Number(match.lat), longitude:Number(match.lon), sourceLabel:match.display_name || cleanQuery });
}
async function searchAreaPlaces(query) {
  const cleanQuery = String(query || "").trim(); if (!cleanQuery) throw new Error("place query required");
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=ja&q=${encodeURIComponent(cleanQuery)}`;
  const results = await fetch(url).then((response) => response.ok ? response.json() : Promise.reject());
  return (results || []).map((item) => ({ label:item.display_name || cleanQuery, latitude:Number(item.lat), longitude:Number(item.lon) })).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}
const areaSearchState = () => (state.areaSearch ||= { results:[] });
function areaDistanceStatus(area) {
  const latitude = Number(state.world?.latitude); const longitude = Number(state.world?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { label:"SYNCして現在地と照合", tone:"waiting" };
  const metres = Math.round(distanceKm(latitude, longitude, area.latitude, area.longitude) * 1000);
  const inside = metres <= area.radius;
  return { label:`現在地から ${metres}m / 半径 ${area.radius}m ${inside ? "・範囲内" : "・範囲外"}`, tone:inside ? "inside" : "outside" };
}
function renderAreaSettings() {
  const areas = areaState(); const search = areaSearchState(); const customDraft = search.target === "custom" ? search : {};
  const candidates = search.results?.length ? `<section class="area-search-results"><p>検索候補 — 選んだ地点にAREA名を付けて登録</p>${search.results.map((item,index) => `<button data-area-result="${index}"><i>⌖</i><span>${esc(item.label)}</span><b>選択</b></button>`).join("")}<button class="area-search-cancel" id="clear-area-search">候補を閉じる</button></section>` : "";
  return `<section class="detail-card glass area-settings"><div class="section-head"><p class="eyebrow">world transition</p><span>${areas.length} AREAS</span></div><strong>日常エリアを登録する</strong><p>現在地、または自分で入力した場所名からHOME BASEや大学などのAREAを登録できます。</p><div class="area-actions"><div class="area-home-setup"><p>HOME BASE</p><input id="home-area-search" maxlength="80" value="${esc(search.target === "home" ? search.query || "" : "")}" placeholder="住所・駅名・施設名で検索"><button class="subtle-action" id="set-home-area">現在地をHOME BASEにする</button><button class="subtle-action" id="search-home-area">候補を検索する</button></div><div class="area-custom-setup"><p>CUSTOM AREA</p><input id="custom-area-name" maxlength="28" value="${esc(customDraft.name || "")}" placeholder="例：KGU / CAMPUS"><input id="custom-area-search" maxlength="80" value="${esc(customDraft.query || "")}" placeholder="場所名・住所（今いる場所以外でも可）"><select id="custom-area-radius"><option value="120" ${String(customDraft.radius) === "120" ? "selected" : ""}>半径 120m</option><option value="200" ${!customDraft.radius || String(customDraft.radius) === "200" ? "selected" : ""}>半径 200m</option><option value="350" ${String(customDraft.radius) === "350" ? "selected" : ""}>半径 350m</option><option value="500" ${String(customDraft.radius) === "500" ? "selected" : ""}>半径 500m</option></select><button class="subtle-action" id="set-custom-area">現在地で登録</button><button class="subtle-action" id="search-custom-area">候補を検索する</button></div></div>${candidates}<div class="registered-areas">${areas.length ? areas.map((area) => { const status = areaDistanceStatus(area); return `<article class="${status.tone}"><i>${area.type === "home" ? "⌂" : "◌"}</i><span><b>${esc(area.name)}</b><small>${esc(area.sourceLabel || "以前の登録データ")}</small><em>${esc(status.label)}</em></span><button data-remove-area="${area.id}" aria-label="${esc(area.name)}を削除">×</button></article>`; }).join("") : `<p>まだ登録されたエリアはありません。</p>`}</div><button class="subtle-action area-sync-check" id="area-sync-check">SYNCして現在地との距離を確認</button></section>`;
}
async function sync() {
  systemFeedback("scan");
  const button = document.querySelector("#sync"); if (button) button.disabled = true;
  renderSync("Reading local conditions…");
  const now = new Date();
  const world = { location:"LOCATION UNAVAILABLE", region:"位置情報なしで同期", weather:"WEATHER UNAVAILABLE", temperature:"—", phase:phase(now.getHours()), season:season(now.getMonth()), ambience:"位置情報なしで世界へ入りました。次回の同期で、いつでも再取得できます。", syncedAt:now.toISOString() };
  try {
    const pos = await getPosition();
    world.location = "GPS LOCKED";
    world.latitude = pos.coords.latitude;
    world.longitude = pos.coords.longitude;
    world.region = `${pos.coords.latitude.toFixed(3)} / ${pos.coords.longitude.toFixed(3)}`;
    const [place, conditions] = await Promise.allSettled([reverseGeocode(pos.coords.latitude, pos.coords.longitude), weather(pos.coords.latitude, pos.coords.longitude)]);
    if (place.status === "fulfilled") Object.assign(world, place.value);
    if (conditions.status === "fulfilled") Object.assign(world, conditions.value);
    world.ambience = world.weather === "WEATHER UNAVAILABLE" ? "現在地を確認しました。天気情報は今は取得できません。" : `現在の空模様：${world.weather}`;
  } catch { world.ambience = "位置情報なしで世界へ入りました。準備ができたら、もう一度SYNCできます。"; }
  state.lastDiscovery = false;
  world.area = worldArea(world);
  const previousWorld = state.world;
  const transition = detectWorldTransition(previousWorld, world, now);
  const playEntryTrack = isMorningFieldEntry(previousWorld, world, now);
  const detectedEvents = [...detectWorldEvents(state.world, world, now), ...(transition ? [transition] : []), ...syncArchiveDiscovery(world, now), ...detectCalendarCompletionEvents(now)];
  state.world = world;
  const title = world.weather !== "WEATHER UNAVAILABLE" ? `${world.weather} detected` : "World sync completed";
  const today = dateKey();
  state.lastSyncEvents = detectedEvents.length;
  if (detectedEvents.length) { state.log.unshift(...detectedEvents); registerWorldEventProgress(detectedEvents); }
  else if (!state.log.some((e) => e.day === today && e.title === title)) state.log.unshift({ id:crypto.randomUUID(), day:today, time:now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"EVENT", title, detail:world.ambience });
  detectedEvents.forEach((item) => recordSystemMessage(messageFromWorldEvent(item)));
  if (!detectedEvents.length) recordSystemMessage({ level:0, title:"WORLD SYNC COMPLETE", detail:world.location, target:"world" });
  const areaCount = Object.keys(archiveState().prefectures).length;
  if (areaCount >= 3 && !state.systemFlags?.atlasThree) { state.systemFlags ||= {}; state.systemFlags.atlasThree = true; recordSystemMessage({ level:3, title:"A condition has been fulfilled.", detail:"Long-term flag updated. Tap to reveal.", target:"archive" }); }
  if (areaCount === japanAtlas.length) queueCelebration("japan-atlas-complete", "JAPAN ATLAS COMPLETE", "47 prefectures have been discovered.", now);
  evaluateTitleUnlocks(now);
  save(); if (playEntryTrack) playMorningFieldEntry(previousWorld, world, now); else playPendingCelebration(); if (state.lastDiscovery) systemFeedback("discovery"); renderSync(detectedEvents.length ? `${detectedEvents.length} NEW EVENT${detectedEvents.length > 1 ? "S" : ""} DETECTED` : "WORLD SYNC COMPLETE"); setTimeout(renderHome, detectedEvents.length ? 1350 : 700);
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
const areaLabel = (world = {}) => world.area?.name || world.location || "WORLD";
function renderWorldTransition(transition) {
  if (!transition) return "";
  return `<aside class="world-transition" aria-live="assertive"><div><small>${esc(transition.title)}</small><strong>${esc(transition.area)}</strong><span>${esc(transition.detail)}</span></div></aside>`;
}
function renderHome() {
  ensureDailySession();
  const savedWorld = state.world || { location:"WORLD NOT SYNCED", region:"SYNCを押して世界に入る", weather:"UNKNOWN", temperature:"—", phase:phase(new Date().getHours()), season:season(new Date().getMonth()), ambience:"最初のWORLD SYNCを待っています。" };
  const w = { ...savedWorld, location:areaLabel(savedWorld) };
  applyWorldAtmosphere(w);
  const now = new Date(); const p = state.player; const events = state.log.filter((e) => e.day === dateKey()).slice(0,3); const nav = navigatorBrief(w, p); const soundtrack = soundtrackFor(w); const activeTrack = soundtrackLibrary.find((track) => track.id === state.soundtrackId) || soundtrack; const nextMission = upcomingCalendarEvent(); const greeting = navigatorGreeting(w, p); const current = currentPlayerState(w); const activeQuest = state.quests?.find((quest) => quest.status === "active"); const latestMessage = systemLog()[0]; const transition = state.pendingWorldTransition;
  app.innerHTML = `<div class="shell home-enter" data-page="home">${renderWorldTransition(transition)}<header class="header"><div><p class="eyebrow">world time</p><p class="clock">${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})}</p><p class="date">${now.toLocaleDateString([], {weekday:"long",day:"numeric",month:"long"})}</p></div><button id="sync" class="sync glass"><span class="eyebrow">sync</span><time>${w.syncedAt ? new Date(w.syncedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "READY"}</time></button></header><div class="session-live-chip"><i></i>DAY ${gameDay()} · SESSION ACTIVE</div>${pageNav("world")}<div class="stack">${renderWorldCore(w, current, nextMission)}
  <section class="home-live-hud glass"><div class="hud-topline"><p class="eyebrow">current play state</p><span><i></i>SESSION ACTIVE</span></div><div class="hud-primary"><div><small>CURRENT AREA</small><strong>${esc(w.location)}</strong><span>${esc(w.region)}</span></div><time id="hud-system-time">${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})}<small>SYSTEM TIME</small></time></div><div class="hud-condition"><span>${icon(weatherIcon(w.weather))}<b>${esc(w.weather)}</b><small>${esc(w.temperature)}° · ${esc(w.phase)}</small></span><span>${icon("location")}<b>${esc(w.season)}</b><small>WORLD CONDITION</small></span></div><div class="hud-mission"><div><small>ACTIVE QUEST</small><strong>${activeQuest ? esc(activeQuest.title) : "FREE ROAM"}</strong><span>${activeQuest ? "ACTIVE" : "次の行動は自由です"}</span></div>${nextMission ? `<button data-page="log"><small>NEXT EVENT</small><strong>${calendarTime(nextMission)}</strong><span>${esc(nextMission.title)}</span></button>` : `<div><small>NEXT EVENT</small><strong>OPEN</strong><span>固定EVENTなし</span></div>`}</div><div class="hud-effects"><small>STATUS EFFECT</small><div>${current.effects.map(([name,,tone]) => `<span class="${tone}"><i></i>${esc(name)}</span>`).join("")}</div></div>${latestMessage ? `<button class="hud-system-message" data-page="systemlog"><small>SYSTEM MESSAGE / ${esc(latestMessage.time)}</small><strong>${esc(latestMessage.title)}</strong><b>›</b></button>` : ""}</section>
  <button class="card glass navigator-greeting" data-page="navigator"><div class="navigator-greeting-head"><i></i><p class="eyebrow">navigator / online</p><span>OPEN →</span></div><strong>${esc(greeting.greeting)}</strong><div class="greeting-signals">${greeting.details.map((detail) => `<span>${esc(detail)}</span>`).join("")}</div></button>
  <section class="card glass world-card"><div class="section-head"><p class="eyebrow">world state</p><p class="world-live"><i></i>LIVE</p></div><div class="world-hero"><div class="location-mark">${icon("location")}</div><div class="place"><div><h2>${esc(w.location)}</h2><p class="region">${esc(w.region)}</p></div><span class="temperature">${esc(w.temperature)}°</span></div></div><div class="tiles visual-tiles"><div class="tile"><span class="tile-icon season-icon">${icon("sun")}</span><p class="eyebrow">season</p><b>${esc(w.season)}</b></div><div class="tile"><span class="tile-icon">${icon(phaseIcon(w.phase))}</span><p class="eyebrow">phase</p><b>${esc(w.phase)}</b></div><div class="tile weather-tile"><span class="tile-icon">${icon(weatherIcon(w.weather))}</span><p class="eyebrow">weather</p><b>${esc(w.weather)}</b></div></div><p class="ambience">${esc(w.ambience)}</p></section>
  ${nextMission ? `<button class="card glass next-mission-card" data-page="log"><div class="section-head"><p class="eyebrow">next world mission</p><span>${esc(nextMission.calendarName || "CALENDAR")}</span></div><div><time>${calendarTime(nextMission)}</time><div><strong>${esc(nextMission.title)}</strong><p>${esc(nextMission.location || nextMission.calendarName || "GOOGLE CALENDAR EVENT")}</p></div><b>→</b></div></button>` : ""}
  <section class="card glass ${state.lastSyncEvents ? "events-new" : ""} ${state.lastDiscovery ? "discovery-detected" : ""}"><div class="section-head"><p class="eyebrow">event / discovery</p><p class="event-engine-live"><i></i>${state.lastSyncEvents ? `${state.lastSyncEvents} NEW` : `AUTO · ${events.length}`}</p></div>${state.lastDiscovery ? `<p class="discovery-banner">✦ NEW DISCOVERY UNLOCKED</p>` : state.lastSyncEvents ? `<p class="new-events-banner">WORLD SYNCで新しい変化を検知しました</p>` : ""}${events.length ? events.map((e) => `<div class="log-entry"><p class="eyebrow">${esc(e.kind)} · ${esc(e.time)}</p><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p></div>`).join("") : `<div class="event"><i class="signal"></i><p>まだ新しいシグナルはありません。<br>SYNCすると、いまの世界を観測できます。</p></div>`}</section>
  <button class="card glass navigator-preview" data-page="navigator"><div class="navigator-preview-core"><i></i><p class="eyebrow">navigator · ${esc(nav.tag)}</p></div><strong>${esc(nav.title)}</strong><p>${esc(nav.copy)}</p><span>OPEN NAVIGATOR →</span></button>
  <button class="card glass card-button" data-page="player"><div class="player"><div><p class="eyebrow">player</p><h2>${esc(playerProfile().name)}</h2><p class="region">${playerProfile().title} · DAY START: ${esc(state.status?.[dateKey()] || "UNKNOWN")}</p></div><div class="level glass"><span class="eyebrow">lv</span><strong>${p.level}</strong></div></div><div class="bar"><label>exp <span>${p.exp} / 500</span></label><i><span style="width:${p.exp / 5}%"></span></i></div><div class="three">${[["hp",p.hp,"#f4b9cc"],["energy",p.energy,"#bfe5d0"],["focus",p.focus,"#b8e5f2"]].map(([name,value,color]) => `<div class="bar"><label>${name}<span>${value}</span></label><i><span style="width:${value}%;background:${color}"></span></i></div>`).join("")}</div><p class="arrow">OPEN PLAYER →</p></button>
  <button class="card glass card-button now-playing-card" data-page="sound"><p class="eyebrow">now playing</p><div class="now"><i class="art ${activeTrack.tone}"></i><div><p><strong>${esc(activeTrack.scene)}</strong></p><small>${esc(activeTrack.role)} · ${state.soundtrackId ? "PLAYER SELECTED" : "WORLD SUGGESTION"}</small></div></div><p class="now-suggestion">OPEN SOUND PLAYER →</p></button>
  <button class="card glass card-button" data-page="log"><div class="section-head"><p class="eyebrow">calendar log</p><p class="eyebrow">${state.calendar?.events?.length || 0} events</p></div><p class="ambience">Google Calendarから届く、この世界のタイムライン。</p><p class="arrow">OPEN LOG →</p></button></div>
  <nav class="action-dock glass" aria-label="LIFE SYSTEM actions"><button data-page="log"><b>予定を見る</b></button><button data-action="observe"><b>世界を観測</b></button><button data-action="complete"><b>一日を閉じる</b></button></nav></div>`;
  document.querySelector("#sync").addEventListener("click", sync);
  app.querySelector("#toggle-player-core")?.addEventListener("click", () => { const shell = app.querySelector(".core-shell"); const ripple = document.createElement("i"); ripple.className = "core-refraction-ripple"; shell?.append(ripple); state.coreExpanded = !state.coreExpanded; save(); systemFeedback("select"); setTimeout(renderHome, 310); });
  app.querySelector("#close-player-core")?.addEventListener("click", () => { state.coreExpanded = false; save(); systemFeedback("back"); renderHome(); });
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => openView(button.dataset.action)));
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.page)));
  bindPageSwipe("world");
  app.querySelectorAll(".header, .stack > .card, .action-dock").forEach((element, index) => element.style.setProperty("--enter-delay", `${index * 75}ms`));
  if (transition) setTimeout(() => { delete state.pendingWorldTransition; save(); app.querySelector(".world-transition")?.remove(); }, 1350);
  activateGlassPhysics();
  startCoreAmbientFeedback();
  clearInterval(homeClock);
  homeClock = setInterval(() => {
    const clock = app.querySelector(".clock");
    const hudClock = app.querySelector("#hud-system-time");
    const date = app.querySelector(".date");
    const nowLive = new Date();
    if (clock) clock.textContent = nowLive.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:false });
    if (hudClock) hudClock.firstChild.nodeValue = nowLive.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:false });
    if (date) date.textContent = nowLive.toLocaleDateString([], { weekday:"long", day:"numeric", month:"long" });
  }, 1000);
}

function navigate(page, requestedDirection) {
  const screen = app.querySelector(".shell");
  if (!screen || screen.dataset.page === page) return;
  const current = screen.dataset.page === "home" ? "world" : screen.dataset.page === "systemlog" ? "system" : screen.dataset.page;
  const target = page === "systemlog" ? "system" : page;
  const direction = requestedDirection || (swipePages.indexOf(target) < swipePages.indexOf(current) ? "back" : "forward");
  systemFeedback("enter", page);
  screen.classList.add(`page-exit-${direction}`);
  setTimeout(() => renderPage(page, direction), 300);
}

function renderSkillsPage() {
  const skills = skillState(); const selected = skillNodes.find((node) => node.id === skills.selected) || skillNodes[0]; const nodeById = new Map(skillNodes.map((node) => [node.id,node])); const status = skillStatus(selected); const acquired = skillNodes.filter((node) => skillStatus(node) !== "locked"); const passive = skillNodes.filter((node) => skillStatus(node) === "passive"); const available = skillNodes.filter((node) => skillStatus(node) === "locked" && node.requires.length && node.requires.every((id) => skillStatus(nodeById.get(id) || {}) !== "locked")).slice(0,4); const zoom = Math.max(.5, Math.min(2.25, Number(skills.zoom) || .72));
  const links = skillNodes.flatMap((node) => node.requires.map((id) => { const source = nodeById.get(id); return source ? `<line x1="${source.x}" y1="${source.y}" x2="${node.x}" y2="${node.y}"/>` : ""; })).join("");
  return `<section class="page-hero skills-hero"><p class="eyebrow">life skill ontology / v1</p><h1>SKILL NETWORK</h1><p>現実の経験から、自分というキャラクターの能力接続を見つけていく。</p><div class="skill-stat"><span><b>${skillNodes.length}</b><small>DATABASE NODES</small></span><span><b>${acquired.length}</b><small>CONFIRMED</small></span><span><b>${passive.length}</b><small>PASSIVE</small></span></div></section><section class="skill-network-card glass"><div class="skill-network-head"><div><p class="eyebrow">player constellation</p><strong>DRAG TO EXPLORE</strong></div><div class="network-controls"><button data-skill-zoom="-.1" aria-label="ズームアウト">−</button><span>${Math.round(zoom * 100)}%</span><button data-skill-zoom=".1" aria-label="ズームイン">＋</button></div></div><p class="network-hint">指で地図を動かして、ノードをタップ。淡い光は確認済み、霧の中は未解放の能力です。</p><div class="skill-network-viewport" id="skill-network-viewport"><div class="skill-network-scaler" style="width:${Math.round(1000 * zoom)}px;height:${Math.round(720 * zoom)}px"><div class="skill-network-stage" style="--network-scale:${zoom}"><svg class="skill-links" viewBox="0 0 1000 720" aria-hidden="true">${links}</svg>${skillNodes.map((node) => `<button class="skill-node ${node.kind} ${skillStatus(node)} ${selected.id === node.id ? "is-selected" : ""}" style="--x:${node.x}px;--y:${node.y}px" data-skill-node="${node.id}" aria-label="${esc(node.label)}"><i></i><span>${esc(node.label)}</span></button>`).join("")}</div></div></div><div class="skill-network-legend"><span><i class="passive"></i>PASSIVE</span><span><i class="acquired"></i>CONFIRMED</span><span><i class="locked"></i>UNKNOWN</span><span><i class="composite"></i>COMPOSITE</span></div></section><section class="detail-card glass skill-detail ${status}"><div class="section-head"><p class="eyebrow">${esc(selected.domain)}</p><span>${status.toUpperCase()}</span></div><h2>${esc(selected.label)}</h2><p>${skillEvidence(selected)}</p><div class="skill-requirements"><p>CONNECTIONS</p>${selected.requires.length ? selected.requires.map((id) => { const required = nodeById.get(id); const requiredStatus = skillStatus(required || {}); return `<span class="${requiredStatus}"><i></i>${esc(required?.label || id)}<small>${requiredStatus.toUpperCase()}</small></span>`; }).join("") : `<span class="passive"><i></i>PLAYER BASE<small>ALWAYS ACTIVE</small></span>`}</div></section><section class="detail-card glass unlock-card"><div class="section-head"><p class="eyebrow">available connections</p><span>${available.length} NEARBY</span></div><p class="status-intro">今の記録から、前提条件に近い未解放ノード。これは達成を強制するクエストではなく、次に見つけられる世界の輪郭です。</p><div class="available-unlocks">${available.length ? available.map((node) => `<button data-skill-node="${node.id}"><i></i><span>${esc(node.label)}<small>${esc(node.domain)}</small></span><b>VIEW</b></button>`).join("") : `<p>まだ十分な記録がありません。WORLD SYNCやCALENDARの活動が増えると接続候補を表示します。</p>`}</div></section><section class="detail-card glass ontology-card"><p class="eyebrow">open-ended database</p><strong>${skillDomains.length} DOMAINS · ${skillNodes.length} NODES</strong><p>このネットワークは端末に同梱された軽量DBです。専門技能・職能・趣味を増やしていける構造なので、今後も新しい枝を追加できます。</p><div>${["HUMAN BASICS","LANGUAGE","DIGITAL","WORLD","CREATIVE","SCIENCE"].map((label) => `<span>${label}</span>`).join("")}</div></section>`;
}

function renderSkillHub() {
  const skills = skillState(); const mode = skills.mode || "build"; const selected = skillNodes.find((node) => node.id === skills.selected) || skillNodes[0]; const record = skills.records[selected.id] || {}; const status = skillStatus(selected); const tabs = `<section class="skill-view-tabs glass">${[["build","MY BUILD"],["discover","DISCOVER"],["network","NETWORK"],["history","HISTORY"]].map(([id,label]) => `<button class="${mode === id ? "is-active" : ""}" data-skill-mode="${id}">${label}</button>`).join("")}</section>`;
  if (mode === "network") return `${tabs}${renderSkillsPage()}`;
  if (mode === "history") { const items = skills.history.slice(0,50); return `${tabs}<section class="page-hero skills-hero"><p class="eyebrow">player progression record</p><h1>SKILL HISTORY</h1><p>あなたが自分で記録した、能力の変化だけを残します。</p><div class="skill-stat"><span><b>${items.length}</b><small>RECORDS</small></span><span><b>${Object.keys(skills.records).length}</b><small>MANUAL NODES</small></span><span><b>${skillNodes.length}</b><small>WORLD DATABASE</small></span></div></section><section class="detail-card glass skill-history">${items.length ? items.map((item) => `<article><i class="${item.status}"></i><div><p>${esc(item.date)}</p><strong>${esc(item.label)}</strong><span>${skillStatusLabel[item.status] || item.status}</span>${item.note ? `<small>${esc(item.note)}</small>` : ""}</div></article>`).join("") : `<div class="empty-skill-state"><i></i><strong>まだ記録はありません</strong><p>DISCOVERからスキルを選び、状態を保存するとここに残ります。</p></div>`}</section>`; }
  if (mode === "discover") { const query = String(skills.query || "").trim().toLowerCase(); const domain = skills.domain || "all"; const results = skillNodes.filter((node) => node.kind !== "composite" && (domain === "all" || node.domain === domain) && (!query || `${node.label} ${node.domain}`.toLowerCase().includes(query))).slice(0,48); return `${tabs}<section class="page-hero skills-hero"><p class="eyebrow">skill database / searchable</p><h1>DISCOVER</h1><p>世界の能力を検索して、自分の記録へ加える。</p><div class="skill-stat"><span><b>${skillNodes.length}</b><small>SKILLS</small></span><span><b>${skillDomains.length}</b><small>DOMAINS</small></span><span><b>${results.length}</b><small>VISIBLE</small></span></div></section><section class="detail-card glass skill-finder"><input id="skill-search" value="${esc(skills.query || "")}" placeholder="スキルを検索 例：料理 / Python / 英語" autocomplete="off"><select id="skill-domain"><option value="all">ALL DOMAINS</option>${skillDomains.map((item) => `<option value="${esc(item.label)}" ${domain === item.label ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></section><section class="detail-card glass skill-discover-list">${results.map((node) => `<button class="${selected.id === node.id ? "is-selected" : ""}" data-skill-select="${node.id}"><i class="${skillStatus(node)}"></i><span>${esc(node.label)}<small>${esc(node.domain)}</small></span><b>${skillStatusLabel[skillStatus(node)]}</b></button>`).join("") || `<div class="empty-skill-state"><i></i><strong>見つかりませんでした</strong><p>別の言葉や、ALL DOMAINSで探してみてください。</p></div>`}</section><section class="detail-card glass skill-record-editor"><div class="section-head"><p class="eyebrow">player record</p><span>${skillStatusLabel[status]}</span></div><h2>${esc(selected.label)}</h2><p>${esc(selected.domain)} · SYSTEMは自動観測を補助しますが、ここではあなた自身の認識で状態を決められます。</p><label>STATUS<select id="skill-status-select">${["locked","known","practising","acquired","passive","dormant","mastered"].map((id) => `<option value="${id}" ${status === id ? "selected" : ""}>${skillStatusLabel[id]}</option>`).join("")}</select></label><label>NOTE <small>任意</small><input id="skill-note" maxlength="140" value="${esc(record.note || "")}" placeholder="例：2026年夏から日常的に使える"></label><button class="primary-action" id="save-skill-record">UPDATE SKILL RECORD</button></section>`; }
  const buildNodes = skillNodes.filter((node) => skillStatus(node) !== "locked" && node.kind !== "cluster"); const groups = ["mastered","passive","acquired","practising","known","dormant"]; return `${tabs}<section class="page-hero skills-hero"><p class="eyebrow">your current character build</p><h1>MY BUILD</h1><p>現実に使える能力と、これから育てる能力だけを表示します。</p><div class="skill-stat"><span><b>${buildNodes.length}</b><small>ACTIVE NODES</small></span><span><b>${buildNodes.filter((node) => ["passive","mastered"].includes(skillStatus(node))).length}</b><small>CORE STRENGTHS</small></span><span><b>${buildNodes.filter((node) => skillStatus(node) === "practising").length}</b><small>IN TRAINING</small></span></div></section><section class="detail-card glass build-summary"><p class="eyebrow">dominant clusters</p>${skillDomains.map((domain) => { const amount = buildNodes.filter((node) => node.domain === domain.label).length; return amount ? `<button data-skill-domain-shortcut="${esc(domain.label)}"><span>${esc(domain.label)}</span><i><b style="width:${Math.min(100,amount * 16)}%"></b></i><small>${amount}</small></button>` : ""; }).join("") || `<div class="empty-skill-state"><i></i><strong>最初のスキルを記録しよう</strong><p>DISCOVERから、いま持っている能力をひとつ選んでください。</p></div>`}</section><section class="detail-card glass my-skill-list"><div class="section-head"><p class="eyebrow">current loadout</p><span>${buildNodes.length} SKILLS</span></div>${groups.map((group) => { const nodes = buildNodes.filter((node) => skillStatus(node) === group); return nodes.length ? `<div class="build-group"><p>${skillStatusLabel[group]}</p>${nodes.map((node) => `<button data-skill-select="${node.id}"><i class="${group}"></i><span>${esc(node.label)}<small>${esc(node.domain)}</small></span><b>EDIT</b></button>`).join("")}</div>` : ""; }).join("")}</section>`;
}

function localiseSkillChrome() {
  const text = { "MY BUILD":"自分のビルド", "DISCOVER":"スキルを探す", "NETWORK":"ツリー", "HISTORY":"記録", "SKILL HISTORY":"成長記録", "SKILL NETWORK":"スキルツリー", "DATABASE NODES":"登録スキル", "CONFIRMED":"確認済み", "PASSIVE":"無意識に使える", "RECORDS":"記録数", "MANUAL NODES":"手動登録", "WORLD DATABASE":"世界のDB", "SKILLS":"スキル数", "DOMAINS":"分野数", "VISIBLE":"表示中", "ACTIVE NODES":"現在のスキル", "CORE STRENGTHS":"主な強み", "IN TRAINING":"練習中", "current loadout":"現在のスキル", "dominant clusters":"得意な分野", "player record":"自分の記録", "STATUS":"状態", "NOTE":"メモ", "UPDATE SKILL RECORD":"スキル記録を更新", "EDIT":"編集", "VIEW":"見る", "available connections":"近いスキル", "open-ended database":"拡張できるデータベース", "DRAG TO EXPLORE":"動かして探索", "ALL DOMAINS":"すべての分野" };
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT); const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode); nodes.forEach((node) => { const value = node.nodeValue.trim(); if (text[value]) node.nodeValue = node.nodeValue.replace(value, text[value]); });
}

function renderNotificationSettings() {
  const settings = notificationSettings(); const permission = notificationPermission(); const label = permission === "granted" ? "許可済み" : permission === "denied" ? "拒否されています" : permission === "unsupported" ? "この端末では未対応" : "未設定";
  return `<section class="detail-card glass notification-settings"><div class="section-head"><p class="eyebrow">端末通知 <small>DEVICE NOTIFICATIONS</small></p><span>${label}</span></div><strong>現実世界からのSYSTEM SIGNAL</strong><p>朝・夜・次のGoogle Calendar予定を通知対象にできます。通知の許可はあなたが選べます。</p>${permission === "default" ? `<button class="primary-action" id="allow-notifications">通知を許可する</button>` : ""}${permission === "granted" ? `<div class="notification-toggles"><button class="${settings.morning ? "is-on" : ""}" data-notification-toggle="morning"><i></i><span>朝のログイン<small>08:00</small></span><b>${settings.morning ? "ON" : "OFF"}</b></button><button class="${settings.calendar ? "is-on" : ""}" data-notification-toggle="calendar"><i></i><span>次の予定<small>30分前まで</small></span><b>${settings.calendar ? "ON" : "OFF"}</b></button><button class="${settings.evening ? "is-on" : ""}" data-notification-toggle="evening"><i></i><span>夜のログアウト<small>21:00</small></span><b>${settings.evening ? "ON" : "OFF"}</b></button></div><button class="subtle-action" id="test-notification">通知をテストする</button>` : `<p class="notification-note">iPhoneでは、LIFE SYSTEMをホーム画面へ追加した状態で許可してください。</p>`}<p class="notification-note">現在はアプリ利用中の通知を有効化。閉じている間にも送るPush通知は、送信サーバー接続後に有効になります。</p></section>`;
}
function renderNavigatorSettings() {
  const selected = navigatorSettings().intervention;
  return `<section class="detail-card glass navigator-settings"><div class="section-head"><p class="eyebrow">L.I.F.E. navigation</p><span>${interventionLevels[selected].label}</span></div><strong>ナビゲーターの介入レベル</strong><p>通常は、問題がなければ何も言わないSTANDARDです。予定・天気・現在地・PLAYER状態から、見落としや余白だけを提示します。</p><div class="navigator-levels">${Object.entries(interventionLevels).map(([id, level]) => `<button class="${selected === id ? "is-selected" : ""}" data-intervention-level="${id}"><b>${level.label}</b><span>${level.copy}</span></button>`).join("")}</div><p class="notification-note">ルートの正確な所要時間、ヘルスケア、閉じている間の完全自動Pushは、対応する外部連携を追加した時に拡張できます。</p></section>`;
}
function renderPlayData() {
  const data = playDataState(); const session = dailySessionState(); const summary = sessionSummary(session.day); const history = state.sessionHistory || []; const sessionStatus = session.status === "complete" ? "COMPLETE" : "ACTIVE";
  return `<section class="detail-card glass play-data-card"><div class="section-head"><p class="eyebrow">play data / continuous save</p><span><i></i>${sessionStatus}</span></div><strong>CURRENT PLAYTHROUGH</strong><div class="play-data-main"><div><small>DAY</small><b id="play-day-counter">${gameDay()}</b></div><div><small>PLAY TIME</small><b id="playtime-counter">${formatPlayTime()}</b></div></div><div class="play-data-grid"><span>WORLD INSTANCE<b>${esc(data.worldInstance)}</b></span><span>CURRENT SEASON<b>${esc(season(new Date().getMonth()))}</b></span><span>AUTOSAVE<b>${esc(data.saveType)}</b></span><span>RESPAWN<b>DISABLED</b></span><span>LOAD / RESET<b>UNAVAILABLE</b></span><span>END CONDITION<b>UNKNOWN</b></span></div><div class="daily-session"><div><small>TODAY'S SESSION</small><strong>${sessionStatus}</strong><span>DAY ${gameDay()} / ${session.day}</span></div><div><b>${summary.events}</b><span>EVENTS</span></div><div><b>${summary.areas}</b><span>AREAS</span></div><div><b>${summary.discoveries}</b><span>NEW</span></div></div><div class="play-init"><label>PLAYER INITIALIZED<input id="player-initialized" type="date" value="${esc(data.initializedAt)}"></label><button class="subtle-action" id="save-play-data">開始日を更新</button></div>${history[0] ? `<p class="session-history">PREVIOUS SESSION · ${esc(history[0].day)} / ${history[0].events} EVENTS · ${history[0].areas} AREAS</p>` : ""}</section>`;
}
function renderSystemLog() {
  const entries = systemLog(); const today = entries.filter((entry) => entry.date === dateKey());
  return `<section class="page-hero system-log-hero"><p class="eyebrow">game engine / event history</p><h1>SYSTEM LOG</h1><p>現実世界で検出された変化を、PLAYERへのSYSTEM MESSAGEとして記録します。</p><div class="log-stat"><b>${today.length}</b><span>TODAY<br>MESSAGES</span></div></section><section class="detail-card glass system-log-card"><div class="section-head"><p class="eyebrow">today's system messages</p><span>${entries.length} SAVED</span></div>${entries.length ? entries.map((entry) => { const meta = systemMessageMeta[entry.level] || systemMessageMeta[1]; return `<button class="system-log-entry ${meta.className}" data-system-target="${entry.target}"><time>${esc(entry.date === dateKey() ? entry.time : entry.date)}</time><i></i><div><small>${meta.label}</small><strong>${esc(entry.title)}</strong><p>${esc(entry.detail)}</p></div><b>›</b></button>`; }).join("") : `<div class="timeline-empty"><i></i><strong>SYSTEM MESSAGEはまだありません</strong><p>WORLD SYNCやスキル記録によって、現実の変化がここに残ります。</p></div>`}</section>`;
}

function renderPage(page, transitionDirection = "forward") {
  clearInterval(homeClock);
  ensureDailySession();
  const w = state.world || { location:"WORLD NOT SYNCED", region:"SYNCを押して世界に入る", weather:"UNKNOWN", temperature:"—", phase:phase(new Date().getHours()), season:season(new Date().getMonth()), ambience:"最初のWORLD SYNCを待っています。" };
  const todayEvents = state.log.filter((event) => event.day === dateKey());
  const now = new Date();
  applyWorldAtmosphere(w);
  let content = page === "skills" ? renderSkillHub() : "";
  if (page === "player") { content = renderEnhancedPlayer(w); page = "__player"; }
  if (page === "navigator") { content = renderEnhancedNavigator(w); page = "__navigator"; }
  if (page === "systemlog") { content = renderSystemLog(); page = "__systemlog"; }
  if (page === "world") content = `<section class="page-hero world-page-hero"><p class="eyebrow">real world / live</p><h1>WORLD</h1><p>いま、この場所で進行している世界。</p><div class="world-orbital"><span class="location-mark">${icon("location")}</span><div><strong>${esc(w.location)}</strong><small>${esc(w.region)}</small></div><b>${esc(w.temperature)}°</b></div></section><section class="detail-card glass"><p class="eyebrow">world conditions</p><div class="condition-list"><div><span>${icon(phaseIcon(w.phase))}</span><p>TIME<b>${esc(w.phase)}</b></p></div><div><span>${icon(weatherIcon(w.weather))}</span><p>WEATHER<b>${esc(w.weather)}</b></p></div><div><span>${icon("sun")}</span><p>SEASON<b>${esc(w.season)}</b></p></div></div><p class="ambience">${esc(w.ambience)}</p><button class="primary-action" id="page-sync">SYNC WORLD</button></section>`;
  if (page === "player") { const profile = playerProfile(); const current = currentPlayerState(w); const growth = coreGrowth(); const review = growthReview(); const reviewed = state.growthReviewWeek === weekKey(); content = `<section class="page-hero player-hero"><p class="eyebrow">character profile</p><h1>PLAYER</h1><p>現実を歩く、あなた自身のステータス。</p><div class="player-portrait"><div class="player-level-ring" style="--level-progress:${state.player.exp / 5}%"><div class="level glass"><span class="eyebrow">lv</span><strong>${state.player.level}</strong></div></div><div><strong>${esc(profile.name)}</strong><small>${profile.title}<br>DAY START · ${esc(state.status?.[dateKey()] || "UNKNOWN")}</small></div></div></section><section class="detail-card glass player-identity"><div class="section-head"><p class="eyebrow">player identity</p><span>LOCAL PROFILE</span></div><input id="player-name" maxlength="24" value="${esc(profile.name)}" aria-label="プレイヤー名"><button class="subtle-action" id="save-player-name">SAVE IDENTITY</button></section><section class="detail-card glass"><div class="section-head"><p class="eyebrow">current status</p><span class="live-status"><i></i>LIVE</span></div><p class="status-intro">いまの時間・天気・PLAYER状態から変化します。</p><div class="parameter-list">${[["HP",current.hp,"#f4b9cc"],["ENERGY",current.energy,"#bfe5d0"],["FOCUS",current.focus,"#b8e5f2"],["SPIRIT",current.spirit,"#d8ccff"],["SOCIAL",current.social,"#f5d5a9"]].map(([label,value,color]) => `<div><p><span>${label}</span><b>${value}</b></p><i><span style="width:${value}%;background:${color}"></span></i></div>`).join("")}</div></section><section class="detail-card glass"><p class="eyebrow">status effects</p><div class="effect-list">${current.effects.map(([name,copy,tone]) => `<div class="effect ${tone}"><i></i><div><strong>${name}</strong><p>${copy}</p></div></div>`).join("")}</div></section><section class="detail-card glass core-growth"><div class="section-head"><p class="eyebrow">core growth</p><span>LONG TERM</span></div><p class="status-intro">数週間〜数か月で変化する、あなたの土台。</p><div class="growth-grid">${[["creativity","CREATIVITY","INT / MAGIC"],["discipline","DISCIPLINE","WILL / STAMINA"],["curiosity","CURIOSITY","PERCEPTION"],["communication","COMMUNICATION","CHA"],["resilience","RESILIENCE","VIT"]].map(([key,label,role]) => `<div><b>${growth[key]}</b><span>${label}</span><small>${role}</small></div>`).join("")}</div></section><section class="detail-card glass growth-review"><div class="section-head"><p class="eyebrow">growth review</p><span>${reviewed ? "COMPLETE" : "WEEKLY"}</span></div>${reviewed ? `<p class="status-intro">今週の成長は確定済みです。次の週にまた観測します。</p>` : review.length ? `<p class="status-intro">最近のWORLD LOGから、成長候補を検出しました。</p><div class="review-gains">${review.map(([, label, gain]) => `<span>${label}<b>+${gain}</b></span>`).join("")}</div><button class="primary-action" id="apply-growth">APPLY GROWTH</button>` : `<p class="status-intro">記録やDISCOVERYが増えると、成長候補が現れます。</p>`}</section>`; }
  if (page === "navigator") { const brief = navigatorBrief(w); content = `<section class="page-hero navigator-hero"><p class="eyebrow">personal world navigator</p><h1>NAVIGATOR</h1><p>現実のシグナルを読み、いまのあなたを補佐します。</p><div class="navigator-core ${brief.tone}"><i></i><span>ONLINE<br><b>LOCAL INTELLIGENCE</b></span><em><u></u><u></u><u></u><u></u></em></div></section><section class="navigator-message glass ${brief.tone}"><p class="eyebrow">${brief.tag}</p><h2>${brief.title}</h2><p>${brief.copy}</p><span class="navigator-scan">ANALYZING WORLD SIGNALS</span></section><section class="detail-card glass"><p class="eyebrow">signals read</p><div class="navigator-signals"><span>${esc(w.location || "LOCATION UNKNOWN")}<small>LOCATION</small></span><span>${esc(w.weather || "WEATHER UNKNOWN")}<small>WEATHER</small></span><span>${state.player.energy}<small>ENERGY</small></span><span>${state.player.focus}<small>FOCUS</small></span></div><button class="primary-action" id="refresh-navigator">OBSERVE AGAIN</button></section><p class="navigator-note">このNAVIGATORは端末内のデータだけで観測します。外部AI・課金・データ送信はありません。</p>`; }
  if (page === "archive") { const archive = archiveState(); const mode = state.atlasMode || "japan"; const discoveredPrefectures = japanAtlas.filter((item) => archive.prefectures[item.id]).length; const exploredPrefectures = japanAtlas.filter((item) => archive.places[`${item.id}:landmark`]).length; const detectedPrefecture = japanAtlas.find((item) => String(w.region || "").toUpperCase().includes(item.key)); const selected = japanAtlas.find((item) => item.id === state.atlasSelected) || detectedPrefecture || japanAtlas.find((item) => item.id === "nara"); const selectedState = archivePrefectureState(selected); const worldRegion = state.atlasWorldRegion || "ASIA"; const countriesInRegion = worldAtlas.filter((item) => item.region === worldRegion); content = `<section class="page-hero atlas-hero"><p class="eyebrow">system database / real world</p><h1>ARCHIVE</h1><p>実際に歩いた世界だけが、少しずつ色づいていく。</p><div class="atlas-stat"><span><b>${discoveredPrefectures}</b> / 47<small>JAPAN DISCOVERED</small></span><span><b>${Object.keys(archive.countries).length}</b> / ${worldAtlas.length}<small>WORLD GATEWAYS</small></span></div></section><section class="atlas-mode glass"><button class="${mode === "japan" ? "is-active" : ""}" data-atlas-mode="japan">JAPAN ATLAS</button><button class="${mode === "world" ? "is-active" : ""}" data-atlas-mode="world">WORLD ATLAS</button></section>${mode === "japan" ? `<section class="detail-card glass japan-atlas"><div class="atlas-head"><div><p class="eyebrow">japan exploration map</p><strong>${discoveredPrefectures} AREAS DISCOVERED</strong></div><span><i></i>LIVE GPS</span></div><div class="japan-map" aria-label="日本探索マップ">${japanAtlas.map((item) => `<button class="atlas-region ${archivePrefectureState(item)} ${selected.id === item.id ? "is-selected" : ""}" style="--x:${item.x};--y:${item.y}" data-atlas-pref="${item.id}" aria-label="${item.name}"><b>${item.name}</b><i></i></button>`).join("")}</div><div class="atlas-legend"><span><i class="unknown"></i>未発見</span><span><i class="discovered"></i>発見</span><span><i class="explored"></i>探索済み</span></div></section><section class="detail-card glass atlas-detail ${selectedState}"><div class="section-head"><p class="eyebrow">prefecture codex</p><span>${selectedState.toUpperCase()}</span></div><h2>${selected.name}</h2><p>${selectedState === "unknown" ? "このエリアはまだ霧に包まれています。実際に入ると、地図が開きます。" : selectedState === "discovered" ? "最初の領域を発見しました。代表スポットを訪れると探索度が上がります。" : "代表スポットを発見済み。この地域の世界はあなたの記録になりました。"}</p><div class="atlas-missions"><div class="${archive.places[`${selected.id}:landmark`] ? "complete" : ""}"><i></i><span>${selected.spot}</span><small>${archive.places[`${selected.id}:landmark`] ? "DISCOVERED" : "UNEXPLORED"}</small></div><div class="locked"><i></i><span>季節の再訪</span><small>UNKNOWN CONDITION</small></div><div class="locked"><i></i><span>夜の探索</span><small>UNKNOWN CONDITION</small></div></div></section>` : `<section class="detail-card glass world-atlas"><div class="atlas-head"><div><p class="eyebrow">world exploration map</p><strong>THE WORLD IS STILL OPEN</strong></div><span><i></i>ATLAS ONLINE</span></div><div class="world-map">${["NORTH AMERICA","SOUTH AMERICA","EUROPE","AFRICA","ASIA","OCEANIA"].map((region) => { const entries = worldAtlas.filter((item) => item.region === region); const complete = entries.filter((item) => archive.countries[item.key]).length; return `<button class="continent ${worldRegion === region ? "is-selected" : ""} ${complete ? "discovered" : ""}" data-world-region="${region}"><span>${region}</span><b>${complete} / ${entries.length}</b></button>`; }).join("")}</div><div class="world-country-list"><p class="eyebrow">${worldRegion}</p>${countriesInRegion.map((country) => `<div class="${archive.countries[country.key] ? "complete" : ""}"><i></i><span>${country.name}</span><small>${archive.countries[country.key] ? "DISCOVERED" : "UNKNOWN"}</small></div>`).join("")}</div></section>`}`; }
  if (page === "log") { const activeView = state.calendarLogView || "today"; const calendarEvents = calendarTimelineEvents(activeView); const calendarCount = state.calendar?.calendars?.length || 0; const [viewLabel,viewTitle] = calendarViewMeta[activeView] || calendarViewMeta.today; const isLinked = Boolean(state.calendar); content = `<section class="page-hero timeline-hero"><p class="eyebrow">google calendar / live timeline</p><h1>PLAYER LOG</h1><p>完了した予定は表示せず、これからの世界だけを見る。</p><div class="log-stat"><b>${calendarEvents.length}</b><span>${viewLabel}<br>${calendarCount} CALENDARS</span></div></section>${isLinked ? `<section class="calendar-view-tabs glass" aria-label="予定の表示範囲">${Object.entries(calendarViewMeta).map(([key,[label,title]]) => `<button class="${activeView === key ? "is-active" : ""}" data-calendar-view="${key}"><span>${label}</span><b>${title}</b></button>`).join("")}</section><section class="detail-card glass full-log calendar-timeline"><div class="timeline-head"><div><p class="eyebrow">world missions</p><strong>${viewTitle}</strong></div><span><i></i>LIVE</span></div>${calendarEvents.length ? calendarEvents.map((event) => { const [label,copy,tone] = calendarLogState(event); return `<article class="calendar-entry ${tone}"><time><b>${esc(calendarTime(event))}</b><span>${esc(calendarLogDate(event))}</span></time><div><p class="eyebrow"><span>${label}</span></p><strong>${esc(event.title)}</strong><p><b class="calendar-source">${esc(event.calendarName || "PRIMARY CALENDAR")}</b>${event.location ? ` · ${esc(event.location)}` : ` · ${copy}`}</p></div></article>`; }).join("") : `<div class="timeline-empty"><i></i><strong>この時間帯に予定はありません</strong><p>次のWORLD MISSIONが現れるまで、自由行動です。</p></div>`}</section>` : `<section class="detail-card glass calendar-link"><p class="eyebrow">calendar not connected</p><strong>予定をTIMELINEに読み込もう</strong><p>手入力は必要ありません。Google Calendarを連携して更新すると、予定がPLAYER LOGになります。</p><button class="primary-action" data-page="system">GO TO CALENDAR SETUP</button></section>`}`; }
  if (page === "sound") { const suggested = soundtrackFor(w); const selected = soundtrackLibrary.find((track) => track.id === state.soundtrackId) || suggested; content = `<section class="page-hero sound-hero ${suggested.tone}"><p class="eyebrow">real world soundtrack</p><h1>SOUND</h1><p>いまの現実に、世界の音楽を重ねる。</p><div class="sound-visual"><i></i><i></i><i></i><i></i><i></i></div></section><section class="sound-player glass ${suggested.tone}"><div class="section-head"><p class="eyebrow">world recommendation</p><span>AUTO</span></div><h2>${esc(suggested.scene)}</h2><p>${esc(suggested.role)} · いまの時間と場所から提案</p><iframe title="${esc(suggested.scene)} Spotify player" src="https://open.spotify.com/embed/track/${suggested.track}?utm_source=generator" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe><button class="primary-action" id="use-recommendation">SET AS NOW PLAYING</button></section>${selected.id !== suggested.id ? `<section class="detail-card glass selected-track"><p class="eyebrow">now playing</p><strong>${esc(selected.scene)}</strong><span>${esc(selected.role)}</span></section>` : ""}<section class="detail-card glass soundtrack-library"><div class="section-head"><p class="eyebrow">my soundtrack</p><span>${soundtrackLibrary.length} SCENES</span></div><p class="status-intro">シーンを選ぶと、いまのBGMとして固定できます。</p><div class="track-list">${soundtrackLibrary.map((track) => `<button class="track-choice ${selected.id === track.id ? "selected" : ""}" data-track="${track.id}"><i class="${track.tone}"></i><div><b>${esc(track.scene)}</b><span>${esc(track.role)}</span></div><em>${selected.id === track.id ? "NOW" : "SELECT"}</em></button>`).join("")}</div><button class="subtle-action" id="auto-soundtrack">RETURN TO AUTO SUGGESTION</button></section>`; }
  if (page === "sound") content += renderHomeBgmControl();
  if (page === "system") { const calendar = state.calendar; const archive = archiveState(); const feedback = feedbackSettings(); content = `<section class="page-hero"><p class="eyebrow">life system settings</p><h1>SYSTEM</h1><p>現実とLIFE SYSTEMをつなぐ設定。</p><div class="system-status"><i></i><span>WORLD INTERFACE<br><b>ONLINE</b></span></div></section><section class="detail-card glass calendar-link"><div class="section-head"><p class="eyebrow">google calendar</p><span>${calendar ? "LINKED" : "NOT CONNECTED"}</span></div><strong>${calendar ? "WORLD SCHEDULE READY" : "CONNECT YOUR SCHEDULE"}</strong><p>${calendar ? `${calendar.calendars?.length || 1} calendars · ${calendar.events.length} events · ${new Date(calendar.syncedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} synced` : "すべてのGoogleカレンダーを読み取り、PLAYER LOGとWORLD MISSIONとして表示します。"}</p><button class="primary-action" id="connect-calendar">${calendar ? "REFRESH ALL CALENDARS" : "CONNECT GOOGLE CALENDAR"}</button></section><section class="detail-card glass system-feedback"><div class="section-head"><p class="eyebrow">system feedback</p><span>SOUND LANGUAGE</span></div><strong>操作音</strong><p>選択、階層移動、WORLD SYNC、DISCOVERYに小さな音の反応を返します。</p><div><button class="subtle-action" id="toggle-sound">SOUND ${feedback.sound === false ? "OFF" : "ON"}</button></div></section><section class="detail-card glass save-data"><div class="section-head"><p class="eyebrow">save data</p><span>LOCAL BACKUP</span></div><strong>あなたの世界を保存する</strong><p>ATLASの攻略、PLAYER、設定を1つのセーブファイルに書き出します。都道府県 ${Object.keys(archive.prefectures).length}件・国 ${Object.keys(archive.countries).length}件を保存対象にしています。</p><div><button class="subtle-action" id="export-save">SAVE DATAを書き出す</button><button class="subtle-action" id="import-save">SAVE DATAを復元する</button><input id="import-save-file" type="file" accept="application/json,.json" hidden></div></section><section class="detail-card glass system-list"><button id="system-sync"><span>WORLD SYNC</span><small>現在地・天気を更新</small><b>→</b></button><button id="system-status"><span>DAY START STATUS</span><small>今日の状態を選び直す</small><b>→</b></button><div><span>PLAYER LOG</span><small>ALL GOOGLE CALENDARS · 手入力なし</small></div></section>`; }
  if (page === "archive") content += renderAtlasProgressPanel(w);
  if (page === "system") content += `<section class="detail-card glass system-log-link"><div class="section-head"><p class="eyebrow">game engine history</p><span>${systemLog().length} EVENTS</span></div><strong>SYSTEM LOG</strong><p>WORLD SYNC・ATLAS・スキル更新から発生したSYSTEM MESSAGEを確認します。</p><button class="primary-action" data-page="systemlog">SYSTEM LOGを開く</button></section>`;
  if (page === "system") content += renderTitleCollection();
  if (page === "system") content += renderNotificationSettings();
  if (page === "system") content += renderNavigatorSettings();
  if (page === "system") content += renderPlayData();
  if (page === "system") content += renderAreaSettings();
  if (page === "__player") page = "player";
  if (page === "__navigator") page = "navigator";
  if (page === "__systemlog") page = "systemlog";
  if (page === "log") content += renderWorldActivityTimeline();
  if (page === "skills") requestAnimationFrame(localiseSkillChrome);
  app.innerHTML = `<div class="shell page-shell page-enter page-enter-${transitionDirection}" data-page="${page}"><header class="page-header"><button class="home-button" data-home>← <span>HOME</span></button><p class="eyebrow">LIFE SYSTEM</p></header>${pageNav(page)}<main class="page-content">${content}</main><button class="home-fab glass" data-home aria-label="HOMEへ戻る"><i>⌂</i><span>HOME</span></button></div>`;
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.page)));
  bindPageSwipe(page);
  app.querySelectorAll("[data-home]").forEach((button) => button.addEventListener("click", () => { systemFeedback("back"); const shell = app.querySelector(".shell"); shell.classList.add("page-exit-back"); setTimeout(renderHome, 300); }));
  app.querySelector("#page-sync")?.addEventListener("click", sync);
  app.querySelector("#system-sync")?.addEventListener("click", sync);
  app.querySelector("#area-sync-check")?.addEventListener("click", sync);
  app.querySelector("#system-status")?.addEventListener("click", showStatus);
  app.querySelector("#save-play-data")?.addEventListener("click", () => { const value = app.querySelector("#player-initialized")?.value; if (!value) return; playDataState().initializedAt = value; save(); renderPage("system"); });
  app.querySelector("#set-home-area")?.addEventListener("click", async () => {
    try { await registerCurrentArea({ name:"HOME BASE", type:"home", radius:180 }); renderPage("system"); } catch { alert("位置情報を許可して、HOME BASEを登録してください。"); }
  });
  app.querySelector("#search-home-area")?.addEventListener("click", async () => {
    const query = app.querySelector("#home-area-search")?.value;
    if (!String(query || "").trim()) { alert("HOME BASEの住所・駅名・施設名を入力してください。"); return; }
    try { const results = await searchAreaPlaces(query); if (!results.length) throw new Error("place not found"); Object.assign(areaSearchState(), { target:"home", query, name:"HOME BASE", type:"home", radius:180, results }); save(); renderPage("system"); } catch { alert("場所を見つけられませんでした。住所や駅名をもう少し詳しく入力してください。"); }
  });
  app.querySelector("#set-custom-area")?.addEventListener("click", async () => {
    const name = app.querySelector("#custom-area-name")?.value; const radius = app.querySelector("#custom-area-radius")?.value;
    if (!String(name || "").trim()) { alert("AREA名を入力してください。例：KGU / CAMPUS"); return; }
    try { await registerCurrentArea({ name, type:"custom", radius }); renderPage("system"); } catch { alert("位置情報を許可して、AREAを登録してください。"); }
  });
  app.querySelector("#search-custom-area")?.addEventListener("click", async () => {
    const name = app.querySelector("#custom-area-name")?.value; const query = app.querySelector("#custom-area-search")?.value; const radius = app.querySelector("#custom-area-radius")?.value;
    if (!String(name || "").trim()) { alert("AREA名を入力してください。例：KGU / CAMPUS"); return; }
    if (!String(query || "").trim()) { alert("登録する場所名・住所を入力してください。"); return; }
    try { const results = await searchAreaPlaces(query); if (!results.length) throw new Error("place not found"); Object.assign(areaSearchState(), { target:"custom", query, name, type:"custom", radius, results }); save(); renderPage("system"); } catch { alert("場所を見つけられませんでした。住所や駅名をもう少し詳しく入力してください。"); }
  });
  app.querySelectorAll("[data-area-result]").forEach((button) => button.addEventListener("click", () => {
    const search = areaSearchState(); const item = search.results?.[Number(button.dataset.areaResult)]; if (!item) return;
    persistArea({ name:search.name, type:search.type, radius:search.radius, latitude:item.latitude, longitude:item.longitude, sourceLabel:item.label }); delete state.areaSearch; save(); renderPage("system");
  }));
  app.querySelector("#clear-area-search")?.addEventListener("click", () => { delete state.areaSearch; save(); renderPage("system"); });
  app.querySelectorAll("[data-remove-area]").forEach((button) => button.addEventListener("click", () => { state.areas = areaState().filter((area) => area.id !== button.dataset.removeArea); save(); renderPage("system"); }));
  if (page === "system") {
    const updatePlayDataClock = () => { const now = new Date(); const playtime = app.querySelector("#playtime-counter"); const day = app.querySelector("#play-day-counter"); if (playtime) playtime.textContent = formatPlayTime(now); if (day) day.textContent = gameDay(now); };
    updatePlayDataClock(); homeClock = setInterval(updatePlayDataClock, 1000);
  }
  app.querySelector("#connect-calendar")?.addEventListener("click", () => connectGoogleCalendar("system"));
  app.querySelector("#allow-notifications")?.addEventListener("click", async () => { const result = await requestLifeNotifications(); if (result === "granted") { await showLifeNotification("SYSTEM MESSAGE", "SYSTEM LINK COMPLETE\nNOTIFICATION CHANNEL: OPEN", "permission-confirmed"); } renderPage("system"); });
  app.querySelector("#test-notification")?.addEventListener("click", () => showLifeNotification("SYSTEM MESSAGE", "TEST SIGNAL RECEIVED\nPLAYER LINK: STABLE\nNo action required.", "notification-test"));
  app.querySelectorAll("[data-notification-toggle]").forEach((button) => button.addEventListener("click", () => { const settings = notificationSettings(); const key = button.dataset.notificationToggle; settings[key] = !settings[key]; save(); renderPage("system"); }));
  app.querySelectorAll("[data-intervention-level]").forEach((button) => button.addEventListener("click", () => { navigatorSettings().intervention = button.dataset.interventionLevel; save(); systemFeedback("confirm"); renderPage("system"); }));
  app.querySelectorAll("[data-system-target]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.systemTarget)));
  app.querySelector("#export-save")?.addEventListener("click", exportSaveData);
  app.querySelector("#import-save")?.addEventListener("click", () => app.querySelector("#import-save-file").click());
  app.querySelector("#import-save-file")?.addEventListener("change", (event) => importSaveData(event.target.files?.[0]));
  app.querySelector("#toggle-sound")?.addEventListener("click", () => { const feedback = feedbackSettings(); feedback.sound = feedback.sound === false; save(); systemFeedback("confirm"); renderPage("system"); });
  app.querySelector("#save-player-name")?.addEventListener("click", () => { const name = app.querySelector("#player-name").value.trim(); if (!name) return; state.profile ||= {}; state.profile.name = name.toUpperCase(); save(); renderPage("player"); });
  app.querySelector("#apply-growth")?.addEventListener("click", () => { growthReview().forEach(([key,, gain]) => { state.growth[key] = Math.min(99, state.growth[key] + gain); }); state.growthReviewWeek = weekKey(); state.log.unshift({ id:crypto.randomUUID(), day:dateKey(), time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"SYSTEM", title:"CORE GROWTH UPDATED", detail:"Weekly growth review completed." }); save(); renderPage("player"); });
  app.querySelector("#refresh-navigator")?.addEventListener("click", () => { const shell = app.querySelector(".page-shell"); shell.classList.add("navigator-refresh"); setTimeout(() => renderPage("navigator"), 360); });
  app.querySelectorAll("[data-calendar-view]").forEach((button) => button.addEventListener("click", () => { state.calendarLogView = button.dataset.calendarView; save(); renderPage("log"); }));
  app.querySelectorAll("[data-atlas-mode]").forEach((button) => button.addEventListener("click", () => { state.atlasMode = button.dataset.atlasMode; save(); renderPage("archive"); }));
  app.querySelectorAll("[data-atlas-pref]").forEach((button) => button.addEventListener("click", () => { state.atlasSelected = button.dataset.atlasPref; save(); renderPage("archive"); }));
  app.querySelectorAll("[data-world-region]").forEach((button) => button.addEventListener("click", () => { state.atlasWorldRegion = button.dataset.worldRegion; save(); renderPage("archive"); }));
  app.querySelectorAll("[data-skill-mode]").forEach((button) => button.addEventListener("click", () => { skillState().mode = button.dataset.skillMode; save(); renderPage("skills"); }));
  app.querySelectorAll("[data-skill-node]").forEach((button) => button.addEventListener("click", () => { const skills = skillState(); skills.selected = button.dataset.skillNode; skills.mode = "discover"; save(); renderPage("skills"); }));
  app.querySelectorAll("[data-skill-select]").forEach((button) => button.addEventListener("click", () => { const skills = skillState(); skills.selected = button.dataset.skillSelect; skills.mode = "discover"; save(); renderPage("skills"); }));
  app.querySelectorAll("[data-skill-domain-shortcut]").forEach((button) => button.addEventListener("click", () => { const skills = skillState(); skills.domain = button.dataset.skillDomainShortcut; skills.mode = "discover"; save(); renderPage("skills"); }));
  app.querySelector("#skill-search")?.addEventListener("input", (event) => { skillState().query = event.target.value; save(); filterVisibleSkillResults(event.target.value); });
  app.querySelector("#skill-domain")?.addEventListener("change", (event) => { skillState().domain = event.target.value; save(); renderPage("skills"); });
  app.querySelector("#save-skill-record")?.addEventListener("click", () => { const skills = skillState(); const node = skillNodes.find((item) => item.id === skills.selected); if (!node) return; const previous = skillStatus(node); const status = app.querySelector("#skill-status-select").value; const note = app.querySelector("#skill-note").value.trim(); skills.records[node.id] = { status, note, updatedAt:new Date().toISOString() }; skills.history.unshift({ id:crypto.randomUUID(), nodeId:node.id, label:node.label, status, note, date:new Date().toLocaleDateString("en-CA") }); skills.history = skills.history.slice(0,200); if (status !== previous) recordSystemMessage({ level:["passive","mastered"].includes(status) ? 3 : status === "acquired" ? 2 : 1, title:status === "mastered" ? "SKILL MASTERED" : status === "passive" ? "NEW PASSIVE SKILL DETECTED" : "SKILL UPDATE", detail:`${node.label} → ${skillStatusLabel[status]}`, target:"skills" }); save(); systemFeedback(status === "locked" ? "lock" : "discovery"); skills.mode = "history"; renderPage("skills"); });
  app.querySelectorAll("[data-skill-zoom]").forEach((button) => button.addEventListener("click", () => { const skills = skillState(); skills.zoom = Math.max(.5, Math.min(2.25, (Number(skills.zoom) || .72) + Number(button.dataset.skillZoom))); save(); renderPage("skills"); }));
  bindSkillNetworkGestures();
  app.querySelectorAll("[data-track]").forEach((button) => button.addEventListener("click", () => { state.soundtrackId = button.dataset.track; delete state.soundtrack; save(); renderPage("sound"); }));
  app.querySelector("#use-recommendation")?.addEventListener("click", () => { state.soundtrackId = soundtrackFor(w).id; delete state.soundtrack; save(); renderPage("sound"); });
  app.querySelector("#auto-soundtrack")?.addEventListener("click", () => { delete state.soundtrackId; delete state.soundtrack; save(); renderPage("sound"); });
  app.querySelector("#toggle-home-bgm")?.addEventListener("click", () => {
    if (homeBgmSettings().enabled) { stopHomeBgm(); renderPage("sound"); return; }
    homeBgmSettings().enabled = true; save(); startHomeBgm(); renderPage("sound");
  });
  activateGlassPhysics();
}

function closeView() { document.querySelector(".view-layer")?.remove(); }
function openView(name) {
  const todayEvents = state.log.filter((event) => event.day === dateKey());
  const w = state.world || {};
  let content = "";
  if (name === "record") content = `<p class="eyebrow">record event</p><h2>世界で起きたことを<br>残しますか？</h2><p class="view-copy">短い一文で大丈夫です。LIFE SYSTEMが今日の記録に加えます。</p><div class="record-types">${["EVENT","DISCOVERY","ENCOUNTER"].map((kind, i) => `<button class="type-choice ${i === 0 ? "selected" : ""}" data-kind="${kind}">${kind}</button>`).join("")}</div><textarea id="event-note" maxlength="100" placeholder="例：新しいカフェに入った"></textarea><button class="primary-action" id="save-event">RECORD EVENT</button>`;
  if (name === "observe") content = `<p class="eyebrow">observe world</p><h2>いま、この世界は<br>こんな状態です。</h2><div class="observation"><p class="eyebrow">current world state</p><strong>${esc(w.location || "WORLD UNAVAILABLE")}</strong><p>${esc(w.region || "SYNCで現在地を観測できます")}</p><div class="observation-grid"><span>${esc(w.phase || "—")}<small>時間帯</small></span><span>${esc(w.weather || "—")}<small>天気</small></span><span>${esc(w.temperature ?? "—")}°<small>気温</small></span></div><p class="view-copy">${esc(w.ambience || "まだ世界は同期されていません。")}</p></div><button class="primary-action" id="close-observation">RETURN TO WORLD</button>`;
  if (name === "complete") { const result = sessionSummary(); content = `<p class="eyebrow">day complete / session result</p><h2>今日の世界を<br>ここで閉じますか？</h2><div class="result-grid"><div><b>${result.events}</b><span>EVENTS</span></div><div><b>${result.areas}</b><span>AREAS</span></div><div><b>${result.discoveries}</b><span>NEW</span></div></div><div class="result-status"><p class="eyebrow">today's session</p><strong>DAY ${gameDay()} · ${formatPlayTime()}</strong></div><button class="primary-action" id="finish-day">COMPLETE DAY</button>`; }
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
  layer.querySelector("#finish-day")?.addEventListener("click", () => { const title = "DAY COMPLETE"; const result = sessionSummary(); const session = dailySessionState(); session.status = "complete"; session.completedAt = new Date().toISOString(); state.sessionHistory ||= []; if (!state.sessionHistory.some((entry) => entry.day === session.day)) state.sessionHistory.unshift({ day:session.day, completedAt:session.completedAt, ...result }); if (!state.log.some((e) => e.day === dateKey() && e.title === title)) state.log.unshift({ id:crypto.randomUUID(), day:dateKey(), time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), kind:"SYSTEM", title, detail:`${result.events} EVENTS · ${result.areas} AREAS · ${result.discoveries} DISCOVERIES` }); save(); closeView(); renderHome(); });
}
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { updateViaCache:"none" }));
window.addEventListener("load", () => { checkLifeReminders(); setInterval(checkLifeReminders, 60_000); setInterval(syncHomeBgmScene, 60_000); });
document.addEventListener("pointerdown", () => { if (!playPendingCelebration()) startHomeBgm(); }, { once:true, passive:true });
boot();
