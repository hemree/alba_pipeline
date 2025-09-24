// Server-side endpoint for polling video generation operations
export default async function handler(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { operationName } = await request.json();

        // Use API key on server-side (secure)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        const pollResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/operations/${operationName}?key=${apiKey}`);

        if (!pollResponse.ok) {
            throw new Error(`Poll request failed with status ${pollResponse.status}`);
        }

        const operation = await pollResponse.json();

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
