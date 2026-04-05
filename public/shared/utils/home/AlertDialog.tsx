"use client";

import React, { useEffect, useState } from "react";

interface AlertDialogProps {
  onClose: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({ onClose }) => {
  const [progress, setProgress] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

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
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-xs"
      style={{
        opacity: isClosing ? 0 : 1,
        transition: "opacity 240ms ease",
      }}
    >
      <div
        className={`flex flex-col flex-wrap bg-white/20 backdrop-blur-lg text-neutral-50 p-10 rounded-4xl w-[90%] max-w-md border border-white/20 shadow-xl mx-4 ${isClosing ? "animate-alert-bounce-out" : "animate-alert-bounce-in"}`}
      >
        <p
          className="text-center"
          style={{ fontSize: "clamp(1.5vh, 0.5vw, 5rem)" }}
        >
          This project is just a technical showcase. You do not need to use a
          real email address.
        </p>
        <div className="w-full bg-neutral-50/30 rounded-full h-2 mt-4">
          <div
            className="bg-lime-500 h-2 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export { AlertDialog };
