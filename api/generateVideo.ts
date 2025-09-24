// Server-side endpoint for video generation
import type { Scene, Character, VideoModel } from "../types";
import type { GlobalBible } from "../services/continuityPromptBuilder";

interface GenerateVideoRequest {
    scene: Scene;
    characters: Character[];
    globalBible: GlobalBible;
    prevScene: Scene | null;
    videoModel: VideoModel;
}

export default async function handler(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { scene, characters, globalBible, prevScene, videoModel } = await request.json() as GenerateVideoRequest;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        // Step 1: Build the continuity-aware prompt
        const continuityResponse = await fetch('/api/continuity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scene,
                globalBible,
                prevScene,
            }),
        });

        if (!continuityResponse.ok) {
            throw new Error('Failed to build continuity prompt');
        }

        const prompt = await continuityResponse.text();

        // Step 2: Prepare image data for character references
        const imageInputs = characters
            .filter(c => c.imageBase64)
            .map(c => ({
                inlineData: {
                    data: c.imageBase64!.split(',')[1], // Remove data:image/jpeg;base64, prefix
                    mimeType: c.imageFile?.type || 'image/jpeg'
                }
            }));

        // Step 3: Generate video using Veo API
        const requestBody = {
            model: videoModel,
            prompt: prompt,
            ...(imageInputs.length > 0 && {
                referenceImages: imageInputs
            })
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${videoModel}:generateVideo?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Video generation failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Return the operation for polling
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
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
