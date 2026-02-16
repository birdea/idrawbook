import { ICONS } from '../icons';

export const iconMap: Record<string, string> = {
    'clear-btn': ICONS.clear,
    'tool-pencil': ICONS.pencil,
    'tool-brush': ICONS.brush,
    'tool-pen': ICONS.pen,
    'tool-text': ICONS.text,
    'tool-eraser': ICONS.eraser,
    'tool-fill': ICONS.bucket,
    'tool-line': ICONS.line,
    'tool-rect': ICONS.rect,
    'tool-circle': ICONS.circle,
    'tool-hand': ICONS.hand,
    'google-login-btn': ICONS.google,
    'export-main-btn': ICONS.download,
    'menu-google-icon': ICONS.google,
    'icon-chevron-stroke': ICONS.chevron,
    'icon-chevron-color': ICONS.chevron,
    'icon-chevron-canvas': ICONS.chevron,
    'icon-arrow-preview': ICONS.chevronRight,
    'menu-header-toggle-left': ICONS.sidebarLeft,
    'zoom-in-btn': ICONS.plus,
    'zoom-out-btn': ICONS.minus,
    'main-undo-btn': ICONS.undo,
    'main-redo-btn': ICONS.redo,
};

export function injectIcons() {
    Object.entries(iconMap).forEach(([id, svg]) => {
        const btn = document.getElementById(id);
        if (btn) {
            if (id === 'export-main-btn') {
                btn.innerHTML = `${svg} <span>Export</span>`;
            } else {
                btn.innerHTML = svg;
            }
        }
    });
}

export function updateOrientationIcons() {
    const isPortrait = window.matchMedia("(orientation: portrait)").matches;

    // Right Toggle Icon
    const rightBtn = document.getElementById('menu-header-toggle-right');
    if (rightBtn) {
        rightBtn.innerHTML = isPortrait ? ICONS.sidebarBottom : ICONS.sidebarRight;
    }

    // Right Menu Label
    const menuBtnR = document.getElementById('menu-toggle-right');
    const panelR = document.querySelector('.properties-panel') as HTMLElement;
    if (menuBtnR && panelR) {
        const label = isPortrait ? 'Bottom Bar' : 'Toolbar (R)';
        const isHidden = panelR.style.display === 'none';
        const verb = isHidden ? 'Show' : 'Hide';
        menuBtnR.innerHTML = `${verb} ${label} <span class="shortcut">^R</span>`;
    }

    // Left Menu Label
    const menuBtnL = document.getElementById('menu-toggle-left');
    const panelL = document.querySelector('.tool-panel') as HTMLElement;
    if (menuBtnL && panelL) {
        const isHidden = panelL.style.display === 'none';
        const verb = isHidden ? 'Show' : 'Hide';
        menuBtnL.innerHTML = `${verb} Toolbar (L) <span class="shortcut">^L</span>`;
    }
}
