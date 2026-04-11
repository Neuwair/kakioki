"use client";

import React from "react";
import { AvatarUploadModal } from "@/public/shared/utils/interface/AvatarSelection";

interface AvatarFormProps {
  userId: number | null;
  onSkip: () => void;
  onUploadSuccess: () => void;
}

export const AvatarForm: React.FC<AvatarFormProps> = ({
  userId,
  onSkip,
  onUploadSuccess,
}) => {
  const [showUploadModal, setShowUploadModal] = React.useState(false);

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleModalClose = () => {
    setShowUploadModal(false);
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    onUploadSuccess();
  };

  return (
    <>
      {!showUploadModal && (
        <div className="flex flex-col gap-4 max-w-md w-full bg-white/5 backdrop-blur-lg border border-white/20 rounded-4xl shadow-lg p-8">
          <div className="flex flex-col gap-2 text-center">
            <h2
              className="font-bold text-neutral-50"
              style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
            >
              Welcome to Kakioki!
            </h2>
            <p
              className="text-neutral-50"
              style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
            >
              Would you like to upload an avatar?
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleUploadClick}
              className="w-full bg-lime-700 hover:bg-lime-800 text-neutral-50 py-3 px-4 rounded-lg transition-colors duration-200 border-none cursor-pointer text-responsive save-btn text-2xl"
            >
              Upload Avatar
            </button>
            <button
              onClick={onSkip}
              className="w-full bg-gray-300 hover:bg-gray-200 text-gray-800 hover:text-gray-900 py-3 px-4 rounded-lg transition-colors duration-233 border-none cursor-pointer text-responsive interface-btn text-2xl"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      <AvatarUploadModal
        isOpen={showUploadModal}
        onClose={handleModalClose}
        userId={userId ?? undefined}
        onUploadSuccess={handleUploadSuccess}
      />
    </>
  );
};
