const cookies = document.cookie.split(";").map(x => x.trim());
const token = cookies.find(x => x.startsWith("wxp_token="));
if (!token || !token.split("=")[1]) document.location = "/login";


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

    } catch (e) {
        console.error(e);
        alert(`Something went wrong. Please try again\n${e.message}`);
    };
});

function displayAccount(user) {
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
    console.log(body);
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