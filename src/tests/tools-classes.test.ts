import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FreehandTool } from '../tools/freehand-tool';
import { ShapeTool } from '../tools/shape-tool';
import { FillTool } from '../tools/fill-tool';
import { ToolUtils } from '../tools/tool-utils';
import type { ICanvasContext, Page } from '../canvas/types';
import type { ToolConfig } from '../tools/types';


// Mock ToolUtils
vi.mock('../tools/tool-utils', () => {
    return {
        ToolUtils: {
            setupContext: vi.fn(),
            drawSegment: vi.fn(),
            drawLine: vi.fn(),
            drawRect: vi.fn(),
            drawCircle: vi.fn(),
            floodFill: vi.fn().mockResolvedValue(undefined),
        }
    };
});

describe('Tools Classes', () => {
    let context: ICanvasContext;
    let page: Page;
    let mainCanvas: HTMLCanvasElement;
    let offscreenCanvas: HTMLCanvasElement;

    const mockConfig: ToolConfig = {
        size: 5,
        color: '#ff0000',
        opacity: 100,
        hardness: 100,
        pressure: 0.5
    };

    beforeEach(() => {
        mainCanvas = {
            width: 800,
            height: 600,
            style: { cursor: '' },
            getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0 }),
            releasePointerCapture: vi.fn(),
        } as unknown as HTMLCanvasElement;

        offscreenCanvas = {
            width: 800,
            height: 600,
        } as unknown as HTMLCanvasElement;

        context = {
            canvas: mainCanvas,
            offscreenCanvas: offscreenCanvas,
            ctx: {
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                stroke: vi.fn(),
                arc: vi.fn(),
                rect: vi.fn(),
                fill: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                clearRect: vi.fn(),
            } as unknown as CanvasRenderingContext2D,
            offscreenCtx: {
                clearRect: vi.fn(),
            } as unknown as CanvasRenderingContext2D,
            currentTool: 'pencil', // Default
            config: mockConfig,
            pushAction: vi.fn(),
            render: vi.fn(),
            onUpdateCallback: vi.fn(),
            worldToScreen: vi.fn().mockImplementation((x, y) => ({ x, y })), // Identity for simplicity
            screenToWorld: vi.fn().mockImplementation((x, y) => ({ x, y })),
        } as unknown as ICanvasContext;

        page = {
            id: 'page1',
            x: 100,
            y: 100,
            width: 500,
            height: 500,
            ctx: {
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                stroke: vi.fn(),
                arc: vi.fn(),
                closePath: vi.fn(),
                // Properties
                globalAlpha: 1,
                shadowBlur: 0,
                globalCompositeOperation: 'source-over',
            } as unknown as CanvasRenderingContext2D,
        } as unknown as Page;

        // Mock requestAnimationFrame
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0);
            return 1;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('FreehandTool', () => {
        it('should draw dot on down', () => {
            const tool = new FreehandTool(context);
            context.currentTool = 'pencil';
            const event = { pressure: 0.5, pointerType: 'pen', pointerId: 1 } as PointerEvent;
            const worldPos = { x: 150, y: 150 };

            tool.onDown(event, worldPos, page);

            expect(ToolUtils.setupContext).toHaveBeenCalledWith(page.ctx, 'pencil', mockConfig);
            expect(page.ctx.beginPath).toHaveBeenCalled();
            expect(page.ctx.arc).toHaveBeenCalled(); // Dot
        });

        it('should draw segments on move', () => {
            const tool = new FreehandTool(context);
            context.currentTool = 'pencil';

            // Down first
            tool.onDown({ pressure: 0.5, pointerType: 'pen' } as PointerEvent, { x: 150, y: 150 }, page);

            // Move
            tool.onMove({ pressure: 0.6, pointerType: 'pen', clientX: 160, clientY: 160 } as PointerEvent, { x: 160, y: 160 }, page);

            expect(ToolUtils.drawSegment).toHaveBeenCalled();
            expect(context.render).toHaveBeenCalled();
        });

        it('should push action on up', () => {
            const tool = new FreehandTool(context);
            context.currentTool = 'pencil';

            tool.onDown({ pressure: 0.5, pointerType: 'pen' } as PointerEvent, { x: 150, y: 150 }, page);
            tool.onMove({ pressure: 0.5, pointerType: 'pen' } as PointerEvent, { x: 160, y: 160 }, page);
            tool.onUp({ pressure: 0.5, pointerType: 'pen', pointerId: 1 } as PointerEvent, { x: 160, y: 160 }, page);

            expect(context.pushAction).toHaveBeenCalled();
            expect(page.ctx.closePath).toHaveBeenCalled();
        });

        it('should cancel correctly', () => {
            const tool = new FreehandTool(context);
            tool.onDown({ pressure: 0.5 } as PointerEvent, { x: 150, y: 150 }, page);
            tool.cancel();
            expect(context.render).toHaveBeenCalled();
            // Should not be drawing anymore
            tool.onMove({ pressure: 0.5 } as PointerEvent, { x: 160, y: 160 }, page);
            expect(ToolUtils.drawSegment).not.toHaveBeenCalled();
        });
    });

    describe('ShapeTool', () => {
        it('should start drawing on down', () => {
            const tool = new ShapeTool(context);
            context.currentTool = 'rect';

            tool.onDown({ pressure: 0.5, pointerType: 'mouse' } as PointerEvent, { x: 150, y: 150 }, page);
            expect(context.offscreenCtx.clearRect).toHaveBeenCalled();
        });

        it('should draw preview on move', () => {
            const tool = new ShapeTool(context);
            context.currentTool = 'rect';

            tool.onDown({ pressure: 0.5, pointerType: 'mouse' } as PointerEvent, { x: 150, y: 150 }, page);

            tool.onMove({ clientX: 200, clientY: 200 } as PointerEvent, { x: 200, y: 200 }, page);

            expect(context.render).toHaveBeenCalled();
            expect(ToolUtils.setupContext).toHaveBeenCalledWith(context.ctx, 'rect', mockConfig);
            expect(ToolUtils.drawRect).toHaveBeenCalled();
        });

        it('should push action and draw final shape on up', () => {
            const tool = new ShapeTool(context);
            context.currentTool = 'rect';

            tool.onDown({ pressure: 0.5 } as PointerEvent, { x: 150, y: 150 }, page);
            tool.onUp({ pressure: 0.5, pointerId: 1 } as PointerEvent, { x: 200, y: 200 }, page);

            expect(context.pushAction).toHaveBeenCalled();
            expect(ToolUtils.drawRect).toHaveBeenCalledWith(page.ctx, expect.any(Object), expect.any(Object));
            expect(context.render).toHaveBeenCalled();
        });

        it('should handle different shapes', () => {
            const tool = new ShapeTool(context);

            // Circle
            context.currentTool = 'circle';
            tool.onDown({ pressure: 0.5 } as PointerEvent, { x: 150, y: 150 }, page);
            tool.onMove({ clientX: 200, clientY: 200 } as PointerEvent, { x: 200, y: 200 }, page);
            expect(ToolUtils.drawCircle).toHaveBeenCalled();

            // Line
            context.currentTool = 'line';
            tool.onMove({ clientX: 200, clientY: 200 } as PointerEvent, { x: 200, y: 200 }, page);
            expect(ToolUtils.drawLine).toHaveBeenCalled();
        });
    });

    describe('FillTool', () => {
        it('should flood fill on down', async () => {
            const tool = new FillTool(context);
            context.currentTool = 'fill'; // Though tool name doesn't matter much for FillTool which is specific

            await tool.onDown({ pressure: 0.5, pointerType: 'mouse' } as PointerEvent, { x: 150, y: 150 }, page);

            expect(ToolUtils.floodFill).toHaveBeenCalledWith(page.ctx, expect.any(Object), mockConfig.color);
            expect(context.pushAction).toHaveBeenCalled();
            expect(context.render).toHaveBeenCalled();
        });

        it('should ignore move and up', () => {
            const tool = new FillTool(context);
            tool.onMove({} as PointerEvent, { x: 0, y: 0 }, page);
            tool.onUp({} as PointerEvent, { x: 0, y: 0 }, page);
            // No assertions needed, just ensuring no crash or side effects
        });
    });
});
