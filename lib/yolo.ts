import * as ort from 'onnxruntime-web';

// YOLO11n 模型輸出的類別標籤
export const YOLO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 
  'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 
  'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 
  'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 
  'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 
  'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 
  'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed', 
  'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'microwave', 
  'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 
  'teddy bear', 'hair drier', 'toothbrush'
];

export interface Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

let model: ort.InferenceSession | null = null;

// 加載模型
export async function loadModel(): Promise<void> {
  if (model) return; // 已加載

  try {
    console.log('正在加載 YOLO 模型...');
    
    // 設置 ONNX Runtime 以使用 WebGPU（如可用）或 WebAssembly 後備
    const wasmEnv = ort.env.wasm as any;
    wasmEnv.simdSupported = true;
    wasmEnv.numThreads = 4;
    
    // 嘗試使用 WebGPU，後備到 WebAssembly
    const executionProviders: any[] = [];
    
    // 檢查 WebGPU 支援
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      console.log('✓ 檢測到 WebGPU 支援，嘗試使用 WebGPU...');
      executionProviders.push('webgpu');
    } else {
      console.log('ℹ️ 未支持 WebGPU，將使用 WebAssembly');
    }
    
    // 添加 WebAssembly 作為後備
    executionProviders.push('wasm');
    
    model = await ort.InferenceSession.create('/models/yolo11n.onnx', {
      executionProviders,
      graphOptimizationLevel: 'all',
    });
    
    console.log('✓ 模型已加載');
  } catch (error) {
    console.error('模型加載失敗:', error);
    throw error;
  }
}

// 前處理：將圖像準備為模型輸入
function preprocessImage(
  canvas: HTMLCanvasElement,
  targetSize: number = 640
): {
  data: Float32Array;
  originalWidth: number;
  originalHeight: number;
  scale: number;
} {
  const ctx = canvas.getContext('2d')!;
  const originalWidth = canvas.width;
  const originalHeight = canvas.height;

  // 計算縮放比例（保持比例）
  const scale = Math.min(targetSize / originalWidth, targetSize / originalHeight);
  
  // 創建臨時 canvas 用於縮放
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = targetSize;
  tempCanvas.height = targetSize;
  const tempCtx = tempCanvas.getContext('2d')!;
  
  // 填充背景（灰色）
  tempCtx.fillStyle = '#128';
  tempCtx.fillRect(0, 0, targetSize, targetSize);
  
  // 計算偏移以居中圖像
  const offsetX = (targetSize - originalWidth * scale) / 2;
  const offsetY = (targetSize - originalHeight * scale) / 2;
  
  // 繪製縮放後的圖像
  tempCtx.drawImage(
    canvas,
    0, 0, originalWidth, originalHeight,
    offsetX, offsetY, originalWidth * scale, originalHeight * scale
  );
  
  // 提取像素數據
  const imageData = tempCtx.getImageData(0, 0, targetSize, targetSize);
  const data = imageData.data;
  
  // 轉換為 Float32Array 並進行標準化
  const float32Data = new Float32Array(3 * targetSize * targetSize);
  
  for (let i = 0; i < data.length; i += 4) {
    float32Data[i / 4] = data[i] / 255; // R
    float32Data[targetSize * targetSize + i / 4] = data[i + 1] / 255; // G
    float32Data[2 * targetSize * targetSize + i / 4] = data[i + 2] / 255; // B
  }
  
  return {
    data: float32Data,
    originalWidth,
    originalHeight,
    scale,
  };
}

// 執行推理
export async function detectObjects(
  canvas: HTMLCanvasElement,
  confidenceThreshold: number = 0.5
): Promise<Detection[]> {
  if (!model) {
    await loadModel();
  }

  try {
    // 前處理
    const { data, originalWidth, originalHeight, scale } = preprocessImage(canvas);
    
    // 創建輸入張量
    const inputTensor = new ort.Tensor('float32', data, [1, 3, 640, 640]);
    
    // 運行推理
    const outputs = await model!.run({ images: inputTensor });
    
    // 後處理
    const detections = postprocessOutput(
      outputs,
      originalWidth,
      originalHeight,
      scale,
      confidenceThreshold
    );
    
    return detections;
  } catch (error) {
    console.error('檢測失敗:', error);
    return [];
  }
}

// 後處理：解析模型輸出
function postprocessOutput(
  outputs: Record<string, ort.Tensor>,
  originalWidth: number,
  originalHeight: number,
  scale: number,
  confidenceThreshold: number
): Detection[] {
  const detections: Detection[] = [];
  
  // YOLO11 的輸出格式：[batch, 84, 8400]
  // 前 4 個值是邊界框坐標，接下來是置信度和類別概率
  const output = outputs['output0'];
  
  if (!output.data || typeof output.data === 'string') {
    console.error('輸出數據格式不正確');
    return [];
  }
  
  const outputData = output.data as Float32Array;
  const modelInputSize = 640;
  const offsetX = (modelInputSize - originalWidth * scale) / 2;
  const offsetY = (modelInputSize - originalHeight * scale) / 2;
  
  // 遍歷所有檢測
  for (let i = 0; i < 8400; i++) {
    const confidence = outputData[4 * 8400 + i];
    
    if (confidence > confidenceThreshold) {
      // 提取邊界框坐標
      const centerX = outputData[0 * 8400 + i];
      const centerY = outputData[1 * 8400 + i];
      const width = outputData[2 * 8400 + i];
      const height = outputData[3 * 8400 + i];
      
      // 找到最高的類別概率
      let maxClassProb = 0;
      let maxClassId = 0;
      
      for (let classId = 0; classId < YOLO_CLASSES.length; classId++) {
        const classProb = outputData[(5 + classId) * 8400 + i];
        if (classProb > maxClassProb) {
          maxClassProb = classProb;
          maxClassId = classId;
        }
      }
      
      // 將坐標從模型空間轉換回原始圖像空間
      const x = (centerX - offsetX) / scale;
      const y = (centerY - offsetY) / scale;
      const w = width / scale;
      const h = height / scale;
      
      detections.push({
        class_id: maxClassId,
        class_name: YOLO_CLASSES[maxClassId],
        confidence: confidence * maxClassProb,
        x: Math.max(0, x - w / 2),
        y: Math.max(0, y - h / 2),
        width: w,
        height: h,
      });
    }
  }
  
  return detections;
}
