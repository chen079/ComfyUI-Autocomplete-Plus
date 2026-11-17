import { app } from '/scripts/app.js';
import { api } from '/scripts/api.js';

let translations = {};
let loading;

export async function loadTranslations() {
    if (!loading) {
        loading = api.fetchApi('/i18n').then(async (response) => {
            if (!response.ok) throw new Error(`Failed to load translations: ${response.status}`);
            translations = await response.json();
        }).catch((error) => {
            loading = null;
            console.warn('[Autocomplete-Plus]', error);
        });
    }
    await loading;
}

export function t(key, fallback) {
    const locale = app.ui.settings.getSettingValue('Comfy.Locale') || 'en';
    return translations[locale]?.autocompletePlusStyles?.[key]
        ?? translations.en?.autocompletePlusStyles?.[key]
        ?? fallback;
}
