# claude-usage-gnome

> [English](./README.md)

GNOME Shell 扩展，在顶栏显示 Claude 订阅最近 5 小时窗口和 7 天窗口的用量百分比。

[trafficmonitor-claude-usage](https://github.com/LangYa466/trafficmonitor-claude-usage) 的 GNOME 移植。

## 数据来源

跟 Claude Code 自己用的一样：

- 读 `~/.claude/.credentials.json` 里的 `accessToken`
- 打 `https://api.anthropic.com/api/oauth/usage`
- 取响应里 `five_hour` / `seven_day` 的 `utilization`

默认每 3 分钟刷一次。打太勤会被限流（HTTP 429）。

## 出口节点校验

每次请求 usage 之前，先 GET `https://claude.ai/cdn-cgi/trace`，看里面的 `colo` 和 `loc`：

- 两个都跟设置里一致（默认 `NRT` / `JP`，东京出口）才发请求
- 对不上就跳过这次，弹一条系统通知（同一次掉到错误节点只提醒一次）

用不上代理校验的话，把 colo / loc 改成你当前出口的值就行。

## 安装

### 从源码

```sh
git clone https://github.com/LangYa466/claude-usage-gnome
cd claude-usage-gnome
make install
```

注销并重新登录（X11 下也可以 `Alt+F2` → `r`），然后：

```sh
gnome-extensions enable claude-usage@langya466.github.com
```

### 从 Release zip

```sh
gnome-extensions install --force claude-usage@langya466.github.com.zip
```

## 设置

打开扩展的「设置」：

| 项 | 说明 |
| --- | --- |
| colo | 期望的 Cloudflare 节点，默认 `NRT` |
| loc | 期望的国家代码，默认 `JP` |
| jsonpath | `credentials.json` 路径，留空自动找 |
| 间隔(分) | 刷新间隔，默认 3 |
| 开机后首次必须手动刷新 | 勾上后开机不自动拉，要你手动点一次 5h/7d 才触发首次获取 |

## 手动刷新

左键点顶栏的 5h 或 7d，立刻强制刷新一次。刷新中数字会变成滚动字符（`| / - \`），刷完变回百分比。失败会弹通知。

## 兼容

GNOME Shell **45 / 46 / 47 / 48**。

## License

MIT
