import type { Scene, Character, VideoModel } from '../types';
import type { GlobalBible } from './continuityPromptBuilder';
import { authService } from './authService';

export const breakdownStoryIntoScenes = async (story: string, characterDescriptions: string[]): Promise<Omit<Scene, 'id'>[]> => {
    try {
        // Ensure we have authentication
        const isAuthenticated = await authService.initializeAuth();
        if (!isAuthenticated) {
            throw new Error('Authentication failed. Please try again.');
        }

        const response = await fetch('/api/breakdownStory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                story,
                characterDescriptions,
            }),
        });

        if (!response.ok) {
            let errorMsg = `Request failed with status ${response.status}`;
            try {
                const errorJson = await response.json();
                errorMsg = errorJson.error || errorMsg;
            } catch (e) {
                const textError = await response.text();
                errorMsg = textError || errorMsg;
            }
            throw new Error(errorMsg);
        }

        const scenes = await response.json() as Omit<Scene, 'id'>[];
        return scenes;
    } catch (apiError) {
        console.error("Story breakdown error:", apiError);
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
    videoOptions: {
        model: VideoModel;
        feature: string;
        resolution: string;
        negativePrompt?: string;
    }
): Promise<string> => {

    try {
        // Ensure we have authentication
        const isAuthenticated = await authService.initializeAuth();
        if (!isAuthenticated) {
            throw new Error('Authentication failed. Please try again.');
        }

        const response = await fetch('/api/generateVideo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scene,
                characters,
                globalBible,
                prevScene,
                videoModel: videoOptions.model,
                videoFeature: videoOptions.feature,
                resolution: videoOptions.resolution,
                negativePrompt: videoOptions.negativePrompt,
            }),
        });

        if (!response.ok) {
            let errorMsg = `Request failed with status ${response.status}`;
            try {
                const errorJson = await response.json();
                errorMsg = errorJson.error || errorMsg;
            } catch (e) {
                const textError = await response.text();
                errorMsg = textError || errorMsg;
            }
            throw new Error(errorMsg);
        }

        const operationData = await response.json();
        let operation = operationData;

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));

            const pollResponse = await fetch(`/api/pollOperation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    operationName: operation.name,
                }),
            });

            if (pollResponse.ok) {
                operation = await pollResponse.json();
                onPoll(operation);
            }
        }

        if (operation.error) {
            throw new Error(`Video generation failed: ${operation.error.message}`);
        }

        const videoFile = operation.response?.generatedVideos?.[0]?.video;
        if (!videoFile) {
            throw new Error("Video generation completed, but no video file was found.");
        }

        // Download the generated video via server endpoint
        const videoResponse = await fetch('/api/downloadVideo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoFile: videoFile,
            }),
        });

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

export const generateMusicDescriptionFromStory = async (story: string): Promise<string> => {
    try {
        const response = await fetch('/api/generateStory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: `Analyze this story and generate a music description that would fit as background music. Focus on mood, tempo, instruments, and style. Return only the music description, nothing else.

Story: ${story}

Generate a music description like: "A mysterious orchestral piece with slow strings and haunting piano melodies" or "An upbeat folk song with acoustic guitar and light percussion"`
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to generate music description: ${response.status}`);
        }

        const result = await response.json();
        return result.story || "A calm instrumental piece with gentle melodies";
    } catch (error) {
        console.error('Error generating music description:', error);
        return "A calm instrumental piece with gentle melodies";
    }
};