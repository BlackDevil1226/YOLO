'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { loadModel, detectObjects, type Detection } from '@/lib/yolo';
import { extractGPSFromImage, type GPSData } from '@/lib/exif';
import { MapWrapper } from '@/components/MapWrapper';

export default function PhotoPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [modelStatus, setModelStatus] = useState('未加載');
  const [gpsData, setGpsData] = useState<GPSData | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 初始化模型
  useEffect(() => {
    const initModel = async () => {
      try {
        setModelStatus('正在加載...');
        await loadModel();
        setIsModelLoaded(true);
        setModelStatus('已準備');
      } catch (error) {
        console.error('模型初始化失敗:', error);
        setModelStatus('加載失敗');
      }
    };

    initModel();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setSelectedImage(base64String);
        setFileName(file.name);
        setDetections([]); // 清除之前的檢測結果
        setGpsData(null); // 清除之前的 GPS 數據
        
        // 嘗試提取 GPS 數據
        extractGPSFromImage(base64String).then((gps) => {
          if (gps) {
            setGpsData(gps);
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage || !imageRef.current || !canvasRef.current || !isModelLoaded) {
      return;
    }

    setIsAnalyzing(true);

    try {
      // 等待圖像加載
      await new Promise<void>((resolve) => {
        if (imageRef.current?.complete) {
          resolve();
        } else {
          imageRef.current!.onload = () => resolve();
        }
      });

      const img = imageRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      // 設置 canvas 大小
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // 繪製圖像
      ctx.drawImage(img, 0, 0);

      // 執行檢測
      const results = await detectObjects(canvas, 0.45);
      setDetections(results);

      // 繪製檢測框
      drawDetections(ctx, results);
    } catch (error) {
      console.error('分析失敗:', error);
      alert('圖像分析失敗，請重試。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const drawDetections = (
    ctx: CanvasRenderingContext2D,
    detections: Detection[]
  ) => {
    detections.forEach(det => {
      // 繪製邊界框
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(det.x, det.y, det.width, det.height);

      // 繪製標籤背景
      const label = `${det.class_name} ${(det.confidence * 100).toFixed(1)}%`;
      const fontSize = 14;
      ctx.font = `${fontSize}px Arial`;
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = '#00ff00';
      ctx.fillRect(det.x, det.y - fontSize - 4, textWidth + 4, fontSize + 4);

      // 繪製標籤文字
      ctx.fillStyle = '#000000';
      ctx.fillText(label, det.x + 2, det.y - 4);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 返回按鈕 */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400">
            ← 返回主頁
          </Link>
        </div>

        {/* 標題和狀態 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">📁 照片分析模式</h1>
          <div className="p-3 bg-slate-200 dark:bg-slate-800 rounded inline-block">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              模型狀態：<span className="font-semibold">{modelStatus}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左側：上傳和預覽 */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* 上傳區域 */}
            <div className="border-2 border-dashed border-blue-400 rounded-lg p-8 text-center bg-blue-50 dark:bg-slate-800">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="imageInput"
                disabled={isAnalyzing}
              />
              <label
                htmlFor="imageInput"
                className="cursor-pointer block"
              >
                <div className="text-4xl mb-4">📸</div>
                <p className="text-slate-600 dark:text-slate-300 font-semibold">
                  點擊選擇照片
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  或拖放照片到此區域
                </p>
              </label>
            </div>

            {fileName && (
              <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  ✓ 已選擇：{fileName}
                </p>
              </div>
            )}

            {/* 分析按鈕 */}
            {selectedImage && (
              <button
                onClick={analyzeImage}
                disabled={isAnalyzing || !isModelLoaded}
                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors"
              >
                {isAnalyzing ? '🔄 分析中...' : '🔍 分析照片'}
              </button>
            )}
          </div>

          {/* 中間：圖像預覽（含檢測框） */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {selectedImage ? (
              <>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                  {detections.length > 0 ? (
                    <canvas
                      ref={canvasRef}
                      className="w-full max-h-96 object-cover"
                    />
                  ) : (
                    <img
                      ref={imageRef}
                      src={selectedImage}
                      alt="Preview"
                      className="w-full max-h-96 object-cover"
                      onLoad={() => {}}
                    />
                  )}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {detections.length > 0 && (
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      ✓ 檢測完成！共發現 {detections.length} 個物體
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg aspect-square flex items-center justify-center border border-slate-300 dark:border-slate-700">
                <p className="text-slate-400 text-center">
                  圖片預覽會顯示在這裡
                </p>
              </div>
            )}
          </div>

          {/* 右側：檢測結果表格 */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm">
              <div className="p-4 border-b border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  🎯 檢測結果 ({detections.length})
                </h2>
              </div>
              
              {detections.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700 border-b border-slate-300 dark:border-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left text-slate-900 dark:text-white font-semibold">物體</th>
                        <th className="px-4 py-2 text-right text-slate-900 dark:text-white font-semibold">信心度</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {detections
                        .sort((a, b) => b.confidence - a.confidence)
                        .map((det, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                              {det.class_name}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center justify-center px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-semibold">
                                {(det.confidence * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <p>選擇並分析照片</p>
                  <p className="text-xs mt-2">以查看檢測結果</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 隱藏的 canvas 和圖像元素用於檢測 */}
        <canvas ref={canvasRef} className="hidden" />
        <img ref={imageRef} src={selectedImage || ''} alt="Hidden" className="hidden" crossOrigin="anonymous" />

        {/* GPS 位置和地圖 */}
        {gpsData && (
          <div className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">📍 拍攝位置</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400">緯度</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{gpsData.latitude.toFixed(6)}</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400">經度</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{gpsData.longitude.toFixed(6)}</p>
                </div>
                {gpsData.altitude !== undefined && (
                  <div className="p-4 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400">高度</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{gpsData.altitude.toFixed(1)} m</p>
                  </div>
                )}
              </div>
            </div>

            {/* Leaflet 地圖 */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden p-4">
              <MapWrapper gpsData={gpsData} />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
                地圖由 OpenStreetMap 提供 | 點擊標記查看詳細座標
              </p>
            </div>
          </div>
        )}

        {/* 沒有 GPS 的提示 */}
        {selectedImage && !gpsData && (
          <div className="mt-12 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-lg">
            <p className="text-yellow-700 dark:text-yellow-300">
              ℹ️ 此照片不包含 GPS 位置信息。請嘗試使用帶有 GPS 標籤的手機照片。
            </p>
          </div>
        )}

        {/* 提示信息 */}
        <div className="mt-12 p-6 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg">
          <p className="text-slate-700 dark:text-slate-300">
            💡 <span className="font-semibold">使用說明：</span> 上傳照片後，系統會自動識別其中的物體並生成檢測結果表格。如果照片包含 GPS 位置信息，會在地圖上顯示拍攝位置。
          </p>
        </div>

        {/* 模型加載中的提示 */}
        {!isModelLoaded && (
          <div className="mt-8 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-lg">
            <p className="text-yellow-700 dark:text-yellow-300">
              ⏳ 模型正在加載中... 請稍候（首次加載可能需要 10-30 秒）
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
