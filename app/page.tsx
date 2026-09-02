'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <main className="flex flex-col items-center gap-12 px-6 py-12 text-center">
        {/* 標題 */}
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-bold text-slate-900 dark:text-white">
            🛣️ RoadLens
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-md">
            用相機識別周圍的物體 — 人、汽車、交通燈、狗、筆記本電腦、杯子、椅子等等
          </p>
        </div>

        {/* 兩個大按鈕 */}
        <div className="flex flex-col gap-6 w-full max-w-sm">
          {/* 相機模式按鈕 */}
          <Link
            href="/camera"
            className="flex items-center justify-center gap-3 px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg rounded-lg transition-colors shadow-lg"
          >
            <span>📷</span>
            實時相機模式
          </Link>

          {/* 照片模式按鈕 */}
          <Link
            href="/photo"
            className="flex items-center justify-center gap-3 px-8 py-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-lg rounded-lg transition-colors shadow-lg"
          >
            <span>📁</span>
            照片分析模式
          </Link>
        </div>

        {/* 信息文本 */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-8">
          ✨ 所有處理在您的設備上進行 — 無需上傳到服務器
        </p>
      </main>
    </div>
  );
}
