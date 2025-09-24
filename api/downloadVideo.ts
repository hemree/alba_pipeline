// Server-side endpoint for downloading generated videos
export default async function handler(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { videoUri } = await request.json();

        // Use API key on server-side (secure)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        const videoResponse = await fetch(`${videoUri}?key=${apiKey}`);

        if (!videoResponse.ok) {
            throw new Error(`Failed to download video with status ${videoResponse.status}`);
        }

        const videoBlob = await videoResponse.blob();
        const arrayBuffer = await videoBlob.arrayBuffer();

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
