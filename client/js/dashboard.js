/* =========================================================
   RENTAL MANAGER — DASHBOARD
   Данные загружаются с сервера и из PostgreSQL
========================================================= */

let dashboardProperties = [];
let dashboardUsers = [];
let dashboardPayments = [];


/* =========================================================
   ЗАПУСК
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initializeDashboard();

    }
);


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
========================================================= */

async function initializeDashboard() {

    console.log(
        "Dashboard: запуск..."
    );


    const token =
        getAuthToken();


    if (!token) {

        console.warn(
            "Dashboard: токен не найден."
        );

        window.location.href =
            "/pages/login.html";

        return;

    }


    try {

        await loadDashboardData();


    } catch (error) {

        console.error(
            "Ошибка Dashboard:",
            error
        );


        showDashboardError(
            error.message
        );

    }

}


/* =========================================================
   ПОЛУЧЕНИЕ TOKEN
========================================================= */

function getAuthToken() {

    /*
        Проверяем несколько возможных вариантов,
        чтобы dashboard работал независимо
        от того, как именно login.js сохранил token.
    */

    const possibleKeys = [
        "token",
        "authToken",
        "accessToken",
        "jwt"
    ];


    for (
        const key of possibleKeys
    ) {

        const value =
            localStorage.getItem(
                key
            );


        if (value) {

            return value;

        }

    }


    return null;

}


/* =========================================================
   ЗАГРУЗКА ВСЕХ ДАННЫХ
========================================================= */

async function loadDashboardData() {

    console.log(
        "Dashboard: загрузка данных..."
    );


    const token =
        getAuthToken();


    const headers = {

        "Authorization":
            `Bearer ${token}`,

        "Content-Type":
            "application/json"

    };


    /*
        Загружаем данные независимо друг
        от друга. Если одного endpoint пока
        нет — остальные данные всё равно
        смогут загрузиться.
    */

    const results =
        await Promise.allSettled([

            fetch(
                "/api/properties",
                {
                    method: "GET",
                    headers
                }
            ),

            fetch(
                "/api/users",
                {
                    method: "GET",
                    headers
                }
            ),

            fetch(
                "/api/payments",
                {
                    method: "GET",
                    headers
                }
            )

        ]);


    /* =========================================
       PROPERTIES
    ========================================= */

    if (
        results[0].status ===
        "fulfilled"
    ) {

        const response =
            results[0].value;


        if (response.ok) {

            const data =
                await response.json();


            dashboardProperties =
                normalizeArray(
                    data
                );


            console.log(
                "Dashboard properties:",
                dashboardProperties
            );

        } else {

            console.warn(
                "Не удалось загрузить /api/properties"
            );

        }

    }


    /* =========================================
       USERS
    ========================================= */

    if (
        results[1].status ===
        "fulfilled"
    ) {

        const response =
            results[1].value;


        if (response.ok) {

            const data =
                await response.json();


            dashboardUsers =
                normalizeArray(
                    data
                );


            console.log(
                "Dashboard users:",
                dashboardUsers
            );

        } else {

            console.warn(
                "Не удалось загрузить /api/users"
            );

        }

    }


    /* =========================================
       PAYMENTS
    ========================================= */

    if (
        results[2].status ===
        "fulfilled"
    ) {

        const response =
            results[2].value;


        if (response.ok) {

            const data =
                await response.json();


            dashboardPayments =
                normalizeArray(
                    data
                );


            console.log(
                "Dashboard payments:",
                dashboardPayments
            );

        } else {

            console.warn(
                "Платежи пока недоступны."
            );

        }

    }


    /*
        После получения данных
        обновляем интерфейс.
    */

    updateUserInfo();

    updateStatistics();

    renderRecentProperties();

    updatePayments();


    console.log(
        "Dashboard: данные загружены."
    );

}


/* =========================================================
   НОРМАЛИЗАЦИЯ МАССИВА
========================================================= */

function normalizeArray(
    data
) {

    if (
        Array.isArray(data)
    ) {

        return data;

    }


    if (
        Array.isArray(
            data?.properties
        )
    ) {

        return data.properties;

    }


    if (
        Array.isArray(
            data?.users
        )
    ) {

        return data.users;

    }


    if (
        Array.isArray(
            data?.payments
        )
    ) {

        return data.payments;

    }


    if (
        Array.isArray(
            data?.data
        )
    ) {

        return data.data;

    }


    return [];

}


/* =========================================================
   ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ
========================================================= */

