export function createRenderer({ ctx, canvas, game, GRID, pathPoints, pathCellSet, towerCatalog }) {
function drawFishStatusBadges(fish) {
  const badges = [];
  if (fish.slowEffects?.length) badges.push({ text: "緩", fill: "#8effd8" });
  if (fish.burnEffects?.length) badges.push({ text: "燃", fill: "#ffb17c" });
  if (fish.armorBreakEffects?.length) badges.push({ text: "破", fill: "#ffd166" });
  if ((fish.armorRatio ?? 1) < 1) badges.push({ text: "甲", fill: "#ffdf91" });
  if (fish.bossShieldHp > 0) badges.push({ text: "盾", fill: "#7de9ff" });
  if (fish.isAccelerated) badges.push({ text: "速", fill: "#d9fbff" });
  if (!badges.length) return;

  const y = fish.y - fish.radius - (fish.isBoss ? 34 : 24);
  const width = 18;
  const gap = 4;
  const total = badges.length * width + (badges.length - 1) * gap;
  let x = fish.x - total / 2;
  for (const badge of badges.slice(0, 4)) {
    ctx.fillStyle = "rgba(5, 24, 31, 0.85)";
    ctx.strokeStyle = "rgba(231, 251, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, 14, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = badge.fill;
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badge.text, x + width / 2, y + 7);
    x += width + gap;
  }
  ctx.textBaseline = "alphabetic";
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < GRID.rows; y += 1) {
    for (let x = 0; x < GRID.cols; x += 1) {
      const px = GRID.x + x * GRID.size;
      const py = GRID.y + y * GRID.size;
      const key = `${x},${y}`;
      const isPath = pathCellSet.has(key);

      ctx.fillStyle = isPath ? "rgba(121, 227, 255, 0.12)" : "rgba(255, 255, 255, 0.025)";
      ctx.strokeStyle = isPath ? "rgba(121, 227, 255, 0.22)" : "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px + 3, py + 3, GRID.size - 6, GRID.size - 6, 11);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "rgba(82, 236, 255, 0.42)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < pathPoints.length; i += 1) {
    const p = pathPoints[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 209, 102, 0.95)";
  ctx.beginPath();
  ctx.arc(pathPoints[pathPoints.length - 1].x, pathPoints[pathPoints.length - 1].y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f2b33";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("基地", pathPoints[pathPoints.length - 1].x, pathPoints[pathPoints.length - 1].y + 4);
}

function drawTowers() {
  for (const tower of game.towers) {
    const isSelected = tower.id === game.selectedTowerId;
    if (isSelected) {
      ctx.strokeStyle = "rgba(125, 233, 255, 0.24)";
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "#102e3c";
    ctx.strokeStyle = isSelected ? "rgba(125, 233, 255, 0.95)" : "rgba(147, 233, 255, 0.55)";
    ctx.lineWidth = isSelected ? 2.8 : 2;
    ctx.beginPath();
    ctx.roundRect(tower.x - 20, tower.y - 20, 40, 40, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tower.color || "#55d8ff";
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 8, 0, Math.PI * 2);
    ctx.fill();

    if (tower.typeKey === "slow") {
      ctx.strokeStyle = "rgba(158, 255, 213, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (tower.typeKey === "splash") {
      ctx.fillStyle = "rgba(255, 177, 124, 0.95)";
      ctx.beginPath();
      ctx.moveTo(tower.x, tower.y - 14);
      ctx.lineTo(tower.x + 6, tower.y - 4);
      ctx.lineTo(tower.x - 6, tower.y - 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#e7fbff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    const shortType = tower.typeKey === "slow" ? "緩" : tower.typeKey === "splash" ? "範" : "標";
    ctx.fillText(`${shortType} Lv${tower.level}`, tower.x, tower.y + 31);
    if (tower.branchPath) {
      ctx.fillStyle = "rgba(255, 209, 102, 0.95)";
      ctx.font = "bold 10px sans-serif";
      const branchTag = `${tower.branchPath === "sniper" || tower.branchPath === "glacier" || tower.branchPath === "megablast" ? "A" : "B"}${tower.branchTier || 1}`;
      ctx.fillText(branchTag, tower.x + 22, tower.y - 18);
    }
    if (isSelected) {
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawFish(fish) {
  ctx.save();
  ctx.translate(fish.x, fish.y);

  const next = pathPoints[Math.min(fish.pathIndex + 1, pathPoints.length - 1)];
  const angle = Math.atan2(next.y - fish.y, next.x - fish.x);
  ctx.rotate(angle);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";

  const bodyGrad = ctx.createLinearGradient(-fish.radius * 1.6, -fish.radius, fish.radius * 1.2, fish.radius);
  bodyGrad.addColorStop(0, "rgba(255,255,255,0.18)");
  bodyGrad.addColorStop(0.25, fish.color);
  bodyGrad.addColorStop(1, "rgba(4,24,34,0.45)");
  ctx.fillStyle = bodyGrad;

  if (fish.species === "鯊魚") {
    ctx.beginPath();
    ctx.moveTo(fish.radius * 1.15, 0);
    ctx.bezierCurveTo(fish.radius * 0.6, -fish.radius * 0.72, -fish.radius * 0.65, -fish.radius * 0.62, -fish.radius * 1.25, -fish.radius * 0.12);
    ctx.lineTo(-fish.radius * 1.72, -fish.radius * 0.58);
    ctx.lineTo(-fish.radius * 1.55, -fish.radius * 0.02);
    ctx.lineTo(-fish.radius * 1.8, fish.radius * 0.55);
    ctx.lineTo(-fish.radius * 1.18, fish.radius * 0.15);
    ctx.bezierCurveTo(-fish.radius * 0.65, fish.radius * 0.62, fish.radius * 0.52, fish.radius * 0.62, fish.radius * 1.15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 0.15, -fish.radius * 0.25);
    ctx.lineTo(fish.radius * 0.1, -fish.radius * 1.0);
    ctx.lineTo(fish.radius * 0.45, -fish.radius * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-fish.radius * 0.3, fish.radius * 0.05);
    ctx.lineTo(-fish.radius * 0.85, fish.radius * 0.65);
    ctx.lineTo(-fish.radius * 0.15, fish.radius * 0.28);
    ctx.closePath();
    ctx.fill();
  } else if (fish.species === "鯨魚" || fish.isBoss) {
    ctx.beginPath();
    ctx.moveTo(fish.radius * 1.05, 0);
    ctx.bezierCurveTo(fish.radius * 0.7, -fish.radius * 0.85, -fish.radius * 0.55, -fish.radius * 0.9, -fish.radius * 1.15, -fish.radius * 0.38);
    ctx.bezierCurveTo(-fish.radius * 1.35, -fish.radius * 0.25, -fish.radius * 1.5, -fish.radius * 0.08, -fish.radius * 1.55, 0);
    ctx.bezierCurveTo(-fish.radius * 1.5, fish.radius * 0.08, -fish.radius * 1.35, fish.radius * 0.25, -fish.radius * 1.15, fish.radius * 0.38);
    ctx.bezierCurveTo(-fish.radius * 0.55, fish.radius * 0.9, fish.radius * 0.7, fish.radius * 0.85, fish.radius * 1.05, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(220,245,255,0.2)";
    ctx.beginPath();
    ctx.ellipse(fish.radius * 0.15, -fish.radius * 0.12, fish.radius * 0.65, fish.radius * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fish.color;
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 1.45, -fish.radius * 0.12);
    ctx.lineTo(-fish.radius * 2.05, -fish.radius * 0.75);
    ctx.lineTo(-fish.radius * 1.78, -fish.radius * 0.06);
    ctx.lineTo(-fish.radius * 2.05, fish.radius * 0.75);
    ctx.lineTo(-fish.radius * 1.45, fish.radius * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(fish.radius * 0.2, -fish.radius * 0.22);
    ctx.lineTo(fish.radius * 0.95, -fish.radius * 0.95);
    ctx.stroke();

    if (fish.isBoss) {
      ctx.fillStyle = "rgba(255, 209, 102, 0.9)";
      ctx.beginPath();
      ctx.moveTo(-fish.radius * 0.55, -fish.radius * 0.95);
      ctx.lineTo(-fish.radius * 0.3, -fish.radius * 1.3);
      ctx.lineTo(-fish.radius * 0.02, -fish.radius * 0.95);
      ctx.lineTo(fish.radius * 0.18, -fish.radius * 1.28);
      ctx.lineTo(fish.radius * 0.42, -fish.radius * 0.95);
      ctx.closePath();
      ctx.fill();
    }
  } else if (fish.species === "鮪魚") {
    ctx.beginPath();
    ctx.moveTo(fish.radius * 1.2, 0);
    ctx.bezierCurveTo(fish.radius * 0.6, -fish.radius * 0.45, -fish.radius * 0.75, -fish.radius * 0.5, -fish.radius * 1.35, -fish.radius * 0.12);
    ctx.lineTo(-fish.radius * 1.85, -fish.radius * 0.5);
    ctx.lineTo(-fish.radius * 1.58, 0);
    ctx.lineTo(-fish.radius * 1.85, fish.radius * 0.5);
    ctx.lineTo(-fish.radius * 1.35, fish.radius * 0.12);
    ctx.bezierCurveTo(-fish.radius * 0.75, fish.radius * 0.5, fish.radius * 0.6, fish.radius * 0.45, fish.radius * 1.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(235,248,255,0.35)";
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-fish.radius * 0.35, i * fish.radius * 0.12);
      ctx.lineTo(fish.radius * 0.95, i * fish.radius * 0.2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 0.05, -fish.radius * 0.16);
    ctx.lineTo(fish.radius * 0.22, -fish.radius * 0.62);
    ctx.lineTo(fish.radius * 0.48, -fish.radius * 0.15);
    ctx.closePath();
    ctx.fill();
  } else if (fish.species === "河豚") {
    const puffGrad = ctx.createRadialGradient(-fish.radius * 0.15, -fish.radius * 0.1, fish.radius * 0.15, 0, 0, fish.radius * 1.15);
    puffGrad.addColorStop(0, "rgba(255,255,255,0.35)");
    puffGrad.addColorStop(0.5, fish.color);
    puffGrad.addColorStop(1, "rgba(92,74,20,0.45)");
    ctx.fillStyle = puffGrad;
    ctx.beginPath();
    ctx.arc(0, 0, fish.radius * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let i = 0; i < 14; i += 1) {
      const a = (Math.PI * 2 * i) / 14;
      const sx = Math.cos(a) * fish.radius * 0.93;
      const sy = Math.sin(a) * fish.radius * 0.93;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(Math.cos(a) * fish.radius * 1.25, Math.sin(a) * fish.radius * 1.25);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(fish.radius * 0.18, -fish.radius * 0.18, fish.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (fish.species === "旗魚") {
    ctx.beginPath();
    ctx.moveTo(fish.radius * 1.55, -fish.radius * 0.03);
    ctx.lineTo(fish.radius * 0.95, -fish.radius * 0.08);
    ctx.bezierCurveTo(fish.radius * 0.55, -fish.radius * 0.55, -fish.radius * 0.65, -fish.radius * 0.48, -fish.radius * 1.28, -fish.radius * 0.1);
    ctx.lineTo(-fish.radius * 1.72, -fish.radius * 0.52);
    ctx.lineTo(-fish.radius * 1.5, 0);
    ctx.lineTo(-fish.radius * 1.72, fish.radius * 0.52);
    ctx.lineTo(-fish.radius * 1.28, fish.radius * 0.1);
    ctx.bezierCurveTo(-fish.radius * 0.65, fish.radius * 0.48, fish.radius * 0.55, fish.radius * 0.55, fish.radius * 0.95, fish.radius * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(240,250,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fish.radius * 0.9, -fish.radius * 0.02);
    ctx.lineTo(fish.radius * 1.95, -fish.radius * 0.02);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 0.1, -fish.radius * 0.18);
    ctx.lineTo(fish.radius * 0.1, -fish.radius * 0.9);
    ctx.lineTo(fish.radius * 0.42, -fish.radius * 0.25);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, fish.radius * 1.15, fish.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(250,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(fish.radius * 0.45, -fish.radius * 0.18, Math.max(1.8, fish.radius * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#072330";
  ctx.beginPath();
  ctx.arc(fish.radius * 0.48, -fish.radius * 0.15, Math.max(1.4, fish.radius * 0.08), 0, Math.PI * 2);
  ctx.fill();

  if (fish.isAccelerated) {
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 1.6, -fish.radius * 0.2);
    ctx.lineTo(-fish.radius * 2.15, -fish.radius * 0.55);
    ctx.moveTo(-fish.radius * 1.55, 0.25 * fish.radius);
    ctx.lineTo(-fish.radius * 2.05, 0.05 * fish.radius);
    ctx.stroke();
  }

  if ((fish.armorRatio ?? 1) < 1) {
    ctx.strokeStyle = "rgba(255, 209, 102, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, fish.radius * 1.15, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (fish.bossShieldHp > 0) {
    ctx.strokeStyle = "rgba(125, 233, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, fish.radius * 1.45, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  const hpRatio = Math.max(0, fish.hp / fish.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(fish.x - fish.radius, fish.y - fish.radius - 13, fish.radius * 2, 4);
  ctx.fillStyle = hpRatio > 0.45 ? "#54e6a6" : hpRatio > 0.2 ? "#ffd166" : "#ff7b7b";
  ctx.fillRect(fish.x - fish.radius, fish.y - fish.radius - 13, fish.radius * 2 * hpRatio, 4);
  if (fish.isBoss) {
    ctx.fillStyle = "rgba(255, 209, 102, 0.95)";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BOSS", fish.x, fish.y - fish.radius - 18);
    if (fish.bossShieldHp > 0) {
      const shieldRatio = Math.max(0, Math.min(1, fish.bossShieldHp / (fish.maxHp * 0.16)));
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(fish.x - fish.radius, fish.y - fish.radius - 22, fish.radius * 2, 4);
      ctx.fillStyle = "#7de9ff";
      ctx.fillRect(fish.x - fish.radius, fish.y - fish.radius - 22, fish.radius * 2 * shieldRatio, 4);
    }
  }
  drawFishStatusBadges(fish);
}

function drawBullets() {
  for (const b of game.bullets) {
    ctx.fillStyle = b.color || "#d9fbff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.towerType === "splash" ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (b.towerType === "slow") {
      ctx.strokeStyle = "rgba(158, 255, 213, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawParticles() {
  const showDamageText = game.displaySettings?.showDamageText !== false;
  for (const p of game.particles) {
    if (p.text) {
      if (!showDamageText) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color || "#ffffff";
      ctx.font = `bold ${p.fontSize || 12}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
      continue;
    }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  ctx.fillStyle = "rgba(231, 251, 255, 0.86)";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  const selected = towerCatalog[game.selectedTowerType] ?? towerCatalog.basic;
  ctx.fillText(`提示: ${selected.label}(${selected.cost})｜點塔升級｜Shift/Alt+點塔做分支升級｜Boss 每5波`, 18, 22);

  if (game.paused) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("暫停中", canvas.width / 2, canvas.height / 2);
  }

  if (game.lives <= 0) {
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffb0b0";
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("防線失守", canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.fillText("重新整理視窗可重新開始", canvas.width / 2, canvas.height / 2 + 28);
  }

  if (game.stageCleared && game.lives > 0) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#a9ffd1";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("關卡完成", canvas.width / 2, canvas.height / 2 - 14);
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";
    const stageStars = game.lastAwardedStars ? `｜本次 ${game.lastAwardedStars} 星` : "";
    ctx.fillText(`可切換地圖 / 關卡後按「套用並重開」${stageStars}`, canvas.width / 2, canvas.height / 2 + 18);
  }

}


  return { drawBackground, drawTowers, drawFish, drawBullets, drawParticles, drawOverlay };
}
