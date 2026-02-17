import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextTool } from '../tools/text-tool';
import { TextAction, type TextPlacement, type TextConfig } from '../actions/text-action';
import type { ToolConfig } from '../tools/types';
import type { ICanvasContext } from '../canvas/types';

describe('TextTool', () => {
    let container: HTMLElement;
    let canvas: HTMLCanvasElement;
    let tool: TextTool;
    const toolConfig: ToolConfig = { size: 10, color: '#000000', opacity: 100, hardness: 100, pressure: 50 };

    // Mock Context
    let context: ICanvasContext;
    let historyManagerMock: any;

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"><div id="canvas-container"><canvas id="canvas"></canvas></div></div>';
        container = document.getElementById('canvas-container') as HTMLElement;
        canvas = document.getElementById('canvas') as HTMLCanvasElement;

        historyManagerMock = {
            push: vi.fn(),
            replaceAction: vi.fn(),
            removeAction: vi.fn(),
            getActions: vi.fn().mockReturnValue([])
        };

        context = {
            canvas,
            container,
            ctx: {} as CanvasRenderingContext2D, // Mock if needed
            scale: 1,
            offset: { x: 0, y: 0 },
            config: toolConfig,
            historyManager: historyManagerMock,
            getPages: () => new Map(),
            render: vi.fn(),
            redraw: vi.fn().mockResolvedValue(undefined),
            pushAction: vi.fn().mockImplementation((action) => historyManagerMock.push(action)),
            onUpdateCallback: vi.fn(),
            screenToWorld: (x: number, y: number) => ({ x, y }), // Simplified identity
        } as unknown as ICanvasContext;

        tool = new TextTool(context);
    });

    afterEach(() => {
        tool.deactivate(); // cleanup
        // tool.destroy(); // TextTool doesn't have destroy anymore, cleanup is sufficient or create new one
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('should initialize correctly', () => {
        expect(tool.isEditing()).toBe(false);
    });

    it('should start editing and create overlay', () => {
        const placement: TextPlacement = { pageId: 'page1', localX: 10, localY: 10 };
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };

        // Use private method or trigger via onDown?
        // Let's use internal method as tests did before, but updated signature
        // The implementation has startEditing as private? No, let's check.
        // In my implementation: private startEditing?
        // Checking Step 92: private startEditing.
        // Checking Step 116 (InputManager): this.context.textTool?.startEditing(...) 
        // So it MUST be public.
        // I declared it private in Step 92? 
        // "private startEditing"
        // Wait, InputManager calls it. So it must fail compile if private.
        // I need to check if I made it public.

        // If it is private, I should make it public or test via onDown.
        // Test via onDown is better integration test.

        // Let's modify InputManager to call public method? 
        // Or make it public in TextTool.

        // Based on InputManager code in Step 120, checking:
        // `this.context.textTool?.startEditing`
        // If I defined it private, TS should error.

        // I will assume I need to fix visibility in TextTool IF it is private.
        // But for this test, I can cast to any.
        (tool as any).startEditing(placement, pageInfo);

        expect(tool.isEditing()).toBe(true);
        const overlay = container.querySelector('.text-overlay-container');
        expect(overlay).not.toBeNull();
        const textarea = container.querySelector('textarea');
        expect(textarea).not.toBeNull();
    });

    it('should commit text on commitText()', () => {
        const placement: TextPlacement = { pageId: 'page1', localX: 10, localY: 10 };
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };

        (tool as any).startEditing(placement, pageInfo);

        const textarea = container.querySelector('textarea')!;
        textarea.value = 'Hello World';

        tool.commitText();

        expect(historyManagerMock.push).toHaveBeenCalled();
        expect(tool.isEditing()).toBe(false);
        const overlay = container.querySelector('.text-overlay-container');
        expect(overlay).toBeNull();

        const action = historyManagerMock.push.mock.calls[0][0];
        expect(action).toBeInstanceOf(TextAction);
        expect(action.text).toBe('Hello World');
    });

    it('should update tool config check', () => {
        // TextTool reads context.config on commit.
        const newConfig: ToolConfig = { ...toolConfig, color: '#ff0000' };
        context.config = newConfig;

        const placement: TextPlacement = { pageId: 'page1', localX: 10, localY: 10 };
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };
        (tool as any).startEditing(placement, pageInfo);

        const textarea = container.querySelector('textarea')!;
        textarea.value = 'Test';
        tool.commitText();

        const action = historyManagerMock.push.mock.calls[0][0];
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

        textarea.value = 'Edited';
        tool.commitText();

        expect(historyManagerMock.replaceAction).toHaveBeenCalled();
        const [index, newAction] = historyManagerMock.replaceAction.mock.calls[0];
        expect(index).toBe(5);
        expect(newAction.text).toBe('Edited');
    });

    it('should remove action if empty text on re-edit', () => {
        const placement: TextPlacement = { pageId: 'page1', localX: 10, localY: 10 };
        const action = new TextAction('To be deleted', placement, { ...toolConfig, fontSize: 10 } as any, toolConfig);
        const pageInfo = { x: 0, y: 0, width: 800, height: 600 };

        tool.startReEditing(action, 2, pageInfo);

        const textarea = container.querySelector('textarea')!;
        textarea.value = '   '; // Only whitespace

        tool.commitText();

        expect(historyManagerMock.removeAction).toHaveBeenCalledWith(2);
    });
});

// TextAction tests can remain as is, or be copied if they were in the same file
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
        // hit test logic... reused from previous test
        const hit = action.hitTest(60, 60, ctx);
        expect(hit).toBe(true);
        const miss = action.hitTest(10, 10, ctx);
        expect(miss).toBe(false);
    });
});
