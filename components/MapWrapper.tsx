import dynamic from 'next/dynamic';
import { GPSData } from '@/lib/exif';

const MapComponent = dynamic(() => import('@/components/MapDisplay'), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">🗺️ 地圖載入中...</div>,
});

interface MapWrapperProps {
  gpsData: GPSData | null;
}

export function MapWrapper({ gpsData }: MapWrapperProps) {
  if (!gpsData) {
    return (
      <div className="w-full h-96 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">無法從照片提取 GPS 位置</p>
      </div>
    );
  }

  return <MapComponent gpsData={gpsData} />;
}
