export type DrawingTool = 'pencil' | 'brush' | 'pen' | 'eraser' | 'line' | 'rect' | 'circle' | 'hand';

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
}
