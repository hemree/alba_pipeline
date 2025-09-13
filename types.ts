
export interface Character {
    id: number;
    name: string;
    imageFile: File | null;
    imageBase64: string | null;
    lockedDescription: string | null;
}

export type TransitionType = 'fade' | 'dissolve' | 'wipeleft' | 'wiperight' | 'circleopen';

export interface Scene {
    id: number;
    scene_description: string;
    characters: string[];
    environment: string;
    action: string;
    transitionToNext: TransitionType;
}

export type VideoGenerationStatusValue = 'pending' | 'generating' | 'polling' | 'complete' | 'error';

export interface VideoGenerationStatus {
    sceneIndex: number;
    sceneId: number;
    status: VideoGenerationStatusValue;
    videoUrl: string | null;
    error: string | null;
}

// Corrected: Only 'veo-2.0-generate-001' is a valid model according to the guidelines.
export type VideoModel = 'veo-2.0-generate-001';

export type AppStep = 'input' | 'review' | 'generate' | 'finalize';