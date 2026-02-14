export type DrawingTool = 'pencil' | 'brush' | 'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle' | 'hand';

export interface ToolConfig {
    size: number;
    color: string;
    opacity: number;
}

export interface Point {
    x: number;
    y: number;
}

export class ToolUtils {
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

        // Optimization: Use a Uint8Array to track visited pixels to avoid adding duplicates to stack
        // Bitset or just byte array. Byte array for 2048x2048 is 4MB, acceptable.
        // Actually, since we color the pixel immediately, we don't strictly need a visited array if we check color before pushing?
        // No, because we might push the same pixel multiple times from different neighbors before it gets processed.
        // So checking color before pushing is better, AND we need to ensure we don't push the same pixel twice in the same pass.
        // Standard queue fill usually needs a 'queued' check.

        // Simple optimization: only push if not already matching target color (which we check)
        // Let's stick to the simple stack with color check for now. It's usually "fast enough" for 2k^2 unless it's a worst-case spiral.

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
