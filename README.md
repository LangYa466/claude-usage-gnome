# claude-usage-gnome

> [简体中文](./README.zh-CN.md)

GNOME Shell extension that shows your Claude subscription usage (5h / 7d windows) in the top panel.

GNOME port of [trafficmonitor-claude-usage](https://github.com/LangYa466/trafficmonitor-claude-usage).

## How it works

Same data path Claude Code itself uses:

- Reads `accessToken` from `~/.claude/.credentials.json`
- Calls `https://api.anthropic.com/api/oauth/usage`
- Shows `five_hour.utilization` and `seven_day.utilization` as percentages

Default refresh: every 3 minutes. Lower values risk HTTP 429.

## Exit-node check

Before each usage call, the extension does `GET https://claude.ai/cdn-cgi/trace` and checks `colo` / `loc`:

- Both must match the configured values (default `SIN` / `SG`, i.e. Singapore)
- If they don't match, the call is skipped and you get one notification (won't spam)

If you don't proxy, just set `colo` / `loc` to whatever your real exit node reports.

## Install

### From source

```sh
git clone https://github.com/LangYa466/claude-usage-gnome
cd claude-usage-gnome
make install
```

Log out and back in (or on X11: `Alt+F2` → `r`), then:

```sh
gnome-extensions enable claude-usage@langya466.github.com
```

### From release zip

```sh
gnome-extensions install --force claude-usage@langya466.github.com.zip
```

## Settings

Open the extension preferences:

| Field | Meaning |
| --- | --- |
| colo | Expected Cloudflare colo, default `SIN` |
| loc | Expected country code, default `SG` |
| jsonpath | Path to `credentials.json`, empty = auto-detect |
| interval (min) | Refresh interval, default 3 |
| Require manual first refresh | Don't auto-fetch on login; wait for a click |

## Manual refresh

Left-click `5h` or `7d` to force a refresh. A `| / - \` spinner shows during the refresh. Failures pop a system notification.

## Compatibility

GNOME Shell **45 / 46 / 47 / 48**.

## License

MIT
