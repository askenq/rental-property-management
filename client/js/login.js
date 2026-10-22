document.addEventListener(
    "DOMContentLoaded",
    function () {

        initializeLogin();

    }
);

function initializeLogin() {

    const form =
        document.getElementById(
            "loginForm"
        );


    if (!form) {

        console.error(
            "Форма входа loginForm не найдена."
        );

        return;

    }


    form.addEventListener(
        "submit",
        handleLogin
    );


    console.log(
        "Форма входа готова."
    );

}

async function handleLogin(
    event
) {

    event.preventDefault();


    clearMessage();


    const email =
        getInputValue(
            "email"
        ).trim();


    const password =
        getInputValue(
            "password"
        );


    if (!email) {

        showMessage(
            "Введите email."
        );

        return;

    }


    if (!isValidEmail(email)) {

        showMessage(
            "Введите корректный email."
        );

        return;

    }


    if (!password) {

        showMessage(
            "Введите пароль."
        );

        return;

    }


    const submitButton =
        document.querySelector(
            "#loginForm button[type='submit']"
        );


    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.textContent =
            "Вход...";

    }

    try {

        console.log(
            "Выполняем вход:",
            email
        );


        const response =
            await fetch(
                "/api/auth/login",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            email,

                            password

                        })

                }
            );


        const data =
            await parseResponse(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Неверный email или пароль."
            );

        }


        console.log(
            "Вход успешен:",
            data
        );

        if (data.token) {

            saveToken(
                data.token
            );

        } else {

            throw new Error(
                "Сервер не вернул токен авторизации."
            );

        }


        if (data.user) {

            saveUser(
                data.user
            );

        }


        showMessage(
            data.message ||
            "Вход выполнен успешно.",
            "success"
        );


        setTimeout(
            function () {

                window.location.href =
                    "/index.html";

            },
            500
        );


    } catch (error) {

        console.error(
            "Ошибка входа:",
            error
        );


        showMessage(
            error.message ||
            "Произошла ошибка при входе."
        );


    } finally {

        if (submitButton) {

            submitButton.disabled =
                false;

            submitButton.textContent =
                "Войти";

        }

    }

}


function saveToken(
    token
) {

    localStorage.setItem(
        "token",
        token
    );

}

function saveUser(
    user
) {

    localStorage.setItem(
        "user",
        JSON.stringify(
            user
        )
    );

}

async function parseResponse(
    response
) {

    const text =
        await response.text();


    if (!text) {

        return {};

    }


    try {

        return JSON.parse(
            text
        );

    } catch {

        return {

            message: text

        };

    }

}


function getInputValue(
    id
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return "";

    }


    return element.value;

}


function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            email
        );

}


function showMessage(
    message,
    type = "error"
) {

    let element =
        document.getElementById(
            "loginMessage"
        );


    if (!element) {

        const form =
            document.getElementById(
                "loginForm"
            );


        if (!form) {

            return;

        }


        element =
            document.createElement(
                "div"
            );


        element.id =
            "loginMessage";


        form.prepend(
            element
        );

    }


    element.textContent =
        message;


    element.className =
        `auth-message ${type}`;

}


function clearMessage() {

    const element =
        document.getElementById(
            "loginMessage"
        );


    if (!element) {

        return;

    }


    element.textContent =
        "";

    element.className =
        "auth-message";

}