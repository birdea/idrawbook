import packageInfo from '../package.json';

export const APP_CONFIG = {
    APP_NAME: 'iDrawBook',
    VERSION: packageInfo.version,
    RENDERER_MARGIN: 50,
    HISTORY_LIMIT: 100,
    PALETTE_SETTINGS: {
        count: 20,
        columns: 10
    }
};
