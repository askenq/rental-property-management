let properties = [];

let editingPropertyId = null;

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const propertiesGrid =
            document.getElementById(
                "propertiesGrid"
            );


        if (!propertiesGrid) {
            return;
        }


        if (typeof getToken !== "function") {

            console.error(
                "common.js не загружен."
            );

            return;

        }


        if (!getToken()) {

            window.location.href =
                "/pages/login.html";

            return;

        }


        initializePropertiesPage();

    }
);

function initializePropertiesPage() {

    setupAddButton();

    setupModal();

    setupFilters();

    setupPropertyActions();

    loadProperties();

}

function setupAddButton() {

    const button =
        document.getElementById(
            "addPropertyButton"
        );


    if (!button) {

        console.error(
            "Кнопка addPropertyButton не найдена."
        );

        return;

    }


    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            console.log(
                "Кнопка добавления нажата"
            );

            openPropertyModal();

        }
    );

}

function setupModal() {

    const modal =
        document.getElementById(
            "propertyModal"
        );


    const closeButton =
        document.getElementById(
            "closeModal"
        );


    const cancelButton =
        document.getElementById(
            "cancelModal"
        );


    const form =
        document.getElementById(
            "propertyForm"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            function () {

                closePropertyModal();

            }
        );

    }


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            function () {

                closePropertyModal();

            }
        );

    }


    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    modal
                ) {

                    closePropertyModal();

                }

            }
        );

    }


    if (form) {

        form.addEventListener(
            "submit",
            handlePropertySubmit
        );

    }


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                modal?.classList.contains(
                    "active"
                )
            ) {

                closePropertyModal();

            }

        }
    );

}

function setupFilters() {

    const searchInput =
        document.getElementById(
            "propertySearch"
        );


    const statusFilter =
        document.getElementById(
            "propertyStatus"
        );


    const typeFilter =
        document.getElementById(
            "propertyType"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderProperties
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            renderProperties
        );

    }


    if (typeFilter) {

        typeFilter.addEventListener(
            "change",
            renderProperties
        );

    }

}

function setupPropertyActions() {

    const grid =
        document.getElementById(
            "propertiesGrid"
        );


    if (!grid) {
        return;
    }


    grid.addEventListener(
        "click",
        function (event) {

            const editButton =
                event.target.closest(
                    ".edit-property"
                );


            const deleteButton =
                event.target.closest(
                    ".delete-property"
                );


            if (editButton) {

                const id =
                    Number(
                        editButton.dataset.id
                    );


                const property =
                    properties.find(
                        item =>
                            Number(
                                item.id
                            ) === id
                    );


                if (property) {

                    openPropertyModal(
                        property
                    );

                }


                return;

            }


            if (deleteButton) {

                const id =
                    Number(
                        deleteButton.dataset.id
                    );


                deletePropertyFromDatabase(
                    id
                );

            }

        }
    );

}

async function loadProperties() {

    const grid =
        document.getElementById(
            "propertiesGrid"
        );


    if (!grid) {
        return;
    }


    grid.innerHTML = `
        <div class="empty-state">

            <h2>
                Загрузка объектов...
            </h2>

            <p>
                Получаем данные из базы данных.
            </p>

        </div>
    `;


    try {

        const result =
            await getProperties();


        if (Array.isArray(result)) {

            properties = result;

        } else if (
            Array.isArray(
                result?.properties
            )
        ) {

            properties =
                result.properties;

        } else {

            properties = [];

        }


        console.log(
            "Объекты загружены:",
            properties
        );


        renderProperties();

    } catch (error) {

        console.error(
            "Ошибка загрузки объектов:",
            error
        );


        grid.innerHTML = `
            <div class="empty-state">

                <h2>
                    Не удалось загрузить объекты
                </h2>

                <p>
                    ${escapeHtml(
                        error.message
                    )}
                </p>

            </div>
        `;

    }

}

