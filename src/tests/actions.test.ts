import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FillAction } from '../actions/fill-action';
import { ShapeAction } from '../actions/shape-action';
import { StrokeAction } from '../actions/stroke-action';
import { TextAction } from '../actions/text-action';
import { ToolUtils } from '../tools/tool-utils';
import type { ToolConfig, Point } from '../tools/types';

// Mock ToolUtils
vi.mock('../tools/tool-utils', () => {
    return {
        ToolUtils: {
            floodFill: vi.fn(),
            drawLine: vi.fn(),
            drawRect: vi.fn(),
            drawCircle: vi.fn(),
            drawStroke: vi.fn(),
        }
    };
});

describe('Actions', () => {
    let ctx: CanvasRenderingContext2D;
    const mockConfig: ToolConfig = {
        size: 10,
        color: '#ff0000',
        opacity: 100,
        hardness: 100,
        pressure: 50
    };
    const p1: Point = { x: 10, y: 10, pressure: 0.5 };
    const p2: Point = { x: 20, y: 20, pressure: 0.8 };

    beforeEach(() => {
        ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            fillText: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 50 }),
            canvas: { width: 100, height: 100 },
        } as unknown as CanvasRenderingContext2D;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('FillAction', () => {
        it('should call ToolUtils.floodFill on draw', async () => {
            const action = new FillAction(p1, mockConfig, 'page1');
            await action.draw(ctx);
            expect(ToolUtils.floodFill).toHaveBeenCalledWith(ctx, p1, mockConfig.color);
        });

        it('should copy config and point', () => {
            const mutableConfig = { ...mockConfig };
            const mutablePoint = { ...p1 };
            const action = new FillAction(mutablePoint, mutableConfig, 'page1');

            mutableConfig.color = '#000000';
            mutablePoint.x = 999;

            expect(action.config.color).toBe('#ff0000');
            expect(action.point.x).toBe(10);
        });
    });

    describe('ShapeAction', () => {
        it('should call ToolUtils.drawLine for line type', () => {
            const action = new ShapeAction('line', p1, p2, mockConfig, 'page1');
            action.draw(ctx);
            expect(ToolUtils.drawLine).toHaveBeenCalledWith(ctx, p1, p2);
        });

        it('should call ToolUtils.drawRect for rect type', () => {
            const action = new ShapeAction('rect', p1, p2, mockConfig, 'page1');
            action.draw(ctx);
            expect(ToolUtils.drawRect).toHaveBeenCalledWith(ctx, p1, p2);
        });

        it('should call ToolUtils.drawCircle for circle type', () => {
            const action = new ShapeAction('circle', p1, p2, mockConfig, 'page1');
            action.draw(ctx);
            expect(ToolUtils.drawCircle).toHaveBeenCalledWith(ctx, p1, p2);
        });

        it('should set context properties', () => {
            const action = new ShapeAction('line', p1, p2, mockConfig, 'page1');
            action.draw(ctx);
            expect(ctx.lineWidth).toBe(mockConfig.size);
            expect(ctx.strokeStyle).toBe(mockConfig.color);
            expect(ctx.lineCap).toBe('round');
            expect(ctx.lineJoin).toBe('round');
            expect(ctx.globalAlpha).toBe(mockConfig.opacity / 100);
        });

        it('should copy config and points', () => {
            const mConfig = { ...mockConfig };
            const mStart = { ...p1 };
            const mEnd = { ...p2 };
            const action = new ShapeAction('rect', mStart, mEnd, mConfig, 'page1');

            mConfig.size = 99;
            mStart.x = 999;
            mEnd.y = 888;

            expect(action.config.size).toBe(mockConfig.size);
            expect(action.start.x).toBe(p1.x);
            expect(action.end.y).toBe(p2.y);
        });
    });

    describe('StrokeAction', () => {
        it('should call ToolUtils.drawStroke', () => {
            const points = [p1, p2];
            const action = new StrokeAction(points, mockConfig, 'pencil', 'page1');
            action.draw(ctx);
            expect(ToolUtils.drawStroke).toHaveBeenCalledWith(ctx, points, 'pencil', mockConfig);
        });

        it('should copy points and config', () => {
            const points = [p1];
            const mConfig = { ...mockConfig };
            const action = new StrokeAction(points, mConfig, 'pencil', 'page1');

            points.push(p2);
            mConfig.color = '#000';

            expect(action.points).toHaveLength(1);
            expect(action.config.color).toBe(mockConfig.color);
        });
    });

    describe('TextAction', () => {
        const textPlacement = { pageId: 'page1', localX: 100, localY: 100 };
        const textConfig = {
            fontSize: 20,
            color: '#000000',
            lineHeight: 1.2,
            hAlign: 'left' as const,
            fontFamily: 'Arial'
        };

        it('should draw text correctly', () => {
            const action = new TextAction('Hello\nWorld', textPlacement, textConfig, mockConfig);
            action.draw(ctx);

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.font).toBe('20px Arial');
            expect(ctx.fillStyle).toBe('#000000');
            expect(ctx.textAlign).toBe('left');

            // Should draw two lines
            expect(ctx.fillText).toHaveBeenCalledTimes(2);
            expect(ctx.fillText).toHaveBeenCalledWith('Hello', 100, 100);
            expect(ctx.fillText).toHaveBeenCalledWith('World', 100, 100 + 20 * 1.2);

            expect(ctx.restore).toHaveBeenCalled();
        });

        it('should hit test correctly (inside)', () => {
            const action = new TextAction('Test', textPlacement, textConfig, mockConfig);
            // Mock measureText width = 50. Total height approx 20 * 1.2 = 24.
            // Box is roughly (100-4, 100-4) to (100+50+4, 100+24+4).
            // (96, 96) to (154, 128)

            expect(action.hitTest(120, 110, ctx)).toBe(true);
        });

        it('should hit test correctly (outside)', () => {
            const action = new TextAction('Test', textPlacement, textConfig, mockConfig);
            expect(action.hitTest(10, 10, ctx)).toBe(false);
        });

        it('should handle alignment in hit test', () => {
            const centerConfig = { ...textConfig, hAlign: 'center' as const };
            const action = new TextAction('Test', textPlacement, centerConfig, mockConfig);

            // Center align: x0 = 100 - 50/2 - 4 = 71
            expect(action.hitTest(75, 110, ctx)).toBe(true);
        });
    });
});
