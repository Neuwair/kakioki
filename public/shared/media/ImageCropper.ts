"use client";

import type { ChangeEvent, SyntheticEvent } from "react";
import { useCallback, useRef, useState } from "react";
import type { Crop, PixelCrop } from "react-image-crop";
import { useAuth } from "@/lib/auth/ClientAuth";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";

const TO_RADIANS = Math.PI / 180;
const AVATAR_MAX_FILE_SIZE = KAKIOKI_CONFIG.imageProcessing.maxFileSize;

export function UseImageCropperLogic() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>(
    undefined,
  );
  const [scale, setScale] = useState(1.0);
  const initialCropRef = useRef<Crop | undefined>(undefined);
  const MAX_PERCENT = 100;

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const imgEl = e.currentTarget;
    const imgW = imgEl.naturalWidth || imgEl.width || 1;
    const imgH = imgEl.naturalHeight || imgEl.height || 1;

    const initialWidthPercent = 90;

    const requestedWidthPx = (initialWidthPercent / 100) * imgW;
    const maxPx = Math.min(imgW, imgH) * (MAX_PERCENT / 100);
    const initialPx = Math.min(requestedWidthPx, maxPx);

    const initialWidthPercentFinal = (initialPx / imgW) * 100;
    const initialHeightPercentFinal = (initialPx / imgH) * 100;

    const initialCrop: Crop = {
      unit: "%",
      width: initialWidthPercentFinal,
      height: initialHeightPercentFinal,
      x: Math.max(0, (100 - initialWidthPercentFinal) / 2),
      y: Math.max(0, (100 - initialHeightPercentFinal) / 2),
    } as Crop;

    initialCropRef.current = initialCrop;
    try {
      setCrop(initialCrop);
    } catch {}
  }

  const onImageClick = useCallback(() => {
    if (initialCropRef.current && !crop) {
      setCrop(initialCropRef.current);
    }
  }, [crop]);

  const clampPercentCrop = useCallback(
    (p: Crop) => {
      const img = imgRef.current;
      const imgW = img?.naturalWidth || 1;
      const imgH = img?.naturalHeight || 1;

      const wPercent = typeof p.width === "number" ? p.width : 100;
      const hPercent = typeof p.height === "number" ? p.height : 100;

      const reqWpx = (wPercent / 100) * imgW;
      const reqHpx = (hPercent / 100) * imgH;

      const maxPx = Math.min(imgW, imgH) * (MAX_PERCENT / 100);

      const newPx = Math.min(reqWpx, reqHpx, maxPx);

      const newWPercent = (newPx / imgW) * 100;
      const newHPercent = (newPx / imgH) * 100;

      let x = typeof p.x === "number" ? p.x : 0;
      let y = typeof p.y === "number" ? p.y : 0;

      x = Math.max(0, Math.min(x, 100 - newWPercent));
      y = Math.max(0, Math.min(y, 100 - newHPercent));

      return {
        ...p,
        width: newWPercent,
        height: newHPercent,
        x,
        y,
        unit: "%",
      } as Crop;
    },
    [imgRef],
  );

  const onCropChange = useCallback(
    (cropArg: Crop | undefined, percentCropArg?: Crop) => {
      const percentCrop = percentCropArg || cropArg;
      if (!percentCrop) return;
      const clamped = clampPercentCrop(percentCrop);
      setCrop(clamped);
    },
    [clampPercentCrop],
  );

  const canvasPreview = useCallback(
    async (
      image: HTMLImageElement,
      canvas: HTMLCanvasElement,
      cropParam: PixelCrop,
      scaleParam = 1,
      rotateParam = 0,
    ) => {
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("No 2d context");
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const pixelRatio = window.devicePixelRatio;

      const cropX = cropParam.x * scaleX;
      const cropY = cropParam.y * scaleY;
      const cropW = Math.max(1, cropParam.width * scaleX);
      const cropH = Math.max(1, cropParam.height * scaleY);

      const zoom = Math.max(1, scaleParam);
      const srcW = cropW / zoom;
      const srcH = cropH / zoom;
      const srcCx = cropX + cropW / 2;
      const srcCy = cropY + cropH / 2;
      let srcX = srcCx - srcW / 2;
      let srcY = srcCy - srcH / 2;

      srcX = Math.max(0, Math.min(srcX, image.naturalWidth - srcW));
      srcY = Math.max(0, Math.min(srcY, image.naturalHeight - srcH));

      canvas.width = Math.floor(cropW * pixelRatio);
      canvas.height = Math.floor(cropH * pixelRatio);

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.imageSmoothingQuality = "high";

      if (rotateParam !== 0) {
        const cx = cropW / 2;
        const cy = cropH / 2;
        ctx.translate(cx, cy);
        ctx.rotate(rotateParam * TO_RADIANS);
        ctx.translate(-cx, -cy);
      }

      ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, cropW, cropH);

      if (rotateParam !== 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    },
    [],
  );

  return {
    imgRef,
    previewCanvasRef,
    crop,
    setCrop,
    completedCrop,
    setCompletedCrop,
    scale,
    setScale,
    onCropChange,
    onImageClick,
    onImageLoad,
    canvasPreview,
  } as const;
}

