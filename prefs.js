import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {LANGUAGES, makeTranslator} from './lib/locale.js';

export default class ClaudeUsagePrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const t = makeTranslator(settings);

        const page = new Adw.PreferencesPage({
            title: t('prefs.page.title'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        // Geo
        const geo = new Adw.PreferencesGroup({
            title: t('prefs.group.geo.title'),
            description: t('prefs.group.geo.subtitle'),
        });
        page.add(geo);
        geo.add(this._entryRow(settings, 'colo',
            t('prefs.row.colo.title'), t('prefs.row.colo.subtitle')));
        geo.add(this._entryRow(settings, 'loc',
            t('prefs.row.loc.title'), t('prefs.row.loc.subtitle')));

        // Token
        const tok = new Adw.PreferencesGroup({
            title: t('prefs.group.token.title'),
            description: t('prefs.group.token.subtitle'),
        });
        page.add(tok);
        tok.add(this._entryRow(settings, 'credentials-path',
            t('prefs.row.jsonpath.title'), t('prefs.row.jsonpath.subtitle')));

        // Refresh
        const ref = new Adw.PreferencesGroup({
            title: t('prefs.group.refresh.title'),
            description: t('prefs.group.refresh.subtitle'),
        });
        page.add(ref);

        const spinRow = new Adw.SpinRow({
            title:    t('prefs.row.interval.title'),
            subtitle: t('prefs.row.interval.subtitle'),
            adjustment: new Gtk.Adjustment({lower: 1, upper: 180, step_increment: 1}),
        });
        settings.bind('interval-min', spinRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        ref.add(spinRow);

        const switchRow = new Adw.SwitchRow({
            title:    t('prefs.row.manual.title'),
            subtitle: t('prefs.row.manual.subtitle'),
        });
        settings.bind('manual-first', switchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        ref.add(switchRow);

        // Language
        const lang = new Adw.PreferencesGroup({
            title: t('prefs.group.lang.title'),
            description: t('prefs.group.lang.subtitle'),
        });
        page.add(lang);
        lang.add(this._languageRow(settings, t));
    }

    _entryRow(settings, key, title, subtitle) {
        // EntryRow doesn't support subtitle; surface it as the placeholder/tooltip.
        const row = new Adw.EntryRow({title, text: settings.get_string(key)});
        if (subtitle) row.set_tooltip_text(subtitle);
        row.connect('changed', () => {
            const v = row.get_text();
            if (settings.get_string(key) !== v) settings.set_string(key, v);
        });
        settings.connect('changed::' + key, () => {
            const v = settings.get_string(key);
            if (row.get_text() !== v) row.set_text(v);
        });
        return row;
    }

    _languageRow(settings, t) {
        const model = Gtk.StringList.new(LANGUAGES.map(l => l.label));
        const row = new Adw.ComboRow({
            title: t('prefs.row.lang.title'),
            model,
        });
        const current = settings.get_string('language');
        const idx = Math.max(0, LANGUAGES.findIndex(l => l.id === current));
        row.set_selected(idx);

        row.connect('notify::selected', () => {
            const sel = row.get_selected();
            const id = LANGUAGES[sel]?.id ?? 'auto';
            if (settings.get_string('language') !== id)
                settings.set_string('language', id);
        });
        settings.connect('changed::language', () => {
            const cur = settings.get_string('language');
            const i = LANGUAGES.findIndex(l => l.id === cur);
            if (i >= 0 && row.get_selected() !== i) row.set_selected(i);
        });
        return row;
    }
}
