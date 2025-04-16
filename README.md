# Webx+ Official Registrar

## How to run

Clone the repo, install the deps and build and then run the entry file (`./dist/server/entry.mjs`)

You also need to provide the environment variables (see .env.example)

We use Clerk for Authentication & User Management, you can find the docs [here](https://clerk.com/docs/overview)
Cloudlfare Turnstile is used to prevent botting on the domain registration API

Build: `npm run build`
Dev Server: `npm run dev`

Also dockerfile is provided if u want to use docker. Just build the image and run it


## Using WebX+

To use webX+ you need a WebX browser that supports custom DNS. We recommend [Bussinga](https://github.com/codingMASTER398/bussinga).

Open the settings for your browser and find the option to input custom DNS. We recommend you use the following DNS URL:

https://dns.webxplus.org

This URL will automatically move over to the secondary DNS server if the primary DNS server is unavailable.

If your broswer requires 2 DNS URLs, or you wish to only use a specific server, you can use these URLs instead:

https://dns-one.webxplus.org
https://dns-two.webxplus.org

Then save your settings. You may need to clear your DNS cache or restart your browser as well

You can now access WebX+ domains, such as [search.frontdoor](buss://search.frontdoor), our search engine for both WebX and WebX+ domains

## Registrars

We provide an offical registrar for WebX+ domains, however we also allow users to build their own registrars.

In order to use the DNS API, you will need a Registrar Key, which can be issued by contacting us on Discord.

More information can be found [here](https://dns.webxplus.org).
