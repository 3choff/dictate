const { invoke } = window.__TAURI__?.core || {};
const { getCurrentWindow } = window.__TAURI__?.window || {};

async function safeHide() {
    try {
        const w = getCurrentWindow();
        await w.hide();
    } catch (_) {}
}

async function safeInvoke(cmd, payload) {
    if (!invoke) return undefined;
    try {
        return await invoke(cmd, payload);
    } catch (_) {
        return undefined;
    }
}

function applyLabels() {
    const labels = window.__TRAY_LABELS__;
    if (!labels) return;

    const toggleBtn = document.getElementById('tray-action-toggle');
    const settingsBtn = document.getElementById('tray-action-settings');
    const quitBtn = document.getElementById('tray-action-quit');

    if (toggleBtn && labels.show) toggleBtn.textContent = labels.show;
    if (settingsBtn && labels.settings) settingsBtn.textContent = labels.settings;
    if (quitBtn && labels.quit) quitBtn.textContent = labels.quit;
}

window.__applyTrayLabels__ = applyLabels;

let lastSentSize = { width: 0, height: 0 };
let sizeRaf = null;

async function sendMenuSize() {
    const el = document.querySelector('.menu');
    if (!el) return;

    const r = el.getBoundingClientRect();
    const width = Math.ceil(r.width);
    const height = Math.ceil(r.height);

    if (Math.abs(width - lastSentSize.width) < 1 && Math.abs(height - lastSentSize.height) < 1) return;
    lastSentSize = { width, height };
    await safeInvoke('update_tray_menu_size', { width, height });
}

function scheduleSendMenuSize() {
    if (sizeRaf) return;
    sizeRaf = requestAnimationFrame(async () => {
        sizeRaf = null;
        await sendMenuSize();
    });
}

async function init() {
    window.addEventListener('blur', () => {
        safeHide();
    });

    document.addEventListener('pointerdown', (e) => {
        const menu = document.querySelector('.menu');
        if (!menu) return;
        if (!menu.contains(e.target)) {
            safeHide();
        }
    }, { capture: true });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            safeHide();
        }
    });

    await safeInvoke('tray_menu_ready');

    const settings = await safeInvoke('get_settings');
    const theme = (settings?.dark_mode_enabled !== false) ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);

    applyLabels();

    scheduleSendMenuSize();
    try {
        const menu = document.querySelector('.menu');
        if (menu && window.ResizeObserver) {
            const ro = new ResizeObserver(() => scheduleSendMenuSize());
            ro.observe(menu);
        }
    } catch (_) {}

    const toggleBtn = document.getElementById('tray-action-toggle');
    const settingsBtn = document.getElementById('tray-action-settings');
    const quitBtn = document.getElementById('tray-action-quit');

    toggleBtn?.addEventListener('click', async () => {
        await safeHide();
        await safeInvoke('toggle_main_window');
    });

    settingsBtn?.addEventListener('click', async () => {
        await safeHide();
        await safeInvoke('open_settings_window');
    });

    quitBtn?.addEventListener('click', async () => {
        await safeHide();
        await safeInvoke('exit_app');
    });
}

init();