function updateUserInfo() {

    const user =
        getCurrentUser();


    if (!user) {

        return;

    }


    /*
        Заголовок приветствия
    */

    const greeting =
        document.querySelector(
            ".dashboard-header h1"
        );


    if (greeting) {

        const name =
            getSafeString(
                user.name
            );


        if (name) {

            greeting.textContent =
                `Добро пожаловать, ${name}!`;

        }

    }


    /*
        Имя пользователя в профиле,
        если такой блок есть.
    */

    const profileName =
        document.querySelector(
            ".user-name"
        );


    if (profileName) {

        profileName.textContent =
            getSafeString(
                user.name
            ) ||
            "Пользователь";

    }


    /*
        Роль
    */

    const profileRole =
        document.querySelector(
            ".user-role"
        );


    if (profileRole) {

        profileRole.textContent =
            getRoleName(
                user.role
            );

    }

}


/* =========================================================
   ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
========================================================= */

function getCurrentUser() {

    /*
        1. Пытаемся взять пользователя
        из localStorage.
    */

    const storedUser =
        localStorage.getItem(
            "user"
        );


    if (storedUser) {

        try {

            return JSON.parse(
                storedUser
            );

        } catch (error) {

            console.warn(
                "Не удалось прочитать user из localStorage."
            );

        }

    }


    /*
        2. Пытаемся получить информацию
        из JWT.
    */

    const token =
        getAuthToken();


    if (!token) {

        return null;

    }


    try {

        const parts =
            token.split(".");


        if (
            parts.length !== 3
        ) {

            return null;

        }


        const payload =
            JSON.parse(
                decodeBase64Url(
                    parts[1]
                )
            );


        /*
            JWT сейчас содержит:
            userId
            role
        */

        return {

            id:
                payload.userId,

            role:
                payload.role,

            name:
                null

        };

    } catch (error) {

        console.warn(
            "Не удалось разобрать JWT."
        );


        return null;

    }

}


/* =========================================================
   BASE64 URL
========================================================= */

function decodeBase64Url(
    value
) {

    const base64 =
        value
            .replace(
                /-/g,
                "+"
            )
            .replace(
                /_/g,
                "/"
            );


    const padded =
        base64 +
        "=".repeat(
            (4 -
                base64.length %
                4) % 4
        );


    return atob(
        padded
    );

}


/* =========================================================
   СТАТИСТИКА
========================================================= */

function updateStatistics() {

    const propertiesCount =
        dashboardProperties.length;


    /*
        Считаем арендаторов.

        Пользовательская таблица сейчас
        содержит OWNER / MANAGER / TENANT.
    */

    const tenants =
        dashboardUsers.filter(
            function (user) {

                return (
                    String(
                        user.role ||
                        ""
                    ).toUpperCase() ===
                    "TENANT"
                );

            }
        );


    const tenantsCount =
        tenants.length;


    /*
        Доход.

        Если платежи уже существуют —
        считаем их.

        Если платежей пока нет —
        считаем 0.
    */

    const income =
        dashboardPayments
            .filter(
                function (payment) {

                    return isPaymentCompleted(
                        payment
                    );

                }
            )
            .reduce(
                function (
                    sum,
                    payment
                ) {

                    return (
                        sum +
                        getPaymentAmount(
                            payment
                        )
                    );

                },
                0
            );


    /*
        Задолженность
    */

    const debt =
        dashboardPayments
            .filter(
                function (payment) {

                    return isPaymentDebt(
                        payment
                    );

                }
            )
            .reduce(
                function (
                    sum,
                    payment
                ) {

                    return (
                        sum +
                        getPaymentAmount(
                            payment
                        )
                    );

                },
                0
            );


    /*
        Обновляем карточки.

        Используем ID, если они есть.
    */

    setElementText(
        "dashboardPropertiesCount",
        propertiesCount
    );


    setElementText(
        "dashboardTenantsCount",
        tenantsCount
    );


    setElementText(
        "dashboardIncome",
        formatMoney(
            income
        )
    );


    setElementText(
        "dashboardDebt",
        formatMoney(
            debt
        )
    );


    /*
        Если старого HTML ещё нет
        с этими ID — пытаемся найти
        карточки автоматически.
    */

    const statCards =
        document.querySelectorAll(
            ".stat-card"
        );


    if (
        statCards.length >= 4
    ) {

        setStatCardValue(
            statCards[0],
            propertiesCount
        );


        setStatCardValue(
            statCards[1],
            tenantsCount
        );


        setStatCardValue(
            statCards[2],
            formatMoney(
                income
            )
        );


        setStatCardValue(
            statCards[3],
            formatMoney(
                debt
            )
        );

    }

}


