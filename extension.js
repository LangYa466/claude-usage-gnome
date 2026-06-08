// Claude 用量 GNOME Shell 扩展
// 顶栏显示两个 label：5h: XX %  7d: XX %
// 数据来源：~/.claude/.credentials.json 的 accessToken → /api/oauth/usage
// 请求前先 GET claude.ai/cdn-cgi/trace 校验 colo/loc，不匹配跳过 + 通知

import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const API_URL   = 'https://api.anthropic.com/api/oauth/usage';
const TRACE_URL = 'https://claude.ai/cdn-cgi/trace';
const MIN_SPIN_MS = 600;

const GEO_UNKNOWN = 0, GEO_OK = 1, GEO_MISMATCH = 2, GEO_ERROR = 3;

const ClaudeIndicator = GObject.registerClass(
class ClaudeIndicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.0, 'Claude 用量');
        this._ext = ext;
        this._prefix = ext._prefix;   // '5h: ' or '7d: '
        this._label = new St.Label({
            text: this._prefix + '-- %',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'claude-usage-label',
        });
        this.add_child(this._label);

        this.connect('button-press-event', () => {
            this._ext._triggerManualRefresh();
            return Clutter.EVENT_STOP;
        });
    }

    setPercent(pct) {
        let num = (pct < 0) ? '--' : String(pct);
        if (num.length < 2) num = ' ' + num;
        this._label.set_text(this._prefix + num + ' %');
    }

    setRefreshing(frame) {
        const sp = ['|', '/', '-', '\\'];
        this._label.set_text(this._prefix + '  ' + sp[frame & 3]);
    }
});

