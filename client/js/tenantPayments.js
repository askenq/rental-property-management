
let tenantPayments = [];

document.addEventListener("DOMContentLoaded", () => {
    initializeTenantPayments();
});

async function initializeTenantPayments() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/pages/login.html";
        return;
    }

    let user = {};

    try {
        user = JSON.parse(
            localStorage.getItem("user") || "{}"
        );
    } catch {
        logout();
        return;
    }

    if (user.role !== "TENANT") {
        window.location.href = "/index.html";
        return;
    }

    const logoutButton = document.getElementById("logoutButton");

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    document.getElementById("userName").textContent =
        user.name || "Арендатор";

    document.getElementById("userInitials").textContent =
        getInitials(user.name || "Арендатор");

    document.getElementById("paymentSearch").addEventListener(
        "input",
        renderFilteredPayments
    );

    document.getElementById("statusFilter").addEventListener(
        "change",
        renderFilteredPayments
    );

    document.getElementById("contractFilter").addEventListener(
        "change",
        renderFilteredPayments
    );

    document.getElementById("refreshPayments").addEventListener(
        "click",
        loadPayments
    );

    await loadPayments();
}

async function loadPayments() {
    const token = localStorage.getItem("token");

    const button = document.getElementById("refreshPayments");

    button.disabled = true;
    button.textContent = "Загрузка...";

    try {
        const response = await fetch("/api/payments", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error(
                data.message || "Не удалось загрузить платежи"
            );
        }

        tenantPayments = Array.isArray(data.payments)
            ? data.payments
            : [];

        renderPaymentStatistics(data.summary || {});
        populateContractFilter();
        renderFilteredPayments();

        hideTenantMessage();
    } catch (error) {
        console.error("Ошибка загрузки платежей:", error);

        showTenantMessage(
            error.message || "Не удалось загрузить платежи",
            true
        );

        document.getElementById("paymentsTableBody").innerHTML = `
            <tr>
                <td colspan="6" class="payments-loading">
                    Не удалось загрузить платежи
                </td>
            </tr>
        `;

        document.getElementById("paymentsMobileList").innerHTML = "";
    } finally {
        button.disabled = false;
        button.textContent = "Обновить";
    }
}

function renderPaymentStatistics(summary) {
    const paid = Number(summary.paid) || 0;
    const debt = Number(summary.debt) || 0;
    const overdue = Number(summary.overdue) || 0;

    const pending = Math.max(0, debt - overdue);

    const total = paid + debt;

    document.getElementById("totalCount").textContent =
        summary.totalCount ?? tenantPayments.length;

    document.getElementById("paidCount").textContent =
        summary.paidCount || 0;

    document.getElementById("pendingCount").textContent =
        summary.pendingCount || 0;

    document.getElementById("overdueCount").textContent =
        summary.overdueCount || 0;

    document.getElementById("totalAmount").textContent =
        `${formatMoney(total)} начислено`;

    document.getElementById("paidAmount").textContent =
        `${formatMoney(paid)} оплачено`;

    document.getElementById("pendingAmount").textContent =
        `${formatMoney(pending)} ожидает`;

    document.getElementById("overdueAmount").textContent =
        `${formatMoney(overdue)} просрочено`;
}

function populateContractFilter() {
    const select = document.getElementById("contractFilter");

    const selectedValue = select.value;

    const contracts = new Map();

    tenantPayments.forEach(payment => {
        const contract = payment.contract;

        if (contract) {
            contracts.set(
                String(contract.id),
                contract
            );
        }
    });

    select.innerHTML = `
        <option value="all">Все договоры</option>

        ${Array.from(contracts.values()).map(contract => `
            <option value="${contract.id}">
                Договор № ${escapePaymentHtml(contract.number || contract.id)}
            </option>
        `).join("")}
    `;

    if (
        selectedValue === "all" ||
        contracts.has(selectedValue)
    ) {
        select.value = selectedValue;
    }
}

