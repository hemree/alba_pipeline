
import React, { useState, useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import Login from './components/Login';
import VideoPipeline from './components/VideoPipeline';
import { authService } from './services/authService';

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const isAuthenticated = await authService.initializeAuth();
            setIsAuthenticated(isAuthenticated);
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

// Wrapper component with SessionProvider
const AppWithAuth: React.FC = () => {
    return (
        <SessionProvider>
            <App />
        </SessionProvider>
    );
};

export default AppWithAuth;
