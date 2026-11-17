
document.addEventListener("DOMContentLoaded", () => {

    const tenantsList =
        document.getElementById("tenantsList");

    const searchInput =
        document.getElementById("searchInput");

    const statusFilter =
        document.getElementById("statusFilter");

    const addTenantButton =
        document.getElementById("addTenantButton");

    const tenantModal =
        document.getElementById("tenantModal");

    const closeModalButton =
        document.getElementById("closeModalButton");

    const cancelButton =
        document.getElementById("cancelButton");

    const tenantForm =
        document.getElementById("tenantForm");

    const modalTitle =
        document.getElementById("modalTitle");

    const tenantIdInput =
        document.getElementById("tenantId");

    const fullNameInput =
        document.getElementById("fullName");

    const emailInput =
        document.getElementById("email");

    const phoneInput =
        document.getElementById("phone");

    const passportSeriesInput =
        document.getElementById("passportSeries");

    const passportNumberInput =
        document.getElementById("passportNumber");

    const passportIssuedAtInput =
        document.getElementById("passportIssuedAt");

    const statusInput =
        document.getElementById("status");

    const propertyIdInput =
        document.getElementById("propertyId");

    const notesInput =
        document.getElementById("notes");

    const formMessage =
        document.getElementById("formMessage");

    const tenantMessage =
        document.getElementById("tenantMessage");

    const totalTenants =
        document.getElementById("totalTenants");

    const activeTenants =
        document.getElementById("activeTenants");

    const assignedTenants =
        document.getElementById("assignedTenants");

    const saveTenantButton =
        document.getElementById("saveTenantButton");

    let tenants = [];

    let properties = [];

    function getToken() {

        return (
            localStorage.getItem("token") ||
            localStorage.getItem("authToken") ||
            localStorage.getItem("accessToken") ||
            localStorage.getItem("jwt")
        );

    }


    function getHeaders() {

        const token =
            getToken();

        return {

            "Content-Type":
                "application/json",

            ...(token
                ? {
                    "Authorization":
                        `Bearer ${token}`
                }
                : {})

        };

    }


    function checkAuth() {

        const token =
            getToken();

        if (!token) {

            window.location.href =
                "login.html";

            return false;

        }

        return true;

    }

    async function apiRequest(
        url,
        options = {}
    ) {

        let response;

        try {

            response =
                await fetch(
                    url,
                    {
                        ...options,

                        headers: {
                            ...getHeaders(),
                            ...(options.headers || {})
                        }
                    }
                );

        } catch (error) {

            throw new Error(
                "Не удалось подключиться к серверу. Проверьте, запущен ли npm start."
            );

        }


        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        let data = null;


        if (
            contentType.includes(
                "application/json"
            )
        ) {

            try {

                data =
                    await response.json();

            } catch (error) {

                data = null;

            }

        } else {

            try {

                const text =
                    await response.text();

                data = {
                    message:
                        text
                            ? text.substring(0, 300)
                            : null
                };

            } catch (error) {

                data = null;

            }

        }

        if (
            response.status === 401
        ) {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "authToken"
            );

            localStorage.removeItem(
                "accessToken"
            );

            localStorage.removeItem(
                "jwt"
            );

            localStorage.removeItem(
                "user"
            );


            window.location.href =
                "login.html";


            throw new Error(
                "Сессия истекла. Выполните вход снова."
            );

        }

        if (!response.ok) {

            let message =
                data?.message;


            if (!message) {

                if (
                    response.status === 404
                ) {

                    message =
                        `Маршрут ${url} не найден. Проверьте server.js.`;

                } else if (
                    response.status === 500
                ) {

                    message =
                        "Ошибка сервера. Проверьте терминал npm start.";

                } else {

                    message =
                        `Ошибка HTTP ${response.status}`;

                }

            }


            throw new Error(
                message
            );

        }


        return data;

    }

    async function loadData() {

        if (!checkAuth()) {

            return;

        }


        try {

            tenantsList.innerHTML = `
                <div class="loading">
                    Загрузка арендаторов...
                </div>
            `;


            const [
                tenantsData,
                propertiesData
            ] = await Promise.all([

                apiRequest(
                    "/api/tenants"
                ),

                apiRequest(
                    "/api/properties"
                )

            ]);


            tenants =
                Array.isArray(
                    tenantsData
                )
                    ? tenantsData
                    : [];


            properties =
                Array.isArray(
                    propertiesData
                )
                    ? propertiesData
                    : [];


            updateStatistics();

            renderPropertyOptions();

            renderTenants();

        } catch (error) {

            console.error(
                "Ошибка загрузки:",
                error
            );


            tenantsList.innerHTML = `
                <div class="empty-state">
                    ${escapeHtml(
                        error.message ||
                        "Не удалось загрузить данные"
                    )}
                </div>
            `;


            showMessage(
                error.message ||
                "Не удалось загрузить данные",
                true
            );

        }

    }

    function updateStatistics() {

        const total =
            tenants.length;


        const active =
            tenants.filter(
                tenant =>
                    tenant.status === "ACTIVE"
            ).length;


        const assigned =
            tenants.filter(
                tenant =>
                    Array.isArray(
                        tenant.properties
                    ) &&
                    tenant.properties.length > 0
            ).length;


        totalTenants.textContent =
            total;


        activeTenants.textContent =
            active;


        assignedTenants.textContent =
            assigned;

    }

    function renderPropertyOptions(
        selectedPropertyId = ""
    ) {

        propertyIdInput.innerHTML = `
            <option value="">
                Без объекта
            </option>
        `;


        const selectedTenantId =
            Number(
                tenantIdInput.value
            );


        properties.forEach(
            property => {

                const isAvailable =
                    property.status ===
                    "AVAILABLE";


                const isCurrentTenantProperty =
                    tenants.some(
                        tenant =>
                            tenant.id ===
                            selectedTenantId &&
                            Array.isArray(
                                tenant.properties
                            ) &&
                            tenant.properties.some(
                                item =>
                                    item.id ===
                                    property.id
                            )
                    );


                if (
                    !isAvailable &&
                    !isCurrentTenantProperty
                ) {

                    return;

                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    property.id;


                option.textContent =
                    `${property.name} — ${property.address}`;


                if (
                    String(
                        property.id
                    ) ===
                    String(
                        selectedPropertyId
                    )
                ) {

                    option.selected =
                        true;

                }


                propertyIdInput.appendChild(
                    option
                );

            }
        );

    }

    function getFilteredTenants() {

        const search =
            searchInput.value
                .trim()
                .toLowerCase();


        const status =
            statusFilter.value;


        return tenants.filter(
            tenant => {

                const fullName =
                    String(
                        tenant.fullName || ""
                    )
                        .toLowerCase();


                const email =
                    String(
                        tenant.email || ""
                    )
                        .toLowerCase();


                const phone =
                    String(
                        tenant.phone || ""
                    )
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    fullName.includes(
                        search
                    ) ||
                    email.includes(
                        search
                    ) ||
                    phone.includes(
                        search
                    );


                const matchesStatus =
                    status === "ALL" ||
                    tenant.status === status;


                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );

    }

    function renderTenants() {

        const filtered =
            getFilteredTenants();


        if (!filtered.length) {

            tenantsList.innerHTML = `

                <div class="empty-state">

                    <div
                        style="
                            margin-bottom: 12px;
                            color: var(--primary);
                        "
                    >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    </div>

                    <div>
                        ${
                            tenants.length
                                ? "По вашему запросу ничего не найдено"
                                : "Арендаторов пока нет"
                        }
                    </div>

                </div>

            `;

            return;

        }


        tenantsList.innerHTML =
            filtered
                .map(
                    tenant =>
                        createTenantCard(
                            tenant
                        )
                )
                .join("");

    }

    function createTenantCard(tenant) {
    const initials = getInitials(tenant.fullName);

    const isActive = tenant.status === "ACTIVE";

    const statusClass = isActive
        ? "status-active"
        : "status-inactive";

    const statusText = isActive
        ? "Активен"
        : "Неактивен";

    let propertyText = "Объект не закреплён";

    if (
        Array.isArray(tenant.properties) &&
        tenant.properties.length
    ) {
        const property = tenant.properties[0];

        propertyText = `${escapeHtml(property.name)} — ${escapeHtml(property.address)}`;
    }

    const accountButton = tenant.userId
        ? `
            <span class="account-created">
                Аккаунт создан
            </span>
        `
        : `
            <button
                type="button"
                class="account-button"
                data-action="account"
                data-id="${tenant.id}"
                ${tenant.email ? "" : "disabled"}
                title="${tenant.email ? "Создать аккаунт" : "Сначала укажите email"}"
            >
                Создать аккаунт
            </button>
        `;

    return `
        <article
            class="tenant-card"
            data-id="${tenant.id}"
        >
            <div class="tenant-main">
                <div class="tenant-avatar">
                    ${escapeHtml(initials)}
                </div>

                <div class="tenant-info">
                    <h3>
                        ${escapeHtml(tenant.fullName)}
                    </h3>

                    <div class="tenant-contact">
                        ${
                            tenant.email
                                ? `
                                    <span>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                        ${escapeHtml(tenant.email)}
                                    </span>
                                `
                                : ""
                        }

                        ${
                            tenant.phone
                                ? `
                                    <span>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                        ${escapeHtml(tenant.phone)}
                                    </span>
                                `
                                : ""
                        }
                    </div>

                    <div class="tenant-property">
                        Объект:

                        <strong>
                            ${propertyText}
                        </strong>
                    </div>
                </div>
            </div>

            <div class="tenant-side">
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>

                ${accountButton}

                <div class="tenant-actions">
                    <button
                        type="button"
                        class="icon-button"
                        data-action="edit"
                        data-id="${tenant.id}"
                        title="Редактировать"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>

                    <button
                        type="button"
                        class="icon-button delete"
                        data-action="delete"
                        data-id="${tenant.id}"
                        title="Удалить"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        </article>
    `;
}

    function openCreateModal() {

        tenantForm.reset();


        tenantIdInput.value =
            "";


        modalTitle.textContent =
            "Добавить арендатора";


        formMessage.textContent =
            "";


        renderPropertyOptions();


        tenantModal.classList.remove(
            "hidden"
        );


        setTimeout(
            () => {

                fullNameInput.focus();

            },
            50
        );

    }

    function openEditModal(
        tenantId
    ) {

        const tenant =
            tenants.find(
                item =>
                    item.id ===
                    Number(tenantId)
            );


        if (!tenant) {

            showMessage(
                "Арендатор не найден",
                true
            );

            return;

        }


        tenantIdInput.value =
            tenant.id;


        modalTitle.textContent =
            "Редактировать арендатора";


        fullNameInput.value =
            tenant.fullName || "";


        emailInput.value =
            tenant.email || "";


        phoneInput.value =
            tenant.phone || "";


        passportSeriesInput.value =
            tenant.passportSeries || "";


        passportNumberInput.value =
            tenant.passportNumber || "";


        statusInput.value =
            tenant.status ||
            "ACTIVE";


        notesInput.value =
            tenant.notes || "";


        passportIssuedAtInput.value =
            tenant.passportIssuedAt
                ? formatDateForInput(
                    tenant.passportIssuedAt
                )
                : "";


        let selectedPropertyId =
            "";


        if (
            Array.isArray(
                tenant.properties
            ) &&
            tenant.properties.length
        ) {

            selectedPropertyId =
                tenant.properties[0].id;

        }


        renderPropertyOptions(
            selectedPropertyId
        );


        formMessage.textContent =
            "";


        tenantModal.classList.remove(
            "hidden"
        );


        setTimeout(
            () => {

                fullNameInput.focus();

            },
            50
        );

    }

    function closeModal() {

        tenantModal.classList.add(
            "hidden"
        );


        tenantForm.reset();

        tenantIdInput.value =
            "";

        formMessage.textContent =
            "";

    }

    function validateDate(
        value
    ) {

        if (!value) {

            return true;

        }


        const date =
            new Date(
                `${value}T00:00:00`
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return false;

        }


        const year =
            date.getFullYear();


        if (
            year < 1900 ||
            year > new Date().getFullYear()
        ) {

            return false;

        }


        return true;

    }

    async function saveTenant(
        event
    ) {

        event.preventDefault();


        formMessage.textContent =
            "";


        const fullName =
            fullNameInput.value.trim();


        if (!fullName) {

            formMessage.textContent =
                "Введите ФИО арендатора";

            return;

        }


        const email =
            emailInput.value.trim();


        if (
            email &&
            !isValidEmail(email)
        ) {

            formMessage.textContent =
                "Введите корректный email";

            return;

        }


        const passportDate =
            passportIssuedAtInput.value;


        if (
            !validateDate(
                passportDate
            )
        ) {

            formMessage.textContent =
                "Введите корректную дату выдачи паспорта";

            return;

        }


        const selectedProperty =
            propertyIdInput.value;


        const data = {

            fullName,

            email,

            phone:
                phoneInput.value.trim(),

            passportSeries:
                passportSeriesInput.value.trim(),

            passportNumber:
                passportNumberInput.value.trim(),

            passportIssuedAt:
                passportDate || null,

            status:
                statusInput.value,

            propertyId:
                selectedProperty
                    ? Number(
                        selectedProperty
                    )
                    : null,

            notes:
                notesInput.value.trim()

        };


        const tenantId =
            tenantIdInput.value;


        const isEditing =
            Boolean(
                tenantId
            );


        const url =
            isEditing
                ? `/api/tenants/${tenantId}`
                : "/api/tenants";


        const method =
            isEditing
                ? "PUT"
                : "POST";


        const oldButtonText =
            saveTenantButton.textContent;


        try {

            saveTenantButton.disabled =
                true;


            saveTenantButton.textContent =
                "Сохранение...";


            console.log(
                "Отправка арендатора:",
                data
            );


            const result =
                await apiRequest(

                    url,

                    {

                        method,

                        body:
                            JSON.stringify(
                                data
                            )

                    }

                );


            console.log(
                "Ответ сервера:",
                result
            );


            closeModal();


            showMessage(
                result?.message ||
                (
                    isEditing
                        ? "Арендатор обновлён"
                        : "Арендатор добавлен"
                )
            );


            await loadData();

        } catch (error) {

            console.error(
                "Ошибка сохранения арендатора:",
                error
            );


            formMessage.textContent =
                error.message ||
                "Не удалось сохранить арендатора";

        } finally {

            saveTenantButton.disabled =
                false;


            saveTenantButton.textContent =
                oldButtonText;

        }

    }

    async function deleteTenant(
        tenantId
    ) {

        const tenant =
            tenants.find(
                item =>
                    item.id ===
                    Number(tenantId)
            );


        if (!tenant) {

            return;

        }


        const confirmed =
            window.confirm(
                `Удалить арендатора "${tenant.fullName}"?\n\n` +
                "Если за ним закреплён объект, " +
                "объект будет освобождён."
            );


        if (!confirmed) {

            return;

        }


        try {

            const result =
                await apiRequest(

                    `/api/tenants/${tenantId}`,

                    {

                        method:
                            "DELETE"

                    }

                );


            showMessage(
                result?.message ||
                "Арендатор удалён"
            );


            await loadData();

        } catch (error) {

            console.error(
                "Ошибка удаления:",
                error
            );


            showMessage(
                error.message ||
                "Не удалось удалить арендатора",
                true
            );

        }

    }

    async function createTenantAccount(tenantId, button) {
    const tenant = tenants.find(
        item => item.id === Number(tenantId)
    );

    if (!tenant) {
        showMessage("Арендатор не найден", true);
        return;
    }

    if (!tenant.email) {
        showMessage("Сначала укажите email арендатора", true);
        return;
    }

    if (tenant.userId) {
        showMessage("У арендатора уже есть аккаунт", true);
        return;
    }

    const password = window.prompt(
        `Создание аккаунта для ${tenant.fullName}\nВведите временный пароль (минимум 6 символов):`
    );

    if (password === null) {
        return;
    }

    if (password.length < 6) {
        showMessage("Пароль должен содержать минимум 6 символов", true);
        return;
    }

    const oldButtonText = button.textContent;

    try {
        button.disabled = true;
        button.textContent = "Создание...";

        const result = await apiRequest(
            `/api/tenants/${tenantId}/account`,
            {
                method: "POST",
                body: JSON.stringify({
                    password
                })
            }
        );

        showMessage(
            result?.message || "Аккаунт арендатора создан"
        );

        await loadData();
    } catch (error) {
        showMessage(
            error.message || "Не удалось создать аккаунт",
            true
        );

        button.disabled = false;
        button.textContent = oldButtonText;
    }
}

    function isValidEmail(
        email
    ) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(email);

    }

    addTenantButton.addEventListener(
        "click",
        openCreateModal
    );


    closeModalButton.addEventListener(
        "click",
        closeModal
    );


    cancelButton.addEventListener(
        "click",
        closeModal
    );


    tenantForm.addEventListener(
        "submit",
        saveTenant
    );


    searchInput.addEventListener(
        "input",
        renderTenants
    );


    statusFilter.addEventListener(
        "change",
        renderTenants
    );


    tenantsList.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-action]"
                );


            if (!button) {

                return;

            }


            const action =
                button.dataset.action;


            const id =
                button.dataset.id;


            if (
                action === "edit"
            ) {

                openEditModal(id);

            }


            if (
                action === "delete"
            ) {

                deleteTenant(id);

            }

            if (
                action === "account"
            ) {

                createTenantAccount(id, button);

            }

        }
    );


    tenantModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                tenantModal
            ) {

                closeModal();

            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                !tenantModal.classList.contains(
                    "hidden"
                )
            ) {

                closeModal();

            }

        }
    );

    const logoutLink =
        document.getElementById(
            "logoutLink"
        );


    if (logoutLink) {

        logoutLink.addEventListener(
            "click",
            event => {

                event.preventDefault();


                localStorage.removeItem(
                    "token"
                );

                localStorage.removeItem(
                    "authToken"
                );

                localStorage.removeItem(
                    "accessToken"
                );

                localStorage.removeItem(
                    "jwt"
                );

                localStorage.removeItem(
                    "user"
                );


                window.location.href =
                    "login.html";

            }
        );

    }

    function showMessage(
        message,
        isError = false
    ) {

        tenantMessage.textContent =
            message || "";


        tenantMessage.style.color =
            isError
                ? "#f87171"
                : "#4ade80";


        if (message) {

            setTimeout(
                () => {

                    tenantMessage.textContent =
                        "";

                },
                4000
            );

        }

    }

    function getInitials(
        name
    ) {

        if (!name) {

            return "?";

        }


        const parts =
            name
                .trim()
                .split(/\s+/)
                .filter(Boolean);


        if (!parts.length) {

            return "?";

        }


        if (parts.length === 1) {

            return parts[0]
                .slice(0, 2)
                .toUpperCase();

        }


        return (
            parts[0][0] +
            parts[1][0]
        ).toUpperCase();

    }


    function formatDateForInput(
        value
    ) {

        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";

        }


        const year =
            date.getFullYear();


        const month =
            String(
                date.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const day =
            String(
                date.getDate()
            ).padStart(
                2,
                "0"
            );


        return `${year}-${month}-${day}`;

    }


    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }

    loadData();

});