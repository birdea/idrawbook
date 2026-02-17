import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '../config';

describe('Config', () => {
    it('should export correct app config', () => {
        expect(APP_CONFIG).toEqual({
            APP_NAME: 'iDrawBook',
            VERSION: expect.stringMatching(/^\d+\.\d+\.\d+$/),
            RENDERER_MARGIN: 50,
            HISTORY_LIMIT: 100,
            PALETTE_SETTINGS: {
                count: 20,
                columns: 10
            }
        });
    });
});
