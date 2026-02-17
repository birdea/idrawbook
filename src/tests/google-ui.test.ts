import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateGoogleUI } from '../ui/google-ui';
import type { GoogleUser } from '../google';

describe('Google UI', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.innerHTML = `
            <div id="menu-google-login"></div>
            <div id="menu-user-info" class="hidden">
                <img id="menu-user-avatar" />
                <span id="menu-user-name"></span>
            </div>
            <div id="drive-login-ui"></div>
            <div id="drive-save-ui" class="hidden"></div>
        `;
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should show logged-in UI when user is provided', () => {
        const user: GoogleUser = {
            name: 'Test User',
            email: 'test@example.com',
            picture: 'http://example.com/avatar.png'
        };

        updateGoogleUI(user);

        const menuLogin = document.getElementById('menu-google-login');
        const menuInfo = document.getElementById('menu-user-info');
        const menuAvatar = document.getElementById('menu-user-avatar') as HTMLImageElement;
        const menuName = document.getElementById('menu-user-name');
        const driveLoginUI = document.getElementById('drive-login-ui');
        const driveSaveUI = document.getElementById('drive-save-ui');

        expect(menuLogin?.classList.contains('hidden')).toBe(true);
        expect(menuInfo?.classList.contains('hidden')).toBe(false);
        expect(menuAvatar.src).toBe(user.picture);
        expect(menuName?.textContent).toBe(user.name);

        expect(driveLoginUI?.classList.contains('hidden')).toBe(true);
        expect(driveSaveUI?.classList.contains('hidden')).toBe(false);
    });

    it('should show logged-out UI when user is null', () => {
        updateGoogleUI(null);

        const menuLogin = document.getElementById('menu-google-login');
        const menuInfo = document.getElementById('menu-user-info');
        const driveLoginUI = document.getElementById('drive-login-ui');
        const driveSaveUI = document.getElementById('drive-save-ui');

        expect(menuLogin?.classList.contains('hidden')).toBe(false);
        expect(menuInfo?.classList.contains('hidden')).toBe(true);

        expect(driveLoginUI?.classList.contains('hidden')).toBe(false);
        expect(driveSaveUI?.classList.contains('hidden')).toBe(true);
    });

    it('should handle missing elements gracefully', () => {
        // Clear body
        document.body.innerHTML = '';

        // Should not throw
        expect(() => updateGoogleUI({ name: 'Test', email: 'test@example.com', picture: '' })).not.toThrow();
        expect(() => updateGoogleUI(null)).not.toThrow();
    });
});
