// Server-side endpoint for polling video generation operations
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
    // Convert Vercel format to our format
    const request = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const response = await handleRequest(request);
    const data = await response.text();

    res.status(response.status).json(JSON.parse(data));
}

async function handleRequest(request: Request): Promise<Response> {
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

        // Get operation status directly by name
        const operation = await ai.operations.getVideosOperation({
            operation: operationName,
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
