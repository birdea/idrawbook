import { showToast } from './ui/toast';

declare const google: any;
declare const gapi: any;

export interface GoogleUser {
    name: string;
    email: string;
    picture: string;
}

export class GoogleService {
    private clientId: string;
    private apiKey: string;
    private accessToken: string | null = null;
    private user: GoogleUser | null = null;
    private onStateChange: (user: GoogleUser | null) => void;
    private pickerApiLoaded = false;

    constructor(onStateChange: (user: GoogleUser | null) => void) {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (!clientId || !apiKey) {
            console.warn('Google API credentials not configured. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY in your .env file.');
        }
        this.clientId = clientId ?? '';
        this.apiKey = apiKey ?? '';
        this.onStateChange = onStateChange;
        this.initGAPI();
    }

    private initGAPI() {
        // Load the Google Picker API
        const loadPicker = () => {
            gapi.load('picker', {
                callback: () => {
                    this.pickerApiLoaded = true;
                }
            });
        };

        if (typeof gapi !== 'undefined') {
            loadPicker();
        } else {
            // Wait for script to load (timeout after 30s)
            let attempts = 0;
            const maxAttempts = 300;
            const checkGapi = setInterval(() => {
                attempts++;
                if (typeof gapi !== 'undefined') {
                    loadPicker();
                    clearInterval(checkGapi);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkGapi);
                    console.warn('Google API (gapi) failed to load after 30s');
                }
            }, 100);
        }
    }

    public login() {
        console.log('Login requested...');
        if (typeof google === 'undefined') {
            console.error('Google GSI script not loaded');
            showToast('Google identity services not loaded yet. Please try again in a moment.');
            return;
        }

        try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: 'https://www.googleapis.com/auth/drive.file email profile',
                callback: (response: any) => {
                    console.log('Auth response received:', response);
                    if (response.access_token) {
                        this.accessToken = response.access_token;
                        this.fetchUserInfo();
                    } else if (response.error) {
                        console.error('Auth error:', response.error);
                        showToast(`Login failed: ${response.error}`);
                    }
                },
            });
            console.log('Requesting access token...');
            client.requestAccessToken();
        } catch (err) {
            console.error('Error during initTokenClient or requestAccessToken:', err);
            showToast('Failed to initialize Google login. Please check if your Client ID is correct.');
        }
    }

    private async fetchUserInfo() {
        if (!this.accessToken) return;

        try {
            const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            const data = await resp.json();
            this.user = {
                name: data.name,
                email: data.email,
                picture: data.picture
            };
            this.onStateChange(this.user);
        } catch (err) {
            console.error('Error fetching user info:', err);
            this.accessToken = null;
            this.user = null;
            this.onStateChange(null);
            showToast('Failed to fetch user info. Please try logging in again.');
        }
    }

    public logout() {
        this.accessToken = null;
        this.user = null;
        this.onStateChange(null);
    }

    public async showPicker(): Promise<string | null> {
        if (!this.accessToken) {
            showToast('Your session has expired or you are not logged in. Please login to Google first.');
            return null;
        }

        if (!this.pickerApiLoaded) {
            showToast('Google Picker is still loading. Please try again in a few seconds.');
            return null;
        }

        try {
            return new Promise((resolve) => {
                const docsView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
                    .setSelectFolderEnabled(true)
                    .setIncludeFolders(true)
                    .setMimeTypes('application/vnd.google-apps.folder');

                const pickerBuilder = new google.picker.PickerBuilder()
                    .addView(docsView)
                    .setOAuthToken(this.accessToken)
                    .setDeveloperKey(this.apiKey)
                    .setOrigin(window.location.origin)
                    .setCallback((data: any) => {
                        if (data.action === google.picker.Action.PICKED) {
                            const folder = data.docs[0];
                            resolve(folder.id);
                        } else if (data.action !== google.picker.Action.LOADED) {
                            resolve(null);
                        }
                    });

                const picker = pickerBuilder.build();
                picker.setVisible(true);
            });
        } catch (err) {
            console.error('Error creating picker:', err);
            showToast('Failed to open Google Picker. Please check your browser console.');
            return null;
        }
    }


    public async uploadToDrive(blob: Blob, filename: string, mimeType: string, folderId?: string): Promise<boolean> {
        if (!this.accessToken) {
            showToast('Please login to Google first.');
            return false;
        }

        try {
            const boundary = 'foo_bar_baz';
            const metadata: { name: string; mimeType: string; parents?: string[] } = {
                name: filename,
                mimeType: mimeType
            };

            if (folderId) {
                metadata.parents = [folderId];
            }

            const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
            const filePartHeader = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
            const footer = `\r\n--${boundary}--`;

            const reader = new FileReader();
            const fileData: ArrayBuffer = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = reject;
                reader.readAsArrayBuffer(blob);
            });

            // Combine all parts into a single Blob
            const multipartBody = new Blob([
                metadataPart,
                filePartHeader,
                new Uint8Array(fileData),
                footer
            ], { type: `multipart/related; boundary=${boundary}` });

            const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartBody
            });

            if (resp.ok) {
                showToast('Successfully saved to Google Drive!');
                return true;
            } else {
                const error = await resp.json();
                console.error('Drive upload failed:', error);
                showToast(`Failed to save to Google Drive: ${error.error?.message || 'Unknown error'}`);
                return false;
            }
        } catch (err) {
            console.error('Error uploading to Drive:', err);
            showToast('An error occurred while uploading to Google Drive.');
            return false;
        }
    }

    public isLoggedIn() {
        return !!this.accessToken;
    }

    public getUser() {
        return this.user;
    }
}