/* =========================================================
   ПОСЛЕДНИЕ ОБЪЕКТЫ
========================================================= */

function renderRecentProperties() {

    const container =
        document.getElementById(
            "dashboardProperties"
        );


    /*
        Если ID нет, ищем старый
        контейнер Dashboard.
    */

    const target =
        container ||
        document.querySelector(
            ".dashboard-property-list"
        );


    if (!target) {

        console.warn(
            "Контейнер объектов Dashboard не найден."
        );

        return;

    }


    if (
        dashboardProperties.length ===
        0
    ) {

        target.innerHTML = `

            <div class="empty-state">

                <h2>
                    Пока нет объектов
                </h2>

                <p>
                    Добавьте первый объект недвижимости.
                </p>

            </div>

        `;

        return;

    }


    /*
        Показываем максимум 4 последних
        объекта.
    */

    const recent =
        [...dashboardProperties]
            .sort(
                function (
                    a,
                    b
                ) {

                    return (
                        getDateValue(
                            b.createdAt
                        ) -
                        getDateValue(
                            a.createdAt
                        )
                    );

                }
            )
            .slice(
                0,
                4
            );


    target.innerHTML = "";


    recent.forEach(
        function (property) {

            const item =
                createDashboardProperty(
                    property
                );


            target.appendChild(
                item
            );

        }
    );

}


/* =========================================================
   КАРТОЧКА ОБЪЕКТА НА DASHBOARD
========================================================= */

function createDashboardProperty(
    property
) {

    const element =
        document.createElement(
            "div"
        );


    element.className =
        "dashboard-property-item";


    const status =
        getPropertyStatus(
            property.status
        );


    const type =
        getPropertyType(
            property.type
        );


    element.innerHTML = `

        <div
            class="dashboard-property-image"
        >
            ${getPropertyIcon(
                property.type
            )}
        </div>


        <div
            class="dashboard-property-info"
        >

            <strong>
                ${escapeHtml(
                    property.name ||
                    "Без названия"
                )}
            </strong>

            <span>
                ${escapeHtml(
                    property.address ||
                    "Адрес не указан"
                )}
            </span>

            <small>
                ${type} · ${status.text}
            </small>

        </div>


        <div
            class="dashboard-property-rent"
        >

            <strong>
                ${formatMoney(
                    property.rent
                )}
            </strong>

            <span>
                в месяц
            </span>

        </div>

    `;


    return element;

}


/* =========================================================
   ПЛАТЕЖИ
========================================================= */

function updatePayments() {

    const total =
        dashboardPayments.reduce(
            function (
                sum,
                payment
            ) {

                return (
                    sum +
                    getPaymentAmount(
                        payment
                    )
                );

            },
            0
        );


    const paid =
        dashboardPayments
            .filter(
                isPaymentCompleted
            )
            .reduce(
                function (
                    sum,
                    payment
                ) {

                    return (
                        sum +
                        getPaymentAmount(
                            payment
                        )
                    );

                },
                0
            );


    const percentage =
        total > 0
            ? Math.round(
                (
                    paid /
                    total
                ) * 100
            )
            : 0;


    /*
        Прогресс
    */

    const progress =
        document.querySelector(
            ".payment-progress"
        );


    if (progress) {

        progress.style.width =
            `${percentage}%`;

    }


    /*
        Процент
    */

    const percentElement =
        document.querySelector(
            ".payment-percent"
        );


    if (percentElement) {

        percentElement.textContent =
            `${percentage}%`;

    }


    /*
        Текст "оплачено"
    */

    const paidElement =
        document.querySelector(
            ".payments-paid"
        );


    if (paidElement) {

        paidElement.textContent =
            `${formatMoney(
                paid
            )} оплачено`;

    }


    /*
        Текст "всего"
    */

    const totalElement =
        document.querySelector(
            ".payments-total"
        );


    if (totalElement) {

        totalElement.textContent =
            `${formatMoney(
                total
            )} всего`;

    }

}


/* =========================================================
   СТАТУС ОБЪЕКТА
========================================================= */

