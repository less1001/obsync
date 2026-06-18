"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ObsyncPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/markdown.ts
function formatArticleMarkdown(article) {
  const frontmatter = [
    "---",
    `source_url: ${JSON.stringify(article.sourceUrl)}`,
    `title: ${JSON.stringify(article.title)}`,
    article.account ? `account: ${JSON.stringify(article.account)}` : void 0,
    article.author ? `author: ${JSON.stringify(article.author)}` : void 0,
    article.publishedAt ? `published_at: ${JSON.stringify(article.publishedAt)}` : void 0,
    `saved_at: ${JSON.stringify(article.savedAt)}`,
    `sync_id: ${JSON.stringify(article.id)}`,
    `parse_status: ${JSON.stringify(article.parseStatus)}`,
    article.parseError ? `parse_error: ${JSON.stringify(article.parseError)}` : void 0,
    "---"
  ].filter(Boolean);
  return `${frontmatter.join("\n")}

# ${article.title}

${article.markdown.trim()}
`;
}
function sanitizeFileName(value) {
  return value.replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

// main.ts
var DEFAULT_SETTINGS = {
  apiBaseUrl: "https://cloud1-d3gvuz4256fba5e84-1443228054.ap-shanghai.app.tcloudbase.com/obsync",
  token: "",
  userId: "",
  syncFolder: "\u5FAE\u4FE1\u516C\u4F17\u53F7\u6587\u7AE0",
  deviceName: "Obsidian",
  syncIntervalMinutes: 5
};
var ObsyncPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", DEFAULT_SETTINGS);
    __publicField(this, "statusBarEl");
    __publicField(this, "lastSyncTime", null);
    __publicField(this, "syncInterval");
    __publicField(this, "bindingPollInterval");
  }
  async onload() {
    await this.loadSettings();
    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar("idle");
    this.addSettingTab(new ObsyncSettingTab(this.app, this));
    this.addCommand({
      id: "obsync-sync-now",
      name: "\u7ACB\u5373\u540C\u6B65\u5FAE\u4FE1\u516C\u4F17\u53F7\u6587\u7AE0",
      callback: async () => {
        await this.syncNow(true);
      }
    });
    this.scheduleSync();
  }
  onunload() {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
    }
    if (this.bindingPollInterval) {
      window.clearInterval(this.bindingPollInterval);
    }
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data != null ? data : {});
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.scheduleSync();
  }
  async startBinding() {
    const response = await apiRequest(this.settings.apiBaseUrl, "/v1/bind/start", {
      method: "POST",
      body: {
        deviceName: this.settings.deviceName || "Obsidian",
        vaultName: this.app.vault.getName()
      }
    });
    return response;
  }
  pollBinding(code, onStatus) {
    if (this.bindingPollInterval) {
      window.clearInterval(this.bindingPollInterval);
    }
    this.bindingPollInterval = window.setInterval(() => {
      (async () => {
        var _a;
        try {
          const status = await apiRequest(
            this.settings.apiBaseUrl,
            `/v1/bind/status?code=${encodeURIComponent(code)}`
          );
          onStatus(status);
          if (status.status === "confirmed" && status.token) {
            this.settings.token = status.token;
            this.settings.userId = (_a = status.userId) != null ? _a : "";
            await this.saveSettings();
            window.clearInterval(this.bindingPollInterval);
            this.bindingPollInterval = void 0;
            new import_obsidian.Notice("Obsync \u7ED1\u5B9A\u6210\u529F\u3002");
            await this.syncNow(true);
          }
          if (status.status === "expired") {
            window.clearInterval(this.bindingPollInterval);
            this.bindingPollInterval = void 0;
          }
        } catch (error) {
          console.error("Obsync binding poll failed", error);
        }
      })();
    }, 2500);
  }
  async syncNow(showNotice = false) {
    if (!this.settings.token) {
      if (showNotice) new import_obsidian.Notice("Obsync \u5C1A\u672A\u7ED1\u5B9A\u3002");
      return;
    }
    this.updateStatusBar("syncing");
    try {
      const response = await apiRequest(this.settings.apiBaseUrl, "/v1/sync/articles", {
        token: this.settings.token
      });
      const syncIdToPath = /* @__PURE__ */ new Map();
      const files = this.app.vault.getMarkdownFiles();
      for (const file of files) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache && cache.frontmatter && cache.frontmatter.sync_id) {
          syncIdToPath.set(String(cache.frontmatter.sync_id), file.path);
        }
      }
      let written = 0;
      let skipped = 0;
      let failed = 0;
      const errors = [];
      for (const article of response.articles) {
        try {
          const isBinary = article.excerpt && (article.excerpt.includes("/") || article.excerpt.startsWith("image/") || article.excerpt.startsWith("application/"));
          let path = "";
          if (isBinary) {
            const folder = (0, import_obsidian.normalizePath)(this.settings.syncFolder || DEFAULT_SETTINGS.syncFolder);
            const fileName = sanitizeFileName(article.title || "\u672A\u547D\u540D\u6587\u4EF6");
            path = (0, import_obsidian.normalizePath)(`${folder}/${fileName}`);
          } else {
            const existingPath = syncIdToPath.get(article.id);
            if (existingPath) {
              path = existingPath;
            }
          }
          if (path && this.app.vault.getAbstractFileByPath(path)) {
            skipped += 1;
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
      if (failed > 0 && written === 0 && skipped === 0) {
        throw new Error(`\u540C\u6B65\u5931\u8D25: ${errors.slice(0, 3).join("; ")}`);
      }
      this.updateStatusBar(failed > 0 ? "error" : "success");
      if (showNotice) {
        const parts = [];
        if (written > 0) parts.push(`\u5DF2\u540C\u6B65 ${written} \u7BC7`);
        if (skipped > 0) parts.push(`\u5FFD\u7565\u91CD\u590D ${skipped} \u7BC7`);
        if (failed > 0) parts.push(`\u5931\u8D25 ${failed} \u7BC7`);
        if (parts.length > 0) {
          new import_obsidian.Notice(`Obsync \u540C\u6B65\u7ED3\u679C: ${parts.join("\uFF0C")}`);
        } else {
          new import_obsidian.Notice("Obsync \u6682\u65E0\u65B0\u6587\u7AE0\u3002");
        }
      }
    } catch (error) {
      console.error("Obsync sync failed", error);
      this.updateStatusBar("error");
      if (showNotice) {
        const message = error instanceof Error ? error.message : String(error);
        new import_obsidian.Notice(`Obsync \u540C\u6B65\u5931\u8D25\uFF1A${message}`);
      }
    }
  }
  scheduleSync() {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
    }
    const intervalMs = Math.max(1, this.settings.syncIntervalMinutes) * 60 * 1e3;
    this.syncInterval = window.setInterval(() => {
      this.syncNow(false).catch((error) => console.error("Obsync sync failed", error));
    }, intervalMs);
  }
  updateStatusBar(status) {
    if (!this.statusBarEl) return;
    if (status === "syncing") {
      this.statusBarEl.setText("Obsync: \u6B63\u5728\u540C\u6B65...");
    } else if (status === "success") {
      this.lastSyncTime = /* @__PURE__ */ new Date();
      const timeStr = this.lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      this.statusBarEl.setText(`Obsync: \u540C\u6B65\u4E8E ${timeStr}`);
    } else if (status === "error") {
      const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      this.statusBarEl.setText(`Obsync: \u540C\u6B65\u5931\u8D25 ${timeStr}`);
    } else if (status === "idle") {
      if (this.lastSyncTime) {
        const timeStr = this.lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        this.statusBarEl.setText(`Obsync: \u540C\u6B65\u4E8E ${timeStr}`);
      } else {
        this.statusBarEl.setText("Obsync: \u672A\u540C\u6B65");
      }
    }
  }
  async writeArticle(article) {
    const folder = (0, import_obsidian.normalizePath)(this.settings.syncFolder || DEFAULT_SETTINGS.syncFolder);
    await ensureFolder(this.app, folder);
    const date = article.publishedAt || article.savedAt.slice(0, 10);
    const baseName = sanitizeFileName(`${date} - ${article.title || "\u672A\u547D\u540D\u516C\u4F17\u53F7\u6587\u7AE0"}`);
    const path = await nextAvailablePath(this.app, folder, baseName);
    await this.app.vault.create(path, formatArticleMarkdown(article));
    return path;
  }
  async writeBinaryFile(article) {
    const folder = (0, import_obsidian.normalizePath)(this.settings.syncFolder || DEFAULT_SETTINGS.syncFolder);
    await ensureFolder(this.app, folder);
    const fileName = sanitizeFileName(article.title || "\u672A\u547D\u540D\u6587\u4EF6");
    const path = (0, import_obsidian.normalizePath)(`${folder}/${fileName}`);
    const buffer = base64ToArrayBuffer(article.markdown);
    const existingFile = this.app.vault.getAbstractFileByPath(path);
    if (existingFile instanceof import_obsidian.TFile) {
      await this.app.vault.modifyBinary(existingFile, buffer);
    } else if (!existingFile) {
      await this.app.vault.createBinary(path, buffer);
    }
    return path;
  }
};
var ObsyncSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin", plugin);
    __publicField(this, "bindCode", "");
    __publicField(this, "bindStatus", "");
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Obsync \u540C\u6B65\u52A9\u624B").setHeading();
    containerEl.createEl("p", {
      text: this.plugin.settings.token ? "\u5DF2\u7ED1\u5B9A\u3002\u5C0F\u7A0B\u5E8F\u4FDD\u5B58\u7684\u6587\u7AE0\u4F1A\u81EA\u52A8\u8FDB\u5165\u5F53\u524D\u7B14\u8BB0\u5E93\u3002" : "\u8BF7\u5148\u751F\u6210\u7ED1\u5B9A\u7801\uFF0C\u7136\u540E\u5728\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u4E2D\u786E\u8BA4\u7ED1\u5B9A\u3002"
    });
    new import_obsidian.Setting(containerEl).setName("\u670D\u52A1\u5668\u5730\u5740").setDesc("\u9ED8\u8BA4\u4F7F\u7528\u5DF2\u914D\u7F6E\u7684 CloudBase HTTPS \u5730\u5740\u3002").addText(
      (text) => text.setPlaceholder("https://cloud1-d3gvuz4256fba5e84-1443228054.ap-shanghai.app.tcloudbase.com/obsync").setValue(this.plugin.settings.apiBaseUrl).onChange(async (value) => {
        this.plugin.settings.apiBaseUrl = value.replace(/\/+$/, "");
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u8BBE\u5907\u540D\u79F0").setDesc("\u7ED1\u5B9A\u65F6\u663E\u793A\u7684\u7535\u8111\u540D\u79F0\u3002").addText(
      (text) => text.setValue(this.plugin.settings.deviceName).onChange(async (value) => {
        this.plugin.settings.deviceName = value || "Obsidian";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u540C\u6B65\u6587\u4EF6\u5939").setDesc("\u516C\u4F17\u53F7\u6587\u7AE0\u4F1A\u5199\u5165\u8FD9\u4E2A\u6587\u4EF6\u5939\u3002").addText(
      (text) => text.setValue(this.plugin.settings.syncFolder).onChange(async (value) => {
        this.plugin.settings.syncFolder = value || DEFAULT_SETTINGS.syncFolder;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u81EA\u52A8\u540C\u6B65\u95F4\u9694").setDesc("\u6BCF\u9694\u591A\u5C11\u5206\u949F\u68C0\u67E5\u4E00\u6B21\u65B0\u6587\u7AE0\u3002").addText(
      (text) => text.setValue(String(this.plugin.settings.syncIntervalMinutes)).onChange(async (value) => {
        const parsed = Number(value);
        this.plugin.settings.syncIntervalMinutes = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u751F\u6210\u7ED1\u5B9A\u7801").setDesc("\u5728\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u4E2D\u8F93\u5165\u6B64\u7ED1\u5B9A\u7801\u3002").addButton(
      (button) => button.setButtonText("\u751F\u6210").setCta().onClick(async () => {
        button.setDisabled(true);
        button.setButtonText("\u751F\u6210\u4E2D...");
        try {
          const bind = await this.plugin.startBinding();
          this.bindCode = bind.code;
          this.bindStatus = `\u6709\u6548\u671F\u81F3 ${new Date(bind.expiresAt).toLocaleTimeString()}`;
          new import_obsidian.Notice(`Obsync \u7ED1\u5B9A\u7801\uFF1A${bind.code}`);
          this.plugin.pollBinding(bind.code, (status) => {
            this.bindStatus = status.status;
            this.display();
          });
          this.display();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          new import_obsidian.Notice(`\u751F\u6210\u7ED1\u5B9A\u7801\u5931\u8D25\uFF1A${message}`);
          this.bindStatus = `\u5931\u8D25\uFF1A${message}`;
          this.display();
        } finally {
          button.setDisabled(false);
          button.setButtonText("\u751F\u6210");
        }
      })
    );
    if (this.bindCode) {
      containerEl.createDiv({ cls: "obsync-setting-code", text: this.bindCode });
      containerEl.createDiv({ cls: "obsync-setting-muted", text: this.bindStatus });
    }
    new import_obsidian.Setting(containerEl).setName("\u7ACB\u5373\u540C\u6B65").setDesc(this.plugin.settings.token ? "\u7ACB\u5373\u62C9\u53D6\u5C0F\u7A0B\u5E8F\u4E2D\u5DF2\u4FDD\u5B58\u7684\u6587\u7AE0\u3002" : "\u8BF7\u5148\u5B8C\u6210\u7ED1\u5B9A\u3002").addButton(
      (button) => button.setButtonText("\u540C\u6B65").onClick(async () => {
        await this.plugin.syncNow(true);
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u89E3\u9664\u7ED1\u5B9A").setDesc("\u6E05\u9664\u5F53\u524D\u7B14\u8BB0\u5E93\u4E2D\u7684\u7ED1\u5B9A\u4FE1\u606F\u3002").addButton(
      (button) => button.setButtonText("\u89E3\u9664\u672C\u5730\u7ED1\u5B9A").onClick(async () => {
        this.plugin.settings.token = "";
        this.plugin.settings.userId = "";
        await this.plugin.saveSettings();
        new import_obsidian.Notice("Obsync \u5DF2\u89E3\u9664\u672C\u5730\u7ED1\u5B9A\u3002");
        this.display();
      })
    );
  }
};
async function apiRequest(baseUrl, path, options = {}) {
  var _a;
  const headers = {
    "content-type": "application/json"
  };
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  const response = await (0, import_obsidian.requestUrl)({
    url: `${baseUrl.replace(/\/+$/, "")}${path}`,
    method: (_a = options.method) != null ? _a : "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : void 0
  });
  if (response.status < 200 || response.status >= 300) {
    const body = typeof response.text === "string" ? response.text : "";
    throw new Error(`API request failed: ${response.status}${body ? ` ${body}` : ""}`);
  }
  return response.json;
}
async function ensureFolder(app, folderPath) {
  const parts = folderPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) {
      await app.vault.createFolder(current);
    } else if (!(existing instanceof import_obsidian.TFolder)) {
      throw new Error(`${current} exists and is not a folder.`);
    }
  }
}
async function nextAvailablePath(app, folder, baseName) {
  let candidate = (0, import_obsidian.normalizePath)(`${folder}/${baseName}.md`);
  let index = 2;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = (0, import_obsidian.normalizePath)(`${folder}/${baseName} ${index}.md`);
    index += 1;
  }
  return candidate;
}
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
