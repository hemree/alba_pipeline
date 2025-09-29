// Google OAuth configuration
const GOOGLE_CLIENT_ID = "957041634629-o6l1f8pv078id46rq2rksmgsnu2gjruh.apps.googleusercontent.com";

// Whitelist of allowed emails
const ALLOWED_EMAILS = [
  "ahmet@albamedia.nl",
  "119007948+hemree@users.noreply.github.com",
  "test@albamedia.nl",
];

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

class GoogleAuthService {
  private accessToken: string | null = null;
  private user: GoogleUser | null = null;

  constructor() {
    // Check if user is already logged in
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const token = localStorage.getItem('google_access_token');
    const userData = localStorage.getItem('google_user');

    if (token && userData) {
      this.accessToken = token;
      this.user = JSON.parse(userData);
    }
  }

  private saveToStorage() {
    if (this.accessToken && this.user) {
      localStorage.setItem('google_access_token', this.accessToken);
      localStorage.setItem('google_user', JSON.stringify(this.user));
    }
  }

  private clearStorage() {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_user');
  }

  // Initialize Google OAuth
  async initGoogleAuth(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google OAuth script loaded');
        // Wait a bit for the API to initialize
        setTimeout(() => resolve(), 100);
      };
      script.onerror = () => reject(new Error('Failed to load Google OAuth script'));
      document.head.appendChild(script);
    });
  }

  // Start OAuth flow with popup
  async signIn(): Promise<GoogleUser> {
    try {
      await this.initGoogleAuth();
      console.log('Google OAuth initialized');

      return new Promise((resolve, reject) => {
        if (!window.google?.accounts?.oauth2) {
          reject(new Error('Google OAuth not available'));
          return;
        }

        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          callback: async (response: any) => {
            console.log('OAuth response:', response);

            if (response.error) {
              reject(new Error(response.error));
              return;
            }

            if (response.access_token) {
              this.accessToken = response.access_token;

              try {
                const userInfo = await this.fetchUserInfo();
                console.log('User info:', userInfo);

                // Check if email is whitelisted
                if (!ALLOWED_EMAILS.includes(userInfo.email)) {
                  throw new Error('Email not whitelisted');
                }

                this.user = userInfo;
                this.saveToStorage();
                resolve(userInfo);
              } catch (error) {
                console.error('Error fetching user info:', error);
                reject(error);
              }
            } else {
              reject(new Error('No access token received'));
            }
          },
        });

        console.log('Requesting access token...');
        client.requestAccessToken();
      });
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  // Fetch user info from Google
  private async fetchUserInfo(): Promise<GoogleUser> {
    if (!this.accessToken) {
      throw new Error('No access token');
    }

    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return response.json();
  }

  // Sign out
  signOut(): void {
    this.accessToken = null;
    this.user = null;
    this.clearStorage();

    // Revoke Google token
    if (window.google) {
      window.google.accounts.oauth2.revoke(this.accessToken || '');
    }
  }

  // Get current user
  getCurrentUser(): GoogleUser | null {
    return this.user;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.user && !!this.accessToken;
  }

  // Check if email is whitelisted
  isEmailAllowed(email: string): boolean {
    return ALLOWED_EMAILS.includes(email);
  }
}

// Global types for Google OAuth
declare global {
  interface Window {
    google: any;
  }
}

export const googleAuth = new GoogleAuthService();
