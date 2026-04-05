import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { MediaType } from "@/lib/media/MediaTypes";
import { SharpConfig } from "@/lib/media/SharpConfig";

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

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds the 4MB limit" },
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
          maxWidth: 1280,
          maxHeight: 1280,
          quality: 80,
        },
      );

      finalBuffer = processedMedia.buffer;
      finalFormat = processedMedia.format;
      finalWidth = processedMedia.width;
      finalHeight = processedMedia.height;
    }

    const ABLY_MAX_BYTES = 65536;
    if (
      mediaType === "image" &&
      finalBuffer.length > ABLY_MAX_BYTES &&
      finalFormat !== "gif"
    ) {
      try {
        let quality = 80;
        let maxW = finalWidth || 1280;
        let maxH = finalHeight || 1280;

        for (
          let attempt = 0;
          attempt < 6 && finalBuffer.length > ABLY_MAX_BYTES;
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

    const base64 = finalBuffer.toString("base64");
    const mimeType =
      mediaType === "image"
        ? `image/${finalFormat}`
        : mediaType === "video"
          ? `video/${finalFormat}`
          : file.type || `application/octet-stream`;

    let thumbnail;
    try {
      if (mediaType === "image") {
        const thumb = await SharpConfig.createThumbnail(finalBuffer, 150);
        thumbnail = `data:image/${thumb.format};base64,${thumb.buffer.toString(
          "base64",
        )}`;
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
        data: `data:${mimeType};base64,${base64}`,
        name: file.name,
        thumbnail,
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
