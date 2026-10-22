
document.addEventListener("DOMContentLoaded", () => {
    const periodSelect = document.getElementById("periodSelect");
    const refreshButton = document.getElementById("refreshAnalyticsButton");
    const notice = document.getElementById("analyticsNotice");

    let latestData = null;
    let loading = false;

    const money = (value) =>
        new Intl.NumberFormat("ru-RU", {
            style: "currency",
            currency: "RUB",
            maximumFractionDigits: 2
        }).format(Number(value) || 0);

    const number = (value) =>
        new Intl.NumberFormat("ru-RU", {
            maximumFractionDigits: 1
        }).format(Number(value) || 0);

    const escapeHtml = (value) => {
        const element = document.createElement("span");
        element.textContent = String(value ?? "");
        return element.innerHTML;
    };

    const formatDate = (value) => {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    };

    const showNotice = (message) => {
        if (!notice) return;
        notice.textContent = message;
        notice.hidden = !message;
    };

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    const statusInfo = (status) => {
        const statuses = {
            RENTED: ["Сдан", "status-rented"],
            AVAILABLE: ["Свободен", "status-available"],
            MAINTENANCE: ["Обслуживание", "status-maintenance"]
        };

        return statuses[status] || ["Неизвестно", "status-maintenance"];
    };

    const requestStatusInfo = (status) => {
        const statuses = {
            NEW: "Новые",
            IN_PROGRESS: "В работе",
            WAITING: "Ожидают",
            COMPLETED: "Завершены",
            CANCELLED: "Отменены"
        };

        return statuses[status] || status;
    };

    const priorityInfo = (priority) => {
        const priorities = {
            LOW: "Низкий",
            NORMAL: "Обычный",
            HIGH: "Высокий",
            URGENT: "Срочный"
        };

        return priorities[priority] || priority;
    };

    async function loadAnalytics() {
        if (loading) return;

        loading = true;

        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.classList.add("is-loading");
        }

        showNotice("");

        try {
            const token = localStorage.getItem("token");

            if (!token) {
                window.location.href = "/pages/login.html";
                return;
            }

            const period = Number(periodSelect?.value) || 12;

            const response = await fetch(
                `/api/analytics?period=${encodeURIComponent(period)}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            let data;

            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "/pages/login.html";
                return;
            }

            if (!response.ok) {
                throw new Error(
                    data.message || `Ошибка загрузки: HTTP ${response.status}`
                );
            }

            latestData = data;

            renderSummary(data);
            renderRevenueChart(data);
            renderPortfolio(data);
            renderProperties(data);
            renderRequests(data);
            renderExpiringContracts(data);

            const updated = data.generatedAt
                ? new Date(data.generatedAt).toLocaleString("ru-RU")
                : new Date().toLocaleString("ru-RU");

            setText("lastUpdated", `Обновлено: ${updated}`);
            setText("overviewPeriod", `За последние ${data.period} мес.`);
            setText("chartPeriodLabel", `Данные за ${data.period} месяцев`);
        } catch (error) {
            console.error("Ошибка аналитики:", error);

            showNotice(
                `${error.message || "Не удалось загрузить аналитику"}. ` +
                "Проверьте соединение с сервером и попробуйте обновить страницу."
            );

            if (!latestData) {
                renderEmptyOnError();
            }
        } finally {
            loading = false;

            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.classList.remove("is-loading");
            }
        }
    }

    function renderSummary(data) {
        const summary = data.summary || {};

        setText("kpiPaidAmount", money(summary.paidAmount));
        setText(
            "kpiPaidCount",
            `${number(summary.paidCount)} оплаченных платежей`
        );

        setText("kpiPendingAmount", money(summary.pendingAmount));
        setText(
            "kpiPendingCount",
            `${number(summary.pendingCount)} ожидают оплаты`
        );

        setText("kpiOverdueAmount", money(summary.overdueAmount));
        setText(
            "kpiOverdueCount",
            `${number(summary.overdueCount)} просроченных платежей`
        );

        const occupancy = Math.max(
            0,
            Math.min(100, Number(summary.occupancyRate) || 0)
        );

        setText("kpiOccupancy", `${number(occupancy)}%`);
        setText(
            "kpiOccupancyDetail",
            `${summary.propertiesOccupied || 0} из ${summary.propertiesTotal || 0} объектов занято`
        );

        const occupancyFill = document.getElementById("occupancyFill");

        if (occupancyFill) {
            occupancyFill.style.width = `${occupancy}%`;
        }

        setText("currentMonthReceived", money(summary.currentMonthReceived));
        setText("currentMonthAccrued", money(summary.currentMonthAccrued));
        setText("requestsTotal", number(summary.requestsTotal));
        setText("requestsOpen", number(summary.requestsOpen));
        setText("requestsCompleted", number(summary.requestsCompleted));
    }

    function renderRevenueChart(data) {
        const container = document.getElementById("revenueChart");

        if (!container) return;

        const months = Array.isArray(data.monthly) ? data.monthly : [];

        if (!months.length) {
            container.innerHTML = `
                <div class="analytics-empty">
                    <strong>Нет данных для графика</strong>
                    За выбранный период данные не найдены.
                </div>
            `;
            return;
        }

        const width = 760;
        const height = 300;
        const left = 68;
        const right = 18;
        const top = 24;
        const bottom = 45;
        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;

        const maxValue = Math.max(
            1,
            ...months.flatMap((month) => [
                Math.max(0, Number(month.accrued) || 0),
                Math.max(0, Number(month.paid) || 0)
            ])
        );

        const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
        const normalized = maxValue / magnitude;
        const niceUnit = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
        const niceMax = niceUnit * magnitude;
        const ticks = 4;

        const y = (value) =>
            top + plotHeight - (value / niceMax) * plotHeight;

        const slot = plotWidth / months.length;
        const groupWidth = Math.min(38, slot * 0.72);
        const barWidth = Math.max(2, (groupWidth - 5) / 2);

        let grid = "";
        let bars = "";
        let labels = "";

        for (let i = 0; i <= ticks; i++) {
            const value = niceMax * i / ticks;
            const lineY = y(value);

            grid += `
                <line
                    class="chart-grid-line"
                    x1="${left}"
                    y1="${lineY}"
                    x2="${width - right}"
                    y2="${lineY}"
                />
                <text
                    class="chart-axis-label"
                    x="${left - 9}"
                    y="${lineY + 3}"
                    text-anchor="end"
                >${escapeHtml(formatCompactMoney(value))}</text>
            `;
        }

        months.forEach((month, index) => {
            const center = left + slot * index + slot / 2;
            const accrued = Math.max(0, Number(month.accrued) || 0);
            const paid = Math.max(0, Number(month.paid) || 0);
            const accruedHeight = accrued > 0
                ? Math.max(1, accrued / niceMax * plotHeight)
                : 0;
            const paidHeight = paid > 0
                ? Math.max(1, paid / niceMax * plotHeight)
                : 0;
            const xAccrued = center - groupWidth / 2;
            const xPaid = xAccrued + barWidth + 5;
            const monthLabel = String(month.label || month.key || "Месяц");
            const accruedCount = Number(month.accruedCount) || 0;
            const paidCount = Number(month.paidCount) || 0;
            const difference = accrued - paid;

            bars += `
                <g
                    class="chart-month-group"
                    tabindex="0"
                    role="group"
                    aria-label="${escapeHtml(monthLabel)}"
                    data-month-index="${index}"
                >
                    <rect
                        class="chart-hit-area"
                        x="${left + slot * index}"
                        y="${top}"
                        width="${slot}"
                        height="${plotHeight}"
                    />
                    <rect
                        class="chart-bar-accrued"
                        x="${xAccrued}"
                        y="${y(accrued)}"
                        width="${barWidth}"
                        height="${accruedHeight}"
                        rx="3"
                    >
                        <title>${escapeHtml(monthLabel)}: начислено ${escapeHtml(money(accrued))}</title>
                    </rect>
                    <rect
                        class="chart-bar-paid"
                        x="${xPaid}"
                        y="${y(paid)}"
                        width="${barWidth}"
                        height="${paidHeight}"
                        rx="3"
                    >
                        <title>${escapeHtml(monthLabel)}: получено ${escapeHtml(money(paid))}</title>
                    </rect>
                    <rect
                        class="chart-focus-outline"
                        x="${left + slot * index + 2}"
                        y="${top}"
                        width="${Math.max(1, slot - 4)}"
                        height="${plotHeight}"
                        rx="5"
                    />
                </g>
            `;

            const showLabel =
                months.length <= 6 ||
                index % Math.ceil(months.length / 6) === 0 ||
                index === months.length - 1;

            if (showLabel) {
                labels += `
                    <text
                        class="chart-axis-label"
                        x="${center}"
                        y="${height - 14}"
                        text-anchor="middle"
                    >${escapeHtml(monthLabel)}</text>
                `;
            }
        });

        container.innerHTML = `
            <div class="revenue-chart-inner">
                <svg
                    viewBox="0 0 ${width} ${height}"
                    role="img"
                    aria-label="Интерактивный график начисленных и полученных платежей по месяцам"
                >
                    ${grid}
                    ${bars}
                    ${labels}
                </svg>
                <div class="chart-tooltip" role="status" aria-live="polite" hidden></div>
            </div>
        `;

        const tooltip = container.querySelector(".chart-tooltip");
        const inner = container.querySelector(".revenue-chart-inner");
        const groups = container.querySelectorAll(".chart-month-group");

        function showTooltip(index, event) {
            const month = months[index];

            if (!month || !tooltip || !inner) return;

            const accrued = Math.max(0, Number(month.accrued) || 0);
            const paid = Math.max(0, Number(month.paid) || 0);
            const difference = accrued - paid;
            const accruedCount = Number(month.accruedCount) || 0;
            const paidCount = Number(month.paidCount) || 0;
            const label = String(month.label || month.key || "Месяц");

            tooltip.innerHTML = `
                <div class="chart-tooltip-title">${escapeHtml(label)}</div>
                <div class="chart-tooltip-row">
                    <span><i class="chart-tooltip-dot accrued"></i>Начислено</span>
                    <strong>${escapeHtml(money(accrued))}</strong>
                </div>
                <div class="chart-tooltip-detail">${number(accruedCount)} платежей по дате начисления</div>
                <div class="chart-tooltip-row">
                    <span><i class="chart-tooltip-dot paid"></i>Получено</span>
                    <strong>${escapeHtml(money(paid))}</strong>
                </div>
                <div class="chart-tooltip-detail">${number(paidCount)} платежей по дате оплаты</div>
                <div class="chart-tooltip-divider"></div>
                <div class="chart-tooltip-row">
                    <span>Разница</span>
                    <strong class="${difference > 0 ? "chart-difference-negative" : difference < 0 ? "chart-difference-positive" : ""}">${escapeHtml(money(difference))}</strong>
                </div>
            `;

            tooltip.hidden = false;

            const innerRect = inner.getBoundingClientRect();
            const groupRect = groups[index].getBoundingClientRect();

            let x = groupRect.left - innerRect.left + groupRect.width / 2;
            let yPosition = groupRect.top - innerRect.top;

            if (event && Number.isFinite(event.clientX)) {
                x = event.clientX - innerRect.left;
                yPosition = event.clientY - innerRect.top;
            }

            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;

            x = Math.max(
                tooltipWidth / 2 + 8,
                Math.min(innerRect.width - tooltipWidth / 2 - 8, x)
            );

            yPosition = Math.max(tooltipHeight + 12, yPosition);

            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${yPosition}px`;
        }

        groups.forEach((group, index) => {
            group.addEventListener("pointerenter", (event) => {
                showTooltip(index, event);
            });

            group.addEventListener("pointermove", (event) => {
                showTooltip(index, event);
            });

            group.addEventListener("pointerleave", () => {
                tooltip.hidden = true;
            });

            group.addEventListener("focus", () => {
                showTooltip(index);
            });

            group.addEventListener("blur", () => {
                tooltip.hidden = true;
            });

            group.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    tooltip.hidden = true;
                    group.blur();
                }
            });
        });
    }

    function formatCompactMoney(value) {
        const amount = Number(value) || 0;

        if (amount >= 1000000) {
            return `${number(amount / 1000000)}м`;
        }

        if (amount >= 1000) {
            return `${number(amount / 1000)}к`;
        }

        return number(amount);
    }

    function renderPortfolio(data) {
        const summary = data.summary || {};

        const occupied = Number(summary.propertiesOccupied) || 0;
        const available = Number(summary.propertiesAvailable) || 0;
        const maintenance = Number(summary.propertiesMaintenance) || 0;
        const total = Number(summary.propertiesTotal) || 0;

        const occupancy = total > 0
            ? Math.max(0, Math.min(100, occupied / total * 100))
            : 0;

        const occupiedDegrees = occupied / Math.max(total, 1) * 360;
        const availableDegrees = (occupied + available) / Math.max(total, 1) * 360;
        const ring = document.getElementById("portfolioRing");

        if (ring) {
            ring.style.background = total
                ? `conic-gradient(
                    var(--an-blue) 0deg ${occupiedDegrees}deg,
                    var(--an-green) ${occupiedDegrees}deg ${availableDegrees}deg,
                    var(--an-orange) ${availableDegrees}deg 360deg
                )`
                : "#2b3035";
        }

        setText("portfolioPercent", `${Math.round(occupancy)}%`);
        setText("portfolioOccupied", number(occupied));
        setText("portfolioAvailable", number(available));
        setText("portfolioMaintenance", number(maintenance));
        setText("portfolioTotal", number(total));
    }

    function renderProperties(data) {
        const container = document.getElementById("propertyPerformanceBody");

        if (!container) return;

        const properties = Array.isArray(data.properties) ? data.properties : [];

        if (!properties.length) {
            container.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="analytics-empty">
                            <strong>Пока нет объектов</strong>
                            Добавьте недвижимость, чтобы увидеть её эффективность.
                            <div style="margin-top:12px">
                                <a class="analytics-text-link" href="/pages/properties.html">
                                    Перейти к объектам ↗
                                </a>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = properties.map((property) => {
            const [statusLabel, statusClass] = statusInfo(property.status);

            return `
                <tr>
                    <td>
                        <div class="property-cell">
                            <div class="property-cell-icon">▦</div>
                            <div class="property-cell-info">
                                <strong>${escapeHtml(property.name)}</strong>
                                <span>${escapeHtml(property.address || "Адрес не указан")}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="analytics-status ${statusClass}">
                            ${escapeHtml(statusLabel)}
                        </span>
                    </td>
                    <td>${escapeHtml(money(property.accrued))}</td>
                    <td class="amount-positive">${escapeHtml(money(property.received))}</td>
                    <td class="${Number(property.debt) > 0 ? "amount-negative" : ""}">
                        ${escapeHtml(money(property.debt))}
                    </td>
                </tr>
            `;
        }).join("");
    }

    function renderRequests(data) {
        const summary = data.summary || {};
        const requests = data.requests || {};
        const statusContainer = document.getElementById("requestStatusList");
        const statuses = Array.isArray(requests.byStatus) ? requests.byStatus : [];

        if (statusContainer) {
            const maxCount = Math.max(
                1,
                ...statuses.map((item) => Number(item.count) || 0)
            );

            statusContainer.innerHTML = statuses.length
                ? statuses.map((item) => {
                    const count = Number(item.count) || 0;
                    const width = count / maxCount * 100;

                    return `
                        <div class="request-status-row">
                            <div class="request-status-top">
                                <span>${escapeHtml(requestStatusInfo(item.status))}</span>
                                <strong>${number(count)}</strong>
                            </div>
                            <div class="request-status-track">
                                <div class="request-status-fill" style="width:${width}%"></div>
                            </div>
                        </div>
                    `;
                }).join("")
                : `
                    <div class="analytics-empty">
                        <strong>Нет данных по заявкам</strong>
                    </div>
                `;
        }

        const priorityContainer = document.getElementById("requestPriorityList");
        const priorities = Array.isArray(requests.byPriority) ? requests.byPriority : [];

        if (priorityContainer) {
            priorityContainer.innerHTML = priorities.map((item) => {
                const urgent = item.priority === "URGENT";

                return `
                    <div class="priority-chip ${urgent ? "priority-urgent" : ""}">
                        ${escapeHtml(priorityInfo(item.priority))}
                        <strong>${number(item.count)}</strong>
                    </div>
                `;
            }).join("");
        }

        setText("requestsTotal", number(summary.requestsTotal));
        setText("requestsOpen", number(summary.requestsOpen));
        setText("requestsCompleted", number(summary.requestsCompleted));
    }

    function renderExpiringContracts(data) {
        const container = document.getElementById("expiringContractsList");

        if (!container) return;

        const contracts = Array.isArray(data.expiringSoon) ? data.expiringSoon : [];

        if (!contracts.length) {
            container.innerHTML = `
                <div class="analytics-empty">
                    <strong>Нет договоров, истекающих в ближайшие 30 дней</strong>
                    Сейчас не требуется продление активных договоров по этому критерию.
                </div>
            `;
            return;
        }

        container.innerHTML = contracts.map((contract) => `
            <div class="expiring-item">
                <div class="expiring-main">
                    <div class="expiring-icon">◷</div>
                    <div>
                        <strong>Договор №${escapeHtml(contract.number)}</strong>
                        <span>${escapeHtml(contract.property)}</span>
                    </div>
                </div>
                <div class="expiring-meta">
                    <span>Арендатор</span>
                    <strong>${escapeHtml(contract.tenant)}</strong>
                </div>
                <div class="expiring-meta">
                    <span>Окончание договора</span>
                    <strong class="expiring-date">${escapeHtml(formatDate(contract.endDate))}</strong>
                </div>
                <a class="expiring-link" href="/pages/contracts.html" aria-label="Перейти к договорам">
                    Договоры ↗
                </a>
            </div>
        `).join("");
    }

    function renderEmptyOnError() {
        const chart = document.getElementById("revenueChart");
        const propertyBody = document.getElementById("propertyPerformanceBody");
        const requestStatusList = document.getElementById("requestStatusList");
        const requestPriorityList = document.getElementById("requestPriorityList");
        const expiringContractsList = document.getElementById("expiringContractsList");

        if (chart) {
            chart.innerHTML = `
                <div class="analytics-empty">
                    <strong>График пока недоступен</strong>
                    После восстановления соединения обновите данные.
                </div>
            `;
        }

        if (propertyBody) {
            propertyBody.innerHTML = `
                <tr>
                    <td colspan="5" class="table-loading">
                        Не удалось загрузить данные.
                    </td>
                </tr>
            `;
        }

        if (requestStatusList) {
            requestStatusList.innerHTML = `
                <div class="analytics-empty">
                    Не удалось загрузить заявки.
                </div>
            `;
        }

        if (requestPriorityList) {
            requestPriorityList.innerHTML = "";
        }

        if (expiringContractsList) {
            expiringContractsList.innerHTML = `
                <div class="analytics-empty">
                    Не удалось загрузить договоры.
                </div>
            `;
        }
    }

    if (periodSelect) {
        periodSelect.addEventListener("change", loadAnalytics);
    }

    if (refreshButton) {
        refreshButton.addEventListener("click", loadAnalytics);
    }

    const backToTopButton = document.getElementById("backToTopButton");

    if (backToTopButton) {
        backToTopButton.addEventListener("click", () => {
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        });
    }

    loadAnalytics();
});