function renderProperties() {

    const grid =
        document.getElementById(
            "propertiesGrid"
        );


    if (!grid) {
        return;
    }


    const searchInput =
        document.getElementById(
            "propertySearch"
        );


    const statusFilter =
        document.getElementById(
            "propertyStatus"
        );


    const typeFilter =
        document.getElementById(
            "propertyType"
        );


    const searchValue =
        searchInput?.value
            .trim()
            .toLowerCase() || "";


    const selectedStatus =
        statusFilter?.value ||
        "all";


    const selectedType =
        typeFilter?.value ||
        "all";


    const filteredProperties =
        properties.filter(
            function (property) {

                const name =
                    String(
                        property.name ||
                        ""
                    ).toLowerCase();


                const address =
                    String(
                        property.address ||
                        ""
                    ).toLowerCase();


                const matchesSearch =
                    name.includes(
                        searchValue
                    ) ||
                    address.includes(
                        searchValue
                    );


                const matchesStatus =
                    selectedStatus ===
                        "all" ||
                    property.status ===
                        selectedStatus;


                const matchesType =
                    selectedType ===
                        "all" ||
                    property.type ===
                        selectedType;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesType
                );

            }
        );


    grid.innerHTML = "";


    if (
        filteredProperties.length ===
        0
    ) {

        grid.innerHTML = `
            <div class="empty-state">

                <h2>
                    Объекты не найдены
                </h2>

                <p>
                    Измените параметры поиска
                    или добавьте новый объект.
                </p>

            </div>
        `;

        updateStatistics();

        return;

    }


    filteredProperties.forEach(
        function (property) {

            const card =
                createPropertyCard(
                    property
                );


            grid.appendChild(card);

        }
    );


    updateStatistics();

}

function createPropertyCard(
    property
) {

    const article =
        document.createElement(
            "article"
        );


    article.className =
        "property-card";


    const status =
        getStatusInfo(
            property.status
        );


    const type =
        String(
            property.type || ""
        ).toUpperCase();

    const tenantName =
        property.tenant?.fullName ||
        property.tenantName ||
        "Нет арендатора";


    let image =
        "🏢";


    let imageClass =
        "image-blue";


    if (type === "HOUSE") {

        image =
            "🏠";

        imageClass =
            "image-orange";

    }


    if (
        type === "COMMERCIAL"
    ) {

        image =
            "🏢";

        imageClass =
            "image-purple";

    }


    article.innerHTML = `

        <div
            class="property-card-image ${imageClass}"
        >

            ${image}

            <span
                class="card-status ${status.className}"
            >
                ${status.text}
            </span>

        </div>


        <div
            class="property-card-content"
        >

            <div
                class="property-card-title"
            >

                <div>

                    <h2>
                        ${escapeHtml(
                            property.name
                        )}
                    </h2>

                    <p>
                        ${escapeHtml(
                            property.address
                        )}
                    </p>

                </div>


                <div
                    class="property-actions"
                >

                    <button
                        type="button"
                        class="more-button edit-property"
                        data-id="${property.id}"
                        title="Редактировать"
                    >
                        ✎
                    </button>


                    <button
                        type="button"
                        class="more-button delete-property"
                        data-id="${property.id}"
                        title="Удалить"
                    >
                        ×
                    </button>

                </div>

            </div>


            <div
                class="property-type"
            >
                ${getPropertyTypeName(
                    property.type
                )}
            </div>


            <div
                class="property-details"
            >

                <span>
                    ${property.area ?? 0} м²
                </span>

                <span>
                    ${property.rooms ?? 0} комнат
                </span>

                <span>
                    ${property.floor ?? 0} этаж
                </span>

            </div>


            <div
                class="property-card-footer"
            >

                <div>

                    <small>
                        Арендатор
                    </small>

                    <strong>
                        ${escapeHtml(
                            tenantName
                        )}
                    </strong>

                </div>


                <div
                    class="property-rent"
                >

                    <small>
                        Аренда
                    </small>

                    <strong>
                        ${formatMoney(
                            property.rent
                        )}
                    </strong>

                </div>

            </div>

        </div>

    `;


    return article;

}

