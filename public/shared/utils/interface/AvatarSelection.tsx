/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { UseImageCropperLogic } from "@/public/shared/media/ImageCropper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { SafeImage } from "@/public/shared/utils/chat/MessageMedia";
import { UseAvatarModalLogic } from "@/public/shared/media/ImageCropper";

export const ImageCropper: React.FC<{
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
}> = ({ imageSrc, onCropComplete, onCancel }) => {
  const {
    imgRef,
    previewCanvasRef,
    crop,
    completedCrop,
    setCompletedCrop,
    scale,
    setScale,
    onCropChange,
    onImageClick,
    onImageLoad,
    canvasPreview,
  } = UseImageCropperLogic();

  async function handleCropComplete() {
    const imgEl = imgRef.current;

    if (
      completedCrop?.width &&
      completedCrop?.height &&
      imgEl &&
      previewCanvasRef.current
    ) {
      await canvasPreview(
        imgEl,
        previewCanvasRef.current,
        completedCrop,
        scale,
      );

      previewCanvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob);
          }
        },
        "image/jpeg",
        0.9,
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs chat-background">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-cropper-title"
        aria-describedby="avatar-cropper-description"
        className="bg-white/5 backdrop-blur-lg rounded-lg p-6 w-[90%] max-w-2xl border border-white/20 shadow-xl animate-input-push"
      >
        <div className="flex flex-col items-center mb-4">
          <h2 id="avatar-cropper-title" className="sr-only">
            Crop avatar image
          </h2>
          <p id="avatar-cropper-description" className="sr-only">
            Adjust the crop area and scale, then upload the cropped avatar.
          </p>
          <div
            className="mb-4 max-h-96 overflow-hidden"
            style={{ maxWidth: 384, maxHeight: 384 }}
          >
            <ReactCrop
              crop={crop}
              onChange={onCropChange}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              minWidth={50}
              minHeight={50}
              keepSelection
              disabled={!crop}
              maxWidth={384}
              maxHeight={384}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop source"
                onLoad={(e) => onImageLoad(e)}
                onClick={onImageClick}
                style={{
                  maxWidth: "384px",
                  maxHeight: "384px",
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                  transform: `scale(${scale})`,
                  transformOrigin: crop
                    ? `${crop.x + (crop.width ?? 0) / 2}% ${crop.y + (crop.height ?? 0) / 2}%`
                    : "center center",
                }}
              />
            </ReactCrop>
          </div>

          <div className="flex flex-col gap-2 mb-4 w-full max-w-xs">
            {!crop && (
              <div className="w-full text-center text-neutral-50 font-bold mb-1">
                Click image to crop
              </div>
            )}
            <div className="flex items-center gap-2 text-neutral-50/70 text-sm">
              <label htmlFor="scale-range">Scale:</label>
              <input
                type="range"
                id="scale-range"
                name="scale"
                value={scale}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setScale(Number(e.target.value))}
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={scale}
                aria-valuetext={`${scale.toFixed(1)} times`}
                autoComplete="off"
                className="flex-1 slider slider-scale text-sm sm:text-lg"
              />
              <span className="w-12 text-right text-sm sm:text-lg">
                {scale.toFixed(1)}x
              </span>
            </div>
          </div>

          <canvas ref={previewCanvasRef} aria-hidden="true" style={{ display: "none" }} />
        </div>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            className="px-6 py-2 rounded-lg bg-lime-700 hover:bg-lime-800 text-neutral-50 use-crop-btn cursor-pointer text-xs sm:text-sm"
            onClick={handleCropComplete}
            disabled={!completedCrop}
          >
            Upload
          </button>
          <button
            type="button"
            className="px-6 py-2 rounded-lg bg-white/5 border border-white/20 hover:bg-red-700 text-neutral-50 cancel-btn cursor-pointer text-xs sm:text-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs chat-background">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-upload-title"
            aria-describedby="avatar-upload-description"
            className="relative bg-white/5 backdrop-blur-lg rounded-lg p-6 max-w-md w-full border border-white/20 shadow-xl chat-background animate-input-push"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="avatar-upload-title" className="font-bold text-neutral-50 text-sm sm:text-2xl lg:text-4xl text-center">
              Update Your Avatar
            </h2>
            <p id="avatar-upload-description" className="sr-only">
              Choose an image to upload as your avatar.
            </p>

            <form aria-labelledby="avatar-upload-title" aria-busy={isUploading} onSubmit={handleSubmit}>
              <div className="flex flex-col justify-center align-middle items-center p-10">
                {previewUrl && !showCropper ? (
                  <div className="relative w-50 h-50">
                    <SafeImage
                      src={previewUrl}
                      alt="Preview"
                      fill
                      sizes="50px"
                      className="object-cover rounded-full border-2 border-white/20"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-50 h-50 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer UploadImage motion-safe:transition-transform motion-safe:duration-200 hover:scale-105 active:scale-95"
                    onClick={handleUploadClick}
                    aria-label="Choose an avatar image"
                  >
                    <div className="text-center text-neutral-50/50">
                      <FontAwesomeIcon
                        icon={faUpload}
                        aria-hidden="true"
                        size="2x"
                        className="mb-2"
                      />
                      <p className="wrap-break-word">
                        Click to select an image
                      </p>
                    </div>
                  </button>
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
                    className="text-xs sm:text-sm text-neutral-50/70 hover:text-neutral-50 underline"
                    onClick={handleUploadClick}
                  >
                    Choose different image or crop again
                  </button>
                ) : null}
              </div>

              {error && (
                <div role="alert" aria-live="assertive" className="text-red-500 text-sm mb-4 text-center">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg no-theme bg-lime-700 hover:bg-lime-800 text-neutral-50 save-btn cursor-pointer disabled:cursor-not-allowed text-xs sm:text-sm"
                  disabled={(!selectedFile && !croppedBlob) || isUploading}
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    "Save"
                  )}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg no-theme bg-white/5 border border-white/20 hover:bg-red-700 text-neutral-50 cancel-btn cursor-pointer text-xs sm:text-sm"
                  onClick={onClose}
                  disabled={isUploading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
