const domains_per_page = 10;
let current_page = 0, record_create_domain = "";

const cookies = document.cookie.split(";").map(x => x.trim());
const token = cookies.find(x => x.startsWith("wxp_token="));
if (!token || !token.split("=")[1]) document.location = "/login";

document.addEventListener("DOMContentLoaded", async() => {
    const container = document.querySelector("#domainList");
    try {
        const registerButton = document.querySelector(".domain-create");
        registerButton.addEventListener("click", async() => {
            turnstile.render(".cf-turnstile", {
                sitekey: "0x4AAAAAAAbvf74ep4tJrq3W",
                callback: captchaVerify
            });
        });

        const domainInput = document.querySelectorAll("[data-domain-input]");
        for (let x of domainInput) {
            x.addEventListener("input", async() => {
                const regex = new RegExp(`[^a-z0-9-${x.dataset.domainInput === "subdomain" ? "." : ""}]`, "g");
                x.value = x.value.toLowerCase().replaceAll(' ', '-').replace(regex, '');
            });
        };

        if (sessionStorage.getItem("domain_create_key")) {
            const notice = document.createElement("div");
            notice.classList.add("domain-created");
            notice.innerHTML = `
                <div class="flex v-center gap-050">
                    <h3 class="h5">Domain Key</h3>
                    <button class="push-right nostyles pointer" onclick="this.closest('.domain-created').remove()">
                        <i class="bx bx-x"></i>
                    </button>
                </div>
                <p>Here is the Domain Key for <b>${sessionStorage.getItem("domain_create_name") ?? "domain"}</b>. Keep it somewhere safe as you won't be able to view it again</p>
                <div class="flex v-center gap-100">
                    <p><code>${sessionStorage.getItem("domain_create_key")}</code></p>
                    <button class="nostyles pointer" onclick="navigator.clipboard.writeText('${sessionStorage.getItem("domain_create_key")}')">
                        <i class="bx bx-copy"></i>
                    </button>
                </div>
            `;
            sessionStorage.removeItem("domain_create_key");
            sessionStorage.removeItem("domain_create_name");
            document.querySelector("#domainList").insertBefore(notice, document.querySelector("#domainContainer"));
        };

        const registerForm = document.querySelector("#domainRegisterForm");
        registerForm.addEventListener("submit", async e => {
            e.preventDefault();
            const button = registerForm.querySelector("button[type='submit']");
            if (button.dataset.actionState === "loading") return;
            button.dataset.actionState = "loading";
            const error = registerForm.querySelector(".form-result");
            error.innerText = "";
            try {
                const name = document.querySelector("#domainRegisterName");
                const tld = document.querySelector("#domainRegisterTld");
                const target = document.querySelector("#domainRegisterTarget");
                let invalid = false;
                if (!name.validity.valid) {
                    invalid = true;
                    name.classList.add("input-error");
                };
                if (!tld.validity.valid) {
                    invalid = true;
                    tld.classList.add("input-error");
                };
                if (!target.validity.valid) {
                    invalid = true;
                    target.classList.add("input-error");
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
                    const request = await fetch(`/api/domains/${name.value}.${tld.value}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `User ${token.split("=")[1]}`
                        },
                        body: JSON.stringify({
                            target: target.value,
                            note: document.querySelector("#domainRegisterNote").value,
                            searchable: document.querySelector("#domainRegisterSearchable").checked,
                            captcha_token: captcha_result_token,
                        }),
                    });
                    if (request.status === 400) {
                        error.innerText = "Invalid domain name or TLD";
                    } else if (request.status === 409) {
                        error.innerText = "Domain already exists";
                        name.classList.add("input-error");
                    } else if (request.status === 200) {
                        error.innerText = "Domain registered";
                        error.style.color = "var(--wxp-clr-success-400)";
                        const data = await request.json();
                        sessionStorage.setItem("domain_selected_reload", data.data._id);
                        sessionStorage.setItem("domain_create_key", data.data.secret);
                        sessionStorage.setItem("domain_create_name", `${data.data.name}.${data.data.tld}`);
                        location.reload();
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

        const recordCreateForm = document.querySelector("#recordCreateForm");
        recordCreateForm.addEventListener("submit", async e => {
            e.preventDefault();
            const button = recordCreateForm.querySelector("button[type='submit']");
            if (button.dataset.actionState === "loading") return;
            button.dataset.actionState = "loading";
            const error = recordCreateForm.querySelector(".form-result");
            error.innerText = "";
            try {
                const name = document.querySelector("#recordCreateName");
                const target = document.querySelector("#recordCreateTarget");
                let invalid = false;
                if (!name.validity.valid) {
                    invalid = true;
                    name.classList.add("input-error");
                };
                if (!target.validity.valid) {
                    invalid = true;
                    target.classList.add("input-error");
                };
                if (!record_create_domain) {
                    invalid = true;
                    error.innerText = "No domain selected. Please reload and try again";
                }
                if (!invalid) {
                    const request = await fetch(`/api/domains/${record_create_domain}/records/${name.value}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `User ${token.split("=")[1]}`
                        },
                        body: JSON.stringify({
                            target: target.value,
                            searchable: document.querySelector("#recordCreateSearchable").checked,
                        }),
                    });
                    if (request.status === 400) {
                        error.innerText = "Missing or invalid parameters";
                        name.classList.add("input-error");
                        target.classList.add("input-error");
                    } else if (request.status === 401) {
                        document.location = "/login";
                    } else if (request.status === 404) {
                        location.reload();
                    } else if (request.status === 409) {
                        error.innerText = "Subdomain already exists";
                        name.classList.add("input-error");
                    } else if (request.status === 200) {
                        error.innerText = "Subdomain registered";
                        error.style.color = "var(--wxp-clr-success-400)";
                        sessionStorage.setItem("domain_selected_reload", record_create_domain);
                        location.reload();
                    }
                };
            } catch (e) {
                console.error(e);
                error.innerText = e.message;
            };
            button.dataset.actionState = "save";
        });

        loadTlds();

        const request = await fetch("/api/domains/?owned=true", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `User ${token.split("=")[1]}`
            }
        });
        if (request.status == 401) document.location = "/login";
        if (request.status != 200) {
            container.innerHTML = `<p class="domain-error | text-center">Error loading domains (${request.status})</p>`;
            return;
        };
        const result = await request.json();

        document.querySelector("#domainPageCount").innerText = result.data.length;
        
        if (sessionStorage.getItem("domain_selected_reload")) {
            const sorted = sortDomains(result.data);
            const index = sorted.findIndex(x => x._id === sessionStorage.getItem("domain_selected_reload"));
            const page = Math.ceil(index / domains_per_page);
            current_page = page;
            renderPage(result.data);

            const domain = document.querySelector(`[data-domain-id="${sessionStorage.getItem("domain_selected_reload")}"]`);
            if (!domain) return;
            domain.setAttribute("aria-expanded", true);
            sessionStorage.removeItem("domain_selected_reload");
        } else {
            renderPage(result.data);
        };

        const domainSearch = document.querySelector("#domainSearch");
        domainSearch.addEventListener("input", () => renderPage(result.data));

        const domainSortInputs = document.querySelectorAll("[name='domainSort']");
        for (let x of domainSortInputs) x.addEventListener("change", () => renderPage(result.data));

        const domainPageControls = document.querySelector(".domain-page-controls");
        domainPageControls.addEventListener("click", e => {
            const pageButton = e.target;
            if (pageButton.closest(".domain-page-control")) {
                const page = pageButton.closest(".domain-page-control").getAttribute("data-page");
                if (page === "next") current_page = Math.min(current_page + 1, Math.ceil(result.data.length / domains_per_page) - 1);
                else if (page === "previous") current_page = Math.max(current_page - 1, 0);
                else current_page = parseInt(page);

                renderPage(result.data);
            };
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = `<p class="domain-error | text-center">Error loading domains<br>${e.message}</p>`;
    };
});

