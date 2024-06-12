//-------------------------- IMPORTS ---------------------------//
const path = require("path");
const mongoose = require("mongoose");
const express = require("express");
const encrypt = require("bcrypt");
const expressBrute = require("express-brute");
const mongooseStore = require("express-brute-mongoose");
const bruteForceSchema = require("express-brute-mongoose/dist/schema");
const brevo = require('@getbrevo/brevo');
//------------------------- EMAIL SETUP ------------------------//
const brevoInstance = new brevo.TransactionalEmailsApi();
const brevoApiKey = brevoInstance.authentications.apiKey;
brevoApiKey.apiKey = process.env.BREVO_API_KEY;
//---------------------- DEFINE STUFF ---------------------------//
const DOMAIN_MAX_LENGTH = 24;
const DOMAIN_MIN_LENGTH = 3;
const DOMAIN_REGEX = new RegExp(`^[a-z0-9-]{${DOMAIN_MIN_LENGTH},${DOMAIN_MAX_LENGTH}}$`);
const RECORD_REGEX = new RegExp(`^[a-z0-9-\.]{${DOMAIN_MIN_LENGTH},${DOMAIN_MAX_LENGTH}}$`);

const captcha_tokens = [];

function generateCode() {
    return Math.floor(Math.random() * 1_000_000) + 100_000;
};
function generateSecret() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
function generateSessionSecret(id) {
    return `${btoa(id)}.${generateSecret()}${generateSecret()}${generateSecret()}${generateSecret()}`;
};
function consumeCaptcha(token) {
    if (!token) return false;
    const index = captcha_tokens.indexOf(token);
    if (index === -1) return false;
    captcha_tokens.splice(index, 1);
    return true;
};

async function authorizeUser(token) {
    const token_type = token.split(" ")[0], token_user = token.split(" ")[1].split(".")[0], token_secret = token.split(" ")[1];
    let user = await db_users.findById(atob(token_user));
    if (!user) return false;
    user = user.toObject();
    const session = user.tokens?.find(x => encrypt.compareSync(token_secret, x.token));
    if (!session || session.expires_at < Date.now()) return false;
    user.current_session_id = session.id;
    delete user.__v;
    return user;
};

function formatUserResponse(user) {
    if ("toObject" in user) return user.toObject();
    delete user.__v;
    delete user.tokens;
    delete user.password;
    if (user.email_verification) {
        delete user.email_verification?.token;
        delete user.email_verification?.code;
    };
    return user;
};

async function createVerificationEmail(user) {
    if ((!user.email_verification || !user.email_verification.update_address) && user.email_verified) return false;
    const updated_user = await db_users.findByIdAndUpdate(user._id, {
        email_verification: {
            token: `${btoa(user._id)}.${generateSecret()}${generateSecret()}`,
            code: generateCode(),
            update_address: user.email_verification.update_address,
        }
    }, { new: true });
    const smtpEmail = new brevo.SendSmtpEmail();
    smtpEmail.templateId = 1;
    smtpEmail.to = [{email: user.email_verification.update_address ?? user.email, name: user.username}];
    smtpEmail.params = {
        EMAIL_CODE: `${updated_user.email_verification.code.slice(0, 3)} ${updated_user.email_verification.code.slice(3, 6)}`,
        USERNAME: user.username,
    };
    return await brevoInstance.sendTransacEmail(smtpEmail);
};

async function getDNSOptions(authorization, domain_key_allowed) {
    if (!authorization) return {};
    const auth_type = authorization.split(" ")[0], auth_token = authorization.split(" ")[1];
    if (auth_type === "User") {
        const user = await authorizeUser(authorization);
        if (!user) return {};
        return {user_id: user._id};
    };
    if (auth_type === "DomainKey" && domain_key_allowed) return {domain_key: auth_token};
    return {};
};

