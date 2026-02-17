import type { DrawingTool, ToolConfig, Point } from './types';

export class ToolUtils {
    static drawStroke(ctx: CanvasRenderingContext2D, points: Point[], tool: DrawingTool, config: ToolConfig) {
        if (points.length < 1) return;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Set base styles
        ToolUtils.setupContext(ctx, tool, config);

        if (points.length === 1) {
            // Draw a dot if it's just one point
            const p = points[0];
            ctx.beginPath();
            ctx.arc(p.x, p.y, config.size / 2, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        if (tool === 'pen' || tool === 'eraser' || tool === 'line') {
            ToolUtils.drawPenPath(ctx, points, config);
        } else {
            for (let i = 0; i < points.length - 1; i++) {
                ToolUtils.drawSegment(ctx, points[i], points[i + 1], tool, config);
            }
        }

        // Reset
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }

    private static drawPenPath(ctx: CanvasRenderingContext2D, points: Point[], config: ToolConfig) {
        ctx.lineWidth = config.size;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
    }

    static setupContext(ctx: CanvasRenderingContext2D, tool: DrawingTool, config: ToolConfig) {
        if (tool === 'eraser') {
            ctx.strokeStyle = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1.0;
        } else {
            ctx.strokeStyle = config.color;
            ctx.fillStyle = config.color;
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = config.opacity / 100;
        }
    }

    static drawSegment(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, tool: DrawingTool, config: ToolConfig) {
        if (tool === 'pencil') {
            ToolUtils.drawPencilSegment(ctx, p1, p2, config);
        } else if (tool === 'brush') {
            ToolUtils.drawBrushSegment(ctx, p1, p2, config);
        } else if (tool === 'pen' || tool === 'eraser') {
            ToolUtils.drawPenSegment(ctx, p1, p2, config);
        }
    }

    private static drawPenSegment(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, config: ToolConfig) {
        ctx.lineWidth = config.size;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    private static drawPencilSegment(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, config: ToolConfig) {
        const baseSize = Math.max(0.5, config.size / 2);
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const steps = Math.ceil(dist / 1);

        // Batch all arcs into a single path for better performance
        // Instead of 200+ separate beginPath/fill calls, we do just 1
        ctx.beginPath();

        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const x = p1.x + (p2.x - p1.x) * t;
            const y = p1.y + (p2.y - p1.y) * t;

            const pressure = (p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t;
            const alpha = (config.opacity / 100) * (pressure * pressure);

            ctx.globalAlpha = Math.min(1, alpha);

            // Deterministic jitter based on coordinates
            const noise = ToolUtils.noise(x, y);
            const jitter = (noise - 0.5) * baseSize * 0.5;
            ctx.arc(x + jitter, y + jitter, baseSize, 0, Math.PI * 2);
        }

        ctx.fill();
    }

    private static noise(x: number, y: number): number {
        const val = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return val - Math.floor(val);
    }

    private static drawBrushSegment(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, config: ToolConfig) {
        const hardness = config.hardness !== undefined ? config.hardness : 100;
        const blurAmount = (100 - hardness) / 100 * (config.size * 1.5);

        ctx.shadowBlur = blurAmount;
        ctx.shadowColor = config.color;

        const pressure = (p1.pressure || 0.5) + (p2.pressure || 0.5);
        const size = config.size * (0.5 + pressure * 0.5 * (config.pressure !== undefined ? config.pressure / 50 : 1));

        ctx.lineWidth = size;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    static drawCircle(ctx: CanvasRenderingContext2D, center: Point, border: Point) {
        const radius = Math.sqrt(
            Math.pow(border.x - center.x, 2) + Math.pow(border.y - center.y, 2)
        );
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    static drawRect(ctx: CanvasRenderingContext2D, start: Point, end: Point) {
        const width = end.x - start.x;
        const height = end.y - start.y;
        ctx.beginPath();
        ctx.rect(start.x, start.y, width, height);
        ctx.stroke();
    }

    static drawLine(ctx: CanvasRenderingContext2D, start: Point, end: Point) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }

    static async floodFill(ctx: CanvasRenderingContext2D, start: Point, fillColor: string) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Parse fill color
        const targetColorRGB = ToolUtils.hexToRgb(fillColor);
        if (!targetColorRGB) return;

        const startX = Math.floor(start.x);
        const startY = Math.floor(start.y);

        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

        const startPos = (startY * width + startX) * 4;
        const startR = data[startPos];
        const startG = data[startPos + 1];
        const startB = data[startPos + 2];
        const startA = data[startPos + 3];

        if (startR === targetColorRGB.r && startG === targetColorRGB.g && startB === targetColorRGB.b && startA === 255) {
            return;
        }

        return new Promise<void>((resolve) => {
            const worker = new Worker(new URL('../workers/flood-fill.worker.ts', import.meta.url), {
                type: 'module'
            });

            worker.onmessage = (e) => {
                const { data: newData } = e.data;
                const newImageData = new ImageData(newData, width, height);
                ctx.putImageData(newImageData, 0, 0);
                worker.terminate();
                resolve();
            };

            worker.postMessage({
                data,
                width,
                height,
                startX,
                startY,
                targetR: targetColorRGB.r,
                targetG: targetColorRGB.g,
                targetB: targetColorRGB.b
            }, [data.buffer]);
        });
    }

    private static hexToRgb(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}
