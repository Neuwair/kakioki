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

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

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

  const focusPlayer = useCallback(() => {
    containerRef.current?.focus();
  }, []);

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
    [],
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
    [],
  );

  const handleSeekBackward = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    element.currentTime = Math.max(element.currentTime - 10, 0);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const video = videoRef.current as FullscreenVideoElement | null;
    if (!video) {
      return;
    }
    const fullscreenDocument = document as FullscreenDocument;
    const host = (containerRef.current ??
      video.parentElement) as FullscreenElement | null;
    const fullscreenElement =
      document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement;
    const isVideoFullscreen = Boolean(video.webkitDisplayingFullscreen);

    if (!fullscreenElement && !isVideoFullscreen) {
      if (host?.requestFullscreen) {
        void host.requestFullscreen().then(() => setIsFullscreen(true));
        return;
      }

      if (host?.webkitRequestFullscreen) {
        const result = host.webkitRequestFullscreen();
        if (result instanceof Promise) {
          void result.then(() => setIsFullscreen(true));
        } else {
          setIsFullscreen(true);
        }
        return;
      }

      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
      }
      return;
    }

    if (document.exitFullscreen) {
      void document.exitFullscreen().then(() => setIsFullscreen(false));
      return;
    }

    if (fullscreenDocument.webkitExitFullscreen) {
      const result = fullscreenDocument.webkitExitFullscreen();
      if (result instanceof Promise) {
        void result.then(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
      return;
    }

    if (video.webkitExitFullscreen) {
      video.webkitExitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handlePlayerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const isSpaceKey = event.key === " " || event.key === "Spacebar";
      const isMuteKey = event.key.toLowerCase() === "m";
      const isRewindKey = event.key.toLowerCase() === "r";

      if (!isSpaceKey && !isMuteKey && !isRewindKey) {
        return;
      }

      const target = event.target;
      const isInteractiveTarget =
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (isInteractiveTarget) {
        return;
      }

      event.preventDefault();
      if (isSpaceKey) {
        handleTogglePlay();
        return;
      }

      if (isRewindKey) {
        handleSeekBackward();
        return;
      }

      handleToggleMute();
    },
    [handleToggleMute, handleTogglePlay, handleSeekBackward],
  );

  useEffect(() => {
    const fullscreenDocument = document as FullscreenDocument;
    const video = videoRef.current as FullscreenVideoElement | null;
    const handleFullscreenChange = () => {
      const nextIsFullscreen = Boolean(
        document.fullscreenElement ??
        fullscreenDocument.webkitFullscreenElement ??
        video?.webkitDisplayingFullscreen,
      );

      setIsFullscreen(nextIsFullscreen);
      if (nextIsFullscreen) {
        focusPlayer();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange, {
      passive: true,
    });
    document.addEventListener(
      "webkitfullscreenchange",
      handleFullscreenChange as EventListener,
      {
        passive: true,
      },
    );
    video?.addEventListener("webkitbeginfullscreen", handleFullscreenChange, {
      passive: true,
    });
    video?.addEventListener("webkitendfullscreen", handleFullscreenChange, {
      passive: true,
    });

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange as EventListener,
      );
      video?.removeEventListener(
        "webkitbeginfullscreen",
        handleFullscreenChange,
      );
      video?.removeEventListener("webkitendfullscreen", handleFullscreenChange);
    };
  }, [focusPlayer]);

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
    [currentTime, duration],
  );
  const containerClasses = useMemo(() => {
    const base = isFullscreen
      ? "group relative flex h-full w-full items-center justify-center"
      : "group relative overflow-hidden rounded-lg";
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
    <div
      ref={containerRef}
      tabIndex={0}
      autoFocus
      className={containerClasses}
      onKeyDown={handlePlayerKeyDown}
      onMouseDown={focusPlayer}
      onTouchStart={focusPlayer}
    >
      <div className={videoWrapperClass}>
        <video
          ref={videoRef}
          src={source}
          poster={poster}
          loop={loop}
          playsInline
          className="h-full w-full object-contain"
          controls={false}
          onClick={() => {
            focusPlayer();
            handleTogglePlay();
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-1 sm:p-3 text-neutral-50 opacity-100 sm:opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 items-center">
        <div className="pointer-events-auto flex w-full flex-col items-center gap-2.5 rounded-lg bg-white/20 backdrop-blur-xs p-2">
          {shouldForceCompact ? (
            <div className="flex items-center gap-2.5 ">
              <button
                type="button"
                onClick={() => {
                  focusPlayer();
                  handleTogglePlay();
                }}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
              >
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              </button>
              <button
                type="button"
                onClick={() => {
                  handleToggleFullscreen();
                  focusPlayer();
                }}
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
              >
                <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
              </button>
            </div>
          ) : (
            <>
              <div className="hidden justify-center items-center gap-2 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    focusPlayer();
                    handleTogglePlay();
                  }}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                >
                  <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleFullscreen();
                    focusPlayer();
                  }}
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
              <div className="flex flex-wrap items-center gap-2.5 rounded-lg px-2 py-1">
                <button
                  type="button"
                  onClick={() => {
                    focusPlayer();
                    handleTogglePlay();
                  }}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                >
                  <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSeekBackward();
                    focusPlayer();
                  }}
                  aria-label="Rewind 10 seconds"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleMute();
                    focusPlayer();
                  }}
                  aria-label={isMuted || volumeValue === 0 ? "Unmute" : "Mute"}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                >
                  <FontAwesomeIcon
                    icon={
                      isMuted || volumeValue === 0
                        ? faVolumeXmark
                        : faVolumeHigh
                    }
                  />
                </button>
                <div className="flex  flex-1 items-center gap-2.5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volumeValue}
                    onChange={handleVolumeChange}
                    aria-label="Volume"
                    className="h-1 w-full max-w-50 cursor-pointer appearance-none rounded-full bg-white/20 p-1"
                  />
                  <span className="whitespace-nowrap text-[0.65rem] font-medium text-neutral-50 sm:text-xs">
                    {timeLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleFullscreen();
                    focusPlayer();
                  }}
                  aria-label={
                    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                  }
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                >
                  <FontAwesomeIcon
                    icon={isFullscreen ? faCompress : faExpand}
                  />
                </button>
              </div>
            </>
          )}
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
              className="pointer-events-auto h-1 w-50 cursor-pointer appearance-none rounded-full bg-transparent backdrop-blur-xs max-[480px]:hidden p-1"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
