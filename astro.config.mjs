import { defineConfig } from "astro/config";

import node from "@astrojs/node";

import clerk from "@clerk/astro";
import { dark } from "@clerk/themes";

export default defineConfig({
    site: "https://webxplus.org",
    integrations: [clerk({
        appearance: {
            baseTheme: dark
        }
    })],
    adapter: node({ mode: 'standalone' }),
    output: 'server',
    // vite: {
    //     build: {
    //         rollupOptions: {
    //             external: ["astro/components/Code.d.astro.js"],
    //         },
    //     },
    // },
})