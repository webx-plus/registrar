/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        auth: () => import('@clerk/backend').Auth;
        currentUser: () => Promise<import('@clerk/backend').User | null>;
        session: () => Promise<import('@clerk/backend').Session | null>;
    }
}

interface UserPublicMetadata {
    staff?: boolean;
}
interface UserPrivateMetadata {
    owned_domains: string[];
    reserved_tlds: string[];
}

declare global {
    interface CustomJwtSessionClaims {
        userId: string;
        public_metadata: UserPublicMetadata;
    }
}

interface ImportMetaEnv {
    readonly PORT: string;

    readonly DNS_API_URL: string;
    readonly DNS_API_VERSION: string;
    readonly DNS_REGISTRAR_TOKEN: string;

    readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
    readonly CLERK_SECRET_KEY: string;

    readonly TURNSTILE_SECRET_KEY: string;
    readonly TURNSTILE_SITE_KEY: string;

    readonly JWT_SECRET: string;
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}