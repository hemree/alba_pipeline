import React from 'react';
import { TransitionType } from '../types';
import { ArrowRightIcon } from './icons/ArrowRightIcon';

interface TransitionSelectorProps {
    value: TransitionType;
    onChange: (transition: TransitionType) => void;
}

const transitionOptions: { value: TransitionType; label: string }[] = [
    { value: 'fade', label: 'Fade' },
    { value: 'dissolve', label: 'Dissolve' },
    { value: 'wipeleft', label: 'Wipe Left' },
    { value: 'wiperight', label: 'Wipe Right' },
    { value: 'circleopen', label: 'Circle Open' },
];

const TransitionSelector: React.FC<TransitionSelectorProps> = ({ value, onChange }) => {
    return (
        <div className="flex-shrink-0 flex flex-col items-center justify-center px-4" aria-label="Scene transition selector">
            <ArrowRightIcon />
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as TransitionType)}
                className="mt-1 text-xs text-center bg-transparent border-0 rounded-md focus:ring-1 focus:ring-purple-500 focus:outline-none cursor-pointer"
            >
                {transitionOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
};

export default TransitionSelector;
