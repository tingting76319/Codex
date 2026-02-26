export function createCombatSystem({ game, fishCatalog, pathPoints, spawnFish, setMessage, playSfx, showBossAlert }) {
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function acquireTarget(tower, rangeOverride = null) {
  const effectiveRange = rangeOverride ?? tower.range;
  let best = null;
  let bestScore = -Infinity;
  for (const fish of game.fishes) {
    const d = distance(tower, fish);
    if (d > effectiveRange) continue;
    const score = fish.pathIndex * 1000 - d + fish.hp * 0.02;
    if (score > bestScore) {
      bestScore = score;
      best = fish;
    }
  }
  return best;
}

function updateTowers(dt) {
  const supportBuffs = new Map();
  const supportTowers = game.towers.filter((t) => t.typeKey === "support" && t.supportAura);
  for (const supportTower of supportTowers) {
    supportTower.supportPulseTimer = (supportTower.supportPulseTimer ?? 0) - dt;
    if (supportTower.supportPulseTimer <= 0) {
      supportTower.supportPulseTimer = 0.9;
      game.particles.push({
        x: supportTower.x,
        y: supportTower.y,
        vx: 0,
        vy: 0,
        life: 0.35,
        color: "rgba(141,255,185,0.85)",
        ringRadius: supportTower.supportAura.radius
      });
    }
    for (const tower of game.towers) {
      if (tower.id === supportTower.id || tower.typeKey === "support") continue;
      const d = distance(supportTower, tower);
      if (d > supportTower.supportAura.radius) continue;
      const current = supportBuffs.get(tower.id) ?? {
        damageMult: 1,
        fireRateMult: 1,
        rangeBonus: 0,
        critBonus: 0,
        armorBreakBonus: 0,
        sources: []
      };
      current.damageMult *= supportTower.supportAura.damageMult ?? 1;
      current.fireRateMult *= supportTower.supportAura.fireRateMult ?? 1;
      current.rangeBonus += supportTower.supportAura.rangeBonus ?? 0;
      current.critBonus += supportTower.supportAura.critBonus ?? 0;
      current.armorBreakBonus += supportTower.supportAura.armorBreakBonus ?? 0;
      current.sources.push({
        id: supportTower.id,
        label: supportTower.typeLabel ?? "支援塔",
        cellX: supportTower.cellX,
        cellY: supportTower.cellY
      });
      current.damageMult = Math.min(current.damageMult, 1.45);
      current.fireRateMult = Math.max(current.fireRateMult, 0.6);
      current.rangeBonus = Math.min(current.rangeBonus, 44);
      current.critBonus = Math.min(current.critBonus, 0.35);
      current.armorBreakBonus = Math.min(current.armorBreakBonus, 0.18);
      supportBuffs.set(tower.id, current);
    }
  }

  for (const tower of game.towers) {
    if (tower.typeKey === "support") continue;
    const buff = supportBuffs.get(tower.id);
    tower.activeSupportBuff = buff ? {
      damageMult: buff.damageMult,
      fireRateMult: buff.fireRateMult,
      rangeBonus: buff.rangeBonus,
      critBonus: buff.critBonus,
      armorBreakBonus: buff.armorBreakBonus
    } : null;
    tower.activeSupportSources = buff?.sources?.map((s) => ({ ...s })) ?? [];
    tower.activeSupportSourceLabels = buff?.sources?.map((s) => `${s.label}(${(s.cellX ?? 0) + 1},${(s.cellY ?? 0) + 1})`) ?? [];
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;
    const effectiveRange = tower.range + (buff?.rangeBonus ?? 0);
    const effectiveDamage = tower.damage * (buff?.damageMult ?? 1);
    const effectiveCritChance = Math.min(0.95, (tower.critChance ?? 0) + (buff?.critBonus ?? 0));
    const target = acquireTarget(tower, effectiveRange);
    if (!target) continue;
    tower.cooldown = Math.max(0.08, tower.fireRate * (buff?.fireRateMult ?? 1));
    const damageVsTarget = target.isBoss ? effectiveDamage * (tower.bossBonus ?? 1) : effectiveDamage;
    game.bullets.push({
      x: tower.x,
      y: tower.y,
      target,
      damage: damageVsTarget,
      speed: tower.projectileSpeed,
      towerLevel: tower.level,
      color: tower.color,
      towerType: tower.typeKey,
      slow: tower.slow ? { ...tower.slow } : null,
      splashRadius: tower.splashRadius,
      splashRatio: tower.splashRatio,
      critChance: effectiveCritChance,
      critMultiplier: tower.critMultiplier ?? 1,
      rapidDoubleShotChance: tower.rapidDoubleShotChance ?? 0,
      slowPulseRadius: tower.slowPulseRadius ?? 0,
      armorBreak: tower.armorBreak ? { ...tower.armorBreak } : null,
      burn: tower.burn ? { ...tower.burn } : null,
      executeThreshold: tower.executeThreshold ?? 0,
      armorPierceBonus: tower.armorPierceBonus ?? 0,
      buffedRange: effectiveRange
    });
    playSfx(
      tower.typeKey === "slow" ? "shotSlow"
        : tower.typeKey === "splash" ? "shotSplash"
          : tower.typeKey === "sniper" ? "shotSplash"
            : "shotBasic"
    );
    if (tower.rapidDoubleShotChance && Math.random() < tower.rapidDoubleShotChance) {
      game.bullets.push({
        x: tower.x + (Math.random() * 6 - 3),
        y: tower.y + (Math.random() * 6 - 3),
        target,
        damage: damageVsTarget * 0.65,
        speed: tower.projectileSpeed + 20,
        towerLevel: tower.level,
        color: tower.color,
        towerType: tower.typeKey,
        slow: tower.slow ? { ...tower.slow } : null,
        splashRadius: tower.splashRadius ? tower.splashRadius * 0.75 : 0,
        splashRatio: tower.splashRatio ? tower.splashRatio * 0.8 : 0,
        critChance: 0,
        critMultiplier: 1,
        rapidDoubleShotChance: 0,
        slowPulseRadius: tower.slowPulseRadius ?? 0,
        armorBreak: tower.armorBreak ? { ...tower.armorBreak } : null,
        burn: tower.burn ? { ...tower.burn } : null,
        executeThreshold: 0,
        armorPierceBonus: tower.armorPierceBonus ?? 0
      });
      playSfx("shotBasic");
    }
  }
  for (const tower of game.towers) {
    if (tower.typeKey === "support") {
      tower.activeSupportBuff = null;
      tower.activeSupportSources = [];
      tower.activeSupportSourceLabels = [];
    }
  }
}

function burst(x, y, color) {
  const density = game.displaySettings?.fxDensity ?? "medium";
  const count = density === "低" || density === "low" ? 4 : density === "高" || density === "high" ? 12 : 8;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const speed = 35 + Math.random() * 55;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.4,
      color
    });
  }
}

