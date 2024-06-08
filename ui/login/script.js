document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector("#loginForm");

    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const error = loginForm.querySelector(".form-result");
        error.innerText = "";
        try {
            const username = document.querySelector("#loginUsername");
            const password = document.querySelector("#loginPassword");
            let invalid = false;
            if (!username.value) {
                invalid = true;
                username.classList.add("input-error");
            };
            if (!password.value) {
                invalid = true;
                password.classList.add("input-error");
            };
            if (!captcha_result_token) {
                if (turnstile.getResponse()) {
                    await captchaVerify(turnstile.getResponse())
                } else {
                    invalid = true;
                    document.querySelector(".cf-turnstile").classList.add("input-error");
                };
            };
            if (!invalid) {
                const request = await fetch("/api/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username: username.value,
                        password: password.value,
                        captcha_token: captcha_result_token,
                    }),
                });
                if (request.status === 400) {
                    error.innerText = "Invalid captcha";
                } else if (request.status === 401) {
                    error.innerText = "Invalid password";
                    password.classList.add("input-error");
                } else if (request.status === 404) {
                    error.innerText = "Invalid username";
                    username.classList.add("input-error");
                } else if (request.status === 200) {
                    const data = await request.json();
                    document.cookie = `wxp_token=${data.data.generated_session.token}; path=/; expires=${new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toUTCString()}; sameSite=lax;`;
                    return document.location = "/domains";
                } else {
                    error.innerText = `Request failed (${request.status})`;
                };
            };
        } catch (e) {
            console.error(e);
            error.innerText = e.message;
        }
    });
});