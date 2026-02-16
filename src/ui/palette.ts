import { CanvasManager } from '../canvas/canvas-manager';
import type { DrawingTool } from '../tools';

export interface PaletteSettings {
    count: number;
    columns: number;
}

const baseColors = [
    '#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00',
    '#34C759', '#007AFF', '#5856D6', '#AF52DE', '#A2845E',
    '#1D1D1F', '#F5F5F7', '#FF2D55', '#5AC8FA', '#4CD964',
    '#FF375F', '#FFD60A', '#30D158', '#0A84FF', '#BF5AF2'
];

export function generatePalette(
    settings: PaletteSettings,
    canvasManager: CanvasManager,
    _currentToolProvider: () => DrawingTool,
    updateIndicator: () => void
) {
    const grid = document.getElementById('color-grid');
    if (!grid) return;

    grid.style.setProperty('--cols', settings.columns.toString());
    grid.innerHTML = '';

    for (let i = 0; i < settings.count; i++) {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        const color = baseColors[i % baseColors.length];
        swatch.style.background = color;
        swatch.dataset.color = color;

        if (i === 0) swatch.classList.add('active'); // Default black

        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            canvasManager.setConfig({ color });

            const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
            if (colorPicker) colorPicker.value = color;

            const event = new CustomEvent('colorChanged', { detail: { color } });
            window.dispatchEvent(event);
            updateIndicator();
        });
        grid.appendChild(swatch);
    }
}

export function updateActiveSwatch(color: string) {
    document.querySelectorAll('.color-swatch').forEach(s => {
        if ((s as HTMLElement).dataset.color?.toLowerCase() === color.toLowerCase()) {
            s.classList.add('active');
        } else {
            s.classList.remove('active');
        }
    });
}
