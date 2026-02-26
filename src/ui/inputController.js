export function bindInputHandlers({
  canvas,
  hud,
  menu,
  onCanvasClick,
  onCanvasMove,
  onStartWave,
  onTogglePause,
  onToggleSpeed,
  onSelectTowerType,
  onTowerPanelUpgrade,
  onTowerPanelBranchA,
  onTowerPanelBranchB,
  onToggleMute,
  onBgmVolumeInput,
  onSfxVolumeInput,
  onMapChange,
  onStageChange,
  onApplyStage,
  onOpenMenu,
  onOpenShortcutHelp,
  onOpenSave,
  onMenuMapChange,
  onMenuStageChange,
  onMenuStart,
  onMenuClose,
  onToggleAutoStartWaves
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
  canvas.addEventListener("pointermove", (event) => onCanvasMove?.(event));
  canvas.addEventListener("mousemove", (event) => onCanvasMove?.(event));
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
  bindPress(hud.openMenuBtn, onOpenMenu);
  {
    const btn = hud.openShortcutHelpBtn;
    const pop = document.getElementById("shortcutQuickPopover");
    let longPressTimer = null;
    let longPressTriggered = false;
    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    const positionPopover = () => {
      if (!btn || !pop) return;
      const rect = btn.getBoundingClientRect();
      pop.style.left = `${Math.round(rect.left)}px`;
      pop.style.top = `${Math.round(rect.bottom + 8)}px`;
    };
    const showQuickPopover = () => {
      if (!btn || !pop) return;
      positionPopover();
      pop.classList.remove("is-hidden");
      pop.querySelector(".action-row")?.focus();
    };
    const hideQuickPopover = () => {
      pop?.classList.add("is-hidden");
    };
    if (btn) {
      btn.addEventListener("pointerdown", (event) => {
        if ("button" in event && event.button !== 0) return;
        longPressTriggered = false;
        clearLongPress();
        longPressTimer = setTimeout(() => {
          longPressTriggered = true;
          showQuickPopover();
        }, 420);
      });
      btn.addEventListener("pointerup", clearLongPress);
      btn.addEventListener("pointerleave", clearLongPress);
      btn.addEventListener("pointercancel", clearLongPress);
      btn.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        clearLongPress();
        longPressTriggered = true;
        if (pop?.classList.contains("is-hidden")) showQuickPopover();
        else hideQuickPopover();
      });
      btn.addEventListener("click", (event) => {
        clearLongPress();
        if (longPressTriggered) {
          longPressTriggered = false;
          return;
        }
        onOpenShortcutHelp?.(event);
      });
    }
    pop?.addEventListener("click", (event) => {
      const row = event.target.closest(".action-row");
      if (!row) return;
      const action = row.dataset.shortcutAction;
      if (action === "space") {
        onStartWave?.(event);
      } else if (action === "autoWave") {
        onToggleAutoStartWaves?.();
      } else if (action === "branchA") {
        // Guide only: branch shortcuts require selecting a tower.
      } else if (action === "branchB") {
        // Guide only: branch shortcuts require selecting a tower.
      }
    });
    window.addEventListener("resize", () => {
      if (pop && !pop.classList.contains("is-hidden")) positionPopover();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!pop || pop.classList.contains("is-hidden")) return;
      if (event.target === btn || btn?.contains?.(event.target)) return;
      if (pop.contains(event.target)) return;
      hideQuickPopover();
    }, true);
    window.addEventListener("keydown", (event) => {
      if (!pop || pop.classList.contains("is-hidden")) {
        if (event.key === "Escape") hideQuickPopover();
        return;
      }
      const rows = [...pop.querySelectorAll(".action-row")];
      if (rows.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const current = document.activeElement;
        const idx = rows.indexOf(current);
        const nextIdx = event.key === "ArrowDown"
          ? (idx + 1 + rows.length) % rows.length
          : (idx - 1 + rows.length) % rows.length;
        rows[nextIdx]?.focus();
        return;
      }
      if (event.key === "Enter" && document.activeElement?.classList?.contains("action-row")) {
        event.preventDefault();
        document.activeElement.click();
        return;
      }
      if (event.key === "Escape") {
        hideQuickPopover();
        btn?.focus?.();
      }
    });
  }
  bindPress(hud.openSaveBtn, onOpenSave);
  bindPress(hud.towerTypeBasicBtn, () => onSelectTowerType?.("basic"));
  bindPress(hud.towerTypeSlowBtn, () => onSelectTowerType?.("slow"));
  bindPress(hud.towerTypeSplashBtn, () => onSelectTowerType?.("splash"));
  bindPress(hud.towerTypeSniperBtn, () => onSelectTowerType?.("sniper"));
  bindPress(hud.towerTypeSupportBtn, () => onSelectTowerType?.("support"));
  bindPress(hud.towerInfoUpgradeBtn, onTowerPanelUpgrade);
  bindPress(hud.towerInfoBranchABtn, onTowerPanelBranchA);
  bindPress(hud.towerInfoBranchBBtn, onTowerPanelBranchB);
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

  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    const tag = target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === " ") {
      event.preventDefault();
      onStartWave?.(event);
      return;
    }
    if (event.key?.toLowerCase() === "a") {
      event.preventDefault();
      onToggleAutoStartWaves?.();
    }
  });
}
