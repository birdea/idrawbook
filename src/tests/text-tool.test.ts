import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextTool } from '../tools/text-tool';
import { TextAction, type TextPlacement, type TextConfig } from '../actions/text-action';
import type { ToolConfig } from '../tools/types';

describe('TextTool', () => {
    let container: HTMLElement;
    let tool: TextTool;
    const viewPort = { scale: 1, offsetX: 0, offsetY: 0 };
    const canvasRect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => { } };
    const onCommit = vi.fn();
    const toolConfig: ToolConfig = { size: 10, color: '#000000', opacity: 100, hardness: 100, pressure: 50 };

    // Mock getViewport and getCanvasRect
    const getViewport = () => viewPort;
    const getCanvasRect = () => canvasRect;

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"><div id="canvas-container"></div></div>';
        container = document.getElementById('canvas-container') as HTMLElement;
        tool = new TextTool('canvas-container', getViewport, getCanvasRect, onCommit, toolConfig);
    });

    afterEach(() => {
        tool.destroy();
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('should initialize correctly', () => {
        expect(tool.isEditing()).toBe(false);
    });

    it('should start editing and create overlay', () => {
        const placement: TextPlacement = { pageId: 'page1', localX: 10, localY: 10 };
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };

        tool.startEditing(placement, pageInfo);

        expect(tool.isEditing()).toBe(true);
        const overlay = container.querySelector('.text-overlay-container');
        expect(overlay).not.toBeNull();
        const textarea = container.querySelector('textarea');
        expect(textarea).not.toBeNull();
    });

    it('should commit text on commitText()', () => {
        const placement: TextPlacement = { pageId: 'page1', localX: 10, localY: 10 };
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };

        tool.startEditing(placement, pageInfo);

        const textarea = container.querySelector('textarea')!;
        textarea.value = 'Hello World';

        tool.commitText();

        expect(onCommit).toHaveBeenCalled();
        expect(tool.isEditing()).toBe(false);
        const overlay = container.querySelector('.text-overlay-container');
        expect(overlay).toBeNull();

        // Verify call arguments
        const [action, index] = onCommit.mock.calls[0];
        expect(action).toBeInstanceOf(TextAction);
        expect(action.text).toBe('Hello World');
        expect(index).toBe(-1);
    });

    it('should update tool config', () => {
        const newConfig: ToolConfig = { ...toolConfig, color: '#ff0000' };
        tool.updateToolConfig(newConfig);
        // We can't easily check private property, but we can verify behavior if we start editing
        // The implementation copies toolConfig to TextAction on commit.

        const placement: TextPlacement = { pageId: 'page1', localX: 10, localY: 10 };
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };
        tool.startEditing(placement, pageInfo);
        const textarea = container.querySelector('textarea')!;
        textarea.value = 'Test';
        tool.commitText();

        const [action] = onCommit.mock.calls[0];
        expect(action.config.color).toBe('#ff0000');
    });

    it('should re-edit existing text', () => {
        const placement: TextPlacement = { pageId: 'page1', localX: 10, localY: 10 };
        const textConfig = { fontSize: 20, color: '#000000', lineHeight: 1.2, hAlign: 'left' as const, fontFamily: 'serif' };
        const action = new TextAction('Re-edit me', placement, textConfig, toolConfig);
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };

        tool.startReEditing(action, 5, pageInfo);

        expect(tool.isEditing()).toBe(true);
        const textarea = container.querySelector('textarea')!;
        expect(textarea.value).toBe('Re-edit me');

        // Change text
        textarea.value = 'Edited';
        tool.commitText();

        expect(onCommit).toHaveBeenCalled();
        const [newAction, index] = onCommit.mock.calls[0];
        expect(newAction.text).toBe('Edited');
        expect(index).toBe(5);
    });

    it('should remove action if empty text on re-edit', () => {
        const placement: TextPlacement = { pageId: 'page1', localX: 10, localY: 10 };
        const action = new TextAction('To be deleted', placement, { ...toolConfig, fontSize: 10 } as any, toolConfig);
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };

        tool.startReEditing(action, 2, pageInfo);

        const textarea = container.querySelector('textarea')!;
        textarea.value = '   '; // Only whitespace

        tool.commitText();

        expect(onCommit).toHaveBeenCalled();
        const [committedAction, index] = onCommit.mock.calls[0];
        expect(committedAction.text).toBe(''); // Empty action signals removal? Implementation says: "commit empty to signal removal"
        // Wait, implementation:
        // const action = new TextAction('', ...);
        // this.onCommit(action, this.editingActionIndex);

        expect(committedAction.text).toBe('');
        expect(index).toBe(2);
    });

    it('should cancel editing', () => {
        tool.startEditing({ pageId: '1', localX: 0, localY: 0 }, { x: 0, y: 0, width: 100, height: 100 });
        tool.cancelEditing();
        expect(tool.isEditing()).toBe(false);
        const overlay = container.querySelector('.text-overlay-container');
        expect(overlay).toBeNull();
    });

    it('should drag overlay', () => {
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };
        tool.startEditing({ pageId: '1', localX: 10, localY: 10 }, pageInfo);
        const overlay = container.querySelector('.text-overlay-container') as HTMLElement;
        const dragHandle = container.querySelector('.text-overlay-drag-handle') as HTMLElement;

        // Ensure dragHandle exists
        expect(dragHandle).not.toBeNull();

        // Initial pos
        const initialLeft = parseFloat(overlay.style.left || '0');
        const initialTop = parseFloat(overlay.style.top || '0');

        // Mock pointer capture
        dragHandle.setPointerCapture = vi.fn();
        dragHandle.releasePointerCapture = vi.fn();

        // Drag start
        dragHandle.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerId: 1,
            screenX: 100,
            screenY: 100
        }));

        // Move
        document.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true,
            screenX: 150, // +50
            screenY: 150  // +50
        }));

        const newLeft = parseFloat(overlay.style.left);
        const newTop = parseFloat(overlay.style.top);

        // Just verify it moved
        expect(newLeft).not.toBe(initialLeft);
        expect(newTop).not.toBe(initialTop);

        // Up
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });

    it('should show options popup', () => {
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };
        tool.startEditing({ pageId: '1', localX: 10, localY: 10 }, pageInfo);
        const optionsBtn = container.querySelector('.text-options-btn-trigger') as HTMLElement;

        // click
        optionsBtn.click();

        const popup = container.querySelector('.text-options-popup');
        expect(popup).not.toBeNull();

        // click again to hide
        optionsBtn.click();
        expect(container.querySelector('.text-options-popup')).toBeNull();
    });

    it('should handle options interactions', () => {
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };
        tool.startEditing({ pageId: '1', localX: 10, localY: 10 }, pageInfo);
        const optionsBtn = container.querySelector('.text-options-btn-trigger') as HTMLElement;
        optionsBtn.click();

        const popup = container.querySelector('.text-options-popup') as HTMLElement;
        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

        // Color
        const colorInput = popup.querySelector('input[type="color"]') as HTMLInputElement;
        colorInput.value = '#0000ff';
        colorInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(textarea.style.color).toBe('rgb(0, 0, 255)'); // jsdom normalizes color

        // Font Size Invalid
        const sizeInput = popup.querySelector('.text-opt-input') as HTMLInputElement;
        // size is usually first input

        // Valid
        sizeInput.value = '30';
        sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(textarea.style.fontSize).toContain('30px');

        // Invalid high
        sizeInput.value = '300';
        sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
        // Should remain 30 (not updated to 300)
        expect(textarea.style.fontSize).toContain('30px');

        // Invalid low
        sizeInput.value = '2';
        sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(textarea.style.fontSize).toContain('30px');

        // Line Height
        const lineInputs = popup.querySelectorAll('input[type="number"]');
        // Index 1 is line height (0 is font size)
        const lineInput = lineInputs[1] as HTMLInputElement;
        // Or find based on label?
        // createRow('Spacing') -> label 'Spacing'.
        // Assuming order: Size, Color, Spacing, Align, etc.
        // Color is input[type="color"].
        // Size is input[type="number"].
        // Spacing is input[type="number"].
        // Let's rely on querySelectorAll order: 0=size, 1=spacing.

        lineInput.value = '2';
        lineInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(textarea.style.lineHeight).toBe('2');

        // Align
        // Buttons in .text-opt-group
        const alignBtns = popup.querySelectorAll('.text-opt-btn');
        // 0=left, 1=center, 2=right
        const centerBtn = alignBtns[1] as HTMLElement;
        centerBtn.click();
        expect(textarea.style.textAlign).toBe('center');

        // Clear Text
        // Button with trash icon
        const clearBtn = popup.querySelector('.text-opt-clear') as HTMLElement;
        textarea.value = 'Some text';
        clearBtn.click();
        expect(textarea.value).toBe('');
    });

    it('should commit on Escape', async () => {
        vi.useFakeTimers();
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };
        tool.startEditing({ pageId: '1', localX: 10, localY: 10 }, pageInfo);

        vi.runAllTimers();

        const textarea = container.querySelector('textarea')!;
        textarea.value = 'Text';

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(onCommit).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('should commit on click outside', async () => {
        vi.useFakeTimers();
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };
        tool.startEditing({ pageId: '1', localX: 10, localY: 10 }, pageInfo);

        vi.runAllTimers();

        const textarea = container.querySelector('textarea')!;
        textarea.value = 'Text';

        // Click on document body (outside overlay)
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        expect(onCommit).toHaveBeenCalled();
        vi.useRealTimers();
    });

});

