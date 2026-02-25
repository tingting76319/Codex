# 魚塔防禦

Electron + Canvas 製作的魚塔防禦遊戲（macOS）。

## 功能特色

- 多種魚種與尺寸（鯊魚、鯨魚、鮪魚、河豚、旗魚、Boss）
- 塔台種類（標準塔 / 緩速塔 / 範圍塔）
- 升級與分支技能樹
- Boss 波次與技能（召喚、護盾）
- 主選單 / 關卡卡片 / 圖鑑 / 設定
- 音樂與音效（Web Audio）
- 關卡進度、星級、圖鑑遭遇、無盡最佳成績存檔

## 安裝（使用者）

### macOS（目前常見問題）

目前發佈版如果尚未簽章 / notarize，macOS 可能顯示「檔案損毀」或無法開啟。

這通常是 Gatekeeper 擋下未簽章 App，不是檔案真的壞掉。

### 安裝步驟

1. 打開 `.dmg`
2. 把 `魚塔防禦.app` 拖到 `Applications`
3. 到 `Applications` 內對 App 按右鍵 -> `開啟`

### 如果顯示「檔案損毀」

在終端機執行：

```bash
xattr -dr com.apple.quarantine "/Applications/魚塔防禦.app"
```

然後再右鍵開啟一次。

### 架構版本（很重要）

- `arm64`：Apple Silicon（M1/M2/M3）
- `x64`：Intel Mac
- `universal`：兩者都可執行（建議）

如果對方是 Intel Mac，而你給的是 `arm64.dmg`，就可能無法執行。

## 開發啟動（開發者）

```bash
npm install
npm start
```

## 打包（開發者）

```bash
npm run dist:mac:arm64
npm run dist:mac:x64
npm run dist:mac:universal
```

## 簽章 / notarization

請參考：

- `NOTARIZE.md`
- `.github/CI_SIGNING_NOTES.md`

## CI（GitHub Actions）

已提供 workflow：

- `.github/workflows/build-macos.yml`

支援：

- 手動觸發 `universal / arm64 / x64`
- 選擇是否 notarize
- `v*` tag 自動建置並上傳 Release 附件