export const createImageFromBlob = (blob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
};

export const blobToFile = (blob: Blob, fileName: string): File => {
  return new File([blob], fileName, {
    type: blob.type,
    lastModified: Date.now(),
  });
};

export const resizeImageBlob = async (
  blob: Blob,
  maxWidth: number = 300,
  maxHeight: number = 300,
  quality: number = 0.9,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      const ratio = Math.min(maxWidth / width, maxHeight / height);

      if (ratio < 1) {
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (resultBlob) => {
          if (resultBlob) {
            resolve(resultBlob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(blob);
  });
};

export const UseAvatarModalLogic = (
  onClose: () => void,
  userId?: number,
  onUploadSuccess?: () => void,
) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { updateAvatar } = useAuth();

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file (JPEG, PNG, etc.)");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);

      setSelectedFile(file);
      setCroppedBlob(null);
      setError(null);
    },
    [],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCropComplete = useCallback(
    async (blob: Blob) => {
      try {
        const resizedBlob = await resizeImageBlob(blob, 300, 300, 0.9);
        setCroppedBlob(resizedBlob);
        setShowCropper(false);

        if (previewUrl && previewUrl.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(previewUrl);
          } catch {}
        }

        const croppedPreviewUrl = URL.createObjectURL(resizedBlob);
        setPreviewUrl(croppedPreviewUrl);
      } catch (err) {
        console.error("Failed to process cropped image:", err);
        setError("Failed to process cropped image");
      }
    },
    [previewUrl],
  );

  const handleCropCancel = useCallback(() => {
    setShowCropper(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCroppedBlob(null);
  }, []);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCroppedBlob(null);
    setShowCropper(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!selectedFile && !croppedBlob) {
        setError("Please select an image first");
        return;
      }

      const fileToUpload = croppedBlob
        ? blobToFile(croppedBlob, `avatar_${Date.now()}.jpg`)
        : selectedFile;

      if (!fileToUpload) {
        setError("No file to upload");
        return;
      }

      if (fileToUpload.size > AVATAR_MAX_FILE_SIZE) {
        setError("Image is too large. Please select an image under 5MB.");
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        console.debug("Uploading file:", fileToUpload.name);
        const result = await updateAvatar(fileToUpload);

        if (result.success) {
          console.debug("Avatar updated successfully");
          if (previewUrl && previewUrl.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(previewUrl);
            } catch {}
          }
          resetState();
          onUploadSuccess?.();
          onClose();
        } else {
          console.error("Avatar update failed:", result.error);
          setError(result.error || "Failed to update avatar");
        }
      } catch (err) {
        console.error("Avatar upload exception:", err);
        setError("An unexpected error occurred during upload");
      } finally {
        setIsUploading(false);
      }
    },
    [
      croppedBlob,
      selectedFile,
      previewUrl,
      updateAvatar,
      onClose,
      resetState,
      onUploadSuccess,
    ],
  );

  return {
    selectedFile,
    previewUrl,
    croppedBlob,
    showCropper,
    isUploading,
    error,
    fileInputRef,
    handleFileChange,
    handleUploadClick,
    handleCropComplete,
    handleCropCancel,
    handleSubmit,
    resetState,
  };
};
