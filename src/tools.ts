export type DrawingTool = 'pencil' | 'brush' | 'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle' | 'hand' | 'text';

export interface ToolConfig {
    size: number;
    color: string;
    opacity: number;
    hardness: number; // 0-100 (0=soft/blur, 100=hard/sharp)
    pressure: number; // 0-100 (influence of pressure)
}

export interface Point {
    x: number;
    y: number;
    pressure?: number;
}

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
            ctx.globalCompositeOperation = 'source-over';
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

        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const x = p1.x + (p2.x - p1.x) * t;
            const y = p1.y + (p2.y - p1.y) * t;

            const pressure = (p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t;
            const alpha = (config.opacity / 100) * (pressure * pressure);

            ctx.globalAlpha = Math.min(1, alpha);
            // fillStyle is inherited from setupContext

            const jitter = (Math.random() - 0.5) * baseSize * 0.5;

            ctx.beginPath();
            ctx.arc(x + jitter, y + jitter, baseSize, 0, Math.PI * 2);
            ctx.fill();
        }
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

    static floodFill(ctx: CanvasRenderingContext2D, start: Point, fillColor: string) {
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

        // If target color is same as start color, return
        if (startR === targetColorRGB.r && startG === targetColorRGB.g && startB === targetColorRGB.b && startA === 255) return;

        const stack = [[startX, startY]];

        const matchStartColor = (pos: number) => {
            return data[pos] === startR && data[pos + 1] === startG && data[pos + 2] === startB && data[pos + 3] === startA;
        };

        const colorPixel = (pos: number) => {
            data[pos] = targetColorRGB.r;
            data[pos + 1] = targetColorRGB.g;
            data[pos + 2] = targetColorRGB.b;
            data[pos + 3] = 255;
        };

        while (stack.length) {
            const [x, y] = stack.pop()!;
            const pos = (y * width + x) * 4;

            if (matchStartColor(pos)) {
                colorPixel(pos);

                if (x > 0 && matchStartColor((y * width + (x - 1)) * 4)) stack.push([x - 1, y]);
                if (x < width - 1 && matchStartColor((y * width + (x + 1)) * 4)) stack.push([x + 1, y]);
                if (y > 0 && matchStartColor(((y - 1) * width + x) * 4)) stack.push([x, y - 1]);
                if (y < height - 1 && matchStartColor(((y + 1) * width + x) * 4)) stack.push([x, y + 1]);
            }
        }

        ctx.putImageData(imageData, 0, 0);
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
