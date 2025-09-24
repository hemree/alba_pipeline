
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

    const handleLogin = async () => {
        setError('');
        setIsLoading(true);

        try {
            const success = await authService.initializeAuth();
            if (success) {
                onLoginSuccess();
            } else {
                setError('Authentication failed. Please try again.');
            }
        } catch (err) {
            setError('Authentication failed. Please try again.');
        } finally {
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
                                Click to initialize authentication and access the video pipeline
                            </p>
                        </div>

                        {error && (
                            <p className="text-sm text-center text-red-400">{error}</p>
                        )}

                        <div>
                            <button
                                onClick={handleLogin}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <Spinner size="sm" />
                                ) : (
                                    'Initialize Authentication'
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
