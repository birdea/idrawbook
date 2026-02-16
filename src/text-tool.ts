import type { ToolConfig } from './tools';
import type { DrawingAction, ActionType } from './history';
import { ICONS } from './icons';

export interface TextConfig {
    fontSize: number;
    color: string;
    lineHeight: number;
    hAlign: 'left' | 'center' | 'right';
    fontFamily: string;
}

export interface TextPlacement {
    pageId: string;
    localX: number;
    localY: number;
}

export class TextAction implements DrawingAction {
    type: ActionType = 'text';
    text: string;
    placement: TextPlacement;
    textConfig: TextConfig;
    config: ToolConfig;
    pageId: string;

    constructor(text: string, placement: TextPlacement, textConfig: TextConfig, config: ToolConfig) {
        this.text = text;
        this.placement = { ...placement };
        this.textConfig = { ...textConfig };
        this.config = { ...config };
        this.pageId = placement.pageId;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        const { fontSize, color, lineHeight, hAlign, fontFamily } = this.textConfig;
        const { localX, localY } = this.placement;

        ctx.save();
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textAlign = hAlign;
        ctx.textBaseline = 'top';

        const lines = this.text.split('\n');
        const lineHeightPx = fontSize * lineHeight;

        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], localX, localY + i * lineHeightPx);
        }

        ctx.restore();
    }

    /** Hit test: check if a page-local point falls within this text's bounding box */
    hitTest(localX: number, localY: number, ctx: CanvasRenderingContext2D): boolean {
        const { fontSize, lineHeight, fontFamily, hAlign } = this.textConfig;
        const lines = this.text.split('\n');
        const lineHeightPx = fontSize * lineHeight;
        const totalHeight = lines.length * lineHeightPx;

        ctx.save();
        ctx.font = `${fontSize}px ${fontFamily}`;

        let maxWidth = 0;
        for (const line of lines) {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
        }
        ctx.restore();

        const pad = 4;
        let x0 = this.placement.localX - pad;
        if (hAlign === 'center') x0 = this.placement.localX - maxWidth / 2 - pad;
        else if (hAlign === 'right') x0 = this.placement.localX - maxWidth - pad;

        const y0 = this.placement.localY - pad;
        const x1 = x0 + maxWidth + pad * 2;
        const y1 = y0 + totalHeight + pad * 2;

        return localX >= x0 && localX <= x1 && localY >= y0 && localY <= y1;
    }
}

interface ViewportInfo {
    scale: number;
    offsetX: number;
    offsetY: number;
}

export class TextTool {
    private container: HTMLElement;
    private overlayElement: HTMLDivElement | null = null;
    private textareaElement: HTMLTextAreaElement | null = null;
    private optionsPopup: HTMLDivElement | null = null;
    private optionsVisible: boolean = false;

    private textConfig: TextConfig = {
        fontSize: 24,
        color: '#000000',
        lineHeight: 1.4,
        hAlign: 'left',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    };

    private currentPlacement: TextPlacement | null = null;
    private currentPageInfo: { x: number; y: number; width: number; height: number } | null = null;
    private _isEditing: boolean = false;
    private isComposing: boolean = false;

    // Drag state
    private isDragging: boolean = false;
    private dragStartMouse: { x: number; y: number } = { x: 0, y: 0 };
    private dragStartOverlayPos: { left: number; top: number } = { left: 0, top: 0 };

    // Re-edit: the action index being edited (to replace in history)
    private editingActionIndex: number = -1;

    private getViewport: () => ViewportInfo;
    private getCanvasRect: () => DOMRect;
    private onCommit: (action: TextAction, replaceIndex: number) => void;
    private toolConfig: ToolConfig;

    private boundHandleClickOutside: (e: MouseEvent) => void;
    private boundHandleKeydown: (e: KeyboardEvent) => void;

    constructor(
        containerId: string,
        getViewport: () => ViewportInfo,
        getCanvasRect: () => DOMRect,
        onCommit: (action: TextAction, replaceIndex: number) => void,
        toolConfig: ToolConfig
    ) {
        this.container = document.getElementById(containerId) as HTMLElement;
        this.getViewport = getViewport;
        this.getCanvasRect = getCanvasRect;
        this.onCommit = onCommit;
        this.toolConfig = toolConfig;

        this.boundHandleClickOutside = this.handleClickOutside.bind(this);
        this.boundHandleKeydown = this.handleKeydown.bind(this);
    }

    public updateToolConfig(config: ToolConfig) {
        this.toolConfig = config;
    }

    /** Start a new text editing session at the given placement */
    public startEditing(
        placement: TextPlacement,
        pageInfo: { x: number; y: number; width: number; height: number }
    ): void {
        if (this._isEditing) {
            this.commitText();
        }

        this.currentPlacement = { ...placement };
        this.currentPageInfo = pageInfo;
        this._isEditing = true;
        this.editingActionIndex = -1;

        this.createOverlay();
        this.positionOverlay();

        requestAnimationFrame(() => {
            this.textareaElement?.focus();
        });

        setTimeout(() => {
            document.addEventListener('mousedown', this.boundHandleClickOutside, true);
            document.addEventListener('keydown', this.boundHandleKeydown, true);
        }, 0);
    }

    /** Re-edit an existing TextAction (clicked on committed text) */
    public startReEditing(
        action: TextAction,
        actionIndex: number,
        pageInfo: { x: number; y: number; width: number; height: number }
    ): void {
        if (this._isEditing) {
            this.commitText();
        }

        this.currentPlacement = { ...action.placement };
        this.currentPageInfo = pageInfo;
        this._isEditing = true;
        this.editingActionIndex = actionIndex;

        // Restore text config from the action
        this.textConfig = { ...action.textConfig };

        this.createOverlay();
        this.positionOverlay();

        // Fill in the existing text
        if (this.textareaElement) {
            this.textareaElement.value = action.text;
        }

        requestAnimationFrame(() => {
            this.textareaElement?.focus();
        });

        setTimeout(() => {
            document.addEventListener('mousedown', this.boundHandleClickOutside, true);
            document.addEventListener('keydown', this.boundHandleKeydown, true);
        }, 0);
    }

    public commitText(): void {
        if (!this._isEditing || !this.textareaElement || !this.currentPlacement) {
            this.cleanup();
            return;
        }

        // If we are composing (IME), we still want to cleanup the UI to avoid duplicates.
        // We can choose to commit the current value or not. Usually, committing is safer for users.
        const text = this.textareaElement.value;

        // Recalculate localX/localY from current overlay position (may have been dragged)
        this.syncPlacementFromOverlay();

        if (text.trim().length > 0) {
            const action = new TextAction(
                text,
                this.currentPlacement,
                { ...this.textConfig },
                { ...this.toolConfig }
            );
            this.onCommit(action, this.editingActionIndex);
        } else if (this.editingActionIndex >= 0) {
            // Text cleared during re-edit: commit empty to signal removal
            const action = new TextAction(
                '',
                this.currentPlacement,
                { ...this.textConfig },
                { ...this.toolConfig }
            );
            this.onCommit(action, this.editingActionIndex);
        }

        this.cleanup();
    }

    public cancelEditing(): void {
        this.cleanup();
    }

    public isEditing(): boolean {
        return this._isEditing;
    }

    public destroy(): void {
        this.cleanup();
    }

    /** Convert current overlay screen position back to page-local coordinates */
    private syncPlacementFromOverlay(): void {
        if (!this.overlayElement || !this.currentPlacement || !this.currentPageInfo) return;

        const viewport = this.getViewport();
        const canvasRect = this.getCanvasRect();
        const containerRect = this.container.getBoundingClientRect();

        const overlayLeft = parseFloat(this.overlayElement.style.left);
        const overlayTop = parseFloat(this.overlayElement.style.top);

        // Reverse of positionOverlay: screen -> world -> local
        const screenX = overlayLeft - (canvasRect.left - containerRect.left);
        const screenY = overlayTop - (canvasRect.top - containerRect.top);

        const worldX = (screenX - viewport.offsetX) / viewport.scale;
        const worldY = (screenY - viewport.offsetY) / viewport.scale;

        this.currentPlacement.localX = worldX - this.currentPageInfo.x;
        this.currentPlacement.localY = worldY - this.currentPageInfo.y;
    }

    private cleanup(): void {
        this._isEditing = false;
        this.currentPlacement = null;
        this.currentPageInfo = null;
        this.isComposing = false;
        this.optionsVisible = false;
        this.isDragging = false;
        this.editingActionIndex = -1;

        document.removeEventListener('mousedown', this.boundHandleClickOutside, true);
        document.removeEventListener('keydown', this.boundHandleKeydown, true);

        if (this.overlayElement) {
            this.overlayElement.remove();
            this.overlayElement = null;
        }
        this.textareaElement = null;
        this.optionsPopup = null;
    }

