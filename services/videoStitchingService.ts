// Note: FFmpeg and util are dynamically imported in loadFFmpeg to prevent app load failures.

import { TransitionType } from "../types";

let ffmpeg: any | null = null;

const loadFFmpeg = async (): Promise<any> => {
    if (ffmpeg) return ffmpeg;
    
    // Dynamically import modules to defer loading until needed.
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
};

const getFileDataFromBlobUrl = async (url: string): Promise<Uint8Array> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch blob data from ${url}. Status: ${response.status}`);
    }
    const blob = await response.blob();
    return new Uint8Array(await blob.arrayBuffer());
};

interface VideoToStitch {
    url: string;
    transition: TransitionType;
}

const transitionToFfmpegFilter: Record<TransitionType, string> = {
    fade: 'fade',
    dissolve: 'dissolve',
    wipeleft: 'wipeleft',
    wiperight: 'wiperight',
    circleopen: 'circleopen',
};

export const stitchVideos = async (
    videos: VideoToStitch[],
    onProgress: (progress: number) => void
): Promise<string> => {
    try {
        const ffmpegInstance = await loadFFmpeg();

        ffmpegInstance.on('progress', ({ progress }) => {
            onProgress(Math.min(1, progress));
        });

        for (let i = 0; i < videos.length; i++) {
            const fileName = `scene${i}.mp4`;
            const fileData = await getFileDataFromBlobUrl(videos[i].url);
            await ffmpegInstance.writeFile(fileName, fileData);
        }
        
        if (videos.length === 1) {
            const fileData = await ffmpegInstance.readFile('scene0.mp4');
            return URL.createObjectURL(new Blob([fileData as Uint8Array], { type: 'video/mp4' }));
        }
        
        const inputs = videos.map((_, i) => `-i scene${i}.mp4`);
        
        const clipDurationBeforeTransition = 7; 
        const transitionDuration = 1;

        let filterGraph = '';
        let lastVideoOutput = '0:v';
        let lastAudioOutput = '0:a';

        for (let i = 1; i < videos.length; i++) {
            const currentVideoInput = `${i}:v`;
            const currentAudioInput = `${i}:a`;
            const newVideoOutput = `v${i}`;
            const newAudioOutput = `a${i}`;
            
            const offset = i * clipDurationBeforeTransition;
            const transitionFilter = transitionToFfmpegFilter[videos[i-1].transition] || 'fade';

            filterGraph += `[${lastVideoOutput}][${currentVideoInput}]xfade=transition=${transitionFilter}:duration=${transitionDuration}:offset=${offset}[${newVideoOutput}];`;
            filterGraph += `[${lastAudioOutput}][${currentAudioInput}]acrossfade=d=${transitionDuration}[${newAudioOutput}];`;
            
            lastVideoOutput = newVideoOutput;
            lastAudioOutput = newAudioOutput;
        }

        const command = [
            ...inputs,
            '-filter_complex',
            filterGraph,
            '-map', `[${lastVideoOutput}]`,
            '-map', `[${lastAudioOutput}]`,
            '-vsync', '2',
            'final_movie.mp4'
        ];
        
        await ffmpegInstance.exec(command);
        
        const data = await ffmpegInstance.readFile('final_movie.mp4');

        for (let i = 0; i < videos.length; i++) {
            await ffmpegInstance.deleteFile(`scene${i}.mp4`);
        }

        return URL.createObjectURL(new Blob([data as Uint8Array], { type: 'video/mp4' }));

    } catch (err) {
        console.error("Video stitching process failed:", err);
        const message = err instanceof Error ? err.message : "An unknown issue occurred.";
        throw new Error(`Failed to create the final movie. Technical details: ${message}`);
    }
};