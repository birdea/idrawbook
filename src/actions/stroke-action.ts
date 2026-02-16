import type { ActionType, DrawingAction } from './types';
import type { ToolConfig, Point, DrawingTool } from '../tools/types';
import { ToolUtils } from '../tools/tool-utils';

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
