export function createSpawnSystem({
  game,
  spawnFish,
  setMessage,
  playSfx,
  updateHud,
  wavePlan,
  showBossAlert,
  onStageWavePlanComplete
}) {
const autoWaveDelaySeconds = wavePlan.autoWaveDelaySeconds ?? 1.4;
if (typeof game.autoWaveTimer !== "number") game.autoWaveTimer = autoWaveDelaySeconds;
if (typeof game.autoWaveBonusPreview !== "number") game.autoWaveBonusPreview = 0;
if (typeof game.autoWaveDelayTotal !== "number") game.autoWaveDelayTotal = autoWaveDelaySeconds;
if (typeof game.earlyStartStreak !== "number") game.earlyStartStreak = 0;
if (typeof game.earlyStartBonusTotal !== "number") game.earlyStartBonusTotal = 0;
if (typeof game.earlyStartCount !== "number") game.earlyStartCount = 0;
if (!game.earlyStartBonusByWave || typeof game.earlyStartBonusByWave !== "object") game.earlyStartBonusByWave = {};
if (typeof game.earlyStartBonusCapMult !== "number") game.earlyStartBonusCapMult = 1.75;
if (typeof game.earlyStartConditionBonusMult !== "number") game.earlyStartConditionBonusMult = 1;
if (!Array.isArray(game.earlyStartConditionBonusBreakdown)) game.earlyStartConditionBonusBreakdown = [];

function calcConditionBonusDetails() {
  const conds = wavePlan.clearConditions ?? [];
  let mult = 1;
  const breakdown = [];
  for (const cond of conds) {
    if (cond.type === "maxTowersPlaced") {
      mult += 0.12;
      breakdown.push({ type: cond.type, label: "限塔", bonus: 0.12 });
    } else if (cond.type === "maxLeaks") {
      mult += 0.08;
      breakdown.push({ type: cond.type, label: "限漏怪", bonus: 0.08 });
    } else if (cond.type === "minLives") {
      mult += 0.05;
      breakdown.push({ type: cond.type, label: "最低生命", bonus: 0.05 });
    } else if (cond.type === "minKills") {
      mult += 0.04;
      breakdown.push({ type: cond.type, label: "最低擊殺", bonus: 0.04 });
    }
  }
  const capped = Math.min(1.35, mult);
  return { mult: capped, uncappedMult: mult, breakdown };
}

function applyConditionBonusState() {
  const details = calcConditionBonusDetails();
  game.earlyStartConditionBonusMult = details.mult;
  game.earlyStartConditionBonusBreakdown = details.breakdown;
  return details;
}

function calcEarlyStartBonus() {
  if (game.displaySettings?.autoStartWaves === false) return 0;
  if (game.waveActive) return 0;
  const remaining = Math.max(0, Number(game.autoWaveTimer ?? 0));
  if (remaining <= 0.02) return 0;
  const waveFactor = Math.min(8, Math.floor(Math.max(1, game.wave + 1) / 2));
  const base = Math.max(1, Math.ceil(remaining * 4) + waveFactor);
  const capBonusMult = Math.max(1, Number(game.earlyStartBonusCapMult ?? 1.75));
  const streakMult = 1 + Math.min(capBonusMult - 1, (game.earlyStartStreak ?? 0) * 0.1);
  const condMult = Math.max(1, Number(game.earlyStartConditionBonusMult ?? 1));
  return Math.max(1, Math.round(base * streakMult * condMult));
}

function evalCountExpr(expr, wave) {
  if (!expr) return 0;
  let total = expr.base ?? 0;
  for (const term of expr.terms ?? []) {
    if (term.type === "mul" && term.value === "wave") {
      total += wave * (term.factor ?? 1);
    } else if (term.type === "floorDiv" && term.value === "wave") {
      total += Math.floor(wave / (term.divisor || 1));
    } else if (term.type === "floorDiv" && term.value === "waveMinus") {
      const v = Math.max(0, wave - (term.minus ?? 0));
      total += Math.floor(v / (term.divisor || 1));
    }
  }
  return Math.max(0, Math.floor(total));
}

function buildWave(wave) {
  const queue = [];
  const pushMany = (kind, count) => {
    for (let i = 0; i < count; i += 1) {
      queue.push(kind);
    }
  };

  for (const rule of wavePlan.rules ?? []) {
    if (wave < (rule.unlockWave ?? 1)) continue;
    pushMany(rule.kind, evalCountExpr(rule.count, wave));
  }

  const bossInterval = wavePlan.bossWave?.interval ?? 5;
  const isBossWave = wave > 0 && wave % bossInterval === 0;
  if (isBossWave) {
    for (const rule of wavePlan.bossWave?.extraRules ?? []) {
      pushMany(rule.kind, evalCountExpr(rule.count, wave));
    }
  }

  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (isBossWave) {
    const bossKind = wavePlan.bossWave?.bossKind ?? "bossWhaleKing";
    if (wavePlan.bossWave?.spawnLast !== false) queue.push(bossKind);
    else queue.unshift(bossKind);
  }
  return queue;
}

  function startNextWave(options = {}) {
    const manual = options.manual === true;
    const maxWaves = wavePlan.maxWaves ?? null;
    if (maxWaves && game.wave >= maxWaves && !game.waveActive) {
      const finished = game.stageCleared || game.stageFailed;
      setMessage(finished ? "本關卡已結算完成，請切換關卡或地圖。" : "本關波次已結束，等待結算。");
      updateHud();
      return;
    }
  if (game.waveActive) {
    setMessage("本波魚群尚未結束。");
    return;
  }
  applyConditionBonusState();
  const hadCountdown = (game.displaySettings?.autoStartWaves !== false) && (game.autoWaveTimer ?? 0) > 0.02;
  const earlyStartBonus = manual ? calcEarlyStartBonus() : 0;
  if (earlyStartBonus > 0) {
    game.gold += earlyStartBonus;
    game.earlyStartBonusTotal = (game.earlyStartBonusTotal ?? 0) + earlyStartBonus;
    game.earlyStartCount = (game.earlyStartCount ?? 0) + 1;
    const upcomingWave = game.wave + 1;
    game.earlyStartBonusByWave[upcomingWave] = (game.earlyStartBonusByWave[upcomingWave] ?? 0) + earlyStartBonus;
    game.earlyStartStreak = (game.earlyStartStreak ?? 0) + 1;
    const condText = (game.earlyStartConditionBonusMult ?? 1) > 1 ? `｜條件加成 x${game.earlyStartConditionBonusMult.toFixed(2)}` : "";
    const bossIntervalPreview = wavePlan.bossWave?.interval ?? 5;
    const isEarlyBossWave = upcomingWave > 0 && upcomingWave % bossIntervalPreview === 0;
    setMessage(`提前開波獎勵 +${earlyStartBonus} 金幣${condText}`);
    playSfx(isEarlyBossWave ? "waveEarlyBoss" : "waveEarly");
    showBossAlert?.(
      `${isEarlyBossWave ? "Boss波" : "一般波"} 提前開波 +${earlyStartBonus} 金幣`,
      { badge: isEarlyBossWave ? "提前-BOSS" : "提前", duration: isEarlyBossWave ? 1.7 : 1.4 }
    );
  } else if (manual && !hadCountdown) {
    game.earlyStartStreak = 0;
  }
  game.wave += 1;
  game.spawnQueue = buildWave(game.wave);
  game.spawnTimer = 0;
  game.waveActive = true;
  game.autoWaveTimer = autoWaveDelaySeconds;
  game.autoWaveDelayTotal = autoWaveDelaySeconds;
  game.autoWaveBonusPreview = 0;
  const bossInterval = wavePlan.bossWave?.interval ?? 5;
  if (game.wave > 0 && game.wave % bossInterval === 0) {
    const bonusText = earlyStartBonus > 0 ? `｜提前 +${earlyStartBonus} 金幣` : "";
    setMessage(`第 ${game.wave} 波 Boss 波次開始！共 ${game.spawnQueue.length} 隻魚。${bonusText}`);
    playSfx("bossAlarm");
    showBossAlert?.(`Boss 波次開始：第 ${game.wave} 波`, { badge: "BOSS", duration: 2.8 });
  } else {
    const bonusText = earlyStartBonus > 0 ? `｜提前 +${earlyStartBonus} 金幣` : "";
    setMessage(`第 ${game.wave} 波開始，共 ${game.spawnQueue.length} 隻魚。${bonusText}`);
    playSfx("waveStart");
  }
  updateHud();
}

function updateSpawning(dt) {
  if (!game.waveActive) {
    const maxWaves = wavePlan.maxWaves ?? null;
    if (game.stageCleared || game.stageFailed || game.lives <= 0) return;
    if (maxWaves && game.wave >= maxWaves) return;
    if (game.displaySettings?.autoStartWaves === false) {
      game.autoWaveBonusPreview = 0;
      game.earlyStartStreak = 0;
      applyConditionBonusState();
      updateHud();
      return;
    }
    applyConditionBonusState();
    game.autoWaveTimer = Math.max(0, (game.autoWaveTimer ?? autoWaveDelaySeconds) - dt);
    game.autoWaveBonusPreview = calcEarlyStartBonus();
    updateHud();
    if (game.autoWaveTimer <= 0) {
      startNextWave({ auto: true });
    }
    return;
  }
  if (game.spawnQueue.length > 0) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      const nextKind = game.spawnQueue.shift();
      spawnFish(nextKind);
      const timing = wavePlan.spawnTiming ?? {};
      game.spawnTimer = nextKind === (wavePlan.bossWave?.bossKind ?? "bossWhaleKing")
        ? (timing.bossFixed ?? 1.2)
        : (timing.normalBase ?? 0.45) + Math.random() * (timing.normalJitter ?? 0.25);
    }
  }

  if (game.spawnQueue.length === 0 && game.fishes.length === 0) {
    game.waveActive = false;
    const maxWaves = wavePlan.maxWaves ?? null;
    if (maxWaves && game.wave >= maxWaves) {
      const verdict = onStageWavePlanComplete?.() ?? { ok: true, message: null };
      if (verdict.ok) {
        game.stageCleared = true;
        game.stageFailed = false;
        setMessage(verdict.message || `關卡完成！已通關 ${wavePlan.label ?? "本關卡"}。`);
      } else {
        game.stageCleared = false;
        game.stageFailed = true;
        game.stageFailReason = verdict.reason || "未達過關條件";
        setMessage(verdict.message || `關卡失敗：${game.stageFailReason}`);
      }
    } else {
      setMessage(`第 ${game.wave} 波完成！準備下一波。`);
      game.autoWaveTimer = autoWaveDelaySeconds;
      game.autoWaveDelayTotal = autoWaveDelaySeconds;
      game.autoWaveBonusPreview = calcEarlyStartBonus();
      updateHud();
    }
  }
}

  return { buildWave, startNextWave, updateSpawning };
}
