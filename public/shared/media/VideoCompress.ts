export type VideoCompressionOptions = {
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  maxAttempts?: number;
  targetBitrate?: number;
  minBitrate?: number;
  audioBitrate?: number;
  fps?: number;
  minWidth?: number;
  minHeight?: number;
};

type VideoMetadata = {
  width: number;
  height: number;
  duration: number;
};

type FFmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;

const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const SIZE_MARGIN_BYTES = 96 * 1024;
const DEFAULT_MAX_BYTES = SERVER_UPLOAD_MAX_BYTES;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_TARGET_BITRATE = 900_000;
const DEFAULT_MIN_BITRATE = 180_000;
const DEFAULT_AUDIO_BITRATE = 56_000;
const DEFAULT_FPS = 24;
const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_MIN_DIMENSION = 200;

let ffmpegPromise: Promise<FFmpegInstance> | null = null;

function isClientEnvironment(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

async function ensureFFmpeg(): Promise<FFmpegInstance> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const instance = new FFmpeg();
      if (!instance.loaded) {
        await instance.load();
      }
      return instance;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
}

function waitForEvent(target: EventTarget, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError as EventListener);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Event) => {
      cleanup();
      if (error instanceof ErrorEvent && error.error) {
        reject(error.error);
      } else {
        reject(new Error("Media error"));
      }
    };
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError as EventListener, { once: true });
  });
}

async function loadMetadata(file: File): Promise<VideoMetadata | null> {
  if (!isClientEnvironment()) return null;
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    await waitForEvent(video, "loadedmetadata");
    const width = video.videoWidth;
    const height = video.videoHeight;
    const duration = video.duration;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(duration)
    ) {
      return null;
    }
    return { width, height, duration };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function buildFileName(name: string, ext: string): string {
  const base = name.replace(/\.[^/.]+$/, "");
  return `${base}.${ext}`;
}

function ensureEvenDimension(value: number, minimum: number): number {
  const clamped = Math.max(minimum, Math.floor(value));
  const even = clamped - (clamped % 2);
  return even <= 0 ? minimum : even;
}

function uniqueName(prefix: string, extension: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${random}.${extension}`;
}

function estimateBitrate(
  duration: number,
  maxBytes: number,
  target: number,
  minimum: number
): number {
  const safeDuration = Math.max(duration, 0.1);
  const bySize = Math.floor((maxBytes * 8) / safeDuration);
  const capped = Math.min(target, bySize);
  return Math.max(minimum, capped);
}

async function transcodeWithFfmpeg(
  file: File,
  settings: {
    width: number;
    height: number;
    fps: number;
    videoBitsPerSecond: number;
    audioBitsPerSecond: number;
  }
): Promise<File | null> {
  const ffmpeg = await ensureFFmpeg();
  const inputExt = file.name.includes(".")
    ? file.name.split(".").pop() || "mp4"
    : "mp4";
  const inputName = uniqueName("input", inputExt);
  const outputName = uniqueName("output", "webm");
  try {
    const fileBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(fileBuffer);
    await ffmpeg.writeFile(inputName, fileData);
    const filter = `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease,setsar=1`;
    const command = [
      "-i",
      inputName,
      "-vf",
      filter,
      "-r",
      `${settings.fps}`,
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      `${settings.videoBitsPerSecond}`,
      "-maxrate",
      `${settings.videoBitsPerSecond}`,
      "-bufsize",
      `${settings.videoBitsPerSecond * 2}`,
      "-c:a",
      "libopus",
      "-b:a",
      `${settings.audioBitsPerSecond}`,
      outputName,
    ];
    const exitCode = await ffmpeg.exec(command);
    if (exitCode !== 0) {
      return null;
    }
    const data = await ffmpeg.readFile(outputName);
    const bytes =
      data instanceof Uint8Array
        ? data
        : new TextEncoder().encode(String(data));
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);
    const output = new File([arrayBuffer], buildFileName(file.name, "webm"), {
      type: "video/webm",
    });
    return output;
  } catch {
    return null;
  } finally {
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {}
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {}
  }
}

export async function compressVideoFile(
  file: File,
  options: VideoCompressionOptions = {}
): Promise<File> {
  if (!isClientEnvironment()) return file;
  if (!file.type.startsWith("video/")) return file;
  const metadata = await loadMetadata(file);
  if (!metadata) return file;
  const requestedBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const uploadLimit = Math.min(requestedBytes, SERVER_UPLOAD_MAX_BYTES);
  const maxBytes = Math.max(256 * 1024, uploadLimit - SIZE_MARGIN_BYTES);
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_DIMENSION;
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_DIMENSION;
  const minWidth = options.minWidth ?? DEFAULT_MIN_DIMENSION;
  const minHeight = options.minHeight ?? DEFAULT_MIN_DIMENSION;
  const minBitrate = options.minBitrate ?? DEFAULT_MIN_BITRATE;
  const audioBitrate = options.audioBitrate ?? DEFAULT_AUDIO_BITRATE;
  const fps = options.fps ?? DEFAULT_FPS;
  let targetBitrate = estimateBitrate(
    metadata.duration,
    maxBytes,
    options.targetBitrate ?? DEFAULT_TARGET_BITRATE,
    minBitrate
  );
  let width = Math.min(metadata.width, maxWidth);
  let height = Math.min(metadata.height, maxHeight);
  let bestFile: File = file;
  let bestSize = file.size;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const scaledWidth = ensureEvenDimension(width, minWidth);
    const scaledHeight = ensureEvenDimension(height, minHeight);
    const result = await transcodeWithFfmpeg(file, {
      width: scaledWidth,
      height: scaledHeight,
      fps,
      videoBitsPerSecond: targetBitrate,
      audioBitsPerSecond: audioBitrate,
    });
    if (!result) {
      break;
    }
    if (result.size < bestSize) {
      bestFile = result;
      bestSize = result.size;
    }
    if (result.size <= maxBytes) {
      return result;
    }
    width = Math.max(minWidth, Math.floor(width * 0.7));
    height = Math.max(minHeight, Math.floor(height * 0.7));
    targetBitrate = Math.max(minBitrate, Math.floor(targetBitrate * 0.6));
    if (attempt >= 2) {
      targetBitrate = Math.max(minBitrate, Math.floor(targetBitrate * 0.8));
    }
  }
  return bestFile;
}
