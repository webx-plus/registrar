import jwt from "jsonwebtoken";

const JWT_SECRET = import.meta.env.JWT_SECRET

const DNS_API_URL = import.meta.env.DNS_API_URL;
const DNS_API_VERSION = import.meta.env.DNS_API_VERSION;

async function sendDNSRequest(url:string, method:"GET" | "PUT" | "PATCH" | "DELETE", user_id:string, data?:any) {
    const request = await fetch(`${DNS_API_URL}/${DNS_API_VERSION}/${url}`, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Registrar ${import.meta.env.DNS_REGISTRAR_TOKEN}`,
            "X-Requesting-User": user_id ?? undefined,
        },
        body: method === "GET" ? undefined : JSON.stringify(data),
    });
    const result = await request.json().catch(e => {console.error(e); return {status: 500, error: e}});
    if (request.status === 500) log(`# DNS Request Failed\n\`${method} ${url}\`\n\`\`\`${result.error ?? result.data}\`\`\``, "error");
    return {status: request.status, data: result.data, error: result.error ?? null};
};

async function log(content:any, type?:"error" | "reload" | "other") {
    console.log(content);
    if (!import.meta.env.LOG_WEBHOOK) return;

    type = type ?? "other";

    const log_formats = {
        "error": { color: 0xEA2920, name: "Registrar Error" },
        "reload": { color: 0x37FB70, name: "Registrar Started" },
        "other": { color: 0x00B5AE, name: "Other Log Message" },
    }
    const webhook_data = log_formats[type] ?? log_formats.other;
    content = content.toString();
    const request = await fetch(import.meta.env.LOG_WEBHOOK, {
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
                author: { name: import.meta.env.VPS_NAME },
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

function consumeCaptcha(token:string, userId:string) {
    if (!token) return false;
    
    try {
        // Verify the JWT
        const decoded = jwt.verify(token, JWT_SECRET) as {
            userId: string;
            type: string;
            timestamp: number;
            iat: number;
            exp: number;
        };
        
        // Check if the token is for captcha and belongs to the right user
        if (decoded.type !== "captcha" || decoded.userId !== userId) return false;
        
        // Check if token is not too old (optional extra check)
        const tokenAge = Date.now() - decoded.timestamp;
        if (tokenAge > 10 * 60 * 1000) return false;

        return true;
    } catch (error) {
        console.error("JWT verification error:", error);
        return false;
    }
};

function generateCaptchaToken(userId:string) {
    const captchaToken = jwt.sign(
        { 
            userId,
            type: "captcha", 
            timestamp: Date.now() 
        }, 
        JWT_SECRET,
        { expiresIn: "10m" } // Token expires in 10 minutes
    );
    return captchaToken;
};

export { sendDNSRequest, log, consumeCaptcha, generateCaptchaToken };