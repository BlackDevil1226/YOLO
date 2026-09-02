# 🛣️ RoadLens

實時物體檢測 Web 應用 — 用相機或照片識別周圍的物體。

## ✨ 功能特性

- 📷 **實時相機模式** — 使用設備相機進行即時物體檢測
- 📁 **照片分析模式** — 上傳照片進行檢測和分析
- 🧠 **AI 模型** — 使用 YOLO11n 模型，支援 80+ 物體類別
- 🚀 **完全本地處理** — 所有 AI 處理在設備上運行，無需上傳到服務器
- 🎨 **優化效能** — 支援 WebGPU 加速（如可用）+ WebAssembly 後備
- 📍 **GPS 位置** — 自動從照片提取 GPS 座標並在地圖上顯示
- 🗺️ **互動式地圖** — 使用 OpenStreetMap 顯示拍攝位置

## 🛠️ 技術棧

- **前端**: Next.js 16 + React + TypeScript
- **樣式**: Tailwind CSS
- **物體檢測**: YOLO11n + ONNX Runtime Web
- **地圖**: Leaflet + React Leaflet
- **GPS 提取**: piexifjs

## 📋 系統要求

- 現代網頁瀏覽器（支援 WebGL）
- 相機權限（用於實時相機模式）
- 至少 100MB 的可用網路頻寬（首次加載 YOLO 模型）

## 🚀 快速開始

### 本地開發

1. **克隆或複製此專案**
   ```bash
   cd roadlens
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **啟動開發伺服器**
   ```bash
   npm run dev
   ```

4. **在瀏覽器中打開**
   ```
   http://localhost:3000
   ```

### 構建生產版本

```bash
npm run build
npm start
```

## 📱 使用說明

### 相機模式

1. 在首頁點擊「📷 實時相機模式」
2. 點擊「打開相機」按鈕
3. 允許瀏覽器訪問您的相機
4. 應用會自動開始檢測物體
5. 綠色邊界框和標籤會即時顯示檢測結果

### 照片模式

1. 在首頁點擊「📁 照片分析模式」
2. 點擊上傳區域選擇一張照片
3. 點擊「🔍 分析照片」按鈕
4. 等待模型處理（通常 2-5 秒）
5. 查看結果：
   - 帶有檢測框的圖像
   - 物體檢測結果表格
   - GPS 位置和地圖（如照片包含位置信息）

## ☁️ 部署到 Vercel（免費層）

### 步驟 1：準備 GitHub 倉庫

1. 創建 GitHub 賬號（如果還沒有）：https://github.com/signup
2. 在 GitHub 上創建新倉庫：
   - 名稱：`roadlens`
   - 可見性：Public
   - 不要初始化任何文件
3. 將本地專案推送到 GitHub：
   ```bash
   git add .
   git commit -m "Initial commit: RoadLens YOLO detection app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/roadlens.git
   git push -u origin main
   ```

### 步驟 2：連接 Vercel

1. 訪問 https://vercel.com
2. 點擊「Sign Up」使用 GitHub 帳號登錄
3. 在儀表板上點擊「New Project」
4. 選擇您的 `roadlens` 倉庫
5. Vercel 會自動偵測 Next.js 配置
6. 點擊「Deploy」

### 步驟 3：完成

- 部署完成後，您會獲得一個公開 URL（例如 `https://roadlens-abc123.vercel.app`）
- 您可以分享此 URL 給任何人使用該應用

## 💡 使用提示

- **首次加載很慢** — 模型首次加載需要 10-30 秒，之後速度會快得多（緩存）
- **WebGPU 加速** — 如果您的設備支援 WebGPU，應用會自動使用它以獲得更好的效能
- **相機性能** — 檢測速度取決於您的設備硬體
- **照片大小** — 大型照片可能需要更長時間來處理
- **隱私** — 所有處理都在您的設備上，沒有數據被發送到服務器

## 📊 YOLO 類別

應用可以檢測 80 種 COCO 資料集物體，包括：

**人和動物**: person, bicycle, dog, cat, horse, sheep, cow, elephant, bear, zebra, giraffe

**交通工具**: car, motorcycle, airplane, bus, train, truck, boat

**交通設施**: traffic light, fire hydrant, stop sign, parking meter, bench

**家居物品**: chair, couch, potted plant, bed, dining table, toilet, tv, laptop, mouse, remote, keyboard, microwave, oven, toaster, sink, refrigerator

**食物和飲料**: bottle, wine glass, cup, fork, knife, spoon, bowl, banana, apple, sandwich, orange, broccoli, carrot, hot dog, pizza, donut, cake

**還有許多其他物體...**

## 🔧 環境變數

無需額外的環境變數。應用完全在客戶端運行。

## 📝 許可證

MIT License - 可自由使用和修改

## 🐛 故障排除

### 相機不工作

- 檢查瀏覽器是否有相機權限
- 在 HTTPS（Vercel 自動提供）或 localhost 上運行
- 檢查瀏覽器控制台（F12）中是否有錯誤

### 模型加載失敗

- 檢查網路連接
- 嘗試清除瀏覽器快取
- 確保 `public/models/yolo11n.onnx` 文件存在

### 沒有 GPS 位置

- 照片必須包含 EXIF GPS 數據
- 用手機的原生相機應用拍攝照片
- 確保允許相機應用訪問位置

## 📚 更多資源

- YOLO 官方: https://docs.ultralytics.com/
- ONNX Runtime Web: https://onnxruntime.ai/
- Next.js 文檔: https://nextjs.org/docs
- Vercel 部署: https://vercel.com/docs

---

祝您使用愉快！如有問題，請檢查上面的故障排除部分。 🚀
