const cookies = document.cookie.split(";").map(x => x.trim());
const token = cookies.find(x => x.startsWith("wxp_token="));
if (!token || !token.split("=")[1]) document.location = "/login";
let current_username;

document.addEventListener("DOMContentLoaded", async() => {
    try {
        const usernameInput = document.querySelectorAll("[data-username-input]");
        for (let x of usernameInput) {
            x.addEventListener("input", async() => {
                const regex = new RegExp(`[^a-z0-9-_]`, "g");
                x.value = x.value.toLowerCase().replaceAll(' ', '-').replace(regex, '');
            });
        };

        const request = await fetch("/api/account", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `User ${token.split("=")[1]}`
            }
        });
        if (request.status == 401) document.location = "/login";
        if (request.status != 200) {
            return alert(`Something went wrong. Please try again (${request.status})`);
        };
        const result = await request.json();

        displayAccount(result.data);
        if (result.data.owned_domains?.length > 0) document.querySelector("#deleteAccountButton").remove();

        document.querySelector("#accountLoader").remove();

        const usernameForm = document.querySelector("#updateUsernameForm");
        usernameForm.addEventListener("submit", async e => {
            e.preventDefault();
            const button = usernameForm.querySelector("button[type='submit']");
            if (button.dataset.actionState === "loading") return;
            button.dataset.actionState = "loading";
            const error = usernameForm.querySelector(".form-result");
            error.innerText = "";
            error.style.color = "";
            try {
                const username = document.querySelector("#updateUsernameInput");
                const verify_password = document.querySelector("#updateUsernamePassword");
                let invalid = false;
                if (!username.validity.valid) {
                    invalid = true;
                    username.classList.add("input-error");
                };
                if (!verify_password.validity.valid) {
                    invalid = true;
                    verify_password.classList.add("input-error");
                };
                if (!invalid) {
                    const result = await updateAccount({username, verify_password}, error);
                    if (result) document.querySelector("#updateUsernameModal").close();
                };
            } catch (e) {
                console.error(e);
                error.innerText = e.message;
            };
            button.dataset.actionState = "save";
        });

        const emailForm = document.querySelector("#updateEmailForm");
        emailForm.addEventListener("submit", async e => {
            e.preventDefault();
            const button = emailForm.querySelector("button[type='submit']");
            if (button.dataset.actionState === "loading") return;
            button.dataset.actionState = "loading";
            const error = emailForm.querySelector(".form-result");
            error.innerText = "";
            error.style.color = "";
            try {
                const email = document.querySelector("#updateEmailInput");
                const verify_password = document.querySelector("#updateEmailPassword");
                let invalid = false;
                if (!email.validity.valid) {
                    invalid = true;
                    email.classList.add("input-error");
                };
                if (!verify_password.validity.valid) {
                    invalid = true;
                    verify_password.classList.add("input-error");
                };
                if (!invalid) {
                    const result = await updateAccount({email, verify_password}, error);
                    if (result) {
                        document.querySelector("#updateEmailModal").close();
                        document.querySelector("#verifyEmailModal").showModal();

                    };
                };
            } catch (e) {
                console.error(e);
                error.innerText = e.message;
            };
            button.dataset.actionState = "save";
        });

        const passwordForm = document.querySelector("#updatePasswordForm");
        passwordForm.addEventListener("submit", async e => {
            e.preventDefault();
            const button = passwordForm.querySelector("button[type='submit']");
            if (button.dataset.actionState === "loading") return;
            button.dataset.actionState = "loading";
            const error = passwordForm.querySelector(".form-result");
            error.innerText = "";
            error.style.color = "";
            try {
                const password = document.querySelector("#updatePasswordInput");
                const confirm_password = document.querySelector("#updatePasswordConfirm");
                const verify_password = document.querySelector("#updatePasswordPassword");
                let invalid = false;
                if (!password.validity.valid) {
                    invalid = true;
                    password.classList.add("input-error");
                };
                if (confirm_password.value !== password.value) {
                    invalid = true;
                    confirm_password.classList.add("input-error");
                    error.innerText = "Passwords do not match";
                };
                if (!verify_password.validity.valid) {
                    invalid = true;
                    verify_password.classList.add("input-error");
                };
                if (!invalid) {
                    const result = await updateAccount({password, verify_password}, error);
                    if (result) document.querySelector("#updatePasswordModal").close();
                };
            } catch (e) {
                console.error(e);
                error.innerText = e.message;
            };
            button.dataset.actionState = "save";
        });

        const emailVerifyForm = document.querySelector("#verifyEmailForm");
        emailVerifyForm.addEventListener("submit", async e => {
            e.preventDefault();
            const button = emailVerifyForm.querySelector("button[type='submit']");
            if (button.dataset.actionState === "loading") return;
            button.dataset.actionState = "loading";
            const error = emailVerifyForm.querySelector(".form-result");
            error.innerText = "";
            error.style.color = "";
            try {
                const code = document.querySelector("#verifyEmailInput");
                let invalid = false;
                if (!code.validity.valid) {
                    invalid = true;
                    code.classList.add("input-error");
                };
                if (!invalid) {
                    const request = await fetch("/api/account/verify-email", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `User ${token.split("=")[1]}`
                        },
                        body: JSON.stringify({
                            code: code.value
                        }),
                    });
                    if (request.status === 400) {
                        code.classList.add("input-error");
                    } else if (request.status === 401) {
                        document.location = "/login";
                    } else if (request.status === 403) {
                        error.innerText = "Incorrect code";
                        code.classList.add("input-error");
                    } else if (request.status === 200) {
                        error.innerText = "Email verified";
                        error.style.color = "var(--wxp-clr-success-400)";
                        const result = await request.json();
                        displayAccount(result.data);
                        document.querySelector("#verifyEmailModal").close();
                    } else {
                        error.innerText = `Request failed (${request.status})`;
                    };
                };
            } catch (e) {
                console.error(e);
                error.innerText = e.message;
            };
            button.dataset.actionState = "save";
        });

        const deleteAccountForm = document.querySelector("#deleteAccountForm");
        deleteAccountForm.addEventListener("submit", async event => {
            event.preventDefault();
            const button = deleteAccountForm.querySelector("button[type='submit']");
            if (button.dataset.actionState === "loading") return;
            button.dataset.actionState = "loading";
            const error = deleteAccountForm.querySelector(".form-result");
            error.innerText = "";
            error.style.color = "";
            try {
                const username = document.querySelector("#deleteAccountUsername");
                const verify_password = document.querySelector("#deleteAccountPassword");
                let invalid = false;
                if (!username.validity.valid || username.value !== current_username) {
                    invalid = true;
                    username.classList.add("input-error");
                };
                if (!verify_password.validity.valid) {
                    invalid = true;
                    verify_password.classList.add("input-error");
                };
                if (!confirm("Are you sure you want to delete your account?")) invalid = true;
                const request = await fetch("/api/account", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `User ${token.split("=")[1]}`
                    },
                    body: JSON.stringify({
                        verify_password: verify_password.value
                    }),
                });
                if (request.status === 401) {
                    document.location = "/login";
                } else if (request.status === 403) {
                    error.innerText = "Incorrect password";
                } else if (request.status === 409) {
                    error.innerText = "You must first unregister all your domains";
                } else if (request.status === 200) {
                    error.innerText = "Account deleted";
                    error.style.color = "var(--wxp-clr-success-400)";
                    document.querySelector("#deleteAccountModal").close();
                    document.cookie = `auth=; path=/; expires=${new Date()}`;
                    document.location = "/";
                } else {
                    error.innerText = `Request failed (${request.status})`;
                };
            } catch (e) {
                console.error(e);
                error.innerText = e.message;
            };
            button.dataset.actionState = "save";
        });
        const clearSessionButton = document.querySelector("#sessionLogoutButton");
        clearSessionButton.addEventListener("click", async() => {
            if (clearSessionButton.dataset.actionState === "loading") return;
            clearSessionButton.dataset.actionState = "loading";
            try {
                if (!confirm("Are you sure you want to clear all your sessions?\nThis will log you out of all devices except the one you are currently using")) return;
                const request = await fetch("/api/account/sessions", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `User ${token.split("=")[1]}`
                    },
                });
                if (request.status === 401) {
                    document.location = "/login";
                } else if (request.status === 200) {
                    alert("Sessions cleared");
                } else {
                    console.error(request);
                    alert(`Failed to clear sessions\nRequest failed (${request.status})`);
                };
            } catch (e) {
                console.error(e);
                alert(`Failed to clear sessions\n${e.message}`);
            };
            clearSessionButton.dataset.actionState = "save";
        });
    } catch (e) {
        console.error(e);
        error.innerText = e.message;
    };
});

