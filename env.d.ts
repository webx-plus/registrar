/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
      auth: () => import('@clerk/backend').Auth;
      currentUser: () => Promise<import('@clerk/backend').User | null>;
      session: () => Promise<import('@clerk/backend').Session | null>;
    }
  }