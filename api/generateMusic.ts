import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: any, res: any) {
    try {
        // Convert Vercel format to our format
        const url = req.url?.startsWith('http') ? req.url : `http://localhost:3001${req.url || '/api/generateMusic'}`;
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

export async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        console.log('generateMusic: Starting request processing');
        const body = await request.json();
        console.log('generateMusic: Body parsed:', JSON.stringify(body));

        const {
            prompt,
            negativePrompt,
            seed,
            sampleCount = 1,
            duration = 30 // Lyria generates 30-second clips
        } = body;

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Prompt is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get Google Cloud credentials
        const geminiApiKey = process.env.GEMINI_API_KEY;
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'alba-media-pipeline';
        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

        if (!geminiApiKey) {
            return new Response(JSON.stringify({
                error: 'GEMINI_API_KEY not configured',
                message: 'Please add your Gemini API key to .env.local'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log('Using Gemini API Key for music generation');



        // Prepare the Lyria API request
        const lyriaRequest: any = {
            instances: [{
                prompt: prompt
            }],
            parameters: {}
        };

        // Add optional parameters
        if (negativePrompt) {
            lyriaRequest.instances[0].negative_prompt = negativePrompt;
        }

        if (seed !== undefined) {
            lyriaRequest.instances[0].seed = seed;
        } else if (sampleCount > 1) {
            lyriaRequest.parameters.sample_count = sampleCount;
        }

        console.log('generateMusic: Calling Lyria API with request:', JSON.stringify(lyriaRequest));

        // Call Google Cloud Lyria API
        const response = await fetch(
            `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/lyria-002:predict?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(lyriaRequest)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Lyria API error:', errorText);
            return new Response(JSON.stringify({
                error: `Music generation failed: ${response.status} ${response.statusText}`,
                details: errorText
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const result = await response.json();
        console.log('generateMusic: Lyria API response received');

        // Extract audio content from predictions
        const audioSamples = result.predictions?.map((prediction: any) => ({
            audioContent: prediction.audioContent,
            mimeType: prediction.mimeType || 'audio/wav'
        })) || [];

        if (audioSamples.length === 0) {
            return new Response(JSON.stringify({
                error: 'No audio samples generated'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Music generated successfully',
            prompt: prompt,
            negativePrompt: negativePrompt,
            duration: duration,
            sampleCount: audioSamples.length,
            audioSamples: audioSamples,
            model: 'lyria-002',
            modelDisplayName: result.modelDisplayName || 'Lyria 2'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error) {
        console.error('generateMusic error:', error);
        return new Response(JSON.stringify({
            error: `Music generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
