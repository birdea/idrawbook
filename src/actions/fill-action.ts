import type { ActionType, DrawingAction } from './types';
import type { ToolConfig, Point } from '../tools/types';
import { ToolUtils } from '../tools/tool-utils';

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
