import type { APIRoute } from "astro";
import { sendDNSRequest, log, } from "../../../../../scripts/utils";

const DOMAIN_MAX_LENGTH = 24;
const DOMAIN_MIN_LENGTH = 3;
const RECORD_REGEX = new RegExp(`^[a-z0-9-\.]{${DOMAIN_MIN_LENGTH},${DOMAIN_MAX_LENGTH}}$`);

export const PUT:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 });
        if (!request.body) return new Response(JSON.stringify({ success: false, error: "Missing body" }), { status: 400 });

        const body = await request.json();

        if (!body.name || !params.domain) return new Response(JSON.stringify({ success: false, error: "Missing domain or record" }), { status: 400 });
        if (!body.name) return new Response(JSON.stringify({ success: false, error: "You must provide a name for the record" }), { status: 400 });
        if (!body.type) return new Response(JSON.stringify({ success: false, error: "You must provide a type for the record" }), { status: 400 });
        if (!body.value) return new Response(JSON.stringify({ success: false, error: "You must provide a value for the record" }), { status: 400 });
        if (body.name.length < DOMAIN_MIN_LENGTH || body.name.length > DOMAIN_MAX_LENGTH) return new Response(JSON.stringify({ success: false, error: `name length must be between ${DOMAIN_MIN_LENGTH} and ${DOMAIN_MAX_LENGTH}` }), { status: 400 });
        if (!RECORD_REGEX.test(body.name)) return new Response(JSON.stringify({ success: false, error: "name must only contain letters, numbers, and hyphens & dots" }), { status: 400 });

        let name = body.name.replace(/^@/g, params.domain);
        if (!name.endsWith(params.domain)) name += "." + params.domain;
        const result = await sendDNSRequest(`domains/${params.domain}/records`, "PUT", locals.auth().sessionClaims.userId ?? "", {
            name,
            type: body.type,
            value: body.value,
        });
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200});
    } catch(e:any) {
        console.log(e);
        await log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};