function floatText(x, y, text, color = "#ffffff", fontSize = 12) {
  game.particles.push({
    x,
    y: y - 8,
    vx: (Math.random() * 16 - 8),
    vy: -18 - Math.random() * 10,
    life: 0.55,
    color,
    text,
    fontSize
  });
}

function spawnSplitChildren(parent) {
  if (!parent.splitSkill || parent.splitSpawned) return;
  parent.splitSpawned = true;
  const { count, into, hpScale = 1 } = parent.splitSkill;
  const childTemplate = fishCatalog[into];
  if (!childTemplate) return;

  for (let i = 0; i < count; i += 1) {
    const jitter = (i - (count - 1) / 2) * 10;
    spawnFish(into, {
      x: parent.x + jitter,
      y: parent.y + (Math.random() * 10 - 5),
      pathIndex: parent.pathIndex,
      hp: childTemplate.hp * hpScale,
      maxHp: childTemplate.hp * hpScale,
      speed: childTemplate.speed * 1.05,
      baseSpeed: childTemplate.speed,
      spawnedFromSplit: true
    });
  }
  setMessage(`${parent.label} 觸發分裂技能！`);
}

  function handleFishDeath(target) {
    game.kills += 1;
    game.gold += target.reward;
    if (target.isBoss) {
      game.stats.bossKills = (game.stats.bossKills ?? 0) + 1;
      showBossAlert?.(`${target.label} 已被擊敗`, { badge: "CLEAR", duration: 2.4 });
    }
    burst(target.x, target.y, "#ffffff");
  spawnSplitChildren(target);
  playSfx("kill");
}

function getEffectiveArmorRatio(fish) {
  const base = fish.armorRatio ?? 1;
  if (!fish.armorBreakEffects?.length) return base;
  const strongestBreak = Math.max(...fish.armorBreakEffects.map((e) => e.amount));
  return Math.min(1, base + strongestBreak);
}

function applyArmorBreakToFish(fish, armorBreak) {
  if (!armorBreak || fish.hp <= 0) return;
  if (!fish.armorBreakEffects) fish.armorBreakEffects = [];
  fish.armorBreakEffects.push({ ...armorBreak });
}

