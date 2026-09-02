import type { InferenceSession, Tensor } from 'onnxruntime-web';

const DEFAULT_MODEL_SIZE = 640;
const MODEL_PATH = '/models/yolo11n.onnx';
const MAX_CANDIDATES_BEFORE_NMS = 300;
const IOU_THRESHOLD = 0.45;

export const YOLO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
  'toothbrush',
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

type ImageSource = HTMLCanvasElement | HTMLVideoElement | HTMLImageElement;

let ortRuntime: typeof import('onnxruntime-web') | null = null;
let model: InferenceSession | null = null;
let modelPromise: Promise<void> | null = null;
let preprocessingCanvas: HTMLCanvasElement | null = null;
let inputBuffer: Float32Array | null = null;

export async function loadModel(): Promise<void> {
  if (model) return;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    // Loading this bundle during SSR makes its browser-relative WASM URL invalid.
    // loadModel is called from a client effect, so keep the runtime browser-only.
    const ort = (ortRuntime ??= await import('onnxruntime-web/webgpu'));
    // Multi-threaded WASM needs cross-origin isolation. WebGPU remains the fast path.
    ort.env.wasm.numThreads = globalThis.crossOriginIsolated
      ? Math.min(navigator.hardwareConcurrency || 4, 4)
      : 1;

    const executionProviders: InferenceSession.ExecutionProviderConfig[] =
      'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm'];

    model = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders,
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
      enableMemPattern: true,
    });
  })();

  try {
    await modelPromise;
  } catch (error) {
    model = null;
    modelPromise = null;
    throw error;
  }
}

