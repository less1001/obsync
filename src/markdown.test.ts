import { describe, expect, it } from "vitest";
import { formatArticleMarkdown, sanitizeFileName } from "./markdown";

describe("markdown helpers", () => {
  it("formats frontmatter and body", () => {
    const markdown = formatArticleMarkdown({
      id: "art_1",
      sourceUrl: "https://mp.weixin.qq.com/s/example",
      title: "标题",
      account: "账号",
      author: "作者",
      publishedAt: "2026-06-05",
      savedAt: "2026-06-05T12:00:00.000Z",
      markdown: "正文",
      parseStatus: "ok"
    });

    expect(markdown).toContain('source_url: "https://mp.weixin.qq.com/s/example"');
    expect(markdown).toContain('sync_id: "art_1"');
    expect(markdown).toContain("# 标题");
    expect(markdown).toContain("正文");
  });

  it("sanitizes unsafe file names", () => {
    expect(sanitizeFileName('2026 - a/b:c*?<>|"')).toBe("2026 - a b c");
  });
});
