import type { APIRoute } from "astro";
import { sendDNSRequest, log, } from "../../../scripts/utils";

export const GET:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 })
    
        const currentUser = await locals.currentUser()
        const query = new URLSearchParams(new URL(request.url).searchParams);
        const result = await sendDNSRequest(`domains/?${query.toString()}`, "GET", locals.auth().sessionClaims.userId ?? "", {});
        if (result.status !== 200) new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), { status: 200 });
    } catch(e:any) {
        console.log(e);
        log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};
