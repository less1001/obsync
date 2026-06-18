# Obsync (WeChat to Obsidian Sync Plugin)

Obsync is a companion Obsidian plugin designed to sync WeChat Official Account articles and notes from the "Obsync 同步助手" WeChat Mini Program directly into your Obsidian Vault.

## Features

- **One-click WeChat Article Sync**: Sync WeChat Official Account articles to your vault as beautifully formatted Markdown files.
- **Direct Memos / Notes Sync**: Save text snippets, memos, and ideas directly from the WeChat Mini Program to Obsidian.
- **De-duplication**: Automatically avoids saving duplicate articles.
- **Status Bar Indicator**: Real-time status update showing the last sync time and status.
- **Beautiful Dark Glassmorphism UI**: High-fidelity WeChat Mini Program interface.

## Installation

### From the Obsidian Community Plugin Store (Pending official listing)
1. Go to **Settings** -> **Community plugins** -> **Browse**.
2. Search for `Obsync`.
3. Click **Install**, then **Enable**.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create a folder named `obsync` under `.obsidian/plugins/` in your Obsidian Vault.
3. Move the downloaded files into that folder.
4. Reload Obsidian and enable `Obsync` in settings.

## Getting Started

1. Enable the plugin in your Obsidian settings.
2. In the plugin settings tab, click **生成** (Generate) to get a 6-digit binding code.
3. Open the **Obsync 同步助手** WeChat Mini Program on your phone.
4. Go to the **设置** (Settings) tab in the Mini Program, enter the 6-digit code, and confirm.
5. You are now connected! Any WeChat article or memo saved in the Mini Program will automatically sync to your Obsidian Vault.

## License

MIT
