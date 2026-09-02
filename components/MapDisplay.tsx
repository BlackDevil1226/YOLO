'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { GPSData } from '@/lib/exif';

// 修復 Leaflet 默認標記圖標
const icon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  shadowSize: [41, 41],
  iconAnchor: [12, 41],
  shadowAnchor: [12, 41],
});

interface MapDisplayProps {
  gpsData: GPSData;
}

export default function MapDisplay({ gpsData }: MapDisplayProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // 初始化地圖
    map.current = L.map(mapContainer.current).setView(
      [gpsData.latitude, gpsData.longitude],
      15
    );

    // 添加 OpenStreetMap 圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // 添加標記在 GPS 位置
    L.marker([gpsData.latitude, gpsData.longitude], { icon })
      .bindPopup(`
        <div class="text-sm">
          <p class="font-semibold">📍 拍攝位置</p>
          <p>緯度: ${gpsData.latitude.toFixed(6)}</p>
          <p>經度: ${gpsData.longitude.toFixed(6)}</p>
          ${gpsData.altitude ? `<p>高度: ${gpsData.altitude.toFixed(1)}m</p>` : ''}
        </div>
      `)
      .addTo(map.current);

    // 清理函數
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [gpsData]);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-96 rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm"
      style={{ zIndex: 0 }}
    />
  );
}
