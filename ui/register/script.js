document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.querySelector("#registerForm");

    registerForm.addEventListener("submit", async e => {
        e.preventDefault();
        const button = registerForm.querySelector("button[type='submit']");
        if (button.dataset.actionState === "loading") return;
        button.dataset.actionState = "loading";
        const error = registerForm.querySelector(".form-result");
        error.innerText = "";
        try {
            const username = document.querySelector("#registerUsername");
            const password = document.querySelector("#registerPassword");
            const confirm = document.querySelector("#registerConfirmPassword");
            let invalid = false;
            if (!username.value) {
                invalid = true;
                username.classList.add("input-error");
            };
            if (!password.value) {
                invalid = true;
                password.classList.add("input-error");
            };
            if (!confirm.value) {
                invalid = true;
                confirm.classList.add("input-error");
            };
            if (confirm.value !== password.value) {
                invalid = true;
                confirm.classList.add("input-error");
                error.innerText = "Passwords do not match";
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
                const request = await fetch("/api/register", {
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
                } else if (request.status === 409) {
                    error.innerText = "Username already exists";
                    username.classList.add("input-error");
                } else if (request.status === 200) {
                    const data = await request.json();
                    document.cookie = `wxp_token=${data.data.generated_session.token}; path=/; expires=${new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toUTCString()}; sameSite=lax;`;
                    document.location = "/domains";
                } else {
                    const message = await request.json().catch(() => ({error: "Request failed"}));
                    error.innerText = `Failed to create account (${request.status})\n${message.error ?? ""}`;
                };
                turnstile.reset();
            };
        } catch (e) {
            console.error(e);
            error.innerText = `Failed to create account\n${e.message}`;
        };
        button.dataset.actionState = "save";
    });
});