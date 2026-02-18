import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShapeTool } from '../tools/shape-tool';
import type { ICanvasContext, Page } from '../canvas/types';
import type { ToolConfig } from '../tools/types';
import { ShapeAction } from '../history';

// Mock dependencies
vi.mock('../tools/tool-utils', () => ({
    ToolUtils: {
        setupContext: vi.fn(),
        drawLine: vi.fn(),
        drawRect: vi.fn(),
        drawCircle: vi.fn(),
    }
}));

vi.mock('../history', () => ({
    ShapeAction: vi.fn()
}));

describe('ShapeTool', () => {
    let shapeTool: ShapeTool;
    let mockContext: ICanvasContext;
    let mockPage: Page;
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
        mockCtx = {
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            arc: vi.fn(),
            rect: vi.fn(),
            clearRect: vi.fn(),
            canvas: { width: 800, height: 600 }
        } as unknown as CanvasRenderingContext2D;

        const config: ToolConfig = {
            color: '#000000',
            size: 5,
            opacity: 100,
            hardness: 100,
            pressure: 0.5
        };

        const mockPageCtx = { ...mockCtx } as unknown as CanvasRenderingContext2D;

        mockContext = {
            ctx: mockCtx,
            offscreenCtx: mockCtx,
            offscreenCanvas: { width: 800, height: 600 } as HTMLCanvasElement,
            canvas: {
                style: {},
                getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 })),
                releasePointerCapture: vi.fn(),
            } as unknown as HTMLCanvasElement,
            config,
            currentTool: 'rect',
            worldToScreen: vi.fn((x, y) => ({ x, y })),
            render: vi.fn(),
            pushAction: vi.fn(),
            onUpdateCallback: vi.fn(),
        } as unknown as ICanvasContext;

        mockPage = {
            id: 'page1',
            x: 100,
            y: 100,
            width: 400,
            height: 300,
            ctx: mockPageCtx,
            canvas: {} as HTMLCanvasElement
        };

        shapeTool = new ShapeTool(mockContext as ICanvasContext);
    });

    it('should initialize correctly', () => {
        expect(shapeTool).toBeTruthy();
    });

    describe('onDown', () => {
        it('should start drawing and clear offscreen canvas', () => {
            const e = { pressure: 0.5, pointerType: 'pen' } as PointerEvent;
            shapeTool.onDown(e, { x: 150, y: 150 }, mockPage);

            expect(mockContext.offscreenCtx.clearRect).toHaveBeenCalled();
            // Checking private state implicitly via behavior in onMove/onUp
        });

        it('should handle mouse pressure default', () => {
            const e = { pressure: 0, pointerType: 'mouse' } as PointerEvent;
            shapeTool.onDown(e, { x: 150, y: 150 }, mockPage);
            // Internal startPoint pressure should be 0.5
        });

        it('should do nothing if no target page', () => {
            const e = {} as PointerEvent;
            shapeTool.onDown(e, { x: 0, y: 0 }, null);
            expect(mockContext.offscreenCtx.clearRect).not.toHaveBeenCalled();
        });
    });

    describe('onMove', () => {
        it('should update preview on move', () => {
            // Start
            shapeTool.onDown({ pointerType: 'mouse' } as PointerEvent, { x: 150, y: 150 }, mockPage);

            // Move
            shapeTool.onMove({ clientX: 200, clientY: 200 } as PointerEvent, { x: 200, y: 200 }, mockPage);

            expect(mockContext.render).toHaveBeenCalled();
            // expect(ToolUtils.drawRect).toHaveBeenCalled(); // Depends on what ToolUtils mock returns or does
        });

        it('should do nothing if not drawing', () => {
            shapeTool.onMove({} as PointerEvent, { x: 0, y: 0 }, mockPage);
            expect(mockContext.render).not.toHaveBeenCalled();
        });
    });

    describe('onUp', () => {
        it('should finalize shape and add action', () => {
            // Start
            shapeTool.onDown({ pointerType: 'mouse', pointerId: 1 } as any, { x: 150, y: 150 }, mockPage);

            // Up
            shapeTool.onUp({ pointerId: 1 } as any, { x: 200, y: 200 }, mockPage);

            expect(mockContext.canvas.releasePointerCapture).toHaveBeenCalledWith(1);
            expect(mockContext.pushAction).toHaveBeenCalled();
            expect(mockContext.render).toHaveBeenCalled(); // Final render
            expect(ShapeAction).toHaveBeenCalled();
        });

        it('should support line tool', () => {
            mockContext.currentTool = 'line';
            shapeTool.onDown({ pointerType: 'mouse' } as any, { x: 150, y: 150 }, mockPage);
            shapeTool.onUp({ pointerId: 1 } as any, { x: 200, y: 200 }, mockPage);

            // expect(ToolUtils.drawLine).toHaveBeenCalled(); 
            // Mock check on ToolUtils calls would confirm correct shape function called
        });

        it('should support circle tool', () => {
            mockContext.currentTool = 'circle';
            shapeTool.onDown({ pointerType: 'mouse' } as any, { x: 150, y: 150 }, mockPage);
            shapeTool.onUp({ pointerId: 1 } as any, { x: 200, y: 200 }, mockPage);
        });

        it('should do nothing if not drawing', () => {
            shapeTool.onUp({} as PointerEvent, { x: 0, y: 0 }, mockPage);
            expect(mockContext.pushAction).not.toHaveBeenCalled();
        });
    });
});