function mapDomain(x, i) {
    return `<div class="domain-card" data-domain-id="${x._id}" data-domain-name="${x.name}.${x.tld}" aria-expanded="false" ${i >= domains_per_page ? `style="display: none"` : ""}>
        <div class="domain-header | flex v-center">
            <div class="domain-expand">
                <button class="domain-expand-button | nostyles" data-domain-expand="${x._id}">
                    <i class="bx bx-chevron-right"></i>
                </button>
            </div>
            <div class="domain-details">
                <h3 class="h3">${x.name}<span class="domain-tld">.${x.tld}</span></h3>
                <div class="flex v-center gap-050">
                    <p class="domain-note" data-domain-field="note">${x.note ?? ""}</p>
                    <button class="domain-edit-button | nostyles pointer" data-domain-edit="note" data-action-state="edit">
                        <i class="bx bx-pencil"></i>
                    </button>
                </div>
            </div>
        </div>
        <div class="domain-body">
            <p class="domain-heading">Target</p>
            <div class="flex v-center gap-050">
                <p class="domain-target" data-domain-field="target">${x.target}</p>
                <button class="domain-edit-button | nostyles pointer" data-domain-edit="target" data-action-state="edit">
                    <i class="bx bx-pencil"></i>
                </button>
            </div>
            <p class="domain-heading">Searchable</p>
            <div class="flex v-center gap-100">
                <label class="toggle">
                    <input type="checkbox" data-domain-field="searchable" id="domain_${x._id}_searchable" ${x.searchable ? "checked" : ""}>
                    <span aria-hidden="true"></span>
                </label>
                <label for="domain_${x._id}_searchable" class="toggle-label | flex v-center gap-050">
                    <p>Searchable</p>
                    <p class="domain-edit-button" data-action-state="edit" data-domain-status="searchable">
                        <i class="bx bx-pencil"></i>
                    </p>
                </label>
            </div>
            <p class="input-note">Disable to hide your website from searches and bulk domain listing. Your domain will still be accessible via the the URL</p>
            <div class="flex v-center gap-100">
                <p class="domain-heading">Subdomains</p>
                <button class="domain-create | push-right nostyles pointer" data-domain-action="record_create">
                    <span>Add Subdomain</span>
                </button>
            </div>
            <table>
                <thead class="sr-only">
                    <tr>
                        <th>Name</th>
                        <th>Target</th>
                        <th>Searchable</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>${x.records.map(y => `<tr data-record-id="${y._id}" data-record-name="${y.name}" data-record-full="${y.name}.${x.name}.${x.tld}">
                        <td>
                        <span class="record-name">${y.name}</span>
                        <span class="record-domain">.${x.name}.${x.tld}</span>
                    </td>
                    <td>
                        <div class="flex v-center gap-050">
                            <p class="domain-target" data-record-field="target">${y.target}</p>
                            <button class="domain-edit-button | nostyles pointer" data-record-edit="target" data-action-state="edit">
                                <i class="bx bx-pencil"></i>
                            </button>
                        </div>
                    </td>
                    <td>
                        <div class="flex v-center gap-100">
                            <label class="toggle">
                                <input type="checkbox" data-record-field="searchable" id="domain_${x._id}_record_${y._id}_searchable" ${y.searchable ? "checked" : ""}>
                                <span aria-hidden="true"></span>
                            </label>
                            <label for="domain_${x._id}_record_${y._id}_searchable" class="toggle-label | flex v-center gap-050">
                                <p>Searchable</p>
                                <p class="domain-edit-button" data-action-state="edit" data-record-status="searchable">
                                    <i class="bx bx-pencil"></i>
                                </p>
                            </label>
                        </div>
                    </td>
                    <td>
                        <button class="domain-edit-button | nostyles pointer" data-domain-action="record_delete">
                            <i class="bx bx-trash"></i>
                        </button>
                    </td>
                </tr>`).join("")}</tbody>
            </table>
        </div>
    </div>`;
};

