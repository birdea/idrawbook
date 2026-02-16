import type { ActionType, DrawingAction } from './types';
import type { ToolConfig, Point } from '../tools/types';
import { ToolUtils } from '../tools/tool-utils';

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
