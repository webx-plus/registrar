import type { APIRoute } from "astro";
import { log, generateCaptchaToken } from "../../scripts/utils";

export const POST:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 });
        if (!request.body) return new Response(JSON.stringify({ success: false, error: "Missing body" }), { status: 400 });

        const body = await request.json();
        if (!body.token) return new Response(JSON.stringify({ success: false, error: "You must provide a token" }), { status: 400 });
    
        let formData = new FormData();
        formData.append('secret', import.meta.env.CF_TURNSTILE_SECRET);
        formData.append('response', body.token);
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body: formData,
        });
        let result = await response.json();
        return new Response(JSON.stringify({success: true, data: {
            result_token: generateCaptchaToken(locals.auth().userId)
        }}), { status: 200 });
    } catch(e:any) {
        console.log(e);
        log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};