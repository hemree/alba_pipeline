import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Import API handlers
const breakdownStoryHandler = (await import('./api/breakdownStory.ts')).default;
const generateStoryHandler = (await import('./api/generateStory.ts')).default;
const generateCharacterHandler = (await import('./api/generateCharacter.ts')).default;
const generateVideoHandler = (await import('./api/generateVideo.ts')).default;
const continuityHandler = (await import('./api/continuity.ts')).default;
const describeCharacterHandler = (await import('./api/describeCharacter.ts')).default;
const pollOperationHandler = (await import('./api/pollOperation.ts')).default;
const downloadVideoHandler = (await import('./api/downloadVideo.ts')).default;
const authTokenHandler = (await import('./api/auth/token.ts')).default;

// API Routes
app.post('/api/breakdownStory', async (req, res) => {
    try {
        const request = new Request('http://localhost/api/breakdownStory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const response = await breakdownStoryHandler(request);
        const data = await response.text();
        res.status(response.status).json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generateStory', async (req, res) => {
    try {
        const request = new Request('http://localhost/api/generateStory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const response = await generateStoryHandler(request);
        const data = await response.text();
        res.status(response.status).json(JSON.parse(data));
    } catch (error) {
        console.error('Story generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generateCharacter', async (req, res) => {
    try {
        const request = new Request('http://localhost/api/generateCharacter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const response = await generateCharacterHandler(request);
        const data = await response.text();
        res.status(response.status).json(JSON.parse(data));
    } catch (error) {
        console.error('Character generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generateVideo', async (req, res) => {
    try {
        const request = new Request('http://localhost/api/generateVideo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const response = await generateVideoHandler(request);
        const data = await response.text();
        res.status(response.status).json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/continuity', async (req, res) => {
    try {
        const request = new Request('http://localhost/api/continuity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const response = await continuityHandler(request);
        const data = await response.text();
        res.status(response.status).send(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/describeCharacter', async (req, res) => {
    try {
        const request = new Request('http://localhost/api/describeCharacter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const response = await describeCharacterHandler(request);
        const data = await response.text();
        res.status(response.status).send(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pollOperation', async (req, res) => {
    try {
        const request = new Request('http://localhost/api/pollOperation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const response = await pollOperationHandler(request);
        const data = await response.text();
        res.status(response.status).json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/downloadVideo', async (req, res) => {
    try {
        const request = new Request('http://localhost/api/downloadVideo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const response = await downloadVideoHandler(request);
        const arrayBuffer = await response.arrayBuffer();
        res.status(response.status)
            .set('Content-Type', 'video/mp4')
            .send(Buffer.from(arrayBuffer));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/token', async (req, res) => {
    try {
        await authTokenHandler(req, res);
    } catch (error) {
        console.error('Auth token error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
