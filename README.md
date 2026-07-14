# WeChat Obsync

WeChat Obsync is a companion Obsidian plugin designed to sync WeChat Official Account articles and notes from the "Obsidian同步助手" WeChat Mini Program directly into your Obsidian Vault.

## Features

- **One-click WeChat Article Sync**: Sync WeChat Official Account articles to your vault as beautifully formatted Markdown files.
- **Direct Memos / Notes Sync**: Save text snippets, memos, and ideas directly from the WeChat Mini Program to Obsidian.
- **De-duplication**: Automatically avoids saving duplicate articles.
- **Status Bar Indicator**: Real-time status update showing the last sync time and status.
- **Beautiful Dark Glassmorphism UI**: High-fidelity WeChat Mini Program interface.

## Installation

### From the Obsidian Community Plugin Store (Pending official listing)
1. Go to **Settings** -> **Community plugins** -> **Browse**.
2. Search for `WeChat Obsync`.
3. Click **Install**, then **Enable**.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create a folder named `wechat-obsync` under `.obsidian/plugins/` in your Obsidian Vault.
3. Move the downloaded files into that folder.
4. Reload Obsidian and enable `WeChat Obsync` in settings.

## Getting Started

1. Enable the plugin in your Obsidian settings.
2. In the plugin settings tab, click **生成** (Generate) to get a 6-digit binding code.
3. Open the **Obsidian同步助手** WeChat Mini Program on your phone.
4. Go to the **设置** (Settings) tab in the Mini Program, enter the 6-digit code, and confirm.
5. You are now connected! Any WeChat article or memo saved in the Mini Program will automatically sync to your Obsidian Vault.

## License

MIT

---

# WeChat Obsync (微信小程序同步助手)

WeChat Obsync是一个专门为Obsidian设计的微信文章与速记同步插件。配合微信小程序“Obsidian同步助手”，它可以将你在微信上刷到的公众号文章、临时想法、速记等内容，一键无缝同步到你的Obsidian本地库中。

## 功能特性

- **公众号文章一键同步**：支持将微信公众号的长图文文章（以及短动态）一键同步到你的笔记库，自动转化为排版精美的Markdown文件。
- **微信速记直接同步**：在微信小程序中输入的文本、想法、速记，能直接同步写入Obsidian。
- **自动防重（去重）**：自动识别已同步的文章，避免重复下载。
- **状态栏实时状态**：在Obsidian状态栏实时显示同步状态和最后同步时间。
- **多媒体解析优化**：自动提取视频链接、还原表格和代码块，支持自动下载文章图片到本地防止微信防盗链图裂。

## 安装方法

### 方法一：从Obsidian社区插件市场安装（推荐）
1. 打开Obsidian，进入 **设置** -> **第三方插件** -> **社区插件市场(浏览)**。
2. 搜索 `WeChat Obsync`。
3. 点击 **安装**，安装完成后点击 **启用**。

### 方法二：手动安装
1. 在GitHub的最新Release页面下载 `main.js`、`manifest.json` 和 `styles.css` 三个文件。
2. 进入你Obsidian笔记库的 `.obsidian/plugins/` 目录，新建一个名为 `wechat-obsync` 的文件夹。
3. 将下载的三个文件放入该文件夹中。
4. 返回Obsidian，在第三方插件列表里重新加载并启用 `WeChat Obsync`。

## 开始使用

1. 在Obsidian中启用该插件，并在插件设置面板中，点击 **生成** 按钮获取一个6位数绑定码。
2. 在手机微信上，搜索并打开 **Obsidian同步助手** 小程序。
3. 进入小程序底部的 **设置** 页面，在“绑定设备”输入框中填入刚刚在电脑上获取的6位数绑定码，点击确认。
4. 绑定成功！现在你在微信小程序里保存的任何公众号文章或速记，都会在电脑打开Obsidian时自动同步写入。

## 开源协议

MIT
