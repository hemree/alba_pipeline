import type { Scene, Character } from "../types";

export interface GlobalBible {
  characters: Character[];
  environments: { id:string; description: string }[];
  style: string;
  genre: string;
}

export async function buildContinuityPrompt(
  scene: Scene,
  globalBible: GlobalBible,
  prevScene: Scene | null
): Promise<string> {
  try {
    // This now calls the server-side endpoint instead of Anthropic directly.
    const response = await fetch('/api/continuity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scene,
        globalBible,
        prevScene,
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

    // The backend endpoint returns the prompt as plain text.
    const finalPrompt = await response.text();
    return finalPrompt;

  } catch (err) {
    console.error("Error calling /api/continuity:", err);
    const message = err instanceof Error ? err.message : "An unknown API error occurred.";
    throw new Error(`Failed to connect to the continuity service: ${message}`);
  }
}