function getPropertyStatus(
    status
) {

    const statuses = {

        RENTED: {
            text: "Сдана"
        },

        AVAILABLE: {
            text: "Свободна"
        },

        MAINTENANCE: {
            text: "Обслуживание"
        }

    };


    const normalized =
        String(
            status ||
            ""
        ).toUpperCase();


    return (
        statuses[
            normalized
        ] || {
            text:
                status ||
                "Не указан"
        }
    );

}


/* =========================================================
   ТИП ОБЪЕКТА
========================================================= */

function getPropertyType(
    type
) {

    const types = {

        APARTMENT:
            "Квартира",

        HOUSE:
            "Дом",

        COMMERCIAL:
            "Коммерческая недвижимость"

    };


    const normalized =
        String(
            type ||
            ""
        ).toUpperCase();


    return (
        types[
            normalized
        ] ||
        type ||
        "Объект"
    );

}


/* =========================================================
   ИКОНКА
========================================================= */

function getPropertyIcon(
    type
) {

    const normalized =
        String(
            type ||
            ""
        ).toUpperCase();


    if (
        normalized ===
        "HOUSE"
    ) {

        return "🏠";

    }


    if (
        normalized ===
        "COMMERCIAL"
    ) {

        return "🏢";

    }


    return "🏢";

}


/* =========================================================
   ПЛАТЕЖ
========================================================= */

function getPaymentAmount(
    payment
) {

    if (!payment) {

        return 0;

    }


    const possibleValues = [

        payment.amount,

        payment.sum,

        payment.price,

        payment.value

    ];


    for (
        const value of
        possibleValues
    ) {

        if (
            value !==
                undefined &&
            value !==
                null
        ) {

            const number =
                Number(
                    value
                );


            if (
                !Number.isNaN(
                    number
                )
            ) {

                return number;

            }

        }

    }


    return 0;

}


/* =========================================================
   ОПЛАЧЕН
========================================================= */

function isPaymentCompleted(
    payment
) {

    const status =
        String(
            payment?.status ||
            ""
        ).toUpperCase();


    return [

        "PAID",
        "COMPLETED",
        "SUCCESS",
        "SUCCESSFUL"

    ].includes(
        status
    );

}


/* =========================================================
   ДОЛГ
========================================================= */

function isPaymentDebt(
    payment
) {

    const status =
        String(
            payment?.status ||
            ""
        ).toUpperCase();


    return [

        "DEBT",
        "OVERDUE",
        "UNPAID",
        "PENDING"

    ].includes(
        status
    );

}


/* =========================================================
   STAT CARD
========================================================= */

function setStatCardValue(
    card,
    value
) {

    if (!card) {

        return;

    }


    const valueElement =
        card.querySelector(
            ".stat-value"
        );


    if (valueElement) {

        valueElement.textContent =
            value;

    }

}


/* =========================================================
   TEXT BY ID
========================================================= */

function setElementText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


/* =========================================================
   MONEY
========================================================= */

function formatMoney(
    value
) {

    return (
        new Intl.NumberFormat(
            "ru-RU"
        ).format(
            Number(
                value
            ) || 0
        ) +
        " ₽"
    );

}


/* =========================================================
   DATE
========================================================= */

function getDateValue(
    value
) {

    if (!value) {

        return 0;

    }


    const date =
        new Date(
            value
        );


    const timestamp =
        date.getTime();


    return Number.isNaN(
        timestamp
    )
        ? 0
        : timestamp;

}


/* =========================================================
   ROLE
========================================================= */

function getRoleName(
    role
) {

    const roles = {

        OWNER:
            "Владелец",

        MANAGER:
            "Управляющий",

        TENANT:
            "Арендатор"

    };


    return (
        roles[
            String(
                role ||
                ""
            ).toUpperCase()
        ] ||
        "Пользователь"
    );

}


/* =========================================================
   SAFE STRING
========================================================= */

function getSafeString(
    value
) {

    if (
        value ===
            null ||
        value ===
            undefined
    ) {

        return "";

    }


    return String(
        value
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        getSafeString(
            value
        );


    return div.innerHTML;

}


/* =========================================================
   ОШИБКА DASHBOARD
========================================================= */

function showDashboardError(
    message
) {

    const container =
        document.querySelector(
            ".dashboard-property-list"
        );


    if (!container) {

        return;

    }


    container.innerHTML = `

        <div class="empty-state">

            <h2>
                Не удалось загрузить данные
            </h2>

            <p>
                ${escapeHtml(
                    message ||
                    "Неизвестная ошибка"
                )}
            </p>

        </div>

    `;

}