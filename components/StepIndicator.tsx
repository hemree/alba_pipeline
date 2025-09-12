import React from 'react';
import type { AppStep } from '../types';

interface StepIndicatorProps {
    currentStep: AppStep;
}

const steps: { id: AppStep; title: string }[] = [
    { id: 'input', title: '1. Input Story & Style' },
    { id: 'review', title: '2. Review Scenes' },
    { id: 'generate', title: '3. Generate Videos' },
    { id: 'finalize', title: '4. Final Movie' },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);

    return (
        <nav aria-label="Progress" className="mb-12">
            <ol role="list" className="flex items-center justify-center">
                {steps.map((step, stepIdx) => (
                    <li key={step.title} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
                        {stepIdx < currentIndex ? (
                            <>
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="h-0.5 w-full bg-purple-600" />
                                </div>
                                <div className="relative flex h-8 w-8 items-center justify-center bg-purple-600 rounded-full">
                                    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </>
                        ) : stepIdx === currentIndex ? (
                            <>
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="h-0.5 w-full bg-gray-300" />
                                </div>
                                <div className="relative flex h-8 w-8 items-center justify-center bg-white border-2 border-purple-600 rounded-full">
                                    <span className="h-2.5 w-2.5 bg-purple-600 rounded-full" aria-hidden="true" />
                                </div>
                                <span className="absolute -bottom-6 text-center w-max -translate-x-1/2 text-sm font-semibold text-purple-600">{step.title}</span>
                            </>
                        ) : (
                             <>
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="h-0.5 w-full bg-gray-300" />
                                </div>
                                <div className="group relative flex h-8 w-8 items-center justify-center bg-white border-2 border-gray-300 rounded-full">
                                </div>
                            </>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
};

export default StepIndicator;