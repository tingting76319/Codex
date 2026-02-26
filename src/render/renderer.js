export function createRenderer({ ctx, canvas, game, GRID, pathPoints, pathCellSet, towerCatalog }) {
const fishSpriteMap = {
  "鯊魚": "./assets/fish-battle/shark-real.png",
  "皇帶魚": "./assets/fish-battle/oarfish-real.png",
  "魟魚": "./assets/fish-battle/ray-real.png",
  "鯨魚": "./assets/fish-battle/whale-real.png",
  "河豚": "./assets/fish-battle/puffer-real.png",
  "旗魚": "./assets/fish-battle/swordfish-real.png",
  "鮪魚": "./assets/fish-battle/tuna-real.png",
  "BOSS:深海鯨王": "./assets/fish-battle/boss-whale-king.jpeg"
};
const fishSpriteCache = new Map();

function getFishSprite(species, fish = null) {
  const bossKey = fish?.isBoss ? `BOSS:${fish.label}` : null;
  const src = (bossKey && fishSpriteMap[bossKey]) || fishSpriteMap[species];
  if (!src) return null;
  if (fishSpriteCache.has(src)) return fishSpriteCache.get(src);
  const img = new Image();
  img.decoding = "async";
  img.loading = "lazy";
  img.src = src;
  fishSpriteCache.set(src, img);
  return img;
}

function drawFishSpriteIfAvailable(fish) {
  const img = getFishSprite(fish.species, fish);
  if (!img || !img.complete || !img.naturalWidth) return false;
  const isOarfish = fish.species === "皇帶魚";
  const isRay = fish.species === "魟魚";
  const isWhale = fish.species === "鯨魚" || fish.isBoss;
  const isPuffer = fish.species === "河豚";
  const isSwordfish = fish.species === "旗魚";
  const width = fish.radius * (
    isOarfish ? 5.4
      : isRay ? 3.3
        : isWhale ? 4.4
          : isPuffer ? 2.25
            : isSwordfish ? 4.1
              : 3.8
  );
  const height = fish.radius * (
    isOarfish ? 1.25
      : isRay ? 2.1
        : isWhale ? 2.25
          : isPuffer ? 2.2
            : isSwordfish ? 1.75
              : 2.1
  );
  const phase = (performance.now() * 0.0038) + (fish.id || 0) * 0.47;
  const pulse = fish.isBoss ? 1 + Math.sin(phase) * 0.035 : 1 + Math.sin(phase) * 0.012;
  const glow = fish.isBoss ? 0.16 + (Math.sin(phase * 1.2) + 1) * 0.05 : 0.06 + (Math.sin(phase * 1.1) + 1) * 0.015;
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.beginPath();
  if (isRay) {
    ctx.ellipse(0, 0, width * 0.42, height * 0.42, 0, 0, Math.PI * 2);
  } else if (isPuffer) {
    ctx.arc(0, 0, Math.min(width, height) * 0.44, 0, Math.PI * 2);
  } else {
    ctx.roundRect(-width * 0.46, -height * 0.45, width * 0.92, height * 0.9, height * 0.22);
  }
  ctx.clip();
  ctx.globalAlpha = fish.isBoss ? 0.96 : 0.92;
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  if (glow > 0) {
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = fish.isBoss ? `rgba(255,209,102,${glow.toFixed(3)})` : `rgba(255,255,255,${glow.toFixed(3)})`;
    if (isRay) {
      ctx.beginPath();
      ctx.ellipse(0, 0, width * 0.42, height * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(-width * 0.46, -height * 0.45, width * 0.92, height * 0.9, height * 0.22);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.2;
  if (isRay) {
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.42, height * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-width * 0.12, 0);
    ctx.lineTo(width * 0.38, 0);
    ctx.stroke();
  } else if (isPuffer) {
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(width, height) * 0.44, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.roundRect(-width * 0.46, -height * 0.45, width * 0.92, height * 0.9, height * 0.22);
    ctx.stroke();
  }
  return true;
}

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
    if (tower.typeKey === "sniper") {
      ctx.strokeStyle = "rgba(216, 220, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tower.x - 12, tower.y - 10);
      ctx.lineTo(tower.x + 14, tower.y + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tower.x + 8, tower.y + 6, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (tower.typeKey === "support") {
      ctx.strokeStyle = "rgba(141, 255, 185, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tower.x, tower.y - 10);
      ctx.lineTo(tower.x, tower.y + 10);
      ctx.moveTo(tower.x - 10, tower.y);
      ctx.lineTo(tower.x + 10, tower.y);
      ctx.stroke();
      if (tower.supportAura?.radius) {
        ctx.strokeStyle = "rgba(141,255,185,0.2)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, tower.supportAura.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.fillStyle = "#e7fbff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    const shortType = tower.typeKey === "slow"
      ? "緩"
      : tower.typeKey === "splash"
        ? "範"
        : tower.typeKey === "sniper"
          ? "狙"
          : tower.typeKey === "support"
            ? "輔"
            : "標";
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
  const swimPhase = (performance.now() * 0.006) + (fish.id || 0) * 0.73;
  const tailWave = Math.sin(swimPhase) * fish.radius * 0.06;
  const bodyBob = Math.cos(swimPhase * 0.6) * fish.radius * 0.02;
  ctx.translate(0, bodyBob);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(-fish.radius * 0.18, fish.radius * 0.34, fish.radius * 1.35, fish.radius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(-fish.radius * 1.6, -fish.radius, fish.radius * 1.2, fish.radius);
  bodyGrad.addColorStop(0, "rgba(255,255,255,0.18)");
  bodyGrad.addColorStop(0.25, fish.color);
  bodyGrad.addColorStop(1, "rgba(4,24,34,0.45)");
  ctx.fillStyle = bodyGrad;

  if (drawFishSpriteIfAvailable(fish)) {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.beginPath();
    ctx.arc(fish.radius * 0.52, -fish.radius * 0.12, Math.max(1.8, fish.radius * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    ctx.arc(fish.radius * 0.52, -fish.radius * 0.12, Math.max(0.8, fish.radius * 0.035), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (fish.species === "鯊魚") {
    ctx.beginPath();
    ctx.moveTo(fish.radius * 1.15, 0);
    ctx.bezierCurveTo(fish.radius * 0.6, -fish.radius * 0.72, -fish.radius * 0.65, -fish.radius * 0.62, -fish.radius * 1.25, -fish.radius * 0.12);
    ctx.lineTo(-fish.radius * 1.72, -fish.radius * 0.58 + tailWave);
    ctx.lineTo(-fish.radius * 1.55, -fish.radius * 0.02);
    ctx.lineTo(-fish.radius * 1.8, fish.radius * 0.55 - tailWave);
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
    ctx.lineTo(-fish.radius * 2.05, -fish.radius * 0.75 + tailWave * 1.2);
    ctx.lineTo(-fish.radius * 1.78, -fish.radius * 0.06);
    ctx.lineTo(-fish.radius * 2.05, fish.radius * 0.75 - tailWave * 1.2);
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
    ctx.lineTo(-fish.radius * 1.85, -fish.radius * 0.5 + tailWave);
    ctx.lineTo(-fish.radius * 1.58, 0);
    ctx.lineTo(-fish.radius * 1.85, fish.radius * 0.5 - tailWave);
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
  } else if (fish.species === "皇帶魚") {
    ctx.beginPath();
    ctx.moveTo(fish.radius * 1.35, 0);
    ctx.bezierCurveTo(fish.radius * 0.75, -fish.radius * 0.22, -fish.radius * 0.25, -fish.radius * 0.18, -fish.radius * 1.35, -fish.radius * 0.06);
    ctx.lineTo(-fish.radius * 2.05, -fish.radius * 0.2 + tailWave);
    ctx.lineTo(-fish.radius * 2.15, 0);
    ctx.lineTo(-fish.radius * 2.05, fish.radius * 0.2 - tailWave);
    ctx.lineTo(-fish.radius * 1.35, fish.radius * 0.06);
    ctx.bezierCurveTo(-fish.radius * 0.25, fish.radius * 0.18, fish.radius * 0.75, fish.radius * 0.22, fish.radius * 1.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 123, 123, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 1.25, -fish.radius * 0.02);
    ctx.quadraticCurveTo(-fish.radius * 0.25, -fish.radius * 0.42, fish.radius * 0.55, -fish.radius * 0.2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(240,250,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 1.2, 0);
    ctx.quadraticCurveTo(-fish.radius * 0.1, 0.02 * fish.radius, fish.radius * 1.02, 0.03 * fish.radius);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.moveTo(fish.radius * 0.25, -fish.radius * 0.08);
    ctx.lineTo(fish.radius * 0.5, -fish.radius * 0.48);
    ctx.lineTo(fish.radius * 0.72, -fish.radius * 0.08);
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
  } else if (fish.species === "魟魚") {
    ctx.beginPath();
    ctx.moveTo(fish.radius * 1.05, 0);
    ctx.quadraticCurveTo(fish.radius * 0.35, -fish.radius * 0.92, -fish.radius * 0.95, -fish.radius * 0.42);
    ctx.quadraticCurveTo(-fish.radius * 1.15, -fish.radius * 0.18, -fish.radius * 1.28, 0);
    ctx.quadraticCurveTo(-fish.radius * 1.15, fish.radius * 0.18, -fish.radius * 0.95, fish.radius * 0.42);
    ctx.quadraticCurveTo(fish.radius * 0.35, fish.radius * 0.92, fish.radius * 1.05, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(235,248,255,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 0.8, 0);
    ctx.quadraticCurveTo(fish.radius * 0.05, 0, fish.radius * 0.92, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 0.72, -fish.radius * 0.18);
    ctx.quadraticCurveTo(fish.radius * 0.02, -fish.radius * 0.1, fish.radius * 0.72, -fish.radius * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 0.72, fish.radius * 0.18);
    ctx.quadraticCurveTo(fish.radius * 0.02, fish.radius * 0.1, fish.radius * 0.72, fish.radius * 0.08);
    ctx.stroke();

    ctx.strokeStyle = "rgba(180, 240, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-fish.radius * 1.18, 0);
    ctx.lineTo(-fish.radius * 1.85, tailWave * 1.6);
    ctx.stroke();
  } else if (fish.species === "旗魚") {
    ctx.beginPath();
    ctx.moveTo(fish.radius * 1.55, -fish.radius * 0.03);
    ctx.lineTo(fish.radius * 0.95, -fish.radius * 0.08);
    ctx.bezierCurveTo(fish.radius * 0.55, -fish.radius * 0.55, -fish.radius * 0.65, -fish.radius * 0.48, -fish.radius * 1.28, -fish.radius * 0.1);
    ctx.lineTo(-fish.radius * 1.72, -fish.radius * 0.52 + tailWave);
    ctx.lineTo(-fish.radius * 1.5, 0);
    ctx.lineTo(-fish.radius * 1.72, fish.radius * 0.52 - tailWave);
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

  ctx.strokeStyle = "rgba(7, 35, 48, 0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fish.radius * 0.18, -fish.radius * 0.42);
  ctx.lineTo(fish.radius * 0.18, fish.radius * 0.42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fish.radius * 0.04, -fish.radius * 0.34);
  ctx.quadraticCurveTo(fish.radius * 0.12, -fish.radius * 0.18, fish.radius * 0.22, -fish.radius * 0.04);
  ctx.stroke();

  ctx.strokeStyle = "rgba(235, 249, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-fish.radius * 0.9, 0);
  ctx.quadraticCurveTo(-fish.radius * 0.15, fish.radius * 0.08, fish.radius * 0.78, fish.radius * 0.1);
  ctx.stroke();

  ctx.fillStyle = "rgba(250,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(fish.radius * 0.45, -fish.radius * 0.18, Math.max(1.8, fish.radius * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#072330";
  ctx.beginPath();
  ctx.arc(fish.radius * 0.48, -fish.radius * 0.15, Math.max(1.4, fish.radius * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(fish.radius * 0.56, -fish.radius * 0.22, Math.max(0.7, fish.radius * 0.025), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(8, 30, 38, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fish.radius * 0.68, fish.radius * 0.08);
  ctx.quadraticCurveTo(fish.radius * 0.55, fish.radius * 0.22, fish.radius * 0.32, fish.radius * 0.18);
  ctx.stroke();

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
    if (p.ringRadius) {
      ctx.globalAlpha = Math.max(0, p.life) * 0.7;
      ctx.strokeStyle = p.color || "#8dffb9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.ringRadius * (1 - Math.max(0, p.life) * 0.2), 0, Math.PI * 2);
      ctx.stroke();
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
