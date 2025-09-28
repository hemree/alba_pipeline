// This file represents a server-side function and should be deployed
// in a serverless environment (e.g., Vercel, Netlify, Cloud Functions).
// It is not part of the client-side bundle.

interface ContinuityRequestBody {
  scene?: any;
  globalBible?: any;
  prevScene?: any;
  characters?: any[];
  environments?: string[];
  style?: string;
  genre?: string;
}

// This function simulates a serverless function handler.
export default async function handler(req: any, res: any) {
  try {
    // Convert Vercel format to our format
    const url = req.url?.startsWith('http') ? req.url : `http://localhost:3001${req.url || '/api/continuity'}`;
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
    const { scene, globalBible, prevScene, characters = [], environments = [], style = 'cinematic', genre = 'adventure' } = await request.json() as ContinuityRequestBody;

    // Get Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build comprehensive continuity analysis prompt
    const characterBible = characters && Array.isArray(characters)
      ? characters.map(
        (c: any) => `- **${c.name || 'Unknown'}**: ${c.lockedDescription || c.description || 'No description provided'}`
      ).join("\n")
      : "No character descriptions available";

    const environmentBible = environments && Array.isArray(environments)
      ? environments.map((e: string) => `- ${e}`).join("\n")
      : "No specific environments defined";

    // Create detailed continuity analysis prompt
    const continuityPrompt = `
You are a professional film continuity supervisor. Analyze the following scene information and provide detailed continuity guidelines.

GLOBAL BIBLE:
Style: ${style}
Genre: ${genre}

CHARACTERS:
${characterBible}

ENVIRONMENTS:
${environmentBible}

CURRENT SCENE:
${scene ? `
- Description: ${scene.scene_description || 'No description'}
- Characters: ${Array.isArray(scene.characters) ? scene.characters.join(', ') : 'None specified'}
- Environment: ${scene.environment || 'No environment specified'}
- Action: ${scene.action || 'No action specified'}
` : 'No current scene provided'}

PREVIOUS SCENE:
${prevScene ? `
- Description: ${prevScene.scene_description || 'No description'}
- Characters: ${Array.isArray(prevScene.characters) ? prevScene.characters.join(', ') : 'None specified'}
- Environment: ${prevScene.environment || 'No environment specified'}
- Action: ${prevScene.action || 'No action specified'}
` : 'No previous scene (this is the first scene)'}

TASK:
Generate detailed continuity guidelines including:
1. Character consistency requirements (appearance, clothing, emotional state)
2. Environment continuity (lighting, weather, time of day, spatial relationships)
3. Props and objects that should remain consistent
4. Camera angle and movement suggestions for smooth transitions
5. Specific visual elements to maintain or change
6. Potential continuity issues to avoid

Return a comprehensive continuity analysis as plain text with clear sections and actionable guidelines.
`;

    // Call Gemini API for real continuity analysis
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: continuityPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent analysis
          maxOutputTokens: 4096,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const continuityAnalysis = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!continuityAnalysis) {
      throw new Error('No continuity analysis generated');
    }

    return new Response(JSON.stringify({
      success: true,
      continuityAnalysis: continuityAnalysis,
      scene: scene,
      prevScene: prevScene,
      globalBible: globalBible,
      characters: characters,
      environments: environments,
      style: style,
      genre: genre,
      message: 'AI-powered continuity analysis completed'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Continuity error:", error);
    const message = error instanceof Error ? error.message : "Continuity generation failed";
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
