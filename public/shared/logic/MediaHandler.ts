import type { MediaPreview, ProcessedMedia } from "@/lib/media/MediaTypes";
import {
  KAKIOKI_CONFIG,
  getMediaUploadLimitLabel,
  getMediaUploadMaxBytes,
} from "@/lib/config/KakiokiConfig";
import { resizeWithWorkerFallback } from "@/public/shared/media/SharpResize";
import { compressVideoFile } from "@/public/shared/media/VideoCompress";
import { getAuthToken } from "@/public/shared/helpers/AuthHelpers";

type UploadResult = {
  success: boolean;
  url?: string;
  data?: string;
  error?: string;
  file?: {
    url?: string;
    data?: string;
    type?: string;
    size?: number;
    format?: string;
  };
};

const MEDIA_PREVIEW_CONFIG = KAKIOKI_CONFIG.mediaPreview;
const MEDIA_PREVIEW_DIMENSIONS = {
  maxWidth: MEDIA_PREVIEW_CONFIG.maxWidth,
  maxHeight: MEDIA_PREVIEW_CONFIG.maxHeight,
};
const MEDIA_PREVIEW_IMAGE_OPTIONS = {
  ...MEDIA_PREVIEW_DIMENSIONS,
  quality: MEDIA_PREVIEW_CONFIG.quality,
};
const SKIPPED_MEDIA_INCREMENT = MEDIA_PREVIEW_CONFIG.skippedCountIncrement;

export type UploadedMediaItem = {
  url: string;
  type: "image" | "video" | "file";
  encrypted?: boolean;
  format?: string;
  size?: number;
  width?: number;
  height?: number;
  thumbnail?: string | null;
  name?: string;
};

const getMaxBytesForType = (
  type: UploadedMediaItem["type"],
  maxBytes?: number,
): number => {
  return maxBytes ?? getMediaUploadMaxBytes(type);
};

const getLimitExceededMessage = (
  type: UploadedMediaItem["type"],
  suffix = "",
): string => {
  const label = type === "file" ? "File" : type === "image" ? "Image" : "Video";
  return `${label} exceeds the ${getMediaUploadLimitLabel(type)} limit${suffix}`;
};

export async function processMediaPreviews(
  mediaPreviews: MediaPreview[],
  maxBytes?: number,
): Promise<{ processed: ProcessedMedia[]; skipped: number }> {
  const processed: ProcessedMedia[] = [];
  let skipped = 0;

  for (const preview of mediaPreviews) {
    let fileToUpload = preview.file;
    const maxBytesForType = getMaxBytesForType(preview.type, maxBytes);

    if (preview.type === "image" && fileToUpload.size >= maxBytesForType) {
      fileToUpload = await resizeWithWorkerFallback(
        fileToUpload,
        maxBytesForType,
        MEDIA_PREVIEW_IMAGE_OPTIONS,
      );
    }

    if (preview.type === "video") {
      fileToUpload = await compressVideoFile(fileToUpload, {
        maxBytes: maxBytesForType,
        ...MEDIA_PREVIEW_DIMENSIONS,
      });
    }

    if (fileToUpload.size > maxBytesForType) {
      skipped += SKIPPED_MEDIA_INCREMENT;
      continue;
    }

    processed.push({ file: fileToUpload, type: preview.type });
  }

  return { processed, skipped };
}

export async function uploadProcessedMedia(
  processed: ProcessedMedia[],
): Promise<UploadedMediaItem[]> {
  const mediaItems: UploadedMediaItem[] = [];

  for (const p of processed) {
    const formData = new FormData();
    formData.append("file", p.file);
    formData.append("mediaType", p.type);

    const result = (await uploadFile(formData)) as UploadResult;

    if (result && result.file && (result.file.url || result.file.data)) {
      const fileObj = result.file;
      mediaItems.push({
        url: fileObj.url || fileObj.data || "",
        type: (fileObj.type as "image" | "video" | "file") || p.type,
        size: fileObj.size,
        encrypted: false,
        format: fileObj.format,
        width: (fileObj as { width?: number }).width,
        height: (fileObj as { height?: number }).height,
        thumbnail: (fileObj as { thumbnail?: string | null }).thumbnail ?? null,
        name: (fileObj as { name?: string }).name,
      });
    } else {
      mediaItems.push({
        url: result?.data || "",
        type: p.type,
        thumbnail: null,
      });
    }
  }

  return mediaItems;
}

