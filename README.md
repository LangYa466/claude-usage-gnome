# Claude 用量 — GNOME Shell 扩展

把 [trafficmonitor-claude-usage](https://github.com/LangYa466/trafficmonitor-claude-usage) 移植到 GNOME。

顶栏显示两块：`5h: XX %` 和 `7d: XX %`，分别是 Claude 订阅最近 5 小时窗口和 7 天窗口的用量百分比。

## 数据来源

跟 Claude Code 自己用的一样：

- 读 `~/.claude/.credentials.json` 里的 `accessToken`
- 拿它去打 `https://api.anthropic.com/api/oauth/usage`
- 取响应里 `five_hour` / `seven_day` 的 `utilization`

默认每 3 分钟刷一次。打太勤会被限流（HTTP 429）。

## 出口节点校验

每次请求 usage 之前，先 GET `https://claude.ai/cdn-cgi/trace`，看里面的 `colo`（Cloudflare 节点）和 `loc`（国家）：

- 两个都跟设置里一致（默认 `NRT` / `JP`，东京出口）才发请求
- 对不上就跳过这次，弹一条系统通知（同一次掉到错误节点只提醒一次）

用不上代理校验的话，把 colo / loc 改成你当前出口的值就行。

## 安装

```sh
make install         # 装到 ~/.local/share/gnome-shell/extensions/
# 然后 注销重新登录，或 X11 下按 Alt+F2 → r → 回车
gnome-extensions enable claude-usage@langya466.github.com
```

## 设置

GNOME 扩展应用打开「Claude 用量」的设置：

| 项 | 说明 |
| --- | --- |
| colo | 期望的 Cloudflare 节点，默认 `NRT` |
| loc | 期望的国家代码，默认 `JP` |
| jsonpath | `credentials.json` 路径，留空自动找 |
| 间隔(分) | 刷新间隔，默认 3 |
| 开机后首次必须手动刷新 | 勾上后开机不自动拉，要你手动点一次 5h/7d 才触发首次获取 |

## 手动刷新

左键点顶栏的 5h 或 7d，立刻强制刷新一次。刷新中数字会变成滚动字符（`| / - \`），刷完变回百分比。失败会弹通知。

## License

MIT
