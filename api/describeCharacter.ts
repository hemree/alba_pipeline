// This file represents a server-side function and should be deployed
// in a serverless environment (e.g., Vercel, Netlify, Cloud Functions).
// It is not part of the client-side bundle.

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Using direct API calls to Gemini

interface DescribeCharacterBody {
    name: string;
    imageBase64: string;
    mimeType: string;
}

// This function simulates a serverless function handler.
export default async function handler(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { name, imageBase64, mimeType } = await request.json() as DescribeCharacterBody;

        if (!name || !imageBase64 || !mimeType) {
            return new Response(JSON.stringify({ error: 'Missing name, imageBase64, or mimeType in request body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        const prompt = `
You are an expert visual descriptor for animation continuity.
Analyze the character image and generate a precise, canonical description.

STRICT RULES:
- Lock hairstyle, hair color, eye color, clothing, props, and body proportions.
- Include outfit details, accessories, and distinctive traits.
- Use definitive language (MUST, ALWAYS) to enforce design lock.
- Do not invent lore, just describe visual appearance.
- This description will be reused for ALL scenes to keep consistency.

Return one paragraph only.
Character Name: ${name}
`;

        // Call the Gemini API with multimodal input
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: imageBase64.split(',')[1] // Remove data:image/jpeg;base64, prefix
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text.trim()) {
            // Corrected: Updated error message for Gemini.
            throw new Error("Gemini model returned an empty description.");
        }

        return new Response(text.trim(), {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });

    } catch (err) {
        console.error("Error in /api/describeCharacter handler:", err);
        const message = err instanceof Error ? err.message : "An unknown error occurred.";
        return new Response(JSON.stringify({ error: `Server error: ${message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