export async function uploadFile(formData: FormData): Promise<UploadResult> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch("/api/media", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.statusText} ${errorText}`);
  }

  const result = await response.json();
  return result;
}

export async function prepareUploadAndSendMedia(
  mediaPreviews: MediaPreview[],
  maxBytes?: number,
): Promise<{ uploaded: UploadedMediaItem[]; failedCount: number }> {
  if (!mediaPreviews || mediaPreviews.length === 0) {
    return { uploaded: [], failedCount: 0 };
  }

  const { processed, skipped } = await processMediaPreviews(
    mediaPreviews,
    maxBytes,
  );

  if (processed.length === 0) {
    return { uploaded: [], failedCount: skipped };
  }

  const uploaded = await uploadProcessedMedia(processed);

  const successful = uploaded.filter((m) => !!m.url);
  const failedCount = skipped + (uploaded.length - successful.length);

  return { uploaded: successful, failedCount };
}

export async function processMediaForMessage(
  mediaPreviews: MediaPreview[],
): Promise<UploadedMediaItem[]> {
  if (mediaPreviews.length === 0) return [];

  try {
    const { processed, skipped } = await processMediaPreviews(mediaPreviews);
    if (skipped > 0) {
      console.warn(
        "Media files were skipped because they exceeded the size limit",
      );
    }
    if (processed.length === 0) return [];
    return await uploadProcessedMedia(processed);
  } catch (error) {
    console.error("Error processing media:", error);
    throw error;
  }
}

export const handleMediaSelectInput = async (
  event: React.ChangeEvent<HTMLInputElement>,
  mediaPreviews: MediaPreview[],
  setMediaPreviews: React.Dispatch<React.SetStateAction<MediaPreview[]>>,
) => {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  if (mediaPreviews.length + files.length > 4) {
    return;
  }

  try {
    const processedPreviews: MediaPreview[] = [];

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const isDocument = isDocumentType(file.type);

      if (!isImage && !isVideo && !isDocument) {
        console.warn("Skipping unsupported file type:", file.type);
        continue;
      }

      const type = isImage
        ? ("image" as const)
        : isVideo
          ? ("video" as const)
          : ("file" as const);
      const maxBytesForType = getMaxBytesForType(type);

      let finalFile: File = file;
      if (type === "image") {
        try {
          finalFile = await resizeWithWorkerFallback(
            file,
            maxBytesForType,
            MEDIA_PREVIEW_IMAGE_OPTIONS,
          );
        } catch (err) {
          console.warn(
            "Worker resize failed, falling back to original file",
            err,
          );
          finalFile = file;
        }
      } else if (type === "video") {
        try {
          const compressed = await compressVideoFile(file, {
            maxBytes: maxBytesForType,
            ...MEDIA_PREVIEW_DIMENSIONS,
          });
          finalFile = compressed;
        } catch (err) {
          console.warn("Video compression failed, using original video", err);
          finalFile = file;
        }
      }

      if (finalFile.size > maxBytesForType) {
        alert(getLimitExceededMessage(type, " even after processing"));
        continue;
      }

      const previewUrl = URL.createObjectURL(finalFile);

      processedPreviews.push({ file: finalFile, previewUrl, type });
    }

    setMediaPreviews((prev) => [...prev, ...processedPreviews]);
  } catch (error) {
    console.error("Error creating preview:", error);
    alert("Error creating preview");
  }
};

export const handleMediaSelectFiles = async (
  files: FileList | null,
  currentPreviews: MediaPreview[],
  onPreviewsChange: (previews: MediaPreview[]) => void,
  inputRef: React.RefObject<HTMLInputElement>,
) => {
  const fileArray = Array.from(files || []);
  if (fileArray.length === 0) return;

  if (currentPreviews.length + fileArray.length > 4) {
    return;
  }

  try {
    const validPreviews: MediaPreview[] = [];

    for (const file of fileArray) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const isDocument = isDocumentType(file.type);

      if (!isImage && !isVideo && !isDocument) {
        throw new Error("Only images, videos, and documents are allowed");
      }

      const type = isImage
        ? ("image" as const)
        : isVideo
          ? ("video" as const)
          : ("file" as const);
      const maxBytesForType = getMaxBytesForType(type);

      let finalFile: File = file;
      if (type === "image") {
        try {
          finalFile = await resizeWithWorkerFallback(
            file,
            maxBytesForType,
            MEDIA_PREVIEW_IMAGE_OPTIONS,
          );
        } catch (err) {
          console.warn(
            "Worker resize failed, falling back to original file",
            err,
          );
          finalFile = file;
        }
      } else if (type === "video") {
        try {
          finalFile = await compressVideoFile(file, {
            maxBytes: maxBytesForType,
            ...MEDIA_PREVIEW_DIMENSIONS,
          });
        } catch (err) {
          console.warn("Video compression failed, using original video", err);
          finalFile = file;
        }
      }

      if (finalFile.size > maxBytesForType) {
        alert(getLimitExceededMessage(type, " even after processing"));
        continue;
      }

      const previewUrl = URL.createObjectURL(finalFile);

      validPreviews.push({
        file: finalFile,
        previewUrl,
        type,
      });
    }

    if (validPreviews.length === 0) {
      return;
    }

    onPreviewsChange([...currentPreviews, ...validPreviews]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  } catch (error) {
    console.error("Error creating preview:", error);
    alert("Error creating preview");
  }
};

export const removeMediaPreview = (
  index: number,
  previews: MediaPreview[],
  onPreviewsChange: (previews: MediaPreview[]) => void,
) => {
  const newPreviews = [...previews];
  URL.revokeObjectURL(newPreviews[index].previewUrl);
  newPreviews.splice(index, 1);
  onPreviewsChange(newPreviews);
};

export const handleSendWithMedia = async (
  previews: MediaPreview[],
  messageInput: string,
  onMessageSend: (content: string, media: UploadedMediaItem[]) => void,
  onPreviewsChange: (previews: MediaPreview[]) => void,
) => {
  if (previews.length === 0) return;

  try {
    const { processed, skipped } = await processMediaPreviews(previews);
    if (processed.length === 0) {
      if (skipped > 0) {
        alert(
          "Media files were skipped because they exceeded their size limits",
        );
      }
      return;
    }
    if (skipped > 0) {
      alert(
        "Some media files were skipped because they exceeded their size limits",
      );
    }
    const uploadedMedia = await uploadProcessedMedia(processed);

    onMessageSend(messageInput.trim(), uploadedMedia);

    previews.forEach((preview) => {
      URL.revokeObjectURL(preview.previewUrl);
    });
    onPreviewsChange([]);
  } catch (error) {
    console.error("Error uploading media:", error);
    alert("Error uploading media file");
  }
};

const DOCUMENT_MIME_TYPES = new Set(KAKIOKI_CONFIG.upload.documentMimeTypes);

const isDocumentType = (mimeType: string): boolean => {
  return DOCUMENT_MIME_TYPES.has(mimeType) || mimeType.startsWith("text/");
};
