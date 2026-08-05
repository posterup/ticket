"use client";

/**
 * The camera at the door.
 *
 * Tickets have carried a `qrToken` since the first order was settled, and until
 * now nothing in the building could read one — check-in was a list of names and
 * a text box. A QR nobody can scan is a picture.
 *
 * Uses the browser's built-in `BarcodeDetector`, which is native in Chrome and
 * Android WebView and is what a door phone will be running. That is a
 * deliberate choice over shipping a decoder: a WASM scanner is hundreds of
 * kilobytes on a device that is already the venue's bottleneck, and the native
 * detector is hardware-accelerated. Where it is missing — desktop Safari and
 * Firefox — this renders a short explanation and the panel's typed entry stays
 * exactly as it was, so the door never depends on the camera working.
 *
 * Scanning is not the authority on anything. It resolves a token and hands it
 * up; the server's unique check-in row is still what decides whether someone
 * gets in, so a double scan is refused there rather than here.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";

/** How long the same token is ignored after a read, in ms. */
const REPEAT_GUARD = 2500;

/** Detection interval. 8/s reads a code the instant it is steady without
 *  pinning the CPU of a cheap phone that is also holding a video stream. */
const SCAN_INTERVAL = 125;

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
}

function detectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  return ctor ?? null;
}

export function QrScanner({ onScan }: { onScan: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ token: string; at: number } | null>(null);

  const [supported, setSupported] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolved on the client only: `BarcodeDetector` does not exist during SSR,
  // and rendering "unsupported" on the server would flash for everyone.
  useEffect(() => {
    setSupported(detectorCtor() !== null && Boolean(navigator.mediaDevices));
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }, []);

  // The camera light staying on after someone navigates away is the kind of
  // thing that gets an app uninstalled.
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setError(null);
    const Ctor = detectorCtor();
    if (!Ctor) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // The rear camera: a door phone is pointed away from its operator.
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "دسترسی به دوربین داده نشد. می‌توانید کد را دستی وارد کنید."
          : "دوربین در دسترس نیست. می‌توانید کد را دستی وارد کنید.",
      );
      stop();
    }
  }, [stop]);

  useEffect(() => {
    if (!running) return;
    const Ctor = detectorCtor();
    if (!Ctor) return;

    const detector = new Ctor({ formats: ["qr_code"] });
    let live = true;

    const timer = setInterval(async () => {
      const video = videoRef.current;
      if (!live || !video || video.readyState < 2) return;

      let codes: DetectedBarcode[] = [];
      try {
        codes = await detector.detect(video);
      } catch {
        // A dropped frame mid-detect is normal; the next tick retries.
        return;
      }

      const raw = codes[0]?.rawValue?.trim();
      if (!raw) return;

      // Holding a ticket steady in front of the lens produces a read every
      // tick. Without this the server would take eight duplicate check-ins a
      // second and the operator would see a wall of "already admitted".
      const last = lastRef.current;
      if (last && last.token === raw && Date.now() - last.at < REPEAT_GUARD) {
        return;
      }
      lastRef.current = { token: raw, at: Date.now() };
      onScan(raw);
    }, SCAN_INTERVAL);

    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [running, onScan]);

  if (supported === null) {
    return <div className="mb-4 h-28 rounded-md border border-dashed border-border bg-subtle" />;
  }

  if (!supported) {
    return (
      <div className="mb-4 grid h-28 place-items-center rounded-md border border-dashed border-border bg-subtle px-4 text-center">
        <div className="flex flex-col items-center gap-1 text-muted">
          <CameraOff className="size-6" aria-hidden />
          <span className="text-xs leading-relaxed">
            این مرورگر اسکن دوربینی را پشتیبانی نمی‌کند. کد بلیت را وارد کنید.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="relative overflow-hidden rounded-md border border-border bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className={running ? "block h-44 w-full object-cover" : "hidden"}
        />

        {running ? (
          <>
            {/* A frame to aim at. Pure affordance — detection uses the whole
                frame, so a code outside the box still reads. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <div className="size-28 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={stop}
              className="absolute top-2 end-2 shadow-sm"
            >
              توقف دوربین
            </Button>
          </>
        ) : (
          <div className="grid h-28 place-items-center bg-subtle">
            <Button size="sm" variant="secondary" onClick={() => void start()}>
              <Camera aria-hidden />
              روشن کردن دوربین
            </Button>
          </div>
        )}
      </div>

      {running ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <ScanLine className="size-3.5" aria-hidden />
          کد بلیت را مقابل دوربین بگیرید
        </p>
      ) : null}

      {error ? (
        <p role="status" className="mt-2 text-xs text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
