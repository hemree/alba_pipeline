// Server-side endpoint for polling video generation operations
import { GoogleGenAI } from "@google/genai";

export default async function handler(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { operationName } = await request.json();

        // Use new Google GenAI SDK for polling
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        const ai = new GoogleGenAI({
            apiKey: apiKey
        });

        // Create operation object for polling
        const operationObj = {
            name: operationName,
            done: false
        };

        const operation = await ai.operations.getVideosOperation({
            operation: operationObj,
        });

        return new Response(JSON.stringify(operation), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error) {
        console.error("Poll operation error:", error);
        const message = error instanceof Error ? error.message : "Poll operation failed";
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
