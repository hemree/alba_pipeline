// Server-side endpoint for story breakdown

async function handleRequest(request: Request) {

    try {
        const { story, characterDescriptions } = await request.json();

        const prompt = `You are a professional video director. Break down the following story into a sequence of distinct scenes for video production. Create between 3-10 scenes, each representing approximately 8 seconds of video.

Available characters: ${characterDescriptions && characterDescriptions.length > 0 ? characterDescriptions.join(', ') : 'Create appropriate characters for the story'}

For each scene, provide:
- scene_description: A clear, one-sentence summary of what happens
- characters: Array of character names appearing in this scene
- environment: Detailed description of location, lighting, and atmosphere
- action: Specific description of the main action or movement

Story: "${story}"

You must return a valid JSON array with at least 3 scenes. Example:
[
  {
    "scene_description": "A brave knight prepares for battle in the castle courtyard",
    "characters": ["Knight"],
    "environment": "Medieval castle courtyard with stone walls, morning sunlight filtering through clouds",
    "action": "The knight adjusts armor and grips sword handle, looking determined"
  },
  {
    "scene_description": "The knight rides through a dark forest toward the dragon's lair",
    "characters": ["Knight"],
    "environment": "Dense, shadowy forest with twisted trees and dappled light",
    "action": "Knight on horseback navigating through the forest path, alert and cautious"
  }
]

Return only the JSON array:`;

        // Use API key on server-side (secure)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                }
            })
        });

        if (!response.ok) {
            const statusCode = response.status || 'unknown';
            throw new Error(`API request failed with status ${statusCode}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error("The AI returned an empty response. Please try modifying your story.");
        }

        // Extract JSON from the response (remove any markdown formatting)
        console.log("Raw AI response:", text);

        // Try multiple approaches to extract valid JSON
        let jsonText = '';
        let scenes = [];

        // First, try to find JSON array in the response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        } else {
            // If no array found, try to extract from code blocks
            const codeBlockMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            if (codeBlockMatch) {
                jsonText = codeBlockMatch[1];
            } else {
                jsonText = text.trim();
            }
        }

        console.log("Extracted JSON text:", jsonText);

        try {
            scenes = JSON.parse(jsonText);
        } catch (parseError) {
            console.error("JSON parse error:", parseError);
            console.error("Failed to parse JSON at position:", parseError.message);

            // Try to clean up common JSON issues
            let cleanedJson = jsonText
                .replace(/,\s*}/g, '}')  // Remove trailing commas before }
                .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
                .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Quote unquoted keys
                .replace(/:\s*'([^']*)'/g, ': "$1"')  // Replace single quotes with double quotes
                .replace(/\n/g, ' ')  // Remove newlines
                .replace(/\s+/g, ' ')  // Normalize whitespace
                .trim();

            console.log("Attempting to parse cleaned JSON:", cleanedJson);

            try {
                scenes = JSON.parse(cleanedJson);
            } catch (secondParseError) {
                console.error("Second JSON parse attempt failed:", secondParseError);
                throw new Error(`Invalid JSON response from AI. Parse error: ${parseError.message}. Raw response: ${text.substring(0, 500)}...`);
            }
        }

        // Validate the parsed scenes
        if (!Array.isArray(scenes)) {
            throw new Error("AI response is not a valid array of scenes");
        }

        // Validate each scene has required properties
        const validScenes = scenes.filter(scene => {
            return scene &&
                typeof scene.scene_description === 'string' &&
                Array.isArray(scene.characters) &&
                typeof scene.environment === 'string' &&
                typeof scene.action === 'string';
        });

        if (validScenes.length === 0) {
            throw new Error("No valid scenes found in AI response");
        }

        console.log(`Successfully parsed ${validScenes.length} valid scenes`);
        const limitedScenes = validScenes.slice(0, 50); // Ensure max 50 scenes

        return new Response(JSON.stringify(limitedScenes), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Story breakdown error:", error);
        const message = error instanceof Error ? error.message : "The API request failed.";
        return new Response(JSON.stringify({
            error: `Could not connect to the AI service: ${message}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function POST(request: Request) {
    return handleRequest(request);
}

export default async function handler(req: any, res: any) {
    try {
        const url = req.url?.startsWith('http') ? req.url : `http://localhost:3001${req.url || '/api/breakdownStory'}`;
        const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        const response = await handleRequest(request);
        if (!response) {
            res.status(500).json({ error: 'handleRequest returned undefined' });
            return;
        }

        // Store status before consuming the body
        const statusCode = response.status;
        const data = await response.text();

        if (!statusCode) {
            console.error('Response object missing status property');
            res.status(500).json({ error: 'Invalid response from handler' });
            return;
        }

        try {
            const jsonData = JSON.parse(data);
            res.status(statusCode).json(jsonData);
        } catch (parseError) {
            res.status(statusCode).send(data);
        }
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