function getStatusInfo(
    status
) {

    const statuses = {

        RENTED: {
            text: "Сдана",
            className: "rented"
        },

        AVAILABLE: {
            text: "Свободна",
            className: "available"
        },

        MAINTENANCE: {
            text: "Обслуживание",
            className: "maintenance"
        }

    };


    return (
        statuses[status] || {
            text:
                status ||
                "Не указан",

            className: ""
        }
    );

}

function getPropertyTypeName(
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


    return (
        types[type] ||
        type ||
        "Не указан"
    );

}

function updateStatistics() {

    const total =
        properties.length;


    const rented =
        properties.filter(
            function (property) {

                return (
                    property.status ===
                    "RENTED"
                );

            }
        ).length;


    const available =
        properties.filter(
            function (property) {

                return (
                    property.status ===
                    "AVAILABLE"
                );

            }
        ).length;


    const potentialIncome =
        properties
            .filter(
                function (property) {

                    return (
                        property.status ===
                            "RENTED" ||
                        property.status ===
                            "AVAILABLE"
                    );

                }
            )
            .reduce(
                function (
                    sum,
                    property
                ) {

                    return (
                        sum +
                        Number(
                            property.rent ||
                            0
                        )
                    );

                },
                0
            );


    setText(
        "totalProperties",
        total
    );


    setText(
        "rentedProperties",
        rented
    );


    setText(
        "availableProperties",
        available
    );


    setText(
        "potentialIncome",
        formatMoney(
            potentialIncome
        )
    );

}

function openPropertyModal(
    property = null
) {

    const modal =
        document.getElementById(
            "propertyModal"
        );


    const form =
        document.getElementById(
            "propertyForm"
        );


    if (!modal || !form) {

        console.error(
            "Модальное окно или форма не найдены."
        );

        return;

    }


    editingPropertyId =
        property
            ? property.id
            : null;


    const title =
        document.getElementById(
            "modalTitle"
        );


    const saveButton =
        document.getElementById(
            "savePropertyButton"
        );


    clearFormMessage();


    if (property) {

        if (title) {

            title.textContent =
                "Редактировать объект";

        }


        setValue(
            "propertyName",
            property.name
        );


        setValue(
            "propertyAddress",
            property.address
        );


        setValue(
            "propertyTypeInput",
            property.type
        );


        setValue(
            "propertyStatusInput",
            property.status
        );


        setValue(
            "propertyRooms",
            property.rooms
        );


        setValue(
            "propertyArea",
            property.area
        );


        setValue(
            "propertyFloor",
            property.floor
        );


        setValue(
            "propertyRent",
            property.rent
        );


        if (saveButton) {

            saveButton.textContent =
                "Сохранить изменения";

        }

    } else {

        form.reset();


        if (title) {

            title.textContent =
                "Добавить объект";

        }


        setValue(
            "propertyTypeInput",
            "APARTMENT"
        );


        setValue(
            "propertyStatusInput",
            "AVAILABLE"
        );


        if (saveButton) {

            saveButton.textContent =
                "Сохранить";

        }

    }


    modal.classList.add(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    setTimeout(
        function () {

            document
                .getElementById(
                    "propertyName"
                )
                ?.focus();

        },
        50
    );

}

function closePropertyModal() {

    const modal =
        document.getElementById(
            "propertyModal"
        );


    const form =
        document.getElementById(
            "propertyForm"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );


        modal.setAttribute(
            "aria-hidden",
            "true"
        );

    }


    if (form) {

        form.reset();

    }


    editingPropertyId =
        null;


    clearFormMessage();

}

