export function createFishFactory({ game, fishCatalog, pathPoints }) {
  function spawnFish(kindKey, overrides = {}) {
    const template = fishCatalog[kindKey];
    const first = pathPoints[Math.min(overrides.pathIndex ?? 0, pathPoints.length - 1)];
    const skills = Array.isArray(template.skills) ? template.skills : [];
    const accelSkill = skills.find((s) => s.type === "accelerate_on_hp");
    const splitSkillData = skills.find((s) => s.type === "split_on_death");
    const armorStaticSkill = skills.find((s) => s.type === "armor_static");
    const bossSummonSkill = skills.find((s) => s.type === "boss_summon_threshold");
    const bossShieldSkill = skills.find((s) => s.type === "boss_shield_threshold");

    const accelerationSkill = accelSkill
      ? {
          triggerHpRatio: accelSkill.triggerHpRatio,
          multiplier: accelSkill.multiplier
        }
      : undefined;

    const splitSkill = splitSkillData
      ? {
          count: splitSkillData.count,
          into: splitSkillData.into,
          hpScale: splitSkillData.hpScale
        }
      : undefined;

    const bossSummonThresholds = template.isBoss
      ? [...(bossSummonSkill?.thresholds ?? [0.85, 0.6, 0.35])]
      : [];
    const bossShieldThresholds = template.isBoss
      ? [...(bossShieldSkill?.thresholds ?? [0.72, 0.42])]
      : [];

    game.fishes.push({
      ...template,
      accelerationSkill,
      splitSkill,
      armorRatio: armorStaticSkill?.armorRatio ?? template.armorRatio,
      id: game.nextFishId++,
      maxHp: overrides.maxHp ?? template.hp,
      hp: overrides.hp ?? overrides.maxHp ?? template.hp,
      kindKey,
      x: overrides.x ?? first.x,
      y: overrides.y ?? first.y,
      pathIndex: overrides.pathIndex ?? 0,
      reachedEnd: false,
      splitSpawned: false,
      isAccelerated: false,
      baseSpeed: overrides.baseSpeed ?? template.speed,
      speed: overrides.speed ?? template.speed,
      spawnedFromSplit: Boolean(overrides.spawnedFromSplit),
      slowEffects: [],
      burnEffects: [],
      armorBreakEffects: [],
      bossSummonThresholds,
      bossShieldThresholds,
      bossShieldHp: 0,
      bossShieldRatio: bossShieldSkill?.shieldRatio ?? 0.16,
      bossSummonPacks: bossSummonSkill?.packs ?? null,
      bossSummonSpeedMultiplier: bossSummonSkill?.speedMultiplier ?? 1.08
    });
  }

  return { spawnFish };
}
