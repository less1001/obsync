export const IMAGE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36";

export function isHostOrSubdomain(hostname: string, domain: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  const normalizedDomain = domain.toLowerCase();
  return normalizedHostname === normalizedDomain || normalizedHostname.endsWith(`.${normalizedDomain}`);
}

export function getHttpOrigin(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return `${parsed.origin}/`;
  } catch {
    return undefined;
  }
}

/**
 * Return referers from the most specific candidate to the most permissive one.
 * The empty string means retry without a Referer header.
 */
export function getImageRefererCandidates(imageUrl: string, sourceUrl?: string): string[] {
  const candidates: string[] = [];

  try {
    const hostname = new URL(imageUrl).hostname;
    if (isHostOrSubdomain(hostname, "xhscdn.com")) {
      candidates.push("https://www.xiaohongshu.com/");
    } else if (
      isHostOrSubdomain(hostname, "qpic.cn") ||
      isHostOrSubdomain(hostname, "qlogo.cn") ||
      isHostOrSubdomain(hostname, "weixin.qq.com")
    ) {
      candidates.push("https://mp.weixin.qq.com/");
    }
  } catch {
    // Invalid image URLs are handled by the caller's request failure.
  }

  const sourceOrigin = getHttpOrigin(sourceUrl);
  if (sourceOrigin && !candidates.includes(sourceOrigin)) {
    candidates.push(sourceOrigin);
  }

  candidates.push("");
  return candidates;
}

export function isImageContentType(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("image/");
}

export function resolveImageExtension(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("svg")) return ".svg";
  if (normalized.includes("avif")) return ".avif";
  return ".jpg";
}
