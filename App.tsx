
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import VideoPipeline from './components/VideoPipeline';
import { authService } from './services/authService';

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            // Check for stored tokens
            if (authService.loadStoredTokens()) {
                setIsAuthenticated(true);
                setIsLoading(false);
                return;
            }

            // Check for OAuth callback
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('code')) {
                const success = await authService.handleAuthCallback();
                setIsAuthenticated(success);
            }

            setIsLoading(false);
        };

        initAuth();
    }, []);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    return <VideoPipeline />;
};

export default App;