function displayAccount(user) {
    current_username = user.username;
    document.querySelector("#accountUsername").innerText = user.username;
    if (user.email_verification?.update_address) {
        document.querySelector("#accountEmail").innerText = user.email_verification.update_address;
        if (user.email) {
            document.querySelector("#accountEmailPending").style.display = "block";
            document.querySelector("#accountEmailPendingPrevious").innerText = user.email;
        } else {
            document.querySelector("#accountEmailPending").style.display = "none";
        };
        document.querySelector("#accountEmailVerify").style.display = "block";
        document.querySelector("#accountEmailChange").style.display = "none";
    } else {
        document.querySelector("#accountEmail").innerText = user.email ?? "No email set";
        if (!user.email) document.querySelector("#accountEmailChange").innerText = "Add";
    };
};

async function updateAccount(fields, error) {
    const body = {...fields};
    for (let x in body) {
        body[x] = body[x].value;
    };
    const request = await fetch("/api/account", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `User ${token.split("=")[1]}`
        },
        body: JSON.stringify(body),
    });
    if (request.status === 400) {
        const result = await request.json();
        if (result.error === "Must verify your password") {
            error.innerText = "Incorrect password";
            fields.verify_password.classList.add("input-error");
        } else {
            error.innerText = result.error;
        };
    } else if (request.status === 401) {
        document.location = "/login";
    } else if (request.status === 403) {
        error.innerText = "Incorrect password";
        fields.verify_password.classList.add("input-error");
    } else if (request.status === 409) {
        const result = await request.json();
        if (result.error === "Username already exists") {
            error.innerText = "Username taken";
            fields.username.classList.add("input-error");
        } else if (result.error === "Email already exists") {
            error.innerText = "Email already exists";
            fields.email.classList.add("input-error");
        } else {
            error.innerText = "That already exists";
        };
    } else if (request.status === 200) {
        error.innerText = "Changes saved";
        error.style.color = "var(--wxp-clr-success-400)";
        const result = await request.json();
        displayAccount(result.data);
        return true;
    } else {
        error.innerText = `Request failed (${request.status})`;
    };
    return false;
};