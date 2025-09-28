// Simplified authentication service using server-side token management
export interface AuthTokens {
    access_token: string;
    expires_in: number;
}

class AuthService {
    private accessToken: string | null = null;
    private expiresAt: number | null = null;

    // Get access token from server (using Service Account)
    async getServerAccessToken(): Promise<string | null> {
        try {
            const response = await fetch('/api/auth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to get access token');
            }

            const tokens: AuthTokens = await response.json();
            this.setTokens(tokens);
            return this.accessToken;
        } catch (error) {
            console.error('Failed to get access token:', error);
            return null;
        }
    }

    // Initialize authentication (simplified)
    async initializeAuth(): Promise<boolean> {
        // First try to load stored tokens
        if (this.loadStoredTokens()) {
            return true;
        }

        // If no stored tokens, get new ones from server
        const token = await this.getServerAccessToken();
        return token !== null;
    }

    // Set authentication tokens
    private setTokens(tokens: AuthTokens): void {
        this.accessToken = tokens.access_token;
        this.expiresAt = Date.now() + (tokens.expires_in * 1000);

        // Store in localStorage for persistence
        localStorage.setItem('google_access_token', this.accessToken);
        localStorage.setItem('google_expires_at', this.expiresAt.toString());
    }

    // Load tokens from localStorage
    loadStoredTokens(): boolean {
        const accessToken = localStorage.getItem('google_access_token');
        const expiresAt = localStorage.getItem('google_expires_at');

        if (accessToken && expiresAt) {
            this.accessToken = accessToken;
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
