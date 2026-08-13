import type { PublicArticle } from "@obsync/shared";

export function parseTemplate(article: PublicArticle, customTemplate?: string) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8);
  const publishDateStr = (article.publishedAt || article.savedAt || "").slice(0, 10);
  const syncDateStr = (article.savedAt || "").slice(0, 10);

  const values: Record<string, string> = {
    title: article.title || "",
    author: article.author || "",
    account: article.account || "",
    url: article.sourceUrl || "",
    publish_date: publishDateStr,
    publish_time: article.publishedAt || article.savedAt || "",
    sync_date: syncDateStr,
    sync_time: article.savedAt || "",
    sync_id: article.id || "",
    date: dateStr,
    time: timeStr
  };

  function replaceVars(str: string): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return values[key] !== undefined ? values[key] : match;
    });
  }

  let fileNameTemplate = "";
  let frontmatterStr = "";

  if (customTemplate && customTemplate.trim()) {
    let lines = customTemplate.split("\n");
    // Find if there is a file_name key
    const fileNameIndex = lines.findIndex(line => line.trim().startsWith("file_name:"));
    if (fileNameIndex !== -1) {
      const line = lines[fileNameIndex];
      const match = line.match(/file_name:\s*(['"]?)(.*?)\1\s*$/);
      if (match) {
        fileNameTemplate = match[2];
      }
      // Remove the file_name line from the template
      lines.splice(fileNameIndex, 1);
    }

    let parsed = replaceVars(lines.join("\n")).trim();
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

  const content = `${frontmatterStr}\n\n# ${article.title}\n\n${article.markdown.trim()}\n`;
  const resolvedFileName = fileNameTemplate ? replaceVars(fileNameTemplate) : "";

  return { content, resolvedFileName };
}

export function formatArticleMarkdown(article: PublicArticle, customTemplate?: string): string {
  return parseTemplate(article, customTemplate).content;
}

export function resolveArticleFileName(article: PublicArticle, customTemplate?: string): string {
  const { resolvedFileName } = parseTemplate(article, customTemplate);
  if (resolvedFileName) {
    return sanitizeFileName(resolvedFileName);
  }
  const date = (article.publishedAt || article.savedAt || "").slice(0, 10);
  return sanitizeFileName(`${date} - ${article.title || "未命名公众号文章"}`);
}

export function sanitizeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|#^[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Encode a path for use inside a Markdown link destination.
 * sanitizeFileName keeps ( ) & % ' in folder names (valid in file names),
 * but those characters break Markdown link syntax. Percent-encode them so
 * Obsidian can resolve the link back to the real file.
 * % must be encoded first, otherwise the escapes below get re-encoded.
 */
export function encodeMarkdownLinkPath(path: string): string {
  return path
    .replace(/%/g, "%25")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/&/g, "%26")
    .replace(/'/g, "%27")
    .replace(/ /g, "%20");
}
