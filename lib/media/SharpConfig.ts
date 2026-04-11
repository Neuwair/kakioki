import sharp from "sharp";
import os from "os";
import { Readable } from "stream";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import {
  ImageProcessingOptions,
  ProcessedImage,
  ImageFormat,
  MediaType,
  MediaProcessingOptions,
  ProcessedMediaResult,
  DEFAULT_MAX_BYTES,
  MIN_ACCEPTED_BYTES,
  MAX_DIMENSION,
  clampQuality,
  formatToMime,
  formatFileSize,
  isValidImageType,
  getImageExtension,
} from "./MediaTypes";
import { uploadBufferToExternalStorage } from "@/lib/server/MediaStorage";

const IMAGE_PROCESSING_CONFIG = KAKIOKI_CONFIG.imageProcessing;
const MEDIA_ROUTE_PROCESSING_CONFIG = KAKIOKI_CONFIG.mediaRouteProcessing;

try {
  const cpus = os.cpus()?.length || 1;
  sharp.concurrency(Math.max(1, Math.floor(cpus / 2)));
} catch {
  try {
    sharp.concurrency(1);
  } catch {}
}
try {
  sharp.cache(false);
} catch {}

export class SharpConfig {
  static async processMedia(
    buffer: Buffer,
    mediaType: MediaType,
    fileName: string,
    options: MediaProcessingOptions = {},
  ): Promise<ProcessedMediaResult> {
    const {
      maxWidth = MEDIA_ROUTE_PROCESSING_CONFIG.maxWidth,
      maxHeight = MEDIA_ROUTE_PROCESSING_CONFIG.maxHeight,
      quality = MEDIA_ROUTE_PROCESSING_CONFIG.quality,
    } = options;

    if (mediaType === "image") {
      return this.processMediaImage(buffer, fileName, {
        maxWidth,
        maxHeight,
        quality,
      });
    }

    if (mediaType === "video") {
      return this.processVideo(buffer, fileName, {
        maxWidth,
        maxHeight,
        quality,
      });
    }

    if (mediaType === "file") {
      return this.processFile(buffer, fileName);
    }

    throw new Error(`Unsupported media type: ${mediaType}`);
  }

