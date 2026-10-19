"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("paymentsTableBody");
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const generateButton = document.getElementById("generateButton");
    const refreshButton = document.getElementById("refreshButton");
    const notice = document.getElementById("notice");

    let payments = [];
    let isLoading = false;

    const statusNames = {
        PAID: "Оплачен",
        PENDING: "Ожидается",
        OVERDUE: "Просрочен"
    };

    function money(value) {
        return new Intl.NumberFormat("ru-RU", {
            style: "currency",
            currency: "RUB",
            maximumFractionDigits: 2
        }).format(Number(value) || 0);
    }

    function safe(value) {
        if (typeof escapeHtml === "function") {
            return escapeHtml(value ?? "");
        }

        const element = document.createElement("span");
        element.textContent = value ?? "";
        return element.innerHTML;
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).format(date);
    }

    function showNotice(message, isError = false) {
        notice.textContent = message;
        notice.classList.toggle("error", isError);
        notice.hidden = false;
    }

    function hideNotice() {
        notice.hidden = true;
        notice.textContent = "";
        notice.classList.remove("error");
    }

    function showTableMessage(message) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-message">
                    ${safe(message)}
                </td>
            </tr>
        `;
    }

    function statusClass(status) {
        if (status === "PAID") return "status-paid";
        if (status === "OVERDUE") return "status-overdue";
        return "status-pending";
    }

    function updateStatistics(summary) {
        document.getElementById("paidValue").textContent =
            money(summary.paid);

        document.getElementById("debtValue").textContent =
            money(summary.debt);

        document.getElementById("overdueValue").textContent =
            money(summary.overdue);

        document.getElementById("totalCount").textContent =
            summary.totalCount ?? payments.length;

        document.getElementById("paidCount").textContent =
            `${summary.paidCount ?? 0} платежей`;

        document.getElementById("pendingCount").textContent =
            `${summary.pendingCount ?? 0} платежей`;

        document.getElementById("overdueCount").textContent =
            `${summary.overdueCount ?? 0} просрочек`;
    }

    function getFilteredPayments() {
        const query = searchInput.value
            .trim()
            .toLocaleLowerCase("ru-RU");

        const selectedStatus = statusFilter.value;

        return payments.filter(payment => {
            if (
                selectedStatus !== "ALL" &&
                payment.status !== selectedStatus
            ) {
                return false;
            }

            const contract = payment.contract || {};
            const tenant = contract.tenant || {};
            const property = contract.property || {};

            const searchableText = [
                payment.id,
                payment.notes,
                contract.number,
                tenant.fullName,
                property.name,
                property.address
            ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase("ru-RU");

            return searchableText.includes(query);
        });
    }

    function renderPayments() {
        const filtered = getFilteredPayments();

        document.getElementById("resultsCount").textContent =
            `Показано: ${filtered.length} из ${payments.length}`;

        if (filtered.length === 0) {
            showTableMessage(
                payments.length === 0
                    ? "Платежей пока нет. Нажмите «Сформировать график»."
                    : "По заданным фильтрам ничего не найдено."
            );

            return;
        }

        tableBody.innerHTML = filtered.map(payment => {
            const contract = payment.contract || {};
            const tenant = contract.tenant || {};
            const property = contract.property || {};

            const status = payment.status;
            const paid = status === "PAID";

            const title = tenant.fullName || "Арендатор не указан";
            const propertyName = property.name || "Объект не указан";

            const dateDescription = paid && payment.paidAt
                ? `Оплачен ${formatDate(payment.paidAt)}`
                : status === "OVERDUE"
                    ? "Срок оплаты истёк"
                    : "Срок платежа";

            const actionButton = paid
                ? `
                    <button
                        class="row-action"
                        data-action="unpay"
                        data-id="${payment.id}"
                    >
                        Вернуть
                    </button>
                `
                : `
                    <button
                        class="row-action mark-paid"
                        data-action="pay"
                        data-id="${payment.id}"
                    >
                        Оплатить
                    </button>
                `;

            return `
                <tr>
                    <td>
                        <div class="payment-main">
                            <div class="payment-icon">₽</div>
                            <div>
                                <div class="payment-name">
                                    Платёж #${payment.id}
                                </div>
                                <div class="payment-subtitle">
                                    ${safe(title)}
                                </div>
                            </div>
                        </div>
                    </td>

                    <td>
                        <div class="contract-number">
                            Договор №${safe(contract.number || "—")}
                        </div>
                        <div class="muted-text">
                            ${safe(propertyName)}
                        </div>
                    </td>

                    <td>
                        <div class="date-main">
                            ${formatDate(payment.dueDate)}
                        </div>
                        <div class="date-subtitle">
                            ${safe(dateDescription)}
                        </div>
                    </td>

                    <td>
                        <span class="status-pill ${statusClass(status)}">
                            ${safe(statusNames[status] || status)}
                        </span>
                    </td>

                    <td class="amount-cell ${paid ? "paid-amount" : ""}">
                        ${money(payment.amount)}
                    </td>

                    <td>
                        ${actionButton}
                    </td>
                </tr>
            `;
        }).join("");
    }

    async function loadPayments() {
        if (isLoading) return;

        isLoading = true;
        refreshButton.disabled = true;

        showTableMessage("Загружаем платежи...");

        try {
            const data = await apiRequest("/api/payments");

            payments = Array.isArray(data.payments)
                ? data.payments
                : [];

            updateStatistics(data.summary || {});
            renderPayments();
        } catch (error) {
            showTableMessage("Не удалось загрузить платежи.");
            showNotice(
                error.message || "Ошибка загрузки платежей",
                true
            );
        } finally {
            isLoading = false;
            refreshButton.disabled = false;
        }
    }

    async function generateSchedule() {
        if (isLoading) return;

        const confirmed = window.confirm(
            "Сформировать график платежей по всем активным договорам?"
        );

        if (!confirmed) return;

        generateButton.disabled = true;
        generateButton.textContent = "Формирование...";

        hideNotice();

        try {
            const result = await apiRequest(
                "/api/payments/generate",
                {
                    method: "POST",
                    body: JSON.stringify({})
                }
            );

            showNotice(
                `${result.message}. ` +
                `Активных договоров: ${result.contractsProcessed}. ` +
                `Всего платежей: ${result.paymentsTotal}.`
            );

            await loadPayments();
        } catch (error) {
            showNotice(
                error.message || "Не удалось сформировать график",
                true
            );
        } finally {
            generateButton.disabled = false;
            generateButton.innerHTML =
                "<span>✦</span> Сформировать график";
        }
    }

    async function changePaymentStatus(id, status) {
        const payment = payments.find(
            item => item.id === id
        );

        if (!payment) return;

        const message = status === "PAID"
            ? `Подтвердить оплату ${money(payment.amount)}?`
            : "Вернуть платёж в неоплаченные?";

        if (!window.confirm(message)) return;

        hideNotice();

        try {
            await apiRequest(
                `/api/payments/${id}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ status })
                }
            );

            showNotice(
                status === "PAID"
                    ? "Платёж отмечен как оплаченный."
                    : "Статус платежа обновлён."
            );

            await loadPayments();
        } catch (error) {
            showNotice(
                error.message || "Не удалось изменить платёж",
                true
            );
        }
    }

    tableBody.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const id = Number(button.dataset.id);

        if (!Number.isInteger(id) || id <= 0) return;

        if (button.dataset.action === "pay") {
            changePaymentStatus(id, "PAID");
        }

        if (button.dataset.action === "unpay") {
            changePaymentStatus(id, "PENDING");
        }
    });

    searchInput.addEventListener("input", renderPayments);
    statusFilter.addEventListener("change", renderPayments);

    refreshButton.addEventListener("click", () => {
        hideNotice();
        loadPayments();
    });

    generateButton.addEventListener("click", generateSchedule);

    document.querySelectorAll("[data-soon]").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();

            showNotice(
                `Раздел «${link.dataset.soon}» пока находится в разработке.`
            );
        });
    });

    loadPayments();
});