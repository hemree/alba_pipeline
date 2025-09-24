// Service Account token endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Use the API key directly for now (simpler approach)
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        // For Gemini API, we can use API key directly on server-side
        // Return a mock token structure that our client expects
        return res.status(200).json({
            access_token: apiKey,
            expires_in: 3600, // 1 hour
        });

    } catch (error) {
        console.error("Token generation error:", error);
        const message = error instanceof Error ? error.message : "Token generation failed";
        return res.status(500).json({ error: message });
    }
}
