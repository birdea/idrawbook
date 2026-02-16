
import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '../config';

describe('Config', () => {
    it('should export correct app config', () => {
        expect(APP_CONFIG).toEqual({
            APP_NAME: 'iDrawBook',
            VERSION: '0.1.0'
        });
    });
});
