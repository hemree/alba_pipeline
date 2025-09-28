// Server-side endpoint for video generation
import type { Scene, Character, VideoModel } from "../types";
import type { GlobalBible } from "../services/continuityPromptBuilder";
import { GoogleGenAI } from "@google/genai";

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

        // Step 1: Build the continuity-aware prompt (simplified)
        let prompt;

        if (request.url && request.url.includes('prompt=')) {
            // If prompt is provided directly, use it
            const url = new URL(request.url, 'http://localhost');
            prompt = url.searchParams.get('prompt');
        } else {
            // Build a simple prompt from scene data
            const style = globalBible?.style || 'cinematic';
            const genre = globalBible?.genre || 'adventure';
            const sceneDesc = scene?.scene_description || 'A scene unfolds';
            const characters = scene?.characters?.join(', ') || 'characters';

            prompt = `In a ${style} aesthetic, with the dramatic tone of a ${genre}, ${sceneDesc}. The scene features ${characters} in a compelling visual narrative.`;
        }

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

        // Use new Google GenAI SDK for video generation
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        const ai = new GoogleGenAI({
            apiKey: apiKey
        });

        // Use Veo 3.0 for video generation
        const operation = await ai.models.generateVideos({
            model: "veo-3.0-generate-001",
            prompt: prompt,
            ...(imageInputs.length > 0 && {
                referenceImages: imageInputs
            })
        });

        // Return the operation for polling
        return new Response(JSON.stringify({
            name: operation.name,
            done: operation.done,
            metadata: operation.metadata
        }), {
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
