// Minimal in-process i18n.
// Default English. User can switch to Simplified Chinese in prefs.
// LANGUAGES export drives the prefs combo row.

import GLib from 'gi://GLib';

export const LANGUAGES = [
    {id: 'auto',  label: 'Auto (system)'},
    {id: 'en',    label: 'English'},
    {id: 'zh-CN', label: '简体中文'},
];

const STRINGS = {
    en: {
        // panel
        'panel.name.5h': 'Claude 5h usage',
        'panel.name.7d': 'Claude 7d usage',
        // notifications — title
        'notify.title': 'Claude Usage',
        // notifications — body
        'notify.geo.mismatch':
            'Exit node mismatch, API calls paused\n' +
            'Current colo={colo} loc={loc}\n' +
            'Expected colo={cfgColo} loc={cfgLoc}',
        'notify.refresh.failed': 'Refresh failed:\n{reason}',
        // fail reasons
        'fail.trace.connect': 'Cannot reach claude.ai for exit-node check: {err}',
        'fail.trace.http':    'trace HTTP {status}',
        'fail.geo.mismatch':  'Exit node mismatch: colo={colo} loc={loc} (need {cfgColo}/{cfgLoc})',
        'fail.token.missing': 'OAuth token not found. Log in via Claude Code or set the jsonpath in settings.',
        'fail.api.429':       'Rate limited (HTTP 429), please retry later',
        'fail.api.401':       'Token expired, please log in again',
        'fail.api.http':      'HTTP error: {status}',
        'fail.api.network':   'Network error: {err}',
        'fail.parse':         'Failed to parse usage response',
        // prefs
        'prefs.page.title':            'Settings',
        'prefs.group.geo.title':       'Exit-node check',
        'prefs.group.geo.subtitle':    'Before each usage call, GET claude.ai/cdn-cgi/trace and only proceed if colo / loc match',
        'prefs.row.colo.title':        'colo',
        'prefs.row.colo.subtitle':     'Expected Cloudflare colo, default NRT (Tokyo)',
        'prefs.row.loc.title':         'loc',
        'prefs.row.loc.subtitle':      'Expected country code, default JP',
        'prefs.group.token.title':     'Token',
        'prefs.group.token.subtitle':  'OAuth accessToken read from credentials.json',
        'prefs.row.jsonpath.title':    'jsonpath',
        'prefs.row.jsonpath.subtitle': 'Empty = auto-detect ~/.claude/.credentials.json',
        'prefs.group.refresh.title':   'Refresh',
        'prefs.group.refresh.subtitle':'Default 3 min; lower values risk HTTP 429',
        'prefs.row.interval.title':    'Interval (minutes)',
        'prefs.row.interval.subtitle': 'Too low triggers rate limiting',
        'prefs.row.manual.title':      'Require manual first refresh',
        'prefs.row.manual.subtitle':   'On login, exit node / token often are not ready yet; auto-fetch then fails silently. When enabled, the first fetch only happens after you click 5h/7d.',
        'prefs.group.lang.title':      'Language',
        'prefs.group.lang.subtitle':   'Language used by the extension UI',
        'prefs.row.lang.title':        'Display language',
    },
    'zh-CN': {
        'panel.name.5h': 'Claude 5h 用量',
        'panel.name.7d': 'Claude 7d 用量',
        'notify.title': 'Claude 用量',
        'notify.geo.mismatch':
            '出口节点不匹配，已暂停 API 请求\n' +
            '当前 colo={colo} loc={loc}\n' +
            '需要 colo={cfgColo} loc={cfgLoc}',
        'notify.refresh.failed': '刷新失败：\n{reason}',
        'fail.trace.connect': '无法连接 claude.ai 校验出口节点：{err}',
        'fail.trace.http':    'trace HTTP {status}',
        'fail.geo.mismatch':  '出口节点不匹配：colo={colo} loc={loc}（需 {cfgColo}/{cfgLoc}）',
        'fail.token.missing': '找不到 OAuth token，请先登录 Claude Code 或在设置里指定 json 路径',
        'fail.api.429':       'API 被限流（429），稍后重试',
        'fail.api.401':       'Token 已过期，请重新登录',
        'fail.api.http':      'HTTP 错误：{status}',
        'fail.api.network':   '网络错误：{err}',
        'fail.parse':         '解析用量数据失败',
        'prefs.page.title':            '设置',
        'prefs.group.geo.title':       '出口节点校验',
        'prefs.group.geo.subtitle':    '请求 usage 之前先 GET claude.ai/cdn-cgi/trace，colo / loc 都匹配才发请求',
        'prefs.row.colo.title':        'colo',
        'prefs.row.colo.subtitle':     '期望的 Cloudflare 节点，默认 NRT（东京）',
        'prefs.row.loc.title':         'loc',
        'prefs.row.loc.subtitle':      '期望的国家代码，默认 JP',
        'prefs.group.token.title':     'Token',
        'prefs.group.token.subtitle':  '从 credentials.json 读 OAuth accessToken',
        'prefs.row.jsonpath.title':    'jsonpath',
        'prefs.row.jsonpath.subtitle': '留空自动找 ~/.claude/.credentials.json',
        'prefs.group.refresh.title':   '刷新',
        'prefs.group.refresh.subtitle':'默认 3 分钟；小于默认值容易被 API 速率限制（HTTP 429）',
        'prefs.row.interval.title':    '间隔（分钟）',
        'prefs.row.interval.subtitle': '太低会触发限流',
        'prefs.row.manual.title':      '开机后首次必须手动刷新',
        'prefs.row.manual.subtitle':   '开机后出口/token 常没就绪，自动拉容易误报失败；勾选后只在你手动点击时获取',
        'prefs.group.lang.title':      '语言',
        'prefs.group.lang.subtitle':   '扩展界面使用的语言',
        'prefs.row.lang.title':        '显示语言',
    },
};

function detectAuto() {
    // Pick zh-CN only when the system locale is a Chinese (Simplified) one;
    // anything else falls back to English so the extension is English by default.
    const lang = (GLib.getenv('LANGUAGE') || GLib.getenv('LC_ALL') ||
                  GLib.getenv('LC_MESSAGES') || GLib.getenv('LANG') || '').toLowerCase();
    if (lang.startsWith('zh_cn') || lang.startsWith('zh-cn') ||
        lang.startsWith('zh_hans') || lang.startsWith('zh-hans'))
        return 'zh-CN';
    return 'en';
}

export function resolveLocale(setting) {
    if (setting === 'auto' || !setting) return detectAuto();
    if (STRINGS[setting]) return setting;
    return 'en';
}

export function makeTranslator(settings) {
    let locale = resolveLocale(settings.get_string('language'));
    settings.connect('changed::language', () => {
        locale = resolveLocale(settings.get_string('language'));
    });
    return (key, params) => {
        const tbl = STRINGS[locale] || STRINGS.en;
        let s = tbl[key] ?? STRINGS.en[key] ?? key;
        if (params) {
            for (const [k, v] of Object.entries(params))
                s = s.replaceAll('{' + k + '}', String(v));
        }
        return s;
    };
}
