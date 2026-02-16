import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleService } from '../google';

describe('GoogleService', () => {
    let service: GoogleService;
    const onStateChange = vi.fn();

    beforeEach(() => {
        // Mock global google and gapi
        (window as any).gapi = {
            load: vi.fn((_api, config) => {
                if (config.callback) config.callback();
            }),
        };
        (window as any).google = {
            accounts: {
                oauth2: {
                    initTokenClient: vi.fn().mockReturnValue({
                        requestAccessToken: vi.fn()
                    })
                }
            },
            picker: {
                DocsView: vi.fn().mockReturnThis(),
                setSelectFolderEnabled: vi.fn().mockReturnThis(),
                setIncludeFolders: vi.fn().mockReturnThis(),
                setMimeTypes: vi.fn().mockReturnThis(),
                PickerBuilder: vi.fn().mockReturnThis(),
                addView: vi.fn().mockReturnThis(),
                setOAuthToken: vi.fn().mockReturnThis(),
                setDeveloperKey: vi.fn().mockReturnThis(),
                setOrigin: vi.fn().mockReturnThis(),
                setCallback: vi.fn().mockReturnThis(),
                build: vi.fn().mockReturnValue({
                    setVisible: vi.fn()
                }),
                ViewId: { FOLDERS: 'folders' },
                Action: { PICKED: 'picked', CANCEL: 'cancel' }
            }
        };

        // Mock fetch
        window.fetch = vi.fn();

        // Mock import.meta.env
        vi.stubGlobal('import.meta', { env: { VITE_GOOGLE_CLIENT_ID: 'id', VITE_GOOGLE_API_KEY: 'key' } });

        service = new GoogleService(onStateChange);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize and load gapi', () => {
        expect((window as any).gapi.load).toHaveBeenCalledWith('picker', expect.any(Object));
    });

    it('should login', () => {
        service.login();
        expect((window as any).google.accounts.oauth2.initTokenClient).toHaveBeenCalled();
    });

    it('isLoggedIn should be false initially', () => {
        expect(service.isLoggedIn()).toBe(false);
    });

    it('should upload to drive (simulate success)', async () => {
        // Hack to set access token
        (service as any).accessToken = 'mock_token';

        const blob = new Blob(['test'], { type: 'image/png' });

        (window.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({})
        });

        // Mock FileReader
        // FileReader is already available in jsdom, but readAsArrayBuffer is async-ish.
        // We can just rely on jsdom's FileReader or mock it if needed.
        // Let's rely on real one? But wait, jsdom implementation might need attention.
        // Actually, let's mock the Promise that wraps FileReader in the source code?
        // No, we can't easily.
        // Let's mock FileReader or ensure it works. jsdom supports it.

        const result = await service.uploadToDrive(blob, 'test.png', 'image/png');
        expect(result).toBe(true);
        expect(window.fetch).toHaveBeenCalledWith(
            expect.stringContaining('upload/drive/v3/files'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer mock_token',
                    'Content-Type': expect.stringContaining('multipart/related')
                })
            })
        );
    });

    it('should handle upload error', async () => {
        (service as any).accessToken = 'mock_token';
        const blob = new Blob(['test'], { type: 'image/png' });

        (window.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ error: { message: 'fail' } })
        });

        const result = await service.uploadToDrive(blob, 'test.png', 'image/png');
        expect(result).toBe(false);
    });

    it('logout should clear token', () => {
        (service as any).accessToken = 'token';
        (service as any).user = { name: 'Me' };
        service.logout();
        expect((service as any).accessToken).toBeNull();
        expect((service as any).user).toBeNull();
        expect(onStateChange).toHaveBeenCalledWith(null);
    });
});
