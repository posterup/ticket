"use client";

/**
 * The last net: an error in the root layout itself.
 *
 * `app/error.tsx` renders *inside* the layout, so it cannot catch the layout
 * failing — the font import, the providers, the shell. Only this can, and it
 * replaces the whole document, which is why it has to supply its own `<html>`
 * and `<body>`.
 *
 * Styled inline rather than with Tailwind classes. If the layout did not
 * render, its stylesheet link may not be in the document either, and a fallback
 * that depends on the thing that just broke is not a fallback. `dir="rtl"` is
 * set here for the same reason: the attribute lives on the layout's `<html>`,
 * which is precisely what is missing.
 *
 * Deliberately plain. No header, no footer, no icons — every import here is
 * another thing that can fail on the way to telling someone the site broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#fdfcff",
          color: "#14101f",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            پوستر موقتاً در دسترس نیست
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.875rem",
              lineHeight: 1.8,
              color: "#5b5470",
            }}
          >
            خطایی رخ داد و صفحه بارگذاری نشد. چند لحظه بعد دوباره تلاش کنید.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.65rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#ffffff",
              background: "#e10e7c",
              border: "none",
              borderRadius: "0.6rem",
              cursor: "pointer",
            }}
          >
            تلاش دوباره
          </button>
          {error.digest ? (
            <p
              dir="ltr"
              style={{
                marginTop: "1.5rem",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "#71688d",
              }}
            >
              {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
