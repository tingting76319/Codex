export function createTowerSystem({ game, GRID, pathCellSet, towerCatalog, setMessage, playSfx, updateHud, ensureAudio, burst }) {
function makeTower(cellX, cellY, typeKey = "basic") {
  const spec = towerCatalog[typeKey] ?? towerCatalog.basic;
  return {
    id: game.nextTowerId++,
    x: GRID.x + cellX * GRID.size + GRID.size / 2,
    y: GRID.y + cellY * GRID.size + GRID.size / 2,
    cellX,
    cellY,
    typeKey,
    typeLabel: spec.label,
    color: spec.color,
    level: 1,
    range: spec.range,
    fireRate: spec.fireRate,
    cooldown: 0,
    damage: spec.damage,
    projectileSpeed: spec.projectileSpeed,
    upgradeCost: spec.upgradeCost,
    slow: spec.slow ? { ...spec.slow } : null,
    splashRadius: spec.splashRadius ?? 0,
    splashRatio: spec.splashRatio ?? 0,
    critChance: spec.critChance ?? 0,
    critMultiplier: spec.critMultiplier ?? 1.8,
    supportAura: spec.supportAura ? { ...spec.supportAura } : null,
    supportPulseTimer: 0,
    branchPath: null,
    branchLabel: "",
    branchTier: 0
  };
}

function getTowerBranchOptions(tower) {
  if (tower.typeKey === "basic") {
    return {
      A: { key: "sniper", label: "狙擊路線", cost1: 90, cost2: 145 },
      B: { key: "rapid", label: "連射路線", cost1: 90, cost2: 145 }
    };
  }
  if (tower.typeKey === "slow") {
    return {
      A: { key: "glacier", label: "寒潮路線", cost1: 95, cost2: 150 },
      B: { key: "breaker", label: "破甲路線", cost1: 95, cost2: 150 }
    };
  }
  if (tower.typeKey === "sniper") {
    return {
      A: { key: "execution", label: "處決路線", cost1: 115, cost2: 175 },
      B: { key: "pierce", label: "穿透路線", cost1: 115, cost2: 175 }
    };
  }
  if (tower.typeKey === "support") {
    return {
      A: { key: "overclock", label: "超頻路線", cost1: 105, cost2: 165 },
      B: { key: "fortify", label: "強化路線", cost1: 105, cost2: 165 }
    };
  }
  return {
    A: { key: "megablast", label: "巨爆路線", cost1: 105, cost2: 165 },
    B: { key: "ember", label: "灼燒路線", cost1: 105, cost2: 165 }
  };
}

function placeTower(cellX, cellY) {
  if (cellX < 0 || cellX >= GRID.cols || cellY < 0 || cellY >= GRID.rows) return false;
  if (pathCellSet.has(`${cellX},${cellY}`)) {
    setMessage("無法在魚群路徑上部署塔台。");
    return false;
  }
  if (game.towers.some((t) => t.cellX === cellX && t.cellY === cellY)) {
    setMessage("此位置已有塔台。");
    return false;
  }
  const selectedSpec = towerCatalog[game.selectedTowerType] ?? towerCatalog.basic;
  const cost = selectedSpec.cost;
  if (game.gold < cost) {
    setMessage(`金幣不足，${selectedSpec.label} 需要 ${cost}。`);
    return false;
  }
  game.gold -= cost;
  game.towers.push(makeTower(cellX, cellY, game.selectedTowerType));
  setMessage(`已部署${selectedSpec.label} (${cellX + 1}, ${cellY + 1})`);
  playSfx("towerPlace");
  updateHud();
  return true;
}

function upgradeTower(tower) {
  if (tower.level >= 4) {
    setMessage("塔台已達最高等級。");
    return false;
  }
  if (game.gold < tower.upgradeCost) {
    setMessage(`金幣不足，升級需要 ${tower.upgradeCost}。`);
    return false;
  }
  game.gold -= tower.upgradeCost;
  tower.level += 1;
  if (tower.typeKey === "support") {
    tower.range += 12;
    if (tower.supportAura) {
      tower.supportAura.radius += 12;
      tower.supportAura.damageMult = Math.min(1.55, tower.supportAura.damageMult + 0.03);
      tower.supportAura.fireRateMult = Math.max(0.62, tower.supportAura.fireRateMult - 0.03);
      tower.supportAura.rangeBonus += 3;
      tower.supportAura.critBonus = Math.min(0.3, (tower.supportAura.critBonus ?? 0) + 0.02);
    }
  } else {
    tower.damage += tower.typeKey === "slow" ? 4 : tower.typeKey === "splash" ? 7 : tower.typeKey === "sniper" ? 14 : 8;
    tower.range += tower.typeKey === "slow" ? 14 : tower.typeKey === "sniper" ? 20 : 18;
    if (tower.typeKey === "sniper") {
      tower.fireRate = Math.max(0.75, tower.fireRate * 0.93);
      tower.projectileSpeed += 48;
      tower.critChance = Math.min(0.6, (tower.critChance ?? 0) + 0.03);
      tower.critMultiplier = Math.min(3.4, (tower.critMultiplier ?? 1.8) + 0.08);
    } else {
      tower.fireRate = Math.max(tower.typeKey === "splash" ? 0.45 : 0.2, tower.fireRate * 0.9);
      tower.projectileSpeed += 35;
    }
  }
  if (tower.slow) {
    tower.slow.duration += 0.12;
    tower.slow.multiplier = Math.max(0.34, tower.slow.multiplier - 0.05);
  }
  if (tower.splashRadius) {
    tower.splashRadius += 8;
    tower.splashRatio = Math.min(0.9, tower.splashRatio + 0.04);
  }
  tower.upgradeCost = Math.round(tower.upgradeCost * 1.6);
  setMessage(`${tower.typeLabel} 升級至 Lv.${tower.level}`);
  burst(tower.x, tower.y, tower.color ?? "#55d8ff");
  playSfx("towerUpgrade");
  updateHud();
  return true;
}

function applyTowerBranchEffects(tower, branchKey, tier) {
  if (tower.typeKey === "basic") {
    if (branchKey === "sniper") {
      tower.range += tier === 1 ? 40 : 28;
      tower.damage += tier === 1 ? 18 : 16;
      tower.fireRate = Math.min(1.2, tower.fireRate * (tier === 1 ? 1.14 : 1.1));
      tower.critChance = (tower.critChance ?? 0) + (tier === 1 ? 0.2 : 0.18);
      tower.critMultiplier = Math.max(tower.critMultiplier ?? 1.8, tier === 1 ? 1.85 : 2.05);
    } else if (branchKey === "rapid") {
      tower.fireRate = Math.max(0.14, tower.fireRate * (tier === 1 ? 0.72 : 0.78));
      tower.projectileSpeed += tier === 1 ? 40 : 30;
      tower.damage += tier === 1 ? 4 : 6;
      tower.rapidDoubleShotChance = (tower.rapidDoubleShotChance ?? 0) + (tier === 1 ? 0.28 : 0.22);
    }
  } else if (tower.typeKey === "slow") {
    if (branchKey === "glacier") {
      if (tower.slow) {
        tower.slow.duration += tier === 1 ? 0.45 : 0.35;
        tower.slow.multiplier = Math.max(0.22, tower.slow.multiplier - (tier === 1 ? 0.09 : 0.07));
      }
      tower.slowPulseRadius = (tower.slowPulseRadius ?? 0) + (tier === 1 ? 55 : 45);
      tower.range += tier === 1 ? 15 : 12;
    } else if (branchKey === "breaker") {
      tower.armorBreak = {
        amount: Math.min(0.35, (tower.armorBreak?.amount ?? 0) + (tier === 1 ? 0.18 : 0.12)),
        duration: Math.min(4.5, (tower.armorBreak?.duration ?? 0) + (tier === 1 ? 1.8 : 1.2))
      };
      tower.damage += tier === 1 ? 5 : 7;
    }
  } else if (tower.typeKey === "splash") {
    if (branchKey === "megablast") {
      tower.splashRadius += tier === 1 ? 36 : 28;
      tower.splashRatio = Math.min(1.05, tower.splashRatio + (tier === 1 ? 0.12 : 0.1));
      tower.damage += tier === 1 ? 8 : 10;
    } else if (branchKey === "ember") {
      tower.burn = {
        dps: (tower.burn?.dps ?? 0) + (tier === 1 ? 12 : 16),
        duration: Math.min(5, (tower.burn?.duration ?? 0) + (tier === 1 ? 2.2 : 1.8))
      };
      tower.damage += tier === 1 ? 4 : 6;
      tower.splashRadius += tier === 1 ? 8 : 10;
    }
  } else if (tower.typeKey === "sniper") {
    if (branchKey === "execution") {
      tower.critChance = Math.min(0.8, (tower.critChance ?? 0) + (tier === 1 ? 0.18 : 0.12));
      tower.critMultiplier = Math.min(4.2, (tower.critMultiplier ?? 1.9) + (tier === 1 ? 0.45 : 0.35));
      tower.executeThreshold = Math.min(0.28, (tower.executeThreshold ?? 0) + (tier === 1 ? 0.12 : 0.08));
      tower.damage += tier === 1 ? 12 : 14;
    } else if (branchKey === "pierce") {
      tower.bossBonus = Math.min(1.9, (tower.bossBonus ?? 1) + (tier === 1 ? 0.28 : 0.22));
      tower.armorPierceBonus = Math.min(0.45, (tower.armorPierceBonus ?? 0) + (tier === 1 ? 0.18 : 0.12));
      tower.range += tier === 1 ? 22 : 16;
      tower.damage += tier === 1 ? 8 : 10;
    }
  } else if (tower.typeKey === "support") {
    if (!tower.supportAura) return;
    if (branchKey === "overclock") {
      tower.supportAura.fireRateMult = Math.max(0.5, tower.supportAura.fireRateMult - (tier === 1 ? 0.07 : 0.05));
      tower.supportAura.damageMult = Math.min(1.7, tower.supportAura.damageMult + (tier === 1 ? 0.04 : 0.03));
      tower.supportAura.critBonus = Math.min(0.45, (tower.supportAura.critBonus ?? 0) + (tier === 1 ? 0.06 : 0.04));
    } else if (branchKey === "fortify") {
      tower.supportAura.radius += tier === 1 ? 22 : 18;
      tower.supportAura.rangeBonus += tier === 1 ? 10 : 8;
      tower.supportAura.armorBreakBonus = Math.min(0.18, (tower.supportAura.armorBreakBonus ?? 0) + (tier === 1 ? 0.08 : 0.05));
    }
  }
}

function upgradeTowerBranch(tower, slot) {
  if (tower.level < 2) {
    setMessage("分支升級需塔台達到 Lv.2。");
    return false;
  }
  const options = getTowerBranchOptions(tower);
  const selected = options[slot];
    if (!selected) return false;

  if (!tower.branchPath) {
    const cost = selected.cost1;
    if (game.gold < cost) {
      setMessage(`金幣不足，${selected.label} 需要 ${cost}。`);
      return false;
    }
    game.gold -= cost;
    tower.branchPath = selected.key;
    tower.branchLabel = selected.label;
    tower.branchTier = 1;
    applyTowerBranchEffects(tower, selected.key, 1);
    setMessage(`${tower.typeLabel} 啟用分支：${selected.label}`);
    burst(tower.x, tower.y, "#ffd166");
    playSfx("branchUpgrade");
    updateHud();
    return true;
  }

  if (tower.branchPath !== selected.key) {
    setMessage(`此塔已選擇 ${tower.branchLabel}，不可切換分支。`);
    return false;
  }
  if ((tower.branchTier ?? 0) >= 2) {
    setMessage("分支技能已達最高階。");
    return false;
  }
  if (tower.level < 4) {
    setMessage("分支二階需塔台達到 Lv.4。");
    return false;
  }
  const cost = selected.cost2;
  if (game.gold < cost) {
    setMessage(`金幣不足，分支進階需要 ${cost}。`);
    return;
  }
  game.gold -= cost;
  tower.branchTier = 2;
  applyTowerBranchEffects(tower, selected.key, 2);
  setMessage(`${tower.typeLabel} 分支進階：${selected.label} II`);
  burst(tower.x, tower.y, "#ffe9ad");
  playSfx("branchUpgrade");
  updateHud();
  return true;
}

function setSelectedTowerType(typeKey) {
  if (!towerCatalog[typeKey]) return;
  ensureAudio();
  game.selectedTowerType = typeKey;
  const spec = towerCatalog[typeKey];
  setMessage(`已選擇 ${spec.label}（建造 ${spec.cost}）`);
  updateHud();
}

  return { makeTower, placeTower, upgradeTower, upgradeTowerBranch, setSelectedTowerType, getTowerBranchOptions };
}
