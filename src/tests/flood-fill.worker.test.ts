import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock floodFill core
vi.mock('../workers/flood-fill.core', () => ({
    floodFill: vi.fn()
}));

import { floodFill } from '../workers/flood-fill.core';

describe('Flood Fill Worker Entry', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
    });

    it('should set onmessage handler on self', async () => {
        // Setup global self
        const mockPostMessage = vi.fn();
        const mockSelf = {
            onmessage: null,
            postMessage: mockPostMessage
        };
        (globalThis as any).self = mockSelf;

        // Import the worker file
        await import('../workers/flood-fill.worker');

        // Verify onmessage is set
        expect(mockSelf.onmessage).toBeTypeOf('function');

        // Verify onmessage logic
        const onMessage = mockSelf.onmessage as any;
        const mockData = {
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
            startX: 0,
            startY: 0,
            targetR: 255,
            targetG: 0,
            targetB: 0
        };

        onMessage({ data: mockData });

        // Should call core floodFill
        expect(floodFill).toHaveBeenCalledWith(
            mockData.data,
            mockData.width,
            mockData.height,
            mockData.startX,
            mockData.startY,
            mockData.targetR,
            mockData.targetG,
            mockData.targetB
        );

        // Should post message back
        expect(mockPostMessage).toHaveBeenCalled();
    });
});
