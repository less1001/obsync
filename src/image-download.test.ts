import { describe, expect, it } from "vitest";
import {
  getHttpOrigin,
  getImageRefererCandidates,
  isHostOrSubdomain,
  isImageContentType,
  resolveImageExtension
} from "./image-download";

describe("image download helpers", () => {
  it("matches a host and its subdomains without matching lookalikes", () => {
    expect(isHostOrSubdomain("sns-webpic-qc.xhscdn.com", "xhscdn.com")).toBe(true);
    expect(isHostOrSubdomain("xhscdn.com", "xhscdn.com")).toBe(true);
    expect(isHostOrSubdomain("notxhscdn.com", "xhscdn.com")).toBe(false);
  });

  it("normalizes valid HTTP origins and rejects other protocols", () => {
    expect(getHttpOrigin("https://example.com/article/1")).toBe("https://example.com/");
    expect(getHttpOrigin("file:///tmp/image.jpg")).toBeUndefined();
    expect(getHttpOrigin("not a url")).toBeUndefined();
  });

  it("uses the Xiaohongshu referer before falling back to no referer", () => {
    expect(
      getImageRefererCandidates(
        "https://sns-webpic-qc.xhscdn.com/example.jpg",
        "https://www.xiaohongshu.com/explore/123"
      )
    ).toEqual(["https://www.xiaohongshu.com/", ""]);
  });

  it("keeps the WeChat referer for WeChat image hosts", () => {
    expect(
      getImageRefererCandidates(
        "https://mmbiz.qpic.cn/example.jpg",
        "https://mp.weixin.qq.com/s/example"
      )
    ).toEqual(["https://mp.weixin.qq.com/", ""]);
  });

  it("uses the article origin for other websites", () => {
    expect(
      getImageRefererCandidates(
        "https://cdn.example.net/image.webp",
        "https://example.com/posts/1"
      )
    ).toEqual(["https://example.com/", ""]);
  });

  it("recognizes image responses and maps common image extensions", () => {
    expect(isImageContentType("image/jpeg; charset=binary")).toBe(true);
    expect(isImageContentType("text/html")).toBe(false);
    expect(resolveImageExtension("image/avif")).toBe(".avif");
    expect(resolveImageExtension("image/webp")).toBe(".webp");
    expect(resolveImageExtension("image/jpeg")).toBe(".jpg");
  });
});
