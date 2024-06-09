document.addEventListener("DOMContentLoaded", async() => {
    loadListeners();
    let auth;
    for (let x of document.cookie.split(";")) {
        if (x.includes("wxp_token=")) {
            auth = x.split("=")[1];
        };
    };
    let logged_in = false;
    if (auth) logged_in = await loadAccount(auth);
    document.querySelector(logged_in ? "#navAccount .login-button" : "#navAccountDropdown").remove();
});

function loadListeners() {
    const dropdown_buttons = document.querySelectorAll(".dropdown-toggle");
    for (let x of dropdown_buttons) {
        x.addEventListener("click", e => {
            const dropdown = x.closest(".dropdown");
            dropdown.classList.toggle("show");
            dropdown.setAttribute("aria-expanded", dropdown.classList.contains("show"));
        });
    };

    const inputs = document.querySelectorAll("input");
    for (let x of inputs) {
        x.addEventListener("input", e => {
            if (x.validity.valid && x.closest(".input-error")) x.closest(".input-error").classList.remove("input-error");
        });
    };

    const modal_open = document.querySelectorAll("[data-modal-open]");
    for (let x of modal_open) {
        x.addEventListener("click", () => {
            const modal = document.querySelector(`#${x.dataset.modalOpen}`);
            if (!modal) return;
            modal.showModal();
        });
    };
    const modal_close = document.querySelectorAll("[data-modal-close]");
    for (let x of modal_close) {
        x.addEventListener("click", () => {
            const modal = document.querySelector(`#${x.dataset.modalClose}`);
            if (!modal) return;
            modal.close();
        });
    };
};


async function loadAccount(auth) {
    const request = await fetch("/api/account", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `User ${auth}`
        },
    });
    if (request.status != 200) return false;
    const data = await request.json();
    const user = data.data;
    document.querySelector("#navAccountName").innerText = user.username;
    document.querySelector("#navAccountLogout").addEventListener("click", async() => {
        const request = await fetch("/api/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `User ${auth}`
            },
            body: JSON.stringify({})
        });
        if (request.status != 200) return;
        document.cookie = `auth=; path=/; expires=${new Date()}`;
        location.reload();
    });
    return true;
};

let captcha_result_token;
async function captchaVerify(token) {
    const request = await fetch("/api/captcha", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({token}),
    });
    if (request.status === 200) {
        let result = await request.json();
        captcha_result_token = result.data.result_token;
        document.querySelector(".cf-turnstile").classList.remove("input-error");
    } else {
        captchaReset();
    };
};
function captchaReset() {
    captcha_result_token = null;
    turnstile.render(".cf-turnstile");
    document.querySelector(".cf-turnstile").classList.add("input-error");
};


window.addEventListener("click", e => {
    const dropdown = e.target.closest(".dropdown");
    for (let x of Array.from(document.querySelectorAll(".dropdown"))) {
        if (dropdown && dropdown.id == x.id && !e.target.closest(".dropdown-item")) continue; 
        x.classList.remove("show");
        x.setAttribute("aria-expanded", "false");
    };
});
window.addEventListener("click", e => {
    const target = e.target;
    if (target.tagName == "DIALOG") target.close();
});