function getSourceSize(source: ImageSource) {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function preprocessImage(source: ImageSource, inputSize: number) {
  const { width: originalWidth, height: originalHeight } = getSourceSize(source);
  if (!originalWidth || !originalHeight) {
    throw new Error('影像尚未準備完成');
  }

  if (!preprocessingCanvas) {
    preprocessingCanvas = document.createElement('canvas');
  }
  if (preprocessingCanvas.width !== inputSize || preprocessingCanvas.height !== inputSize) {
    preprocessingCanvas.width = inputSize;
    preprocessingCanvas.height = inputSize;
  }

  const ctx = preprocessingCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('無法建立影像處理畫布');

  const scale = Math.min(inputSize / originalWidth, inputSize / originalHeight);
  const scaledWidth = Math.round(originalWidth * scale);
  const scaledHeight = Math.round(originalHeight * scale);
  const offsetX = (inputSize - scaledWidth) / 2;
  const offsetY = (inputSize - scaledHeight) / 2;

  // Ultralytics letterbox uses RGB(114, 114, 114), not a blue CSS hex colour.
  ctx.fillStyle = 'rgb(114, 114, 114)';
  ctx.fillRect(0, 0, inputSize, inputSize);
  ctx.drawImage(source, offsetX, offsetY, scaledWidth, scaledHeight);

  const rgba = ctx.getImageData(0, 0, inputSize, inputSize).data;
  const planeSize = inputSize * inputSize;
  if (!inputBuffer || inputBuffer.length !== 3 * planeSize) {
    inputBuffer = new Float32Array(3 * planeSize);
  }

  for (let pixel = 0, rgbaIndex = 0; pixel < planeSize; pixel++, rgbaIndex += 4) {
    inputBuffer[pixel] = rgba[rgbaIndex] / 255;
    inputBuffer[planeSize + pixel] = rgba[rgbaIndex + 1] / 255;
    inputBuffer[2 * planeSize + pixel] = rgba[rgbaIndex + 2] / 255;
  }

  return { data: inputBuffer, originalWidth, originalHeight, scale, offsetX, offsetY };
}

export async function detectObjects(
  source: ImageSource,
  confidenceThreshold = 0.3,
  inputSize = DEFAULT_MODEL_SIZE,
): Promise<Detection[]> {
  if (!model) await loadModel();
  if (inputSize < 320 || inputSize > 640 || inputSize % 32 !== 0) {
    throw new Error('模型輸入尺寸必須是 320 至 640 之間的 32 倍數');
  }

  const preprocessing = preprocessImage(source, inputSize);
  const ort = ortRuntime!;
  const inputTensor = new ort.Tensor('float32', preprocessing.data, [1, 3, inputSize, inputSize]);
  const outputs = await model!.run({ images: inputTensor });
  const output = outputs[model!.outputNames[0]];

  return postprocessOutput(output, preprocessing, confidenceThreshold);
}

function postprocessOutput(
  output: Tensor,
  dimensions: {
    originalWidth: number;
    originalHeight: number;
    scale: number;
    offsetX: number;
    offsetY: number;
  },
  confidenceThreshold: number,
) {
  if (!output || typeof output.data === 'string' || output.dims.length !== 3) {
    throw new Error('模型輸出格式不正確');
  }

  const data = output.data as Float32Array;
  const rowsFirst = output.dims[1] <= output.dims[2];
  const attributeCount = Number(rowsFirst ? output.dims[1] : output.dims[2]);
  const predictionCount = Number(rowsFirst ? output.dims[2] : output.dims[1]);
  const classCount = Math.min(attributeCount - 4, YOLO_CLASSES.length);

  if (classCount <= 0) throw new Error(`不支援的模型輸出形狀：${output.dims.join(' × ')}`);

  const valueAt = rowsFirst
    ? (prediction: number, attribute: number) => data[attribute * predictionCount + prediction]
    : (prediction: number, attribute: number) => data[prediction * attributeCount + attribute];

  const candidates: Detection[] = [];
  const { originalWidth, originalHeight, scale, offsetX, offsetY } = dimensions;

  for (let prediction = 0; prediction < predictionCount; prediction++) {
    // YOLO11 output is [x, y, w, h, class0 ... class79]. It has no objectness row.
    let classId = 0;
    let confidence = valueAt(prediction, 4);
    for (let classIndex = 1; classIndex < classCount; classIndex++) {
      const probability = valueAt(prediction, 4 + classIndex);
      if (probability > confidence) {
        confidence = probability;
        classId = classIndex;
      }
    }

    if (confidence < confidenceThreshold) continue;

    const centerX = (valueAt(prediction, 0) - offsetX) / scale;
    const centerY = (valueAt(prediction, 1) - offsetY) / scale;
    const boxWidth = valueAt(prediction, 2) / scale;
    const boxHeight = valueAt(prediction, 3) / scale;
    const left = Math.max(0, centerX - boxWidth / 2);
    const top = Math.max(0, centerY - boxHeight / 2);
    const right = Math.min(originalWidth, centerX + boxWidth / 2);
    const bottom = Math.min(originalHeight, centerY + boxHeight / 2);

    if (right <= left || bottom <= top) continue;

    candidates.push({
      class_id: classId,
      class_name: YOLO_CLASSES[classId],
      confidence,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return nonMaximumSuppression(candidates.slice(0, MAX_CANDIDATES_BEFORE_NMS));
}

function nonMaximumSuppression(candidates: Detection[]) {
  const selected: Detection[] = [];

  for (const candidate of candidates) {
    const overlapsSelectedBox = selected.some(
      (selectedBox) =>
        selectedBox.class_id === candidate.class_id &&
        intersectionOverUnion(candidate, selectedBox) > IOU_THRESHOLD,
    );
    if (!overlapsSelectedBox) selected.push(candidate);
  }

  return selected;
}

function intersectionOverUnion(a: Detection, b: Detection) {
  const intersectionLeft = Math.max(a.x, b.x);
  const intersectionTop = Math.max(a.y, b.y);
  const intersectionRight = Math.min(a.x + a.width, b.x + b.width);
  const intersectionBottom = Math.min(a.y + a.height, b.y + b.height);
  const intersectionWidth = Math.max(0, intersectionRight - intersectionLeft);
  const intersectionHeight = Math.max(0, intersectionBottom - intersectionTop);
  const intersectionArea = intersectionWidth * intersectionHeight;
  const unionArea = a.width * a.height + b.width * b.height - intersectionArea;
  return unionArea > 0 ? intersectionArea / unionArea : 0;
}
