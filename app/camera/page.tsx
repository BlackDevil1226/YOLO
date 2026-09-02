'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { loadModel, detectObjects, type Detection } from '@/lib/yolo';

export default function CameraPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [modelStatus, setModelStatus] = useState('未加載');
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

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

  const startCamera = async () => {
    // 確保模型已加載
    if (!isModelLoaded) {
      setModelStatus('正在加載模型...');
      try {
        await loadModel();
        setIsModelLoaded(true);
        setModelStatus('已準備');
      } catch (error) {
        console.error('模型加載失敗:', error);
        setModelStatus('模型加載失敗');
        alert('無法加載 YOLO 模型。請檢查網路連接並重新嘗試。');
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsRunning(true);
        
        // 視頻準備好後開始檢測
        videoRef.current.onloadedmetadata = () => {
          // 使用 setTimeout 確保狀態已更新
          setTimeout(() => {
            startDetectionLoop();
          }, 100);
        };
      }
    } catch (error) {
      console.error('相機訪問錯誤:', error);
      alert('無法訪問相機。請檢查權限設置。');
    }
  };

  const startDetectionLoop = () => {
    const detect = async () => {
      if (!videoRef.current || !canvasRef.current) {
        return;
      }

      // 檢查視頻流是否仍在運行
      if (!videoRef.current.srcObject) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      try {
        // 設置 canvas 大小
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // 繪製視頻幀
        ctx.drawImage(video, 0, 0);

        // 執行檢測
        setIsDetecting(true);
        const results = await detectObjects(canvas, 0.45);
        setDetections(results);
        setIsDetecting(false);

        // 繪製檢測框
        drawDetections(ctx, results, canvas.width, canvas.height);
      } catch (error) {
        console.error('檢測循環錯誤:', error);
      }

      // 繼續檢測
      if (videoRef.current && videoRef.current.srcObject) {
        animationFrameRef.current = requestAnimationFrame(detect);
      }
    };

    detect();
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsRunning(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  const drawDetections = (
    ctx: CanvasRenderingContext2D,
    detections: Detection[],
    canvasWidth: number,
    canvasHeight: number
  ) => {
    detections.forEach(det => {
      // 繪製邊界框
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(det.x, det.y, det.width, det.height);

      // 繪製標籤背景
      const label = `${det.class_name} (${(det.confidence * 100).toFixed(1)}%)`;
      const fontSize = 16;
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
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 返回按鈕 */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300">
            ← 返回主頁
          </Link>
        </div>

        {/* 標題和狀態 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">📷 實時相機模式</h1>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-slate-800 rounded">
              <p className="text-slate-400">相機狀態</p>
              <p className="font-semibold">{isRunning ? '✓ 已啟動' : '待機中'}</p>
            </div>
            <div className="p-3 bg-slate-800 rounded">
              <p className="text-slate-400">模型狀態</p>
              <p className="font-semibold">{modelStatus}</p>
            </div>
          </div>
        </div>

        {/* 隱藏的視頻元素 */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="hidden"
        />

        {/* Canvas（顯示檢測結果） */}
        <div className="relative bg-black rounded-lg overflow-hidden shadow-xl mb-8">
          <canvas
            ref={canvasRef}
            className="w-full aspect-video bg-black"
          />
          {!isRunning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
              <p className="text-slate-300">點擊下方按鈕啟動相機</p>
            </div>
          )}
        </div>

        {/* 控制按鈕 */}
        <div className="flex gap-4 justify-center mb-8">
          {!isRunning ? (
            <button
              type="button"
              onClick={startCamera}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
            >
              📷 打開相機
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
            >
              ⏹️ 關閉相機
            </button>
          )}
        </div>

        {/* 檢測結果統計 */}
        {isRunning && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 檢測統計 */}
            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
              <p className="text-slate-400 text-sm mb-2">檢測到的物體</p>
              <p className="text-2xl font-bold">{detections.length}</p>
              {isDetecting && <p className="text-yellow-400 text-sm mt-2">⚙️ 正在檢測中...</p>}
            </div>

            {/* 檢測到的物體列表 */}
            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
              <p className="text-slate-400 text-sm mb-3">檢測結果</p>
              <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                {detections.slice(0, 5).map((det, idx) => (
                  <div key={idx} className="text-slate-300">
                    • {det.class_name} ({(det.confidence * 100).toFixed(1)}%)
                  </div>
                ))}
                {detections.length > 5 && (
                  <div className="text-slate-500">... 及其他 {detections.length - 5} 項</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 信息提示 */}
        {modelStatus === '加載失敗' && (
          <div className="mt-8 p-4 bg-red-900/30 border border-red-600 rounded-lg">
            <p className="text-red-300">
              ❌ 模型加載失敗。請檢查網路連接並點擊按鈕重試。
            </p>
          </div>
        )}
        
        {modelStatus === '正在加載...' && (
          <div className="mt-8 p-4 bg-blue-900/30 border border-blue-600 rounded-lg">
            <p className="text-blue-300">
              ⏳ 模型正在加載中... 請稍候（首次加載可能需要 10-30 秒）
            </p>
          </div>
        )}

        {!isRunning && modelStatus === '已準備' && (
          <div className="mt-8 p-4 bg-green-900/30 border border-green-600 rounded-lg">
            <p className="text-green-300">
              ✓ 模型已準備！點擊上方按鈕即可打開相機進行實時檢測。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
