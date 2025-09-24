
import React, { useState, useEffect } from 'react';
import Spinner from './Spinner';
import { authService } from '../services/authService';

// Array of high-quality, royalty-free background images
const backgroundImages = [
    'https://images.unsplash.com/photo-1535016120720-40c646be5580?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1598327105666-6d8253731238?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1505628346881-b72b27e84530?q=80&w=1974&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1574717521952-924c284defa3?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop'
];

interface LoginProps {
    onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Effect for background image slideshow
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
        }, 5000); // Change image every 5 seconds
        return () => clearInterval(timer);
    }, []);

    const handleGoogleLogin = async () => {
        setError('');
        setIsLoading(true);

        try {
            authService.initiateGoogleAuth();
        } catch (err) {
            setError('Failed to initiate Google authentication');
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full font-sans">
            {backgroundImages.map((img, index) => (
                <div
                    key={img}
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
                    style={{
                        backgroundImage: `url(${img})`,
                        opacity: index === currentImageIndex ? 1 : 0,
                    }}
                />
            ))}
            <div className="absolute inset-0 bg-black bg-opacity-50" />
            <div className="relative flex items-center justify-center min-h-screen p-4">
                <div className="w-full max-w-md p-8 space-y-8 bg-white bg-opacity-10 backdrop-blur-md rounded-xl shadow-2xl">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-white">
                            Alba Media
                        </h1>
                        <p className="mt-2 text-gray-200">Video Pipeline Login</p>
                    </div>
                    <div className="space-y-6">
                        <div className="text-center">
                            <p className="text-gray-300 text-sm mb-6">
                                Sign in with your Google account to access the video pipeline
                            </p>
                        </div>

                        {error && (
                            <p className="text-sm text-center text-red-400">{error}</p>
                        )}

                        <div>
                            <button
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <Spinner size="sm" />
                                ) : (
                                    <>
                                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Continue with Google
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
