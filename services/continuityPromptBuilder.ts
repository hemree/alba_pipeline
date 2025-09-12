import { Anthropic } from "@anthropic-ai/sdk";
import type { Scene, Character } from "../types";

// Note: This service assumes the ANTHROPIC_API_KEY environment variable is set.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

  try {
    const response = await anthropic.messages.create({
      model: "claude-3.5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const finalPrompt = response.content[0]?.type === "text" ? response.content[0].text : "";
    if (!finalPrompt) {
        throw new Error("Anthropic model returned an empty response.");
    }
    return finalPrompt.trim();

  } catch (err) {
      console.error("Error calling Anthropic for prompt generation:", err);
      const message = err instanceof Error ? err.message : "An unknown API error occurred.";
      throw new Error(`Failed to generate continuity prompt with Claude: ${message}`);
  }
}
