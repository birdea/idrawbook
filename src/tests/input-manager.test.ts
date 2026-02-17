import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputManager } from '../canvas/input-manager';
import type { ICanvasContext } from '../canvas/types';
import { ToolManager } from '../canvas/tool-manager';

describe('InputManager', () => {
    let canvas: HTMLCanvasElement;
    let contextMock: ICanvasContext;
    let toolManagerMock: ToolManager;
    let inputManager: InputManager;

    beforeEach(() => {
        document.body.innerHTML = '<canvas id="canvas"></canvas>';
        canvas = document.getElementById('canvas') as HTMLCanvasElement;

        // Mock Canvas behavior
        canvas.setPointerCapture = vi.fn();
        canvas.getBoundingClientRect = vi.fn().mockReturnValue({ left: 0, top: 0, width: 800, height: 600 });
        canvas.style.cursor = 'default';

        toolManagerMock = {
            getCurrentTool: vi.fn().mockReturnValue({
                onDown: vi.fn(),
                onMove: vi.fn(),
                onUp: vi.fn(),
                cancel: vi.fn(),
                activate: vi.fn(),
            }),
            setTool: vi.fn()
        } as unknown as ToolManager;

        contextMock = {
            canvas,
            toolManager: toolManagerMock,
            screenToWorld: vi.fn().mockImplementation((x, y) => ({ x, y })), // Identity
            getPages: vi.fn().mockReturnValue(new Map()),
            setActivePageId: vi.fn(),
            offset: { x: 0, y: 0 },
            scale: 1,
            render: vi.fn(),
            textTool: {
                isEditing: vi.fn().mockReturnValue(false),
                commitText: vi.fn()
            },
            currentTool: 'pencil'
        } as unknown as ICanvasContext;

        inputManager = new InputManager(contextMock);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should handle pointer down', () => {
        const event = new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
        canvas.dispatchEvent(event);

        expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
        expect(toolManagerMock.getCurrentTool().onDown).toHaveBeenCalled();
    });

    it('should handle pointer move', () => {
        // Need down first to track active pointers potentially? 
        // InputManager tracks active pointers only on Down.

        const downEvent = new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
        canvas.dispatchEvent(downEvent);

        const moveEvent = new PointerEvent('pointermove', { pointerId: 1, clientX: 150, clientY: 150 });
        canvas.dispatchEvent(moveEvent);

        expect(toolManagerMock.getCurrentTool().onMove).toHaveBeenCalled();
    });

    it('should handle pointer up', () => {
        const downEvent = new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
        canvas.dispatchEvent(downEvent);

        const upEvent = new PointerEvent('pointerup', { pointerId: 1, clientX: 150, clientY: 150 });
        canvas.dispatchEvent(upEvent);

        expect(toolManagerMock.getCurrentTool().onUp).toHaveBeenCalled();
    });

    it('should handle panning with middle mouse button', () => {
        const event = new PointerEvent('pointerdown', {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
            button: 1, // Middle click
            pointerType: 'mouse'
        });
        canvas.dispatchEvent(event);

        expect((inputManager as any).isPanning).toBe(true);
        expect(canvas.style.cursor).toBe('grabbing');
    });

    it('should pan on move when panning is active', () => {
        // Start panning
        canvas.dispatchEvent(new PointerEvent('pointerdown', {
            pointerId: 1, clientX: 100, clientY: 100, button: 1, pointerType: 'mouse'
        }));

        // Move
        canvas.dispatchEvent(new PointerEvent('pointermove', {
            pointerId: 1, clientX: 120, clientY: 120
        }));

        expect(contextMock.offset.x).toBe(20); // 120 - 100
        expect(contextMock.offset.y).toBe(20);
        expect(contextMock.render).toHaveBeenCalled();
    });

    it('should handle wheel zoom', () => {
        const event = new WheelEvent('wheel', { deltaY: -100, clientX: 100, clientY: 100 });
        canvas.dispatchEvent(event);

        expect(contextMock.render).toHaveBeenCalled();
        // Scale should increase
        expect(contextMock.scale).toBeGreaterThan(1);
    });

    it('should handle pinch zoom (multi-touch)', () => {
        // Touch 1
        canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, isPrimary: true }));
        // Touch 2
        canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 100, isPrimary: false }));

        // Initial distance = 100. Center = 150, 100.

        // Move Touch 2 further away (zoom in)
        canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 300, clientY: 100 }));

        // New distance = 200. Zoom factor = 2.

        // Check if scale updated
        // Note: InputManager uses requestAnimationFrame or specific logic? No, just calls render.
        // But need to check if internal logic for pinch works.
        // The implementation updates scale directly.

        expect(contextMock.scale).toBeGreaterThan(1); // Should have zoomed in
    });
});
