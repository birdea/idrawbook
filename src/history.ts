import type { ToolConfig, Point, DrawingTool } from './tools';
import { ToolUtils } from './tools';

export type ActionType = 'stroke' | 'line' | 'rect' | 'circle' | 'fill';

export interface DrawingAction {
    type: ActionType;
    config: ToolConfig;
    draw(ctx: CanvasRenderingContext2D): void;
}

export class StrokeAction implements DrawingAction {
    type: ActionType = 'stroke';
    points: Point[];
    config: ToolConfig;
    tool: DrawingTool;

    constructor(points: Point[], config: ToolConfig, tool: DrawingTool) {
        this.points = points; // Copy of points
        this.config = { ...config };
        this.tool = tool;
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

    constructor(type: ActionType, start: Point, end: Point, config: ToolConfig) {
        this.type = type;
        this.start = { ...start };
        this.end = { ...end };
        this.config = { ...config };
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

    constructor(point: Point, config: ToolConfig) {
        this.point = { ...point };
        this.config = { ...config };
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Flood fill with the color from config
        ToolUtils.floodFill(ctx, this.point, this.config.color);
    }
}

export class HistoryManager {
    private undoStack: DrawingAction[] = [];
    private redoStack: DrawingAction[] = [];
    private maxHistory: number = 100;

    constructor(initialLimit: number = 100) {
        this.maxHistory = initialLimit;
    }

    public setLimit(limit: number) {
        this.maxHistory = limit;
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack = this.undoStack.slice(this.undoStack.length - this.maxHistory);
        }
    }

    public push(action: DrawingAction) {
        this.undoStack.push(action);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = []; // Clear redo on new action
    }

    public undo(): DrawingAction[] | null {
        if (this.undoStack.length === 0) return null;
        const action = this.undoStack.pop()!;
        this.redoStack.push(action);
        return [...this.undoStack]; // Return remaining actions to redraw
    }

    public redo(): DrawingAction[] | null {
        if (this.redoStack.length === 0) return null;
        const action = this.redoStack.pop()!;
        this.undoStack.push(action);
        return [...this.undoStack]; // Return all actions to redraw
    }

    public getActions(): DrawingAction[] {
        return [...this.undoStack];
    }

    public clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}
