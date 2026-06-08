// Claude usage GNOME Shell extension.
// Two top-panel labels: 5h: XX %  7d: XX %
// Data: accessToken from ~/.claude/.credentials.json -> /api/oauth/usage
// Pre-flight: GET claude.ai/cdn-cgi/trace and skip + notify on colo/loc mismatch.

import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {makeTranslator} from './lib/locale.js';

const API_URL   = 'https://api.anthropic.com/api/oauth/usage';
const TRACE_URL = 'https://claude.ai/cdn-cgi/trace';
const MIN_SPIN_MS = 600;

const GEO_UNKNOWN = 0, GEO_OK = 1, GEO_MISMATCH = 2, GEO_ERROR = 3;

// One panel button holding both 5h and 7d labels side-by-side so the system
// tray cannot insert other indicators (Rime, etc.) between them.
const ClaudeIndicator = GObject.registerClass(
class ClaudeIndicator extends PanelMenu.Button {
    _init(name, onClick) {
        super._init(0.0, name);

        const box = new St.BoxLayout({
            vertical: false,
            style_class: 'claude-usage-box',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(box);

        this._fiveLabel = new St.Label({
            text: '5h: -- %',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'claude-usage-label',
        });
        this._sep = new St.Label({
            text: '  ',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._sevenLabel = new St.Label({
            text: '7d: -- %',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'claude-usage-label',
        });
        box.add_child(this._fiveLabel);
        box.add_child(this._sep);
        box.add_child(this._sevenLabel);

        this.connect('button-press-event', () => {
            onClick();
            return Clutter.EVENT_STOP;
        });
    }

    _fmt(prefix, pct) {
        let num = (pct < 0) ? '--' : String(pct);
        if (num.length < 2) num = ' ' + num;
        return prefix + num + ' %';
    }

    setPercents(fivePct, sevenPct) {
        this._fiveLabel.set_text(this._fmt('5h: ', fivePct));
        this._sevenLabel.set_text(this._fmt('7d: ', sevenPct));
    }

    setRefreshing(frame) {
        const sp = ['|', '/', '-', '\\'];
        const c = sp[frame & 3];
        this._fiveLabel.set_text('5h:  ' + c);
        this._sevenLabel.set_text('7d:  ' + c);
    }
});

export default class ClaudeUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._t = makeTranslator(this._settings);
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

        this._indicator = new ClaudeIndicator(
            this._t('panel.name'),
            () => this._triggerManualRefresh());
        Main.panel.addToStatusArea('claude-usage', this._indicator, 0, 'right');

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
        this._indicator?.destroy(); this._indicator = null;
        this._session?.abort();     this._session   = null;
        this._settings = null;
        this._t = null;
    }

    _startAnim() {
        this._animTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60, () => {
            const spin = this._refreshing ||
                (GLib.get_monotonic_time() / 1000 - this._refreshStart < MIN_SPIN_MS);
            if (spin) {
                this._indicator?.setRefreshing(this._animFrame);
                this._animFrame++;
            } else {
                this._indicator?.setPercents(this._fivePct, this._sevenPct);
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _scheduleFirstFetch() {
        const manualFirst = this._settings.get_boolean('manual-first');
        if (!manualFirst) {
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
        Main.notify(this._t('notify.title'), msg);
    }

    async _doFetch(manual) {
        if (this._inflight) return;
        this._inflight = true;
        try {
            const cfgColo  = this._settings.get_string('colo');
            const cfgLoc   = this._settings.get_string('loc');
            const credPath = this._settings.get_string('credentials-path');

            let trace;
            try {
                trace = await this._httpGet(TRACE_URL, {});
            } catch (e) {
                this._lastGeo = GEO_ERROR;
                this._fail(this._t('fail.trace.connect', {err: e.message}), manual);
                return;
            }
            if (trace.status !== 200) {
                this._fail(this._t('fail.trace.http', {status: trace.status}), manual);
                return;
            }

            const {colo, loc} = this._parseTrace(trace.body);
            if (!ieq(colo, cfgColo) || !ieq(loc, cfgLoc)) {
                if (this._lastGeo !== GEO_MISMATCH) {
                    this._notify(this._t('notify.geo.mismatch',
                        {colo, loc, cfgColo, cfgLoc}));
                }
                this._lastGeo = GEO_MISMATCH;
                this._fail(this._t('fail.geo.mismatch',
                    {colo, loc, cfgColo, cfgLoc}), manual);
                return;
            }
            this._lastGeo = GEO_OK;

            const token = this._loadToken(credPath);
            if (!token) {
                this._fail(this._t('fail.token.missing'), manual);
                return;
            }

            let resp;
            try {
                resp = await this._httpGet(API_URL, {
                    'Authorization':  'Bearer ' + token,
                    'anthropic-beta': 'oauth-2025-04-20',
                    'Content-Type':   'application/json',
                    'Accept':         'application/json',
                });
            } catch (e) {
                this._fail(this._t('fail.api.network', {err: e.message}), manual);
                return;
            }
            if (resp.status !== 200) {
                if (resp.status === 429)      this._fail(this._t('fail.api.429'), manual);
                else if (resp.status === 401) this._fail(this._t('fail.api.401'), manual);
                else                          this._fail(this._t('fail.api.http', {status: resp.status}), manual);
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
                this._fail(this._t('fail.parse'), manual);
                return;
            }

            if (!this._fetchTimer) this._rescheduleFetch();
        } finally {
            this._refreshing = false;
            this._inflight = false;
        }
    }

    _fail(reason, manual) {
        if (manual) this._notify(this._t('notify.refresh.failed', {reason}));
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
            } catch (e) { /* try next */ }
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
