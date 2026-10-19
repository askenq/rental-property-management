/* ==================================================
   CONTRACTS
================================================== */


/* ==================================================
   STATE
================================================== */

let contracts = [];

let tenants = [];

let properties = [];

let editingContractId = null;


/* ==================================================
   ELEMENTS
================================================== */

const contractsList =
    document.getElementById(
        "contractsList"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const statusFilter =
    document.getElementById(
        "statusFilter"
    );

const totalContracts =
    document.getElementById(
        "totalContracts"
    );

const activeContracts =
    document.getElementById(
        "activeContracts"
    );

const expiringContracts =
    document.getElementById(
        "expiringContracts"
    );

const finishedContracts =
    document.getElementById(
        "finishedContracts"
    );

const contractModal =
    document.getElementById(
        "contractModal"
    );

const contractForm =
    document.getElementById(
        "contractForm"
    );

const modalTitle =
    document.getElementById(
        "modalTitle"
    );

const contractId =
    document.getElementById(
        "contractId"
    );

const contractNumber =
    document.getElementById(
        "contractNumber"
    );

const tenantId =
    document.getElementById(
        "tenantId"
    );

const propertyId =
    document.getElementById(
        "propertyId"
    );

const startDate =
    document.getElementById(
        "startDate"
    );

const endDate =
    document.getElementById(
        "endDate"
    );

const rent =
    document.getElementById(
        "rent"
    );

const deposit =
    document.getElementById(
        "deposit"
    );

const paymentDay =
    document.getElementById(
        "paymentDay"
    );

const contractStatus =
    document.getElementById(
        "contractStatus"
    );

const contractNotes =
    document.getElementById(
        "contractNotes"
    );

const formError =
    document.getElementById(
        "formError"
    );

const addContractButton =
    document.getElementById(
        "addContractButton"
    );

const closeModalButton =
    document.getElementById(
        "closeModalButton"
    );

const cancelModalButton =
    document.getElementById(
        "cancelModalButton"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


/* ==================================================
   TOKEN
================================================== */

function getToken() {

    return (
        localStorage.getItem(
            "token"
        ) ||
        localStorage.getItem(
            "authToken"
        )
    );

}


/* ==================================================
   API REQUEST
================================================== */

async function apiRequest(
    url,
    options = {}
) {

    const token =
        getToken();


    const headers = {

        "Content-Type":
            "application/json",

        ...(options.headers || {})

    };


    if (token) {

        headers.Authorization =
            `Bearer ${token}`;

    }


    const response =
        await fetch(
            url,
            {

                ...options,

                headers

            }
        );


    let data = null;


    try {

        data =
            await response.json();

    } catch {

        data = null;

    }


    if (
        response.status === 401
    ) {

        localStorage.removeItem(
            "token"
        );

        localStorage.removeItem(
            "authToken"
        );

        window.location.href =
            "login.html";

        return null;

    }


    if (
        !response.ok
    ) {

        throw new Error(

            data?.message ||
            "Ошибка сервера"

        );

    }


    return data;

}


/* ==================================================
   INIT
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        bindEvents();

        await loadData();

    }
);


/* ==================================================
   EVENTS
================================================== */

function bindEvents() {


    addContractButton.addEventListener(
        "click",
        () => {

            openCreateModal();

        }
    );


    closeModalButton.addEventListener(
        "click",
        closeModal
    );


    cancelModalButton.addEventListener(
        "click",
        closeModal
    );


    contractModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                contractModal
            ) {

                closeModal();

            }

        }
    );


    contractForm.addEventListener(
        "submit",
        handleSubmit
    );


    searchInput.addEventListener(
        "input",
        renderContracts
    );


    statusFilter.addEventListener(
        "change",
        renderContracts
    );


    startDate.addEventListener(
        "change",
        validateDates
    );


    endDate.addEventListener(
        "change",
        validateDates
    );


    logoutButton.addEventListener(
        "click",
        () => {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "authToken"
            );

            localStorage.removeItem(
                "user"
            );

            window.location.href =
                "login.html";

        }
    );

}


/* ==================================================
   LOAD DATA
================================================== */

