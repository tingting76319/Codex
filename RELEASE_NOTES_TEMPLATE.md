# Release Notes Template

> 複製這份模板到 GitHub Release description（或作為發版 PR 描述）

## 魚塔防禦 `vX.Y.Z`

### 重點更新
- 
- 
- 

### 功能 / 內容
- 

### 修正
- 

### 發佈資訊
- macOS `universal.dmg`（Intel + Apple Silicon）
- 若未簽章 / 未 notarize，macOS 可能需先移除 quarantine：

```bash
xattr -dr com.apple.quarantine "/Applications/魚塔防禦.app"
```

### 已知限制（可選）
- 

### 升級建議（可選）
- 建議從舊版本直接覆蓋安裝至 `Applications`
