# Changelog

## v1.0.0

Initial release. GNOME Shell port of [trafficmonitor-claude-usage](https://github.com/LangYa466/trafficmonitor-claude-usage).

- Two top-panel indicators (`5h: XX %` and `7d: XX %`)
- Pre-flight Cloudflare exit-node check (`colo` / `loc`)
- OAuth token read from `~/.claude/.credentials.json`, calls `/api/oauth/usage`
- Manual refresh on click with spinner animation
- libadwaita preferences (colo / loc / jsonpath / interval / manual-first-refresh)
- Built-in i18n: English (default) / Simplified Chinese, switchable in prefs
- GNOME Shell 45–48