function sortDomains(domains) {
    let sort_by = document.querySelector("[name='domainSort']:checked");
    if (!sort_by) {
        sort_by = document.querySelector("[name='domainSort'][value='name']");
        sort_by.checked = true;
    };
    if (sort_by.value === "name") {
        return domains.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort_by.value === "tld") {
        return domains.sort((a, b) => a.tld.localeCompare(b.tld));
    } else if (sort_by.value === "created") {
        return domains.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sort_by.value === "updated") {
        return domains.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
    };
    return domains;
};
function searchDomains(domains) {
    const search = document.querySelector("#domainSearch");
    if (!search) return domains;
    return domains.filter(x => x.name.toLowerCase().includes(search.value.toLowerCase()) || x.tld.toLowerCase().includes(search.value.toLowerCase()));
}
function generatePage(domains) {
    const domainSearch = document.querySelector("#domainSearch");
    const term = domainSearch.value.toLowerCase();
    const search_results = domains.filter(x => x.name.toLowerCase().includes(term) || x.tld.toLowerCase().includes(term) || (x.note && x.note.toLowerCase().includes(term)));
    const sorted = sortDomains(search_results);
    return sorted;
};
function renderPage(domains) {
    const container = document.querySelector("#domainList");
    const generatedDomains = generatePage(domains);
    if (generatedDomains.length === 0) {
        container.innerHTML = `<p class="domain-error | text-center">No domains found</p>`;
        return;
    };
    container.innerHTML = generatedDomains.slice(current_page * domains_per_page, (current_page + 1) * domains_per_page).map(mapDomain).join("");
    addDomainListeners();
    document.querySelector("#domainPageStart").innerText = current_page * domains_per_page + 1;
    document.querySelector("#domainPageEnd").innerText = Math.min(generatedDomains.length, (current_page + 1) * domains_per_page);
    const pageCount = Math.ceil(generatedDomains.length / domains_per_page);
    const pageControls = document.querySelector(".domain-page-controls");
    Array.from(pageControls.children).forEach(x => {
        if (!isNaN(x.dataset.page)) pageControls.removeChild(x);
    });
    for (let x = 0; x < Math.max(pageCount, 1); x++) {
        const pageButton = document.createElement("button");
        pageButton.classList.add("domain-page-control");
        pageButton.classList.add("nostyles");
        pageButton.classList.add("pointer");
        pageButton.setAttribute("data-page", x);
        if (x === current_page) pageButton.setAttribute("data-page-current", "true");
        pageButton.innerText = x + 1;
        pageControls.insertBefore(pageButton, pageControls.querySelector(".domain-page-control[data-page='next']"));
    };
};

