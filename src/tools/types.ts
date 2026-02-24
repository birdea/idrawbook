export type DrawingTool = 'pencil' | 'brush' | 'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle' | 'hand' | 'text' | 'select';

export interface ToolConfig {
    size: number;
    color: string;
    opacity: number;
    hardness: number; // 0-100 (0=soft/blur, 100=hard/sharp)
    pressure: number; // 0-100 (influence of pressure)
}

export interface Point {
    x: number;
    y: number;
    pressure?: number;
}