function renderFilteredPayments() {
    const search = document.getElementById("paymentSearch")
        .value.trim().toLowerCase();

    const status = document.getElementById("statusFilter").value;

    const contractId = document.getElementById("contractFilter").value;

    const filteredPayments = tenantPayments
        .filter(payment => {
            if (status !== "all" && payment.status !== status) {
                return false;
            }

            if (
                contractId !== "all" &&
                String(payment.contract?.id) !== contractId
            ) {
                return false;
            }

            const contractNumber = String(
                payment.contract?.number || ""
            ).toLowerCase();

            const propertyName = String(
                payment.contract?.property?.name || ""
            ).toLowerCase();

            const propertyAddress = String(
                payment.contract?.property?.address || ""
            ).toLowerCase();

            return (
                contractNumber.includes(search) ||
                propertyName.includes(search) ||
                propertyAddress.includes(search)
            );
        })
        .sort((a, b) => {
            return new Date(b.dueDate) - new Date(a.dueDate);
        });

    renderPaymentsTable(filteredPayments);
    renderPaymentsMobile(filteredPayments);

    const filteredAmount = filteredPayments.reduce(
        (sum, payment) => sum + (Number(payment.amount) || 0),
        0
    );

    document.getElementById("paymentsResultCount").textContent =
        `Показано ${filteredPayments.length} из ${tenantPayments.length} платежей`;

    document.getElementById("paymentsResultAmount").textContent =
        `Сумма: ${formatMoney(filteredAmount)}`;
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById("paymentsTableBody");

    if (!payments.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="payments-loading">
                    Платежи не найдены. Измените параметры фильтрации.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = payments.map(payment => {
        const contract = payment.contract || {};
        const property = contract.property || {};

        return `
            <tr>
                <td>
                    <strong>
                        № ${escapePaymentHtml(contract.number || contract.id || "—")}
                    </strong>
                </td>

                <td>
                    <div class="payment-property-name">
                        ${escapePaymentHtml(property.name || "Объект не указан")}
                    </div>
                    <small>
                        ${escapePaymentHtml(property.address || "")}
                    </small>
                </td>

                <td>${formatDate(payment.dueDate)}</td>

                <td class="payment-amount">
                    ${formatMoney(payment.amount)}
                </td>

                <td>
                    ${payment.paidAt ? formatDate(payment.paidAt) : "—"}
                </td>

                <td>
                    ${renderPaymentStatus(payment.status)}
                </td>
            </tr>
        `;
    }).join("");
}

function renderPaymentsMobile(payments) {
    const container = document.getElementById("paymentsMobileList");

    if (!payments.length) {
        container.innerHTML = `
            <div class="payments-mobile-empty">
                Платежи не найдены.
            </div>
        `;
        return;
    }

    container.innerHTML = payments.map(payment => {
        const contract = payment.contract || {};
        const property = contract.property || {};

        return `
            <article class="payment-mobile-card">

                <div class="payment-mobile-header">
                    <strong>
                        Договор № ${escapePaymentHtml(contract.number || contract.id || "—")}
                    </strong>

                    ${renderPaymentStatus(payment.status)}
                </div>

                <div class="payment-mobile-property">
                    ${escapePaymentHtml(property.name || "Объект не указан")}
                </div>

                <div class="payment-mobile-row">
                    <span>Адрес</span>
                    <strong>${escapePaymentHtml(property.address || "Не указан")}</strong>
                </div>

                <div class="payment-mobile-row">
                    <span>Дата платежа</span>
                    <strong>${formatDate(payment.dueDate)}</strong>
                </div>

                <div class="payment-mobile-row">
                    <span>Дата оплаты</span>
                    <strong>${payment.paidAt ? formatDate(payment.paidAt) : "—"}</strong>
                </div>

                <div class="payment-mobile-amount">
                    ${formatMoney(payment.amount)}
                </div>

            </article>
        `;
    }).join("");
}

function renderPaymentStatus(status) {
    const statuses = {
        PAID: {
            text: "Оплачено",
            className: "paid"
        },
        PENDING: {
            text: "Ожидает оплаты",
            className: "pending"
        },
        OVERDUE: {
            text: "Просрочено",
            className: "overdue"
        }
    };

    const item = statuses[status] || {
        text: status || "Неизвестно",
        className: "unknown"
    };

    return `
        <span class="payment-status ${item.className}">
            ${escapePaymentHtml(item.text)}
        </span>
    `;
}

function formatMoney(value) {
    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("ru-RU");
}

function getInitials(name) {
    return String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase() || "?";
}

function escapePaymentHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showTenantMessage(message, isError = false) {
    const element = document.getElementById("tenantMessage");

    element.textContent = message;
    element.classList.toggle("error", isError);
    element.hidden = false;
}

function hideTenantMessage() {
    const element = document.getElementById("tenantMessage");

    element.hidden = true;
    element.textContent = "";
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("jwt");
    localStorage.removeItem("user");

    window.location.href = "/pages/login.html";
}
