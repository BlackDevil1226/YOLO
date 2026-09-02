'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { detectObjects, loadModel, type Detection } from '@/lib/yolo';
import { generateObjectStory, type ObjectStory } from '@/lib/object-story';

type ModelStatus = '載入中' | '已就緒' | '載入失敗';

interface CapturedMoment {
  url: string;
  fileName: string;
  width: number;
  height: number;
  detections: Detection[];
  story: ObjectStory;
}

const CAMERA_MODEL_SIZE = 416;
const UI_UPDATE_INTERVAL_MS = 200;

export default function CameraPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('載入中');
  const [detectorFps, setDetectorFps] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedMoment, setCapturedMoment] = useState<CapturedMoment | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const fpsWindowRef = useRef({ startedAt: 0, frames: 0 });
  const lastUiUpdateRef = useRef(0);
  const photoUrlRef = useRef<string | null>(null);
  const inferencePromiseRef = useRef<Promise<Detection[]> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    loadModel()
      .then(() => {
        if (!mountedRef.current) return;
        setIsModelLoaded(true);
        setModelStatus('已就緒');
      })
      .catch((error) => {
        console.error('模型載入失敗：', error);
        if (!mountedRef.current) return;
        setModelStatus('載入失敗');
        setErrorMessage('無法載入 YOLO 模型，請重新整理頁面後再試。');
      });

    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      if (detectionTimerRef.current !== null) window.clearTimeout(detectionTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    };
  }, []);

  const ensureModelLoaded = async () => {
    if (isModelLoaded) return true;
    setModelStatus('載入中');
    setErrorMessage('');
    try {
      await loadModel();
      setIsModelLoaded(true);
      setModelStatus('已就緒');
      return true;
    } catch (error) {
      console.error('模型載入失敗：', error);
      setModelStatus('載入失敗');
      setErrorMessage('無法載入 YOLO 模型，請確認模型檔案存在。');
      return false;
    }
  };

  const startCamera = async () => {
    if (!(await ensureModelLoaded())) return;

    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
      });

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve) => {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        });
      }
      await video.play();

      const overlay = overlayRef.current;
      if (overlay) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
      }

      runningRef.current = true;
      fpsWindowRef.current = { startedAt: 0, frames: 0 };
      lastUiUpdateRef.current = 0;
      setIsRunning(true);
      setIsDetecting(true);
      startDetectionLoop();
    } catch (error) {
      console.error('無法啟動相機：', error);
      setErrorMessage('無法開啟相機。請允許相機權限，並確認目前使用 HTTPS 或 localhost。');
    }
  };

  const startDetectionLoop = () => {
    const detectFrame = async () => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!runningRef.current || !video || !overlay) return;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        try {
          if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
          }

          const inference = detectObjects(video, 0.3, CAMERA_MODEL_SIZE);
          inferencePromiseRef.current = inference;
          const results = await inference;
          if (!runningRef.current || !mountedRef.current) return;
          drawDetections(overlay, results);
          const now = performance.now();
          if (now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
            setDetections(results);
            lastUiUpdateRef.current = now;
          }
          updateFps(now);
        } catch (error) {
          console.error('物件辨識失敗：', error);
          if (mountedRef.current) setErrorMessage('推論時發生錯誤，請停止相機後再重新啟動。');
        } finally {
          inferencePromiseRef.current = null;
        }
      }

      if (runningRef.current) detectionTimerRef.current = window.setTimeout(detectFrame, 0);
    };

    detectionTimerRef.current = window.setTimeout(detectFrame, 0);
  };

  const updateFps = (now: number) => {
    const fpsWindow = fpsWindowRef.current;
    if (fpsWindow.startedAt === 0) {
      fpsWindowRef.current = { startedAt: now, frames: 1 };
      return;
    }
    fpsWindow.frames += 1;
    const elapsed = now - fpsWindow.startedAt;
    if (elapsed >= 750) {
      setDetectorFps((fpsWindow.frames * 1000) / elapsed);
      fpsWindowRef.current = { startedAt: now, frames: 0 };
    }
  };

  const stopCamera = () => {
    runningRef.current = false;
    if (detectionTimerRef.current !== null) {
      window.clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const overlay = overlayRef.current;
    if (overlay) overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    setIsRunning(false);
    setIsDetecting(false);
    setDetections([]);
    setDetectorFps(0);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    const shouldResumeDetection = runningRef.current;
    runningRef.current = false;
    if (detectionTimerRef.current !== null) {
      window.clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    setIsCapturing(true);
    setErrorMessage('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('無法建立拍照畫布');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (inferencePromiseRef.current) {
        await inferencePromiseRef.current.catch(() => undefined);
      }
      // Re-run the frozen photo at 640px for more accurate boxes and story material.
      const snapshotDetections = await detectObjects(canvas, 0.3);
      drawDetections(canvas, snapshotDetections, false);

      const blob = await canvasToJpeg(canvas);
      if (!mountedRef.current) return;
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);

      const url = URL.createObjectURL(blob);
      photoUrlRef.current = url;
      const capturedAt = new Date().toISOString().replace(/[:.]/g, '-');
      setCapturedMoment({
        url,
        fileName: `roadlens-${capturedAt}.jpg`,
        width: canvas.width,
        height: canvas.height,
        detections: snapshotDetections,
        story: generateObjectStory(snapshotDetections),
      });
    } catch (error) {
      console.error('拍照失敗：', error);
      setErrorMessage('拍照時發生錯誤，請確認相機仍在運作後再試一次。');
    } finally {
      if (mountedRef.current) {
        setIsCapturing(false);
        if (shouldResumeDetection && streamRef.current?.active) {
          runningRef.current = true;
          startDetectionLoop();
        }
      }
    }
  };

  const clearCapturedMoment = () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = null;
    setCapturedMoment(null);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-2 inline-block text-sm text-sky-400 hover:text-sky-300">
              ← 返回首頁
            </Link>
            <h1 className="text-2xl font-bold sm:text-3xl">即時物件辨識</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <StatusPill label="模型" value={modelStatus} good={modelStatus === '已就緒'} />
            <StatusPill label="辨識 FPS" value={detectorFps ? detectorFps.toFixed(1) : '—'} good={detectorFps > 0} />
            <StatusPill label="物件" value={String(detections.length)} good={detections.length > 0} />
          </div>
        </header>

        <section className="relative flex min-h-[52vh] items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-black shadow-2xl sm:min-h-[68vh]">
          <div className="grid w-full place-items-center">
            <div className="col-start-1 row-start-1 grid w-full">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="col-start-1 row-start-1 block h-auto w-full"
              />
              <canvas
                ref={overlayRef}
                className="pointer-events-none col-start-1 row-start-1 block h-auto w-full"
              />
            </div>
          </div>

          {!isRunning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 px-6 text-center">
              <div className="text-5xl">📷</div>
              <p className="text-lg font-medium text-slate-200">
                {modelStatus === '載入中' ? '正在載入辨識模型…' : '啟動相機以開始即時辨識'}
              </p>
              <p className="max-w-md text-sm text-slate-400">相機預覽會維持原生更新率；右上角顯示的是 AI 辨識速度。</p>
            </div>
          )}
        </section>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-700 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {!isRunning ? (
            <button
              type="button"
              onClick={startCamera}
              disabled={modelStatus === '載入中'}
              className="min-w-48 rounded-xl bg-sky-600 px-8 py-3 font-semibold transition hover:bg-sky-500 disabled:cursor-wait disabled:bg-slate-700"
            >
              {modelStatus === '載入中' ? '模型載入中…' : '啟動相機'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isCapturing}
                className="min-w-56 rounded-xl bg-amber-400 px-8 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:bg-slate-600 disabled:text-slate-300"
              >
                {isCapturing ? '正在拍照…' : '📸 拍照並創作故事'}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="min-w-40 rounded-xl bg-red-600 px-8 py-3 font-semibold transition hover:bg-red-500"
              >
                停止相機
              </button>
            </>
          )}
        </div>

        {isRunning && (
          <section className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">辨識結果</h2>
              {isDetecting && <span className="text-xs text-emerald-400">● 持續辨識中</span>}
            </div>
            {detections.length ? (
              <div className="flex flex-wrap gap-2">
                {detections.map((detection, index) => (
                  <span
                    key={`${detection.class_id}-${index}`}
                    className="rounded-full border px-3 py-1 text-sm"
                    style={{
                      borderColor: getClassColor(detection.class_id),
                      backgroundColor: getClassColor(detection.class_id, 0.14),
                      color: getClassColor(detection.class_id),
                    }}
                  >
                    {detection.class_name} {(detection.confidence * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">目前畫面中尚未找到信心度 30% 以上的物件。</p>
            )}
          </section>
        )}

        {capturedMoment && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-slate-900 to-amber-950/30 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">RoadLens 相片故事</p>
                <h2 className="mt-1 text-2xl font-bold text-white">{capturedMoment.story.title}</h2>
              </div>
              <div className="flex gap-2">
                <a
                  href={capturedMoment.url}
                  download={capturedMoment.fileName}
                  className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
                >
                  下載相片
                </a>
                <button
                  type="button"
                  onClick={clearCapturedMoment}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                >
                  關閉
                </button>
              </div>
            </div>

            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <div className="overflow-hidden rounded-xl border border-slate-700 bg-black">
                <Image
                  src={capturedMoment.url}
                  width={capturedMoment.width}
                  height={capturedMoment.height}
                  alt="包含物件辨識標記的相機快照"
                  unoptimized
                  className="h-auto w-full"
                />
              </div>

              <div className="flex flex-col justify-center">
                <div className="mb-5 flex flex-wrap gap-2">
                  {capturedMoment.story.objects.length ? (
                    capturedMoment.story.objects.map((object) => (
                      <span
                        key={object.classId}
                        className="rounded-full border px-3 py-1 text-sm"
                        style={{
                          borderColor: getClassColor(object.classId),
                          backgroundColor: getClassColor(object.classId, 0.14),
                          color: getClassColor(object.classId),
                        }}
                      >
                        {object.label} × {object.count}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-400">神祕物體 × 1</span>
                  )}
                </div>
                <div className="space-y-4 text-base leading-8 text-slate-200">
                  {capturedMoment.story.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                <div className="my-6 border-t border-slate-700" />
                <div lang="en">
                  <h3 className="mb-3 text-xl font-bold text-amber-200">
                    {capturedMoment.story.titleEn}
                  </h3>
                  <div className="space-y-4 text-base leading-7 text-slate-300">
                    {capturedMoment.story.paragraphsEn.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
                <p className="mt-5 text-xs text-slate-500">
                  故事由照片中辨識到的 {capturedMoment.detections.length} 個物件即時創作。
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StatusPill({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
      <span className="mr-2 text-slate-400">{label}</span>
      <span className={good ? 'font-semibold text-emerald-400' : 'font-semibold text-slate-200'}>{value}</span>
    </div>
  );
}

function drawDetections(canvas: HTMLCanvasElement, detections: Detection[], clearCanvas = true) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (clearCanvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.max(1, canvas.width / 1280);
  const lineWidth = 3 * scale;
  const fontSize = Math.round(16 * scale);
  ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  ctx.textBaseline = 'top';

  for (const detection of detections) {
    const label = `${detection.class_name} ${(detection.confidence * 100).toFixed(0)}%`;
    const labelHeight = fontSize + 10 * scale;
    const labelWidth = ctx.measureText(label).width + 12 * scale;
    const labelY = detection.y >= labelHeight ? detection.y - labelHeight : detection.y;

    const color = getClassColor(detection.class_id);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(detection.x, detection.y, detection.width, detection.height);
    ctx.fillStyle = color;
    ctx.fillRect(detection.x, labelY, labelWidth, labelHeight);
    ctx.fillStyle = '#04130a';
    ctx.fillText(label, detection.x + 6 * scale, labelY + 5 * scale);
  }
}

function getClassColor(classId: number, alpha = 1) {
  // The golden-angle step keeps all 80 COCO classes deterministic and visually separated.
  const hue = (classId * 137.508) % 360;
  return `hsla(${hue}, 85%, 60%, ${alpha})`;
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('無法建立 JPEG 相片'))),
      'image/jpeg',
      0.92,
    );
  });
}
