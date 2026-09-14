const API_URL = window.location.origin;


/* ==================================================
   АВТОРИЗАЦИЯ
================================================== */

function getToken() {
    return localStorage.getItem("token");
}


function getSavedUser() {
    try {
        return JSON.parse(
            localStorage.getItem("user")
        );
    } catch (error) {
        return null;
    }
}


function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/pages/login.html";
}


/* ==================================================
   ОБЩИЕ ФУНКЦИИ
================================================== */

function formatMoney(value) {

    return new Intl.NumberFormat(
        "ru-RU"
    ).format(
        Number(value) || 0
    ) + " ₽";

}


function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


function getRoleName(role) {

    const roles = {

        OWNER: "Владелец",

        MANAGER: "Управляющий",

        TENANT: "Арендатор"

    };

    return roles[role] || role;

}


function getInitials(name) {

    if (!name) {
        return "?";
    }


    const parts =
        name
            .trim()
            .split(/\s+/);


    if (parts.length === 1) {

        return parts[0]
            .substring(0, 2)
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[1][0]
    ).toUpperCase();

}


/* ==================================================
   API
================================================== */

async function apiRequest(
    url,
    options = {}
) {

    const token =
        getToken();


    if (!token) {

        logout();

        throw new Error(
            "Требуется авторизация"
        );

    }


    const response =
        await fetch(
            `${API_URL}${url}`,
            {
                ...options,

                headers: {

                    "Content-Type":
                        "application/json",

                    ...(options.headers || {}),

                    Authorization:
                        `Bearer ${token}`

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
        response.status === 401 ||
        response.status === 403
    ) {

        logout();

        throw new Error(
            "Сессия закончилась. Выполните вход снова."
        );

    }


    if (!response.ok) {

        throw new Error(
            data?.message ||
            "Ошибка сервера"
        );

    }


    return data;

}


/* ==================================================
   ПОЛЬЗОВАТЕЛЬ
================================================== */

async function getCurrentUser() {

    return await apiRequest(
        "/api/auth/me"
    );

}


/* ==================================================
   ОБЪЕКТЫ — API
================================================== */

async function getProperties() {

    return await apiRequest(
        "/api/properties"
    );

}


async function createProperty(
    property
) {

    return await apiRequest(
        "/api/properties",
        {
            method: "POST",

            body:
                JSON.stringify(
                    property
                )
        }
    );

}


async function updateProperty(
    id,
    property
) {

    return await apiRequest(
        `/api/properties/${id}`,
        {
            method: "PUT",

            body:
                JSON.stringify(
                    property
                )
        }
    );

}


async function deleteProperty(
    id
) {

    return await apiRequest(
        `/api/properties/${id}`,
        {
            method: "DELETE"
        }
    );

}


/* ==================================================
   LOGOUT BUTTON
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const logoutButton =
            document.getElementById(
                "logoutButton"
            );


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    logout();

                }
            );

        }

    }
);