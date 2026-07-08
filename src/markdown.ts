import type { PublicArticle } from "@obsync/shared";

export function formatArticleMarkdown(article: PublicArticle, customTemplate?: string): string {
  let frontmatterStr = "";

  if (customTemplate && customTemplate.trim()) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);
    const authorVal = article.author || article.account || "";

    let parsed = customTemplate
      .replace(/\{\{title\}\}/g, article.title || "")
      .replace(/\{\{author\}\}/g, authorVal)
      .replace(/\{\{account\}\}/g, article.account || "")
      .replace(/\{\{url\}\}/g, article.sourceUrl || "")
      .replace(/\{\{publish_time\}\}/g, article.publishedAt || "")
      .replace(/\{\{sync_time\}\}/g, article.savedAt || "")
      .replace(/\{\{sync_id\}\}/g, article.id || "")
      .replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{time\}\}/g, timeStr);

    parsed = parsed.trim();
    if (!parsed.startsWith("---")) {
      parsed = "---\n" + parsed;
    }
    if (!parsed.endsWith("---")) {
      parsed = parsed + "\n---";
    }
    frontmatterStr = parsed;
  } else {
    const frontmatter = [
      "---",
      `source_url: ${JSON.stringify(article.sourceUrl)}`,
      `title: ${JSON.stringify(article.title)}`,
      article.account ? `account: ${JSON.stringify(article.account)}` : undefined,
      article.author ? `author: ${JSON.stringify(article.author)}` : undefined,
      article.publishedAt ? `published_at: ${JSON.stringify(article.publishedAt)}` : undefined,
      `saved_at: ${JSON.stringify(article.savedAt)}`,
      `sync_id: ${JSON.stringify(article.id)}`,
      `parse_status: ${JSON.stringify(article.parseStatus)}`,
      article.parseError ? `parse_error: ${JSON.stringify(article.parseError)}` : undefined,
      "---"
    ].filter(Boolean);
    frontmatterStr = frontmatter.join("\n");
  }

  return `${frontmatterStr}\n\n# ${article.title}\n\n${article.markdown.trim()}\n`;
}

export function sanitizeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|#^[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
