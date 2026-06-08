# Changelog

## v1.1.0

- Hover the `5h` / `7d` labels to see the next reset time. `5h` shows the clock time plus remaining `Xh Ym`; `7d` shows `Xd Yh`.
- Merge `5h` and `7d` into a single panel button so other indicators (input methods, etc.) cannot insert between them.

## v1.0.0

Initial release. GNOME Shell port of [trafficmonitor-claude-usage](https://github.com/LangYa466/trafficmonitor-claude-usage).

- Two top-panel indicators (`5h: XX %` and `7d: XX %`)
- Pre-flight Cloudflare exit-node check (`colo` / `loc`)
- OAuth token read from `~/.claude/.credentials.json`, calls `/api/oauth/usage`
- Manual refresh on click with spinner animation
- libadwaita preferences (colo / loc / jsonpath / interval / manual-first-refresh)
- Built-in i18n: English (default) / Simplified Chinese, switchable in prefs
- GNOME Shell 45–48
