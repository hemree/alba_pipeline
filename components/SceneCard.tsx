
import React, { useState, useEffect } from 'react';
import type { Scene } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';

interface SceneCardProps {
    scene: Scene;
    sceneNumber: number;
    onUpdate: (scene: Scene) => void;
    onDelete: () => void;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, sceneNumber, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editableScene, setEditableScene] = useState<Scene>(scene);

    useEffect(() => {
        setEditableScene(scene);
    }, [scene]);

    const handleSave = () => {
        onUpdate(editableScene);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditableScene(scene); // Revert changes
        setIsEditing(false);
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'characters') {
            setEditableScene({ ...editableScene, characters: value.split(',').map(s => s.trim()).filter(Boolean) });
        } else {
            setEditableScene({ ...editableScene, [name]: value });
        }
    };

    if (isEditing) {
        return (
            <div className="bg-white p-4 rounded-lg border-2 border-purple-500 shadow-lg space-y-3 flex flex-col h-full">
                <h3 className="text-xl font-bold text-purple-500">Editing Scene {sceneNumber}</h3>
                <div className="space-y-2 flex-grow flex flex-col">
                    <label className="text-xs font-semibold text-gray-600">Description</label>
                    <input 
                        name="scene_description" 
                        value={editableScene.scene_description}
                        onChange={handleChange}
                        className="w-full p-2 text-sm bg-gray-50 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                     <label className="text-xs font-semibold text-gray-600">Action</label>
                    <textarea 
                        name="action" 
                        value={editableScene.action}
                        onChange={handleChange}
                        rows={3}
                        className="w-full p-2 text-sm bg-gray-50 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                     <label className="text-xs font-semibold text-gray-600">Environment</label>
                    <textarea 
                        name="environment" 
                        value={editableScene.environment}
                        onChange={handleChange}
                        rows={3}
                        className="w-full p-2 text-sm bg-gray-50 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                     <label className="text-xs font-semibold text-gray-600">Characters (comma-separated)</label>
                    <input 
                        name="characters" 
                        value={editableScene.characters.join(', ')}
                        onChange={handleChange}
                        className="w-full p-2 text-sm bg-gray-50 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                    <button onClick={handleCancel} className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors">Save</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-md space-y-3 h-full flex flex-col">
            <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-purple-500">Scene {sceneNumber}</h3>
                <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setIsEditing(true)} className="p-1 text-gray-500 hover:text-blue-500 rounded-full hover:bg-gray-100 transition-colors" aria-label="Edit scene">
                       <PencilIcon />
                    </button>
                    <button onClick={onDelete} className="p-1 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors" aria-label="Delete scene">
                        <TrashIcon />
                    </button>
                </div>
            </div>

            <p className="text-sm font-semibold text-gray-800 break-words">{scene.scene_description}</p>
            <div className="text-xs text-gray-600 space-y-2 flex-grow">
                <p><strong className="text-gray-700 font-medium">Action:</strong> {scene.action}</p>
                <p><strong className="text-gray-700 font-medium">Environment:</strong> {scene.environment}</p>
                {scene.characters.length > 0 && (
                     <p><strong className="text-gray-700 font-medium">Characters:</strong> {scene.characters.join(', ')}</p>
                )}
            </div>
        </div>
    );
};

export default SceneCard;