import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

import type { Character, Scene, VideoGenerationStatus, AppStep, VideoModel, TransitionType } from '../types';
import { breakdownStoryIntoScenes, generateVideoForScene, generateMusicDescriptionFromStory } from '../services/geminiService';
import { generateCharacterDescription } from '../services/characterDescriptorService';
import { stitchVideos } from '../services/videoStitchingService';
import type { GlobalBible } from '../services/continuityPromptBuilder';
import { googleAuth } from '../services/googleAuth';
import CharacterInput from './CharacterInput';
import VideoPlayer from './VideoPlayer';
import Spinner from './Spinner';
import StepIndicator from './StepIndicator';
import { PlusIcon } from './icons/PlusIcon';
import { FilmIcon } from './icons/FilmIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import SortableSceneCard from './SortableSceneCard';
import TransitionSelector from './TransitionSelector';

const visualStyleOptions = [
    'Anime',
    'Manga (black & white)',
    'Comic book (bold outlines, halftone dots)',
    'Pixar/Disney 3D animation',
    'Watercolor painting',
    'Oil painting / Fine art',
    'Stop motion / Claymation',
    'Noir (black-and-white, high contrast)',
    'Cyberpunk neon',
    'Photorealistic cinematic',
];

const narrativeGenreOptions = [
    'Fairy tale (children’s book illustration, pastel colors)',
    'Fantasy novel (epic, medieval, dragons, magic)',
    'Science fiction (space travel, futuristic cities)',
    'Horror / Gothic (dark atmosphere, shadows, unsettling)',
    'Superhero comic (dynamic, action-driven panels)',
    'Historical drama',
    'Romantic comedy',
    'Adventure / Quest',
];

const videoModelOptions = [
    {
        label: "Veo 3 + Audio (Best Quality)",
        value: "veo-3.0-generate-001",
        feature: "video-audio",
        price: "$0.40/sec",
        resolution: ["720p", "1080p"],
        description: "Highest quality with synchronized audio"
    },
    {
        label: "Veo 3 (Video Only)",
        value: "veo-3.0-generate-001",
        feature: "video-only",
        price: "$0.20/sec",
        resolution: ["720p", "1080p"],
        description: "High quality video without audio"
    },
    {
        label: "Veo 3 Fast + Audio (Balanced)",
        value: "veo-3.0-fast-generate-001",
        feature: "video-audio",
        price: "$0.15/sec",
        resolution: ["720p", "1080p"],
        description: "Fast generation with audio"
    },
    {
        label: "Veo 3 Fast (Video Only)",
        value: "veo-3.0-fast-generate-001",
        feature: "video-only",
        price: "$0.10/sec",
        resolution: ["720p", "1080p"],
        description: "Fastest and most economical"
    },
    {
        label: "Veo 2 (Legacy)",
        value: "veo-2.0-generate-001",
        feature: "video-only",
        price: "$0.50/sec",
        resolution: ["720p"],
        description: "Legacy model, 720p only"
    }
];

