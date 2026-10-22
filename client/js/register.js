document.addEventListener(
    "DOMContentLoaded",
    function () {

        initializeRegistration();

    }
);

function initializeRegistration() {

    const form =
        document.getElementById(
            "registerForm"
        );


    if (!form) {

        console.error(
            "Форма регистрации registerForm не найдена."
        );

        return;

    }


    form.addEventListener(
        "submit",
        handleRegistration
    );


    console.log(
        "Форма регистрации готова."
    );

}

async function handleRegistration(
    event
) {

    event.preventDefault();


    clearMessage();


    const name =
        getInputValue(
            "name"
        ).trim();


    const email =
        getInputValue(
            "email"
        ).trim();


    const password =
        getInputValue(
            "password"
        );


    const role =
        getInputValue(
            "role"
        );

    if (!name) {

        showMessage(
            "Введите имя."
        );

        return;

    }


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


    if (
        password.length <
        6
    ) {

        showMessage(
            "Пароль должен содержать минимум 6 символов."
        );

        return;

    }


    if (!role) {

        showMessage(
            "Выберите роль пользователя."
        );

        return;

    }

    const submitButton =
        document.querySelector(
            "#registerForm button[type='submit']"
        );


    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.textContent =
            "Регистрация...";

    }

    try {

        console.log(
            "Отправляем регистрацию:",
            {
                name,
                email,
                role
            }
        );


        const response =
            await fetch(
                "/api/auth/register",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            name,

                            email,

                            password,

                            role

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
                "Не удалось зарегистрировать пользователя."
            );

        }


        console.log(
            "Регистрация успешна:",
            data
        );

        if (data.token) {

            saveToken(
                data.token
            );

        }


        if (data.user) {

            saveUser(
                data.user
            );

        }


        showMessage(
            data.message ||
            "Регистрация выполнена успешно.",
            "success"
        );

        setTimeout(
            function () {

                window.location.href =
                    "/index.html";

            },
            700
        );


    } catch (error) {

        console.error(
            "Ошибка регистрации:",
            error
        );


        showMessage(
            error.message ||
            "Произошла ошибка при регистрации."
        );


    } finally {

        if (submitButton) {

            submitButton.disabled =
                false;

            submitButton.textContent =
                "Зарегистрироваться";

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
            "registerMessage"
        );

    if (!element) {

        const form =
            document.getElementById(
                "registerForm"
            );


        if (!form) {

            return;

        }


        element =
            document.createElement(
                "div"
            );


        element.id =
            "registerMessage";


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
            "registerMessage"
        );


    if (!element) {

        return;

    }


    element.textContent =
        "";

    element.className =
        "auth-message";

}