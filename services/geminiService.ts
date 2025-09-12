


import { GoogleGenAI, Type } from "@google/genai";
import type { Scene, Character, VideoModel } from '../types';

const sceneSchema = {
    type: Type.OBJECT,
    properties: {
        scene_description: {
            type: Type.STRING,
            description: "A short, one-sentence summary of this scene."
        },
        characters: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING
            },
            description: "A list of characters present in this scene. Must match names from the provided character list."
        },
        environment: {
            type: Type.STRING,
            description: "A detailed description of the location, atmosphere, lighting, and mood of the scene."
        },
        action: {
            type: Type.STRING,
            description: "A concise description of the main action happening in this scene. This will be a primary input for the video generation prompt."
        }
    },
    required: ["scene_description", "characters", "environment", "action"]
};

export const breakdownStoryIntoScenes = async (story: string, characterDescriptions: string[]): Promise<Omit<Scene, 'id'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

        Story:
        ---
        ${story}
        ---
    `;

    let response;
    try {
        response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: sceneSchema
                }
            }
        });
    } catch (apiError) {
        console.error("Gemini API error during story breakdown:", apiError);
        const message = apiError instanceof Error ? apiError.message : "The API request failed.";
        throw new Error(`Could not connect to the AI service: ${message}`);
    }
        
    const jsonText = response.text.trim();
    if (!jsonText) {
        throw new Error("The AI returned an empty response. Please try modifying your story.");
    }

    try {
        const scenes = JSON.parse(jsonText) as Omit<Scene, 'id'>[];
        return scenes.slice(0, 50); // Ensure max 50 scenes
    } catch (parseError) {
        console.error("Error parsing AI response:", parseError, "Raw response:", jsonText);
        throw new Error("The AI returned a response in an unexpected format. Please try again.");
    }
};

export const generateVideoForScene = async (
    scene: Scene,
    characters: Character[],
    visualStyle: string,
    narrativeGenre: string,
    prevSceneContext: string,
    onPoll: (operation: any) => void,
    videoModel: VideoModel
): Promise<string> => {
    
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }
        const ai = new GoogleGenAI({ apiKey });

        const sceneCharacterName = scene.characters.length > 0 ? scene.characters[0] : null;
        const characterForImage = sceneCharacterName ? characters.find(c => c.name.toLowerCase() === sceneCharacterName.toLowerCase() && c.imageBase64) : null;
        
        const characterPrompts = scene.characters.join(' and ');
        const prompt = `
            In a ${visualStyle} style, with the tone of a ${narrativeGenre}.
            Scene: ${scene.action}.
            Characters: ${characterPrompts}.
            Environment: ${scene.environment}.
            Continuity note: ${prevSceneContext}
        `;
        
        const imageInput = characterForImage && characterForImage.imageBase64
            ? {
                imageBytes: characterForImage.imageBase64,
                mimeType: characterForImage.imageFile?.type || 'image/jpeg'
              }
            : undefined;

        let operation = await ai.models.generateVideos({
            model: videoModel,
            prompt,
            image: imageInput,
            config: {
              numberOfVideos: 1
            }
        });

        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          operation = await ai.operations.getVideosOperation({ operation: operation });
          onPoll(operation);
        }
        
        if (operation.error) {
            throw new Error(`Video generation failed: ${operation.error.message}`);
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }

        const response = await fetch(`${downloadLink}&key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`Failed to download the generated video (status: ${response.status}).`);
        }
        
        const videoBlob = await response.blob();
        return URL.createObjectURL(videoBlob);
    } catch (error) {
        console.error(`Unhandled error in generateVideoForScene for scene "${scene.scene_description}":`, error);
        if (error instanceof Error) {
            throw new Error(`An unexpected error occurred during video generation: ${error.message}`);
        }
        throw new Error("An unknown error occurred during video generation.");
    }
};
