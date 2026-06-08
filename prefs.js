import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ClaudeUsagePrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({title: '设置', icon_name: 'preferences-system-symbolic'});
        window.add(page);

        // ── 出口节点 ──
        const geo = new Adw.PreferencesGroup({
            title: '出口节点校验',
            description: '请求 usage 之前先 GET claude.ai/cdn-cgi/trace，colo / loc 都匹配才发请求',
        });
        page.add(geo);

        geo.add(this._entryRow(settings, 'colo', 'colo', '期望的 Cloudflare 节点，默认 NRT（东京）'));
        geo.add(this._entryRow(settings, 'loc',  'loc',  '期望的国家代码，默认 JP'));

        // ── token ──
        const tok = new Adw.PreferencesGroup({
            title: 'Token',
            description: '从 credentials.json 读 OAuth accessToken',
        });
        page.add(tok);
        tok.add(this._entryRow(settings, 'credentials-path', 'jsonpath',
            '留空自动找 ~/.claude/.credentials.json'));

        // ── 刷新 ──
        const ref = new Adw.PreferencesGroup({
            title: '刷新',
            description: '默认 3 分钟；小于默认值容易被 API 速率限制（HTTP 429）',
        });
        page.add(ref);

        const spinRow = new Adw.SpinRow({
            title: '间隔（分钟）',
            subtitle: '太低会触发限流',
            adjustment: new Gtk.Adjustment({lower: 1, upper: 180, step_increment: 1}),
        });
        settings.bind('interval-min', spinRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        ref.add(spinRow);

        const switchRow = new Adw.SwitchRow({
            title: '开机后首次必须手动刷新',
            subtitle: '开机后出口/token 常没就绪，自动拉容易误报失败；勾选后只在你手动点击时获取',
        });
        settings.bind('manual-first', switchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        ref.add(switchRow);
    }

    _entryRow(settings, key, title, subtitle) {
        const row = new Adw.EntryRow({title, text: settings.get_string(key)});
        if (subtitle && row.set_show_apply_button) row.set_show_apply_button(false);
        // EntryRow 不支持 subtitle；用 ActionRow 包一个 Entry 也可，但简单点直接绑 EntryRow
        row.connect('changed', () => settings.set_string(key, row.get_text()));
        settings.connect('changed::' + key, () => {
            const v = settings.get_string(key);
            if (row.get_text() !== v) row.set_text(v);
        });
        return row;
    }
}