async function loadData() {

    try {

        contractsList.innerHTML = `

            <div class="contracts-loading">
                Загрузка договоров...
            </div>

        `;


        const [
            contractsData,
            tenantsData,
            propertiesData
        ] = await Promise.all([

            apiRequest(
                "/api/contracts"
            ),

            apiRequest(
                "/api/tenants"
            ),

            apiRequest(
                "/api/properties"
            )

        ]);


        contracts =
            Array.isArray(
                contractsData
            )
                ? contractsData
                : [];


        tenants =
            Array.isArray(
                tenantsData
            )
                ? tenantsData
                : [];


        properties =
            Array.isArray(
                propertiesData
            )
                ? propertiesData
                : [];


        fillTenantSelect();

        fillPropertySelect();

        updateStatistics();

        renderContracts();

    } catch (error) {

        console.error(
            "Ошибка загрузки договоров:",
            error
        );


        contractsList.innerHTML = `

            <div class="contracts-empty">

                <div class="contracts-empty-icon">
                    !
                </div>

                <h3>
                    Не удалось загрузить данные
                </h3>

                <p>
                    ${escapeHtml(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

}


/* ==================================================
   TENANTS SELECT
================================================== */

function fillTenantSelect(
    selectedId = null
) {

    tenantId.innerHTML = `

        <option value="">
            Выберите арендатора
        </option>

    `;


    tenants.forEach(
        (tenant) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                tenant.id;


            option.textContent =
                tenant.fullName;


            if (
                selectedId !== null &&
                Number(selectedId) ===
                Number(tenant.id)
            ) {

                option.selected =
                    true;

            }


            tenantId.appendChild(
                option
            );

        }
    );

}


/* ==================================================
   PROPERTY SELECT
================================================== */

function fillPropertySelect(
    selectedId = null
) {

    propertyId.innerHTML = `

        <option value="">
            Выберите объект
        </option>

    `;


    properties.forEach(
        (property) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                property.id;


            option.textContent =
                `${property.name} — ${property.address}`;


            if (
                selectedId !== null &&
                Number(selectedId) ===
                Number(property.id)
            ) {

                option.selected =
                    true;

            }


            propertyId.appendChild(
                option
            );

        }
    );

}


/* ==================================================
   STATISTICS
================================================== */

function updateStatistics() {

    const total =
        contracts.length;


    const active =
        contracts.filter(
            (contract) =>
                contract.status ===
                "ACTIVE"
        ).length;


    const finished =
        contracts.filter(
            (contract) =>
                contract.status ===
                "EXPIRED" ||
                contract.status ===
                "TERMINATED"
        ).length;


    const expiring =
        contracts.filter(
            isExpiringSoon
        ).length;


    totalContracts.textContent =
        total;


    activeContracts.textContent =
        active;


    expiringContracts.textContent =
        expiring;


    finishedContracts.textContent =
        finished;

}


/* ==================================================
   EXPIRING
================================================== */

function isExpiringSoon(
    contract
) {

    if (
        contract.status !==
        "ACTIVE"
    ) {

        return false;

    }


    if (
        !contract.endDate
    ) {

        return false;

    }


    const endDateValue =
        new Date(
            contract.endDate
        );


    const now =
        new Date();


    const difference =
        endDateValue.getTime() -
        now.getTime();


    const days =
        difference /
        (
            1000 *
            60 *
            60 *
            24
        );


    return (
        days >= 0 &&
        days <= 30
    );

}


/* ==================================================
   RENDER CONTRACTS
================================================== */

function renderContracts() {

    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    const selectedStatus =
        statusFilter.value;


    const filtered =
        contracts.filter(
            (contract) => {

                const tenantName =
                    contract.tenant?.fullName ||
                    "";


                const propertyName =
                    contract.property?.name ||
                    "";


                const propertyAddress =
                    contract.property?.address ||
                    "";


                const number =
                    contract.number ||
                    "";


                const matchesSearch =
                    !search ||
                    number
                        .toLowerCase()
                        .includes(search) ||
                    tenantName
                        .toLowerCase()
                        .includes(search) ||
                    propertyName
                        .toLowerCase()
                        .includes(search) ||
                    propertyAddress
                        .toLowerCase()
                        .includes(search);


                const matchesStatus =
                    !selectedStatus ||
                    contract.status ===
                    selectedStatus;


                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );


    if (
        filtered.length === 0
    ) {

        contractsList.innerHTML = `

            <div class="contracts-empty">

                <div class="contracts-empty-icon">
                    ▤
                </div>

                <h3>
                    ${
                        contracts.length === 0
                            ? "Договоров пока нет"
                            : "Ничего не найдено"
                    }
                </h3>

                <p>
                    ${
                        contracts.length === 0
                            ? "Создайте первый договор аренды"
                            : "Измените параметры поиска или фильтра"
                    }
                </p>

            </div>

        `;

        return;

    }


    contractsList.innerHTML =
        filtered
            .map(
                renderContractCard
            )
            .join("");

}


/* ==================================================
   CONTRACT CARD
================================================== */

function renderContractCard(
    contract
) {

    const tenantName =
        contract.tenant?.fullName ||
        "Арендатор не указан";


    const propertyName =
        contract.property?.name ||
        "Объект не указан";


    const propertyAddress =
        contract.property?.address ||
        "";


    const statusText =
        getStatusText(
            contract.status
        );


    const statusClass =
        getStatusClass(
            contract.status
        );


    const start =
        formatDate(
            contract.startDate
        );


    const end =
        formatDate(
            contract.endDate
        );


    const rentValue =
        formatMoney(
            contract.rent
        );


    const expiring =
        isExpiringSoon(
            contract
        );


    return `

        <article
            class="contract-card"
        >

            <div class="contract-card-icon">
                ▤
            </div>


            <div class="contract-card-main">

                <div class="contract-card-title">

                    <strong>
                        ${escapeHtml(
                            contract.number
                        )}
                    </strong>

                    <span
                        class="contract-status ${statusClass}"
                    >
                        ${statusText}
                    </span>

                </div>


                <div class="contract-card-subtitle">

                    <span>
                        ♙
                        ${escapeHtml(
                            tenantName
                        )}
                    </span>

                    <span>
                        ▣
                        ${escapeHtml(
                            propertyName
                        )}
                    </span>

                    ${
                        propertyAddress
                            ? `
                                <span>
                                    ⌖
                                    ${escapeHtml(
                                        propertyAddress
                                    )}
                                </span>
                            `
                            : ""
                    }

                </div>

            </div>


            <div class="contract-card-finance">

                <strong>
                    ${rentValue}
                </strong>

                <span>
                    аренда в месяц
                </span>

            </div>


            <div class="contract-card-dates">

                <strong>
                    ${start}
                    —
                    ${end}
                </strong>

                <span>
                    ${
                        expiring
                            ? "Истекает в ближайшие 30 дней"
                            : "Срок договора"
                    }
                </span>

            </div>


            <div class="contract-card-actions">

                <button
                    type="button"
                    class="contract-action"
                    title="Редактировать"
                    data-action="edit"
                    data-id="${contract.id}"
                >
                    ✎
                </button>


                <button
                    type="button"
                    class="contract-action delete"
                    title="Удалить"
                    data-action="delete"
                    data-id="${contract.id}"
                >
                    ×
                </button>

            </div>

        </article>

    `;

}


/* ==================================================
   CARD ACTIONS
================================================== */

contractsList.addEventListener(
    "click",
    async (event) => {

        const button =
            event.target.closest(
                "[data-action]"
            );


        if (!button) {

            return;

        }


        const id =
            Number(
                button.dataset.id
            );


        const action =
            button.dataset.action;


        if (
            action === "edit"
        ) {

            await openEditModal(
                id
            );

        }


        if (
            action === "delete"
        ) {

            await deleteContract(
                id
            );

        }

    }
);


/* ==================================================
   CREATE MODAL
================================================== */

function openCreateModal() {

    editingContractId =
        null;


    modalTitle.textContent =
        "Новый договор";


    contractId.value =
        "";


    contractForm.reset();


    fillTenantSelect();

    fillPropertySelect();


    contractStatus.value =
        "DRAFT";


    hideFormError();


    contractModal.hidden =
        false;


    document.body.style.overflow =
        "hidden";


    contractNumber.focus();

}


/* ==================================================
   EDIT MODAL
================================================== */

async function openEditModal(
    id
) {

    try {

        const contract =
            await apiRequest(
                `/api/contracts/${id}`
            );


        if (!contract) {

            return;

        }


        editingContractId =
            id;


        modalTitle.textContent =
            "Редактировать договор";


        contractId.value =
            contract.id;


        contractNumber.value =
            contract.number ||
            "";


        fillTenantSelect(
            contract.tenantId
        );


        fillPropertySelect(
            contract.propertyId
        );


        startDate.value =
            toInputDate(
                contract.startDate
            );


        endDate.value =
            toInputDate(
                contract.endDate
            );


        rent.value =
            contract.rent ??
            "";


        deposit.value =
            contract.deposit ??
            "";


        paymentDay.value =
            contract.paymentDay ??
            "";


        contractStatus.value =
            contract.status ||
            "DRAFT";


        contractNotes.value =
            contract.notes ||
            "";


        hideFormError();


        contractModal.hidden =
            false;


        document.body.style.overflow =
            "hidden";


        contractNumber.focus();

    } catch (error) {

        alert(
            error.message
        );

    }

}


/* ==================================================
   CLOSE MODAL
================================================== */

function closeModal() {

    contractModal.hidden =
        true;


    document.body.style.overflow =
        "";


    editingContractId =
        null;

}


/* ==================================================
   SUBMIT
================================================== */

async function handleSubmit(
    event
) {

    event.preventDefault();


    hideFormError();


    if (
        !startDate.value ||
        !endDate.value
    ) {

        showFormError(
            "Укажите даты начала и окончания договора."
        );

        return;

    }


    if (
        endDate.value <
        startDate.value
    ) {

        showFormError(
            "Дата окончания не может быть раньше даты начала."
        );

        return;

    }


    if (
        !tenantId.value
    ) {

        showFormError(
            "Выберите арендатора."
        );

        return;

    }


    if (
        !propertyId.value
    ) {

        showFormError(
            "Выберите объект недвижимости."
        );

        return;

    }


    const payload = {

        number:
            contractNumber.value.trim(),

        startDate:
            startDate.value,

        endDate:
            endDate.value,

        rent:
            rent.value,

        deposit:
            deposit.value ||
            null,

        paymentDay:
            paymentDay.value ||
            null,

        status:
            contractStatus.value,

        notes:
            contractNotes.value.trim(),

        propertyId:
            Number(
                propertyId.value
            ),

        tenantId:
            Number(
                tenantId.value
            )

    };


    try {

        const button =
            document.getElementById(
                "saveContractButton"
            );


        button.disabled =
            true;


        button.textContent =
            "Сохранение...";


        if (
            editingContractId
        ) {

            await apiRequest(

                `/api/contracts/${editingContractId}`,

                {

                    method:
                        "PUT",

                    body:
                        JSON.stringify(
                            payload
                        )

                }

            );

        } else {

            await apiRequest(

                "/api/contracts",

                {

                    method:
                        "POST",

                    body:
                        JSON.stringify(
                            payload
                        )

                }

            );

        }


        closeModal();


        await loadData();

    } catch (error) {

        showFormError(
            error.message
        );

    } finally {

        const button =
            document.getElementById(
                "saveContractButton"
            );


        button.disabled =
            false;


        button.textContent =
            "Сохранить договор";

    }

}


/* ==================================================
   DELETE
================================================== */

async function deleteContract(
    id
) {

    const contract =
        contracts.find(
            (item) =>
                Number(item.id) ===
                Number(id)
        );


    if (!contract) {

        return;

    }


    const confirmed =
        confirm(

            `Удалить договор "${contract.number}"?`

        );


    if (!confirmed) {

        return;

    }


    try {

        await apiRequest(

            `/api/contracts/${id}`,

            {

                method:
                    "DELETE"

            }

        );


        await loadData();

    } catch (error) {

        alert(
            error.message
        );

    }

}


/* ==================================================
   DATE VALIDATION
================================================== */

function validateDates() {

    hideFormError();


    if (
        startDate.value &&
        endDate.value &&
        endDate.value <
        startDate.value
    ) {

        showFormError(
            "Дата окончания не может быть раньше даты начала."
        );

    }

}


/* ==================================================
   STATUS
================================================== */

function getStatusText(
    status
) {

    const statuses = {

        DRAFT:
            "Черновик",

        ACTIVE:
            "Активный",

        EXPIRED:
            "Истёк",

        TERMINATED:
            "Расторгнут"

    };


    return (
        statuses[status] ||
        status ||
        "Неизвестно"
    );

}


function getStatusClass(
    status
) {

    const classes = {

        DRAFT:
            "draft",

        ACTIVE:
            "active",

        EXPIRED:
            "expired",

        TERMINATED:
            "terminated"

    };


    return (
        classes[status] ||
        "draft"
    );

}


/* ==================================================
   DATE FORMAT
================================================== */

function formatDate(
    value
) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        "ru-RU"
    ).format(
        date
    );

}


function toInputDate(
    value
) {

    if (!value) {

        return "";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";

    }


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


/* ==================================================
   MONEY
================================================== */

function formatMoney(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "0 ₽";

    }


    return (
        new Intl.NumberFormat(
            "ru-RU",
            {
                maximumFractionDigits:
                    2
            }
        ).format(
            number
        ) +
        " ₽"
    );

}


/* ==================================================
   FORM ERROR
================================================== */

function showFormError(
    message
) {

    formError.textContent =
        message;

    formError.hidden =
        false;

}


function hideFormError() {

    formError.textContent =
        "";

    formError.hidden =
        true;

}


/* ==================================================
   HTML ESCAPE
================================================== */

function escapeHtml(
    value
) {

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