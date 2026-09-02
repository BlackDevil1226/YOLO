import piexif from 'piexifjs';

export interface GPSData {
  latitude: number;
  longitude: number;
  altitude?: number;
}

/**
 * 從 Base64 圖像數據提取 GPS 座標
 */
export async function extractGPSFromImage(base64Image: string): Promise<GPSData | null> {
  try {
    // 移除 Data URL 前綴
    const base64String = base64Image.replace(/^data:image\/(jpeg|jpg|png);base64,/, '');
    
    // 使用 piexif 讀取 EXIF 數據
    const exif = piexif.load(base64String);
    
    // 檢查 GPS IFD
    const gps = exif['GPS'];
    if (!gps) {
      console.log('圖片中未找到 GPS 數據');
      return null;
    }

    // 提取 GPS 座標
    const gpsLatitude = gps[piexif.GPSIFD.GPSLatitude];
    const gpsLongitude = gps[piexif.GPSIFD.GPSLongitude];
    const gpsAltitude = gps[piexif.GPSIFD.GPSAltitude];
    
    const latitudeRef = gps[piexif.GPSIFD.GPSLatitudeRef];
    const longitudeRef = gps[piexif.GPSIFD.GPSLongitudeRef];

    if (!gpsLatitude || !gpsLongitude) {
      console.log('無法找到完整的 GPS 座標');
      return null;
    }

    // 轉換 GPS 座標從分數格式到十進制度數
    const latitude = convertGPSToDecimal(
      gpsLatitude[0],
      gpsLatitude[1],
      gpsLatitude[2],
      latitudeRef === 'S' ? -1 : 1
    );

    const longitude = convertGPSToDecimal(
      gpsLongitude[0],
      gpsLongitude[1],
      gpsLongitude[2],
      longitudeRef === 'W' ? -1 : 1
    );

    // 提取高度（如果存在）
    let altitude: number | undefined;
    if (gpsAltitude) {
      altitude = gpsAltitude[0] / gpsAltitude[1];
    }

    console.log(`✓ GPS 座標已提取: ${latitude}, ${longitude}`);

    return {
      latitude,
      longitude,
      altitude,
    };
  } catch (error) {
    console.error('提取 GPS 數據失敗:', error);
    return null;
  }
}

/**
 * 將 GPS 座標從度/分/秒格式轉換為十進制度數
 */
function convertGPSToDecimal(
  degrees: any,
  minutes: any,
  seconds: any,
  direction: number = 1
): number {
  let decimal =
    degrees[0] / degrees[1] +
    minutes[0] / minutes[1] / 60 +
    seconds[0] / seconds[1] / 3600;

  return decimal * direction;
}

/**
 * 獲取圖像的所有 EXIF 數據（用於調試）
 */
export function getImageExifData(base64Image: string) {
  try {
    const base64String = base64Image.replace(/^data:image\/(jpeg|jpg|png);base64,/, '');
    const exif = piexif.load(base64String);
    return piexif.load(base64String);
  } catch (error) {
    console.error('讀取 EXIF 失敗:', error);
    return null;
  }
}
