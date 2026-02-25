export function bindInputHandlers({
  canvas,
  hud,
  menu,
  onCanvasClick,
  onStartWave,
  onTogglePause,
  onToggleSpeed,
  onSelectTowerType,
  onToggleMute,
  onBgmVolumeInput,
  onSfxVolumeInput,
  onMapChange,
  onStageChange,
  onApplyStage,
  onMenuMapChange,
  onMenuStageChange,
  onMenuStart,
  onMenuClose
}) {
  const lastPressTs = new WeakMap();
  const bindPress = (el, handler) => {
    if (!el || !handler) return;
    const mark = () => lastPressTs.set(el, performance.now());
    el.addEventListener("pointerdown", (event) => {
      if ("button" in event && event.button !== 0) return;
      mark();
      handler(event);
    });
    el.addEventListener("click", (event) => {
      const last = lastPressTs.get(el) ?? 0;
      if (performance.now() - last < 220) return;
      handler(event);
    });
  };

  let lastCanvasPointerTs = 0;
  let lastGlobalCanvasRouteTs = 0;
  const handleCanvasPointer = (event) => {
    lastCanvasPointerTs = performance.now();
    onCanvasClick?.(event);
  };
  const handleCanvasClick = (event) => {
    // Some macOS/Electron setups dispatch both pointer and click; drop duplicate click.
    if (performance.now() - lastCanvasPointerTs < 220) return;
    onCanvasClick?.(event);
  };
  const routeCanvasIfInside = (event) => {
    if (!onCanvasClick || !canvas?.getBoundingClientRect) return;
    if (typeof event.clientX !== "number" || typeof event.clientY !== "number") return;
    if ("button" in event && event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const inside = (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
    if (!inside) return;
    const now = performance.now();
    if (now - lastCanvasPointerTs < 220 || now - lastGlobalCanvasRouteTs < 220) return;
    lastGlobalCanvasRouteTs = now;
    onCanvasClick(event);
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", handleCanvasPointer);
  canvas.addEventListener("click", handleCanvasClick);
  // Fallback for environments where an invisible overlay intercepts canvas events.
  window.addEventListener("pointerdown", (event) => {
    if (event.target === canvas) return;
    routeCanvasIfInside(event);
  }, true);
  window.addEventListener("click", (event) => {
    if (event.target === canvas) return;
    routeCanvasIfInside(event);
  }, true);
  bindPress(hud.waveBtn, onStartWave);
  bindPress(hud.pauseBtn, onTogglePause);
  bindPress(hud.speedBtn, onToggleSpeed);
  bindPress(hud.towerTypeBasicBtn, () => onSelectTowerType?.("basic"));
  bindPress(hud.towerTypeSlowBtn, () => onSelectTowerType?.("slow"));
  bindPress(hud.towerTypeSplashBtn, () => onSelectTowerType?.("splash"));
  bindPress(hud.muteBtn, onToggleMute);
  hud.bgmVolume?.addEventListener("input", onBgmVolumeInput);
  hud.sfxVolume?.addEventListener("input", onSfxVolumeInput);
  hud.mapSelect?.addEventListener("change", onMapChange);
  hud.stageSelect?.addEventListener("change", onStageChange);
  bindPress(hud.applyStageBtn, onApplyStage);
  menu?.mapSelect?.addEventListener("change", onMenuMapChange);
  menu?.stageSelect?.addEventListener("change", onMenuStageChange);
  bindPress(menu?.startBtn, onMenuStart);
  bindPress(menu?.closeBtn, onMenuClose);
}
