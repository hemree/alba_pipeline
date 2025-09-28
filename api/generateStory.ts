// Server-side endpoint for story generation

interface GenerateStoryRequest {
    genre?: string;
    style?: string;
    theme?: string;
    length?: 'short' | 'medium' | 'long';
    characters?: string[];
}

export default async function handler(req: any, res: any) {
    // Convert Vercel format to our format
    const request = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const response = await handleRequest(request);
    const data = await response.text();

    res.status(response.status).json(JSON.parse(data));
}

async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { genre, style, theme, length = 'medium', characters } = await request.json() as GenerateStoryRequest;

        // Use new Google GenAI SDK for story generation
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }



        // Build the story generation prompt
        const lengthGuide = {
            short: '3-4 paragraphs, suitable for 3-5 scenes',
            medium: '5-7 paragraphs, suitable for 6-10 scenes',
            long: '8-12 paragraphs, suitable for 10-15 scenes'
        };

        const characterPrompt = characters && characters.length > 0
            ? `The story should feature these characters: ${characters.join(', ')}.`
            : 'Create compelling characters that fit the story.';

        const prompt = `Generate an engaging ${genre || 'adventure'} story with a ${style || 'cinematic'} visual style.

${characterPrompt}

Story requirements:
- Length: ${lengthGuide[length]}
- Theme: ${theme || 'A hero\'s journey with challenges and growth'}
- Visual style: ${style || 'Cinematic and dramatic'}
- Genre: ${genre || 'Adventure'}

The story should be:
- Visually rich and descriptive
- Suitable for video adaptation
- Have clear scenes and action sequences
- Include character development
- Have a satisfying beginning, middle, and end

Please write a complete story that flows naturally and would work well when broken down into individual video scenes. Focus on visual storytelling and dramatic moments.

Story:`;

        // Use direct API call instead of SDK for better compatibility
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const generatedStory = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedStory || !generatedStory.trim()) {
            throw new Error("AI model returned an empty story");
        }

        // Return the generated story
        return new Response(JSON.stringify({
            story: generatedStory.trim(),
            metadata: {
                genre: genre || 'adventure',
                style: style || 'cinematic',
                theme: theme || 'A hero\'s journey',
                length: length,
                characters: characters || []
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error) {
        console.error("Story generation error:", error);
        const message = error instanceof Error ? error.message : "Story generation failed";
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