async function handlePropertySubmit(
    event
) {

    event.preventDefault();


    clearFormMessage();


    const name =
        getValue(
            "propertyName"
        ).trim();


    const address =
        getValue(
            "propertyAddress"
        ).trim();


    const type =
        getValue(
            "propertyTypeInput"
        );


    const status =
        getValue(
            "propertyStatusInput"
        );


    const rooms =
        Number(
            getValue(
                "propertyRooms"
            )
        );


    const area =
        Number(
            getValue(
                "propertyArea"
            )
        );


    const floor =
        Number(
            getValue(
                "propertyFloor"
            )
        );


    const rent =
        Number(
            getValue(
                "propertyRent"
            )
        );


    if (!name) {

        showFormMessage(
            "Введите название объекта."
        );

        return;

    }


    if (!address) {

        showFormMessage(
            "Введите адрес объекта."
        );

        return;

    }


    if (!type) {

        showFormMessage(
            "Выберите тип объекта."
        );

        return;

    }


    if (!status) {

        showFormMessage(
            "Выберите статус объекта."
        );

        return;

    }


    if (
        Number.isNaN(rooms) ||
        rooms < 0
    ) {

        showFormMessage(
            "Введите корректное количество комнат."
        );

        return;

    }


    if (
        Number.isNaN(area) ||
        area <= 0
    ) {

        showFormMessage(
            "Введите корректную площадь."
        );

        return;

    }


    if (
        Number.isNaN(floor) ||
        floor < 0
    ) {

        showFormMessage(
            "Введите корректный этаж."
        );

        return;

    }


    if (
        Number.isNaN(rent) ||
        rent < 0
    ) {

        showFormMessage(
            "Введите корректную арендную плату."
        );

        return;

    }


    const propertyData = {

        name,

        address,

        type,

        status,

        rooms,

        area,

        floor,

        rent

    };


    const saveButton =
        document.getElementById(
            "savePropertyButton"
        );


    const isEditing =
        editingPropertyId !==
        null;


    try {

        if (saveButton) {

            saveButton.disabled =
                true;

            saveButton.textContent =
                "Сохранение...";

        }


        console.log(
            "Отправляем объект:",
            propertyData
        );


        if (isEditing) {

            await updateProperty(
                editingPropertyId,
                propertyData
            );

        } else {

            await createProperty(
                propertyData
            );

        }


        closePropertyModal();


        await loadProperties();

    } catch (error) {

        console.error(
            "Ошибка сохранения объекта:",
            error
        );


        showFormMessage(
            error.message ||
            "Не удалось сохранить объект."
        );

    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                isEditing
                    ? "Сохранить изменения"
                    : "Сохранить";

        }

    }

}

async function deletePropertyFromDatabase(
    id
) {

    const property =
        properties.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(id)
                );

            }
        );


    if (!property) {
        return;
    }


    const confirmed =
        window.confirm(
            `Удалить объект "${property.name}"?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await deleteProperty(
            id
        );


        await loadProperties();

    } catch (error) {

        console.error(
            "Ошибка удаления:",
            error
        );


        alert(
            error.message ||
            "Не удалось удалить объект."
        );

    }

}

function getValue(id) {

    const element =
        document.getElementById(id);


    return element
        ? element.value
        : "";

}


function setValue(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.value =
            value ?? "";

    }

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;

    }

}


function clearFormMessage() {

    const message =
        document.getElementById(
            "propertyFormMessage"
        );


    if (message) {

        message.textContent =
            "";

        message.className =
            "form-message";

    }

}


function showFormMessage(
    text
) {

    const message =
        document.getElementById(
            "propertyFormMessage"
        );


    if (message) {

        message.textContent =
            text;

        message.className =
            "form-message error";

    }

}


function formatMoney(
    value
) {

    return (
        new Intl.NumberFormat(
            "ru-RU"
        ).format(
            Number(value) || 0
        ) +
        " ₽"
    );

}


function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value ?? "";


    return div.innerHTML;

}