function applyBurnToFish(fish, burn) {
  if (!burn || fish.hp <= 0) return;
  if (!fish.burnEffects) fish.burnEffects = [];
  fish.burnEffects.push({ ...burn });
}

  function spawnBossSummons(boss) {
  const spawns = boss.bossSummonPacks ?? [
    { kind: "swordfish", count: 2 },
    { kind: "oarfish", count: 2 },
    { kind: "puffer", count: 1 }
  ];
  const speedMultiplier = boss.bossSummonSpeedMultiplier ?? 1.08;
  for (const wavePack of spawns) {
    for (let i = 0; i < wavePack.count; i += 1) {
      spawnFish(wavePack.kind, {
        x: boss.x + Math.random() * 28 - 14,
        y: boss.y + Math.random() * 24 - 12,
        pathIndex: boss.pathIndex,
        speed: (fishCatalog[wavePack.kind].speed || 60) * speedMultiplier,
        spawnedFromSplit: true
      });
    }
  }
  burst(boss.x, boss.y, "#ffd166");
  game.particles.push({
    x: boss.x,
    y: boss.y,
    vx: 0,
    vy: 0,
    life: 0.45,
    color: "rgba(255,209,102,0.9)",
    ringRadius: (boss.radius ?? 30) + 20
  });
    setMessage("深海鯨王召喚魚群增援！");
    playSfx("bossSummon");
    showBossAlert?.("Boss 召喚魚群增援", { badge: "召喚", duration: 2.2 });
  }

function triggerBossSkillsOnHpThresholds(fish) {
  if (!fish.isBoss || fish.hp <= 0) return;
  const hpRatio = fish.hp / fish.maxHp;
  while (fish.bossSummonThresholds?.length && hpRatio <= fish.bossSummonThresholds[0]) {
    fish.bossSummonThresholds.shift();
    spawnBossSummons(fish);
  }
  while (fish.bossShieldThresholds?.length && hpRatio <= fish.bossShieldThresholds[0]) {
    fish.bossShieldThresholds.shift();
    fish.bossShieldHp += fish.maxHp * (fish.bossShieldRatio ?? 0.16);
    burst(fish.x, fish.y, "#7de9ff");
    game.particles.push({
      x: fish.x,
      y: fish.y,
      vx: 0,
      vy: 0,
      life: 0.6,
      color: "rgba(125,233,255,0.95)",
      ringRadius: (fish.radius ?? 30) + 28
    });
    setMessage("深海鯨王展開護盾階段！");
    playSfx("bossShield");
    showBossAlert?.("Boss 進入護盾階段", { badge: "護盾", duration: 2.4 });
  }
}

function applySlowToFish(fish, slow) {
  if (!slow || fish.hp <= 0) return;
  if (!fish.slowEffects) fish.slowEffects = [];
  fish.slowEffects.push({ ...slow });
}

function applyDamageToFish(target, bullet, damageFactor = 1) {
  if (!target || target.hp <= 0) return false;
  if (target.bossShieldHp > 0) {
    const shieldDamage = bullet.damage * damageFactor;
    target.bossShieldHp -= shieldDamage;
    floatText(target.x, target.y, `${Math.round(shieldDamage)}`, "#7de9ff", 11);
    burst(target.x, target.y, "#7de9ff");
    if (bullet.slow) applySlowToFish(target, bullet.slow);
    if (bullet.armorBreak) applyArmorBreakToFish(target, bullet.armorBreak);
    if (bullet.burn) applyBurnToFish(target, bullet.burn);
    playSfx("hit");
    return false;
  }
  const armorRatio = getEffectiveArmorRatio(target);
  const levelPierce = (bullet.towerLevel >= 3 ? 1.08 : 1) + (bullet.armorPierceBonus ?? 0);
  const crit = bullet.critChance && Math.random() < bullet.critChance ? (bullet.critMultiplier || 1.8) : 1;
  const actualDamage = bullet.damage * damageFactor * armorRatio * levelPierce * crit;
  floatText(target.x, target.y, `${Math.round(actualDamage)}${crit > 1 ? "!" : ""}`, crit > 1 ? "#ffd166" : "#e7fbff", crit > 1 ? 13 : 12);
  target.hp -= actualDamage;
  if (bullet.slow) applySlowToFish(target, bullet.slow);
  if (bullet.armorBreak) applyArmorBreakToFish(target, bullet.armorBreak);
  if (bullet.burn) applyBurnToFish(target, bullet.burn);
  burst(target.x, target.y, target.color);
  playSfx("hit");
  if (bullet.slowPulseRadius && bullet.slow) {
    for (const fish of game.fishes) {
      if (fish === target || fish.hp <= 0) continue;
      const d = Math.hypot(fish.x - target.x, fish.y - target.y);
      if (d > bullet.slowPulseRadius) continue;
      applySlowToFish(fish, {
        multiplier: Math.max(0.25, bullet.slow.multiplier * 0.88),
        duration: bullet.slow.duration * 0.8
      });
    }
  }
  triggerBossSkillsOnHpThresholds(target);
  if (bullet.executeThreshold && target.hp > 0 && target.hp / target.maxHp <= bullet.executeThreshold) {
    target.hp = 0;
  }
  if (target.hp <= 0) {
    handleFishDeath(target);
    return true;
  }
  return false;
}

