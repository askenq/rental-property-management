document.addEventListener("DOMContentLoaded", () => {

    const welcomeName =
        document.getElementById("welcomeName");

    const userName =
        document.getElementById("userName");

    const userRole =
        document.getElementById("userRole");

    const userInitials =
        document.getElementById("userInitials");

    const propertiesCount =
        document.getElementById("propertiesCount");

    const tenantsCount =
        document.getElementById("tenantsCount");

    const incomeValue =
        document.getElementById("incomeValue");

    const debtValue =
        document.getElementById("debtValue");

    const dashboardProperties =
        document.getElementById(
            "dashboardProperties"
        );

    const paymentProgress =
        document.getElementById(
            "paymentProgress"
        );

    const paymentProgressFill =
        document.getElementById(
            "paymentProgressFill"
        );

    const paidAmount =
        document.getElementById(
            "paidAmount"
        );

    const expectedAmount =
        document.getElementById(
            "expectedAmount"
        );

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    function getToken() {

        return (
            localStorage.getItem("token") ||
            localStorage.getItem("authToken") ||
            localStorage.getItem("accessToken") ||
            localStorage.getItem("jwt")
        );

    }


    const token =
        getToken();


    if (!token) {

        window.location.href =
            "pages/login.html";

        return;

    }

    async function apiRequest(url) {

        const response =
            await fetch(
                url,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch (error) {

            data = null;

        }


        if (
            response.status === 401
        ) {

            clearAuth();

            window.location.href =
                "pages/login.html";

            throw new Error(
                "Сессия истекла"
            );

        }


        if (!response.ok) {

            throw new Error(
                data?.message ||
                `Ошибка HTTP ${response.status}`
            );

        }


        return data;

    }

    function clearAuth() {

        localStorage.removeItem("token");

        localStorage.removeItem("authToken");

        localStorage.removeItem("accessToken");

        localStorage.removeItem("jwt");

        localStorage.removeItem("user");

    }

    function getSavedUser() {

        try {

            const savedUser =
                localStorage.getItem("user");


            if (!savedUser) {

                return null;

            }


            return JSON.parse(savedUser);

        } catch (error) {

            return null;

        }

    }


    function getUserFromToken() {

        try {

            const parts =
                token.split(".");


            if (
                parts.length !== 3
            ) {

                return null;

            }


            const base64 =
                parts[1]
                    .replace(/-/g, "+")
                    .replace(/_/g, "/");


            const payload =
                JSON.parse(
                    atob(base64)
                );


            return {

                id:
                    payload.userId,

                role:
                    payload.role

            };

        } catch (error) {

            return null;

        }

    }


    function getRoleName(role) {

        const roles = {

            OWNER:
                "Владелец",

            MANAGER:
                "Управляющий",

            TENANT:
                "Арендатор"

        };


        return (
            roles[role] ||
            "Пользователь"
        );

    }


    function getInitials(name) {

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


        if (
            parts.length === 1
        ) {

            return parts[0]
                .slice(0, 2)
                .toUpperCase();

        }


        return (
            parts[0][0] +
            parts[1][0]
        ).toUpperCase();

    }


    function renderUser() {

        const savedUser =
            getSavedUser();


        const tokenUser =
            getUserFromToken();


        const user =
            savedUser ||
            tokenUser;


        if (!user) {

            return;

        }


        const name =
            user.name ||
            "Пользователь";


        const role =
            user.role ||
            tokenUser?.role ||
            "";


        if (welcomeName) {

            welcomeName.textContent =
                name;

        }


        if (userName) {

            userName.textContent =
                name;

        }


        if (userRole) {

            userRole.textContent =
                getRoleName(role);

        }


        if (userInitials) {

            userInitials.textContent =
                getInitials(name);

        }

    }

    function normalizeArray(data) {

        if (
            Array.isArray(data)
        ) {

            return data;

        }


        if (
            Array.isArray(data?.data)
        ) {

            return data.data;

        }


        if (
            Array.isArray(data?.items)
        ) {

            return data.items;

        }


        if (
            Array.isArray(data?.properties)
        ) {

            return data.properties;

        }


        if (
            Array.isArray(data?.tenants)
        ) {

            return data.tenants;

        }


        if (
            Array.isArray(data?.payments)
        ) {

            return data.payments;

        }


        return [];

    }

    async function loadDashboard() {

        const results =
            await Promise.allSettled([

                apiRequest(
                    "/api/properties"
                ),

                apiRequest(
                    "/api/tenants"
                ),

                apiRequest(
                    "/api/payments"
                )

            ]);

        let properties = [];


        if (
            results[0].status ===
            "fulfilled"
        ) {

            properties =
                normalizeArray(
                    results[0].value
                );

        } else {

            console.error(
                "Ошибка загрузки объектов:",
                results[0].reason
            );

        }


        let tenants = [];


        if (
            results[1].status ===
            "fulfilled"
        ) {

            tenants =
                normalizeArray(
                    results[1].value
                );

        } else {

            console.error(
                "Ошибка загрузки арендаторов:",
                results[1].reason
            );

        }


        let payments = [];


        if (
            results[2].status ===
            "fulfilled"
        ) {

            payments =
                normalizeArray(
                    results[2].value
                );

        }

        if (propertiesCount) {

            propertiesCount.textContent =
                properties.length;

        }


        if (tenantsCount) {

            tenantsCount.textContent =
                tenants.length;

        }


        const income =
            calculateIncome(
                payments
            );


        const debt =
            calculateDebt(
                payments
            );


        if (incomeValue) {

            incomeValue.textContent =
                formatMoney(income);

        }


        if (debtValue) {

            debtValue.textContent =
                formatMoney(debt);

        }


        renderProperties(
            properties
        );

        renderPaymentStatistics(
            payments
        );

    }

    function renderProperties(properties) {

        if (
            !dashboardProperties
        ) {

            return;

        }


        if (
            !properties.length
        ) {

            dashboardProperties.innerHTML = `

                <div class="empty-state">

                    <h3>
                        Объектов пока нет
                    </h3>

                    <p>
                        Добавьте первый объект недвижимости.
                    </p>

                </div>

            `;

            return;

        }


        const latestProperties =
            properties
                .slice()
                .sort(
                    (
                        a,
                        b
                    ) => {

                        const dateA =
                            new Date(
                                a.createdAt || 0
                            ).getTime();


                        const dateB =
                            new Date(
                                b.createdAt || 0
                            ).getTime();


                        return dateB - dateA;

                    }
                )
                .slice(
                    0,
                    5
                );


        dashboardProperties.innerHTML =
            latestProperties
                .map(
                    property =>
                        createPropertyItem(
                            property
                        )
                )
                .join("");

    }

    function createPropertyItem(property) {

        const type =
            getPropertyType(
                property.type
            );


        const status =
            getPropertyStatus(
                property.status
            );


        const statusClass =
            getStatusClass(
                property.status
            );


        return `

            <div class="dashboard-property-item">

                <div class="dashboard-property-icon">
                    🏢
                </div>


                <div class="dashboard-property-info">

                    <strong>
                        ${escapeHtml(
                            property.name
                        )}
                    </strong>


                    <span>
                        ${escapeHtml(
                            property.address
                        )}
                    </span>


                    <span>
                        ${type}
                    </span>

                </div>


                <div class="dashboard-property-right">

                    <strong>
                        ${formatMoney(
                            property.rent
                        )}
                        в месяц
                    </strong>


                    <span
                        class="card-status ${statusClass}"
                    >
                        ${status}
                    </span>

                </div>

            </div>

        `;

    }

    function getPropertyType(type) {

        const types = {

            APARTMENT:
                "Квартира",

            HOUSE:
                "Дом",

            COMMERCIAL:
                "Коммерческое помещение"

        };


        return (
            types[type] ||
            "Недвижимость"
        );

    }

    function getPropertyStatus(status) {

        const statuses = {

            RENTED:
                "Сдана",

            AVAILABLE:
                "Свободна",

            MAINTENANCE:
                "На обслуживании"

        };


        return (
            statuses[status] ||
            "Неизвестно"
        );

    }

    function getStatusClass(status) {

        if (
            status === "RENTED"
        ) {

            return "rented";

        }


        if (
            status === "MAINTENANCE"
        ) {

            return "maintenance";

        }


        return "available";

    }

    function calculateIncome(payments) {

        return payments.reduce(

            (
                total,
                payment
            ) => {

                const status =
                    String(
                        payment.status || ""
                    ).toUpperCase();


                const isPaid =
                    status === "PAID" ||
                    status === "COMPLETED" ||
                    status === "SUCCESS";


                if (!isPaid) {

                    return total;

                }


                return (
                    total +
                    Number(
                        payment.amount || 0
                    )
                );

            },

            0

        );

    }

    function calculateDebt(payments) {

        return payments.reduce(

            (
                total,
                payment
            ) => {

                const status =
                    String(
                        payment.status || ""
                    ).toUpperCase();


                const isDebt =
                    status === "UNPAID" ||
                    status === "PENDING" ||
                    status === "OVERDUE" ||
                    status === "DUE";


                if (!isDebt) {

                    return total;

                }


                return (
                    total +
                    Number(
                        payment.amount || 0
                    )
                );

            },

            0

        );

    }

    function renderPaymentStatistics(
        payments
    ) {

        if (
            !payments.length
        ) {

            if (paymentProgress) {

                paymentProgress.textContent =
                    "0%";

            }


            if (
                paymentProgressFill
            ) {

                paymentProgressFill.style.width =
                    "0%";

            }


            if (paidAmount) {

                paidAmount.textContent =
                    "0 ₽ оплачено";

            }


            if (expectedAmount) {

                expectedAmount.textContent =
                    "0 ₽ всего";

            }


            return;

        }


        let paid = 0;

        let expected = 0;


        payments.forEach(
            payment => {

                const amount =
                    Number(
                        payment.amount || 0
                    );


                expected +=
                    amount;


                const status =
                    String(
                        payment.status || ""
                    ).toUpperCase();


                if (
                    status === "PAID" ||
                    status === "COMPLETED" ||
                    status === "SUCCESS"
                ) {

                    paid +=
                        amount;

                }

            }
        );


        const percentage =
            expected > 0

                ? Math.round(
                    (
                        paid /
                        expected
                    ) * 100
                )

                : 0;


        if (paymentProgress) {

            paymentProgress.textContent =
                `${percentage}%`;

        }


        if (
            paymentProgressFill
        ) {

            paymentProgressFill.style.width =
                `${percentage}%`;

        }


        if (paidAmount) {

            paidAmount.textContent =
                `${formatMoney(
                    paid
                )} оплачено`;

        }


        if (expectedAmount) {

            expectedAmount.textContent =
                `${formatMoney(
                    expected
                )} всего`;

        }

    }


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            () => {

                clearAuth();


                window.location.href =
                    "pages/login.html";

            }
        );

    }

    function formatMoney(value) {

        const number =
            Number(
                value || 0
            );


        return (
            new Intl.NumberFormat(
                "ru-RU",
                {
                    maximumFractionDigits: 2
                }
            ).format(number)
            + " ₽"
        );

    }

    function escapeHtml(value) {

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

    renderUser();

    loadDashboard();

});