import type { APIRoute } from "astro";
import { sendDNSRequest, log, } from "../../../../scripts/utils";

const DOMAIN_MAX_LENGTH = 24;
const DOMAIN_MIN_LENGTH = 3;
const RECORD_REGEX = new RegExp(`^[a-z0-9-\.]{${DOMAIN_MIN_LENGTH},${DOMAIN_MAX_LENGTH}}$`);

export const PUT:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 });
        if (!request.body) return new Response(JSON.stringify({ success: false, error: "Missing body" }), { status: 400 });
        if (!params.record || !params.domain) return new Response(JSON.stringify({ success: false, error: "Missing domain or record" }), { status: 400 });

        const body = await request.json();
        if (!body.target) return new Response(JSON.stringify({ success: false, error: "You must provide a target location for the domain" }), { status: 400 });
        if (params.record.length < DOMAIN_MIN_LENGTH || params.record.length > DOMAIN_MAX_LENGTH) return new Response(JSON.stringify({ success: false, error: `Subdomain length must be between ${DOMAIN_MIN_LENGTH} and ${DOMAIN_MAX_LENGTH}` }), { status: 400 });
        if (!RECORD_REGEX.test(params.record)) return new Response(JSON.stringify({ success: false, error: "Subdomain must only contain letters, numbers, and hyphens & dots" }), { status: 400 });

        const result = await sendDNSRequest(`domains/${params.domain}/records/${params.record}`, "PUT", locals.auth().sessionClaims.userId ?? "", {
            target: body.target,
            searchable: body.searchable,
        });
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200});
    } catch(e:any) {
        console.log(e);
        await log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};

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


        const body = await request.json();
        if (!body.target) return new Response(JSON.stringify({ success: false, error: "You must provide a target location for the domain" }), { status: 400 });
        if (params.record.length < DOMAIN_MIN_LENGTH || params.record.length > DOMAIN_MAX_LENGTH) return new Response(JSON.stringify({ success: false, error: `Subdomain length must be between ${DOMAIN_MIN_LENGTH} and ${DOMAIN_MAX_LENGTH}` }), { status: 400 });

        const result = await sendDNSRequest(`domains/${params.domain}/records/${params.record}`, "DELETE", locals.auth().sessionClaims.userId ?? "", {});
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200})
    } catch(e:any) {
        console.log(e);
        await log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};