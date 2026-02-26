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

  function startNextWave() {
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
  game.wave += 1;
  game.spawnQueue = buildWave(game.wave);
  game.spawnTimer = 0;
  game.waveActive = true;
  const bossInterval = wavePlan.bossWave?.interval ?? 5;
  if (game.wave > 0 && game.wave % bossInterval === 0) {
    setMessage(`第 ${game.wave} 波 Boss 波次開始！共 ${game.spawnQueue.length} 隻魚。`);
    playSfx("bossAlarm");
    showBossAlert?.(`Boss 波次開始：第 ${game.wave} 波`, { badge: "BOSS", duration: 2.8 });
  } else {
    setMessage(`第 ${game.wave} 波開始，共 ${game.spawnQueue.length} 隻魚。`);
    playSfx("waveStart");
  }
  updateHud();
}

function updateSpawning(dt) {
  if (!game.waveActive) return;
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
    }
  }
}

  return { buildWave, startNextWave, updateSpawning };
}