function addDomainListeners() {
    const domainExpandButtons = document.querySelectorAll(".domain-expand-button");
        for (let x of domainExpandButtons) {
            x.addEventListener("click", () => {
                const domain = document.querySelector(`[data-domain-id="${x.dataset.domainExpand}"]`);
                if (!domain) return;
                domain.setAttribute("aria-expanded", domain.getAttribute("aria-expanded") === "false");
            });
        };
    
        const domainEditButtons = document.querySelectorAll("[data-domain-edit]");
        for (let x of domainEditButtons) {
            x.addEventListener("click", async() => {
                const domain = x.closest(".domain-card");
                if (!domain) return;
                const field = domain.querySelector(`[data-domain-field="${x.dataset.domainEdit}"]`);
                if (!field) return;
                if (x.dataset.actionState === "edit") {
                    field.setAttribute("contenteditable", "true");
                    field.focus();
                    x.dataset.actionState = "save";
                    x.innerHTML = "<i class='bx bx-save'></i>";
                } else if (x.dataset.actionState === "save") {
                    field.setAttribute("contenteditable", "false");
                    x.dataset.actionState = "loading";
                    x.innerHTML = "<i class='bx bx-loader bx-spin'></i>";
    
                    const request = await fetch(`/api/domains/${domain.dataset.domainId}`, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `User ${token.split("=")[1]}`
                        },
                        body: JSON.stringify({
                            [x.dataset.domainEdit]: field.innerText,
                        }),
                    });
                    if (request.status === 400) {
                        field.classList.add("input-error");
                        field.setAttribute("contenteditable", "true");
                        x.dataset.actionState = "save";
                        x.innerHTML = "<i class='bx bx-save'></i>";
                    } else if (request.status === 401) {
                        document.location = "/login";
                    } else if (request.status === 404) {
                        location.reload();
                    } else if (request.status === 200) {
                        x.dataset.actionState = "edit";
                        x.innerHTML = "<i class='bx bx-pencil'></i>";
                    } else {
                        console.log(request);
                        console.log(await request.json());
                        x.dataset.actionResult = request.status;
                        x.dataset.actionState = "error";
                        x.innerHTML = "<i class='bx bx-error'></i>";
                    };
                } else if (x.dataset.actionState === "error") {
                    alert(`Action failed with status (${x.dataset.actionResult})\nPlease see the console for more details`);
                };
            });
    
        };
    
        const domainToggleButtons = document.querySelectorAll(".toggle [data-domain-field]");
        for (let x of domainToggleButtons) {
            x.addEventListener("change", async() => {
                const domain = x.closest(".domain-card");
                if (!domain) return;
                const status = domain.querySelector(`[data-domain-status="${x.dataset.domainField}"]`);
                if (status.dataset.actionState === "edit") {
                    status.dataset.actionState = "loading";
                    status.innerHTML = "<i class='bx bx-loader bx-spin'></i>";
    
                    const request = await fetch(`/api/domains/${domain.dataset.domainId}`, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `User ${token.split("=")[1]}`
                        },
                        body: JSON.stringify({
                            [x.dataset.domainField]: x.checked,
                        }),
                    });
                    if (request.status === 400) {
                        x.closest(".toggle").classList.add("input-error");
                        status.dataset.actionState = "edit";
                        status.innerHTML = "<i class='bx bx-pencil'></i>";
                    } else if (request.status === 401) {
                        document.location = "/login";
                    } else if (request.status === 404) {
                        location.reload();
                    } else if (request.status === 200) {
                        status.dataset.actionState = "saved";
                        status.innerHTML = "<i class='bx bx-check'></i>";
                        setTimeout(() => {
                            status.dataset.actionState = "edit";
                            status.innerHTML = "<i class='bx bx-pencil'></i>";
                        }, 10_000);
                    } else {
                        console.log(request);
                        console.log(await request.json());
                        status.dataset.actionResult = request.status;
                        status.dataset.actionState = "error";
                        status.innerHTML = "<i class='bx bx-error'></i>";
                    };
                };
            });
        };
    
        const domainEditFields = document.querySelectorAll("[data-domain-field]");
        for (let x of domainEditFields) {
            x.addEventListener("click", () => {
                const domain = x.closest(".domain-card");
                if (!domain) return;
                const editButton = domain.querySelector(`[data-domain-edit="${x.dataset.domainField}"]`);
                if (!editButton) return;
                if (editButton.dataset.actionState != "edit") return;
                editButton.click();
            });
            x.addEventListener("keydown", e => {
                const domain = x.closest(".domain-card");
                if (!domain) return;
                const editButton = domain.querySelector(`[data-domain-edit="${x.dataset.domainField}"]`);
                if (!editButton) return;
                if (editButton.dataset.actionState != "save") return;
                if (x.key === "Enter" && !e.shiftKey) editButton.click();
            });
        };
    
        const recordEditButtons = document.querySelectorAll("[data-record-edit]");
        for (let x of recordEditButtons) {
            x.addEventListener("click", async() => {
                const record = x.closest("tr");
                const domain = x.closest(".domain-card");
                if (!record || !domain) return;
                const field = record.querySelector(`[data-record-field="${x.dataset.recordEdit}"]`);
                if (!field) return;
                if (x.dataset.actionState === "edit") {
                    field.setAttribute("contenteditable", "true");
                    x.dataset.actionState = "save";
                    x.innerHTML = "<i class='bx bx-save'></i>";
                } else if (x.dataset.actionState === "save") {
                    field.setAttribute("contenteditable", "false");
                    x.dataset.actionState = "loading";
                    x.innerHTML = "<i class='bx bx-loader bx-spin'></i>";
    
                    const request = await fetch(`/api/domains/${domain.dataset.domainId}/records/${record.dataset.recordName}`, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `User ${token.split("=")[1]}`
                        },
                        body: JSON.stringify({
                            [x.dataset.recordEdit]: field.innerText,
                        }),
                    });
                    if (request.status === 400) {
                        field.classList.add("input-error");
                        field.setAttribute("contenteditable", "true");
                        x.dataset.actionState = "save";
                        x.innerHTML = "<i class='bx bx-save'></i>";
                    } else if (request.status === 401) {
                        document.location = "/login";
                    } else if (request.status === 404) {
                        location.reload();
                    } else if (request.status === 200) {
                        x.dataset.actionState = "edit";
                        x.innerHTML = "<i class='bx bx-pencil'></i>";
                    } else {
                        console.log(request);
                        console.log(await request.json());
                        x.dataset.actionResult = request.status;
                        x.dataset.actionState = "error";
                        x.innerHTML = "<i class='bx bx-error'></i>";
                    };
                } else if (x.dataset.actionState === "error") {
                    alert(`Action failed with status (${x.dataset.actionResult})\nPlease see the console for more details`);
                };
            });
        };
        
        const recordDeleteButtons = document.querySelectorAll("[data-domain-action='record_delete']");
        for (let x of recordDeleteButtons) {
            x.addEventListener("click", async() => {
                const icon = x.querySelector("i");
                if (x.dataset.actionState === "loading") return;
                if (x.dataset.actionState === "error") {
                    alert(`Action failed with status (${x.dataset.actionResult})\nPlease see the console for more details`);
                    x.dataset.actionState = "delete";
                    icon.classList.remove("bx-error");
                    icon.classList.add("bx-trash");
                    return;
                };
                icon.classList.add("bx-loader");
                icon.classList.add("bx-spin");
                icon.classList.remove("bx-trash");
                x.dataset.actionState = "loading";
                try {
                    const record = x.closest("tr");
                    const domain = record.closest(".domain-card");
                    if (!domain) return;
                    if (!record) return;
                    if (!confirm(`Are you sure you want to delete the record for ${record.dataset.recordFull}?`)) return;
                    const request = await fetch(`/api/domains/${domain.dataset.domainId}/records/${record.dataset.recordName}`, {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `User ${token.split("=")[1]}`
                        },
                    });
                    if (request.status === 401) {
                        document.location = "/login";
                    } else if (request.status === 404) {
                        location.reload();
                    } else if (request.status === 200) {
                        return record.remove();
                    } else {
                        console.log(request.status);
                        icon.classList.add("bx-error");
                        x.dataset.actionResult = request.status;
                        x.dataset.actionState = "error";
                    };
                } catch (e) {
                    console.error(e);
                    icon.classList.add("bx-error");
                    x.dataset.actionResult = `${e.message}`;
                    x.dataset.actionState = "error";
                };
                icon.classList.remove("bx-loader");
                icon.classList.remove("bx-spin");
                if (x.dataset.actionState === "loading") x.dataset.actionState = "delete";
            });
        };

        const recordCreateButtons = document.querySelectorAll("[data-domain-action='record_create']");
        for (let x of recordCreateButtons) {
            x.addEventListener("click", async() => {
                const domain = x.closest(".domain-card");
                if (!domain) return;

                record_create_domain = domain.dataset.domainId;

                document.querySelector("#recordCreateDomain").innerText = `.${domain.dataset.domainName}`;
                document.querySelector("#recordCreateForm").reset();

                document.querySelector("#recordCreateModal").showModal();
            });
        };
}


async function loadTlds() {
    const request_tlds = await fetch("/api/tlds", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `User ${token.split("=")[1]}`
        }
    });
    if (request_tlds.status != 200) console.log("Error loading TLDs");
    const tlds = request_tlds.status == 200 ? (await request_tlds.json()).data : {};
    const labels = {
        real: "Real",
        webx: "WebX",
        custom: "WebX+",
        reserved: "Reserved",
    }
    document.querySelector("#domainRegisterTld").innerHTML = Object.keys(tlds).filter(x => x !== "all" && x !== "can_register").map(x => `<optgroup label="${labels[x]}">
            ${tlds[x === "reserved" ? "can_register" : x].sort((z, y) => z.localeCompare(y)).map(y => `<option value="${y}" ${y == "webx" ? "selected" : ""}>${y}</option>`).join("")}
    </optgroup>`).join("");
};
