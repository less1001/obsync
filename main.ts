import {
  App,
  Notice,
  Plugin,
  PluginSettingTab,
  requestUrl,
  Setting,
  TFolder,
  TFile,
  normalizePath
} from "obsidian";
import type {
  BindStartResponse,
  BindStatusResponse,
  PublicArticle,
  SyncArticlesResponse
} from "@obsync/shared";
import { formatArticleMarkdown, resolveArticleFileName, sanitizeFileName } from "./src/markdown";

interface ObsyncSettings {
  settingsVersion?: number;
  apiBaseUrl: string;
  token: string;
  userId: string;
  syncFolder: string;
  deviceName: string;
  syncIntervalMinutes: number;
  localizeImages: boolean;
  subfolderByAccount: boolean;
  customFrontmatter: string;
}

const CLOUDFLARE_API_BASE_URL = "https://ob.agentok.top";
const LEGACY_API_BASE_URL = "https://cloud1-d3gvuz4256fba5e84-1443228054.ap-shanghai.app.tcloudbase.com/obsync";

const DEFAULT_SETTINGS: ObsyncSettings = {
  settingsVersion: 3,
  apiBaseUrl: CLOUDFLARE_API_BASE_URL,
  token: "",
  userId: "",
  syncFolder: "微信公众号文章",
  deviceName: "Obsidian",
  syncIntervalMinutes: 1,
  localizeImages: true,
  subfolderByAccount: false,
  customFrontmatter: ""
};

export default class ObsyncPlugin extends Plugin {
  settings: ObsyncSettings = DEFAULT_SETTINGS;
  statusBarEl!: HTMLElement;
  private lastSyncTime: Date | null = null;
  private syncInterval: number | undefined;
  private bindingPollInterval: number | undefined;
  private activeSync: Promise<void> | null = null;

  async onload() {
    await this.loadSettings();
    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar("idle");
    this.addSettingTab(new ObsyncSettingTab(this.app, this));
    this.addCommand({
      id: "obsync-sync-now",
      name: "立即同步微信公众号文章",
      callback: async () => {
        await this.syncNow(true);
      }
    });
    this.app.workspace.onLayoutReady(() => {
      void this.syncNow(false);
    });
  }

