import { useState, useRef, useCallback } from "react";
import {
  blobToFile,
  resizeImageBlob,
} from "@/public/shared/Tools/AvatarCropper";
import { useAuth } from "@/lib/context/AuthClientUI";
import { uploadAvatar } from "@/lib/Auth/AuthClient";

export const UseAvatarModalLogic = (
  onClose: () => void,
  userId?: number,
  onUploadSuccess?: () => void
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    []
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
    [previewUrl]
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
    async (e: React.FormEvent) => {
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

      if (fileToUpload.size > 5 * 1024 * 1024) {
        setError("Image is too large. Please select an image under 5MB.");
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        console.debug("Uploading file:", fileToUpload.name);
        const result = userId
          ? await uploadAvatar(fileToUpload, userId)
          : await updateAvatar(fileToUpload);

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
      userId,
      onUploadSuccess,
    ]
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
