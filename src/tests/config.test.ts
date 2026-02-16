import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '../config';
import pkg from '../../package.json';

describe('Config', () => {
    it('should export correct app config', () => {
        expect(APP_CONFIG).toEqual({
            APP_NAME: 'iDrawBook',
            VERSION: pkg.version
        });
    });
});
