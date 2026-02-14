import type { ToolConfig, Point } from './tools';
import { ToolUtils } from './tools';

export type ActionType = 'stroke' | 'line' | 'rect' | 'circle';

export interface DrawingAction {
    type: ActionType;
    config: ToolConfig;
    draw(ctx: CanvasRenderingContext2D): void;
}

export class StrokeAction implements DrawingAction {
    type: ActionType = 'stroke';
    points: Point[];
    config: ToolConfig;

    constructor(points: Point[], config: ToolConfig) {
        this.points = points; // Copy of points
        this.config = { ...config };
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.points.length === 0) return;

        ctx.beginPath();
        ctx.lineWidth = this.config.size;
        ctx.strokeStyle = this.config.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = this.config.opacity / 100;

        if (this.points.length === 1) {
            // Draw a dot
            ctx.moveTo(this.points[0].x, this.points[0].y);
            ctx.lineTo(this.points[0].x, this.points[0].y);
        } else {
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
        }
        ctx.stroke();
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
