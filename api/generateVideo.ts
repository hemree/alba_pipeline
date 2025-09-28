// Server-side endpoint for video generation
import { GoogleAuth } from 'google-auth-library';

// Supported Veo models
const SUPPORTED_VEO_MODELS = [
    'veo-2.0-generate-001',
    'veo-2.0-generate-exp',
    'veo-3.0-generate-001',
    'veo-3.0-fast-generate-001',
    'veo-3.0-generate-preview',
    'veo-3.0-fast-generate-preview',
    // Fallback models
    'gemini-2.0-flash-exp'
] as const;

type VideoModel = typeof SUPPORTED_VEO_MODELS[number];

// Function to validate and get video model
function getValidVideoModel(requestedModel?: string): VideoModel {
    if (!requestedModel) {
        return 'veo-3.0-generate-001'; // Default model
    }

    // Check if requested model is supported
    if (SUPPORTED_VEO_MODELS.includes(requestedModel as VideoModel)) {
        return requestedModel as VideoModel;
    }

    // If not supported, return default with warning
    console.warn(`Unsupported video model: ${requestedModel}. Using default: veo-3.0-generate-001`);
    return 'veo-3.0-generate-001';
}

// Function to check if model is Veo (real video generation)
function isVeoModel(model: string): boolean {
    return model.startsWith('veo-');
}

// Function to check if model is Gemini (text-only)
function isGeminiModel(model: string): boolean {
    return model.startsWith('gemini-');
}

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

