import { canvas, ctx, hud, menu, resultUi, overlays } from "./ui/dom.js";
import { createHudController } from "./ui/hudController.js";
import { bindInputHandlers } from "./ui/inputController.js";
import { createMapRuntime } from "./core/map.js";
import { towerCatalog } from "./data/towerCatalog.js";
import { fishCatalog } from "./data/fishCatalog.js";
import { defaultMapId, mapCatalog } from "./data/maps/mapCatalog.js";
import { defaultStageId, stageCatalog } from "./data/waves/stageCatalog.js";
import { createFishFactory } from "./entities/fishFactory.js";
import { createAudioSystem } from "./systems/audioSystem.js";
import { createCombatSystem } from "./systems/combatSystem.js";
import { createSpawnSystem } from "./systems/spawnSystem.js";
import { createTowerSystem } from "./systems/towerSystem.js";
import { createRenderer } from "./render/renderer.js";

const urlParams = new URLSearchParams(window.location.search);
const activeSaveSlot = ["1", "2", "3"].includes(urlParams.get("slot")) ? urlParams.get("slot") : "1";
const STORAGE_KEYS = {
  progress: `fish-td-v2-progress-slot${activeSaveSlot}`,
  settings: "fish-td-v2-settings"
};

const DEFAULT_SETTINGS = {
  audioMuted: false,
  bgmVolume: Number(hud.bgmVolume?.value ?? 45) / 100,
  sfxVolume: Number(hud.sfxVolume?.value ?? 70) / 100,
  showDamageText: true,
  fxDensity: "中",
  showTowerPanel: true
};

const DEFAULT_PROGRESS = {
  stars: {},
  unlockedStages: ["endless_default", "stage_shallow_intro"],
  bestScores: {},
  seenFish: [],
  seenTowers: []
};

function createFatalErrorOverlay() {
  const el = document.createElement("div");
  el.id = "fatalErrorOverlay";
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    zIndex: "100000",
    display: "none",
    placeItems: "center",
    padding: "20px",
    background: "rgba(2,12,18,0.92)",
    color: "#e7fbff",
    fontFamily: "\"Avenir Next\", \"PingFang TC\", sans-serif"
  });
  el.innerHTML = `
    <div style="max-width:720px;width:100%;border:1px solid rgba(255,123,123,0.35);background:rgba(18,8,12,0.9);border-radius:14px;padding:16px;">
      <div style="font-size:12px;color:#ffb0b0;letter-spacing:1px;margin-bottom:6px;">啟動 / 執行錯誤</div>
      <div id="fatalErrorTitle" style="font-size:20px;font-weight:700;margin-bottom:8px;">遊戲發生錯誤</div>
      <div id="fatalErrorMessage" style="font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#ffdfe1;"></div>
    </div>
  `;
  document.addEventListener("DOMContentLoaded", () => document.body.append(el), { once: true });
  if (document.body) document.body.append(el);
  return el;
}

const fatalErrorOverlay = createFatalErrorOverlay();
let fatalErrorShown = false;
function showFatalError(error, context = "runtime") {
  const message = String(error?.stack || error?.message || error || "unknown error");
  console.error(`[fatal:${context}]`, error);
  fatalErrorShown = true;
  if (!fatalErrorOverlay) return;
  fatalErrorOverlay.style.display = "grid";
  const title = fatalErrorOverlay.querySelector("#fatalErrorTitle");
  const body = fatalErrorOverlay.querySelector("#fatalErrorMessage");
  if (title) title.textContent = context === "startup" ? "遊戲啟動失敗" : "遊戲執行中發生錯誤";
  if (body) body.textContent = `${context}\n${message}`;
}

window.addEventListener("error", (event) => {
  showFatalError(event.error || event.message || "Uncaught", "runtime");
});
window.addEventListener("unhandledrejection", (event) => {
  showFatalError(event.reason || "Unhandled Promise Rejection", "runtime");
});

function clamp01(v, fallback) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

function sanitizeSettings(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  return {
    audioMuted: Boolean(obj.audioMuted ?? DEFAULT_SETTINGS.audioMuted),
    bgmVolume: clamp01(Number(obj.bgmVolume), DEFAULT_SETTINGS.bgmVolume),
    sfxVolume: clamp01(Number(obj.sfxVolume), DEFAULT_SETTINGS.sfxVolume),
    showDamageText: obj.showDamageText !== false,
    fxDensity: ["低", "中", "高"].includes(obj.fxDensity) ? obj.fxDensity : DEFAULT_SETTINGS.fxDensity,
    showTowerPanel: obj.showTowerPanel !== false
  };
}

function sanitizeProgress(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const stars = {};
  for (const [k, v] of Object.entries(obj.stars ?? {})) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    stars[k] = Math.max(0, Math.min(3, Math.floor(n)));
  }
  const unlockedStages = Array.isArray(obj.unlockedStages)
    ? obj.unlockedStages.filter((id) => typeof id === "string" && stageCatalog[id])
    : [];
  if (!unlockedStages.includes("endless_default")) unlockedStages.unshift("endless_default");
  if (!unlockedStages.includes("stage_shallow_intro")) unlockedStages.push("stage_shallow_intro");
  const bestScores = {};
  for (const [k, v] of Object.entries(obj.bestScores ?? {})) {
    const n = Number(v);
    if (Number.isFinite(n)) bestScores[k] = Math.max(0, Math.floor(n));
  }
  const uniqStrings = (arr) => [...new Set((Array.isArray(arr) ? arr : []).filter((x) => typeof x === "string"))];
  const migrateFishId = (id) => (id === "tunaMedium" ? "oarfish" : id);
  return {
    stars,
    unlockedStages,
    bestScores,
    seenFish: uniqStrings(obj.seenFish).map(migrateFishId),
    seenTowers: uniqStrings(obj.seenTowers)
  };
}

function loadJsonStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function saveJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage failures in restricted environments.
  }
}

async function readPersistentSave(key) {
  try {
    if (window.gameBridge?.readSave) {
      const res = await window.gameBridge.readSave(key);
      if (res?.ok && res.data && typeof res.data === "object") return res.data;
    }
  } catch {}
  return loadJsonStorage(key, {});
}

function writePersistentSave(key, value) {
  saveJsonStorage(key, value);
  try {
    if (window.gameBridge?.writeSave) {
      window.gameBridge.writeSave(key, value).catch(() => {});
    }
  } catch {}
}

