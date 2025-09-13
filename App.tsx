
import React, { useState } from 'react';
import Login from './components/Login';
import VideoPipeline from './components/VideoPipeline';

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

    if (!isAuthenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    return <VideoPipeline />;
};

export default App;
