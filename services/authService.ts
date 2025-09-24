// Google OAuth2 authentication service
export interface AuthTokens {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}

class AuthService {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private expiresAt: number | null = null;

    // Initialize Google OAuth2 flow
    initiateGoogleAuth(): void {
        const clientId = '666474673330-arsk7l5ma60krpjc3ggeej44dt1s0v25.apps.googleusercontent.com';
        const redirectUri = window.location.origin;
        const scope = 'https://www.googleapis.com/auth/generative-language.retriever';
        
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', scope);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');

        window.location.href = authUrl.toString();
    }

    // Handle OAuth2 callback
    async handleAuthCallback(): Promise<boolean> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
            console.error('OAuth error:', error);
            return false;
        }

        if (!code) {
            return false;
        }

        try {
            const response = await fetch('/api/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            if (!response.ok) {
                throw new Error('Token exchange failed');
            }

            const tokens: AuthTokens = await response.json();
            this.setTokens(tokens);

            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            return true;
        } catch (error) {
            console.error('Auth callback error:', error);
            return false;
        }
    }

    // Set authentication tokens
    private setTokens(tokens: AuthTokens): void {
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token || null;
        this.expiresAt = Date.now() + (tokens.expires_in * 1000);

        // Store in localStorage for persistence
        localStorage.setItem('google_access_token', this.accessToken);
        if (this.refreshToken) {
            localStorage.setItem('google_refresh_token', this.refreshToken);
        }
        localStorage.setItem('google_expires_at', this.expiresAt.toString());
    }

    // Load tokens from localStorage
    loadStoredTokens(): boolean {
        const accessToken = localStorage.getItem('google_access_token');
        const refreshToken = localStorage.getItem('google_refresh_token');
        const expiresAt = localStorage.getItem('google_expires_at');

        if (accessToken && expiresAt) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.expiresAt = parseInt(expiresAt);

            // Check if token is still valid
            if (this.expiresAt > Date.now()) {
                return true;
            } else {
                this.clearTokens();
                return false;
            }
        }

        return false;
    }

    // Get current access token
    getAccessToken(): string | null {
        if (this.accessToken && this.expiresAt && this.expiresAt > Date.now()) {
            return this.accessToken;
        }
        return null;
    }

    // Check if user is authenticated
    isAuthenticated(): boolean {
        return this.getAccessToken() !== null;
    }

    // Clear all tokens
    clearTokens(): void {
        this.accessToken = null;
        this.refreshToken = null;
        this.expiresAt = null;

        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_refresh_token');
        localStorage.removeItem('google_expires_at');
    }

    // Sign out
    signOut(): void {
        this.clearTokens();
        window.location.reload();
    }
}

export const authService = new AuthService();
