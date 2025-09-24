// This file represents a server-side function and should be deployed
// in a serverless environment (e.g., Vercel, Netlify, Cloud Functions).
// It is not part of the client-side bundle.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Scene, Character } from "../types";

export interface GlobalBible {
  characters: Character[];
  environments: { id: string; description: string }[];
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
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { scene, globalBible, prevScene } = req.body as ContinuityRequestBody;

    // The prompt-building logic is now securely on the server.
    // Use the AI-generated 'lockedDescription' from the GlobalBible for consistency.
    const characterBible = globalBible.characters.map(
      (c) => `- **${c.name}**: ${c.lockedDescription || 'No visual reference provided. Describe based on context from the story.'}`
    ).join("\n");


    const bibleText = `
FILM BIBLE DETAILS:
Global Style: ${globalBible.style}
Narrative Genre: ${globalBible.genre}

CANONICAL CHARACTER DESCRIPTIONS (NON-NEGOTIABLE):
${characterBible}

ENVIRONMENT & STYLE RULES:
- The visual style MUST remain "${globalBible.style}" throughout. It must never drift into realism, Disney, or generic anime archetypes.

Key Environments:
${globalBible.environments.map((e) => `- ${e.id}: ${e.description}`).join("\n")}
    `;

    const continuityNote = prevScene
      ? `This scene directly follows a scene where: "${prevScene.action}". Ensure a smooth transition.`
      : `This is the very first scene of the story. Set the tone and introduce the world.`;

    let userPrompt = `
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
- **Mandatory Opening:** The output prompt MUST begin with the exact phrase: "In a ${globalBible.style} aesthetic, with the dramatic tone of a ${globalBible.genre}, ...". Do not alter this opening.
- **Maintain Consistency:** Refer to the bible to describe characters and environments consistently. For characters, their appearance MUST be based on their canonical description.
- **Narrate the Action:** Clearly describe the action of the scene, incorporating the continuity note to ensure a logical flow from the previous scene.
- **Be Vivid:** Use descriptive language to create a compelling visual for the AI.

**OUTPUT:**
Return ONLY the final prompt text as a single paragraph. Do not include any headers, labels, or explanations.

The output MUST begin exactly with:
"In a ${globalBible.style} aesthetic, with the dramatic tone of a ${globalBible.genre}, ..."
    `;

    // For the first scene, add a special instruction to "lock" the character designs.
    if (!prevScene) {
      userPrompt = `
IMPORTANT: This is the FIRST SCENE.
You MUST lock the exact appearance of all characters to their canonical descriptions from the Film Bible.
In all following scenes, these locked designs MUST NOT change in any way.
${userPrompt}
        `;
    }

    // Use API key on server-side (secure)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("API key is not configured.");
    }

    // Call the Gemini API directly
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: userPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const finalPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!finalPrompt.trim()) {
      // Log the full response for debugging when the prompt is empty.
      console.error("Empty response from Gemini. Full response object:", JSON.stringify(response, null, 2));
      throw new Error("Gemini model returned an empty response. Check server logs for the full API response.");
    }

    // For debugging purposes, include the scene ID
    console.log(`Generated Continuity Prompt for Scene ID ${scene.id}:`, finalPrompt);

    // Return the generated prompt as plain text
    return res.status(200).send(finalPrompt.trim());

  } catch (err) {
    console.error("Error in /api/continuity handler:", err);
    const message = err instanceof Error ? err.message : "An unknown error occurred.";
    return res.status(500).json({ error: `Server error: ${message}` });
  }
}
