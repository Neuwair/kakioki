"use client";

import React from "react";
import { AvatarUploadModal } from "@/public/shared/Utils/UI/AvatarUploadUI";

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
        <div className="max-w-md w-full bg-black/20 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg p-8 cursor-default">
          <div className="text-center mb-6">
            <h2
              className="font-bold text-amber-50 mb-2"
              style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
            >
              Welcome to Kakioki!
            </h2>
            <p
              className="text-amber-50"
              style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
            >
              Would you like to upload an avatar?
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={handleUploadClick}
              className="w-full bg-blue-600 hover:bg-blue-500 text-amber-50 py-3 px-4 rounded-lg transition-colors duration-200 border-none cursor-pointer text-responsive"
              style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
            >
              Upload Avatar
            </button>
            <button
              onClick={onSkip}
              className="w-full bg-gray-300 hover:bg-gray-200 text-gray-800 hover:text-gray-900 py-3 px-4 rounded-lg transition-colors duration-200 border-none cursor-pointer text-responsive"
              style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
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
