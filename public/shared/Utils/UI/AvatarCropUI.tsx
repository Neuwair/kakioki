/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { UseImageCropperLogic } from "@/public/shared/Tools/AvatarCropper";

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
        scale
      );

      previewCanvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob);
          }
        },
        "image/jpeg",
        0.9
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 w-[90%] max-w-2xl border border-white/20 shadow-xl">
        <div className="flex flex-col items-center mb-4">
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
                  transformOrigin: "center center",
                }}
              />
            </ReactCrop>
          </div>

          <div className="flex flex-col gap-2 mb-4 w-full max-w-xs">
            {!crop && (
              <div className="w-full text-center text-amber-50 font-bold mb-1">
                Click image to crop
              </div>
            )}
            <div className="flex items-center gap-2 text-amber-50/70 text-sm">
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
                autoComplete="off"
                className="flex-1 slider slider-scale"
              />
              <span className="w-12 text-right">{scale.toFixed(1)}x</span>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-amber-50/70 text-sm text-center">
              Drag to move • Resize corners to adjust size • Use slider to scale
            </p>
          </div>

          <canvas ref={previewCanvasRef} style={{ display: "none" }} />
        </div>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            className="px-6 py-2 rounded-lg bg-transparent border border-white/20 hover:bg-red-500 text-amber-50 cancel-btn cursor-pointer"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-6 py-2 rounded-lg bg-green-500 hover:bg-green-700 text-amber-50 use-crop-btn cursor-pointer"
            onClick={handleCropComplete}
            disabled={!completedCrop}
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
};
