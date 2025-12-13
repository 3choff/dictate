export const i18n = {
    locale: 'en',
    translations: {},

    async init(locale) {
        this.locale = locale || 'en';
        try {
            // Path relative to ui/settings/index.html
            const path = `../shared/locales/${this.locale}.json`;
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Failed to load locale: ${this.locale}`);
            this.translations = await response.json();
            console.log(`[i18n] Loaded locale: ${this.locale}`);
        } catch (e) {
            console.error('[i18n] Error loading translations:', e);
            // Fallback to en if failed
            if (this.locale !== 'en') {
                console.log('[i18n] Falling back to en');
                await this.init('en');
            }
        }
    },

    t(key) {
        const keys = key.split('.');
        let value = this.translations;
        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                return key; // Return key if not found
            }
        }
        return value;
    }
};
