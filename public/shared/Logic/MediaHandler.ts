import type { MediaPreview, ProcessedMedia } from "@/lib/types/TypesLogic";
import { resizeWithWorkerFallback } from "@/public/shared/Tools/SharpResizing";
import { compressVideoFile } from "@/public/shared/Tools/VideoCompressor";

type UploadResult = {
  success: boolean;
  url?: string;
  data?: string;
  error?: string;
  file?: {
    data?: string;
    type?: string;
    size?: number;
    format?: string;
  };
};

export const SERVER_MAX_BYTES = 4 * 1024 * 1024;

export type UploadedMediaItem = {
  url: string;
  type: "image" | "video";
  encrypted?: boolean;
  format?: string;
  size?: number;
  width?: number;
  height?: number;
  thumbnail?: string | null;
  name?: string;
};

export async function processMediaPreviews(
  mediaPreviews: MediaPreview[],
  maxBytes = SERVER_MAX_BYTES
): Promise<{ processed: ProcessedMedia[]; skipped: number }> {
  const processed: ProcessedMedia[] = [];
  let skipped = 0;

  for (const preview of mediaPreviews) {
    let fileToUpload = preview.file;

    if (preview.type === "image" && fileToUpload.size >= maxBytes) {
      fileToUpload = await resizeWithWorkerFallback(fileToUpload, maxBytes, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
      });
    }

    if (preview.type === "video") {
      fileToUpload = await compressVideoFile(fileToUpload, {
        maxBytes,
        maxWidth: 1280,
        maxHeight: 1280,
      });
    }

    if (fileToUpload.size > maxBytes) {
      skipped += 1;
      continue;
    }

    processed.push({ file: fileToUpload, type: preview.type });
  }

  return { processed, skipped };
}

export async function uploadProcessedMedia(
  processed: ProcessedMedia[]
): Promise<UploadedMediaItem[]> {
  const mediaItems: UploadedMediaItem[] = [];

  for (const p of processed) {
    const formData = new FormData();
    formData.append("file", p.file);
    formData.append("mediaType", p.type);

    const result = (await uploadFile(formData)) as UploadResult;

    if (result && result.file && result.file.data) {
      const fileObj = result.file;
      mediaItems.push({
        url: fileObj.data || "",
        type: (fileObj.type as "image" | "video") || "image",
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
  const response = await fetch("/api/upload", {
    method: "POST",
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
  maxBytes = SERVER_MAX_BYTES
): Promise<{ uploaded: UploadedMediaItem[]; failedCount: number }> {
  if (!mediaPreviews || mediaPreviews.length === 0) {
    return { uploaded: [], failedCount: 0 };
  }

  const { processed, skipped } = await processMediaPreviews(
    mediaPreviews,
    maxBytes
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
  mediaPreviews: MediaPreview[]
): Promise<UploadedMediaItem[]> {
  if (mediaPreviews.length === 0) return [];

  try {
    const { processed, skipped } = await processMediaPreviews(mediaPreviews);
    if (skipped > 0) {
      console.warn(
        "Media files were skipped because they exceeded the size limit"
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
  setMediaPreviews: React.Dispatch<React.SetStateAction<MediaPreview[]>>
) => {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  if (mediaPreviews.length + files.length > 4) {
    return;
  }

  try {
    const processedPreviews: MediaPreview[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        console.warn("Skipping unsupported file type:", file.type);
        continue;
      }

      const type = file.type.startsWith("image/")
        ? ("image" as const)
        : ("video" as const);

      let finalFile: File = file;
      if (type === "image") {
        try {
          finalFile = await resizeWithWorkerFallback(file, SERVER_MAX_BYTES, {
            maxWidth: 1280,
            maxHeight: 1280,
            quality: 0.8,
          });
        } catch (err) {
          console.warn(
            "Worker resize failed, falling back to original file",
            err
          );
          finalFile = file;
        }
      } else if (type === "video") {
        try {
          const compressed = await compressVideoFile(file, {
            maxBytes: SERVER_MAX_BYTES,
            maxWidth: 1280,
            maxHeight: 1280,
          });
          finalFile = compressed;
        } catch (err) {
          console.warn("Video compression failed, using original video", err);
          finalFile = file;
        }
      }

      if (finalFile.size > SERVER_MAX_BYTES) {
        alert("Media file exceeds the 4MB limit even after compression");
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
  inputRef: React.RefObject<HTMLInputElement>
) => {
  const fileArray = Array.from(files || []);
  if (fileArray.length === 0) return;

  if (currentPreviews.length + fileArray.length > 4) {
    return;
  }

  try {
    const validPreviews: MediaPreview[] = [];

    for (const file of fileArray) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        throw new Error("Only images and videos are allowed");
      }

      const type = file.type.startsWith("image/")
        ? ("image" as const)
        : ("video" as const);

      let finalFile: File = file;
      if (type === "image") {
        try {
          finalFile = await resizeWithWorkerFallback(file, SERVER_MAX_BYTES, {
            maxWidth: 1280,
            maxHeight: 1280,
            quality: 0.8,
          });
        } catch (err) {
          console.warn(
            "Worker resize failed, falling back to original file",
            err
          );
          finalFile = file;
        }
      } else {
        try {
          finalFile = await compressVideoFile(file, {
            maxBytes: SERVER_MAX_BYTES,
            maxWidth: 1280,
            maxHeight: 1280,
          });
        } catch (err) {
          console.warn("Video compression failed, using original video", err);
          finalFile = file;
        }
      }

      if (finalFile.size > SERVER_MAX_BYTES) {
        alert("Media file exceeds the 4MB limit even after compression");
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
  onPreviewsChange: (previews: MediaPreview[]) => void
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
  onPreviewsChange: (previews: MediaPreview[]) => void
) => {
  if (previews.length === 0) return;

  try {
    const { processed, skipped } = await processMediaPreviews(previews);
    if (processed.length === 0) {
      if (skipped > 0) {
        alert("Media files were skipped because they exceeded the 4MB limit");
      }
      return;
    }
    if (skipped > 0) {
      alert(
        "Some media files were skipped because they exceeded the 4MB limit"
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
