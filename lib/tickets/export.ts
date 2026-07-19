import { toPng } from "html-to-image";

/**
 * Render a DOM node to a high-resolution PNG and trigger a browser download.
 * The ticket preview uses only inline/data-URL assets, so the capture is fully
 * self-contained (no external requests).
 */
export async function downloadNodeAsPng(
  node: HTMLElement,
  filename: string,
): Promise<void> {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    // Fill transparent corners so rounded edges look clean on any viewer.
    backgroundColor: "#ffffff",
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/**
 * Build an ASCII-safe download filename from an event title. Non-ASCII titles
 * (e.g. Persian) fall back to a stable stem so the download is reliable and
 * portable across operating systems.
 */
export function ticketFileName(title: string): string {
  const stem = title
    .trim()
    .replace(/[^\x20-\x7E]+/g, "") // drop non-ASCII (Persian, emoji, …)
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `poster-ticket${stem ? `-${stem}` : ""}.png`;
}
