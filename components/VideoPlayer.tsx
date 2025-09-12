import React from 'react';
import type { Scene, VideoGenerationStatus } from '../types';
import Spinner from './Spinner';

interface VideoPlayerProps {
    scene: Scene;
    status: VideoGenerationStatus;
    sceneNumber: number;
}

const StatusIndicator: React.FC<{ status: VideoGenerationStatus['status'] }> = ({ status }) => {
    const statusMap = {
        pending: { text: "Pending...", color: "text-gray-500" },
        generating: { text: "Generating...", color: "text-blue-500" },
        polling: { text: "Finalizing video...", color: "text-yellow-500" },
        complete: { text: "Complete", color: "text-green-500" },
        error: { text: "Error", color: "text-red-500" },
    };
    const current = statusMap[status];

    return (
        <div className="flex items-center gap-2">
            <span className={`font-semibold ${current.color}`}>{current.text}</span>
            {(status === 'generating' || status === 'polling') && <Spinner size="sm"/>}
        </div>
    );
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ scene, status, sceneNumber }) => {
    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden flex flex-col">
            <div className="aspect-video bg-gray-100 flex items-center justify-center">
                {status.status === 'complete' && status.videoUrl ? (
                    <video controls src={status.videoUrl} className="w-full h-full object-cover" />
                ) : (
                    <div className="text-gray-600 text-center p-4">
                        <p>{scene.action}</p>
                    </div>
                )}
            </div>
            <div className="p-4 space-y-2">
                <h4 className="font-bold text-purple-500">Scene {sceneNumber}</h4>
                 <div className="text-sm text-gray-700">
                    <StatusIndicator status={status.status} />
                </div>
                 {status.status === 'error' && status.error && (
                    <p className="text-xs text-red-500 break-words">{status.error}</p>
                )}
            </div>
        </div>
    );
};

export default VideoPlayer;