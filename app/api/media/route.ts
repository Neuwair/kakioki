import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { MediaType } from "@/lib/media/MediaTypes";
import { SharpConfig } from "@/lib/media/SharpConfig";
import {
  KAKIOKI_CONFIG,
  getMediaUploadLimitLabel,
  getMediaUploadMaxBytes,
} from "@/lib/config/KakiokiConfig";
import { MediaRepository } from "@/lib/repository/MediaRepository";

const MEDIA_ROUTE_PROCESSING_CONFIG = KAKIOKI_CONFIG.mediaRouteProcessing;

function buildStoredFileName(
  fileName: string,
  format: string | undefined,
): string {
  const baseName = fileName.replace(/\.[^/.]+$/, "") || "upload";
  const extension = (
    format ||
    fileName.split(".").pop() ||
    "bin"
  ).toLowerCase();
  return `${baseName}.${extension}`;
}

function buildThumbnailFileName(
  fileName: string,
  format: string | undefined,
): string {
  const baseName = fileName.replace(/\.[^/.]+$/, "") || "upload";
  const extension = (format || "jpg").toLowerCase();
  return `${baseName}-thumbnail.${extension}`;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mediaType: MediaType =
      (formData.get("mediaType") as MediaType | null) ||
      (file?.type.startsWith("image/")
        ? "image"
        : file?.type.startsWith("video/")
          ? "video"
          : "file");

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const maxUploadBytes = getMediaUploadMaxBytes(mediaType);

    if (file.size > maxUploadBytes) {
      return NextResponse.json(
        {
          error: `File size exceeds the ${getMediaUploadLimitLabel(mediaType)} ${mediaType} limit`,
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let finalBuffer: Buffer;
    let finalFormat: string | undefined;
    let finalWidth: number | undefined;
    let finalHeight: number | undefined;

    const isGif =
      file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

    if (isGif && mediaType === "image") {
      finalBuffer = buffer;
      try {
        const info = await SharpConfig.getImageInfo(buffer);
        finalFormat = info.format || "gif";
        finalWidth = info.width;
        finalHeight = info.height;
      } catch (err) {
        console.error("Failed to read GIF metadata:", err);
        finalFormat = "gif";
      }
    } else {
      const processedMedia = await SharpConfig.processMedia(
        buffer,
        mediaType,
        file.name,
        {
          maxWidth: MEDIA_ROUTE_PROCESSING_CONFIG.maxWidth,
          maxHeight: MEDIA_ROUTE_PROCESSING_CONFIG.maxHeight,
          quality: MEDIA_ROUTE_PROCESSING_CONFIG.quality,
        },
      );

      finalBuffer = processedMedia.buffer;
      finalFormat = processedMedia.format;
      finalWidth = processedMedia.width;
      finalHeight = processedMedia.height;
    }

    const ablyMaxBytes = KAKIOKI_CONFIG.transport.maxAblyPayloadBytes;
    if (
      mediaType === "image" &&
      finalBuffer.length > ablyMaxBytes &&
      finalFormat !== "gif"
    ) {
      try {
        let quality: number = MEDIA_ROUTE_PROCESSING_CONFIG.quality;
        let maxW: number = finalWidth || MEDIA_ROUTE_PROCESSING_CONFIG.maxWidth;
        let maxH: number =
          finalHeight || MEDIA_ROUTE_PROCESSING_CONFIG.maxHeight;

        for (
          let attempt = 0;
          attempt < 6 && finalBuffer.length > ablyMaxBytes;
          attempt++
        ) {
          quality = Math.max(30, Math.floor(quality * 0.75));
          maxW = Math.max(200, Math.floor(maxW * 0.75));
          maxH = Math.max(200, Math.floor(maxH * 0.75));

          const format =
            finalFormat === "png" ||
            finalFormat === "webp" ||
            finalFormat === "jpeg"
              ? (finalFormat as "png" | "webp" | "jpeg")
              : "jpeg";

          const result = await SharpConfig.processImage(finalBuffer, {
            maxWidth: maxW,
            maxHeight: maxH,
            quality,
            format,
          });

          finalBuffer = result.buffer;
          finalFormat = result.format;
          finalWidth = result.width;
          finalHeight = result.height;
        }
      } catch (err) {
        console.error("Error while compressing image to fit Ably limit:", err);
      }
    }

    const mimeType =
      mediaType === "image"
        ? `image/${finalFormat}`
        : file.type || `application/octet-stream`;

    const mediaRepo = new MediaRepository();
    const mainAsset = await mediaRepo.create({
      owner_id: authResult.user.id,
      is_public: false,
      content_type: mimeType,
      file_name: buildStoredFileName(file.name, finalFormat),
      data: finalBuffer,
    });

    const mediaUrl = `/api/media/asset/${mainAsset.id}`;

    let thumbnail: string | null = null;
    try {
      if (mediaType === "image") {
        const thumb = await SharpConfig.createThumbnail(
          finalBuffer,
          KAKIOKI_CONFIG.imageProcessing.thumbnailSize,
        );
        const thumbAsset = await mediaRepo.create({
          owner_id: authResult.user.id,
          is_public: false,
          content_type: thumb.mime || `image/${thumb.format}`,
          file_name: buildThumbnailFileName(file.name, thumb.format),
          data: thumb.buffer,
        });
        thumbnail = `/api/media/asset/${thumbAsset.id}`;
      }
    } catch (err) {
      console.error("Failed to create thumbnail:", err);
      thumbnail = null;
    }

    return NextResponse.json({
      success: true,
      file: {
        type: mediaType,
        format: finalFormat,
        width: finalWidth,
        height: finalHeight,
        size: finalBuffer.length,
        encrypted: false,
        url: mediaUrl,
        name: file.name,
        thumbnail: thumbnail ?? null,
      },
    });
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}
