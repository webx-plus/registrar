import type { APIRoute } from "astro";
import { sendDNSRequest, log, } from "../../../../../scripts/utils";

export const PATCH:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 });

        const result = await sendDNSRequest(`domains/${params.domain}/records/${params.record}`, "PATCH", locals.auth().sessionClaims.userId ?? "", await request.json());
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200});
    } catch(e:any) {
        console.log(e);
        await log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};

export const DELETE:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 });
        const currentUser = await locals.currentUser();
        if (!request.body) return new Response(JSON.stringify({ success: false, error: "Missing body" }), { status: 400 });
        if (!params.record || !params.domain) return new Response(JSON.stringify({ success: false, error: "Missing domain or record" }), { status: 400 });

        const result = await sendDNSRequest(`domains/${params.domain}/records/${params.record}`, "DELETE", locals.auth().sessionClaims.userId ?? "", {});
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200})
    } catch(e:any) {
        console.log(e);
        await log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};