"use client";

import React, { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { ImageCropper } from "@/public/shared/Utils/UI/AvatarCropUI";
import { SafeImage } from "@/public/shared/Utils/Props/MediaProps";
import { UseAvatarModalLogic } from "@/public/shared/hooks/AvatarUploadHooks";

interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number;
  onUploadSuccess?: () => void;
}

export const AvatarUploadModal: React.FC<AvatarUploadModalProps> = ({
  isOpen,
  onClose,
  userId,
  onUploadSuccess,
}) => {
  const {
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
  } = UseAvatarModalLogic(onClose, userId, onUploadSuccess);

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  if (!isOpen) return null;

  return (
    <>
      {showCropper && previewUrl && (
        <ImageCropper
          imageSrc={previewUrl}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {!showCropper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div
            className="relative bg-white/10 backdrop-blur-lg rounded-lg p-6 w-[90%] max-w-md border border-white/20 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl text-center font-bold mb-8 text-amber-50">
              Update Your Avatar
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col items-center mb-4">
                {previewUrl && !showCropper ? (
                  <div className="mb-4 relative w-48 h-48">
                    <SafeImage
                      src={previewUrl}
                      alt="Preview"
                      fill
                      sizes="48px"
                      className="object-cover rounded-full border-2 border-white/20"
                    />
                  </div>
                ) : (
                  <div
                    className="w-48 h-48 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center mb-4 cursor-pointer UploadImage motion-safe:transition-transform motion-safe:duration-200 hover:scale-105 active:scale-95"
                    onClick={handleUploadClick}
                  >
                    <div className="text-center text-amber-50/50">
                      <FontAwesomeIcon
                        icon={faUpload}
                        size="2x"
                        className="mb-2"
                      />
                      <p>Click to select an image</p>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  id="avatar-file-input"
                  name="avatarFile"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  autoComplete="off"
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    width: 1,
                    height: 1,
                  }}
                />

                {previewUrl && !showCropper ? (
                  <button
                    type="button"
                    className="text-sm text-amber-50/70 hover:text-amber-50 underline"
                    onClick={handleUploadClick}
                  >
                    Choose different image or crop again
                  </button>
                ) : null}
              </div>

              {error && (
                <div className="text-red-500 text-sm mb-4 text-center">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg no-theme bg-transparent border border-white/20 hover:bg-red-500 text-amber-50 cancel-btn cursor-pointer"
                  onClick={onClose}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg no-theme bg-green-600 hover:bg-green-500 text-white save-btn cursor-pointer"
                  disabled={(!selectedFile && !croppedBlob) || isUploading}
                >
                  {isUploading ? "Uploading..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
