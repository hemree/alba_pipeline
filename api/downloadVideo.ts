// Server-side endpoint for downloading generated videos
export default async function handler(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { videoUri, accessToken } = await request.json();

        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'Access token is required' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const videoResponse = await fetch(videoUri, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

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
