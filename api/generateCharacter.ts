// Server-side endpoint for character generation
// Optimized for Node.js 22.x with modern JavaScript features
import { GoogleGenAI } from "@google/genai";

interface GenerateCharacterRequest {
    genre?: string;
    style?: string;
    characterType?: string;
    storyContext?: string;
    existingCharacters?: string[];
}

interface GeneratedCharacter {
    name: string;
    description: string;
    personality: string;
    role: string;
    imageBase64?: string;
    imagePrompt: string;
}

export default async function handler(req: any, res: any) {
    try {
        // Convert Vercel format to our format
        const url = req.url?.startsWith('http') ? req.url : `http://localhost:3001${req.url || '/api/generateCharacter'}`;
        const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        const response = await handleRequest(request);
        if (!response) {
            throw new Error('handleRequest returned undefined');
        }

        const data = await response.text();
        res.status(response.status).json(JSON.parse(data));
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}

async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { genre, style, characterType, storyContext, existingCharacters } = await request.json() as GenerateCharacterRequest;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        // Step 1: Generate character description
        const existingCharsText = existingCharacters && existingCharacters.length > 0
            ? `Existing characters in the story: ${existingCharacters.join(', ')}. Make sure this new character is unique and complements them.`
            : 'This is the first character in the story.';

        const storyContextText = storyContext
            ? `\n\nStory Context: ${storyContext.substring(0, 800)}\n\nCreate a character that fits this story.`
            : '';

        const characterPrompt = `Create a character for a ${genre || 'adventure'} story.${storyContextText}

${existingCharsText}

Return JSON format:
{
  "name": "Character Name",
  "description": "Physical description",
  "personality": "Key traits",
  "role": "protagonist/antagonist/supporting",
  "imagePrompt": "Visual description for image generation"
}

Create a unique character:`;

        // Generate character description
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: characterPrompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Character description API request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log('Character API Response:', JSON.stringify(data, null, 2));

        const characterText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!characterText || !characterText.trim()) {
            console.error('Empty character response. Full data:', data);
            throw new Error("AI model returned empty character description");
        }

        // Parse JSON from the response
        let characterData: GeneratedCharacter;
        try {
            // Extract JSON from the response (remove any markdown formatting)
            const jsonMatch = characterText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in character response");
            }
            characterData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            // Fallback: create character data from text
            console.warn("Failed to parse JSON, creating fallback character");
            characterData = {
                name: "Generated Character",
                description: characterText.substring(0, 200),
                personality: "Brave, determined, loyal",
                role: "protagonist",
                imagePrompt: `A ${characterType || 'heroic'} character in ${style || 'cinematic'} style`
            };
        }

        // Step 2: Generate character image using Imagen
        try {
            const ai = new GoogleGenAI({
                apiKey: apiKey
            });

            const imagePrompt = `${characterData.imagePrompt}, ${style || 'cinematic'} style, high quality, detailed character portrait, ${genre || 'adventure'} theme`;

            const imageResponse = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: imagePrompt,
                config: {
                    numberOfImages: 1,
                }
            });

            if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
                const generatedImage = imageResponse.generatedImages[0];
                characterData.imageBase64 = `data:image/png;base64,${generatedImage.image.imageBytes}`;
            }
        } catch (imageError) {
            console.warn("Image generation failed:", imageError);
            // Continue without image - user can upload their own
        }

        // Return the generated character
        return new Response(JSON.stringify({
            character: characterData,
            metadata: {
                genre: genre || 'adventure',
                style: style || 'cinematic',
                characterType: characterType || 'protagonist'
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error) {
        console.error("Character generation error:", error);
        const message = error instanceof Error ? error.message : "Character generation failed";
        return new Response(JSON.stringify({
            error: message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
