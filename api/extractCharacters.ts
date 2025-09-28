// No imports needed for direct API calls

async function handleRequest(request: Request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { story } = await request.json();

        if (!story) {
            return new Response(JSON.stringify({ error: 'Story is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        const prompt = `Analyze the following story and extract all the character names mentioned.
For each character, provide their name and a brief description of their role in the story.

Story: ${story}

Return the result as a JSON array in this exact format:
[
  {
    "name": "Character Name",
    "role": "brief description of their role",
    "characterType": "protagonist" | "antagonist" | "supporting character"
  }
]

Only include actual characters with names, not generic references like "the villagers" or "people".
If no named characters are found, return an empty array.`;

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
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Try to extract JSON from the response
        let characters;
        try {
            // Look for JSON array in the response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                characters = JSON.parse(jsonMatch[0]);
            } else {
                characters = [];
            }
        } catch (parseError) {
            console.error('Failed to parse character extraction response:', parseError);
            characters = [];
        }

        // Validate the structure
        if (!Array.isArray(characters)) {
            characters = [];
        }

        // Ensure each character has required fields
        characters = characters.filter(char =>
            char &&
            typeof char.name === 'string' &&
            char.name.trim().length > 0
        ).map(char => ({
            name: char.name.trim(),
            role: char.role || 'Unknown role',
            characterType: ['protagonist', 'antagonist', 'supporting character'].includes(char.characterType)
                ? char.characterType
                : 'supporting character'
        }));

        return new Response(JSON.stringify({ characters }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Character extraction error:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Character extraction failed'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export default async function handler(req: any, res: any) {
    try {
        // Convert Vercel format to our format
        const url = req.url?.startsWith('http') ? req.url : `http://localhost:3001${req.url || '/api/extractCharacters'}`;
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