  static async processImage(
    inputBuffer: Buffer,
    options: ImageProcessingOptions = {},
  ): Promise<ProcessedImage> {
    if (
      !inputBuffer ||
      !(inputBuffer instanceof Buffer) ||
      inputBuffer.length === 0
    ) {
      throw new Error("Invalid image buffer: buffer is empty");
    }

    if (inputBuffer.length < MIN_ACCEPTED_BYTES) {
      throw new Error("Image buffer too small or corrupted");
    }

    if (inputBuffer.length > DEFAULT_MAX_BYTES) {
      throw new Error("Image buffer exceeds maximum allowed size");
    }

    const {
      maxWidth = IMAGE_PROCESSING_CONFIG.maxWidth,
      maxHeight = IMAGE_PROCESSING_CONFIG.maxHeight,
      quality = IMAGE_PROCESSING_CONFIG.quality,
      format = IMAGE_PROCESSING_CONFIG.defaultFormat,
      fit = IMAGE_PROCESSING_CONFIG.defaultFit,
      withoutEnlargement = true,
      rotate = true,
    } = options;

    const q = clampQuality(quality);

    try {
      let pipeline = sharp(inputBuffer);

      if (rotate) {
        pipeline = pipeline.rotate();
      }

      const metadata = await pipeline.metadata();

      const width = metadata.width || 0;
      const height = metadata.height || 0;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error("Image dimensions exceed maximum allowed limits");
      }

      if (width > maxWidth || height > maxHeight) {
        pipeline = pipeline.resize(maxWidth, maxHeight, {
          fit,
          withoutEnlargement,
        });
      }

      pipeline = pipeline.toFormat(format, { quality: q });

      const processedBuffer: Buffer = await pipeline.toBuffer();

      const processedMetadata = await sharp(processedBuffer).metadata();

      return {
        buffer: processedBuffer,
        format: processedMetadata.format || format,
        mime: formatToMime(processedMetadata.format),
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0,
        size: processedBuffer.length,
        exif: processedMetadata.exif,
        orientation: processedMetadata.orientation,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Image processing failed (format=${options.format}, max=${options.maxWidth}x${options.maxHeight}): ${msg}`,
      );
    }
  }

  static async createThumbnail(
    inputBuffer: Buffer,
    size: number = IMAGE_PROCESSING_CONFIG.thumbnailSize,
    outFormat: ImageFormat = "jpeg",
    quality: number = IMAGE_PROCESSING_CONFIG.quality,
  ): Promise<ProcessedImage> {
    if (!inputBuffer || inputBuffer.length === 0) {
      throw new Error("Invalid image buffer: buffer is empty");
    }

    try {
      const pipeline = sharp(inputBuffer)
        .rotate()
        .resize(size, size, {
          fit: "cover",
          position: "center",
        })
        .withMetadata()
        .toFormat(outFormat, { quality: clampQuality(quality) });

      const processedBuffer = await pipeline.toBuffer();

      const metadata = await sharp(processedBuffer).metadata();

      return {
        buffer: processedBuffer,
        format: metadata.format || outFormat,
        mime: formatToMime(metadata.format),
        width: metadata.width || size,
        height: metadata.height || size,
        size: processedBuffer.length,
        exif: metadata.exif,
        orientation: metadata.orientation,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Thumbnail creation failed: ${msg}`);
    }
  }

  static async validateImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      return !!(metadata.width && metadata.height && metadata.format);
    } catch {
      return false;
    }
  }

  static async getImageInfo(buffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    mime: string;
    size: number;
  }> {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || "unknown",
        mime: formatToMime(metadata.format),
        size: buffer.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to get image info: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  static formatFileSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  static isValidImageType(mimeType: string): boolean {
    return isValidImageType(mimeType);
  }

  static getImageExtension(mimeType: string): string {
    return getImageExtension(mimeType);
  }

  static async processImageFromStream(
    stream: Readable,
    options: ImageProcessingOptions = {},
  ): Promise<ProcessedImage> {
    const {
      maxWidth = IMAGE_PROCESSING_CONFIG.maxWidth,
      maxHeight = IMAGE_PROCESSING_CONFIG.maxHeight,
      quality = IMAGE_PROCESSING_CONFIG.quality,
      format = IMAGE_PROCESSING_CONFIG.defaultFormat,
      fit = IMAGE_PROCESSING_CONFIG.defaultFit,
      withoutEnlargement = true,
      rotate = true,
    } = options;
    const resultBuffer: Buffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      stream.on("data", (chunk) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;
        if (total > DEFAULT_MAX_BYTES) {
          stream.destroy();
          return reject(new Error("Image stream exceeds maximum allowed size"));
        }
        chunks.push(buf);
      });
      stream.on("end", async () => {
        try {
          const input = Buffer.concat(chunks);
          let s = sharp(input);
          if (rotate) s = s.rotate();
          const out = await s
            .resize(maxWidth, maxHeight, { fit, withoutEnlargement })
            .toFormat(format, { quality: clampQuality(quality) })
            .toBuffer();
          resolve(out);
        } catch (err) {
          reject(err);
        }
      });
      stream.on("error", (err) => reject(err));
    });

    return this.processImage(resultBuffer, options);
  }

  static async handleJob(data: {
    buffer: Buffer | string;
    mediaType: MediaType;
    name: string;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    messageId?: number | string;
    userId?: number | string;
  }): Promise<{
    publicUrl: string | null;
    processed: ProcessedMediaResult | null;
  }> {
    const arrBuffer =
      typeof data.buffer === "string"
        ? Buffer.from(data.buffer, "base64")
        : data.buffer;

    const processed = await this.processMedia(
      arrBuffer,
      data.mediaType,
      data.name,
      {
        maxWidth: data.maxWidth,
        maxHeight: data.maxHeight,
        quality: data.quality,
      },
    );

    console.log("Processed media job", {
      name: data.name,
      size: processed.buffer.length,
      format: processed.format,
    });

    let publicUrl: string | null = null;

    try {
      publicUrl = await uploadBufferToExternalStorage(processed.buffer, {
        contentType: "application/octet-stream",
        fileName: data.name,
      });
    } catch (err) {
      console.error("Error uploading to storage:", err);
    }

    try {
      const req = eval("require") as (name: string) => unknown;
      type RepoModule = {
        UserRepository?: unknown;
      };
      type RepoCtor = new () => {
        update: (id: number, data: Record<string, unknown>) => Promise<unknown>;
      };
      const repoMod = req("@/lib") as RepoModule;
      if (data.userId && publicUrl && repoMod && "UserRepository" in repoMod) {
        const UserRepository = repoMod.UserRepository as RepoCtor;
        const userRepo = new UserRepository();
        await userRepo.update(Number(data.userId), { avatar_url: publicUrl });
      }
    } catch (err) {
      console.error("Failed to update DB after media processing:", err);
    }

    return { publicUrl, processed };
  }

  private static async processMediaImage(
    buffer: Buffer,
    fileName: string,
    options: MediaProcessingOptions,
  ): Promise<ProcessedMediaResult> {
    try {
      const isGif = fileName.toLowerCase().endsWith(".gif");

      if (isGif) {
        try {
          const info = await this.getImageInfo(buffer);
          return {
            buffer,
            format: info.format || "gif",
            width: info.width,
            height: info.height,
          };
        } catch (err) {
          console.error("Failed to read GIF metadata:", err);
          return {
            buffer,
            format: "gif",
            width: undefined,
            height: undefined,
          };
        }
      }

      const format = fileName.toLowerCase().endsWith(".png") ? "png" : "webp";
      const processed = await this.processImage(buffer, {
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        quality: options.quality,
        format,
        fit: "inside",
        withoutEnlargement: true,
      });

      return {
        buffer: processed.buffer,
        format: processed.format,
        width: processed.width,
        height: processed.height,
      };
    } catch (error) {
      console.error("Image processing error:", error);
      throw new Error(
        `Failed to process image: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  private static async processVideo(
    buffer: Buffer,
    fileName: string,
    options: MediaProcessingOptions,
  ): Promise<ProcessedMediaResult> {
    try {
      const format = this.getVideoFormat(fileName);

      return {
        buffer,
        format,
        width: options.maxWidth,
        height: options.maxHeight,
      };
    } catch (error) {
      console.error("Video processing error:", error);
      throw new Error(
        `Failed to process video: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  private static async processFile(
    buffer: Buffer,
    fileName: string,
  ): Promise<ProcessedMediaResult> {
    const ext = fileName.toLowerCase().split(".").pop() || "";
    return {
      buffer,
      format: ext,
      width: undefined,
      height: undefined,
    };
  }

  private static getVideoFormat(fileName: string): string {
    const ext = fileName.toLowerCase().split(".").pop() || "mp4";
    const validFormats = ["mp4", "webm", "ogg", "mov"];
    return validFormats.includes(ext) ? ext : "mp4";
  }
}

export default SharpConfig;
