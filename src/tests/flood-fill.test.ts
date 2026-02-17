import { describe, it, expect } from 'vitest';
import { floodFill } from '../workers/flood-fill.core';

describe('Flood Fill Core', () => {
    it('should fill a simple 2x2 area', () => {
        // 2x2 white square
        // R, G, B, A
        const width = 2;
        const height = 2;
        const data = new Uint8ClampedArray([
            255, 255, 255, 255, 255, 255, 255, 255,
            255, 255, 255, 255, 255, 255, 255, 255
        ]);

        // Fill with red at 0,0
        floodFill(data, width, height, 0, 0, 255, 0, 0);

        // All should be red
        const expected = [
            255, 0, 0, 255, 255, 0, 0, 255,
            255, 0, 0, 255, 255, 0, 0, 255
        ];

        for (let i = 0; i < data.length; i++) {
            expect(data[i]).toBe(expected[i]);
        }
    });

    it('should not fill different colors', () => {
        // 2x1: Left White, Right Black
        const width = 2;
        const height = 1;
        const data = new Uint8ClampedArray([
            255, 255, 255, 255, 0, 0, 0, 255
        ]);

        // Fill left with Red
        floodFill(data, width, height, 0, 0, 255, 0, 0);

        // Left Red, Right Black
        const expected = [
            255, 0, 0, 255, 0, 0, 0, 255
        ];

        for (let i = 0; i < data.length; i++) {
            expect(data[i]).toBe(expected[i]);
        }
    });

    it('should handle diagonal separation (4-connectivity)', () => {
        /*
          W B
          B W
        */
        const width = 2;
        const height = 2;
        const data = new Uint8ClampedArray([
            255, 255, 255, 255, 0, 0, 0, 255,
            0, 0, 0, 255, 255, 255, 255, 255
        ]);

        // Fill top-left W with Red
        floodFill(data, width, height, 0, 0, 255, 0, 0);

        // Top-left Red, Bottom-right still White because blocked by Black
        // (Assuming 4-way fill, not 8-way)
        const expected = [
            255, 0, 0, 255, 0, 0, 0, 255,
            0, 0, 0, 255, 255, 255, 255, 255
        ];

        for (let i = 0; i < data.length; i++) {
            expect(data[i]).toBe(expected[i]);
        }
    });
});
