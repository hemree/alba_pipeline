import type { Scene, Character, VideoModel } from '../types';
import type { GlobalBible } from './continuityPromptBuilder';
import { authService } from './authService';

export const breakdownStoryIntoScenes = async (story: string, characterDescriptions: string[]): Promise<Omit<Scene, 'id'>[]> => {
    try {
        const accessToken = authService.getAccessToken();
        if (!accessToken) {
            throw new Error('Authentication required. Please sign in with Google.');
        }

        const response = await fetch('/api/breakdownStory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                story,
                characterDescriptions,
                accessToken,
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
    videoModel: VideoModel
): Promise<string> => {

    try {
        const accessToken = authService.getAccessToken();
        if (!accessToken) {
            throw new Error('Authentication required. Please sign in with Google.');
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
                videoModel,
                accessToken,
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
                    accessToken,
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

        const videoUri = operation.response?.video?.uri;
        if (!videoUri) {
            throw new Error("Video generation completed, but no download link was found.");
        }

        // Download the generated video via server endpoint
        const videoResponse = await fetch('/api/downloadVideo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoUri: videoUri,
                accessToken,
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