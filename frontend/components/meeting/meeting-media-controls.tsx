"use client";

import {
  BACKGROUND_MODES,
  useBackgroundEffects,
} from "@/components/meeting/background-controls";
import { HD_VIDEO_CAPTURE } from "@/lib/livekit-options";
import {
  useMediaDeviceSelect,
  useTrackToggle,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Aperture,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Settings,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

type TrayKind = "mic" | "camera";

function deviceLabel(
  devices: MediaDeviceInfo[],
  activeDeviceId: string,
  fallback: string,
) {
  const match =
    devices.find((device) => device.deviceId === activeDeviceId) ??
    devices.find((device) => device.deviceId === "default") ??
    devices[0];
  if (!match?.label) return fallback;
  return match.label.replace(/\s*\([^)]{8,}\)\s*$/, "").trim() || match.label;
}

function DeviceMenu({
  devices,
  activeDeviceId,
  onSelect,
}: {
  devices: MediaDeviceInfo[];
  activeDeviceId: string;
  onSelect: (id: string) => void;
}) {
  if (devices.length === 0) {
    return <p className="meet-device-empty">No devices found</p>;
  }

  return (
    <div className="meet-device-menu" role="listbox">
      {devices.map((device) => {
        const selected =
          device.deviceId === activeDeviceId ||
          (activeDeviceId === "default" && device.deviceId === devices[0]?.deviceId);
        return (
          <button
            key={device.deviceId || device.label}
            type="button"
            role="option"
            aria-selected={selected}
            className={selected ? "is-selected" : undefined}
            onClick={() => onSelect(device.deviceId)}
          >
            {device.label || "Unknown device"}
          </button>
        );
      })}
    </div>
  );
}

function TrayChip({
  icon,
  children,
  title,
  active,
  caret,
  pill,
  disabled,
  onClick,
}: {
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
  active?: boolean;
  caret?: boolean;
  pill?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`meet-tray-chip${active ? " is-active" : ""}${pill ? " is-pill" : ""}`}
      onClick={onClick}
    >
      {icon ? <span className="meet-tray-chip-icon">{icon}</span> : null}
      <span className="meet-tray-chip-label">{children}</span>
      {caret ? <ChevronDown className="meet-tray-chip-caret" /> : null}
    </button>
  );
}

function TrayGear({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button type="button" className="meet-tray-gear" title={title} onClick={onClick}>
      <Settings className="h-4 w-4" />
    </button>
  );
}

