"use client";

/**
 * The scannable code on a ticket.
 *
 * Drawn **on the client, from the token already in hand**. That constraint
 * decides the whole design: a QR served from an API route is a ticket that
 * fails in a venue basement with no signal, and the one moment a ticket has to
 * work is the moment someone is standing at the door holding a phone with one
 * bar. Once this page has loaded, nothing here needs the network again.
 *
 * The encoder is imported lazily, so the Reed–Solomon machinery only lands when
 * a ticket is actually opened — the list itself, and every other route, pays
 * nothing for it.
 *
 * Only the *module matrix* comes from the library; the SVG is built here as
 * real React elements. The library can also emit SVG markup directly, but that
 * would mean `dangerouslySetInnerHTML` on every ticket, and there is no reason
 * to open that door to save fifteen lines.
 *
 * Deliberately black on white in both themes. A QR is not decoration: scanners
 * want maximum contrast and a genuine quiet zone, and a tasteful dark-mode grey
 * code is one that gets scanned three times.
 */

import { useEffect, useState } from "react";

/** Modules of white space around the code. Below 4 many scanners struggle. */
const QUIET_ZONE = 4;

/** Decoded matrices, so collapsing and reopening a ticket is instant. */
const CACHE = new Map<string, { size: number; path: string }>();

interface Matrix {
  size: number;
  path: string;
}

export function TicketQr({
  token,
  size = 200,
  className,
}: {
  token: string;
  size?: number;
  className?: string;
}) {
  const [matrix, setMatrix] = useState<Matrix | null>(
    () => CACHE.get(token) ?? null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const cached = CACHE.get(token);
    if (cached) {
      setMatrix(cached);
      return;
    }

    let live = true;
    import("qrcode")
      .then((mod) => {
        // Level M survives a creased printout and a smudged screen without
        // inflating the code the way Q or H would.
        const qr = mod.default.create(token, { errorCorrectionLevel: "M" });
        const built = toPath(qr.modules.size, qr.modules.data);
        CACHE.set(token, built);
        if (live) setMatrix(built);
      })
      .catch(() => live && setFailed(true));

    return () => {
      live = false;
    };
  }, [token]);

  // The token is always rendered as text alongside this, so a failed encode
  // degrades to something the door can still key in by hand.
  if (failed) return null;

  const span = (matrix?.size ?? 21) + QUIET_ZONE * 2;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="کد ورود این بلیت"
    >
      <rect width={span} height={span} fill="#ffffff" />
      {matrix ? (
        <path
          transform={`translate(${QUIET_ZONE} ${QUIET_ZONE})`}
          d={matrix.path}
          fill="#000000"
        />
      ) : null}
    </svg>
  );
}

/**
 * One `<path>` for the whole code rather than a `<rect>` per module.
 *
 * A version-3 code is 29×29 with ~420 dark modules — that many SVG nodes each,
 * on a page that may list dozens of tickets. Merging horizontal runs into
 * single rectangles roughly halves it (measured: 420 → 213, 556 → 277). QR is
 * high-frequency by design, so 2× is about the ceiling here; it is worth having
 * and not worth a cleverer packing.
 */
export function toPath(size: number, data: Uint8Array): Matrix {
  const parts: string[] = [];

  for (let y = 0; y < size; y++) {
    let runStart = -1;
    for (let x = 0; x <= size; x++) {
      const dark = x < size && data[y * size + x] === 1;
      if (dark && runStart < 0) runStart = x;
      if (!dark && runStart >= 0) {
        parts.push(`M${runStart} ${y}h${x - runStart}v1h-${x - runStart}z`);
        runStart = -1;
      }
    }
  }

  return { size, path: parts.join("") };
}