async function sendDNSRequest(url, method, options, data) {
    const request = await fetch(`https://webxdns.votemanager.xyz/${url}`, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": options.domain_key ? `DomainKey ${options.domain_key}` : `Registrar ${process.env.DNS_API_KEY}`,
            "X-Requesting-User": options.user_id ?? undefined,
        },
        body: method === "GET" ? undefined : JSON.stringify(data),
    });
    const result = await request.json().catch(e => {console.error(e); return {status: 500, error: e}});
    if (request.status === 500) log(`# DNS Request Failed\n${url}\n${method}\n${request.error}`, "error");
    return {status: request.status, data: result.data, error: result.error ?? null};
};

async function log(content, type) {
    console.log(content);
    if (!process.env.LOG_WEBHOOK) return;

    const log_formats = {
        "error": { color: 0xEA2920, name: "DNS Error" },
        "reload": { color: 0x37FB70, name: "DNS Started" },
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

    if (!request.ok) {
        console.log(`SENDING LOG MESSAGE TO DISCORD FAILED: ${request.status} ${request.statusText}`);
        console.log(`DISCORD REPSONSE BODY:\n${await request.text()}`);
        console.log(`ORIGINAL LOG MESSAGE:\n${items}`);
    };
};

//----------------------- DATABASE SETUP -----------------------//
const db_users = require("./schemas/users.js");
const db_ratelimits = mongoose.model("bruteforce", new mongoose.Schema(bruteForceSchema));

if (!mongoose.connection.readyState)
    mongoose.connect(process.env.MONGODB_URI, {useUnifiedTopology: true}).then(x => log("Connected to MongoDB", "reload"));


//------------------------ RATELIMITING ------------------------//
const bruteforceStore = new mongooseStore(db_ratelimits);
//different ratelimits for different actions
const bruteforce_register = new expressBrute(bruteforceStore, {
    // freeRetries: 6,
    freeRetries: 1000,
    minWait: 500,
    maxWait: 3.6e+6,
    failCallback: expressBrute.FailTooManyRequests
});
const bruteforce_write = new expressBrute(bruteforceStore, {
    // freeRetries: 15,
    freeRetries: 1000,
    minWait: 1000,
    maxWait: 3.6e+6,
    failCallback: expressBrute.FailTooManyRequests
});

//---------------------- WEB SERVER & API ----------------------//

const web_server = express();

web_server.listen(process.env.PORT, () => {
    log(`Registrar running on port ${process.env.PORT}`, "reload");
});
//UI
web_server.use(express.static(path.join(__dirname, "./ui"), {extensions: ["html"]}));
//CORS
web_server.use(express.json());
// web_server.use((req, res, next) => {
//     res.header("Access-Control-Allow-Origin", "*");
//     res.header("Access-Control-Allow-Headers", "*");
//     res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
//     res.header("Access-Control-Allow-Credentials", true);
//     next();
// });
//------------------------ INTERVALS --------------------------//
//remove expired sessions, hourly
setInterval(async() => {
    const users = await db_users.find();
    for (let x of users) {
        await db_users.findByIdAndUpdate(x._id, {
            $pull: {
                tokens: {
                    expires_at: {
                        $lt: Date.now()
                    }
                }
            }
        });
    };
}, 1000 * 60 * 60);
//----------------------- DOMAINS API -------------------------//
web_server.get("/api/uptime", async (req, res) => {
   return res.status(200).json({success: true}); 
});
//VERIFY CAPTCHA
web_server.post("/api/captcha", async (req, res) => {
    try {
        let formData = new FormData();
        formData.append('secret', process.env.CF_TURNSTILE_SECRET);
        formData.append('response', req.body.token);
        let request = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body: formData,
        });
        let result = await request.json();
        result.result_token = generateSecret() + generateSecret();
        captcha_tokens.push(result.result_token);
        return res.status(request.status).json({
            success: true,
            data: result
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//USER LOGIN / REGISTER
web_server.post("/api/register", bruteforce_register.prevent, async (req, res) => {
    try {
        const captchaCheck = consumeCaptcha(req.body?.captcha_token);
        if (!captchaCheck) return res.status(400).send({success: false, error: "Invalid captcha"});
        if (!req.body.username || !req.body.password) return res.status(400).json({success: false, error: "Missing username or password"});
        if (await db_users.findOne({username: req.body.username})) return res.status(409).json({success: false, error: "Username already exists"});
        const created_session_id = crypto.randomUUID();
        const created_user_id = crypto.randomUUID();
        const created_session_token = generateSessionSecret(created_user_id);
        let result = await new db_users({
            _id: created_user_id,
            email: req.body.email ?? "",
            username: req.body.username.toLowerCase().replaceAll(' ', '-').replace(/[^a-z0-9-_]/g, ''),
            password: await encrypt.hash(req.body.password, 10),
            tokens: [{
                _id: created_session_id,
                token: await encrypt.hash(created_session_token, 10),
                expires_at: Date.now() + 1000 * 60 * 60 * 24 * 7,
                ip: req.headers['cf-connecting-ip'] ?? req.ip
            }],
            created_at: Date.now(),
            suspended: false,
        }).save();
        if (req.body.email) await createVerificationEmail(result);
        result = result.toObject();
        result.generated_session = result.tokens.find(x => x._id === created_session_id);
        result.generated_session.token = created_session_token;
        return res.status(200).json({
            success: true,
            data: formatUserResponse(result)
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
web_server.post("/api/login", async (req, res) => {
    try {
        const captchaCheck = consumeCaptcha(req.body?.captcha_token);
        if (!captchaCheck) return res.status(400).send({success: false, error: "Invalid captcha"});
        if (!req.body.username || !req.body.password) return res.status(400).json({success: false, error: "Missing username or password"});
        let user = await db_users.findOne(req.body.username.includes("@") ? {email: req.body.username, email_verified: true} : {username: req.body.username.toLowerCase()});
        if (!user || user.suspended) return res.status(404).json({success: false, error: "User not found"});
        if (!await encrypt.compare(req.body.password, user.password)) return res.status(401).json({success: false, error: "Invalid password"});
        const created_session_id = crypto.randomUUID();
        const created_session_token = generateSessionSecret(user._id);
        let result = await db_users.findByIdAndUpdate(user._id, {
            $push: {
                tokens: {
                    _id: created_session_id,
                    token: await encrypt.hash(created_session_token, 10),
                    expires_at: Date.now() + 1000 * 60 * 60 * 24 * 7,
                    ip: req.headers['cf-connecting-ip'] ?? req.ip
                }
            }
        }, { new: true });
        result = result.toObject();
        result.generated_session = result.tokens.find(x => x._id === created_session_id);
        result.generated_session.token = created_session_token;
        return res.status(200).json({
            success: true,
            data: formatUserResponse(result)
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
web_server.post("/api/logout", async (req, res) => {
    try {
        if (!req.headers.authorization || !req.headers.authorization.startsWith("User")) return res.status(401).json({success: false, error: "Missing or invalid authorization type"});
        const user = await authorizeUser(req.headers.authorization);
        if (!user) return res.status(401).json({success: false, error: "Invalid authorization header"});
        await db_users.findByIdAndUpdate(user._id, {
            $pull: {
                tokens: {
                    _id: user.current_session_id
                }
            }
        });
        return res.status(200).json({
            success: true,
            data: {}
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//GET USER DATA
web_server.get("/api/account", async (req, res) => {
    try {
        if (!req.headers.authorization || !req.headers.authorization.startsWith("User")) return res.status(401).json({success: false, error: "Missing or invalid authorization type"});
        let user = await authorizeUser(req.headers.authorization);
        if (!user) return res.status(401).json({success: false, error: "Invalid authorization header"});

        return res.status(200).json({
            success: true,
            data: formatUserResponse(user)
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
web_server.patch("/api/account", async (req, res) => {
    try {
        if (!req.headers.authorization || !req.headers.authorization.startsWith("User")) return res.status(401).json({success: false, error: "Missing or invalid authorization type"});
        let user = await authorizeUser(req.headers.authorization);
        if (!user) return res.status(401).json({success: false, error: "Invalid authorization header"});

        const sensitive_fields = ["password", "email", "username"];
        if (sensitive_fields.some(x => req.body[x])) {
            //check password
            if (!req.body.verify_password) return res.status(400).json({success: false, error: "Must verify your password"});
            if (!await encrypt.compare(req.body.verify_password, user.password)) return res.status(403).json({success: false, error: "Invalid password"});
        };
        if (req.body.username) {
            //check username
            const userCheck = await db_users.findOne({username: req.body.username.toLowerCase().replaceAll(' ', '-').replace(/[^a-z0-9-_]/g, '')});
            if (userCheck) return res.status(409).json({success: false, error: "Username already exists"});
        };
        if (req.body.email) {
            //check email
            const emailCheck = await db_users.findOne({email: req.body.email});
            if (emailCheck) return res.status(409).json({success: false, error: "Email already exists"});
        };
        let result = await db_users.findByIdAndUpdate(user._id, {
            username: req.body.username ? req.body.username.toLowerCase().replaceAll(' ', '-').replace(/[^a-z0-9-_]/g, '') : user.username,
            email_verification: req.body.email ? {update_address: req.body.email} : user.email_verification,
            password: req.body.password ? await encrypt.hash(req.body.password, 10) : user.password,
        }, { new: true });

        if (req.body.email) await createVerificationEmail(result);

        return res.status(200).json({
            success: true,
            data: formatUserResponse(result)
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
web_server.delete("/api/account", async (req, res) => {
    try {
        if (!req.headers.authorization || !req.headers.authorization.startsWith("User")) return res.status(401).json({success: false, error: "Missing or invalid authorization type"});
        let user = await authorizeUser(req.headers.authorization);
        if (!user) return res.status(401).json({success: false, error: "Invalid authorization header"});

        if (!req.body.verify_password) return res.status(400).json({success: false, error: "Must verify your password"});
        if (!await encrypt.compare(req.body.verify_password, user.password)) return res.status(403).json({success: false, error: "Invalid password"});
        if (user.owned_domains.length > 0) return res.status(409).json({success: false, error: "You must first unregister all your domains"});
        await db_users.findByIdAndDelete(user._id);
        return res.status(200).json({
            success: true,
            data: formatUserResponse(user)
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
web_server.delete("/api/account/sessions", async (req, res) => {
    try {
        if (!req.headers.authorization || !req.headers.authorization.startsWith("User")) return res.status(401).json({success: false, error: "Missing or invalid authorization type"});
        let user = await authorizeUser(req.headers.authorization);
        if (!user) return res.status(401).json({success: false, error: "Invalid authorization header"});

        const result = await db_users.findByIdAndUpdate(user._id, {
            $pull: {
                tokens: {
                    $elemMatch: {
                        _id: {
                            $ne: user.current_session_id
                        }
                    }
                }
            }
        }, { new: true });
        return res.status(200).json({
            success: true,
            data: formatUserResponse(result)
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
web_server.post("/api/account/verify-email", async (req, res) => {
    try {
        if (!req.headers.authorization || !req.headers.authorization.startsWith("User")) return res.status(401).json({success: false, error: "Missing or invalid authorization type"});
        let user = await authorizeUser(req.headers.authorization);
        if (!user) return res.status(401).json({success: false, error: "Invalid authorization header"});
        if (!req.body.code) return res.status(401).json({success: false, errror: "Missing verification code"});
        if (!user.email_verification) return res.status(401).json({success: false, error: "Email as already verified"});
        if (user.email_verification.code !== req.body.code) return res.status(403).json({success: false, error: "Invalid verification code"});
        let result = await db_users.findByIdAndUpdate(user._id, {
            email: user.email_verification.update_address,
            email_verified: true,
            email_verification: {}
        }, { new: true });

        return res.status(200).json({
            success: true,
            data: formatUserResponse(result)
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//GET ALL TLDS
web_server.get("/api/tlds", async (req, res) => {
    try {
        let user = req.headers.authorization ? await authorizeUser(req.headers.authorization) : null;
        const request = await sendDNSRequest("tlds", "GET", await getDNSOptions(req.headers.authorization));
        if (request.status !== 200) return res.status(request.status).json({success: false, error: request.error});
        let tlds = request.data;
        if (tlds?.can_register?.reserved) tlds.can_register.reserved = tlds.can_register.reserved.filter(x => user && user.reserved_tlds.includes(x));
        return res.status(200).json({
            success: true,
            data: tlds
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//GET ALL DOMAINS
web_server.get("/api/domains", async (req, res) => {
    try {
        const params = new URLSearchParams(req.query);
        const request = await sendDNSRequest(`domains/?${params.toString()}`, "GET", await getDNSOptions(req.headers.authorization));
        if (request.status !== 200) return res.status(request.status).json({success: false, error: request.error});
        return res.status(200).json({
            success: true,
            data: request.data
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//GET A DOMAIN
web_server.get("/api/domains/:domain", async (req, res) => {
    try {
        const request = await sendDNSRequest(`domains/${req.params.domain}`, "GET", await getDNSOptions(req.headers.authorization, true));
        if (request.status !== 200) return res.status(request.status).json({success: false, error: request.error});
        return res.status(200).json({
            success: true,
            data: request.data
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//REGISTER A DOMAIN
web_server.put("/api/domains/:domain", bruteforce_register.prevent, async (req, res) => {
    try {
        const captchaCheck = consumeCaptcha(req.body.captcha_token);
        if (!captchaCheck) return res.status(400).send({success: false, error: "Invalid captcha"});
        if (!req.body.target) return res.status(400).json({success: false, error: "You must provide a target location for the domain"});
        if (!req.headers.authorization) return res.status(401).json({success: false, error: "Missing authorization header"});
        const user = await authorizeUser(req.headers.authorization);
        if (!user) return res.status(401).json({success: false, error: "Invalid authorization header"});
        if (user.suspended) return res.status(401).json({success: false, error: "You are suspended"});
        
        const domain_name = req.params.domain.toLowerCase();
        const name = domain_name.split(".")[0], tld = domain_name.split(".")[1];
        if (name.length < DOMAIN_MIN_LENGTH || name.length > DOMAIN_MAX_LENGTH) return res.status(400).json({success: false, error: `Domain length must be between ${DOMAIN_MIN_LENGTH} and ${DOMAIN_MAX_LENGTH}`});
        if (!DOMAIN_REGEX.test(name)) return res.status(400).json({success: false, error: "Domain must only contain letters, numbers, and hyphens"});
        if (!user.reserved_tlds.includes(tld)) {
            const tldCheck = await db_users.find({
                reserved_tlds: {
                    $elemMatch: {$eq: tld}
                }
            });
            if (tldCheck.find(x => x.reserved_tlds.includes(tld))) return res.status(400).json({success: false, error: "This TLD is reserved for a different user"});
        };

        const request = await sendDNSRequest(`domains/${req.params.domain}`, "PUT", {user_id: user._id}, {
            target: req.body.target,
            searchable: req.body.searchable,
            note: req.body.note ?? "",
        });
        if (request.status !== 200) return res.status(request.status).json({success: false, error: request.error});
        await db_users.findByIdAndUpdate(request.data.owned_by.user, {
            $addToSet: {
                owned_domains: `${request.data.name}.${request.data.tld}`
            }
        });
        return res.status(200).json({
            success: true,
            data: request.data
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//EDIT A DOMAIN
web_server.patch("/api/domains/:domain", bruteforce_write.prevent, async (req, res) => {
    try {
        if (!req.headers.authorization) return res.status(401).json({success: false, error: "Missing authorization header"});
        const options = await getDNSOptions(req.headers.authorization, true);
        if (!options) return res.status(401).json({success: false, error: "Invalid authorization header"});
        const request = await sendDNSRequest(`domains/${req.params.domain}`, "PATCH", options, req.body);
        if (request.status !== 200) return res.status(request.status).json({success: false, error: request.error});
        return res.status(200).json({
            success: true,
            data: request.data
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//DELETE A DOMAIN
web_server.delete("/api/domains/:domain", bruteforce_write.prevent, async (req, res) => {
    try {
        if (!req.headers.authorization) return res.status(401).json({success: false, error: "Missing authorization header"});
        const options = await getDNSOptions(req.headers.authorization, true);
        if (!options) return res.status(401).json({success: false, error: "Invalid authorization header"});
        const request = await sendDNSRequest(`domains/${req.params.domain}`, "DELETE", options);
        if (request.status !== 200) return res.status(request.status).json({success: false, error: request.error});
        await db_users.findByIdAndUpdate(request.data.owned_by.user, {
            $pull: {
                owned_domains: `${request.data.name}.${request.data.tld}`
            }
        });
        return res.status(200).json({
            success: true,
            data: request.data
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//CREATE A RECORD (SUBDOMAIN)
web_server.put("/api/domains/:domain/records/:record", bruteforce_write.prevent, async (req, res) => {
    try {
        if (!req.body.target) return res.status(400).json({success: false, error: "You must provide a target location for the domain"});
        if (req.params.name.length < DOMAIN_MIN_LENGTH || req.params.name.length > DOMAIN_MAX_LENGTH) return res.status(400).json({success: false, error: `Subdomain length must be between ${DOMAIN_MIN_LENGTH} and ${DOMAIN_MAX_LENGTH}`});
        if (!RECORD_REGEX.test(req.params.name)) return res.status(400).json({success: false, error: "Subdomain must only contain letters, numbers, and hyphens & dots"});
        if (!req.headers.authorization) return res.status(401).json({success: false, error: "Missing authorization header"});
        const options = await getDNSOptions(req.headers.authorization, true);
        if (!options) return res.status(401).json({success: false, error: "Invalid authorization header"});

        const request = await sendDNSRequest(`domains/${req.params.domain}/records/${req.params.record}`, "PUT", options, {
            target: req.body.target,
            searchable: req.body.searchable,
        });
        if (request.status !== 200) return res.status(request.status).json({success: false, error: request.error});
        return res.status(200).json({
            success: true,
            data: request.data
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//UPDATE A RECORD (SUBDOMAIN)
web_server.patch("/api/domains/:domain/records/:record", bruteforce_write.prevent, async (req, res) => {
    try {
        if (!req.headers.authorization) return res.status(401).json({success: false, error: "Missing authorization header"});
        const options = await getDNSOptions(req.headers.authorization, true);
        if (!options) return res.status(401).json({success: false, error: "Invalid authorization header"});
        const request = await sendDNSRequest(`domains/${req.params.domain}/records/${req.params.record}`, "PATCH", options, req.body);
        if (request.status !== 200) return res.status(request.status).json({success: false, error: request.error});
        return res.status(200).json({
            success: true,
            data: request.data
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
//DELETE A RECORD (SUBDOMAIN)
web_server.delete("/api/domains/:domain/records/:record", bruteforce_write.prevent, async (req, res) => {
    try {
        if (!req.headers.authorization) return res.status(401).json({success: false, error: "Missing authorization header"});
        const options = await getDNSOptions(req.headers.authorization, true);
        if (!options) return res.status(401).json({success: false, error: "Invalid authorization header"});
        const request = await sendDNSRequest(`domains/${req.params.domain}/records/${req.params.record}`, "DELETE", options);
        if (request.status !== 200) return res.status(request.status).json({success: false, error: request.error});
        return res.status(200).json({
            success: true,
            data: request.data
        });
    } catch(e) {
        console.log(e);
        log(`# Failed to handle request\n\`${req.method} ${req.originalUrl}\`\n\`\`\`${e.toString()}\`\`\`\n\`\`\`${e.stack}\`\`\``, "error");
        return res.status(500).json({
            success: false,
            error: e.toString()
        });
    };
});
