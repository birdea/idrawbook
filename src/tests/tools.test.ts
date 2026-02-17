import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolUtils } from '../tools/tool-utils';
import type { ToolConfig, Point } from '../tools/types';

describe('ToolUtils', () => {
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
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            arc: vi.fn(),
            rect: vi.fn(),
            getImageData: vi.fn(),
            putImageData: vi.fn(),
            canvas: { width: 100, height: 100 },
            globalAlpha: 1,
            globalCompositeOperation: 'source-over',
            shadowBlur: 0,
            lineWidth: 1,
            strokeStyle: '',
            fillStyle: '',
            lineCap: '',
            lineJoin: '',
        } as unknown as CanvasRenderingContext2D;

        // Polyfill ImageData if missing in Node
        if (typeof (globalThis as any).ImageData === 'undefined') {
            (globalThis as any).ImageData = class ImageData {
                data: Uint8ClampedArray;
                width: number;
                height: number;
                constructor(data: Uint8ClampedArray, width: number, height: number) {
                    this.data = data;
                    this.width = width;
                    this.height = height;
                }
            };
        }

        // Mock Worker
        class MockWorker {
            onmessage: any;
            postMessage(msg: any) {
                const { data, targetR, targetG, targetB } = msg;
                // Simple simulate: fill first pixel
                if (data && data.length >= 4) {
                    data[0] = targetR;
                    data[1] = targetG;
                    data[2] = targetB;
                    data[3] = 255;
                }
                setTimeout(() => {
                    if (this.onmessage) this.onmessage({ data: { data } });
                }, 0);
            }
            terminate = vi.fn();
            addEventListener = vi.fn();
            removeEventListener = vi.fn();
        }
        (globalThis as any).Worker = MockWorker;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is not mocked', () => {
        expect(vi.isMockFunction(ToolUtils.drawStroke)).toBe(false);
    });

    it('drawStroke with empty points should do nothing', () => {
        ToolUtils.drawStroke(ctx, [], 'pencil', mockConfig);
        expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it('drawStroke with single point should draw a dot', () => {
        ToolUtils.drawStroke(ctx, [p1], 'pencil', mockConfig);
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.arc).toHaveBeenCalledWith(p1.x, p1.y, mockConfig.size / 2, 0, Math.PI * 2);
        expect(ctx.fill).toHaveBeenCalled();
    });

    it('drawStroke with pen/eraser/line should use drawPenPath', () => {
        const points = [p1, p2];
        ToolUtils.drawStroke(ctx, points, 'pen', mockConfig);

        expect(ctx.lineWidth).toBe(mockConfig.size);
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.moveTo).toHaveBeenCalledWith(p1.x, p1.y);
        expect(ctx.lineTo).toHaveBeenCalledWith(p2.x, p2.y);
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('drawStroke with multiple points (pencil) should draw segments', () => {
        const points = [p1, { x: 50, y: 50, pressure: 0.5 }]; // Distant point to force steps > 0
        const pencilConfig = { ...mockConfig, opacity: 50, size: 5 };

        ToolUtils.drawStroke(ctx, points, 'pencil', pencilConfig);

        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.arc).toHaveBeenCalled();
        expect(ctx.fill).toHaveBeenCalled();
    });

    it('drawStroke with multiple points (brush) should draw segments', () => {
        const points = [p1, p2];
        const brushConfig = { ...mockConfig, hardness: 50 };

        let capturedShadowBlur = 0;
        (ctx.stroke as any).mockImplementation(() => {
            capturedShadowBlur = ctx.shadowBlur;
        });

        ToolUtils.drawStroke(ctx, points, 'brush', brushConfig);

        expect(capturedShadowBlur).toBeGreaterThan(0);
        expect(ctx.lineTo).toHaveBeenCalledWith(p2.x, p2.y);
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('drawStroke (eraser) should set composite operation', () => {
        ToolUtils.drawStroke(ctx, [p1, p2], 'eraser', mockConfig);
        expect(ctx.strokeStyle).toBe('#ffffff');
    });

    it('drawStroke (pen) should draw pen path', () => {
        ToolUtils.drawStroke(ctx, [p1, p2, { x: 30, y: 30 }], 'pen', mockConfig);
        expect(ctx.moveTo).toHaveBeenCalledWith(p1.x, p1.y);
        expect(ctx.lineTo).toHaveBeenCalledWith(p2.x, p2.y);
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('drawStroke (line) should draw pen path', () => {
        ToolUtils.drawStroke(ctx, [p1, p2], 'line', mockConfig);
        expect(ctx.moveTo).toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('drawCircle', () => {
        ToolUtils.drawCircle(ctx, p1, p2);
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.arc).toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('drawRect', () => {
        ToolUtils.drawRect(ctx, p1, p2);
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.rect).toHaveBeenCalledWith(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('drawLine', () => {
        ToolUtils.drawLine(ctx, p1, p2);
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.moveTo).toHaveBeenCalledWith(p1.x, p1.y);
        expect(ctx.lineTo).toHaveBeenCalledWith(p2.x, p2.y);
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('floodFill should return if start color matches target', async () => {
        const width = 2;
        const height = 1;
        const data = new Uint8ClampedArray([255, 0, 0, 255, 255, 255, 255, 255]); // Red, White
        const imageData = { width, height, data } as unknown as ImageData;

        (ctx.getImageData as any).mockReturnValue(imageData);
        (ctx.canvas as any).width = width;
        (ctx.canvas as any).height = height;

        // In the real code, if starting color is same, it shouldn't even create a worker.
        // Wait, my new implementation in ToolUtils.ts doesn't check START color before creating worker.
        // Let's add that check back to ToolUtils to save worker creation.

        await ToolUtils.floodFill(ctx, { x: 0, y: 0 }, '#ff0000');
        expect(ctx.putImageData).not.toHaveBeenCalled();
    });

    it('floodFill should fill correctly', async () => {
        const width = 2;
        const height = 2;
        const data = new Uint8ClampedArray(width * height * 4).fill(255);
        const imageData = { width, height, data } as unknown as ImageData;

        (ctx.getImageData as any).mockReturnValue(imageData);
        (ctx.canvas as any).width = width;
        (ctx.canvas as any).height = height;

        await ToolUtils.floodFill(ctx, { x: 0, y: 0 }, '#ff0000');

        expect(ctx.putImageData).toHaveBeenCalled();
        expect(data[0]).toBe(255); // R
        expect(data[1]).toBe(0);   // G
        expect(data[2]).toBe(0);   // B
    });

    it('floodFill invalid start returns', async () => {
        const width = 10;
        const height = 10;
        (ctx.canvas as any).width = width;
        (ctx.canvas as any).height = height;
        (ctx.getImageData as any).mockReturnValue({ data: [] });

        await ToolUtils.floodFill(ctx, { x: 20, y: 20 }, '#000000'); // Out of bounds
        expect(ctx.putImageData).not.toHaveBeenCalled();
    });

    it('drawStroke (pencil) should be deterministic', () => {
        const points = [p1, { x: 50, y: 50, pressure: 0.5 }];
        const pencilConfig = { ...mockConfig, size: 5, opacity: 50 };

        const calls1: any[] = [];
        (ctx.arc as any).mockImplementation((...args: any[]) => calls1.push(args));
        ToolUtils.drawStroke(ctx, points, 'pencil', pencilConfig);

        const calls2: any[] = [];
        (ctx.arc as any).mockImplementation((...args: any[]) => calls2.push(args));
        ToolUtils.drawStroke(ctx, points, 'pencil', pencilConfig);

        expect(calls1.length).toBeGreaterThan(0);
        expect(calls1).toEqual(calls2);
    });

    it('floodFill invalid hex returns', async () => {
        const width = 10;
        const height = 10;
        (ctx.canvas as any).width = width;
        (ctx.canvas as any).height = height;
        (ctx.getImageData as any).mockReturnValue({ data: new Uint8ClampedArray(400) });

        await ToolUtils.floodFill(ctx, { x: 0, y: 0 }, 'invalid');
        expect(ctx.putImageData).not.toHaveBeenCalled();
    });
});
