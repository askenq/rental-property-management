
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    const elements = {
        notice: $("requestNotice"),
        list: $("requestsList"),
        total: $("totalRequests"),
        newCount: $("newRequests"),
        inProgress: $("inProgressRequests"),
        completed: $("completedRequests"),
        results: $("requestsResultsCount"),

        addButton: $("addRequestButton"),
        refreshButton: $("refreshRequestsButton"),

        search: $("requestSearch"),
        statusFilter: $("requestStatusFilter"),
        priorityFilter: $("requestPriorityFilter"),
        typeFilter: $("requestTypeFilter"),

        modal: $("requestModal"),
        modalTitle: $("requestModalTitle"),
        closeModal: $("closeRequestModal"),
        cancelButton: $("cancelRequestButton"),

        form: $("requestForm"),
        formError: $("requestFormError"),
        requestId: $("requestId"),
        title: $("requestTitle"),
        description: $("requestDescription"),
        property: $("requestProperty"),
        tenant: $("requestTenant"),
        type: $("requestType"),
        priority: $("requestPriority"),
        status: $("requestStatus"),
        statusGroup: $("requestStatusGroup"),
        saveButton: $("saveRequestButton")
    };

    const state = {
        requests: [],
        properties: [],
        tenants: [],
        searchTimer: null,
        loading: false
    };

    const labels = {
        status: {
            NEW: "Новая",
            IN_PROGRESS: "В работе",
            WAITING: "Ожидает",
            COMPLETED: "Выполнена",
            CANCELLED: "Отменена"
        },
        priority: {
            LOW: "Низкий",
            NORMAL: "Обычный",
            HIGH: "Высокий",
            URGENT: "Срочный"
        },
        type: {
            REPAIR: "Ремонт",
            PLUMBING: "Сантехника",
            ELECTRICITY: "Электрика",
            HEATING: "Отопление",
            CLEANING: "Уборка",
            OTHER: "Другое"
        }
    };

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return new Intl.DateTimeFormat("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).format(date);
    }

    function showNotice(message, isError = false) {
        elements.notice.textContent = message;
        elements.notice.classList.toggle("error", isError);
        elements.notice.hidden = false;

        if (state.noticeTimer) {
            clearTimeout(state.noticeTimer);
        }

        state.noticeTimer = setTimeout(() => {
            elements.notice.hidden = true;
        }, 5000);
    }

    function hideNotice() {
        elements.notice.hidden = true;
        elements.notice.classList.remove("error");
    }

    async function requestApi(url, options = {}) {
        const token = localStorage.getItem("token");

        if (!token) {
            throw new Error("Нет токена авторизации. Выполните вход заново.");
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {}),
                Authorization: `Bearer ${token}`
            }
        });

        let data = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (response.status === 401 || response.status === 403) {
            throw new Error("Сессия недействительна. Перезайдите в приложение.");
        }

        if (!response.ok) {
            throw new Error(data?.message || `Ошибка сервера: ${response.status}`);
        }

        return data;
    }

    function statusClass(status) {
        return {
            NEW: "request-status-new",
            IN_PROGRESS: "request-status-progress",
            WAITING: "request-status-waiting",
            COMPLETED: "request-status-completed",
            CANCELLED: "request-status-cancelled"
        }[status] || "request-status-new";
    }

    function priorityClass(priority) {
        return {
            LOW: "request-priority-low",
            NORMAL: "request-priority-normal",
            HIGH: "request-priority-high",
            URGENT: "request-priority-urgent"
        }[priority] || "request-priority-normal";
    }

    function typeIcon(type) {
        return {
            REPAIR: "⚒",
            PLUMBING: "⌁",
            ELECTRICITY: "ϟ",
            HEATING: "♨",
            CLEANING: "✧",
            OTHER: "▤"
        }[type] || "▤";
    }

    function renderStats(summary = {}) {
        elements.total.textContent = summary.total ?? state.requests.length;
        elements.newCount.textContent = summary.new ?? 0;
        elements.inProgress.textContent = summary.inProgress ?? 0;
        elements.completed.textContent = summary.completed ?? 0;
    }

    function renderRequests() {
        const search = elements.search.value.trim().toLocaleLowerCase("ru");
        const status = elements.statusFilter.value;
        const priority = elements.priorityFilter.value;
        const type = elements.typeFilter.value;

        const filtered = state.requests.filter((request) => {
            const searchable = [
                request.title,
                request.description,
                request.property?.name,
                request.property?.address,
                request.tenant?.fullName
            ].filter(Boolean).join(" ").toLocaleLowerCase("ru");

            return (!search || searchable.includes(search))
                && (status === "ALL" || request.status === status)
                && (priority === "ALL" || request.priority === priority)
                && (type === "ALL" || request.type === type);
        });

        elements.results.textContent =
            `Показано: ${filtered.length} из ${state.requests.length}`;

        if (!filtered.length) {
            const hasFilters = Boolean(search)
                || status !== "ALL"
                || priority !== "ALL"
                || type !== "ALL";

            elements.list.innerHTML = `
                <div class="requests-empty">
                    <div class="requests-empty-icon">${hasFilters ? "⌕" : "✓"}</div>
                    <strong>${hasFilters ? "Ничего не найдено" : "Заявок пока нет"}</strong>
                    <p>${
                        hasFilters
                            ? "Измените поисковый запрос или параметры фильтров."
                            : "Создайте первую заявку, чтобы начать отслеживать обслуживание недвижимости."
                    }</p>
                </div>
            `;
            return;
        }

        elements.list.innerHTML = filtered.map((request) => {
            const propertyName = request.property?.name || "Объект не указан";
            const propertyAddress = request.property?.address || "";
            const tenantName = request.tenant?.fullName || "Арендатор не указан";
            const assigneeName = request.assignedTo?.name || "Не назначен";

            return `
                <article class="request-card">
                    <div class="request-card-main">
                        <div class="request-card-icon">${typeIcon(request.type)}</div>
                        <div>
                            <div class="request-card-title">${escapeHtml(request.title)}</div>
                            <div class="request-card-description">${escapeHtml(request.description)}</div>
                            <div class="request-badges">
                                <span class="request-badge ${statusClass(request.status)}">
                                    ${escapeHtml(labels.status[request.status] || request.status)}
                                </span>
                                <span class="request-badge ${priorityClass(request.priority)}">
                                    ${escapeHtml(labels.priority[request.priority] || request.priority)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="request-card-meta">
                        <div class="request-card-meta-label">Объект / арендатор</div>
                        <div class="request-card-meta-value">${escapeHtml(propertyName)}</div>
                        <div class="request-card-subvalue">${escapeHtml(propertyAddress)}</div>
                        <div class="request-card-subvalue">${escapeHtml(tenantName)}</div>
                    </div>

                    <div class="request-card-meta">
                        <div class="request-card-meta-label">Создана</div>
                        <div class="request-card-meta-value">${formatDate(request.createdAt)}</div>
                        <div class="request-card-subvalue">${escapeHtml(labels.type[request.type] || "Другое")}</div>
                    </div>

                    <div class="request-card-meta">
                        <div class="request-card-meta-label">Ответственный</div>
                        <div class="request-card-meta-value">${escapeHtml(assigneeName)}</div>
                    </div>

                    <div class="request-card-actions">
                        <button
                            type="button"
                            class="request-action-button"
                            data-action="edit"
                            data-id="${request.id}"
                            title="Редактировать"
                            aria-label="Редактировать заявку"
                        >✎</button>
                        <button
                            type="button"
                            class="request-action-button danger"
                            data-action="delete"
                            data-id="${request.id}"
                            title="Удалить"
                            aria-label="Удалить заявку"
                        >×</button>
                    </div>
                </article>
            `;
        }).join("");
    }

    async function loadRequests() {
        if (state.loading) return;

        state.loading = true;
        elements.list.innerHTML = `
            <div class="requests-loading">
                <span class="loading-spinner"></span>
                <span>Загружаем заявки...</span>
            </div>
        `;

        try {
            const data = await requestApi("/api/requests");

            state.requests = Array.isArray(data.requests) ? data.requests : [];
            renderStats(data.summary || {});
            renderRequests();
            hideNotice();
        } catch (error) {
            elements.list.innerHTML = `
                <div class="requests-error">
                    <strong>Не удалось загрузить заявки</strong>
                    <span>${escapeHtml(error.message)}</span>
                    <button type="button" class="secondary-button" id="retryRequestsButton">Повторить</button>
                </div>
            `;

            $("retryRequestsButton")?.addEventListener("click", loadRequests);
            showNotice(error.message, true);
        } finally {
            state.loading = false;
        }
    }

    async function loadFormOptions() {
        const [propertiesResult, tenantsResult] = await Promise.allSettled([
            requestApi("/api/properties"),
            requestApi("/api/tenants")
        ]);

        if (propertiesResult.status === "fulfilled") {
            const data = propertiesResult.value;
            state.properties = Array.isArray(data)
                ? data
                : Array.isArray(data.properties)
                    ? data.properties
                    : [];
        } else {
            state.properties = [];
            console.error("Не удалось загрузить объекты:", propertiesResult.reason);
        }

        if (tenantsResult.status === "fulfilled") {
            const data = tenantsResult.value;
            state.tenants = Array.isArray(data)
                ? data
                : Array.isArray(data.tenants)
                    ? data.tenants
                    : [];
        } else {
            state.tenants = [];
            console.error("Не удалось загрузить арендаторов:", tenantsResult.reason);
        }

        elements.property.innerHTML = `
            <option value="">Выберите объект</option>
            ${state.properties.map((property) => `
                <option value="${property.id}">
                    ${escapeHtml(property.name)} — ${escapeHtml(property.address || "")}
                </option>
            `).join("")}
        `;

        elements.tenant.innerHTML = `
            <option value="">Автоматически из объекта</option>
            ${state.tenants.map((tenant) => `
                <option value="${tenant.id}">${escapeHtml(tenant.fullName)}</option>
            `).join("")}
        `;
    }

    function openModal(request = null) {
        elements.form.reset();
        elements.formError.hidden = true;
        elements.formError.textContent = "";
        elements.requestId.value = request?.id ?? "";

        const editing = Boolean(request);

        elements.modalTitle.textContent = editing ? "Редактирование заявки" : "Новая заявка";
        elements.saveButton.textContent = editing ? "Сохранить изменения" : "Создать заявку";
        elements.statusGroup.hidden = !editing;

        elements.type.value = request?.type || "OTHER";
        elements.priority.value = request?.priority || "NORMAL";
        elements.status.value = request?.status || "NEW";

        if (request) {
            elements.title.value = request.title || "";
            elements.description.value = request.description || "";
            elements.property.value = String(request.propertyId || "");
            elements.tenant.value = request.tenantId ? String(request.tenantId) : "";
        }

        elements.modal.hidden = false;
        document.body.style.overflow = "hidden";
        elements.title.focus();
    }

    function closeModal() {
        elements.modal.hidden = true;
        document.body.style.overflow = "";
    }

    function showFormError(message) {
        elements.formError.textContent = message;
        elements.formError.hidden = false;
    }

    async function saveRequest(event) {
        event.preventDefault();

        const id = elements.requestId.value;
        const payload = {
            title: elements.title.value.trim(),
            description: elements.description.value.trim(),
            propertyId: Number(elements.property.value),
            type: elements.type.value,
            priority: elements.priority.value
        };

        if (!payload.propertyId) {
            showFormError("Выберите объект недвижимости.");
            return;
        }

        if (elements.tenant.value) {
            payload.tenantId = Number(elements.tenant.value);
        } else if (id) {
            payload.tenantId = null;
        }

        if (id) {
            payload.status = elements.status.value;
        }

        elements.saveButton.disabled = true;
        elements.saveButton.textContent = "Сохранение...";
        elements.formError.hidden = true;

        try {
            const url = id
                ? `/api/requests/${encodeURIComponent(id)}`
                : "/api/requests";

            const data = await requestApi(url, {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(payload)
            });

            closeModal();
            showNotice(data.message || (id ? "Заявка обновлена" : "Заявка создана"));
            await loadRequests();
        } catch (error) {
            showFormError(error.message);
        } finally {
            elements.saveButton.disabled = false;
            elements.saveButton.textContent = id ? "Сохранить изменения" : "Создать заявку";
        }
    }

    async function editRequest(id) {
        try {
            const request = state.requests.find((item) => String(item.id) === String(id));

            if (!request) {
                showNotice("Заявка не найдена в текущем списке. Обновите страницу.", true);
                return;
            }

            await loadFormOptions();
            openModal(request);
        } catch (error) {
            showNotice(error.message, true);
        }
    }

    async function deleteRequest(id) {
        const request = state.requests.find((item) => String(item.id) === String(id));

        if (!request) return;

        const confirmed = window.confirm(
            `Удалить заявку «${request.title}»?\nЭто действие нельзя отменить.`
        );

        if (!confirmed) return;

        try {
            const data = await requestApi(`/api/requests/${encodeURIComponent(id)}`, {
                method: "DELETE"
            });

            showNotice(data.message || "Заявка удалена");
            await loadRequests();
        } catch (error) {
            showNotice(error.message, true);
        }
    }

    elements.addButton.addEventListener("click", async () => {
        await loadFormOptions();

        if (!state.properties.length) {
            showNotice("Сначала добавьте объект недвижимости.", true);
            return;
        }

        openModal();
    });

    elements.refreshButton.addEventListener("click", loadRequests);
    elements.form.addEventListener("submit", saveRequest);
    elements.closeModal.addEventListener("click", closeModal);
    elements.cancelButton.addEventListener("click", closeModal);

    elements.modal.addEventListener("click", (event) => {
        if (event.target === elements.modal) closeModal();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !elements.modal.hidden) {
            closeModal();
        }
    });

    elements.search.addEventListener("input", () => {
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(renderRequests, 150);
    });

    elements.statusFilter.addEventListener("change", renderRequests);
    elements.priorityFilter.addEventListener("change", renderRequests);
    elements.typeFilter.addEventListener("change", renderRequests);

    elements.property.addEventListener("change", () => {
        if (!elements.property.value) return;

        const property = state.properties.find(
            (item) => String(item.id) === elements.property.value
        );

        if (property?.tenantId) {
            elements.tenant.value = String(property.tenantId);
        }
    });

    elements.list.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const id = button.dataset.id;

        if (button.dataset.action === "edit") {
            await editRequest(id);
        }

        if (button.dataset.action === "delete") {
            await deleteRequest(id);
        }
    });

    loadRequests();
});
