// Server-side endpoint for video generation

interface GenerateVideoRequest {
    prompt?: string;
    style?: string;
    duration?: number;
    aspectRatio?: string;
    scene?: any;
    characters?: any[];
    globalBible?: any;
    prevScene?: any;
    videoModel?: string;
}

export default async function handler(req: any, res: any) {
    try {
        // Convert Vercel format to our format
        const url = req.url?.startsWith('http') ? req.url : `http://localhost:3001${req.url || '/api/generateVideo'}`;
        const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        const response = await handleRequest(request);
        if (!response) {
            throw new Error('handleRequest returned undefined');
        }

        const data = await response.text();
        res.status(response.status).json(JSON.parse(data));
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}

async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        console.log('generateVideo: Starting request processing');
        const body = await request.json();
        console.log('generateVideo: Body parsed:', JSON.stringify(body));

        // Support both simple and complex request formats
        let prompt: string;
        let style = 'cinematic';
        let duration = 8;
        let aspectRatio = '16:9';

        if (body.prompt) {
            // Simple format: { prompt, style?, duration?, aspectRatio? }
            prompt = body.prompt;
            style = body.style || style;
            duration = body.duration || duration;
            aspectRatio = body.aspectRatio || aspectRatio;
        } else if (body.scene) {
            // Complex format: { scene, characters, globalBible, ... }
            const { scene, characters = [], globalBible, prevScene, videoModel } = body as GenerateVideoRequest;

            const sceneStyle = globalBible?.style || 'cinematic';
            const genre = globalBible?.genre || 'adventure';
            const sceneDesc = scene?.scene_description || 'A scene unfolds';
            const characterNames = (scene?.characters && Array.isArray(scene.characters)) ? scene.characters.join(', ') : 'characters';

            prompt = `In a ${sceneStyle} aesthetic, with the dramatic tone of a ${genre}, ${sceneDesc}. The scene features ${characterNames} in a compelling visual narrative.`;
            style = sceneStyle;
        } else {
            return new Response(JSON.stringify({ error: 'Either prompt or scene is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Prompt is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get Google Cloud credentials
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'alba-media-pipeline';
        const location = 'us-central1';
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Google API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Prepare the Veo API request
        const veoRequest = {
            model: 'veo-3.0-generate-001',
            prompt: {
                text: prompt
            },
            generationConfig: {
                aspectRatio: aspectRatio,
                duration: `${duration}s`,
                seed: Math.floor(Math.random() * 4294967295)
            }
        };

        // Call Google Cloud Video AI (Veo) API
        const response = await fetch(
            `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/veo-3.0-generate-001:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(veoRequest)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Veo API error:', errorText);
            return new Response(JSON.stringify({
                error: `Video generation failed: ${response.status} ${response.statusText}`,
                details: errorText
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const result = await response.json();

        // Return the operation name for polling
        return new Response(JSON.stringify({
            operationName: result.name || `projects/${projectId}/locations/${location}/operations/video-${Date.now()}`,
            status: 'generating',
            message: 'Video generation started successfully',
            prompt: prompt,
            style: style,
            duration: duration,
            aspectRatio: aspectRatio,
            model: 'veo-3.0-generate-001'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Video generation error:", error);
        const message = error instanceof Error ? error.message : "Video generation failed";
        return new Response(JSON.stringify({
            error: message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
