
document.addEventListener("DOMContentLoaded", () => {
    initializeTenantDashboard();
});

async function initializeTenantDashboard() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/pages/login.html";
        return;
    }

    let savedUser = {};

    try {
        savedUser = JSON.parse(
            localStorage.getItem("user") || "{}"
        );
    } catch {
        logout();
        return;
    }

    if (savedUser.role !== "TENANT") {
        window.location.href = "/index.html";
        return;
    }

    const logoutButton = document.getElementById("logoutButton");

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    try {
        const response = await fetch("/api/tenant/dashboard", {
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
                data.message || "Не удалось загрузить данные"
            );
        }

        renderTenantDashboard(data);
    } catch (error) {
        console.error("Ошибка загрузки кабинета:", error);

        showTenantMessage(
            error.message || "Не удалось загрузить личный кабинет",
            true
        );
    }
}

function renderTenantDashboard(data) {
    const tenant = data.tenant || {};

    const contracts = Array.isArray(data.contracts)
        ? data.contracts
        : data.contract
            ? [data.contract]
            : [];

    const properties = Array.isArray(data.properties)
        ? data.properties
        : [];

    const activeContracts = contracts.filter(
        contract => contract.status === "ACTIVE"
    );

    const totalRent = data.totalRent !== undefined
        ? Number(data.totalRent)
        : activeContracts.reduce(
            (sum, contract) => sum + Number(contract.rent || 0),
            0
        );

    const userName = tenant.fullName || "Арендатор";

    document.getElementById("welcomeName").textContent = userName;
    document.getElementById("userName").textContent = userName;
    document.getElementById("userInitials").textContent =
        getInitials(userName);

    document.getElementById("rentValue").textContent =
        formatMoney(totalRent);

    document.getElementById("debtValue").textContent =
        formatMoney(data.totalDebt || 0);

    document.getElementById("paymentsCount").textContent =
        data.paymentsCount || 0;

    document.getElementById("paidPaymentsCount").textContent =
        data.paidPaymentsCount || 0;

    document.getElementById("unpaidPaymentsCount").textContent =
        Math.max(
            0,
            (data.paymentsCount || 0) -
            (data.paidPaymentsCount || 0)
        );

    document.getElementById("contractStatus").textContent =
        activeContracts.length
            ? `Активен: ${activeContracts.length}`
            : "Не найден";

    document.getElementById("contractNumber").textContent =
        activeContracts.length
            ? `Договоров: ${activeContracts.length}`
            : "Нет активных договоров";

    renderNextPayment(data.nextPayment);
    renderProperties(properties);
    renderContracts(activeContracts);
}

function renderNextPayment(payment) {
    const dateElement = document.getElementById("nextPaymentDate");
    const amountElement = document.getElementById("nextPaymentAmount");

    if (!payment) {
        dateElement.textContent = "—";
        amountElement.textContent = "Нет предстоящих платежей";
        return;
    }

    dateElement.textContent = formatDate(payment.dueDate);
    amountElement.textContent = formatMoney(payment.amount);
}

function renderProperties(properties) {
    const container = document.getElementById("propertyContent");

    if (!properties.length) {
        container.innerHTML = `
            <div class="tenant-empty">
                <div class="placeholder-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>
                </div>
                <strong>Объекты пока не назначены</strong>
                <p>Владелец недвижимости ещё не закрепил за вами объекты аренды.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="tenant-record-list">
            ${properties.map(property => `
                <article class="tenant-record-card">
                    <div class="tenant-property-name">
                        ${escapeTenantHtml(property.name || "Объект недвижимости")}
                    </div>

                    <div class="tenant-detail-row">
                        <span>Адрес</span>
                        <strong>${escapeTenantHtml(property.address || "Не указан")}</strong>
                    </div>

                    <div class="tenant-detail-row">
                        <span>Статус</span>
                        <strong>${escapeTenantHtml(property.status || "Не указан")}</strong>
                    </div>

                    <div class="tenant-detail-row">
                        <span>Тип объекта</span>
                        <strong>${escapeTenantHtml(property.type || "Не указан")}</strong>
                    </div>

                    ${property.area ? `
                        <div class="tenant-detail-row">
                            <span>Площадь</span>
                            <strong>${escapeTenantHtml(property.area)} м²</strong>
                        </div>
                    ` : ""}
                </article>
            `).join("")}
        </div>
    `;
}

function renderContracts(contracts) {
    const container = document.getElementById("contractContent");

    if (!contracts.length) {
        container.innerHTML = `
            <div class="tenant-empty">
                <div class="placeholder-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <strong>Активные договоры не найдены</strong>
                <p>После оформления договора здесь появятся его номер, срок действия и условия аренды.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="tenant-record-list">
            ${contracts.map(contract => `
                <article class="tenant-record-card">
                    <div class="tenant-contract-number">
                        Договор № ${escapeTenantHtml(contract.number || contract.id)}
                    </div>

                    <div class="tenant-detail-row">
                        <span>Объект</span>
                        <strong>${escapeTenantHtml(contract.property?.name || "Не указан")}</strong>
                    </div>

                    <div class="tenant-detail-row">
                        <span>Начало аренды</span>
                        <strong>${formatDate(contract.startDate)}</strong>
                    </div>

                    <div class="tenant-detail-row">
                        <span>Окончание аренды</span>
                        <strong>${formatDate(contract.endDate)}</strong>
                    </div>

                    <div class="tenant-detail-row">
                        <span>Арендная плата</span>
                        <strong>${formatMoney(contract.rent)}</strong>
                    </div>

                    <div class="tenant-detail-row">
                        <span>День оплаты</span>
                        <strong>${contract.paymentDay || "Не указан"}</strong>
                    </div>

                    <div class="tenant-detail-row">
                        <span>Статус</span>
                        <strong>${escapeTenantHtml(contract.status || "Не указан")}</strong>
                    </div>
                </article>
            `).join("")}
        </div>
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
        return "Не указана";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Не указана";
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

function escapeTenantHtml(value) {
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

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("jwt");
    localStorage.removeItem("user");

    window.location.href = "/pages/login.html";
}
