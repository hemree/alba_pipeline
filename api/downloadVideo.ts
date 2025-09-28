// Server-side endpoint for downloading generated videos
import { GoogleGenAI } from "@google/genai";

export default async function handler(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { videoFile } = await request.json();

        // Use new Google GenAI SDK for downloading
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        const ai = new GoogleGenAI({
            apiKey: apiKey
        });

        // Download using the SDK
        const videoData = await ai.files.download({
            file: videoFile
        });

        // Convert to array buffer for response
        const arrayBuffer = videoData instanceof ArrayBuffer ? videoData : await videoData.arrayBuffer();

        return new Response(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': arrayBuffer.byteLength.toString(),
            },
        });

    } catch (error) {
        console.error("Download video error:", error);
        const message = error instanceof Error ? error.message : "Video download failed";
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