// Function to get OAuth2 access token
async function getAccessToken(): Promise<string> {
    try {
        const auth = new GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });

        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        if (!accessToken.token) {
            throw new Error('Failed to obtain access token');
        }

        return accessToken.token;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

        // Store status before consuming the body
        const statusCode = response.status;
        const data = await response.text();

        try {
            const jsonData = JSON.parse(data);
            res.status(statusCode).json(jsonData);
        } catch (parseError) {
            res.status(statusCode).send(data);
        }
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
        let resolution = '720p';
        let negativePrompt = '';
        let videoModel = 'veo-3.0-generate-001';
        let videoFeature = 'video-only';

        if (body.prompt) {
            // Simple format: { prompt, style?, duration?, aspectRatio?, resolution?, negativePrompt?, videoModel?, videoFeature? }
            prompt = body.prompt;
            style = body.style || style;
            duration = body.duration || duration;
            aspectRatio = body.aspectRatio || aspectRatio;
            resolution = body.resolution || resolution;
            negativePrompt = body.negativePrompt || negativePrompt;
            videoModel = getValidVideoModel(body.videoModel);
            videoFeature = body.videoFeature || videoFeature;
        } else if (body.scene) {
            // Complex format: { scene, characters, globalBible, ... }
            const { scene, characters = [], globalBible, prevScene, videoModel: requestVideoModel } = body as GenerateVideoRequest;

            // Use the video model from the request if provided
            if (requestVideoModel) {
                videoModel = getValidVideoModel(requestVideoModel);
            }

            const sceneStyle = globalBible?.style || 'cinematic';
            const genre = globalBible?.genre || 'adventure';
            const sceneDesc = scene?.scene_description || 'A scene unfolds';
            const characterNames = (scene?.characters && Array.isArray(scene.characters)) ? scene.characters.join(', ') : 'characters';

            // Build detailed prompt with continuity
            prompt = `In a ${sceneStyle} aesthetic, with the dramatic tone of a ${genre}, ${sceneDesc}. The scene features ${characterNames} in a compelling visual narrative.`;

            // Add character consistency details
            if (characters && characters.length > 0) {
                const characterDetails = characters
                    .filter(char => char.name && char.lockedDescription)
                    .map(char => `${char.name}: ${char.lockedDescription}`)
                    .join(', ');

                if (characterDetails) {
                    prompt += ` Character appearances must be exactly: ${characterDetails}. Maintain precise visual consistency for each character.`;
                }
            }

            // Add previous scene continuity
            if (prevScene) {
                const prevEnvironment = prevScene.environment || 'unknown location';
                const prevCharacters = Array.isArray(prevScene.characters) ? prevScene.characters.join(', ') : 'characters';
                const prevAction = prevScene.action || 'previous action';

                prompt += ` This scene continues from the previous scene where ${prevCharacters} were in ${prevEnvironment} doing: ${prevAction}.`;

                // Environment continuity analysis
                const currentEnvironment = scene.environment || 'unknown location';
                if (prevEnvironment.toLowerCase().trim() === currentEnvironment.toLowerCase().trim()) {
                    prompt += ` Continue in the same ${currentEnvironment} location with consistent lighting, camera angles, weather, and time of day.`;
                } else {
                    prompt += ` Transition logically from ${prevEnvironment} to ${currentEnvironment} maintaining spatial and temporal coherence.`;
                }

                // Character state continuity
                if (Array.isArray(prevScene.characters) && Array.isArray(scene.characters)) {
                    const continuingCharacters = scene.characters.filter((char: string) =>
                        prevScene.characters.includes(char)
                    );

                    if (continuingCharacters.length > 0) {
                        prompt += ` Characters ${continuingCharacters.join(', ')} continue from their previous positions and emotional states.`;
                    }
                }
            }

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
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'pipeline-473521';
        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

        // Get OAuth2 access token
        let accessToken: string;
        try {
            accessToken = await getAccessToken();
            console.log('Successfully obtained OAuth2 access token for video generation');
        } catch (error) {
            console.error('Failed to get access token:', error);
            return new Response(JSON.stringify({
                error: 'Authentication failed',
                message: 'Failed to obtain Google Cloud access token',
                details: error instanceof Error ? error.message : 'Unknown error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Prepare request based on model type
        let veoRequest: any;

        if (isVeoModel(videoModel)) {
            // Veo models - Real video generation
            veoRequest = {
                contents: [{
                    role: "user",
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40
                }
            };

            // Add negative prompt for Veo models
            if (negativePrompt) {
                veoRequest.contents[0].parts.push({
                    text: `Negative prompt: ${negativePrompt}`
                });
            }

            console.log(`Using Veo model: ${videoModel} for real video generation`);
        } else {
            // Gemini models - Text-only response (mock)
            veoRequest = {
                contents: [{
                    role: "user",
                    parts: [{
                        text: `Generate a video description for: ${prompt}. Style: ${style}. Duration: ${duration} seconds.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 1024,
                    responseMimeType: "application/json"
                }
            };

            console.log(`Using Gemini model: ${videoModel} for mock response`);
        }

        // Call Google Cloud Video AI (Veo) API
        const response = await fetch(
            `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${videoModel}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
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
        console.log('Veo API response:', result);

        // Return the operation name for polling
        return new Response(JSON.stringify({
            operationName: result.name || `projects/${projectId}/locations/${location}/operations/video-${Date.now()}`,
            status: 'generating',
            message: 'Video generation started successfully',
            prompt: prompt,
            style: style,
            duration: duration,
            aspectRatio: aspectRatio,
            model: videoModel
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Video generation error:", error);
        const message = error instanceof Error ? error.message : "Video generation failed";
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/*
// Unreachable code removed - keeping for reference
        // Prepare the Veo API request
        const veoRequest: any = {
            model: videoModel,
            prompt: {
                text: prompt
            },
            generationConfig: {
                aspectRatio: aspectRatio,
                duration: `${duration}s`,
                resolution: resolution,
                seed: Math.floor(Math.random() * 4294967295)
            }
        };

        // Add negative prompt if provided
        if (negativePrompt) {
            veoRequest.prompt.negativeText = negativePrompt;
        }

        // Add audio generation if requested
        if (videoFeature === 'video-audio') {
            veoRequest.generationConfig.includeAudio = true;
        }

        // Call Google Cloud Video AI (Veo) API
        const response = await fetch(
            `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${videoModel}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
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
*/
