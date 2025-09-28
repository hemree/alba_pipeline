// Server-side endpoint for story breakdown

export async function POST(request: Request) {

    try {
        const { story, characterDescriptions } = await request.json();

        const prompt = `
        Break down the following story into a sequence of distinct scenes, with a maximum of 50 scenes.
        Each scene should represent approximately 8 seconds of video.

        Requirements:
        1. Ensure continuity between scenes.
           - Mention how each scene connects to the previous one.
           - If a character appears again, use consistent naming and descriptions.
           - Keep environments visually consistent unless the story explicitly changes setting.
        2. Use ONLY the provided characters: [${characterDescriptions ? characterDescriptions.join(', ') : 'No specific characters provided'}].
        3. For each scene, return structured JSON with:
           - scene_description: one sentence summary.
           - characters: list of character names from the provided list.
           - environment: location, atmosphere, lighting, and mood (consistent across scenes).
           - action: concise description of the main action, with continuity note if needed.
        4. Always maintain style continuity for visuals (e.g., "Anime", "Comic book")
           and narrative genre tone (e.g., "Fantasy novel"), to be injected later.

        Return ONLY a valid JSON array of scenes. Each scene should have: scene_description, characters, environment, action.

        Story:
        ---
        ${story}
        ---
        `;

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
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const jsonText = jsonMatch ? jsonMatch[0] : text.trim();

        const scenes = JSON.parse(jsonText);
        const limitedScenes = scenes.slice(0, 50); // Ensure max 50 scenes

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