const VideoPipeline: React.FC = () => {
    const [step, setStep] = useState<AppStep>('input');
    const [story, setStory] = useState<string>('');
    const [characters, setCharacters] = useState<Character[]>([{ id: Date.now(), name: '', imageFile: null, imageBase64: null, lockedDescription: null }]);
    const [visualStyle, setVisualStyle] = useState<string>(visualStyleOptions[0]);
    const [narrativeGenre, setNarrativeGenre] = useState<string>(narrativeGenreOptions[0]);
    const [selectedVideoOption, setSelectedVideoOption] = useState(videoModelOptions[0]);
    const [resolution, setResolution] = useState<string>("720p");
    const [negativePrompt, setNegativePrompt] = useState<string>("");
    const [musicPrompt, setMusicPrompt] = useState<string>("");
    const [musicNegativePrompt, setMusicNegativePrompt] = useState<string>("");
    const [generateMusic, setGenerateMusic] = useState<boolean>(false);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [videoStatuses, setVideoStatuses] = useState<VideoGenerationStatus[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [generatingDescriptions, setGeneratingDescriptions] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isStitching, setIsStitching] = useState<boolean>(false);
    const [stitchingProgress, setStitchingProgress] = useState<number>(0);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);
    const [isGeneratingCharacter, setIsGeneratingCharacter] = useState<boolean>(false);
    const [characterInput, setCharacterInput] = useState<string>('');

    // Auto-generate music description from story
    useEffect(() => {
        const generateMusicDesc = async () => {
            if (story.trim() && generateMusic) {
                try {
                    const musicDesc = await generateMusicDescriptionFromStory(story);
                    setMusicPrompt(musicDesc);
                } catch (error) {
                    console.error('Error generating music description:', error);
                }
            }
        };

        const timeoutId = setTimeout(generateMusicDesc, 1000); // Debounce
        return () => clearTimeout(timeoutId);
    }, [story, generateMusic]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleAddCharacter = () => {
        setCharacters([...characters, { id: Date.now(), name: '', imageFile: null, imageBase64: null, lockedDescription: null }]);
    };

    const handleRemoveCharacter = (id: number) => {
        setCharacters(characters.filter((char: Character) => char.id !== id));
    };

    const handleCharacterChange = (id: number, updatedCharacter: Character) => {
        setCharacters(characters.map((char: Character) => {
            if (char.id === id) {
                // If image is changed, invalidate the old description so it gets regenerated.
                if (char.imageBase64 !== updatedCharacter.imageBase64) {
                    return { ...updatedCharacter, lockedDescription: null };
                }
                return updatedCharacter;
            }
            return char;
        }));
    };

    const handleGenerateStory = async () => {
        setIsGeneratingStory(true);
        setError(null);
        try {
            const characterNames = characters.filter((c: Character) => c.name.trim()).map((c: Character) => c.name.trim());

            const response = await fetch('/api/generateStory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    genre: narrativeGenre,
                    style: visualStyle,
                    theme: 'A compelling adventure with character development',
                    length: 'medium',
                    characters: characterNames.length > 0 ? characterNames : undefined
                })
            });

            if (!response.ok) {
                throw new Error(`Story generation failed: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            setStory(data.story);
        } catch (e) {
            console.error(e);
            setError('Failed to generate story. Please try again.');
        } finally {
            setIsGeneratingStory(false);
        }
    };

    const handleGenerateCharacter = async () => {
        setIsGeneratingCharacter(true);
        setError(null);
        try {
            const existingCharacterNames = characters.filter((c: Character) => c.name.trim()).map((c: Character) => c.name.trim());

            const response = await fetch('/api/generateCharacter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    genre: narrativeGenre,
                    style: visualStyle,
                    characterType: characterInput.trim() || 'protagonist, antagonist, or supporting character',
                    storyContext: story || 'An epic adventure with challenges and growth',
                    existingCharacters: existingCharacterNames.length > 0 ? existingCharacterNames : undefined
                })
            });

            if (!response.ok) {
                throw new Error(`Character generation failed: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            // Create new character with generated data
            const newCharacter: Character = {
                id: Date.now(),
                name: data.character.name,
                imageFile: null,
                imageBase64: data.character.imageBase64 || null,
                lockedDescription: `${data.character.description} - ${data.character.personality} - Role: ${data.character.role}`
            };

            // Add the generated character to the list
            setCharacters([...characters, newCharacter]);

            // Clear the input after successful generation
            setCharacterInput('');
        } catch (e) {
            console.error(e);
            setError('Failed to generate character. Please try again.');
        } finally {
            setIsGeneratingCharacter(false);
        }
    };

    const handleExtractAndGenerateCharacters = async () => {
        if (!story.trim()) {
            setError('Please generate a story first.');
            return;
        }

        setIsGeneratingCharacter(true);
        setError(null);

        try {
            // Step 1: Extract characters from story
            const extractResponse = await fetch('/api/extractCharacters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ story })
            });

            const extractData = await extractResponse.json();
            if (extractData.error) {
                throw new Error(extractData.error);
            }

            const extractedCharacters = extractData.characters || [];

            if (extractedCharacters.length === 0) {
                setError('No characters found in the story.');
                return;
            }

            // Step 2: Generate each character
            const newCharacters: Character[] = [];
            const existingCharacterNames = characters.filter((c: Character) => c.name.trim()).map((c: Character) => c.name.trim());

            for (const extractedChar of extractedCharacters) {
                // Skip if character already exists
                if (existingCharacterNames.includes(extractedChar.name)) {
                    continue;
                }

                try {
                    const response = await fetch('/api/generateCharacter', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            genre: narrativeGenre,
                            style: visualStyle,
                            characterType: extractedChar.characterType,
                            storyContext: story,
                            existingCharacters: [...existingCharacterNames, ...newCharacters.map(c => c.name)]
                        })
                    });

                    const data = await response.json();
                    if (data.error) {
                        console.error(`Failed to generate character ${extractedChar.name}:`, data.error);
                        continue;
                    }

                    // Create new character with generated data
                    const newCharacter: Character = {
                        id: Date.now() + Math.random(),
                        name: data.character.name,
                        imageFile: null,
                        imageBase64: data.character.imageBase64 || null,
                        lockedDescription: `${data.character.description} - ${data.character.personality} - Role: ${data.character.role}`
                    };

                    newCharacters.push(newCharacter);

                    // Small delay between generations to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (charError) {
                    console.error(`Error generating character ${extractedChar.name}:`, charError);
                }
            }

            // Add all generated characters to the list
            if (newCharacters.length > 0) {
                setCharacters([...characters, ...newCharacters]);
                setError(null);
            } else {
                setError('Failed to generate any characters from the story.');
            }

        } catch (e) {
            console.error(e);
            setError('Failed to extract and generate characters. Please try again.');
        } finally {
            setIsGeneratingCharacter(false);
        }
    };

    const handleStoryBreakdown = async () => {
        if (!story.trim()) {
            setError('Please enter a story.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const characterDescriptions = characters.filter((c: Character) => c.name).map((c: Character) => c.name);
            const generatedScenesData = await breakdownStoryIntoScenes(story, characterDescriptions);
            const generatedScenesWithIds = generatedScenesData.map((scene, index) => ({
                ...scene,
                id: Date.now() + index,
                transitionToNext: 'fade' as TransitionType, // Default transition
            }));
            setScenes(generatedScenesWithIds);
            setStep('review');
        } catch (e) {
            console.error(e);
            setError('Failed to break down the story. Please check the console for details.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateScene = (updatedScene: Scene) => {
        setScenes(scenes.map((scene: Scene) => scene.id === updatedScene.id ? updatedScene : scene));
    };

    const handleDeleteScene = (id: number) => {
        setScenes(scenes.filter((scene: Scene) => scene.id !== id));
    };

    const handleAddScene = () => {
        const newScene: Scene = {
            id: Date.now(),
            scene_description: 'New Scene',
            characters: [],
            environment: 'Describe the environment',
            action: 'Describe the action',
            transitionToNext: 'fade',
        };
        setScenes([...scenes, newScene]);
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setScenes((items: Scene[]) => {
                const oldIndex = items.findIndex((item: Scene) => item.id === active.id);
                const newIndex = items.findIndex((item: Scene) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleTransitionChange = (sceneId: number, transition: TransitionType) => {
        setScenes(scenes.map((scene: Scene) => scene.id === sceneId ? { ...scene, transitionToNext: transition } : scene));
    };

    const handleVideoGeneration = useCallback(async () => {
        if (scenes.length === 0) {
            setError('No scenes to generate videos for.');
            return;
        }
        setStep('generate');
        setError(null);

        // Step 1: Generate canonical character descriptions from images for consistency.
        setGeneratingDescriptions(true);
        let enrichedCharacters: Character[];
        try {
            enrichedCharacters = await Promise.all(
                characters.map(async (char: Character) => {
                    // Only generate if there's an image and no description has been locked yet.
                    if (char.imageBase64 && char.imageFile && !char.lockedDescription) {
                        const description = await generateCharacterDescription(char);
                        return { ...char, lockedDescription: description };
                    }
                    return char;
                })
            );
            setCharacters(enrichedCharacters); // Update state to cache the new descriptions
        } catch (e) {
            console.error("Failed to generate character descriptions:", e);
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during character description generation.";
            setError(`Failed to analyze character images: ${errorMessage}`);
            setGeneratingDescriptions(false);
            setStep('review'); // Go back to review step on failure
            return;
        } finally {
            setGeneratingDescriptions(false);
        }

        // Step 2: Proceed with video generation using the enriched character data.
        const initialStatuses: VideoGenerationStatus[] = scenes.map((scene: Scene, index: number) => ({
            sceneIndex: index,
            sceneId: scene.id,
            status: 'pending',
            videoUrl: null,
            error: null,
        }));
        setVideoStatuses(initialStatuses);

        // Create the Global Bible for continuity using enriched characters
        const uniqueEnvironments = [...new Set(scenes.map((s: Scene) => s.environment.trim()))]
            .map((env, index) => ({
                id: `env_${index + 1}`,
                description: String(env),
            }));

        const globalBible: GlobalBible = {
            characters: enrichedCharacters.filter(c => c.name.trim()),
            environments: uniqueEnvironments,
            style: visualStyle,
            genre: narrativeGenre,
        };

        const generatedVideos: { url: string; sceneId: number }[] = [];
        let generationFailed = false;

        for (let i = 0; i < scenes.length; i++) {
            const currentScene = scenes[i];
            setVideoStatuses((prev: VideoGenerationStatus[]) => prev.map((s: VideoGenerationStatus) => s.sceneId === currentScene.id ? { ...s, status: 'generating' } : s));
            try {
                const prevScene = i > 0 ? scenes[i - 1] : null;
                const videoUrl = await generateVideoForScene(currentScene, enrichedCharacters, globalBible, prevScene, (op) => {
                    if (!op.done) {
                        setVideoStatuses((prev: VideoGenerationStatus[]) => prev.map((s: VideoGenerationStatus) => s.sceneId === currentScene.id ? { ...s, status: 'polling' } : s));
                    }
                }, {
                    model: selectedVideoOption.value as VideoModel,
                    feature: selectedVideoOption.feature,
                    resolution: resolution,
                    negativePrompt: negativePrompt
                });
                setVideoStatuses((prev: VideoGenerationStatus[]) => prev.map((s: VideoGenerationStatus) => s.sceneId === currentScene.id ? { ...s, status: 'complete', videoUrl } : s));
                generatedVideos.push({ url: videoUrl, sceneId: currentScene.id });
            } catch (e) {
                console.error(`Failed to generate video for scene ${i + 1}:`, e);
                const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
                setVideoStatuses((prev: VideoGenerationStatus[]) => prev.map((s: VideoGenerationStatus) => s.sceneId === currentScene.id ? { ...s, status: 'error', error: errorMessage } : s));
                generationFailed = true;
                break; // Stop generation if one scene fails
            }
        }

        if (!generationFailed && generatedVideos.length > 0) {
            setIsStitching(true);
            setStitchingProgress(0);
            try {
                // Map generated URLs back to the current (potentially reordered) scene list
                const videosToStitch = scenes.map((scene: Scene) => {
                    const foundVideo = generatedVideos.find((v: any) => v.sceneId === scene.id);
                    return {
                        url: foundVideo!.url,
                        transition: scene.transitionToNext,
                    };
                }).filter((v: any) => v.url); // Ensure we only have videos with URLs

                const finalUrl = await stitchVideos(videosToStitch, (progress) => {
                    setStitchingProgress(progress);
                });
                setFinalVideoUrl(finalUrl);
                setStep('finalize');
            } catch (e) {
                console.error("Stitching failed:", e);
                setError("Failed to stitch videos into a final movie. Please check the console for details.");
            } finally {
                setIsStitching(false);
            }
        }

    }, [scenes, characters, visualStyle, narrativeGenre, selectedVideoOption]);

    const handleReset = () => {
        setStory('');
        setCharacters([{ id: Date.now(), name: '', imageFile: null, imageBase64: null, lockedDescription: null }]);
        setVisualStyle(visualStyleOptions[0]);
        setNarrativeGenre(narrativeGenreOptions[0]);
        setSelectedVideoOption(videoModelOptions[0]);
        setResolution("720p");
        setNegativePrompt("");
        setMusicPrompt("");
        setMusicNegativePrompt("");
        setGenerateMusic(false);
        setScenes([]);
        setVideoStatuses([]);
        setError(null);
        setIsStitching(false);
        setStitchingProgress(0);
        setFinalVideoUrl(null);
        setStep('input');
    };

    const isGenerating = generatingDescriptions || videoStatuses.some((s: VideoGenerationStatus) => ['generating', 'polling'].includes(s.status)) || isStitching;

    const handleLogout = () => {
        googleAuth.signOut();
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-[#FDFBF6] text-gray-800 flex flex-col items-center p-4 sm:p-8 font-sans">
            <div className="w-full max-w-6xl mx-auto">
                <header className="text-center mb-8 relative">
                    {/* Logout Button */}
                    <div className="absolute top-0 right-0">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                        >
                            Logout
                        </button>
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-600">
                        Alba Media Video Pipeline
                    </h1>
                    <p className="text-gray-600 mt-2">Turn your stories into animated films.</p>

                    {/* User Info */}
                    {googleAuth.getCurrentUser() && (
                        <p className="text-sm text-gray-500 mt-2">
                            Welcome, {googleAuth.getCurrentUser()?.email}
                        </p>
                    )}
                </header>

                <StepIndicator currentStep={step} />

                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>}

                {/* Step 1: Input */}
                {step === 'input' && (
                    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="story" className="text-lg font-semibold text-gray-700">Your Story</label>
                                <button
                                    onClick={handleGenerateStory}
                                    disabled={isGeneratingStory}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md text-sm"
                                >
                                    {isGeneratingStory ? (
                                        <div className="flex items-center space-x-2">
                                            <Spinner />
                                            <span>Generating...</span>
                                        </div>
                                    ) : (
                                        '✨ Generate Story'
                                    )}
                                </button>
                            </div>
                            <textarea
                                id="story"
                                value={story}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStory(e.target.value)}
                                placeholder="Paste your full book or story here, or click 'Generate Story' to create one automatically..."
                                className="w-full h-64 p-4 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-shadow"
                            />
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-3 text-gray-700">Characters</h3>

                            {/* Character Generation Section */}
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                                <button
                                    onClick={handleGenerateCharacter}
                                    disabled={isGeneratingCharacter}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                                >
                                    {isGeneratingCharacter ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Generating Character...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span>🎭</span>
                                            <span>Generate Character</span>
                                        </>
                                    )}
                                </button>

                                <input
                                    type="text"
                                    value={characterInput}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCharacterInput(e.target.value)}
                                    placeholder="Describe the character you want (e.g., 'brave knight', 'wise wizard', 'mysterious assassin')"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isGeneratingCharacter}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Leave empty for AI to decide based on your genre and style
                                </p>
                            </div>

                            {/* Extract Characters from Story Section */}
                            {story.trim() && (
                                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <button
                                        onClick={handleExtractAndGenerateCharacters}
                                        disabled={isGeneratingCharacter}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white hover:from-green-600 hover:to-blue-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isGeneratingCharacter ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>Extracting & Generating Characters...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <span>🔍</span>
                                                <span>Extract Characters from Story</span>
                                            </>
                                        )}
                                    </button>
                                    <p className="text-xs text-blue-600 mt-2">
                                        Automatically find all characters mentioned in your story and generate them with AI
                                    </p>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {characters.map((char: Character) => (
                                    <CharacterInput
                                        key={char.id}
                                        character={char}
                                        onChange={(updated: Character) => handleCharacterChange(char.id, updated)}
                                        onRemove={() => handleRemoveCharacter(char.id)}
                                        isRemovable={characters.length > 1}
                                    />
                                ))}
                            </div>
                            <button onClick={handleAddCharacter} className="mt-4 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors">
                                <PlusIcon />
                                Add Character
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label htmlFor="visual-style" className="block text-lg font-semibold mb-2 text-gray-700">Visual Style (Aesthetic)</label>
                                <div className="relative">
                                    <select
                                        id="visual-style"
                                        value={visualStyle}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVisualStyle(e.target.value)}
                                        className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-shadow appearance-none"
                                    >
                                        {visualStyleOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="narrative-genre" className="block text-lg font-semibold mb-2 text-gray-700">Narrative Genre (Tone)</label>
                                <div className="relative">
                                    <select
                                        id="narrative-genre"
                                        value={narrativeGenre}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNarrativeGenre(e.target.value)}
                                        className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-shadow appearance-none"
                                    >
                                        {narrativeGenreOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-2 lg:col-span-1">
                                <label htmlFor="video-model" className="block text-lg font-semibold mb-2 text-gray-700">Video Model & Features</label>
                                <div className="relative">
                                    <select
                                        id="video-model"
                                        value={`${selectedVideoOption.value}-${selectedVideoOption.feature}`}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                            const selectedOption = videoModelOptions.find(opt =>
                                                `${opt.value}-${opt.feature}` === e.target.value
                                            );
                                            if (selectedOption) {
                                                setSelectedVideoOption(selectedOption);
                                                // Reset resolution if not supported
                                                if (!selectedOption.resolution.includes(resolution)) {
                                                    setResolution(selectedOption.resolution[0]);
                                                }
                                            }
                                        }}
                                        className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-shadow appearance-none"
                                    >
                                        {videoModelOptions.map(opt => (
                                            <option key={`${opt.value}-${opt.feature}`} value={`${opt.value}-${opt.feature}`}>
                                                {opt.label} - {opt.price}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{selectedVideoOption.description}</p>
                            </div>

                            {/* Resolution Selection */}
                            <div className="md:col-span-1">
                                <label htmlFor="resolution" className="block text-lg font-semibold mb-2 text-gray-700">Resolution</label>
                                <div className="relative">
                                    <select
                                        id="resolution"
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value)}
                                        className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-shadow appearance-none"
                                    >
                                        {selectedVideoOption.resolution.map(res => (
                                            <option key={res} value={res}>{res}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Negative Prompt */}
                            <div className="md:col-span-2">
                                <label htmlFor="negative-prompt" className="block text-lg font-semibold mb-2 text-gray-700">Negative Prompt (Optional)</label>
                                <textarea
                                    id="negative-prompt"
                                    value={negativePrompt}
                                    onChange={(e) => setNegativePrompt(e.target.value)}
                                    placeholder="What you DON'T want in the video (e.g., blurry, low quality, distorted faces)"
                                    className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-shadow resize-none"
                                    rows={2}
                                />
                                <p className="text-xs text-gray-500 mt-1">Specify elements to avoid in the generated video</p>
                            </div>
                        </div>

                        {/* Music Generation Section */}
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
                                        <path fillRule="evenodd" d="M13.828 8.172a1 1 0 011.414 0A5.983 5.983 0 0117 12a5.983 5.983 0 01-1.758 3.828 1 1 0 11-1.414-1.414A3.987 3.987 0 0015 12a3.987 3.987 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">Background Music Generation</h3>
                                    <p className="text-sm text-gray-600">Generate AI music with Lyria 2 ($0.06 per 30 seconds)</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Enable Music Generation */}
                                <div className="md:col-span-2">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={generateMusic}
                                            onChange={(e) => setGenerateMusic(e.target.checked)}
                                            className="w-5 h-5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                                        />
                                        <span className="text-lg font-semibold text-gray-700">Generate background music for videos</span>
                                    </label>
                                </div>

                                {generateMusic && (
                                    <>
                                        {/* Auto-Generated Music Description */}
                                        <div className="md:col-span-2">
                                            <label htmlFor="music-prompt" className="block text-lg font-semibold mb-2 text-gray-700">Auto-Generated Music Description</label>
                                            <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg min-h-[80px] flex items-center">
                                                {musicPrompt ? (
                                                    <p className="text-gray-700 italic">"{musicPrompt}"</p>
                                                ) : (
                                                    <p className="text-gray-400 italic">Music description will be generated automatically from your story...</p>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Music description is automatically generated based on your story content</p>
                                        </div>

                                        {/* Music Negative Prompt */}
                                        <div className="md:col-span-2">
                                            <label htmlFor="music-negative-prompt" className="block text-lg font-semibold mb-2 text-gray-700">Music Negative Prompt (Optional)</label>
                                            <textarea
                                                id="music-negative-prompt"
                                                value={musicNegativePrompt}
                                                onChange={(e) => setMusicNegativePrompt(e.target.value)}
                                                placeholder="What you DON'T want in the music (e.g., 'vocals, drums, slow tempo')"
                                                className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-shadow resize-none"
                                                rows={2}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Specify musical elements to avoid</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="text-center">
                            <button onClick={handleStoryBreakdown} disabled={isLoading} className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg">
                                {isLoading ? <Spinner /> : 'Analyze Story & Create Scenes'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Review Scenes - Timeline Editor */}
                {step === 'review' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-3xl font-bold text-center">Review & Arrange Timeline</h2>
                        <div className="text-center mb-4">
                            <button onClick={handleAddScene} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors mx-auto shadow-sm">
                                <PlusIcon />
                                Add Scene
                            </button>
                        </div>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={scenes.map((s: Scene) => s.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-4">
                                    {scenes.map((scene: Scene, index: number) => (
                                        <div key={scene.id} className="flex items-center w-full">
                                            <SortableSceneCard
                                                scene={scene}
                                                sceneNumber={index + 1}
                                                onUpdate={handleUpdateScene}
                                                onDelete={() => handleDeleteScene(scene.id)}
                                            />
                                            {index < scenes.length - 1 && (
                                                <TransitionSelector
                                                    value={scene.transitionToNext}
                                                    onChange={(newTransition: TransitionType) => handleTransitionChange(scene.id, newTransition)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                        <div className="flex justify-center gap-4 mt-8">
                            <button onClick={() => setStep('input')} className="px-6 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded-lg transition-colors">Back to Edit</button>
                            <button onClick={handleVideoGeneration} disabled={scenes.length === 0} className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                <FilmIcon />
                                Generate All Videos
                            </button>
                        </div>
                    </div>
                )}


                {/* Step 3: Generate Videos */}
                {step === 'generate' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-3xl font-bold text-center">Video Generation</h2>

                        {generatingDescriptions && (
                            <div className="text-center p-4 bg-purple-100 rounded-lg border border-purple-200 shadow-sm">
                                <p className="font-semibold text-purple-700 flex items-center justify-center gap-2">
                                    <Spinner size="sm" />
                                    Analyzing character reference images with AI to lock appearance...
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {scenes.map((scene: Scene, index: number) => {
                                const status = videoStatuses.find((s: VideoGenerationStatus) => s.sceneId === scene.id);
                                return status ? <VideoPlayer key={scene.id} scene={scene} status={status} sceneNumber={index + 1} /> : null;
                            })}
                        </div>
                        {isStitching && (
                            <div className="mt-8 text-center p-6 bg-white rounded-lg shadow-md border border-gray-200">
                                <h3 className="text-2xl font-bold text-purple-600 mb-4">Stitching Your Masterpiece...</h3>
                                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-300" style={{ width: `${stitchingProgress * 100}%` }}></div>
                                </div>
                                <p className="mt-2 text-gray-600">{Math.round(stitchingProgress * 100)}% Complete</p>
                                <p className="text-sm text-gray-500 mt-1">Applying transitions and finalizing the movie.</p>
                            </div>
                        )}
                        <div className="text-center mt-8">
                            {!isGenerating && (
                                <button onClick={handleReset} className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors">
                                    Start Over
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 4: Final Movie */}
                {step === 'finalize' && (
                    <div className="space-y-6 animate-fade-in text-center">
                        <h2 className="text-3xl font-bold">Your Film is Ready!</h2>
                        <div className="max-w-3xl mx-auto bg-black rounded-lg shadow-2xl overflow-hidden border-4 border-gray-300">
                            {finalVideoUrl ? (
                                <video controls src={finalVideoUrl} className="w-full aspect-video" />
                            ) : (
                                <div className="w-full aspect-video bg-gray-200 flex items-center justify-center">
                                    <p className="text-gray-500">Preparing final video...</p>
                                </div>
                            )}
                        </div>
                        <div className="text-sm text-gray-500">
                            <p><strong>Number of Scenes:</strong> {scenes.length}</p>
                        </div>
                        <div className="flex justify-center flex-wrap gap-4 mt-4">
                            {finalVideoUrl && (
                                <a
                                    href={finalVideoUrl}
                                    download="final_movie.mp4"
                                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-blue-600 transition-all shadow-lg flex items-center gap-2"
                                >
                                    <DownloadIcon />
                                    Download Final Movie
                                </a>
                            )}
                            <button onClick={handleReset} className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors">
                                Start Over
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoPipeline;