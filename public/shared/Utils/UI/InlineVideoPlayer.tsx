"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faVolumeHigh,
  faVolumeXmark,
  faRotateLeft,
  faExpand,
  faCompress,
} from "@fortawesome/free-solid-svg-icons";

interface InlineVideoPlayerProps {
  source: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  forceCompactControls?: boolean;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  const padded = remainder < 10 ? `0${remainder}` : `${remainder}`;
  return `${minutes}:${padded}`;
};

export const InlineVideoPlayer: React.FC<InlineVideoPlayerProps> = ({
  source,
  poster,
  className,
  autoPlay,
  muted,
  loop,
  forceCompactControls,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(Boolean(autoPlay));
  const [isMuted, setIsMuted] = useState(Boolean(muted));
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateStateFromVideo = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    setIsPlaying(!element.paused);
    setIsMuted(element.muted);
    setVolume(element.volume);
    setDuration(element.duration || 0);
    setCurrentTime(element.currentTime || 0);
  }, []);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return undefined;
    }
    const handleLoadedMetadata = () => {
      setDuration(element.duration || 0);
      setCurrentTime(element.currentTime || 0);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(element.currentTime || 0);
    };
    const handleVolumeChange = () => {
      setVolume(element.volume);
      setIsMuted(element.muted);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (!loop) {
        element.currentTime = element.duration;
      }
    };
    element.addEventListener("loadedmetadata", handleLoadedMetadata, {
      passive: true,
    });
    element.addEventListener("timeupdate", handleTimeUpdate, {
      passive: true,
    });
    element.addEventListener("volumechange", handleVolumeChange, {
      passive: true,
    });
    element.addEventListener("play", handlePlay, {
      passive: true,
    });
    element.addEventListener("pause", handlePause, {
      passive: true,
    });
    element.addEventListener("ended", handleEnded, {
      passive: true,
    });
    return () => {
      element.removeEventListener("loadedmetadata", handleLoadedMetadata);
      element.removeEventListener("timeupdate", handleTimeUpdate);
      element.removeEventListener("volumechange", handleVolumeChange);
      element.removeEventListener("play", handlePlay);
      element.removeEventListener("pause", handlePause);
      element.removeEventListener("ended", handleEnded);
    };
  }, [loop]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (autoPlay) {
      void video.play().catch(() => {});
    }
  }, [autoPlay, source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = Boolean(muted);
    setIsMuted(video.muted);
  }, [muted]);

  const handleTogglePlay = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    if (element.paused) {
      void element.play().catch(() => {});
    } else {
      element.pause();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    element.muted = !element.muted;
    setIsMuted(element.muted);
    if (!element.muted && element.volume === 0) {
      element.volume = 0.5;
      setVolume(0.5);
    }
  }, []);

  const handleProgressChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const element = videoRef.current;
      if (!element) {
        return;
      }
      const value = Number(event.target.value);
      const nextTime = (value / 100) * (element.duration || 0);
      element.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    []
  );

  const handleProgressPointerDown = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    element.pause();
  }, []);

  const handleProgressPointerUp = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    if (!element.paused) {
      return;
    }
    if (isPlaying) {
      void element.play().catch(() => {});
    }
  }, [isPlaying]);

  const handleVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const element = videoRef.current;
      if (!element) {
        return;
      }
      const value = Number(event.target.value) / 100;
      element.volume = value;
      element.muted = value === 0;
      setVolume(value);
      setIsMuted(element.muted);
    },
    []
  );

  const handleSeekBackward = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    element.currentTime = Math.max(element.currentTime - 10, 0);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    const host = containerRef.current ?? element.parentElement;
    if (!document.fullscreenElement) {
      if (host && host.requestFullscreen) {
        void host.requestFullscreen().then(() => setIsFullscreen(true));
      }
    } else if (document.exitFullscreen) {
      void document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange, {
      passive: true,
    });
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    updateStateFromVideo();
  }, [updateStateFromVideo, source]);

  const progressValue = useMemo(() => {
    if (!duration) {
      return 0;
    }
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const volumeValue = useMemo(() => Math.round(volume * 100), [volume]);
  const timeLabel = useMemo(
    () => `${formatTime(currentTime)} / ${formatTime(duration)}`,
    [currentTime, duration]
  );
  const containerClasses = useMemo(() => {
    const base = isFullscreen
      ? "group relative flex h-full w-full items-center justify-center bg-black"
      : "group relative overflow-hidden rounded-xl bg-black/80";
    if (!isFullscreen && className) {
      return `${base} ${className}`;
    }
    return base;
  }, [className, isFullscreen]);

  const videoWrapperClass = useMemo(() => {
    if (isFullscreen) {
      return "relative h-full w-full";
    }
    return `relative h-full w-full ${className ?? ""}`;
  }, [className, isFullscreen]);

  const shouldForceCompact = Boolean(forceCompactControls) && !isFullscreen;

  return (
    <div ref={containerRef} className={containerClasses}>
      <div className={videoWrapperClass}>
        <video
          ref={videoRef}
          src={source}
          poster={poster}
          loop={loop}
          playsInline
          className="h-full w-full object-contain"
          controls={false}
          onClick={handleTogglePlay}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-2 sm:p-3 text-amber-50 opacity-100 sm:opacity-0 mb-2 transition-opacity duration-200 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 items-center">
        <div className="pointer-events-auto flex w-full flex-col items-center gap-2">
          {shouldForceCompact ? (
            <div className="flex items-center gap-2 rounded-full bg-black/45 px-2 py-1 backdrop-blur">
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
              >
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
              >
                <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
              </button>
            </div>
          ) : (
            <>
              <div className="hidden items-center gap-2 rounded-full bg-black/45 px-2 py-1 backdrop-blur max-[480px]:flex">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                >
                  <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  aria-label={
                    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                  }
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
                >
                  <FontAwesomeIcon
                    icon={isFullscreen ? faCompress : faExpand}
                  />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-full bg-black/45 px-2 py-1 backdrop-blur max-[480px]:hidden">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                >
                  <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
                </button>
                <button
                  type="button"
                  onClick={handleSeekBackward}
                  aria-label="Rewind 10 seconds"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  aria-label={isMuted || volumeValue === 0 ? "Unmute" : "Mute"}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
                >
                  <FontAwesomeIcon
                    icon={
                      isMuted || volumeValue === 0
                        ? faVolumeXmark
                        : faVolumeHigh
                    }
                  />
                </button>
                <div className="flex min-w-[6rem] flex-1 items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volumeValue}
                    onChange={handleVolumeChange}
                    aria-label="Volume"
                    className="h-1 w-full max-w-60 cursor-pointer appearance-none rounded-full bg-white/30"
                  />
                  <span className="whitespace-nowrap text-[0.65rem] font-medium text-amber-50/80 sm:text-xs">
                    {timeLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  aria-label={
                    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                  }
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
                >
                  <FontAwesomeIcon
                    icon={isFullscreen ? faCompress : faExpand}
                  />
                </button>
              </div>
            </>
          )}
        </div>
        {!shouldForceCompact ? (
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={progressValue}
            onChange={handleProgressChange}
            onPointerDown={handleProgressPointerDown}
            onPointerUp={handleProgressPointerUp}
            aria-label="Seek"
            className="pointer-events-auto h-1 w-full cursor-pointer appearance-none rounded-full bg-white/40 max-[480px]:hidden"
          />
        ) : null}
      </div>
    </div>
  );
};
