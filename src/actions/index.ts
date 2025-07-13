import { defineAction, type ActionAPIContext, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { clerkClient } from "@clerk/astro/server";

import api from "@/lib/api";
import * as captcha from "@/lib/captcha";

import * as types from "@/lib/types";
import type { APIContext } from "astro";

function clerk(context:ActionAPIContext) {
    return clerkClient(context as APIContext);
}

export const server = {
    domains: {
        list: defineAction({
            input: z.object({
                owned: z.boolean().optional(),
                search: z.string().optional(),
                limit: z.number().optional(),
                page: z.number().optional(),
            }),
            handler: async (input, context) => {
                try {
                    const userId = context.locals.auth().sessionClaims!.userId as string;
                    const domains = await api.getDomains(input, userId);
                    if (input.owned) {
                        const user = await clerk(context).users.getUser(userId);
                        domains.forEach(x => {
                            x.clerk_user = {
                                username: user.username!,
                                imageUrl: user.imageUrl,
                            }
                        });
                    };
                    return domains;
                } catch (error) {
                    throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to fetch domains: ${error instanceof Error ? error.message : 'Unknown error'}` });
                }
            }
        }),
        get: defineAction({
            input: z.object({
                domainId: z.string()
            }),
            handler: async ({ domainId }, context) => {
                try {
                    const userId = context.locals.auth().sessionClaims!.userId as string;
                    let domain = await api.getDomain(domainId, userId);
    
                    if (domain.owned_by.registrar === "webx-plus") {
                        const user = await clerk(context).users.getUser(domain.owned_by.user);
                        if (user) {
                            domain.clerk_user = {
                                username: user.username!,
                                imageUrl: user.imageUrl,
                            }
                        };
                    };
                    return domain;
                } catch (error) {
                    throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to fetch domain: ${error instanceof Error ? error.message : 'Unknown error'}` });
                }
            }
        }),
        create: defineAction({
            input: z.object({
                name: z.string(),
                tld: z.string(),
                target: z.string(),
                note: z.string().optional(),
                searchable: z.boolean().optional(),
                captcha_token: z.string(),
            }),
            handler: async (input, context) => {
                const userId = context.locals.auth().sessionClaims!.userId as string;
                const captchaCheck = captcha.consume(input.captcha_token, userId);
                if (!captchaCheck) throw new ActionError({ code: "BAD_REQUEST", message: "Invalid captcha" });
                const domain = await api.createDomain(input, userId);
                context.cookies.set("register_domain", JSON.stringify({ name: domain.name, key: domain.secret }), { path: "/", httpOnly: true, sameSite: "strict" });
                delete domain.secret;
                return domain;
            },
        }),
        update: defineAction({
            input: z.object({
                domainId: z.string(),
                note: z.string().optional(),
                searchable: z.boolean().optional(),
            }),
            handler: async (input, context) => {
                const { domainId, ...data } = input;
                const userId = context.locals.auth().sessionClaims!.userId as string;
                return await api.updateDomain(domainId, data, userId);
            },
        }),
        delete: defineAction({
            input: z.object({
                domainId: z.string(),
            }),
            handler: async (input, context) => {
                const userId = context.locals.auth().sessionClaims!.userId as string;
                await api.deleteDomain(input.domainId, userId);
                return { success: true };
            },
        }),
        transfer: defineAction({
            input: z.object({
                domainId: z.string(),
                userId: z.string(),
            }),
            handler: async (input, context) => {
                const userId = context.locals.auth().sessionClaims!.userId as string;
                return await api.transferDomain(input.domainId, input.userId, userId);
            },
        }),
    },

    records: {
        create: defineAction({
            input: z.object({
                domainId: z.string(),
                type: z.nativeEnum(types.RecordType),
                name: z.string(),
                value: z.string(),
            }),
            handler: async (input, context) => {
                const userId = context.locals.auth().sessionClaims!.userId as string;
                return await api.createRecord(input.domainId, input, userId);
            },
        }),
        update: defineAction({
            input: z.object({
                domainId: z.string(),
                recordId: z.string(),
                type: z.nativeEnum(types.RecordType).optional(),
                value: z.string().optional(),
            }),
            handler: async (input, context) => {
                const userId = context.locals.auth().sessionClaims!.userId as string;
                return await api.updateRecord(input.domainId, input.recordId, input, userId);
            },
        }),
        delete: defineAction({
            input: z.object({
                domainId: z.string(),
                recordId: z.string(),
            }),
            handler: async (input, context) => {
                const userId = context.locals.auth().sessionClaims!.userId as string;
                return await api.deleteRecord(input.domainId, input.recordId, userId);
            },
        }),
    },

    captcha: {
        verify: defineAction({
            input: z.object({
                token: z.string(),
            }),
            handler: async (input, context) => {
                let formData = new FormData();
                formData.append('secret', import.meta.env.CF_TURNSTILE_SECRET);
                formData.append('response', input.token);
                const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                    method: "POST",
                    body: formData,
                });
                let result = await response.json();
                const userId = context.locals.auth().sessionClaims!.userId as string;
                return {
                    result_token: captcha.generateToken(userId)
                };
            },
        }),
    }
};