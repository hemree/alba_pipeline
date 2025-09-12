import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SceneCard from './SceneCard';
import type { Scene } from '../types';

interface SortableSceneCardProps {
    scene: Scene;
    sceneNumber: number;
    onUpdate: (scene: Scene) => void;
    onDelete: () => void;
}

const SortableSceneCard: React.FC<SortableSceneCardProps> = (props) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: props.scene.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex-grow touch-none">
            <SceneCard {...props} />
        </div>
    );
};

export default SortableSceneCard;
