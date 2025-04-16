import type { APIRoute } from "astro";
import { sendDNSRequest, log, consumeCaptcha } from "../../../../scripts/utils";

import { clerkClient } from "@clerk/astro/server";

// const clerk = Clerk({ secretKey: import.meta.env.CLERK_SECRET_KEY });

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
export const PUT:APIRoute = async (context) => {
    try {
        const { locals, params, request } = context;
        if (!locals.auth().userId) return new Response('Unauthorized', { status: 401 });
        if (!request.body) return new Response(JSON.stringify({ success: false, error: "Missing body" }), { status: 400 });
        if (!params.domain) return new Response(JSON.stringify({ success: false, error: "Missing domain" }), { status: 400 });
        const domain_name = params.domain.toLowerCase();
        const name = domain_name.split(".")[0], tld = domain_name.split(".")[1];
        
        const body = await request.json();
        const captchaCheck = consumeCaptcha(body.captcha_token, locals.auth().userId);
        if (!captchaCheck) return new Response(JSON.stringify({ success: false, error: "Invalid captcha" }), { status: 400 });
        if (!body.target) return new Response(JSON.stringify({ success: false, error: "You must provide a target location for the domain" }), { status: 400 });
        if (name.length < DOMAIN_MIN_LENGTH || name.length > DOMAIN_MAX_LENGTH) return new Response(JSON.stringify({ success: false, error: `Domain length must be between ${DOMAIN_MIN_LENGTH} and ${DOMAIN_MAX_LENGTH}` }), { status: 400 });
        if (!DOMAIN_REGEX.test(name)) return new Response(JSON.stringify({ success: false, error: "Domain must only contain letters, numbers, and hyphens" }), { status: 400 });

        const result = await sendDNSRequest(`domains/${params.domain}`, "PUT", locals.auth().sessionClaims.userId ?? "", {
            target: body.target,
            searchable: body.searchable,
            note: body.note ?? "",
        });
        const user = await clerkClient(context).users.getUser(locals.auth().userId);
        await clerkClient(context).users.updateUser(locals.auth().userId, {
            privateMetadata: {
                ...user.privateMetadata,
                owned_domains: [...user.privateMetadata.owned_domains, params.domain],
            }
        })
        if (result.status !== 200) return new Response(JSON.stringify({success: false, error: result.error}), {status: result.status});
        return new Response(JSON.stringify({success: true, data: result.data}), {status: 200});

    } catch(e:any) {
        const { locals, params, request } = context;
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