describe('TextAction', () => {
    const placement: TextPlacement = { pageId: 'p1', localX: 50, localY: 50 };
    const textConfig: TextConfig = { fontSize: 20, color: '#000', lineHeight: 1.5, hAlign: 'left', fontFamily: 'Arial' };
    const toolConfig: ToolConfig = { size: 1, color: '#000', opacity: 1, hardness: 100, pressure: 50 };
    const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 50 }),
        font: '',
        fillStyle: '',
        textAlign: '',
        textBaseline: ''
    } as unknown as CanvasRenderingContext2D;

    it('hitTest should detect hits', () => {
        const action = new TextAction('Hit me', placement, textConfig, toolConfig);
        // placement is 50,50.
        // mocked width 50.
        // height = 1 line * 20 * 1.5 = 30.
        // box around 50,50 to 100,80 (plus padding 4) -> 46,46 to 104,84

        const hit = action.hitTest(60, 60, ctx);
        expect(hit).toBe(true);

        const miss = action.hitTest(10, 10, ctx);
        expect(miss).toBe(false);
    });

    it('draw should call ctx methods', () => {
        const action = new TextAction('Line1\nLine2', placement, textConfig, toolConfig);
        action.draw(ctx);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledTimes(2);
        expect(ctx.restore).toHaveBeenCalled();
    });
});
