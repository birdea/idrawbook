import type { ToolConfig } from '../tools/types';

export type ActionType = 'stroke' | 'line' | 'rect' | 'circle' | 'fill' | 'text' | 'selection-clear' | 'selection-fill' | 'selection-move' | 'paste';

export interface DrawingAction {
    type: ActionType;
    config: ToolConfig;
    pageId: string;
    draw(ctx: CanvasRenderingContext2D): void | Promise<void>;
}
