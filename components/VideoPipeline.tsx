
import React, { useState, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

import type { Character, Scene, VideoGenerationStatus, AppStep, VideoModel, TransitionType } from '../types';
import { breakdownStoryIntoScenes, generateVideoForScene } from '../services/geminiService';
import { generateCharacterDescription } from '../services/characterDescriptorService';
import { stitchVideos } from '../services/videoStitchingService';
import type { GlobalBible } from '../services/continuityPromptBuilder';
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

// Corrected: Use only the approved video model as per guidelines.
const videoModelOptions: { label: string; value: VideoModel }[] = [
    { label: "Veo 2", value: "veo-2.0-generate-001" },
];

const VideoPipeline: React.FC = () => {
    const [step, setStep] = useState<AppStep>('input');
    const [story, setStory] = useState<string>('');
    const [characters, setCharacters] = useState<Character[]>([{ id: Date.now(), name: '', imageFile: null, imageBase64: null, lockedDescription: null }]);
    const [visualStyle, setVisualStyle] = useState<string>(visualStyleOptions[0]);
    const [narrativeGenre, setNarrativeGenre] = useState<string>(narrativeGenreOptions[0]);
    // Corrected: Initialize videoModel with the only available option and remove setter as it's constant.
    const [videoModel] = useState<VideoModel>(videoModelOptions[0].value);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [videoStatuses, setVideoStatuses] = useState<VideoGenerationStatus[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [generatingDescriptions, setGeneratingDescriptions] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isStitching, setIsStitching] = useState<boolean>(false);
    const [stitchingProgress, setStitchingProgress] = useState<number>(0);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

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
        setCharacters(characters.filter(char => char.id !== id));
    };

    const handleCharacterChange = (id: number, updatedCharacter: Character) => {
        setCharacters(characters.map(char => {
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

    const handleStoryBreakdown = async () => {
        if (!story.trim()) {
            setError('Please enter a story.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const characterDescriptions = characters.filter(c => c.name).map(c => c.name);
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
        setScenes(scenes.map(scene => scene.id === updatedScene.id ? updatedScene : scene));
    };

    const handleDeleteScene = (id: number) => {
        setScenes(scenes.filter(scene => scene.id !== id));
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
            setScenes((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };
    
    const handleTransitionChange = (sceneId: number, transition: TransitionType) => {
        setScenes(scenes.map(scene => scene.id === sceneId ? { ...scene, transitionToNext: transition } : scene));
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
                characters.map(async (char) => {
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
        const initialStatuses: VideoGenerationStatus[] = scenes.map((scene, index) => ({
            sceneIndex: index,
            sceneId: scene.id,
            status: 'pending',
            videoUrl: null,
            error: null,
        }));
        setVideoStatuses(initialStatuses);
        
        // Create the Global Bible for continuity using enriched characters
        const uniqueEnvironments = [...new Set(scenes.map(s => s.environment.trim()))]
            .map((env, index) => ({
                id: `env_${index + 1}`,
                description: env,
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
            setVideoStatuses(prev => prev.map(s => s.sceneId === currentScene.id ? { ...s, status: 'generating' } : s));
            try {
                const prevScene = i > 0 ? scenes[i - 1] : null;
                const videoUrl = await generateVideoForScene(currentScene, enrichedCharacters, globalBible, prevScene, (op) => {
                    if (!op.done) {
                        setVideoStatuses(prev => prev.map(s => s.sceneId === currentScene.id ? { ...s, status: 'polling' } : s));
                    }
                }, videoModel);
                setVideoStatuses(prev => prev.map(s => s.sceneId === currentScene.id ? { ...s, status: 'complete', videoUrl } : s));
                generatedVideos.push({ url: videoUrl, sceneId: currentScene.id });
            } catch (e) {
                console.error(`Failed to generate video for scene ${i + 1}:`, e);
                const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
                setVideoStatuses(prev => prev.map(s => s.sceneId === currentScene.id ? { ...s, status: 'error', error: errorMessage } : s));
                generationFailed = true;
                break; // Stop generation if one scene fails
            }
        }

        if (!generationFailed && generatedVideos.length > 0) {
            setIsStitching(true);
            setStitchingProgress(0);
            try {
                // Map generated URLs back to the current (potentially reordered) scene list
                const videosToStitch = scenes.map(scene => {
                    const foundVideo = generatedVideos.find(v => v.sceneId === scene.id);
                    return {
                        url: foundVideo!.url,
                        transition: scene.transitionToNext,
                    };
                }).filter(v => v.url); // Ensure we only have videos with URLs

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

    }, [scenes, characters, visualStyle, narrativeGenre, videoModel]);

    const handleReset = () => {
        setStory('');
        setCharacters([{ id: Date.now(), name: '', imageFile: null, imageBase64: null, lockedDescription: null }]);
        setVisualStyle(visualStyleOptions[0]);
        setNarrativeGenre(narrativeGenreOptions[0]);
        // No need to reset videoModel as it's constant now.
        setScenes([]);
        setVideoStatuses([]);
        setError(null);
        setIsStitching(false);
        setStitchingProgress(0);
        setFinalVideoUrl(null);
        setStep('input');
    };

    const isGenerating = generatingDescriptions || videoStatuses.some(s => ['generating', 'polling'].includes(s.status)) || isStitching;

    return (
        <div className="min-h-screen bg-[#FDFBF6] text-gray-800 flex flex-col items-center p-4 sm:p-8 font-sans">
            <div className="w-full max-w-6xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-600">
                        Alba Media Video Pipeline
                    </h1>
                    <p className="text-gray-600 mt-2">Turn your stories into animated films.</p>
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
                            <label htmlFor="story" className="block text-lg font-semibold mb-2 text-gray-700">Your Story</label>
                            <textarea
                                id="story"
                                value={story}
                                onChange={(e) => setStory(e.target.value)}
                                placeholder="Paste your full book or story here..."
                                className="w-full h-64 p-4 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-shadow"
                            />
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-700">Characters</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {characters.map((char) => (
                                    <CharacterInput
                                        key={char.id}
                                        character={char}
                                        onChange={(updated) => handleCharacterChange(char.id, updated)}
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
                                        onChange={(e) => setVisualStyle(e.target.value)}
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
                                        onChange={(e) => setNarrativeGenre(e.target.value)}
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
                            {/* Corrected: Replaced dropdown with a disabled input for better UX as there is only one model option. */}
                            <div className="md:col-span-2 lg:col-span-1">
                                <label htmlFor="video-model" className="block text-lg font-semibold mb-2 text-gray-700">Video Model</label>
                                <input
                                    id="video-model"
                                    type="text"
                                    value="Veo 2"
                                    disabled
                                    className="w-full p-3 bg-gray-100 border border-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                                />
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
                            <SortableContext items={scenes.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-4">
                                    {scenes.map((scene, index) => (
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
                                                    onChange={(newTransition) => handleTransitionChange(scene.id, newTransition)}
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
                            {scenes.map((scene, index) => {
                                const status = videoStatuses.find(s => s.sceneId === scene.id);
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
