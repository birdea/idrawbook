import { BaseTool } from './base-tool';
import { ICONS } from '../ui/svg-icons';
import { TextAction } from '../actions/text-action';
import type { TextConfig, TextPlacement } from '../actions/text-action';
import type { ICanvasContext, Page } from '../canvas/types';
import type { Point } from './types';

export class TextTool extends BaseTool {
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

    // Offsets for the textarea content relative to the overlay container
    private readonly OFFSET_X = 12;
    private readonly OFFSET_Y = 22;

    private boundHandleClickOutside: (e: MouseEvent) => void;
    private boundHandleKeydown: (e: KeyboardEvent) => void;

    constructor(context: ICanvasContext) {
        super(context);
        this.boundHandleClickOutside = this.handleClickOutside.bind(this);
        this.boundHandleKeydown = this.handleKeydown.bind(this);
    }

    activate(): void {
        this.context.canvas.style.cursor = 'text';
    }

    deactivate(): void {
        if (this._isEditing) {
            this.commitText();
        }
        this.context.canvas.style.cursor = 'crosshair';
    }

    onDown(_e: PointerEvent, worldPos: Point, targetPage: Page | null): void {
        if (!targetPage) {
            if (this._isEditing) {
                this.commitText();
            }
            return;
        }

        // Commit previous edit if active
        // Note: CanvasManager logic called commit BEFORE dispatching input.
        // But InputManager calls onDown.
        if (this._isEditing) {
            this.commitText();
            // If we clicked strictly outside previous overlay, commit happens.
            // THEN we proceed to check if we clicked on existing text or creating new.
        }

        const localPos = {
            x: worldPos.x - targetPage.x,
            y: worldPos.y - targetPage.y,
        };
        const pageInfo = { x: targetPage.x, y: targetPage.y, width: targetPage.width, height: targetPage.height };

        const actions = this.context.historyManager.getActions();
        let hitIndex = -1;
        let hitAction: TextAction | null = null;
        for (let i = actions.length - 1; i >= 0; i--) {
            const a = actions[i];
            if (a instanceof TextAction && a.pageId === targetPage.id) {
                if (a.hitTest(localPos.x, localPos.y, targetPage.ctx)) {
                    hitIndex = i;
                    hitAction = a;
                    break;
                }
            }
        }

        if (hitAction instanceof TextAction && hitIndex >= 0) {
            this.startReEditing(hitAction, hitIndex, pageInfo);
        } else {
            this.startEditing(
                { pageId: targetPage.id, localX: localPos.x, localY: localPos.y },
                pageInfo
            );
        }
    }

    onMove(_e: PointerEvent, _worldPos: Point, _targetPage: Page | null): void {
        // No-op for canvas pointer move
    }

    onUp(_e: PointerEvent, _worldPos: Point, _targetPage: Page | null): void {
        // No-op
    }

    public getEditingActionIndex(): number {
        return this.editingActionIndex;
    }

    public isEditing(): boolean {
        return this._isEditing;
    }



    private startEditing(
        placement: TextPlacement,
        pageInfo: { x: number; y: number; width: number; height: number }
    ): void {
        this.currentPlacement = { ...placement };
        this.currentPageInfo = pageInfo;
        this._isEditing = true;
        this.editingActionIndex = -1;

        this.createOverlay();
        this.positionOverlay();
        this.activateOverlay();
        this.context.onUpdateCallback?.();
    }

    public startReEditing(
        action: TextAction,
        actionIndex: number,
        pageInfo: { x: number; y: number; width: number; height: number }
    ): void {
        this.currentPlacement = { ...action.placement };
        this.currentPageInfo = pageInfo;
        this._isEditing = true;
        this.editingActionIndex = actionIndex;

        this.textConfig = { ...action.textConfig };

        this.createOverlay();
        this.positionOverlay();

        if (this.textareaElement) {
            this.textareaElement.value = action.text;
            this.autoResizeTextarea();
        }

        this.activateOverlay();
        this.context.onUpdateCallback?.();
    }

    private activateOverlay(): void {
        requestAnimationFrame(() => {
            if (this.textareaElement) {
                this.textareaElement.focus();
                this.autoResizeTextarea();
            }
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

        const text = this.textareaElement.value;
        this.syncPlacementFromOverlay();

        // Use current global tool config for 'toolConfig', but we don't really rely on it for text rendering
        const toolConfig = this.context.config;

        if (text.trim().length > 0) {
            const action = new TextAction(
                text,
                this.currentPlacement,
                { ...this.textConfig },
                { ...toolConfig }
            );

            // Logic moved from CanvasManager.handleTextToolAction
            if (this.editingActionIndex >= 0) {
                this.context.historyManager.replaceAction(this.editingActionIndex, action);
            } else {
                this.context.pushAction(action);
            }
        } else if (this.editingActionIndex >= 0) {
            this.context.historyManager.removeAction(this.editingActionIndex);
        }

        this.cleanup(); // Sets isEditing false
        this.context.redraw();
    }



    public cancelEditing(): void {
        this.cleanup();
        // If we were re-editing, omitting commit means no change to history.
        // So we just need to ensure the original text is visible (it was never removed from canvas, just overlaid).
        // Actually, if we were re-editing, the text is still in the history action and on the canvas (unless we cleared it?)
        // Canvas is only redrawn on commit.
        // So cancelling is just removing overlay.
    }

    public destroy(): void {
        this.cleanup();
    }

    private getTextHeadOffset(): number {
        const viewport = {
            scale: this.context.scale,
            offsetX: this.context.offset.x,
            offsetY: this.context.offset.y
        };
        const scaledFontSize = this.textConfig.fontSize * viewport.scale;
        const leading = (this.textConfig.lineHeight - 1) * scaledFontSize / 2;
        return Math.max(0, leading);
    }

    private syncPlacementFromOverlay(): void {
        if (!this.overlayElement || !this.currentPlacement || !this.currentPageInfo) return;

        const viewport = {
            scale: this.context.scale,
            offsetX: this.context.offset.x,
            offsetY: this.context.offset.y
        };
        const canvasRect = this.context.canvas.getBoundingClientRect();
        const containerRect = this.context.container.getBoundingClientRect();

        const overlayLeft = parseFloat(this.overlayElement.style.left);
        const overlayTop = parseFloat(this.overlayElement.style.top);

        const headOffset = this.getTextHeadOffset();

        const screenX = overlayLeft - (canvasRect.left - containerRect.left) + this.OFFSET_X;
        const screenY = overlayTop - (canvasRect.top - containerRect.top) + this.OFFSET_Y + headOffset;

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

        this.context.onUpdateCallback?.();
    }



    private createOverlay(): void {
        if (this.overlayElement) {
            this.overlayElement.remove();
            this.overlayElement = null;
        }

        const overlay = document.createElement('div');
        overlay.className = 'text-overlay-container';

        const dragHandle = document.createElement('div');
        dragHandle.className = 'text-overlay-drag-handle';
        dragHandle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            this.startDrag(e);
        });

        const textarea = document.createElement('textarea');
        textarea.className = 'text-overlay-textarea';
        textarea.spellcheck = false;
        textarea.setAttribute('autocomplete', 'off');
        textarea.setAttribute('autocorrect', 'off');
        textarea.setAttribute('autocapitalize', 'off');

        textarea.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        textarea.addEventListener('compositionstart', () => {
            this.isComposing = true;
        });
        textarea.addEventListener('compositionend', () => {
            this.isComposing = false;
        });

        overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
        overlay.addEventListener('mousedown', (e) => e.stopPropagation());
        overlay.addEventListener('wheel', (e) => e.stopPropagation());

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

        this.context.container.appendChild(overlay);

        this.applyTextConfigToTextarea();
    }



    private autoResizeTextarea(): void {
        if (!this.textareaElement) return;
        this.textareaElement.style.height = 'auto';
        const border = 4;
        const newHeight = this.textareaElement.scrollHeight + border;
        this.textareaElement.style.height = `${newHeight}px`;
    }

    private startDrag(e: PointerEvent): void {
        if (!this.overlayElement) return;
        this.isDragging = true;
        this.dragStartMouse = { x: e.screenX, y: e.screenY };
        this.dragStartOverlayPos = {
            left: parseFloat(this.overlayElement.style.left) || 0,
            top: parseFloat(this.overlayElement.style.top) || 0,
        };

        const onMove = (ev: PointerEvent) => {
            if (!this.isDragging || !this.overlayElement) return;
            const dx = ev.screenX - this.dragStartMouse.x;
            const dy = ev.screenY - this.dragStartMouse.y;
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

    private positionOverlay(): void {
        if (!this.overlayElement || !this.currentPlacement || !this.currentPageInfo) return;

        const viewport = {
            scale: this.context.scale,
            offsetX: this.context.offset.x,
            offsetY: this.context.offset.y
        };
        const canvasRect = this.context.canvas.getBoundingClientRect();
        const containerRect = this.context.container.getBoundingClientRect();

        const worldX = this.currentPageInfo.x + this.currentPlacement.localX;
        const worldY = this.currentPageInfo.y + this.currentPlacement.localY;

        const screenX = worldX * viewport.scale + viewport.offsetX;
        const screenY = worldY * viewport.scale + viewport.offsetY;

        const headOffset = this.getTextHeadOffset();

        const left = canvasRect.left - containerRect.left + screenX - this.OFFSET_X;
        const top = canvasRect.top - containerRect.top + screenY - this.OFFSET_Y - headOffset;

        this.overlayElement.style.left = `${left}px`;
        this.overlayElement.style.top = `${top}px`;
    }

    private applyTextConfigToTextarea(): void {
        if (!this.textareaElement) return;

        const viewport = {
            scale: this.context.scale,
        };
        const scaledFontSize = this.textConfig.fontSize * viewport.scale;

        this.textareaElement.style.fontSize = `${scaledFontSize}px`;
        this.textareaElement.style.color = this.textConfig.color;
        this.textareaElement.style.lineHeight = `${this.textConfig.lineHeight}`;
        this.textareaElement.style.textAlign = this.textConfig.hAlign;
        this.textareaElement.style.fontFamily = this.textConfig.fontFamily;

        this.autoResizeTextarea();
    }

    // ... Options ...
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
                this.autoResizeTextarea();
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
