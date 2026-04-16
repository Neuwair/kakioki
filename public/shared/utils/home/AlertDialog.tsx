"use client";

import React, { useEffect, useState } from "react";

interface AlertDialogProps {
  onClose: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({ onClose }) => {
  const [progress, setProgress] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const dialogTitleId = "alert-dialog-title";
  const dialogDescriptionId = "alert-dialog-description";

  useEffect(() => {
    const closeDelay = 240;
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(onClose, closeDelay);
    }, 5000 - closeDelay);
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 2, 100));
    }, 90);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [onClose]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-xs"
      style={{
        opacity: isClosing ? 0 : 1,
        transition: "opacity 240ms ease",
      }}
    >
      <div
        className={`max-w-md w-full flex flex-col flex-wrap bg-white/20 backdrop-blur-lg text-neutral-50 gap-4 p-8 rounded-lg border border-white/20 shadow-xl mx-4 ${isClosing ? "animate-alert-bounce-out" : "animate-alert-bounce-in"}`}
      >
        <h2 id={dialogTitleId} className="sr-only">
          Showcase notice
        </h2>
        <p
          id={dialogDescriptionId}
          className="text-neutral-50 text-sm sm:text-lg text-center"
        >
          This project is just a technical showcase.<br></br>You do not need to
          use a real email address.
        </p>
        <div className="w-full bg-neutral-50/30 rounded-full h-2">
          <div
            role="progressbar"
            aria-label="Dialog closes automatically"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="bg-lime-500 h-2 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export { AlertDialog };
