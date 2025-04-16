import type { APIRoute } from "astro";
import { sendDNSRequest, log, } from "../../../scripts/utils";

const DOMAIN_MAX_LENGTH = 24;
const DOMAIN_MIN_LENGTH = 3;
const DOMAIN_REGEX = new RegExp(`^[a-z0-9-]{${DOMAIN_MIN_LENGTH},${DOMAIN_MAX_LENGTH}}$`);

export const GET:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().sessionClaims.userId) return new Response('Unauthorized', { status: 401 });

        const result = await sendDNSRequest(`domains/${params.domain}`, "GET", locals.auth().sessionClaims.userId ?? "", {});
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200});
    } catch(e:any) {
        console.log(e);
        await log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};
//REGISTER A DOMAIN
export const PUT:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 });
        if (!request.body) return new Response(JSON.stringify({ success: false, error: "Missing body" }), { status: 400 });
        if (!params.domain) return new Response(JSON.stringify({ success: false, error: "Missing domain" }), { status: 400 });

        const body = await request.json();
        if (!body.target) return new Response(JSON.stringify({ success: false, error: "You must provide a target location for the domain" }), { status: 400 });
        if (params.domain.length < DOMAIN_MIN_LENGTH || params.domain.length > DOMAIN_MAX_LENGTH) return new Response(JSON.stringify({ success: false, error: `Domain length must be between ${DOMAIN_MIN_LENGTH} and ${DOMAIN_MAX_LENGTH}` }), { status: 400 });
        if (!DOMAIN_REGEX.test(params.domain)) return new Response(JSON.stringify({ success: false, error: "Domain must only contain letters, numbers, and hyphens" }), { status: 400 });

        const result = await sendDNSRequest(`domains/${params.domain}`, "PUT", locals.auth().sessionClaims.userId ?? "", {
            target: body.target,
            searchable: body.searchable,
            note: body.note ?? "",
        });
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200});
    } catch(e:any) {
        console.log(e);
        await log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};
//EDIT A DOMAIN
export const PATCH:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 });
        const body = await request.json();
        const result = await sendDNSRequest(`domains/${params.domain}`, "PATCH", locals.auth().sessionClaims.userId ?? "", body);
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200});
    } catch(e:any) {
        console.log(e);
        await log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};
//DELETE A DOMAIN
export const DELETE:APIRoute = async ({ locals, params, request }) => {
    try {
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 });
        const result = await sendDNSRequest(`domains/${params.domain}`, "DELETE", locals.auth().sessionClaims.userId ?? "");
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        // await db_users.findByIdAndUpdate(result.data.owned_by.user, {
        //     $pull: {
        //         owned_domains: `${result.data.name}.${result.data.tld}`
        //     }
        // });
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200});
    } catch(e:any) {
        console.log(e);
        await log(`# Failed to handle request\n\`${request.method} ${request.url}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return new Response(JSON.stringify({ success: false, error: e.toString() }), { status: 500 });
    };
};