const savedSettings = sanitizeSettings(loadJsonStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
const savedProgress = sanitizeProgress(loadJsonStorage(STORAGE_KEYS.progress, DEFAULT_PROGRESS));
const requestedStageId = urlParams.get("stage") ?? defaultStageId;
const requestedMapId = urlParams.get("map");
const initialStage = stageCatalog[requestedStageId] ?? stageCatalog[defaultStageId];
const stageMapId = initialStage?.mapId ?? defaultMapId;
const resolvedMapId = mapCatalog[requestedMapId] && requestedMapId === stageMapId ? requestedMapId : stageMapId;

const game = {
  lives: 20,
  maxLives: 20,
  gold: 120,
  kills: 0,
  wave: 0,
  timeScale: 1,
  paused: true,
  towers: [],
  bullets: [],
  fishes: [],
  particles: [],
  spawnQueue: [],
  spawnTimer: 0,
  waveActive: false,
  nextFishId: 1,
  nextTowerId: 1,
  inMainMenu: true,
  mapId: resolvedMapId,
  stageId: initialStage.id,
  stageLabel: initialStage.label,
  stageShortLabel: initialStage.label,
  mapShortLabel: (mapCatalog[resolvedMapId]?.name ?? resolvedMapId),
  stageCleared: false,
  stageFailed: false,
  stageFailReason: "",
  selectedTowerType: "basic",
  audioMuted: Boolean(savedSettings.audioMuted),
  bgmVolume: Number(savedSettings.bgmVolume ?? (Number(hud.bgmVolume?.value ?? 45) / 100)),
  sfxVolume: Number(savedSettings.sfxVolume ?? (Number(hud.sfxVolume?.value ?? 70) / 100)),
  gameOverSfxPlayed: false,
  stageRewarded: false,
  lastAwardedStars: 0,
  lastResultReward: 0,
  currentSaveSlot: activeSaveSlot,
  resultShown: false,
  selectedTowerId: null,
  lastMessage: "",
  bossAlert: { text: "", badge: "警報", timer: 0, total: 0 },
  stats: {
    towersPlaced: 0,
    towerUpgrades: 0,
    branchUpgrades: 0,
    bossKills: 0,
    maxWaveReached: 0
  },
  displaySettings: {
    showDamageText: savedSettings.showDamageText !== false,
    fxDensity: ["低", "中", "高"].includes(savedSettings.fxDensity) ? savedSettings.fxDensity : "中",
    showTowerPanel: savedSettings.showTowerPanel !== false
  }
};

if (hud.bgmVolume) hud.bgmVolume.value = String(Math.round(game.bgmVolume * 100));
if (hud.sfxVolume) hud.sfxVolume.value = String(Math.round(game.sfxVolume * 100));

const activeMap = mapCatalog[game.mapId] ?? mapCatalog[defaultMapId];
const { GRID, pathCells, pathPoints, pathCellSet } = createMapRuntime(activeMap);
const activeStage = stageCatalog[game.stageId] ?? stageCatalog[defaultStageId];

const { updateAudioHud, applyAudioVolumes, ensureAudio, playSfx, updateBgmScheduler } = createAudioSystem({ game, hud });
const { setMessage: setHudMessage, updateHud } = createHudController({ hud, game, updateAudioHud });

function setMessage(text) {
  game.lastMessage = text;
  setHudMessage(text);
}

function isMainMenuVisible() {
  return Boolean(menu.overlay && !menu.overlay.classList.contains("is-hidden"));
}

function syncMenuStateFromDom() {
  game.inMainMenu = isMainMenuVisible();
}

const fishFactory = createFishFactory({ game, fishCatalog, pathPoints });
const spawnFish = (kindKey, overrides) => {
  markFishSeen(kindKey);
  return fishFactory.spawnFish(kindKey, overrides);
};

function gridFromMouse(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  const cellX = Math.floor((x - GRID.x) / GRID.size);
  const cellY = Math.floor((y - GRID.y) / GRID.size);
  return { x, y, cellX, cellY };
}

const { makeTower, placeTower, upgradeTower, upgradeTowerBranch, setSelectedTowerType, getTowerBranchOptions } = createTowerSystem({
  game,
  GRID,
  pathCellSet,
  towerCatalog,
  setMessage,
  playSfx,
  updateHud,
  ensureAudio,
  burst: (...args) => burst(...args)
});

const { burst, updateTowers, updateBullets, updateParticles, updateFishes } = createCombatSystem({
  game,
  fishCatalog,
  pathPoints,
  spawnFish,
  setMessage,
  playSfx,
  showBossAlert
});

const { startNextWave, updateSpawning } = createSpawnSystem({
  game,
  spawnFish,
  setMessage,
  playSfx,
  updateHud,
  wavePlan: activeStage.wavePlan,
  showBossAlert,
  onStageWavePlanComplete: () => evaluateStageClearConditions(activeStage)
});

let pendingMapId = game.mapId;
let pendingStageId = game.stageId;
let activeMenuPanel = "home";
const stageStarProgress = { ...(savedProgress.stars ?? {}) };
const unlockedStages = new Set(savedProgress.unlockedStages ?? ["endless_default", "stage_shallow_intro"]);
const bestScores = { ...(savedProgress.bestScores ?? {}) };
const seenFish = new Set(savedProgress.seenFish ?? []);
const seenTowers = new Set(savedProgress.seenTowers ?? []);
markTowerSeen(game.selectedTowerType);
let activeCodexDetail = null;
const codexFilters = {
  search: "",
  type: "all",
  size: "all",
  skill: "all"
};

function skillLabel(skill) {
  if (!skill?.type) return "未知";
  const map = {
    accelerate_on_hp: "低血加速",
    armor_static: "護甲",
    split_on_death: "死亡分裂",
    boss_summon_threshold: "召喚魚群",
    boss_shield_threshold: "護盾階段"
  };
  return map[skill.type] ?? skill.type;
}

function stageMetaSummary(stage) {
  const isEndless = stage.id.startsWith("endless");
  if (isEndless) return { modeLabel: "無盡模式", waveLabel: "Boss 每 5 波", bossLabel: "深海鯨王" };
  const waveCount = Number(stage.wavePlan?.maxWaves ?? 0);
  const hasBoss = Boolean(stage.wavePlan?.bossWave?.bossKind);
  return {
    modeLabel: "關卡模式",
    waveLabel: `${waveCount || "?"} 波`,
    bossLabel: hasBoss ? "含 Boss" : "一般波次"
  };
}

function stageClearConditionLines(stage) {
  if (!stage || stage.id.startsWith("endless")) return ["存活越久越好（無盡模式）"];
  const conds = stage.wavePlan?.clearConditions ?? [];
  const lines = [`通關並完成 ${stage.wavePlan?.maxWaves ?? "?"} 波`];
  for (const cond of conds) {
    if (cond.type === "minLives") lines.push(`剩餘生命至少 ${cond.value}`);
    else if (cond.type === "minKills") lines.push(`擊殺至少 ${cond.value}`);
    else if (cond.type === "maxLeaks") lines.push(`漏怪最多 ${cond.value}`);
    else if (cond.type === "maxTowersPlaced") lines.push(`建塔數量最多 ${cond.value}`);
  }
  return lines;
}

function stageClearConditionText(stage) {
  return stageClearConditionLines(stage).join("｜");
}

function getStageConditionStatuses(stage, { forPending = false } = {}) {
  const targetStage = stage ?? stageCatalog[forPending ? pendingStageId : game.stageId];
  if (!targetStage) return [];
  const statuses = [];
  const waveTarget = targetStage.wavePlan?.maxWaves ?? 0;
  const currentWave = forPending ? 0 : game.wave;
  statuses.push({
    key: "waves",
    label: "波次",
    current: Math.min(currentWave, waveTarget || currentWave),
    target: waveTarget || null,
    rule: waveTarget ? `完成 ${waveTarget} 波` : "完成波次",
    ok: !waveTarget || currentWave >= waveTarget,
    kind: "min"
  });
  if (targetStage.id.startsWith("endless")) {
    statuses.push({
      key: "endless",
      label: "模式",
      current: forPending ? "無盡" : `擊殺 ${game.kills}`,
      target: null,
      rule: "存活越久越好",
      ok: true,
      kind: "info"
    });
    return statuses;
  }
  for (const cond of targetStage.wavePlan?.clearConditions ?? []) {
    if (cond.type === "minLives") {
      const current = forPending ? game.maxLives : game.lives;
      statuses.push({ key: cond.type, label: "生命", current, target: cond.value, rule: `≥ ${cond.value}`, ok: current >= cond.value, kind: "min" });
    } else if (cond.type === "minKills") {
      const current = forPending ? 0 : game.kills;
      statuses.push({ key: cond.type, label: "擊殺", current, target: cond.value, rule: `≥ ${cond.value}`, ok: current >= cond.value, kind: "min" });
    } else if (cond.type === "maxLeaks") {
      const current = forPending ? 0 : Math.max(0, game.maxLives - game.lives);
      statuses.push({ key: cond.type, label: "漏怪", current, target: cond.value, rule: `≤ ${cond.value}`, ok: current <= cond.value, kind: "max" });
    } else if (cond.type === "maxTowersPlaced") {
      const current = forPending ? 0 : game.stats.towersPlaced;
      statuses.push({ key: cond.type, label: "建塔", current, target: cond.value, rule: `≤ ${cond.value}`, ok: current <= cond.value, kind: "max" });
    }
  }
  return statuses;
}

function stageConditionProgressSegments(stage) {
  return getStageConditionStatuses(stage).map((s) => {
    if (s.target == null) return `${s.label} ${s.current}${s.ok ? "✓" : ""}`;
    return `${s.label} ${s.current}/${s.target}${s.ok ? "✓" : ""}`;
  });
}

function updateHudClearConditionLabel() {
  if (!hud.clearConditionLabel) return;
  const stageForRule = stageCatalog[pendingStageId];
  const stageForProgress = game.inMainMenu ? stageForRule : (stageCatalog[game.stageId] ?? stageForRule);
  const ruleText = stageClearConditionText(stageForRule);
  const statuses = getStageConditionStatuses(stageForProgress, { forPending: game.inMainMenu });
  const chips = statuses.map((s) => {
    const cls = s.ok ? "is-ok" : (s.kind === "max" && Number(s.current) > Number(s.target) ? "is-bad" : "");
    const value = s.target == null ? `${s.current}` : `${s.current}/${s.target}`;
    return `<span class="condition-chip ${cls}"><em>${s.label}</em><strong>${value}</strong></span>`;
  }).join("");
  hud.clearConditionLabel.innerHTML = `<span class="prefix">過關條件</span><span class="rules">${ruleText}</span><span class="progress">${chips}</span>`;
}

function evaluateStageClearConditions(stage) {
  if (!stage || stage.id.startsWith("endless")) {
    return { ok: true, reason: "", message: `關卡完成！已通關 ${stage?.label ?? "本關卡"}。` };
  }
  const failures = [];
  for (const cond of stage.wavePlan?.clearConditions ?? []) {
    if (cond.type === "minLives" && game.lives < cond.value) failures.push(`生命不足（需 ≥ ${cond.value}）`);
    if (cond.type === "minKills" && game.kills < cond.value) failures.push(`擊殺不足（需 ≥ ${cond.value}）`);
    if (cond.type === "maxLeaks") {
      const leaks = Math.max(0, game.maxLives - game.lives);
      if (leaks > cond.value) failures.push(`漏怪過多（需 ≤ ${cond.value}，目前 ${leaks}）`);
    }
    if (cond.type === "maxTowersPlaced" && game.stats.towersPlaced > cond.value) {
      failures.push(`建塔超限（需 ≤ ${cond.value}，目前 ${game.stats.towersPlaced}）`);
    }
  }
  if (failures.length) {
    return {
      ok: false,
      reason: failures[0],
      message: `未達過關條件：${failures[0]}`
    };
  }
  return { ok: true, reason: "", message: `關卡完成！已達成 ${stage.label} 的過關條件。` };
}

function starsText(stageId) {
  const stars = stageStarProgress[stageId] ?? 0;
  return `${"★".repeat(stars)}${"☆".repeat(Math.max(0, 3 - stars))}`;
}

function mapPreviewSrc(mapId) {
  const table = {
    defaultMap: "./assets/map-previews/shallow-bay.svg",
    coralMaze: "./assets/map-previews/coral-maze.svg",
    deepTrench: "./assets/map-previews/deep-trench.svg"
  };
  return table[mapId] ?? table.defaultMap;
}

function mapPreviewThemeClass(mapId) {
  const table = {
    defaultMap: "theme-shallow",
    coralMaze: "theme-coral",
    deepTrench: "theme-trench"
  };
  return table[mapId] ?? "theme-shallow";
}

function describeSkill(skill) {
  switch (skill?.type) {
    case "accelerate_on_hp":
      return `低血量（${Math.round((skill.triggerHpRatio ?? 0) * 100)}%）時速度提升至 ${(skill.multiplier ?? 1).toFixed(2)}x`;
    case "armor_static":
      return `固定護甲減傷，實際承傷 ${(Math.round((skill.armorRatio ?? 1) * 100))}%`;
    case "split_on_death":
      return `死亡時分裂 ${skill.count ?? 0} 隻 ${fishCatalog[skill.into]?.label ?? skill.into}（HP ${(Math.round((skill.hpScale ?? 1) * 100))}%）`;
    case "boss_summon_threshold":
      return `血量門檻召喚魚群（${(skill.thresholds ?? []).map((t) => `${Math.round(t * 100)}%`).join(" / ")}）`;
    case "boss_shield_threshold":
      return `血量門檻展開護盾（${(skill.thresholds ?? []).map((t) => `${Math.round(t * 100)}%`).join(" / ")}），護盾值 ${(Math.round((skill.shieldRatio ?? 0) * 100))}%`;
    default:
      return skillLabel(skill);
  }
}

function fishPhotoUrl(fishId, fish) {
  const explicit = {
    sharkSmall: "./assets/fish-codex/shark-small-real.png",
    sharkLarge: "./assets/fish-codex/shark-large-real.png",
    whale: "./assets/fish-codex/whale-real.png",
    bossWhaleKing: "./assets/fish-codex/boss-whale-king-real.jpeg",
    tunaSmall: "./assets/fish-codex/tuna-real.png",
    oarfish: "./assets/fish-codex/oarfish-real.png",
    puffer: "./assets/fish-codex/puffer-real.png",
    ray: "./assets/fish-codex/ray-real.png",
    swordfish: "./assets/fish-codex/swordfish-real.png"
  };
  if (explicit[fishId]) return explicit[fishId];
  const bySpecies = {
    "鯊魚": "./assets/fish-codex/shark-small.svg",
    "鯨魚": "./assets/fish-codex/whale.svg",
    "鮪魚": "./assets/fish-codex/tuna-medium.svg",
    "皇帶魚": "./assets/fish-codex/oarfish-real.png",
    "河豚": "./assets/fish-codex/puffer.svg",
    "魟魚": "./assets/fish-codex/ray-real.png",
    "旗魚": "./assets/fish-codex/swordfish.svg"
  };
  return bySpecies[fish?.species] ?? "./assets/fish-codex/fish-generic.svg";
}

function towerPhotoUrl(towerId) {
  const map = {
    basic: "./assets/tower-codex/basic-real.png",
    slow: "./assets/tower-codex/slow-real.png",
    splash: "./assets/tower-codex/splash-real.png",
    sniper: "./assets/tower-codex/sniper-real.png",
    support: "./assets/tower-codex/support-real.png"
  };
  return map[towerId] ?? null;
}

function towerBranchPreviewText(tower, slot) {
  const options = getTowerBranchOptions?.(tower);
  const branch = options?.[slot];
  if (!branch) return null;
  const previews = {
    basic: {
      A: "提高射程與暴擊，偏單體爆發",
      B: "提高攻速與連射機率，偏持續輸出"
    },
    slow: {
      A: "強化緩速與脈衝控場範圍",
      B: "附加破甲效果，支援隊友輸出"
    },
    splash: {
      A: "提高爆炸半徑與濺射倍率",
      B: "附加燃燒持續傷害"
    },
    sniper: {
      A: "暴擊強化 + 低血量處決門檻",
      B: "對 Boss/重甲更強，提升穿透"
    },
    support: {
      A: "提高攻速/暴擊增益，偏輸出放大",
      B: "提高光環範圍/射程與破甲支援"
    }
  };
  return `${branch.label}：${previews[tower.typeKey]?.[slot] ?? "強化該路線特性"}`;
}

function describeActiveSupportBuff(buff) {
  if (!buff) return "未受支援塔增益";
  const parts = [];
  if (buff.damageMult && buff.damageMult > 1.001) parts.push(`傷害 x${buff.damageMult.toFixed(2)}`);
  if (buff.fireRateMult && buff.fireRateMult < 0.999) parts.push(`攻速 x${buff.fireRateMult.toFixed(2)}`);
  if (buff.rangeBonus && buff.rangeBonus > 0) parts.push(`射程 +${Math.round(buff.rangeBonus)}`);
  if (buff.critBonus && buff.critBonus > 0) parts.push(`暴擊 +${Math.round(buff.critBonus * 100)}%`);
  if (buff.armorBreakBonus && buff.armorBreakBonus > 0) parts.push(`破甲 +${Math.round(buff.armorBreakBonus * 100)}%`);
  return parts.length ? parts.join("｜") : "未受支援塔增益";
}

function estimateTowerUpgradePreview(tower) {
  if (!tower || tower.level >= 4) return "已滿級";
  if (tower.typeKey === "support") {
    const aura = tower.supportAura ?? {};
    return `光環半徑 ${Math.round((aura.radius ?? 0) + 12)}｜傷害 x${Math.min(1.55, (aura.damageMult ?? 1) + 0.03).toFixed(2)}｜攻速 x${Math.max(0.62, (aura.fireRateMult ?? 1) - 0.03).toFixed(2)}｜射程 +${Math.round((aura.rangeBonus ?? 0) + 3)}`;
  }
  const nextDamage = Math.round(tower.damage + (tower.typeKey === "slow" ? 4 : tower.typeKey === "splash" ? 7 : tower.typeKey === "sniper" ? 14 : 8));
  const nextRange = Math.round(tower.range + (tower.typeKey === "slow" ? 14 : tower.typeKey === "sniper" ? 20 : 18));
  const nextFireRate = tower.typeKey === "sniper"
    ? Math.max(0.75, tower.fireRate * 0.93)
    : Math.max(tower.typeKey === "splash" ? 0.45 : 0.2, tower.fireRate * 0.9);
  let text = `傷害 ${nextDamage}｜射程 ${nextRange}｜攻速 ${nextFireRate.toFixed(2)}s`;
  if (tower.typeKey === "sniper") {
    const nextCritChance = Math.min(0.6, (tower.critChance ?? 0) + 0.03);
    const nextCritMultiplier = Math.min(3.4, (tower.critMultiplier ?? 1.8) + 0.08);
    text += `｜暴擊 ${Math.round(nextCritChance * 100)}% x${nextCritMultiplier.toFixed(2)}`;
  }
  if (tower.typeKey === "slow" && tower.slow) {
    const nextSlow = Math.max(0.34, tower.slow.multiplier - 0.05);
    text += `｜緩速 ${Math.round((1 - nextSlow) * 100)}%`;
  }
  if (tower.typeKey === "splash" && tower.splashRadius) {
    text += `｜範圍 ${Math.round(tower.splashRadius + 8)}`;
  }
  return text;
}

function towerDpsSummary(tower) {
  if (!tower) return "-";
  const baseDps = tower.fireRate > 0 ? tower.damage / tower.fireRate : tower.damage;
  if (tower.typeKey === "support") return `支援塔（無直接輸出）`;
  const buff = tower.activeSupportBuff;
  if (!buff) return `${Math.round(baseDps)}`;
  const buffedDamage = tower.damage * (buff.damageMult ?? 1);
  const buffedFireRate = Math.max(0.08, tower.fireRate * (buff.fireRateMult ?? 1));
  const buffedDps = buffedFireRate > 0 ? buffedDamage / buffedFireRate : buffedDamage;
  return `${Math.round(baseDps)} → ${Math.round(buffedDps)} (支援中)`;
}

function getStagesContainingFish(targetFishId) {
  const result = [];
  for (const stage of Object.values(stageCatalog)) {
    const ids = new Set();
    for (const rule of stage.wavePlan?.rules ?? []) ids.add(rule.kind);
    for (const rule of stage.wavePlan?.bossWave?.extraRules ?? []) ids.add(rule.kind);
    if (stage.wavePlan?.bossWave?.bossKind) ids.add(stage.wavePlan.bossWave.bossKind);
    if (ids.has(targetFishId)) result.push(stage.label);
  }
  return result;
}

function codexCompletion() {
  const fishTotal = Object.keys(fishCatalog).length;
  const towerTotal = Object.keys(towerCatalog).length;
  return {
    fishSeen: seenFish.size,
    fishTotal,
    towerSeen: seenTowers.size,
    towerTotal
  };
}

function updateCodexCompletionLabels() {
  const c = codexCompletion();
  const fishPct = c.fishTotal ? Math.round((c.fishSeen / c.fishTotal) * 100) : 0;
  const towerPct = c.towerTotal ? Math.round((c.towerSeen / c.towerTotal) * 100) : 0;
  if (menu.fishCompletionLabel) menu.fishCompletionLabel.textContent = `${c.fishSeen} / ${c.fishTotal} (${fishPct}%)`;
  if (menu.towerCompletionLabel) menu.towerCompletionLabel.textContent = `${c.towerSeen} / ${c.towerTotal} (${towerPct}%)`;
  if (menu.fishCodexSummary) menu.fishCodexSummary.textContent = `完成率：${c.fishSeen} / ${c.fishTotal}（${fishPct}%）`;
  if (menu.towerCodexSummary) menu.towerCodexSummary.textContent = `完成率：${c.towerSeen} / ${c.towerTotal}（${towerPct}%）`;
}

function selectedTower() {
  return game.towers.find((t) => t.id === game.selectedTowerId) ?? null;
}

function refreshTowerInfoPanel() {
  if (!hud.towerInfoPanel) return;
  const tower = selectedTower();
  const disableActions = (reasonText = "") => {
    if (hud.towerInfoActions) hud.towerInfoActions.classList.add("is-disabled");
    if (hud.towerInfoUpgradeBtn) {
      hud.towerInfoUpgradeBtn.disabled = true;
      hud.towerInfoUpgradeBtn.textContent = "升級";
      hud.towerInfoUpgradeBtn.classList.remove("is-ready", "is-selected");
      if (reasonText) hud.towerInfoUpgradeBtn.title = reasonText;
    }
    if (hud.towerInfoBranchABtn) {
      hud.towerInfoBranchABtn.disabled = true;
      hud.towerInfoBranchABtn.textContent = "分支 A";
      hud.towerInfoBranchABtn.classList.remove("is-ready", "is-selected");
      if (reasonText) hud.towerInfoBranchABtn.title = reasonText;
    }
    if (hud.towerInfoBranchBBtn) {
      hud.towerInfoBranchBBtn.disabled = true;
      hud.towerInfoBranchBBtn.textContent = "分支 B";
      hud.towerInfoBranchBBtn.classList.remove("is-ready", "is-selected");
      if (reasonText) hud.towerInfoBranchBBtn.title = reasonText;
    }
  };
  const clearActionTitles = () => {
    for (const btn of [hud.towerInfoUpgradeBtn, hud.towerInfoBranchABtn, hud.towerInfoBranchBBtn]) {
      if (btn) btn.title = "";
    }
  };
  if (!game.displaySettings.showTowerPanel) {
    hud.towerInfoPanel.classList.add("is-empty");
    if (hud.towerInfoTitle) hud.towerInfoTitle.textContent = "塔台資訊已關閉";
    if (hud.towerInfoMeta) hud.towerInfoMeta.textContent = "可在設定中重新開啟塔台資訊面板。";
    if (hud.towerInfoStats) hud.towerInfoStats.innerHTML = "";
    disableActions("塔台資訊面板已關閉");
    return;
  }
  if (!tower) {
    hud.towerInfoPanel.classList.add("is-empty");
    if (hud.towerInfoTitle) hud.towerInfoTitle.textContent = "未選取塔台";
    if (hud.towerInfoMeta) hud.towerInfoMeta.textContent = "點擊已部署塔台查看屬性與分支狀態。";
    if (hud.towerInfoStats) hud.towerInfoStats.innerHTML = "";
    disableActions("請先選取塔台");
    return;
  }
  hud.towerInfoPanel.classList.remove("is-empty");
  hud.towerInfoActions?.classList.remove("is-disabled");
  clearActionTitles();
  if (hud.towerInfoTitle) hud.towerInfoTitle.textContent = `${tower.typeLabel} Lv.${tower.level}`;
  if (hud.towerInfoMeta) {
    const branch = tower.branchLabel ? `｜${tower.branchLabel}${tower.branchTier ? ` ${tower.branchTier}` : ""}` : "";
    hud.towerInfoMeta.textContent = `座標 (${tower.cellX + 1}, ${tower.cellY + 1}) ${branch}`;
  }
  const options = getTowerBranchOptions?.(tower) ?? {};
  const branchA = options.A;
  const branchB = options.B;
  const upgradePreview = estimateTowerUpgradePreview(tower);
  if (hud.towerInfoStats) {
    const dps = tower.fireRate > 0 ? tower.damage / tower.fireRate : tower.damage;
    const branchState = tower.branchLabel
      ? `${tower.branchLabel}${tower.branchTier ? ` ${tower.branchTier}` : ""}`
      : "未選分支";
    const rows = [
      ["傷害", Math.round(tower.damage)],
      ["射程", Math.round(tower.range)],
      ["攻速", `${tower.fireRate.toFixed(2)}s`],
      ["DPS(估算)", Math.round(dps)],
      ["DPS對照", towerDpsSummary(tower)],
      ["分支", branchState],
      ["升級費", tower.level >= 4 ? "已滿級" : tower.upgradeCost],
      ["升級後", upgradePreview]
    ];
    if (tower.slow) rows.push(["緩速", `${Math.round((1 - tower.slow.multiplier) * 100)}% / ${tower.slow.duration.toFixed(1)}s`]);
    if (tower.splashRadius) rows.push(["範圍", `${Math.round(tower.splashRadius)} (${Math.round((tower.splashRatio ?? 0) * 100)}%)`]);
    if (tower.critChance) rows.push(["暴擊", `${Math.round((tower.critChance ?? 0) * 100)}% x${(tower.critMultiplier ?? 1).toFixed(2)}`]);
    if (tower.supportAura) {
      rows.push(["增益光環", `半徑 ${Math.round(tower.supportAura.radius)}｜傷害 x${(tower.supportAura.damageMult ?? 1).toFixed(2)}`]);
      rows.push(["輔助效果", `攻速 x${(tower.supportAura.fireRateMult ?? 1).toFixed(2)}｜射程 +${Math.round(tower.supportAura.rangeBonus ?? 0)}`]);
    } else {
      rows.push(["支援加成", describeActiveSupportBuff(tower.activeSupportBuff)]);
    }
    if (tower.armorBreak) rows.push(["破甲", `${Math.round((tower.armorBreak.amount ?? 0) * 100)}%`]);
    if (tower.burn) rows.push(["灼燒", `${Math.round(tower.burn.dps ?? 0)} DPS`]);
    if (branchA) rows.push(["分支A預覽", towerBranchPreviewText(tower, "A")?.replace(`${branchA.label}：`, "") ?? branchA.label]);
    if (branchB) rows.push(["分支B預覽", towerBranchPreviewText(tower, "B")?.replace(`${branchB.label}：`, "") ?? branchB.label]);
    hud.towerInfoStats.innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><strong>${v}</strong></div>`).join("");
  }
  if (hud.towerInfoUpgradeBtn) {
    const canUpgrade = tower.level < 4 && game.gold >= tower.upgradeCost;
    hud.towerInfoUpgradeBtn.disabled = tower.level >= 4 || game.gold < tower.upgradeCost;
    hud.towerInfoUpgradeBtn.textContent = tower.level >= 4 ? "已滿級" : `升級 (${tower.upgradeCost})`;
    hud.towerInfoUpgradeBtn.classList.toggle("is-ready", canUpgrade);
  }
  const syncBranchButton = (btn, slot, branch) => {
    if (!btn) return;
    if (!branch) {
      btn.disabled = true;
      btn.textContent = `分支 ${slot}`;
      return;
    }
    const isSelected = tower.branchPath === branch.key;
    const currentTier = isSelected ? (tower.branchTier ?? 0) : 0;
    const nextTier = currentTier + 1;
    const unlockLevel = nextTier <= 1 ? 2 : 4;
    const cost = nextTier <= 1 ? branch.cost1 : branch.cost2;
    const lockedByOther = tower.branchPath && !isSelected;
    const atMax = isSelected && currentTier >= 2;
    const levelLocked = tower.level < unlockLevel;
    const goldLocked = !atMax && !lockedByOther && game.gold < cost;
    btn.disabled = lockedByOther || atMax || levelLocked || goldLocked;
    btn.classList.toggle("is-selected", isSelected);
    btn.classList.toggle("is-ready", !btn.disabled && !atMax);
    if (atMax) {
      btn.textContent = `${branch.label} 已滿`;
    } else if (lockedByOther) {
      btn.textContent = `${branch.label}（已鎖）`;
    } else {
      const tierText = nextTier <= 1 ? "I" : "II";
      btn.textContent = `${branch.label} ${tierText} (${cost})`;
    }
    if (levelLocked) btn.title = `需 Lv.${unlockLevel}`;
    else if (goldLocked) btn.title = `金幣不足：${cost}`;
    else if (!btn.title) btn.title = towerBranchPreviewText(tower, slot) ?? "";
  };
  syncBranchButton(hud.towerInfoBranchABtn, "A", branchA);
  syncBranchButton(hud.towerInfoBranchBBtn, "B", branchB);
  if (hud.towerInfoBranchABtn && !hud.towerInfoBranchABtn.title) hud.towerInfoBranchABtn.title = towerBranchPreviewText(tower, "A") ?? "";
  if (hud.towerInfoBranchBBtn && !hud.towerInfoBranchBBtn.title) hud.towerInfoBranchBBtn.title = towerBranchPreviewText(tower, "B") ?? "";
}

function showBossAlert(text, { badge = "警報", duration = 2.2 } = {}) {
  game.bossAlert = { text, badge, timer: duration, total: duration };
}

function updateBossAlert(dt) {
  if (game.bossAlert.timer > 0) game.bossAlert.timer = Math.max(0, game.bossAlert.timer - dt);
  if (!overlays.bossAlert) return;
  const active = game.bossAlert.timer > 0;
  overlays.bossAlert.classList.toggle("is-hidden", !active);
  const progress = game.bossAlert.total > 0 ? Math.max(0, Math.min(1, game.bossAlert.timer / game.bossAlert.total)) : 0;
  overlays.bossAlert.style.setProperty("--alert-progress", String(progress));
  if (!active) return;
  if (overlays.bossAlertText) overlays.bossAlertText.textContent = game.bossAlert.text;
  if (overlays.bossAlertBadge) overlays.bossAlertBadge.textContent = game.bossAlert.badge;
  overlays.bossAlert.dataset.badge = game.bossAlert.badge || "警報";
  if (overlays.bossAlertTimer) overlays.bossAlertTimer.textContent = `${game.bossAlert.timer.toFixed(1)}s`;
}

function stageEntriesForMap(mapId) {
  return Object.values(stageCatalog).filter((stage) => stage.mapId === mapId);
}

function orderedStageIds() {
  return Object.keys(stageCatalog).filter((id) => !id.startsWith("endless"));
}

function isStageUnlocked(stageId) {
  return stageId.startsWith("endless") || unlockedStages.has(stageId);
}

function fillMapOptions(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (const [mapId, mapInfo] of Object.entries(mapCatalog)) {
    const option = document.createElement("option");
    option.value = mapId;
    option.textContent = mapInfo.name ?? mapId;
    selectEl.append(option);
  }
}

function fillStageOptions(selectEl, mapId) {
  if (!selectEl) return;
  const stages = stageEntriesForMap(mapId);
  selectEl.innerHTML = "";
  for (const stage of stages) {
    const option = document.createElement("option");
    option.value = stage.id;
    option.textContent = stage.label;
    selectEl.append(option);
  }
  if (!stages.some((s) => s.id === pendingStageId)) {
    pendingStageId = stages[0]?.id ?? defaultStageId;
  }
  selectEl.value = pendingStageId;
}

function syncSelectorValues() {
  if (hud.mapSelect) hud.mapSelect.value = pendingMapId;
  if (hud.stageSelect) hud.stageSelect.value = pendingStageId;
  if (menu.mapSelect) menu.mapSelect.value = pendingMapId;
  if (menu.stageSelect) menu.stageSelect.value = pendingStageId;
}

function updatePendingLabels() {
  if (hud.mapLabel) hud.mapLabel.textContent = mapCatalog[pendingMapId]?.name ?? pendingMapId;
  if (hud.stageLabel) hud.stageLabel.textContent = stageCatalog[pendingStageId]?.label ?? pendingStageId;
  updateHudClearConditionLabel();
  if (menu.currentMapLabel) menu.currentMapLabel.textContent = mapCatalog[pendingMapId]?.name ?? pendingMapId;
  if (menu.currentStageLabel) menu.currentStageLabel.textContent = stageCatalog[pendingStageId]?.label ?? pendingStageId;
  if (menu.stageSelectionText) {
    const mapName = mapCatalog[pendingMapId]?.name ?? pendingMapId;
    const stageName = stageCatalog[pendingStageId]?.label ?? pendingStageId;
    menu.stageSelectionText.textContent = `${mapName} / ${stageName}`;
  }
}

function syncMenuSettingsUi() {
  if (menu.bgmVolume) menu.bgmVolume.value = String(Math.round(game.bgmVolume * 100));
  if (menu.sfxVolume) menu.sfxVolume.value = String(Math.round(game.sfxVolume * 100));
  if (menu.bgmVolumeValue) menu.bgmVolumeValue.textContent = String(Math.round(game.bgmVolume * 100));
  if (menu.sfxVolumeValue) menu.sfxVolumeValue.textContent = String(Math.round(game.sfxVolume * 100));
  if (menu.muteBtn) menu.muteBtn.textContent = game.audioMuted ? "靜音中" : "音訊開啟";
  if (menu.muteState) menu.muteState.textContent = game.audioMuted ? "關" : "開";
  if (menu.showDamageText) menu.showDamageText.checked = game.displaySettings.showDamageText;
  if (menu.fxDensity) menu.fxDensity.value = game.displaySettings.fxDensity;
  if (menu.showTowerPanel) menu.showTowerPanel.checked = game.displaySettings.showTowerPanel;
  if (menu.saveSlot) menu.saveSlot.value = game.currentSaveSlot;
  if (menu.saveSlotMirror) menu.saveSlotMirror.value = game.currentSaveSlot;
}

function persistSettings() {
  writePersistentSave(STORAGE_KEYS.settings, {
    audioMuted: game.audioMuted,
    bgmVolume: game.bgmVolume,
    sfxVolume: game.sfxVolume,
    showDamageText: game.displaySettings.showDamageText,
    fxDensity: game.displaySettings.fxDensity,
    showTowerPanel: game.displaySettings.showTowerPanel
  });
}

function persistProgress() {
  writePersistentSave(STORAGE_KEYS.progress, {
    stars: stageStarProgress,
    unlockedStages: [...unlockedStages],
    bestScores,
    seenFish: [...seenFish],
    seenTowers: [...seenTowers]
  });
}

function markFishSeen(fishId) {
  if (!fishId || seenFish.has(fishId)) return;
  seenFish.add(fishId);
  persistProgress();
  if (activeMenuPanel === "codex") renderCodexLists();
  updateCodexCompletionLabels();
}

function markTowerSeen(towerId) {
  if (!towerId || seenTowers.has(towerId)) return;
  seenTowers.add(towerId);
  persistProgress();
  if (activeMenuPanel === "codex") renderCodexLists();
  updateCodexCompletionLabels();
}

function awardStageStarsIfNeeded() {
  const stage = stageCatalog[game.stageId];
  if (!game.stageCleared || game.stageRewarded || !stage || stage.id.startsWith("endless")) return;
  let stars = 1;
  if (game.lives >= 18) stars = 3;
  else if (game.lives >= 10) stars = 2;
  const clearReward = 40 + game.wave * 5 + game.kills + stars * 20;
  game.gold += clearReward;
  stageStarProgress[stage.id] = Math.max(stageStarProgress[stage.id] ?? 0, stars);
  game.stageRewarded = true;
  game.lastAwardedStars = stars;
  game.lastResultReward = clearReward;
  const ids = orderedStageIds();
  const idx = ids.indexOf(stage.id);
  if (idx >= 0 && ids[idx + 1]) unlockedStages.add(ids[idx + 1]);
  persistProgress();
  renderMenuStageCards();
  updatePendingLabels();
  setMessage(`關卡完成！獲得 ${starsText(stage.id)}（本次 ${stars} 星）。`);
}

function openCodexDetail(detail) {
  activeCodexDetail = detail;
  if (!menu.codexDetailOverlay || !menu.detailBody) return;
  menu.detailType.textContent = detail.kind === "fish" ? "魚種圖鑑" : "塔台圖鑑";
  menu.detailTitle.textContent = detail.title;
  menu.detailMeta.textContent = detail.meta;
  if (menu.detailPreview) {
    const color = detail.color ?? "#7fb0ff";
    const previewStats = detail.previewStats ?? [];
    if (detail.photoUrl) {
      menu.detailPreview.classList.add("has-photo");
      menu.detailPreview.innerHTML = `
        <img class="photo" src="${detail.photoUrl}" alt="${detail.title} 真實照片" loading="lazy" referrerpolicy="no-referrer" />
        <div class="photo-vignette"></div>
        <div class="hud">${previewStats.map((s) => `<div>${s}</div>`).join("")}</div>
      `;
    } else {
      menu.detailPreview.classList.remove("has-photo");
      menu.detailPreview.innerHTML = `
        <div class="sprite" style="--preview-color:${color}"></div>
        <div class="trail"></div>
        <div class="hud">${previewStats.map((s) => `<div>${s}</div>`).join("")}</div>
      `;
    }
  }
  menu.detailBody.innerHTML = "";
  for (const line of detail.rows) {
    const row = document.createElement("div");
    row.className = "row";
    row.textContent = line;
    menu.detailBody.append(row);
  }
  menu.codexDetailOverlay.classList.remove("is-hidden");
  menu.codexDetailOverlay.setAttribute("aria-hidden", "false");
}

function closeCodexDetail() {
  activeCodexDetail = null;
  menu.codexDetailOverlay?.classList.add("is-hidden");
  menu.codexDetailOverlay?.setAttribute("aria-hidden", "true");
}

function renderCodexLists() {
  const q = codexFilters.search.trim().toLowerCase();
  const typeFilter = codexFilters.type;
  const sizeFilter = codexFilters.size;
  const skillFilter = codexFilters.skill;
  if (menu.fishCodexList?.parentElement) {
    menu.fishCodexList.parentElement.style.display = typeFilter === "tower" ? "none" : "";
  }
  if (menu.towerCodexList?.parentElement) {
    menu.towerCodexList.parentElement.style.display = typeFilter === "fish" ? "none" : "";
  }
  if (menu.fishCodexList) {
    menu.fishCodexList.innerHTML = "";
    let fishCount = 0;
    for (const [fishId, fish] of Object.entries(fishCatalog)) {
      if (typeFilter === "tower") continue;
      if (sizeFilter !== "all" && fish.sizeClass !== sizeFilter) continue;
      if (skillFilter !== "all" && !(fish.skills ?? []).some((s) => s.type === skillFilter)) continue;
      if (q) {
        const hay = `${fishId} ${fish.label} ${fish.species}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const isSeen = seenFish.has(fishId);
      const item = document.createElement("button");
      item.type = "button";
      item.className = `menu-codex-item${isSeen ? "" : " is-unseen"}`;
      const skills = (fish.skills ?? []).map(skillLabel).join(" / ") || "無";
      const photoUrl = fishPhotoUrl(fishId, fish);
      item.innerHTML = `
        <div class="codex-row">
          <span class="codex-photo-wrap">
            ${isSeen
              ? `<img class="codex-photo" src="${photoUrl}" alt="${fish.label} 真實照片" loading="lazy" referrerpolicy="no-referrer" />`
              : `<span class="codex-photo placeholder"></span>`}
          </span>
          <span class="codex-copy">
            <div class="title"><span class="swatch" style="background:${isSeen ? (fish.color ?? "#88d") : "#6a7f8a"}"></span>${isSeen ? fish.label : "未遇見魚種"}</div>
            <div class="meta">${isSeen ? `${fish.species} · ${fish.sizeClass} · HP ${fish.hp} · 速度 ${fish.speed}` : `${fish.species} · ${fish.sizeClass}`}</div>
            <div class="skills">技能：${isSeen ? skills : "尚未觀測"}</div>
          </span>
        </div>
      `;
      item.addEventListener("click", () => {
        if (!isSeen) {
          openCodexDetail({
            kind: "fish",
            title: "未遇見魚種",
            meta: `${fish.species} · ${fish.sizeClass}`,
            color: "#6a7f8a",
            previewStats: ["尚未遭遇", "請於關卡中觀測"],
            rows: ["此魚種尚未在目前存檔槽遭遇。進入關卡並遇到後將解鎖完整資料。"]
          });
          return;
        }
        const appearStages = getStagesContainingFish(fishId);
        openCodexDetail({
          kind: "fish",
          title: fish.label,
          meta: `${fish.species} · ${fish.sizeClass} · HP ${fish.hp} · 速度 ${fish.speed} · 獎勵 ${fish.reward}`,
          color: fish.color,
          photoUrl,
          previewStats: [`體型 ${fish.sizeClass}`, `攻擊 ${fish.damage}`, `獎勵 ${fish.reward}`],
          rows: [
            `技能：${(fish.skills ?? []).map(describeSkill).join("；") || "無"}`,
            `突破傷害：${fish.damage} / 半徑：${fish.radius}`,
            `出現關卡：${appearStages.join("、") || "目前未配置"}`
          ]
        });
      });
      menu.fishCodexList.append(item);
      fishCount += 1;
    }
    if (fishCount === 0) {
      const empty = document.createElement("div");
      empty.className = "menu-codex-empty";
      empty.textContent = "沒有符合條件的魚種。";
      menu.fishCodexList.append(empty);
    }
  }
  if (menu.towerCodexList) {
    menu.towerCodexList.innerHTML = "";
    let towerCount = 0;
    for (const [towerId, tower] of Object.entries(towerCatalog)) {
      if (typeFilter === "fish") continue;
      if (q) {
        const hay = `${towerId} ${tower.label}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const isSeen = seenTowers.has(towerId);
      const traits = [];
      if (tower.slow) traits.push(`緩速 ${Math.round((1 - tower.slow.multiplier) * 100)}%`);
      if (tower.splashRadius) traits.push(`範圍 ${tower.splashRadius}`);
      if (tower.supportAura) traits.push(`光環 ${tower.supportAura.radius}`);
      if (tower.critChance) traits.push(`暴擊 ${Math.round(tower.critChance * 100)}%`);
      if (!traits.length) traits.push("單體輸出");
      const towerPhoto = towerPhotoUrl(towerId);
      const item = document.createElement("button");
      item.type = "button";
      item.className = `menu-codex-item${isSeen ? "" : " is-unseen"}`;
      item.innerHTML = `
        <div class="codex-row">
          <span class="codex-photo-wrap">
            ${isSeen && towerPhoto
              ? `<img class="codex-photo" src="${towerPhoto}" alt="${tower.label} 素材圖" loading="lazy" />`
              : `<span class="codex-photo placeholder"></span>`}
          </span>
          <span class="codex-copy">
            <div class="title"><span class="swatch" style="background:${isSeen ? (tower.color ?? "#5ad") : "#6a7f8a"}"></span>${isSeen ? tower.label : "未部署塔台"}</div>
            <div class="meta">${isSeen ? `成本 ${tower.cost} · 傷害 ${tower.damage} · 射程 ${tower.range} · 攻速 ${tower.fireRate.toFixed(2)}s` : `代號 ${towerId}`}</div>
            <div class="skills">定位：${isSeen ? traits.join(" / ") : "尚未部署"}</div>
          </span>
        </div>
      `;
      item.addEventListener("click", () => {
        if (!isSeen) {
          openCodexDetail({
            kind: "tower",
            title: "未部署塔台",
            meta: `代號 ${towerId}`,
            color: "#6a7f8a",
            previewStats: ["尚未部署", "請於戰鬥中使用"],
            rows: ["此塔台尚未在目前存檔槽部署。切換塔台並放置後將解鎖完整資料。"]
          });
          return;
        }
        const rows = [
          `基礎屬性：傷害 ${tower.damage}、射程 ${tower.range}、攻速 ${tower.fireRate.toFixed(2)} 秒、彈速 ${tower.projectileSpeed}`,
          `升級成本起始：${tower.upgradeCost}`,
          `定位說明：${traits.join("；")}`
        ];
        if (tower.slow) rows.push(`緩速效果：命中後 ${(Math.round((1 - tower.slow.multiplier) * 100))}% 緩速，持續 ${tower.slow.duration} 秒`);
        if (tower.splashRadius) rows.push(`範圍效果：半徑 ${tower.splashRadius}，濺射倍率 ${Math.round((tower.splashRatio ?? 0) * 100)}%`);
        if (tower.critChance) rows.push(`狙擊特性：暴擊率 ${Math.round((tower.critChance ?? 0) * 100)}%，暴擊倍率 x${(tower.critMultiplier ?? 1).toFixed(2)}`);
        if (tower.supportAura) rows.push(`支援光環：半徑 ${tower.supportAura.radius}，傷害 x${tower.supportAura.damageMult.toFixed(2)}，攻速 x${tower.supportAura.fireRateMult.toFixed(2)}，射程 +${tower.supportAura.rangeBonus}`);
        openCodexDetail({
          kind: "tower",
          title: tower.label,
          meta: `代號 ${towerId} · 成本 ${tower.cost}`,
          color: tower.color,
          photoUrl: towerPhoto,
          previewStats: [`傷害 ${tower.damage}`, `射程 ${tower.range}`, `攻速 ${tower.fireRate.toFixed(2)}s`],
          rows
        });
      });
      menu.towerCodexList.append(item);
      towerCount += 1;
    }
    if (towerCount === 0) {
      const empty = document.createElement("div");
      empty.className = "menu-codex-empty";
      empty.textContent = "沒有符合條件的塔台。";
      menu.towerCodexList.append(empty);
    }
  }
  updateCodexCompletionLabels();
}

function hideResultOverlay() {
  resultUi.overlay?.classList.add("is-hidden");
}

function getNextPlayableStageId(currentStageId) {
  const ids = orderedStageIds();
  const idx = ids.indexOf(currentStageId);
  if (idx < 0) return null;
  return ids[idx + 1] ?? null;
}

function openResultOverlay({ victory }) {
  if (!resultUi.overlay || !resultUi.stats) return;
  game.paused = true;
  const nextStageId = getNextPlayableStageId(game.stageId);
  const nextUnlocked = nextStageId ? isStageUnlocked(nextStageId) : false;
  const nextStageLabel = nextStageId ? (stageCatalog[nextStageId]?.label ?? nextStageId) : "無";
  const failedByCondition = !victory && game.lives > 0 && game.stageFailed;
  resultUi.kicker.textContent = victory ? "關卡結算" : failedByCondition ? "條件未達成" : "戰鬥失敗";
  resultUi.title.textContent = victory ? "任務完成" : failedByCondition ? "任務失敗" : "防線失守";
  const activeStageInfo = stageCatalog[game.stageId];
  const clearCondText = stageClearConditionText(activeStageInfo);
  resultUi.summary.textContent = victory
    ? `${game.stageLabel} 通關，獲得 ${game.lastAwardedStars || 0} 星，結算獎勵 +${game.lastResultReward || 0} 金幣。`
    : `${game.stageLabel} 挑戰失敗，${game.stageFailReason ? `${game.stageFailReason}。` : ""}請調整塔台配置再試一次。`;
  if (resultUi.starsRule) {
    resultUi.starsRule.textContent = victory
      ? `過關條件：${clearCondText}｜星級：3★ 生命≥18｜2★ 生命≥10｜1★ 通關`
      : `過關條件：${clearCondText}`;
  }
  if (resultUi.unlockHint) {
    const unlockedCount = Object.keys(stageCatalog)
      .filter((id) => !id.startsWith("endless"))
      .filter((id) => unlockedStages.has(id)).length;
    resultUi.unlockHint.textContent = victory
      ? `${nextStageId
        ? `解鎖提示：${nextUnlocked ? `可挑戰下一關 ${nextStageLabel}` : "已解鎖條件未達成"}`
        : "解鎖提示：已完成目前章節關卡"}（已解鎖 ${unlockedCount} 關）`
      : `解鎖提示：維持生命可拿更高星級（目前規則：3★≥18，2★≥10）`;
  }
  const conditionRows = getStageConditionStatuses(activeStageInfo).map((s) => {
    const status = s.ok ? "達成" : "未達成";
    const value = s.target == null ? `${s.current}` : `${s.current} / ${s.target}`;
    return `<div class="item condition ${s.ok ? "ok" : "fail"}"><span>${s.label}（${s.rule}）</span><strong>${value} · ${status}</strong></div>`;
  }).join("");
  resultUi.stats.innerHTML = `
    <div class="item"><span>地圖 / 關卡</span><strong>${game.mapShortLabel} / ${game.stageShortLabel}</strong></div>
    <div class="item"><span>波次</span><strong>${game.wave}</strong></div>
    <div class="item"><span>最高到達波次</span><strong>${game.stats.maxWaveReached}</strong></div>
    <div class="item"><span>擊殺</span><strong>${game.kills}</strong></div>
    <div class="item"><span>剩餘生命</span><strong>${game.lives}</strong></div>
    <div class="item"><span>本局金幣</span><strong>${game.gold}</strong></div>
    <div class="item"><span>結算獎勵</span><strong>${victory ? `+${game.lastResultReward || 0}` : "0"}</strong></div>
    <div class="item"><span>建塔 / 升級</span><strong>${game.stats.towersPlaced} / ${game.stats.towerUpgrades}</strong></div>
    <div class="item"><span>分支升級 / Boss 擊殺</span><strong>${game.stats.branchUpgrades} / ${game.stats.bossKills}</strong></div>
    ${conditionRows}
  `;
  resultUi.nextBtn.disabled = !victory || !nextStageId || !nextUnlocked;
  resultUi.nextBtn.textContent = !victory ? "下一關（需通關）" : nextStageId ? "下一關" : "已是最後一關";
  resultUi.overlay.classList.remove("is-hidden");
}

function reloadToStage(stageId) {
  const stage = stageCatalog[stageId];
  if (!stage) return;
  const next = new URL(window.location.href);
  next.searchParams.set("map", stage.mapId);
  next.searchParams.set("stage", stageId);
  next.searchParams.set("slot", game.currentSaveSlot);
  window.location.href = next.toString();
}

function setMenuPanel(panelKey) {
  activeMenuPanel = panelKey;
  if (panelKey !== "codex") closeCodexDetail();
  const panelMap = {
    home: menu.panelHome,
    stages: menu.panelStages,
    codex: menu.panelCodex,
    settings: menu.panelSettings
  };
  const navMap = {
    home: menu.navHomeBtn,
    stages: menu.navStagesBtn,
    codex: menu.navCodexBtn,
    settings: menu.navSettingsBtn
  };
  for (const [key, panelEl] of Object.entries(panelMap)) {
    panelEl?.classList.toggle("is-active", key === panelKey);
  }
  for (const [key, btnEl] of Object.entries(navMap)) {
    btnEl?.classList.toggle("is-active", key === panelKey);
  }
}

function renderMenuMapTabs() {
  if (!menu.mapTabs) return;
  menu.mapTabs.innerHTML = "";
  for (const [mapId, mapInfo] of Object.entries(mapCatalog)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `menu-map-tab${mapId === pendingMapId ? " is-active" : ""}`;
    btn.dataset.mapId = mapId;
    btn.textContent = mapInfo.name ?? mapId;
    menu.mapTabs.append(btn);
  }
}

function renderMenuStageCards() {
  if (!menu.stageCards) return;
  const stages = stageEntriesForMap(pendingMapId);
  menu.stageCards.innerHTML = "";
  for (const stage of stages) {
    const isLocked = !unlockedStages.has(stage.id) && !stage.id.startsWith("endless");
    const card = document.createElement("button");
    card.type = "button";
    card.className = `menu-stage-card${stage.id === pendingStageId ? " is-selected" : ""}${isLocked ? " is-locked" : ""}`;
    card.dataset.stageId = stage.id;
    if (isLocked) card.dataset.locked = "1";
    const mapName = mapCatalog[stage.mapId]?.name ?? stage.mapId;
    const { modeLabel, waveLabel, bossLabel } = stageMetaSummary(stage);
    const clearCond = stageClearConditionText(stage);
    const stars = stage.id.startsWith("endless")
      ? `最佳波次 ${bestScores.endlessWave ?? 0} / 擊殺 ${bestScores.endlessKills ?? 0}`
      : starsText(stage.id);
    const preview = mapPreviewSrc(stage.mapId);
    const thumbTheme = mapPreviewThemeClass(stage.mapId);
    card.innerHTML = `
      <span class="thumb ${thumbTheme}"><img src="${preview}" alt="${mapName} 縮圖" /></span>
      <span class="body">
        <span class="title">${stage.label}</span>
        <span class="meta">${mapName}</span>
        <span class="tag-row">
          <span class="tag">${modeLabel}</span>
          <span class="tag">${waveLabel}</span>
          <span class="tag">${bossLabel}</span>
          ${isLocked ? '<span class="tag">未解鎖</span>' : ""}
        </span>
        <span class="meta">${clearCond}</span>
        <span class="condition-line">條件：${clearCond}</span>
        <span class="stars">${stars}</span>
      </span>
    `;
    menu.stageCards.append(card);
  }
}

function repopulateStageSelectors(mapId) {
  fillStageOptions(hud.stageSelect, mapId);
  fillStageOptions(menu.stageSelect, mapId);
  syncSelectorValues();
  renderMenuMapTabs();
  renderMenuStageCards();
  updatePendingLabels();
}

function populateMapStageSelectors() {
  fillMapOptions(hud.mapSelect);
  fillMapOptions(menu.mapSelect);
  repopulateStageSelectors(pendingMapId);
}

function openMainMenu() {
  game.inMainMenu = true;
  game.paused = true;
  hideResultOverlay();
  menu.overlay?.classList.remove("is-hidden");
  setMenuPanel(activeMenuPanel);
  syncSelectorValues();
  updatePendingLabels();
  syncMenuSettingsUi();
  updateHud();
  updateHudClearConditionLabel();
}

function closeMainMenu() {
  game.inMainMenu = false;
  game.paused = false;
  closeCodexDetail();
  menu.overlay?.classList.add("is-hidden");
  hideResultOverlay();
  updateHud();
  updateHudClearConditionLabel();
}

function openSavePanelFromHud() {
  openMainMenu();
  setMenuPanel("settings");
  menu.saveSlotMirror?.focus();
  setMessage("已開啟主選單存檔區，可切換或重設存檔槽。");
}

function applyPendingStageSelection() {
  ensureAudio();
  if (!isStageUnlocked(pendingStageId)) {
    setMenuPanel("stages");
    setMessage("此關卡尚未解鎖，請先通關前一關。");
    return;
  }
  if (pendingMapId !== game.mapId || pendingStageId !== game.stageId) {
    const next = new URL(window.location.href);
    next.searchParams.set("map", pendingMapId);
    next.searchParams.set("stage", pendingStageId);
    next.searchParams.set("slot", game.currentSaveSlot);
    window.location.href = next.toString();
    return;
  }
  closeMainMenu();
  setMessage(`已進入 ${game.stageLabel}，點擊「開始/下一波」開始防守。`);
}

populateMapStageSelectors();
setMenuPanel("home");
renderCodexLists();
syncMenuSettingsUi();
refreshTowerInfoPanel();

bindInputHandlers({
  canvas,
  hud,
  menu,
  onCanvasClick: (event) => {
    syncMenuStateFromDom();
    if (game.inMainMenu) return;
    ensureAudio();
    const { cellX, cellY } = gridFromMouse(event);
    const existing = game.towers.find((t) => t.cellX === cellX && t.cellY === cellY);
    if (existing) {
      game.selectedTowerId = existing.id;
      refreshTowerInfoPanel();
      if (event.shiftKey || event.altKey) {
        if (upgradeTowerBranch(existing, event.altKey ? "B" : "A")) {
          game.stats.branchUpgrades += 1;
          refreshTowerInfoPanel();
        }
        return;
      }
      if (upgradeTower(existing)) {
        game.stats.towerUpgrades += 1;
        refreshTowerInfoPanel();
      }
      return;
    }
    if (placeTower(cellX, cellY)) {
      game.stats.towersPlaced += 1;
      const placed = game.towers.find((t) => t.cellX === cellX && t.cellY === cellY);
      if (placed) game.selectedTowerId = placed.id;
      refreshTowerInfoPanel();
    }
  },
  onStartWave: startNextWave,
  onTogglePause: () => {
    syncMenuStateFromDom();
    if (game.inMainMenu) {
      closeMainMenu();
      setMessage(`已進入 ${game.stageLabel}，點擊「開始/下一波」開始防守。`);
      return;
    }
    ensureAudio();
    game.paused = !game.paused;
    updateHud();
  },
  onToggleSpeed: () => {
    syncMenuStateFromDom();
    ensureAudio();
    game.timeScale = game.timeScale === 1 ? 2 : 1;
    updateHud();
  },
  onSelectTowerType: (towerType) => {
    markTowerSeen(towerType);
    setSelectedTowerType(towerType);
    refreshTowerInfoPanel();
  },
  onTowerPanelUpgrade: () => {
    const tower = selectedTower();
    if (!tower) return;
    ensureAudio();
    if (upgradeTower(tower)) {
      game.stats.towerUpgrades += 1;
      refreshTowerInfoPanel();
    }
  },
  onTowerPanelBranchA: () => {
    const tower = selectedTower();
    if (!tower) return;
    ensureAudio();
    if (upgradeTowerBranch(tower, "A")) {
      game.stats.branchUpgrades += 1;
      refreshTowerInfoPanel();
    }
  },
  onTowerPanelBranchB: () => {
    const tower = selectedTower();
    if (!tower) return;
    ensureAudio();
    if (upgradeTowerBranch(tower, "B")) {
      game.stats.branchUpgrades += 1;
      refreshTowerInfoPanel();
    }
  },
  onToggleMute: () => {
    ensureAudio();
    game.audioMuted = !game.audioMuted;
    applyAudioVolumes();
    persistSettings();
    updateHud();
    syncMenuSettingsUi();
  },
  onBgmVolumeInput: () => {
    game.bgmVolume = Number(hud.bgmVolume.value) / 100;
    applyAudioVolumes();
    persistSettings();
    updateHud();
    syncMenuSettingsUi();
  },
  onSfxVolumeInput: () => {
    game.sfxVolume = Number(hud.sfxVolume.value) / 100;
    applyAudioVolumes();
    persistSettings();
    updateHud();
    syncMenuSettingsUi();
  },
  onMapChange: () => {
    pendingMapId = hud.mapSelect.value;
    repopulateStageSelectors(pendingMapId);
  },
  onStageChange: () => {
    pendingStageId = hud.stageSelect.value;
    const selectedStage = stageCatalog[pendingStageId];
    if (selectedStage) {
      pendingMapId = selectedStage.mapId;
    }
    repopulateStageSelectors(pendingMapId);
  },
  onApplyStage: () => {
    const next = new URL(window.location.href);
    next.searchParams.set("map", pendingMapId);
    next.searchParams.set("stage", pendingStageId);
    next.searchParams.set("slot", game.currentSaveSlot);
    window.location.href = next.toString();
  },
  onOpenMenu: () => {
    syncMenuStateFromDom();
    openMainMenu();
    setMenuPanel("home");
    setMessage("已開啟主選單。");
  },
  onOpenSave: () => {
    syncMenuStateFromDom();
    openSavePanelFromHud();
  },
  onMenuMapChange: () => {
    pendingMapId = menu.mapSelect.value;
    repopulateStageSelectors(pendingMapId);
  },
  onMenuStageChange: () => {
    pendingStageId = menu.stageSelect.value;
    const selectedStage = stageCatalog[pendingStageId];
    if (selectedStage) pendingMapId = selectedStage.mapId;
    repopulateStageSelectors(pendingMapId);
  },
  onMenuStart: () => {
    applyPendingStageSelection();
  },
  onMenuClose: () => {
    closeMainMenu();
    setMessage(`已進入 ${game.stageLabel}，點擊「開始/下一波」開始防守。`);
  }
});

menu.navHomeBtn?.addEventListener("click", () => setMenuPanel("home"));
menu.navStagesBtn?.addEventListener("click", () => setMenuPanel("stages"));
menu.navCodexBtn?.addEventListener("click", () => setMenuPanel("codex"));
menu.navSettingsBtn?.addEventListener("click", () => setMenuPanel("settings"));
menu.goStagesBtn?.addEventListener("click", () => setMenuPanel("stages"));
menu.backHomeBtn?.addEventListener("click", () => setMenuPanel("home"));
menu.codexToStagesBtn?.addEventListener("click", () => setMenuPanel("stages"));
menu.settingsToStagesBtn?.addEventListener("click", () => setMenuPanel("stages"));
menu.codexCloseBtn?.addEventListener("click", () => {
  closeMainMenu();
  setMessage(`已進入 ${game.stageLabel}，點擊「開始/下一波」開始防守。`);
});
menu.settingsCloseBtn?.addEventListener("click", () => {
  closeMainMenu();
  setMessage(`已進入 ${game.stageLabel}，點擊「開始/下一波」開始防守。`);
});
menu.stageStartBtn?.addEventListener("click", () => applyPendingStageSelection());
menu.mapTabs?.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-map-id]");
  if (!btn) return;
  pendingMapId = btn.dataset.mapId;
  repopulateStageSelectors(pendingMapId);
  setMenuPanel("stages");
});
menu.stageCards?.addEventListener("click", (event) => {
  const card = event.target.closest("button[data-stage-id]");
  if (!card) return;
  if (card.dataset.locked === "1") {
    setMessage("此關卡尚未解鎖，請先通關前一關。");
    return;
  }
  pendingStageId = card.dataset.stageId;
  const selectedStage = stageCatalog[pendingStageId];
  if (selectedStage) pendingMapId = selectedStage.mapId;
  repopulateStageSelectors(pendingMapId);
  setMenuPanel("stages");
});
menu.detailCloseBtn?.addEventListener("click", closeCodexDetail);
menu.codexDetailOverlay?.addEventListener("click", (event) => {
  if (event.target === menu.codexDetailOverlay) closeCodexDetail();
});
menu.muteBtn?.addEventListener("click", () => {
  ensureAudio();
  game.audioMuted = !game.audioMuted;
  applyAudioVolumes();
  persistSettings();
  updateHud();
  syncMenuSettingsUi();
});
menu.bgmVolume?.addEventListener("input", () => {
  game.bgmVolume = Number(menu.bgmVolume.value) / 100;
  applyAudioVolumes();
  persistSettings();
  updateHud();
  syncMenuSettingsUi();
});
menu.sfxVolume?.addEventListener("input", () => {
  game.sfxVolume = Number(menu.sfxVolume.value) / 100;
  applyAudioVolumes();
  persistSettings();
  updateHud();
  syncMenuSettingsUi();
});
menu.showDamageText?.addEventListener("change", () => {
  game.displaySettings.showDamageText = Boolean(menu.showDamageText.checked);
  persistSettings();
  syncMenuSettingsUi();
});
menu.fxDensity?.addEventListener("change", () => {
  game.displaySettings.fxDensity = menu.fxDensity.value;
  persistSettings();
  syncMenuSettingsUi();
});
menu.showTowerPanel?.addEventListener("change", () => {
  game.displaySettings.showTowerPanel = Boolean(menu.showTowerPanel.checked);
  persistSettings();
  syncMenuSettingsUi();
  refreshTowerInfoPanel();
});
menu.resetSettingsBtn?.addEventListener("click", () => {
  game.audioMuted = false;
  game.bgmVolume = 0.45;
  game.sfxVolume = 0.7;
  game.displaySettings.showDamageText = true;
  game.displaySettings.fxDensity = "中";
  game.displaySettings.showTowerPanel = true;
  if (hud.bgmVolume) hud.bgmVolume.value = "45";
  if (hud.sfxVolume) hud.sfxVolume.value = "70";
  applyAudioVolumes();
  persistSettings();
  syncMenuSettingsUi();
  updateHud();
  refreshTowerInfoPanel();
  setMessage("已重設音訊與顯示設定。");
});
menu.codexSearch?.addEventListener("input", () => {
  codexFilters.search = menu.codexSearch.value ?? "";
  renderCodexLists();
});
menu.codexTypeFilter?.addEventListener("change", () => {
  codexFilters.type = menu.codexTypeFilter.value;
  renderCodexLists();
});
menu.codexSizeFilter?.addEventListener("change", () => {
  codexFilters.size = menu.codexSizeFilter.value;
  renderCodexLists();
});
menu.codexSkillFilter?.addEventListener("change", () => {
  codexFilters.skill = menu.codexSkillFilter.value;
  renderCodexLists();
});
resultUi.retryBtn?.addEventListener("click", () => reloadToStage(game.stageId));
resultUi.menuBtn?.addEventListener("click", () => {
  hideResultOverlay();
  openMainMenu();
  setMenuPanel("stages");
});
resultUi.nextBtn?.addEventListener("click", () => {
  const nextStageId = getNextPlayableStageId(game.stageId);
  if (nextStageId && isStageUnlocked(nextStageId)) reloadToStage(nextStageId);
});
function selectedSlotValue() {
  return ["1", "2", "3"].includes(menu.saveSlot?.value) ? menu.saveSlot.value : game.currentSaveSlot;
}

function syncSlotSelectors(slot) {
  if (menu.saveSlot) menu.saveSlot.value = slot;
  if (menu.saveSlotMirror) menu.saveSlotMirror.value = slot;
}

menu.saveSlot?.addEventListener("change", () => syncSlotSelectors(menu.saveSlot.value));
menu.saveSlotMirror?.addEventListener("change", () => syncSlotSelectors(menu.saveSlotMirror.value));
menu.applySlotBtn?.addEventListener("click", () => {
  const slot = selectedSlotValue();
  const next = new URL(window.location.href);
  next.searchParams.set("slot", slot);
  next.searchParams.set("map", pendingMapId);
  next.searchParams.set("stage", pendingStageId);
  window.location.href = next.toString();
});
menu.resetSlotBtn?.addEventListener("click", async () => {
  const slot = selectedSlotValue();
  const progressKey = `fish-td-v2-progress-slot${slot}`;
  writePersistentSave(progressKey, {
    stars: {},
    unlockedStages: ["endless_default", "stage_shallow_intro"],
    bestScores: {},
    seenFish: [],
    seenTowers: []
  });
  setMessage(`已清除存檔槽 ${slot} 的進度。`);
  if (slot === game.currentSaveSlot) {
    const next = new URL(window.location.href);
    next.searchParams.set("slot", slot);
    window.location.href = next.toString();
  }
});

const { drawBackground, drawTowers, drawFish, drawBullets, drawParticles, drawOverlay } = createRenderer({
  ctx,
  canvas,
  game,
  GRID,
  pathPoints,
  pathCellSet,
  towerCatalog
});

let lastTs = performance.now();
function loop(ts) {
  try {
    const rawDt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    updateBgmScheduler();
    syncMenuStateFromDom();

    if (!game.inMainMenu && !game.paused && game.lives > 0) {
      const dt = rawDt * game.timeScale;
      game.stats.maxWaveReached = Math.max(game.stats.maxWaveReached, game.wave);
      updateSpawning(dt);
      updateTowers(dt);
      updateBullets(dt);
      updateFishes(dt);
      updateParticles(dt);
      awardStageStarsIfNeeded();
      if (game.stageCleared && !game.resultShown) {
        game.resultShown = true;
        openResultOverlay({ victory: true });
      }
      if (game.stageFailed && !game.resultShown) {
        game.resultShown = true;
        openResultOverlay({ victory: false });
      }
      updateHud();
      updateHudClearConditionLabel();
    }

    updateBossAlert(rawDt);

    if (game.stageId.startsWith("endless")) {
      const waveBest = bestScores.endlessWave ?? 0;
      const killsBest = bestScores.endlessKills ?? 0;
      if (game.wave > waveBest || game.kills > killsBest) {
        bestScores.endlessWave = Math.max(waveBest, game.wave);
        bestScores.endlessKills = Math.max(killsBest, game.kills);
        persistProgress();
      }
    }

    if (game.lives <= 0 && !game.gameOverSfxPlayed) {
      playSfx("gameOver");
      game.gameOverSfxPlayed = true;
    }
    if (game.lives <= 0 && !game.resultShown) {
      game.resultShown = true;
      openResultOverlay({ victory: false });
    }

    drawBackground();
    drawTowers();
    for (const fish of game.fishes) drawFish(fish);
    drawBullets();
    drawParticles();
    drawOverlay();

    if (!fatalErrorShown) requestAnimationFrame(loop);
  } catch (error) {
    showFatalError(error, "runtime");
  }
}

try {
  updateHud();
  updateAudioHud();
  updateHudClearConditionLabel();
  openMainMenu();
  setMessage("請先在主畫面選擇地圖與關卡，再開始遊戲。");
  requestAnimationFrame(loop);
} catch (error) {
  showFatalError(error, "startup");
}

(async () => {
  try {
    const [nativeSettingsRaw, nativeProgressRaw] = await Promise.all([
      readPersistentSave(STORAGE_KEYS.settings),
      readPersistentSave(STORAGE_KEYS.progress)
    ]);
    const nativeSettings = sanitizeSettings(nativeSettingsRaw);
    const nativeProgress = sanitizeProgress(nativeProgressRaw);

    game.audioMuted = nativeSettings.audioMuted;
    game.bgmVolume = nativeSettings.bgmVolume;
    game.sfxVolume = nativeSettings.sfxVolume;
    game.displaySettings.showDamageText = nativeSettings.showDamageText;
    game.displaySettings.fxDensity = nativeSettings.fxDensity;
    game.displaySettings.showTowerPanel = nativeSettings.showTowerPanel;
    if (hud.bgmVolume) hud.bgmVolume.value = String(Math.round(game.bgmVolume * 100));
    if (hud.sfxVolume) hud.sfxVolume.value = String(Math.round(game.sfxVolume * 100));
    applyAudioVolumes();
    syncMenuSettingsUi();
    refreshTowerInfoPanel();
    updateHud();

    for (const [k, v] of Object.entries(nativeProgress.stars)) stageStarProgress[k] = v;
    for (const stageId of nativeProgress.unlockedStages) unlockedStages.add(stageId);
    Object.assign(bestScores, nativeProgress.bestScores);
    for (const fishId of nativeProgress.seenFish) seenFish.add(fishId);
    for (const towerId of nativeProgress.seenTowers) seenTowers.add(towerId);
    renderMenuStageCards();
    renderCodexLists();
    updatePendingLabels();
  } catch (error) {
    console.warn("[save] hydrate failed, using in-memory defaults:", error);
    setMessage("存檔讀取失敗，已使用預設設定。");
  }
})();
