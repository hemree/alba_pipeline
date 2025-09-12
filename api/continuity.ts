
// This file represents a server-side function and should be deployed
// in a serverless environment (e.g., Vercel, Netlify, Cloud Functions).
// It is not part of the client-side bundle.

// Corrected: Replaced Anthropic SDK with Google Gemini SDK.
import { GoogleGenAI } from "@google/genai";
import type { Scene, Character } from "../types";

export interface GlobalBible {
  characters: Character[];
  environments: { id:string; description: string }[];
  style: string;
  genre: string;
}

interface ContinuityRequestBody {
  scene: Scene;
  globalBible: GlobalBible;
  prevScene: Scene | null;
}

// This function simulates a serverless function handler.
// The actual implementation will depend on your deployment platform.
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { scene, globalBible, prevScene } = await request.json() as ContinuityRequestBody;
    
    // Corrected: Use GoogleGenAI with the standard API_KEY environment variable.
    // The Gemini API key is read from secure server-side environment variables.
    // It is never exposed to the client.
    const ai = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });
    
    // The prompt-building logic is now securely on the server.
    const bibleText = `
Global Style: ${globalBible.style}
Narrative Genre: ${globalBible.genre}

Characters:
${globalBible.characters.map(
  (c) => `- ${c.name}: ${c.imageBase64 ? "Has a reference image for visual consistency." : "No reference image."}`
).join("\n")}

Key Environments:
${globalBible.environments.map((e) => `- ${e.id}: ${e.description}`).join("\n")}
    `;

    const continuityNote = prevScene
      ? `This scene directly follows a scene where: "${prevScene.action}". Ensure a smooth transition.`
      : `This is the very first scene of the story. Set the tone and introduce the world.`;

    const userPrompt = `
You are an expert continuity director for an animated film. Your task is to generate a single, rich, and consistent prompt for a video generation AI (like Veo) based on a global "bible" and the specifics of the current scene.

**FILM BIBLE:**
---
${bibleText}
---

**CURRENT SCENE DETAILS:**
---
- Scene Description: ${scene.scene_description}
- Characters Present: ${scene.characters.join(", ") || "None"}
- Environment: ${scene.environment}
- Core Action: ${scene.action}
- Continuity Note from Previous Scene: ${continuityNote}
---

**YOUR TASK:**
Synthesize all the above information into one single, coherent, and descriptive paragraph. This paragraph is the final prompt.
- **Enforce Visuals:** The prompt MUST begin by establishing the visual style, for example: "In a vibrant ${globalBible.style} aesthetic, with the dramatic tone of a ${globalBible.genre}, ...".
- **Maintain Consistency:** Refer to the bible to describe characters and environments consistently. If a character has a reference image, note that their appearance should be based on that.
- **Narrate the Action:** Clearly describe the action of the scene, incorporating the continuity note to ensure a logical flow from the previous scene.
- **Be Vivid:** Use descriptive language to create a compelling visual for the AI.

**OUTPUT:**
Return ONLY the final prompt text as a single paragraph. Do not include any headers, labels, or explanations.
    `;
    
    // Corrected: Call the Gemini API using the recommended method.
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
    });

    // Corrected: Extract text directly from the response object.
    const finalPrompt = response.text;
    if (!finalPrompt) {
        // Corrected: Updated error message for Gemini.
        throw new Error("Gemini model returned an empty response.");
    }
    
    // Return the generated prompt as plain text
    return new Response(finalPrompt.trim(), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });

  } catch (err) {
    console.error("Error in /api/continuity handler:", err);
    const message = err instanceof Error ? err.message : "An unknown error occurred.";
    return new Response(JSON.stringify({ error: `Server error: ${message}` }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