function applySplashDamage(centerFish, bullet) {
  if (!bullet.splashRadius || bullet.splashRadius <= 0) return;
  burst(centerFish.x, centerFish.y, "rgba(255, 177, 124, 0.9)");
  for (const fish of game.fishes) {
    if (fish === centerFish || fish.hp <= 0) continue;
    const d = Math.hypot(fish.x - centerFish.x, fish.y - centerFish.y);
    if (d > bullet.splashRadius) continue;
    const falloff = 1 - d / bullet.splashRadius;
    const factor = Math.max(0.2, (bullet.splashRatio || 0.6) * (0.65 + falloff * 0.35));
    applyDamageToFish(fish, bullet, factor);
    if (bullet.slowPulseRadius && d <= bullet.slowPulseRadius && bullet.slow) {
      applySlowToFish(fish, {
        multiplier: Math.max(0.28, bullet.slow.multiplier * 0.9),
        duration: bullet.slow.duration * 0.8
      });
    }
  }
}

function updateBullets(dt) {
  const alive = [];
  for (const bullet of game.bullets) {
    if (!bullet.target || bullet.target.hp <= 0 || bullet.target.reachedEnd) continue;
    const dx = bullet.target.x - bullet.x;
    const dy = bullet.target.y - bullet.y;
    const dist = Math.hypot(dx, dy);
    const step = bullet.speed * dt;
    if (dist <= Math.max(6, step)) {
      const target = bullet.target;
      applyDamageToFish(target, bullet, 1);
      applySplashDamage(target, bullet);
      continue;
    }
    bullet.x += (dx / dist) * step;
    bullet.y += (dy / dist) * step;
    alive.push(bullet);
  }
  game.bullets = alive;
}

function updateParticles(dt) {
  game.particles = game.particles.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    return p.life > 0;
  });
}

function updateFishes(dt) {
  const survivors = [];
  for (const fish of game.fishes) {
    if (fish.hp <= 0) continue;
    if (fish.bossShieldHp > 0) {
      fish.bossShieldHp = Math.max(0, fish.bossShieldHp);
    }
    if (fish.slowEffects?.length) {
      fish.slowEffects = fish.slowEffects
        .map((s) => ({ ...s, duration: s.duration - dt }))
        .filter((s) => s.duration > 0);
    }
    if (fish.armorBreakEffects?.length) {
      fish.armorBreakEffects = fish.armorBreakEffects
        .map((e) => ({ ...e, duration: e.duration - dt }))
        .filter((e) => e.duration > 0);
    }
    if (fish.burnEffects?.length) {
      let burnDamage = 0;
      fish.burnEffects = fish.burnEffects
        .map((e) => {
          burnDamage += e.dps * dt;
          return { ...e, duration: e.duration - dt };
        })
        .filter((e) => e.duration > 0);
      if (burnDamage > 0 && fish.bossShieldHp <= 0) {
        fish.hp -= burnDamage;
        if (Math.random() < 0.15) burst(fish.x, fish.y, "#ffb17c");
        triggerBossSkillsOnHpThresholds(fish);
        if (fish.hp <= 0) {
          handleFishDeath(fish);
          continue;
        }
      }
    }
    const slowMultiplier = fish.slowEffects?.length
      ? Math.min(...fish.slowEffects.map((s) => s.multiplier))
      : 1;

    if (fish.accelerationSkill && !fish.isAccelerated) {
      const hpRatio = fish.hp / fish.maxHp;
      if (hpRatio <= fish.accelerationSkill.triggerHpRatio) {
        fish.isAccelerated = true;
        fish.speed = fish.baseSpeed * fish.accelerationSkill.multiplier;
      }
    }

    const nextIndex = fish.pathIndex + 1;
    if (nextIndex >= pathPoints.length) {
      fish.reachedEnd = true;
      game.lives -= fish.damage;
      setMessage(`${fish.label} 突破防線！生命 -${fish.damage}`);
      playSfx("enemyLeak");
      continue;
    }

    const target = pathPoints[nextIndex];
    const dx = target.x - fish.x;
    const dy = target.y - fish.y;
    const dist = Math.hypot(dx, dy);
    const step = fish.speed * slowMultiplier * dt;

    if (dist <= step) {
      fish.x = target.x;
      fish.y = target.y;
      fish.pathIndex = nextIndex;
    } else {
      fish.x += (dx / dist) * step;
      fish.y += (dy / dist) * step;
    }
    survivors.push(fish);
  }
  game.fishes = survivors;
}

  return { burst, updateTowers, updateBullets, updateParticles, updateFishes };
}
