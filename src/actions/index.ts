import type { ToolConfig, Point, DrawingTool } from '../tools';
import { ToolUtils } from '../tools';

export type ActionType = 'stroke' | 'line' | 'rect' | 'circle' | 'fill' | 'text';

export interface DrawingAction {
    type: ActionType;
    config: ToolConfig;
    pageId: string;
    draw(ctx: CanvasRenderingContext2D): void;
}

export class StrokeAction implements DrawingAction {
    type: ActionType = 'stroke';
    points: Point[];
    config: ToolConfig;
    tool: DrawingTool;
    pageId: string;

    constructor(points: Point[], config: ToolConfig, tool: DrawingTool, pageId: string) {
        this.points = [...points];
        this.config = { ...config };
        this.tool = tool;
        this.pageId = pageId;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ToolUtils.drawStroke(ctx, this.points, this.tool, this.config);
    }
}

export class ShapeAction implements DrawingAction {
    type: ActionType;
    start: Point;
    end: Point;
    config: ToolConfig;
    pageId: string;

    constructor(type: ActionType, start: Point, end: Point, config: ToolConfig, pageId: string) {
        this.type = type;
        this.start = { ...start };
        this.end = { ...end };
        this.config = { ...config };
        this.pageId = pageId;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.lineWidth = this.config.size;
        ctx.strokeStyle = this.config.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = this.config.opacity / 100;

        switch (this.type) {
            case 'line':
                ToolUtils.drawLine(ctx, this.start, this.end);
                break;
            case 'rect':
                ToolUtils.drawRect(ctx, this.start, this.end);
                break;
            case 'circle':
                ToolUtils.drawCircle(ctx, this.start, this.end);
                break;
        }
    }
}

export class FillAction implements DrawingAction {
    type: ActionType = 'fill';
    point: Point;
    config: ToolConfig;
    pageId: string;

    constructor(point: Point, config: ToolConfig, pageId: string) {
        this.point = { ...point };
        this.config = { ...config };
        this.pageId = pageId;
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Flood fill with the color from config
        ToolUtils.floodFill(ctx, this.point, this.config.color);
    }
}