  onunload() {
    if (this.bindingPollInterval) {
      window.clearInterval(this.bindingPollInterval);
    }
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<ObsyncSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    this.settings.apiBaseUrl = CLOUDFLARE_API_BASE_URL;
    if (!data?.settingsVersion) {
      if (this.settings.syncIntervalMinutes === 5) {
        this.settings.syncIntervalMinutes = 1;
      }
    }
    if (this.settings.settingsVersion !== 3) this.settings.settingsVersion = 3;
    await this.saveData(this.settings);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async startBinding(): Promise<BindStartResponse> {
    const response = await apiRequest<BindStartResponse>(this.settings.apiBaseUrl, "/v1/bind/start", {
      method: "POST",
      token: this.settings.token || undefined,
      body: {
        deviceName: this.settings.deviceName || "Obsidian",
        vaultName: this.app.vault.getName()
      }
    });
    return response;
  }

  pollBinding(code: string, onStatus: (status: BindStatusResponse) => void) {
    if (this.bindingPollInterval) {
      window.clearInterval(this.bindingPollInterval);
    }
    this.bindingPollInterval = window.setInterval(() => {
      void (async () => {
        try {
          const status = await apiRequest<BindStatusResponse>(
            this.settings.apiBaseUrl,
            `/v1/bind/status?code=${encodeURIComponent(code)}`
          );
          onStatus(status);
          if (status.status === "confirmed" && status.token) {
            this.settings.token = status.token;
            this.settings.userId = status.userId ?? "";
            await this.saveSettings();
            window.clearInterval(this.bindingPollInterval);
            this.bindingPollInterval = undefined;
            new Notice("Obsync 绑定成功。");
            await this.syncNow(true);
          }
          if (status.status === "expired") {
            window.clearInterval(this.bindingPollInterval);
            this.bindingPollInterval = undefined;
          }
        } catch (error) {
          console.error("Obsync binding poll failed", error);
        }
      })();
    }, 2500);
  }

  async syncNow(showNotice = false) {
    if (this.activeSync) {
      if (showNotice) new Notice("Obsync 正在同步，请稍候。");
      return this.activeSync;
    }

    this.activeSync = this.runSync(showNotice);
    try {
      await this.activeSync;
    } finally {
      this.activeSync = null;
    }
  }

  private async runSync(showNotice = false) {
    if (!this.settings.token) {
      if (showNotice) new Notice("Obsync 尚未绑定。");
      return;
    }

    this.updateStatusBar("syncing");

    try {
      const response = await apiRequest<SyncArticlesResponse>(this.settings.apiBaseUrl, "/v1/sync/articles", {
        token: this.settings.token
      });

      // Build a map of existing sync_ids to paths for deduplication
      const syncIdToPath = new Map<string, string>();
      const files = this.app.vault.getMarkdownFiles();
      for (const file of files) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache && cache.frontmatter && cache.frontmatter.sync_id) {
          syncIdToPath.set(String(cache.frontmatter.sync_id), file.path);
        }
      }

      let written = 0;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const article of response.articles) {
        try {
          const isBinary = article.contentKind === "file" ||
            (!article.contentKind && article.sourceUrl.includes("/s/file-"));
          
          let path = "";
          if (isBinary) {
            const folder = normalizePath(this.settings.syncFolder || DEFAULT_SETTINGS.syncFolder);
            const fileName = sanitizeFileName(article.title || "未命名文件");
            path = normalizePath(`${folder}/${fileName}`);
          } else {
            const existingPath = syncIdToPath.get(article.id);
            if (existingPath) {
              path = existingPath;
            }
          }

          if (!isBinary && path && this.app.vault.getAbstractFileByPath(path) instanceof TFile) {
            await this.updateArticle(path, article);
            updated += 1;
          } else if (isBinary && path && this.app.vault.getAbstractFileByPath(path)) {
            await this.writeBinaryFile(article);
            updated += 1;
          } else {
            if (isBinary) {
              path = await this.writeBinaryFile(article);
            } else {
              path = await this.writeArticle(article);
            }
            written += 1;
          }

          await apiRequest(this.settings.apiBaseUrl, `/v1/sync/articles/${article.id}/ack`, {
            method: "POST",
            token: this.settings.token,
            body: { writtenPath: path }
          });
        } catch (err) {
          console.error(`Failed to sync article ${article.id}:`, err);
          failed += 1;
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }

      if (failed > 0 && written === 0 && updated === 0) {
        throw new Error(`同步失败: ${errors.slice(0, 3).join("; ")}`);
      }

      this.updateStatusBar(failed > 0 ? "error" : "success");

      if (showNotice) {
        const parts: string[] = [];
        if (written > 0) parts.push(`已同步 ${written} 篇`);
        if (updated > 0) parts.push(`已更新 ${updated} 篇`);
        if (failed > 0) parts.push(`失败 ${failed} 篇`);
        
        if (parts.length > 0) {
          new Notice(`Obsync 同步结果: ${parts.join("，")}`);
        } else {
          new Notice("Obsync 暂无新文章。");
        }
      }
    } catch (error) {
      console.error("Obsync sync failed", error);
      this.updateStatusBar("error");
      if (showNotice) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Obsync 同步失败：${message}`);
      }
    }
  }



  private updateStatusBar(status: "syncing" | "success" | "error" | "idle") {
    if (!this.statusBarEl) return;
    if (status === "syncing") {
      this.statusBarEl.setText("Obsync: 正在同步...");
    } else if (status === "success") {
      this.lastSyncTime = new Date();
      const timeStr = this.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.statusBarEl.setText(`Obsync: 同步于 ${timeStr}`);
    } else if (status === "error") {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.statusBarEl.setText(`Obsync: 同步失败 ${timeStr}`);
    } else if (status === "idle") {
      if (this.lastSyncTime) {
        const timeStr = this.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.statusBarEl.setText(`Obsync: 同步于 ${timeStr}`);
      } else {
        this.statusBarEl.setText("Obsync: 未同步");
      }
    }
  }

  private async writeArticle(article: PublicArticle): Promise<string> {
    let folder = normalizePath(this.settings.syncFolder || DEFAULT_SETTINGS.syncFolder);
    const accountName = article.account || article.author;
    if (this.settings.subfolderByAccount && accountName) {
      folder = normalizePath(`${folder}/${sanitizeFileName(accountName)}`);
    }
    await ensureFolder(this.app, folder);

    const baseName = resolveArticleFileName(article, this.settings.customFrontmatter);
    const path = await nextAvailablePath(this.app, folder, baseName);

    let content = formatArticleMarkdown(article, this.settings.customFrontmatter);
    // Only localize images if the setting is enabled
    if (this.settings.localizeImages) {
      try {
        content = await this.localizeImages(content, folder, article.id);
      } catch (err) {
        console.warn("Obsync: Image localization failed, using original URLs", err);
      }
    }

    await this.app.vault.create(path, content);
    return path;
  }

  private async updateArticle(path: string, article: PublicArticle): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;

    let content = formatArticleMarkdown(article, this.settings.customFrontmatter);
    if (this.settings.localizeImages) {
      content = await this.localizeImages(
        content,
        file.parent?.path || this.settings.syncFolder,
        article.id
      );
    }
    await this.app.vault.modify(file, content);
  }

  private async writeBinaryFile(article: PublicArticle): Promise<string> {
    let folder = normalizePath(this.settings.syncFolder || DEFAULT_SETTINGS.syncFolder);
    const accountName = article.account || article.author;
    if (this.settings.subfolderByAccount && accountName) {
      folder = normalizePath(`${folder}/${sanitizeFileName(accountName)}`);
    }
    await ensureFolder(this.app, folder);

    const fileName = sanitizeFileName(article.title || "未命名文件");
    const path = normalizePath(`${folder}/${fileName}`);
    
    const buffer = base64ToArrayBuffer(article.markdown);
    const existingFile = this.app.vault.getAbstractFileByPath(path);
    if (existingFile instanceof TFile) {
      await this.app.vault.modifyBinary(existingFile, buffer);
    } else if (!existingFile) {
      await this.app.vault.createBinary(path, buffer);
    }
    return path;
  }

  private async localizeImages(markdownContent: string, articleFolder: string, articleId: string): Promise<string> {
    const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    const matches = [...markdownContent.matchAll(imageRegex)];
    
    if (matches.length === 0) return markdownContent;

    const articleAttachmentFolder = sanitizeFileName(articleId) || "article";
    const attachmentFolder = normalizePath(`${articleFolder}/attachments/${articleAttachmentFolder}`);
    await ensureFolder(this.app, attachmentFolder);

    let result = markdownContent;
    let downloadCount = 0;
    
    for (const match of matches) {
      const [fullMatch, altText, imageUrl] = match;
      try {
        const response = await requestUrl({
          url: imageUrl,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://mp.weixin.qq.com/"
          }
        });
        if (response.status >= 200 && response.status < 300) {
          // Determine file extension from URL or content-type
          const contentType = response.headers["content-type"] || "";
          let ext = ".jpg";
          if (contentType.includes("png")) ext = ".png";
          else if (contentType.includes("gif")) ext = ".gif";
          else if (contentType.includes("webp")) ext = ".webp";
          else if (contentType.includes("svg")) ext = ".svg";
          
          const imgFileName = `img_${downloadCount + 1}${ext}`;
          const imgPath = normalizePath(`${attachmentFolder}/${imgFileName}`);
          
          // Write the binary content
          const existing = this.app.vault.getAbstractFileByPath(imgPath);
          if (existing instanceof TFile) {
            await this.app.vault.modifyBinary(existing, response.arrayBuffer);
          } else if (!existing) {
            await this.app.vault.createBinary(imgPath, response.arrayBuffer);
          }
          
          // Replace the URL with relative path
          const relativePath = `attachments/${articleAttachmentFolder}/${imgFileName}`;
          result = result.replace(fullMatch, `![${altText}](${relativePath})`);
          downloadCount++;
        }
      } catch (err) {
        // If download fails, keep the original URL
        console.warn(`Obsync: Failed to download image: ${imageUrl}`, err);
      }
    }
    
    if (downloadCount > 0) {
      console.log(`Obsync: Downloaded ${downloadCount} images for article`);
    }
    
    return result;
  }
}

class ObsyncSettingTab extends PluginSettingTab {
  private bindCode = "";
  private bindStatus = "";

  constructor(app: App, private readonly plugin: ObsyncPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Obsync 同步助手").setHeading();
    containerEl.createEl("p", {
      text: this.plugin.settings.token
        ? "已成功绑定。如需将其他手机（如第二台手机或家人的微信）也同步到当前笔记库，请点击下方的生成按钮。"
        : "请先点击下方的生成按钮获取绑定码，并在微信小程序“Obsidian同步助手”中输入以连接当前笔记库。"
    });

    new Setting(containerEl)
      .setName("设备名称")
      .setDesc("绑定时显示的电脑名称。")
      .addText((text) =>
        text.setValue(this.plugin.settings.deviceName).onChange(async (value) => {
          this.plugin.settings.deviceName = value || "Obsidian";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("同步文件夹")
      .setDesc("公众号文章会写入这个文件夹。")
      .addText((text) =>
        text.setValue(this.plugin.settings.syncFolder).onChange(async (value) => {
          this.plugin.settings.syncFolder = value || DEFAULT_SETTINGS.syncFolder;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("按公众号创建子文件夹")
      .setDesc("开启后，文章将按公众号名称保存在对应的子文件夹内，更方便分类查找。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.subfolderByAccount).onChange(async (value) => {
          this.plugin.settings.subfolderByAccount = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("下载文章图片到本地")
      .setDesc("避免微信防盗链导致图片无法显示，实现文章与图片的永久防删、永久离线保存。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.localizeImages).onChange(async (value) => {
          this.plugin.settings.localizeImages = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("自定义 Frontmatter 模板 (选填)")
      .setDesc("自定义笔记开头的文档属性。可在模板中加 file_name 自定义文件名（如 file_name: \"{{publish_date}} - {{title}}\"）。留空代表使用默认格式。")
      .addTextArea((text) => {
        text.inputEl.rows = 3;
        text.inputEl.cols = 40;
        text
          .setPlaceholder(
            `支持变量：{{title}}、{{author}}、{{account}}、{{url}}、{{publish_date}}、{{publish_time}}、{{sync_date}}、{{sync_time}}、{{date}}、{{time}}、{{sync_id}}`
          )
          .setValue(this.plugin.settings.customFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.customFrontmatter = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("生成绑定码")
      .setDesc(this.plugin.settings.token ? "已成功绑定。如需将其他手机（如第二台手机或家人的微信）也同步到当前笔记库，可再次生成绑定码。" : "在微信小程序“Obsidian同步助手”中输入此绑定码，即可将该手机与当前笔记库连接。")
      .addButton((button) =>
        button.setButtonText("生成").setCta().onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("生成中...");
          try {
            const bind = await this.plugin.startBinding();
            this.bindCode = bind.code;
            this.bindStatus = `有效期至 ${new Date(bind.expiresAt).toLocaleTimeString()}`;
            new Notice(`Obsync 绑定码：${bind.code}`);
            this.plugin.pollBinding(bind.code, (status) => {
              this.bindStatus = status.status;
              this.display();
            });
            this.display();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            new Notice(`生成绑定码失败：${message}`);
            this.bindStatus = `失败：${message}`;
            this.display();
          } finally {
            button.setDisabled(false);
            button.setButtonText("生成");
          }
        })
      );

    if (this.bindCode) {
      containerEl.createDiv({ cls: "obsync-setting-code", text: this.bindCode });
      containerEl.createDiv({ cls: "obsync-setting-muted", text: this.bindStatus });
    }

    new Setting(containerEl)
      .setName("立即同步")
      .setDesc(this.plugin.settings.token ? "立即拉取小程序中已保存的文章。" : "请先完成绑定。")
      .addButton((button) =>
        button.setButtonText("同步").onClick(async () => {
          await this.plugin.syncNow(true);
        })
      );

    new Setting(containerEl)
      .setName("解除绑定")
      .setDesc("清除当前笔记库中的绑定信息。")
      .addButton((button) =>
        button.setButtonText("解除本地绑定").onClick(async () => {
          this.plugin.settings.token = "";
          this.plugin.settings.userId = "";
          await this.plugin.saveSettings();
          new Notice("Obsync 已解除本地绑定。");
          this.display();
        })
      );

    new Setting(containerEl)
      .setName("联系开发者")
      .setDesc("在使用过程中有任何问题、建议，或想加入用户群，欢迎添加微信反馈。")
      .addButton((button) =>
        button
          .setButtonText("复制微信号")
          .onClick(() => {
            navigator.clipboard.writeText("vkdefi");
            new Notice("已复制");
          })
      );
  }
}

interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

async function apiRequest<T = unknown>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }

  const response = await requestUrl({
    url: `${baseUrl.replace(/\/+$/, "")}${path}`,
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status < 200 || response.status >= 300) {
    const body = typeof response.text === "string" ? response.text : "";
    throw new Error(`API request failed: ${response.status}${body ? ` ${body}` : ""}`);
  }
  return response.json as T;
}

async function ensureFolder(app: App, folderPath: string) {
  const parts = folderPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) {
      await app.vault.createFolder(current);
    } else if (!(existing instanceof TFolder)) {
      throw new Error(`${current} exists and is not a folder.`);
    }
  }
}

async function nextAvailablePath(app: App, folder: string, baseName: string): Promise<string> {
  let candidate = normalizePath(`${folder}/${baseName}.md`);
  let index = 2;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = normalizePath(`${folder}/${baseName} ${index}.md`);
    index += 1;
  }
  return candidate;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
