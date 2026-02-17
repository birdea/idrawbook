import type { ICanvasContext } from './types';
import type { DrawingTool } from '../tools/types';
import type { ITool } from '../tools/i-tool';
import { FreehandTool } from '../tools/freehand-tool';
import { ShapeTool } from '../tools/shape-tool';
import { FillTool } from '../tools/fill-tool';
import { TextTool } from '../tools/text-tool';
import { HandTool } from '../tools/hand-tool';

export class ToolManager {
    private context: ICanvasContext;
    private tools: Map<DrawingTool, ITool>;

    constructor(context: ICanvasContext) {
        this.context = context;
        this.tools = new Map();

        // Initialize all tools
        const freehand = new FreehandTool(context);
        this.tools.set('pencil', freehand);
        this.tools.set('brush', freehand);
        this.tools.set('pen', freehand);
        this.tools.set('eraser', freehand);

        const shape = new ShapeTool(context);
        this.tools.set('line', shape);
        this.tools.set('rect', shape);
        this.tools.set('circle', shape);

        this.tools.set('fill', new FillTool(context));
        this.tools.set('text', new TextTool(context));
        this.tools.set('hand', new HandTool(context));
    }

    public getTool(name: DrawingTool): ITool {
        const tool = this.tools.get(name);
        if (!tool) throw new Error(`Tool ${name} not found`);
        return tool;
    }

    public getCurrentTool(): ITool {
        return this.getTool(this.context.currentTool);
    }

    public setTool(name: DrawingTool) {
        const oldTool = this.getCurrentTool();
        oldTool.deactivate();

        this.context.currentTool = name;

        const newTool = this.getCurrentTool();
        newTool.activate();
    }
}
