import React from 'react';
import type { Character } from '../types';
import { TrashIcon } from './icons/TrashIcon';

interface CharacterInputProps {
    character: Character;
    onChange: (character: Character) => void;
    onRemove: () => void;
    isRemovable: boolean;
}

const CharacterInput: React.FC<CharacterInputProps> = ({ character, onChange, onRemove, isRemovable }) => {

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                onChange({ ...character, imageFile: file, imageBase64: base64String });
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...character, name: e.target.value });
    };

    const imagePreview = character.imageFile ? URL.createObjectURL(character.imageFile) : null;

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
            <label htmlFor={`image-upload-${character.id}`} className="cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden border-2 border-dashed border-gray-300 hover:border-purple-500 transition-colors">
                    {imagePreview ? (
                        <img src={imagePreview} alt="Character preview" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs text-center">Upload Image</span>
                    )}
                </div>
                <input id={`image-upload-${character.id}`} type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleImageChange} />
            </label>
            <div className="flex-1 w-full">
                <input
                    type="text"
                    value={character.name}
                    onChange={handleNameChange}
                    placeholder="e.g., Anna – 10 year old girl, red dress"
                    className="w-full p-2 bg-gray-50 border border-gray-300 text-gray-800 rounded-md focus:ring-1 focus:ring-purple-500 focus:outline-none transition-shadow"
                />
            </div>
            {isRemovable && (
                <button onClick={onRemove} className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100">
                    <TrashIcon />
                </button>
            )}
        </div>
    );
};

export default CharacterInput;