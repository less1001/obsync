import type { PublicArticle } from "@obsync/shared";

export function formatArticleMarkdown(article: PublicArticle): string {
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

  return `${frontmatter.join("\n")}\n\n# ${article.title}\n\n${article.markdown.trim()}\n`;
}

export function sanitizeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|#^[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