    private createOverlay(): void {
        // Defensive: cleanup any abandoned overlays from the same container
        if (this.overlayElement) {
            this.overlayElement.remove();
            this.overlayElement = null;
        }

        // Also check if any existing overlays are still in the container just to be absolutely sure
        const existing = this.container.querySelectorAll('.text-overlay-container');
        existing.forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'text-overlay-container';

        // Drag handle bar at the top
        const dragHandle = document.createElement('div');
        dragHandle.className = 'text-overlay-drag-handle';
        dragHandle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.startDrag(e);
        });

        // Textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'text-overlay-textarea';
        textarea.spellcheck = false;
        textarea.setAttribute('autocomplete', 'off');
        textarea.setAttribute('autocorrect', 'off');
        textarea.setAttribute('autocapitalize', 'off');

        textarea.addEventListener('compositionstart', () => {
            this.isComposing = true;
        });
        textarea.addEventListener('compositionend', () => {
            this.isComposing = false;
        });

        // Prevent events from reaching canvas
        overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
        overlay.addEventListener('mousedown', (e) => e.stopPropagation());
        overlay.addEventListener('wheel', (e) => e.stopPropagation());

        // Options gear button
        const optionsBtn = document.createElement('button');
        optionsBtn.className = 'text-options-btn-trigger';
        optionsBtn.innerHTML = ICONS.gear;
        optionsBtn.title = 'Text Options';
        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleOptionsPopup();
        });

        overlay.appendChild(dragHandle);
        overlay.appendChild(textarea);
        overlay.appendChild(optionsBtn);

        this.overlayElement = overlay;
        this.textareaElement = textarea;

        this.container.appendChild(overlay);

        this.applyTextConfigToTextarea();
    }

    // --- Drag logic ---

    private startDrag(e: PointerEvent): void {
        if (!this.overlayElement) return;
        this.isDragging = true;
        this.dragStartMouse = { x: e.clientX, y: e.clientY };
        this.dragStartOverlayPos = {
            left: parseFloat(this.overlayElement.style.left) || 0,
            top: parseFloat(this.overlayElement.style.top) || 0,
        };

        const onMove = (ev: PointerEvent) => {
            if (!this.isDragging || !this.overlayElement) return;
            const dx = ev.clientX - this.dragStartMouse.x;
            const dy = ev.clientY - this.dragStartMouse.y;
            this.overlayElement.style.left = `${this.dragStartOverlayPos.left + dx}px`;
            this.overlayElement.style.top = `${this.dragStartOverlayPos.top + dy}px`;
        };

        const onUp = () => {
            this.isDragging = false;
            document.removeEventListener('pointermove', onMove, true);
            document.removeEventListener('pointerup', onUp, true);
        };

        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
    }

    // --- Positioning ---

    private positionOverlay(): void {
        if (!this.overlayElement || !this.currentPlacement || !this.currentPageInfo) return;

        const viewport = this.getViewport();
        const canvasRect = this.getCanvasRect();
        const containerRect = this.container.getBoundingClientRect();

        const worldX = this.currentPageInfo.x + this.currentPlacement.localX;
        const worldY = this.currentPageInfo.y + this.currentPlacement.localY;

        const screenX = worldX * viewport.scale + viewport.offsetX;
        const screenY = worldY * viewport.scale + viewport.offsetY;

        const left = canvasRect.left - containerRect.left + screenX;
        const top = canvasRect.top - containerRect.top + screenY;

        this.overlayElement.style.left = `${left}px`;
        this.overlayElement.style.top = `${top}px`;
    }

    private applyTextConfigToTextarea(): void {
        if (!this.textareaElement) return;

        const viewport = this.getViewport();
        const scaledFontSize = this.textConfig.fontSize * viewport.scale;

        this.textareaElement.style.fontSize = `${scaledFontSize}px`;
        this.textareaElement.style.color = this.textConfig.color;
        this.textareaElement.style.lineHeight = `${this.textConfig.lineHeight}`;
        this.textareaElement.style.textAlign = this.textConfig.hAlign;
        this.textareaElement.style.fontFamily = this.textConfig.fontFamily;
    }

    // --- Options popup ---

    private toggleOptionsPopup(): void {
        if (this.optionsVisible) {
            this.hideOptionsPopup();
        } else {
            this.showOptionsPopup();
        }
    }

    private showOptionsPopup(): void {
        if (!this.overlayElement) return;
        if (this.optionsPopup) {
            this.optionsPopup.remove();
        }
        this.optionsVisible = true;
        this.optionsPopup = this.createOptionsPopup();
        this.overlayElement.appendChild(this.optionsPopup);
    }

    private hideOptionsPopup(): void {
        this.optionsVisible = false;
        if (this.optionsPopup) {
            this.optionsPopup.remove();
            this.optionsPopup = null;
        }
    }

    private createOptionsPopup(): HTMLDivElement {
        const popup = document.createElement('div');
        popup.className = 'text-options-popup';

        popup.addEventListener('mousedown', (e) => e.stopPropagation());
        popup.addEventListener('pointerdown', (e) => e.stopPropagation());

        // Font Size
        const fontSizeRow = this.createRow('Size');
        const fontSizeInput = document.createElement('input');
        fontSizeInput.type = 'number';
        fontSizeInput.className = 'text-opt-input';
        fontSizeInput.min = '8';
        fontSizeInput.max = '200';
        fontSizeInput.value = this.textConfig.fontSize.toString();
        fontSizeInput.addEventListener('input', () => {
            const val = parseInt(fontSizeInput.value);
            if (val >= 8 && val <= 200) {
                this.textConfig.fontSize = val;
                this.applyTextConfigToTextarea();
            }
        });
        const fontSizeUnit = document.createElement('span');
        fontSizeUnit.className = 'text-opt-unit';
        fontSizeUnit.textContent = 'px';
        fontSizeRow.appendChild(fontSizeInput);
        fontSizeRow.appendChild(fontSizeUnit);
        popup.appendChild(fontSizeRow);

        // Color
        const colorRow = this.createRow('Color');
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'text-opt-color';
        colorInput.value = this.textConfig.color;
        colorInput.addEventListener('input', () => {
            this.textConfig.color = colorInput.value;
            this.applyTextConfigToTextarea();
        });
        colorRow.appendChild(colorInput);
        popup.appendChild(colorRow);

        // Line Spacing
        const lineRow = this.createRow('Spacing');
        const lineInput = document.createElement('input');
        lineInput.type = 'number';
        lineInput.className = 'text-opt-input';
        lineInput.min = '0.5';
        lineInput.max = '5';
        lineInput.step = '0.1';
        lineInput.value = this.textConfig.lineHeight.toString();
        lineInput.addEventListener('input', () => {
            const val = parseFloat(lineInput.value);
            if (val >= 0.5 && val <= 5) {
                this.textConfig.lineHeight = val;
                this.applyTextConfigToTextarea();
            }
        });
        lineRow.appendChild(lineInput);
        popup.appendChild(lineRow);

        // H-Align
        const hAlignRow = this.createRow('Align');
        const hAlignGroup = document.createElement('div');
        hAlignGroup.className = 'text-opt-group';

        const hAligns: { value: 'left' | 'center' | 'right'; icon: string }[] = [
            { value: 'left', icon: ICONS.alignLeft },
            { value: 'center', icon: ICONS.alignCenter },
            { value: 'right', icon: ICONS.alignRight },
        ];

        hAligns.forEach(({ value, icon }) => {
            const btn = document.createElement('button');
            btn.className = `text-opt-btn${this.textConfig.hAlign === value ? ' active' : ''}`;
            btn.innerHTML = icon;
            btn.title = value.charAt(0).toUpperCase() + value.slice(1);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.textConfig.hAlign = value;
                hAlignGroup.querySelectorAll('.text-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.applyTextConfigToTextarea();
            });
            hAlignGroup.appendChild(btn);
        });
        hAlignRow.appendChild(hAlignGroup);
        popup.appendChild(hAlignRow);

        // Separator
        const sep = document.createElement('div');
        sep.className = 'text-options-separator';
        popup.appendChild(sep);

        // Clear Text
        const clearRow = document.createElement('div');
        clearRow.className = 'text-options-row';
        const clearBtn = document.createElement('button');
        clearBtn.className = 'text-opt-clear';
        clearBtn.innerHTML = `${ICONS.trash}<span>Clear Text</span>`;
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.textareaElement) {
                this.textareaElement.value = '';
                this.textareaElement.focus();
            }
        });
        clearRow.appendChild(clearBtn);
        popup.appendChild(clearRow);

        return popup;
    }

    private createRow(label: string): HTMLDivElement {
        const row = document.createElement('div');
        row.className = 'text-options-row';
        const lbl = document.createElement('label');
        lbl.textContent = label;
        row.appendChild(lbl);
        return row;
    }

    // --- Event handlers ---

    private handleClickOutside(e: MouseEvent): void {
        if (!this.overlayElement) return;
        const target = e.target as HTMLElement;
        if (this.overlayElement.contains(target)) return;
        if (this.isComposing) return;
        this.commitText();
    }

    private handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && !this.isComposing) {
            e.preventDefault();
            e.stopPropagation();
            this.commitText();
        }
    }
}
