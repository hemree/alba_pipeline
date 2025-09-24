import type { Scene, Character, VideoModel } from '../types';
import { buildContinuityPrompt, type GlobalBible } from './continuityPromptBuilder';

export const breakdownStoryIntoScenes = async (story: string, characterDescriptions: string[]): Promise<Omit<Scene, 'id'>[]> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API key is not configured.");
    }

    const prompt = `
        Break down the following story into a sequence of distinct scenes, with a maximum of 50 scenes.
        Each scene should represent approximately 8 seconds of video.

        Requirements:
        1. Ensure continuity between scenes.
           - Mention how each scene connects to the previous one.
           - If a character appears again, use consistent naming and descriptions.
           - Keep environments visually consistent unless the story explicitly changes setting.
        2. Use ONLY the provided characters: [${characterDescriptions.join(', ')}].
        3. For each scene, return structured JSON with:
           - scene_description: one sentence summary.
           - characters: list of character names from the provided list.
           - environment: location, atmosphere, lighting, and mood (consistent across scenes).
           - action: concise description of the main action, with continuity note if needed.
        4. Always maintain style continuity for visuals (e.g., "Anime", "Comic book")
           and narrative genre tone (e.g., "Fantasy novel"), to be injected later.

        Return ONLY a valid JSON array of scenes. Each scene should have: scene_description, characters, environment, action.

        Story:
        ---
        ${story}
        ---
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error("The AI returned an empty response. Please try modifying your story.");
        }

        // Extract JSON from the response (remove any markdown formatting)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const jsonText = jsonMatch ? jsonMatch[0] : text.trim();

        const scenes = JSON.parse(jsonText) as Omit<Scene, 'id'>[];
        return scenes.slice(0, 50); // Ensure max 50 scenes
    } catch (apiError) {
        console.error("Gemini API error during story breakdown:", apiError);
        const message = apiError instanceof Error ? apiError.message : "The API request failed.";
        throw new Error(`Could not connect to the AI service: ${message}`);
    }
};

export const generateVideoForScene = async (
    scene: Scene,
    characters: Character[],
    globalBible: GlobalBible,
    prevScene: Scene | null,
    onPoll: (operation: any) => void,
    videoModel: VideoModel
): Promise<string> => {

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        // Step 1: Build the continuity-aware prompt using the new service
        const prompt = await buildContinuityPrompt(scene, globalBible, prevScene);

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
            const errorData = await response.json();
            throw new Error(`Video generation API failed: ${errorData.error?.message || response.statusText}`);
        }

        const operationData = await response.json();
        let operation = operationData;

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));

            const pollResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/operations/${operation.name}?key=${apiKey}`);
            if (pollResponse.ok) {
                operation = await pollResponse.json();
                onPoll(operation);
            }
        }

        if (operation.error) {
            throw new Error(`Video generation failed: ${operation.error.message}`);
        }

        const videoUri = operation.response?.video?.uri;
        if (!videoUri) {
            throw new Error("Video generation completed, but no download link was found.");
        }

        // Download the generated video
        const videoResponse = await fetch(`${videoUri}?key=${apiKey}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download the generated video (status: ${videoResponse.status}).`);
        }

        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);
    } catch (error) {
        console.error(`Unhandled error in generateVideoForScene for scene "${scene.scene_description}":`, error);
        if (error instanceof Error) {
            throw new Error(`An unexpected error occurred during video generation: ${error.message}`);
        }
        throw new Error("An unknown error occurred during video generation.");
    }
};