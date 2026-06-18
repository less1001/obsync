export interface PublicArticle {
  id: string;
  sourceUrl: string;
  title: string;
  account?: string;
  author?: string;
  publishedAt?: string;
  savedAt: string;
  markdown: string;
  excerpt?: string;
  parseStatus: "ok" | "failed";
  parseError?: string;
}

export interface BindStartResponse {
  code: string;
  expiresAt: string;
}

export interface BindStatusResponse {
  status: "pending" | "confirmed" | "expired";
  token?: string;
  userId?: string;
}

export interface SyncArticlesResponse {
  articles: PublicArticle[];
}
