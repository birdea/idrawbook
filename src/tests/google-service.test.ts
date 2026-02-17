import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleService } from '../google';

// Mock dependencies
const mockToast = vi.fn();
vi.mock('../ui/toast', () => ({
    showToast: (...args: any[]) => mockToast(...args)
}));

describe('GoogleService', () => {
    let service: GoogleService;
    let mockOnStateChange: any;

    beforeEach(() => {
        // Mock global Google objects
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
                ViewId: { FOLDERS: 'FOLDERS' },
                Action: { PICKED: 'picked', LOADED: 'loaded' },
                PickerBuilder: vi.fn().mockImplementation(() => ({
                    addView: vi.fn().mockReturnThis(),
                    setOAuthToken: vi.fn().mockReturnThis(),
                    setDeveloperKey: vi.fn().mockReturnThis(),
                    setOrigin: vi.fn().mockReturnThis(),
                    setCallback: vi.fn().mockReturnThis(),
                    build: vi.fn().mockReturnValue({
                        setVisible: vi.fn()
                    })
                }))
            }
        };

        (window as any).gapi = {
            load: vi.fn((_lib, opts) => opts.callback())
        };

        mockOnStateChange = vi.fn();
        vi.stubGlobal('import.meta', { env: { VITE_GOOGLE_CLIENT_ID: 'test-client-id', VITE_GOOGLE_API_KEY: 'test-api-key' } });

        service = new GoogleService(mockOnStateChange);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as any).google;
        delete (window as any).gapi;
    });

    it('should initialize correctly', () => {
        expect((window as any).gapi.load).toHaveBeenCalledWith('picker', expect.any(Object));
    });

    it('should show toast if google global is undefined on login', () => {
        delete (window as any).google;
        service.login();
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('identity services not loaded'));
    });

    it('should request access token on login', () => {
        const requestMock = vi.fn();
        (window as any).google.accounts.oauth2.initTokenClient.mockReturnValue({
            requestAccessToken: requestMock
        });

        service.login();
        expect(requestMock).toHaveBeenCalled();
    });
});
