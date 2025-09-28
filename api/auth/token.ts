// Service Account token endpoint
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
        // Use the API key directly for now (simpler approach)
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        // For Gemini API, we can use API key directly on server-side
        // Return a mock token structure that our client expects
        return new Response(JSON.stringify({
            access_token: apiKey,
            expires_in: 3600, // 1 hour
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error) {
        console.error("Token generation error:", error);
        const message = error instanceof Error ? error.message : "Token generation failed";
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
