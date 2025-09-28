import type { Scene, Character } from "../types";

export interface GlobalBible {
  characters: Character[];
  environments: { id: string; description: string }[];
  style: string;
  genre: string;
}

export async function buildContinuityPrompt(
  scene: Scene,
  globalBible: GlobalBible,
  prevScene: Scene | null
): Promise<string> {
  try {
    // Call the enhanced continuity API with full scene context
    const response = await fetch('/api/continuity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scene,
        globalBible,
        prevScene,
        characters: globalBible.characters,
        environments: globalBible.environments.map(env => env.description),
        style: globalBible.style,
        genre: globalBible.genre,
      }),
    });

    if (!response.ok) {
      // Try to parse error from backend
      let errorMsg = `Request failed with status ${response.status}`;
      try {
        const errorJson = await response.json();
        errorMsg = errorJson.error || errorMsg;
      } catch (e) {
        // response was not json, use text and provide it.
        const textError = await response.text();
        errorMsg = textError || errorMsg;
      }
      throw new Error(`Failed to generate continuity prompt: ${errorMsg}`);
    }

    // The enhanced backend endpoint returns JSON with continuity analysis
    const result = await response.json();

    if (result.success && result.continuityAnalysis) {
      return result.continuityAnalysis;
    } else {
      // Fallback to basic prompt if analysis fails
      return `Maintain visual consistency with ${globalBible.style} style and ${globalBible.genre} genre.`;
    }

  } catch (err) {
    console.error("Error calling /api/continuity:", err);
    const message = err instanceof Error ? err.message : "An unknown API error occurred.";
    throw new Error(`Failed to connect to the continuity service: ${message}`);
  }
}