export function MeetingMediaControls() {
  const trayId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [openTray, setOpenTray] = useState<TrayKind | null>(null);
  const [deviceMenu, setDeviceMenu] = useState<"mic" | "speaker" | "camera" | null>(
    null,
  );
  const [effectsOpen, setEffectsOpen] = useState(false);

  const micToggle = useTrackToggle({ source: Track.Source.Microphone });
  const cameraToggle = useTrackToggle({
    source: Track.Source.Camera,
    captureOptions: HD_VIDEO_CAPTURE,
  });
  const micDevices = useMediaDeviceSelect({
    kind: "audioinput",
    requestPermissions: true,
  });
  const speakerDevices = useMediaDeviceSelect({
    kind: "audiooutput",
    requestPermissions: true,
  });
  const cameraDevices = useMediaDeviceSelect({
    kind: "videoinput",
    requestPermissions: true,
  });
  const { mode, supported: blurSupported, busy: blurBusy, applyMode } =
    useBackgroundEffects();

  const clearClose = useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const open = useCallback(
    (kind: TrayKind) => {
      clearClose();
      setOpenTray((current) => {
        if (current !== kind) {
          setDeviceMenu(null);
          setEffectsOpen(false);
        }
        return kind;
      });
    },
    [clearClose],
  );

  const scheduleClose = useCallback(() => {
    clearClose();
    closeTimer.current = window.setTimeout(() => {
      setOpenTray(null);
      setDeviceMenu(null);
      setEffectsOpen(false);
    }, 220);
  }, [clearClose]);

  const toggleTray = useCallback(
    (kind: TrayKind) => {
      clearClose();
      setOpenTray((current) => {
        if (current === kind) {
          setDeviceMenu(null);
          setEffectsOpen(false);
          return null;
        }
        setDeviceMenu(null);
        setEffectsOpen(false);
        return kind;
      });
    },
    [clearClose],
  );

  useEffect(() => {
    return () => clearClose();
  }, [clearClose]);

  useEffect(() => {
    if (!openTray) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenTray(null);
        setDeviceMenu(null);
        setEffectsOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenTray(null);
        setDeviceMenu(null);
        setEffectsOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openTray]);

  const micName = deviceLabel(
    micDevices.devices,
    micDevices.activeDeviceId,
    "Microphone",
  );
  const speakerName = deviceLabel(
    speakerDevices.devices,
    speakerDevices.activeDeviceId,
    "Speaker",
  );
  const cameraName = deviceLabel(
    cameraDevices.devices,
    cameraDevices.activeDeviceId,
    "Camera",
  );

  return (
    <div className="meet-media-group" ref={rootRef}>
      {openTray === "mic" ? (
        <div
          className="meet-media-tray"
          id={`${trayId}-mic`}
          role="dialog"
          aria-label="Audio options"
          onMouseEnter={clearClose}
          onMouseLeave={scheduleClose}
        >
          <div className="meet-media-tray-body">
            <div className="meet-media-tray-stack">
              <TrayChip
                icon={<Mic className="h-3.5 w-3.5" />}
                title="Choose microphone"
                caret
                pill
                active={deviceMenu === "mic"}
                onClick={() =>
                  setDeviceMenu((current) => (current === "mic" ? null : "mic"))
                }
              >
                {micName}
              </TrayChip>
              {speakerDevices.devices.length > 0 ? (
                <TrayChip
                  icon={<Volume2 className="h-3.5 w-3.5" />}
                  title="Choose speaker"
                  caret
                  pill
                  active={deviceMenu === "speaker"}
                  onClick={() =>
                    setDeviceMenu((current) =>
                      current === "speaker" ? null : "speaker",
                    )
                  }
                >
                  {speakerName}
                </TrayChip>
              ) : null}
            </div>
            <TrayGear
              title="Audio settings"
              onClick={() =>
                setDeviceMenu((current) => (current ? null : "mic"))
              }
            />
          </div>
          {deviceMenu === "mic" ? (
            <DeviceMenu
              devices={micDevices.devices}
              activeDeviceId={micDevices.activeDeviceId}
              onSelect={(id) => {
                void micDevices.setActiveMediaDevice(id);
                setDeviceMenu(null);
              }}
            />
          ) : null}
          {deviceMenu === "speaker" ? (
            <DeviceMenu
              devices={speakerDevices.devices}
              activeDeviceId={speakerDevices.activeDeviceId}
              onSelect={(id) => {
                void speakerDevices.setActiveMediaDevice(id);
                setDeviceMenu(null);
              }}
            />
          ) : null}
        </div>
      ) : null}

      {openTray === "camera" ? (
        <div
          className="meet-media-tray meet-media-tray-camera"
          id={`${trayId}-camera`}
          role="dialog"
          aria-label="Camera options"
          onMouseEnter={clearClose}
          onMouseLeave={scheduleClose}
        >
          <div className="meet-media-tray-body">
            <div className="meet-media-tray-stack">
              <TrayChip
                icon={<Video className="h-3.5 w-3.5" />}
                title="Choose camera"
                caret
                active={deviceMenu === "camera"}
                onClick={() =>
                  setDeviceMenu((current) =>
                    current === "camera" ? null : "camera",
                  )
                }
              >
                {cameraName}
              </TrayChip>
              {blurSupported ? (
                <>
                  <TrayChip
                    icon={<Aperture className="h-3.5 w-3.5" />}
                    title={
                      cameraToggle.enabled
                        ? "Blur background"
                        : "Turn on camera to blur"
                    }
                    active={mode !== "none"}
                    disabled={!cameraToggle.enabled || blurBusy}
                    onClick={() => {
                      void applyMode(mode === "none" ? "blur-light" : "none");
                      setEffectsOpen(false);
                    }}
                  >
                    Blur background
                  </TrayChip>
                  <TrayChip
                    title="Backgrounds and effects"
                    pill
                    active={effectsOpen}
                    disabled={!cameraToggle.enabled || blurBusy}
                    onClick={() => {
                      setDeviceMenu(null);
                      setEffectsOpen((value) => !value);
                    }}
                  >
                    Backgrounds and effects
                  </TrayChip>
                </>
              ) : null}
            </div>
            <TrayGear
              title="Camera settings"
              onClick={() => {
                setEffectsOpen(false);
                setDeviceMenu((current) =>
                  current === "camera" ? null : "camera",
                );
              }}
            />
          </div>
          {deviceMenu === "camera" ? (
            <DeviceMenu
              devices={cameraDevices.devices}
              activeDeviceId={cameraDevices.activeDeviceId}
              onSelect={(id) => {
                void cameraDevices.setActiveMediaDevice(id);
                setDeviceMenu(null);
              }}
            />
          ) : null}
          {effectsOpen ? (
            <div className="meet-device-menu" role="listbox">
              {BACKGROUND_MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={mode === item.id}
                  className={mode === item.id ? "is-selected" : undefined}
                  disabled={blurBusy || !cameraToggle.enabled}
                  onClick={() => {
                    void applyMode(item.id);
                    setEffectsOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`meet-compound${micToggle.enabled ? "" : " is-off"}`}>
        <button
          type="button"
          className="meet-compound-chevron"
          aria-label="Microphone options"
          aria-expanded={openTray === "mic"}
          aria-controls={`${trayId}-mic`}
          onMouseEnter={() => open("mic")}
          onMouseLeave={scheduleClose}
          onFocus={() => open("mic")}
          onClick={() => toggleTray("mic")}
        >
          {openTray === "mic" ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          className="meet-compound-main"
          aria-pressed={micToggle.enabled}
          aria-label={micToggle.enabled ? "Mute microphone" : "Unmute microphone"}
          disabled={micToggle.pending}
          onClick={() => void micToggle.toggle()}
        >
          {micToggle.enabled ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className={`meet-compound${cameraToggle.enabled ? "" : " is-off"}`}>
        <button
          type="button"
          className="meet-compound-chevron"
          aria-label="Camera options"
          aria-expanded={openTray === "camera"}
          aria-controls={`${trayId}-camera`}
          onMouseEnter={() => open("camera")}
          onMouseLeave={scheduleClose}
          onFocus={() => open("camera")}
          onClick={() => toggleTray("camera")}
        >
          {openTray === "camera" ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          className="meet-compound-main"
          aria-pressed={cameraToggle.enabled}
          aria-label={cameraToggle.enabled ? "Turn off camera" : "Turn on camera"}
          disabled={cameraToggle.pending}
          onClick={() => void cameraToggle.toggle()}
        >
          {cameraToggle.enabled ? (
            <Video className="h-4 w-4" />
          ) : (
            <VideoOff className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
