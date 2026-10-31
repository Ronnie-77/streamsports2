"use client";

import * as React from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Minimize2,
  Loader2,
  AlertTriangle,
  Settings,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StreamKind = "hls" | "dash" | "ts" | "native";

function detectKind(url: string): StreamKind {
  const u = url.toLowerCase().split("?")[0].split("#")[0];
  if (u.endsWith(".m3u8") || u.includes(".m3u8")) return "hls";
  if (u.endsWith(".mpd") || u.includes(".mpd")) return "dash";
  if (u.endsWith(".ts") || u.endsWith(".m2ts")) return "ts";
  return "native";
}

/**
 * Route a cross-origin stream URL through our same-origin /api/stream
 * proxy so the browser doesn't block it with CORS. The proxy fetches
 * server-side and pipes the bytes (and rewrites m3u8 segment URLs) back
 * to the player. Same-origin URLs are left untouched.
 */
function proxify(url: string): string {
  if (!url) return url;
  if (url.startsWith("/")) return url; // already same-origin
  try {
    const u = new URL(url);
    if (typeof window !== "undefined" && u.origin === window.location.origin) {
      return url; // same-origin
    }
    return `/api/stream?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

interface QualityLevel {
  index: number;
  label: string;
  height?: number;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
}

/**
 * Premium inline video player.
 *
 * Supports HLS (.m3u8 via hls.js), DASH (.mpd via dashjs), raw MPEG-TS
 * (.ts via mpegts.js) and native MP4/WebM — auto-detected from the URL.
 * Manual channels play directly on the site (no redirect).
 */
export function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  className,
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const kindRef = React.useRef<StreamKind>(detectKind(src));
  // Mutable engine refs (typed loosely to keep the libs lazy/optional).
  const engineRef = React.useRef<{ destroy?: () => void; setQuality?: (i: number) => void } | null>(null);

  const [ready, setReady] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(1);
  const [duration, setDuration] = React.useState(0);
  const [current, setCurrent] = React.useState(0);
  const [buffered, setBuffered] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [qualities, setQualities] = React.useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = React.useState(-1);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showControls, setShowControls] = React.useState(true);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Engine init -------------------------------------------------------
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let destroyed = false;
    setLoading(true);
    setError(null);
    setReady(false);
    setQualities([]);

    const kind = kindRef.current;
    // Route cross-origin streams through our same-origin proxy so the
    // browser doesn't block hls.js / mpegts.js / dashjs fetches with CORS.
    const playSrc = proxify(src);

    async function init() {
      try {
        if (kind === "hls") {
          // Native HLS (Safari) — no library needed.
          if (video?.canPlayType("application/vnd.apple.mpegurl")) {
            video!.src = playSrc;
            engineRef.current = {
              destroy: () => {
                video!.removeAttribute("src");
                video!.load();
              },
            };
          } else {
            const mod = await import("hls.js");
            if (destroyed) return;
            const Hls = mod.default;
            if (Hls.isSupported()) {
              const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
              });
              hls.loadSource(playSrc);
              hls.attachMedia(video!);
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                const levels = hls.levels || [];
                setQualities(
                  levels.map((l, i) => ({
                    index: i,
                    label: l.height ? `${l.height}p` : `Level ${i + 1}`,
                    height: l.height,
                  }))
                );
              });
              hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
                setCurrentQuality(data.level);
              });
              engineRef.current = {
                destroy: () => hls.destroy(),
                setQuality: (i: number) => {
                  hls.currentLevel = i;
                },
              };
            } else {
              throw new Error("HLS not supported in this browser");
            }
          }
        } else if (kind === "dash") {
          const mod = await import("dashjs");
          if (destroyed) return;
          const dashjs = (mod as unknown as { MediaPlayer: () => { create: () => { initialize: (el: HTMLVideoElement, url: string, auto: boolean) => void; on: (event: string, cb: (e: unknown) => void) => void; getBitrateInfoListFor: (type: string) => unknown[]; updateSettings: (s: unknown) => void; setQualityFor: (type: string, q: number) => void; reset: () => void; } } });
          const player = dashjs.MediaPlayer().create();
          player.initialize(video!, playSrc, false);
          player.on("streamInitialized", () => {
            const bitrates = (player.getBitrateInfoListFor("video") || []) as Record<string, number>[];
            setQualities(
              bitrates.map((b, i) => ({
                index: i,
                label: b.height
                  ? `${b.height}p`
                  : b.bitrate
                    ? `${Math.round(b.bitrate / 1000)}k`
                    : `Level ${i + 1}`,
                height: b.height,
              }))
            );
          });
          player.on("qualityChangeRendered", (e: unknown) => {
            const ev = e as { newQuality?: number };
            if (typeof ev.newQuality === "number") setCurrentQuality(ev.newQuality);
          });
          engineRef.current = {
            destroy: () => player.reset(),
            setQuality: (i: number) => {
              player.updateSettings({
                streaming: { abr: { autoSwitchBitrate: { video: i === -1 } } },
              });
              if (i >= 0) player.setQualityFor("video", i);
            },
          };
        } else if (kind === "ts") {
          const mod = await import("@/lib/mpegts-loader");
          if (destroyed) return;
          const mpegts = mod.default;
          if (mpegts.isSupported()) {
            const player = mpegts.createPlayer(
              { type: "mpegts", url: playSrc, isLive: true },
              { enableWorker: false, liveBufferLatencyChasing: true, lazyLoad: false }
            );
            player.attachMediaElement(video!);
            player.load();
            // Live MPEG-TS streams need an explicit play() to begin
            // pulling data through the proxy.
            player.play();
            engineRef.current = {
              destroy: () => {
                player.pause();
                player.unload();
                player.detachMediaElement();
                player.destroy();
              },
            };
          } else {
            // Fallback: try native (some browsers play .ts)
            video!.src = playSrc;
            engineRef.current = {
              destroy: () => {
                video!.removeAttribute("src");
                video!.load();
              },
            };
          }
        } else {
          // native mp4/webm
          video!.src = playSrc;
          engineRef.current = {
            destroy: () => {
              video!.removeAttribute("src");
              video!.load();
            },
          };
        }
      } catch (e) {
        if (!destroyed) {
          setError(e instanceof Error ? e.message : "Failed to load stream");
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      if (engineRef.current?.destroy) {
        try {
          engineRef.current.destroy();
        } catch {
          /* ignore */
        }
      }
      engineRef.current = null;
    };
  }, [src]);

  // ---- Video element events ---------------------------------------------
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      setReady(true);
      setDuration(v.duration || 0);
      setLoading(false);
      if (autoPlay) v.play().catch(() => {});
    };
    const onPlaying = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => setPlaying(false);
    const onTime = () => {
      setCurrent(v.currentTime);
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    };
    const onVolume = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onError = () => {
      setError("Playback error. The stream may be offline or blocked by CORS.");
      setLoading(false);
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("progress", onTime);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onError);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("progress", onTime);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
    };
  }, [autoPlay]);

  // ---- Fullscreen --------------------------------------------------------
  React.useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = React.useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const toggleMute = React.useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
  }, []);

  const onVolumeChange = React.useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  }, []);

  const onSeek = React.useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val;
    setCurrent(val);
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const reload = React.useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    v.play().catch(() => {});
  }, []);

  const setQuality = React.useCallback((i: number) => {
    engineRef.current?.setQuality?.(i);
    setCurrentQuality(i);
    setShowSettings(false);
  }, []);

  const togglePiP = React.useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ---- Auto-hide controls ------------------------------------------------
  const pokeControls = React.useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2800);
    }
  }, [playing]);

  React.useEffect(() => {
    pokeControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pokeControls]);

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const isLiveStream = !isFinite(duration) || duration === 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden bg-black",
        className
      )}
      onMouseMove={pokeControls}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        className="h-full w-full object-contain"
        onClick={togglePlay}
      />

      {/* Loading */}
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <div className="flex flex-col items-center gap-2 text-white/90">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-xs">Loading stream…</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center">
          <div className="flex max-w-sm flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-accent" />
            <p className="text-sm font-medium text-white">Can&apos;t play this stream</p>
            <p className="text-xs text-white/60">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-1 flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25"
            >
              <RotateCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Center play (when paused & ready) */}
      {!playing && !loading && !error && ready && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 z-10 grid place-items-center"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/40 transition-transform hover:scale-110">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-spatial-lg">
              <Play className="h-6 w-6 translate-x-0.5 fill-current" />
            </span>
          </span>
        </button>
      )}

      {/* Live badge */}
      {isLiveStream && ready && (
        <span className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-live/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-live-glow">
          <span className="live-dot scale-75" /> Live
        </span>
      )}

      {/* Format badge */}
      <span className="absolute right-3 top-3 z-20 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur">
        {kindRef.current}
      </span>

      {/* Control bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 transition-opacity duration-200",
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-8">
          {/* Seek bar */}
          {!isLiveStream && (
            <div className="group relative mb-2 h-1.5 cursor-pointer rounded-full bg-white/20">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                style={{ width: `${bufPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-accent"
                style={{ width: `${pct}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={current}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
                aria-label="Seek"
              />
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                style={{ left: `${pct}%` }}
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-white">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>

            <div className="group flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15"
              >
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all group-hover:w-16 group-hover:opacity-100"
                aria-label="Volume"
              />
            </div>

            <span className="ml-1 text-[11px] tabular-nums text-white/80">
              {isLiveStream ? "LIVE" : `${fmt(current)} / ${fmt(duration)}`}
            </span>

            <div className="ml-auto flex items-center gap-1">
              {qualities.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSettings((v) => !v)}
                    aria-label="Quality settings"
                    className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  {showSettings && (
                    <div className="absolute bottom-10 right-0 w-36 rounded-xl bg-black/90 p-1.5 ring-1 ring-white/15 backdrop-blur-xl">
                      <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/50">
                        Quality
                      </p>
                      <button
                        type="button"
                        onClick={() => setQuality(-1)}
                        className={cn(
                          "block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10",
                          currentQuality === -1 ? "text-emerald-accent" : "text-white/80"
                        )}
                      >
                        Auto
                      </button>
                      {qualities.map((q) => (
                        <button
                          key={q.index}
                          type="button"
                          onClick={() => setQuality(q.index)}
                          className={cn(
                            "block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10",
                            currentQuality === q.index ? "text-emerald-accent" : "text-white/80"
                          )}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={togglePiP}
                aria-label="Picture in picture"
                className="hidden h-8 w-8 place-items-center rounded-lg hover:bg-white/15 sm:grid"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15"
              >
                {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(s: number): string {
  if (!isFinite(s) || s <= 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
