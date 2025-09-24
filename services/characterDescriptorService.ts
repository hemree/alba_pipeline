
import type { Character } from '../types';
import { authService } from './authService';

export async function generateCharacterDescription(
    character: Character
): Promise<string> {
    if (!character.imageBase64 || !character.imageFile) {
        throw new Error("Character image data is missing.");
    }

    // Ensure we have authentication
    const isAuthenticated = await authService.initializeAuth();
    if (!isAuthenticated) {
        throw new Error('Authentication failed. Please try again.');
    }

    try {
        const response = await fetch('/api/describeCharacter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: character.name,
                imageBase64: character.imageBase64,
                mimeType: character.imageFile.type,
            }),
        });

        if (!response.ok) {
            let errorMsg = `Request failed with status ${response.status}`;
            try {
                const errorJson = await response.json();
                errorMsg = errorJson.error || errorMsg;
            } catch (e) {
                const textError = await response.text();
                errorMsg = textError || errorMsg;
            }
            throw new Error(`${errorMsg}`);
        }

        const description = await response.text();
        if (!description) {
            throw new Error("The AI failed to generate a character description. The response was empty.");
        }
        return description;

    } catch (err) {
        console.error("Error calling /api/describeCharacter:", err);
        const message = err instanceof Error ? err.message : "An unknown API error occurred.";
        throw new Error(`Failed to connect to the character description service: ${message}`);
    }
}
