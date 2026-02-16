import type { ToolConfig } from '../tools/types';

export type ActionType = 'stroke' | 'line' | 'rect' | 'circle' | 'fill' | 'text';

export interface DrawingAction {
    type: ActionType;
    config: ToolConfig;
    pageId: string;
    draw(ctx: CanvasRenderingContext2D): void;
}
