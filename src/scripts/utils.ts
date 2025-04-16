
async function sendDNSRequest(url:string, method:"GET" | "PUT" | "PATCH" | "DELETE", user_id:string, data?:any) {
    const request = await fetch(`https://dns.webxplus.org/${url}`, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Registrar ${process.env.DNS_API_KEY}`,
            "X-Requesting-User": user_id ?? undefined,
        },
        body: method === "GET" ? undefined : JSON.stringify(data),
    });
    const result = await request.json().catch(e => {console.error(e); return {status: 500, error: e}});
    if (request.status === 500) log(`# DNS Request Failed\n\`${method} ${url}\`\n\`\`\`${result.error ?? result.data}\`\`\``, "error");
    return {status: request.status, data: result.data, error: result.error ?? null};
};

async function log(content:any, type?:"error" | "reload" | "other") {
    if (!process.env.LOG_WEBHOOK) return;

    type = type ?? "other";

    const log_formats = {
        "error": { color: 0xEA2920, name: "Registrar Error" },
        "reload": { color: 0x37FB70, name: "Registrar Started" },
        "other": { color: 0x00B5AE, name: "Other Log Message" },
    }
    const webhook_data = log_formats[type] ?? log_formats.other;
    content = content.toString();
    const request = await fetch(process.env.LOG_WEBHOOK, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: webhook_data.name,
            avatar_url: `https://resources.votemanager.xyz/assets/logs/${log_formats[type] ? type : "other"}.png`,
            embeds: [{
                color: webhook_data.color,
                description: `${content.length > 2000 ? content.slice(0, 1950) + `\n+${content.length - 1950} more characters` : content}`,
                author: { name: process.env.VPS_NAME },
            }]
        })
    }).catch(console.log);
    if (!request) return;

    if (!request.ok) {
        console.log(`SENDING LOG MESSAGE TO DISCORD FAILED: ${request.status} ${request.statusText}`);
        console.log(`DISCORD REPSONSE BODY:\n${await request.text()}`);
        console.log(`ORIGINAL LOG MESSAGE:\n${content}`);
    };
};

export { sendDNSRequest, log };