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
    const btn = document.getElementById('menu-header-toggle-right');
    if (btn) {
        btn.innerHTML = isPortrait ? ICONS.sidebarBottom : ICONS.sidebarRight;
    }

    const menuBtn = document.getElementById('menu-toggle-right');
    const panel = document.querySelector('.properties-panel') as HTMLElement;
    if (menuBtn && panel) {
        const label = isPortrait ? 'Bottom Bar' : 'Toolbar (R)';
        const isHidden = panel.style.display === 'none';
        const verb = isHidden ? 'Show' : 'Hide';
        menuBtn.innerHTML = `${verb} ${label} <span class="shortcut">^R</span>`;
    }
}