export default class ClaudeUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._session = new Soup.Session({user_agent: 'claude-usage-gnome/1.0', timeout: 15});

        this._fivePct  = -1;
        this._sevenPct = -1;
        this._refreshing = false;
        this._refreshStart = 0;
        this._animFrame = 0;
        this._animTimer = 0;
        this._fetchTimer = 0;
        this._firstDone = false;
        this._lastGeo = GEO_UNKNOWN;
        this._inflight = false;
        this._manualPending = false;

        // 两个独立的 panel button —— 跟原插件一样，可以放在两边/上下两行
        this._fiveBtn  = this._makeBtn('5h: ', 'claude-5h');
        this._sevenBtn = this._makeBtn('7d: ', 'claude-7d');

        Main.panel.addToStatusArea('claude-usage-5h', this._fiveBtn,  0, 'right');
        Main.panel.addToStatusArea('claude-usage-7d', this._sevenBtn, 1, 'right');

        this._settings.connect('changed', () => {
            this._lastGeo = GEO_UNKNOWN;
            this._rescheduleFetch();
        });

        this._startAnim();
        this._scheduleFirstFetch();
    }

    disable() {
        if (this._animTimer)  { GLib.source_remove(this._animTimer);  this._animTimer  = 0; }
        if (this._fetchTimer) { GLib.source_remove(this._fetchTimer); this._fetchTimer = 0; }
        this._fiveBtn?.destroy();  this._fiveBtn  = null;
        this._sevenBtn?.destroy(); this._sevenBtn = null;
        this._session?.abort();    this._session  = null;
        this._settings = null;
    }

    _makeBtn(prefix, key) {
        const proxy = {_prefix: prefix, _triggerManualRefresh: () => this._triggerManualRefresh()};
        return new ClaudeIndicator(proxy);
    }

    // 60 ms 一帧的动画 timer，常驻；非刷新状态下负责把当前百分比刷到 label
    _startAnim() {
        this._animTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60, () => {
            const spin = this._refreshing ||
                (GLib.get_monotonic_time() / 1000 - this._refreshStart < MIN_SPIN_MS);
            if (spin) {
                this._fiveBtn?.setRefreshing(this._animFrame);
                this._sevenBtn?.setRefreshing(this._animFrame);
                this._animFrame++;
            } else {
                this._fiveBtn?.setPercent(this._fivePct);
                this._sevenBtn?.setPercent(this._sevenPct);
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _scheduleFirstFetch() {
        const manualFirst = this._settings.get_boolean('manual-first');
        if (manualFirst) {
            // 等用户手动点
            this._fetchTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                this._fetchTimer = 0;
                return GLib.SOURCE_REMOVE;
            });
        } else {
            this._fetchTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                this._fetchTimer = 0;
                this._doFetch(false);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _rescheduleFetch() {
        if (this._fetchTimer) { GLib.source_remove(this._fetchTimer); this._fetchTimer = 0; }
        const mins = Math.max(1, this._settings.get_int('interval-min'));
        this._fetchTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, mins * 60, () => {
            this._doFetch(false);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _triggerManualRefresh() {
        this._refreshStart = GLib.get_monotonic_time() / 1000;
        this._refreshing = true;
        this._doFetch(true);
    }

    _notify(msg) {
        Main.notify('Claude 用量', msg);
    }

    async _doFetch(manual) {
        if (this._inflight) return;
        this._inflight = true;
        try {
            const cfgColo = this._settings.get_string('colo');
            const cfgLoc  = this._settings.get_string('loc');
            const credPath = this._settings.get_string('credentials-path');

            // 1. trace
            let trace;
            try {
                trace = await this._httpGet(TRACE_URL, {});
            } catch (e) {
                this._lastGeo = GEO_ERROR;
                this._fail('无法连接 claude.ai 校验出口节点：' + e.message, manual);
                return;
            }
            if (trace.status !== 200) {
                this._fail('trace HTTP ' + trace.status, manual);
                return;
            }
            const {colo, loc} = this._parseTrace(trace.body);

            if (!ieq(colo, cfgColo) || !ieq(loc, cfgLoc)) {
                if (this._lastGeo !== GEO_MISMATCH) {
                    this._notify(`出口节点不匹配，已暂停 API 请求\n当前 colo=${colo} loc=${loc}\n需要 colo=${cfgColo} loc=${cfgLoc}`);
                }
                this._lastGeo = GEO_MISMATCH;
                this._fail(`出口节点不匹配：colo=${colo} loc=${loc}（需 ${cfgColo}/${cfgLoc}）`, manual);
                return;
            }
            this._lastGeo = GEO_OK;

            // 2. token
            const token = this._loadToken(credPath);
            if (!token) {
                this._fail('找不到 OAuth token，请先登录 Claude Code 或在设置里指定 json 路径', manual);
                return;
            }

            // 3. usage
            let resp;
            try {
                resp = await this._httpGet(API_URL, {
                    'Authorization':   'Bearer ' + token,
                    'anthropic-beta':  'oauth-2025-04-20',
                    'Content-Type':    'application/json',
                    'Accept':          'application/json',
                });
            } catch (e) {
                this._fail('网络错误：' + e.message, manual);
                return;
            }
            if (resp.status !== 200) {
                if (resp.status === 429)      this._fail('API 被限流（429），稍后重试', manual);
                else if (resp.status === 401) this._fail('Token 已过期，请重新登录', manual);
                else                          this._fail('HTTP 错误：' + resp.status, manual);
                return;
            }

            try {
                const data = JSON.parse(resp.body);
                const five  = extractUtil(data, 'five_hour');
                const seven = extractUtil(data, 'seven_day');
                if (five  >= 0) this._fivePct  = five;
                if (seven >= 0) this._sevenPct = seven;
                this._firstDone = true;
            } catch (e) {
                this._fail('解析用量数据失败', manual);
                return;
            }

            // 第一次成功之后启动定时刷新
            if (!this._fetchTimer) this._rescheduleFetch();
        } finally {
            this._refreshing = false;
            this._inflight = false;
        }
    }

    _fail(reason, manual) {
        if (manual) this._notify('刷新失败：\n' + reason);
    }

    _parseTrace(body) {
        const out = {colo: '', loc: ''};
        for (const line of body.split('\n')) {
            const eq = line.indexOf('=');
            if (eq < 0) continue;
            const k = line.slice(0, eq).trim();
            const v = line.slice(eq + 1).trim();
            if (k === 'colo') out.colo = v;
            else if (k === 'loc') out.loc = v;
        }
        return out;
    }

    _loadToken(customPath) {
        const home = GLib.get_home_dir();
        const candidates = [];
        if (customPath) candidates.push(customPath);
        candidates.push(home + '/.claude/.credentials.json');
        candidates.push(home + '/.config/.claude/.credentials.json');

        for (const path of candidates) {
            try {
                const [ok, raw] = GLib.file_get_contents(path);
                if (!ok || !raw) continue;
                const text = (raw instanceof Uint8Array) ? new TextDecoder().decode(raw) : raw.toString();
                const data = JSON.parse(text);
                const obj = (data.claudeAiOauth && typeof data.claudeAiOauth === 'object')
                    ? data.claudeAiOauth : data;
                if (typeof obj.accessToken === 'string')  return obj.accessToken;
                if (typeof obj.access_token === 'string') return obj.access_token;
            } catch (e) {/* try next */}
        }
        return '';
    }

    _httpGet(url, headers) {
        return new Promise((resolve, reject) => {
            const msg = Soup.Message.new('GET', url);
            for (const [k, v] of Object.entries(headers))
                msg.request_headers.append(k, v);

            this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (sess, res) => {
                try {
                    const bytes = sess.send_and_read_finish(res);
                    const body = bytes ? new TextDecoder().decode(bytes.get_data()) : '';
                    resolve({status: msg.get_status(), body});
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}

function ieq(a, b) {
    return (a || '').toUpperCase() === (b || '').toUpperCase();
}

function extractUtil(data, key) {
    const o = data?.[key];
    if (!o || typeof o !== 'object') return -1;
    const u = o.utilization;
    if (typeof u === 'number') return Math.round(u);
    return -1;
}
