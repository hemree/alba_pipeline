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
            videoModel = body.videoModel || videoModel;
            videoFeature = body.videoFeature || videoFeature;
        } else if (body.scene) {
            // Complex format: { scene, characters, globalBible, ... }
            const { scene, characters = [], globalBible, prevScene, videoModel } = body as GenerateVideoRequest;

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
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'alba-media-pipeline';
        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (!geminiApiKey) {
            return new Response(JSON.stringify({
                error: 'GEMINI_API_KEY not configured',
                message: 'Please add your Gemini API key to .env.local'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log('Using Gemini API Key for video generation');

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
            `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${videoModel}:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: {
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
