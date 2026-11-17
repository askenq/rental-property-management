document.addEventListener("DOMContentLoaded", initMessages);

const MessagesApp = {
    conversations: [],
    currentConversationId: null,
    currentUser: null,
    users: [],
    search: "",
    loadingMessages: false,
    sending: false,
    refreshTimer: null,
    messageRequestVersion: 0,
    lastMessageId: null
};

const MESSAGES_API = "/api/messages";
const MESSAGE_REFRESH_INTERVAL = 5000;

async function initMessages() {
    if (!localStorage.getItem("token")) {
        window.location.href = "/pages/login.html";
        return;
    }

    bindMessagesEvents();

    try {
        const user = await getCurrentUser();
        MessagesApp.currentUser = user?.user ?? user;

        await loadConversations();
        startMessageRefresh();
    } catch (error) {
        showMessagesNotice(error.message || "Не удалось загрузить мессенджер", "error");
    }
}

function bindMessagesEvents() {
    const $ = (id) => document.getElementById(id);

    $("newConversationButton")?.addEventListener("click", openConversationModal);
    $("emptyNewConversationButton")?.addEventListener("click", openConversationModal);
    $("refreshConversationsButton")?.addEventListener("click", loadConversations);

    $("chatRefreshButton")?.addEventListener("click", () => {
        if (MessagesApp.currentConversationId) {
            loadConversationMessages(MessagesApp.currentConversationId);
        }
    });

    $("conversationSearch")?.addEventListener("input", (event) => {
        MessagesApp.search = event.target.value.trim().toLowerCase();
        renderConversations();
    });

    $("messageForm")?.addEventListener("submit", sendMessage);

    $("messageInput")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            $("messageForm")?.requestSubmit();
        }
    });

    $("closeConversationModalButton")?.addEventListener("click", closeConversationModal);
    $("cancelConversationButton")?.addEventListener("click", closeConversationModal);
    $("conversationForm")?.addEventListener("submit", createConversation);

    $("conversationModal")?.addEventListener("click", (event) => {
        if (event.target.id === "conversationModal") {
            closeConversationModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeConversationModal();
        }
    });
}

async function messagesRequest(path, options = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/pages/login.html";
        throw new Error("Необходимо войти в аккаунт");
    }

    const response = await fetch(`${MESSAGES_API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body !== undefined
                ? { "Content-Type": "application/json" }
                : {}),
            ...(options.headers || {})
        },
        ...(options.body !== undefined
            ? { body: options.body }
            : {})
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/pages/login.html";
        throw new Error("Сессия завершена. Войдите снова.");
    }

    if (!response.ok) {
        throw new Error(data.message || `Ошибка API: ${response.status}`);
    }

    return data;
}

function getCurrentUserId() {
    const user = MessagesApp.currentUser;

    const id = user?.id ?? user?.userId;

    return Number.isFinite(Number(id)) ? Number(id) : null;
}

function getConversationParticipants(conversation) {
    return Array.isArray(conversation?.participants)
        ? conversation.participants
        : [];
}

function getOtherParticipants(conversation) {
    const currentUserId = getCurrentUserId();

    return getConversationParticipants(conversation).filter(
        (participant) => Number(participant.id) !== currentUserId
    );
}

function getConversationName(conversation) {
    if (conversation?.title?.trim()) {
        return conversation.title.trim();
    }

    const others = getOtherParticipants(conversation);

    if (others.length === 0) {
        return "Личный диалог";
    }

    if (others.length === 1) {
        return others[0].name || others[0].email || "Пользователь";
    }

    return others
        .map((participant) => participant.name || participant.email)
        .filter(Boolean)
        .join(", ");
}

function getInitials(name) {
    const parts = String(name || "RM")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return "RM";

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getRoleLabel(role) {
    const roles = {
        OWNER: "Владелец",
        MANAGER: "Управляющий",
        TENANT: "Арендатор"
    };

    return roles[role] || "Участник";
}

async function loadConversations() {
    const list = document.getElementById("conversationList");

    if (list && MessagesApp.conversations.length === 0) {
        list.innerHTML = `
            <div class="messenger-placeholder">
                <div class="placeholder-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <strong>Загружаем переписки</strong>
                <span>Пожалуйста, подождите</span>
            </div>
        `;
    }

    try {
        const data = await messagesRequest("");

        MessagesApp.conversations = Array.isArray(data.conversations)
            ? data.conversations
            : [];

        renderConversations();

        const selectedStillExists = MessagesApp.conversations.some(
            (conversation) =>
                Number(conversation.id) === Number(MessagesApp.currentConversationId)
        );

        if (!selectedStillExists && MessagesApp.currentConversationId !== null) {
            MessagesApp.currentConversationId = null;
            showEmptyChat();
        }

        if (
            MessagesApp.currentConversationId === null &&
            MessagesApp.conversations.length > 0
        ) {
        }

    } catch (error) {
        if (list && MessagesApp.conversations.length === 0) {
            list.innerHTML = `
                <div class="conversation-empty">
                    ${escapeMessageHtml(error.message)}
                </div>
            `;
        }

        showMessagesNotice(error.message || "Не удалось загрузить диалоги", "error");
    }
}

function renderConversations() {
    const list = document.getElementById("conversationList");
    const count = document.getElementById("conversationCount");

    if (!list) return;

    const filtered = MessagesApp.conversations.filter((conversation) => {
        const name = getConversationName(conversation).toLowerCase();
        const preview = String(conversation.lastMessage?.content || "").toLowerCase();

        return !MessagesApp.search ||
            name.includes(MessagesApp.search) ||
            preview.includes(MessagesApp.search);
    });

    if (count) {
        count.textContent = `${MessagesApp.conversations.length} диалогов`;
    }

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="conversation-empty">
                ${
                    MessagesApp.search
                        ? "Ничего не найдено. Попробуйте изменить запрос."
                        : "Пока нет переписок. Создайте новый диалог."
                }
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map((conversation) => {
        const id = Number(conversation.id);
        const name = getConversationName(conversation);
        const lastMessage = conversation.lastMessage;
        const preview = lastMessage
            ? `${Number(lastMessage.sender?.id) === getCurrentUserId() ? "Вы: " : ""}${lastMessage.content || ""}`
            : "Начните общение";

        const active =
            id === Number(MessagesApp.currentConversationId);

        return `
            <button
                class="conversation-item ${active ? "active" : ""}"
                type="button"
                data-conversation-id="${id}"
                aria-current="${active ? "true" : "false"}"
            >
                <span class="avatar conversation-avatar">
                    ${escapeMessageHtml(getInitials(name))}
                </span>

                <span class="conversation-item-body">
                    <span class="conversation-item-top">
                        <span class="conversation-item-name">
                            ${escapeMessageHtml(name)}
                        </span>

                        <span class="conversation-item-time">
                            ${lastMessage ? formatMessageTime(lastMessage.createdAt) : ""}
                        </span>
                    </span>

                    <span class="conversation-item-preview">
                        ${escapeMessageHtml(preview)}
                    </span>
                </span>
            </button>
        `;
    }).join("");

    list.querySelectorAll("[data-conversation-id]").forEach((button) => {
        button.addEventListener("click", () => {
            openConversation(Number(button.dataset.conversationId));
        });
    });
}

async function openConversation(conversationId) {
    const conversation = MessagesApp.conversations.find(
        (item) => Number(item.id) === Number(conversationId)
    );

    if (!conversation) {
        showMessagesNotice("Диалог не найден в списке.", "error");
        return;
    }

    MessagesApp.currentConversationId = Number(conversationId);
    MessagesApp.lastMessageId = null;

    renderConversations();
    showChatContent();

    const title = document.getElementById("chatTitle");
    const subtitle = document.getElementById("chatSubtitle");
    const avatar = document.getElementById("chatAvatar");

    const name = getConversationName(conversation);
    const others = getOtherParticipants(conversation);

    if (title) title.textContent = name;

    if (subtitle) {
        subtitle.textContent = `${getConversationParticipants(conversation).length} участника`;
    }

    if (avatar) avatar.textContent = getInitials(name);

    renderChatDetails(conversation);

    await loadConversationMessages(conversationId);
    await markConversationRead(conversationId);
}

function showChatContent() {
    const empty = document.getElementById("chatEmptyState");
    const content = document.getElementById("chatContent");

    if (empty) empty.hidden = true;
    if (content) content.hidden = false;
}

function showEmptyChat() {
    const empty = document.getElementById("chatEmptyState");
    const content = document.getElementById("chatContent");

    if (empty) empty.hidden = false;
    if (content) content.hidden = true;

    const details = document.getElementById("chatDetails");

    if (details) {
        details.innerHTML = `
            <div class="details-empty">
                <div class="details-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <strong>Сведения о диалоге</strong>
                <p>Выберите переписку, чтобы увидеть участников.</p>
            </div>
        `;
    }
}

async function loadConversationMessages(conversationId) {
    if (MessagesApp.loadingMessages) return;

    MessagesApp.loadingMessages = true;

    const requestVersion = ++MessagesApp.messageRequestVersion;

    try {
        const data = await messagesRequest(
            `/conversations/${Number(conversationId)}`
        );

        if (
            requestVersion !== MessagesApp.messageRequestVersion ||
            Number(MessagesApp.currentConversationId) !== Number(conversationId)
        ) {
            return;
        }

        const messages = Array.isArray(data.messages) ? data.messages : [];

        renderMessages(messages);
    } catch (error) {
        showMessagesNotice(error.message || "Не удалось загрузить сообщения", "error");
    } finally {
        MessagesApp.loadingMessages = false;
    }
}

function renderMessages(messages) {
    const container = document.getElementById("chatMessages");

    if (!container) return;

    const previousScrollTop = container.scrollTop;
    const wasNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="chat-no-messages">
                Здесь пока нет сообщений.<br>
                Напишите первое сообщение, чтобы начать общение.
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map((message, index) => {
        const own = Number(message.senderId) === getCurrentUserId() ||
            Number(message.sender?.id) === getCurrentUserId();

        const previousMessage = messages[index - 1];

        const currentDate = new Date(message.createdAt);
        const previousDate = previousMessage
            ? new Date(previousMessage.createdAt)
            : null;

        const newDay = !previousDate ||
            currentDate.toDateString() !== previousDate.toDateString();

        const dateDivider = newDay
            ? `
                <div class="chat-date-divider">
                    <span>${escapeMessageHtml(formatMessageDate(message.createdAt))}</span>
                </div>
            `
            : "";

        return `
            ${dateDivider}

            <article class="message-row ${own ? "own" : ""}">
                ${
                    own
                        ? ""
                        : `<div class="message-author">${escapeMessageHtml(message.sender?.name || "Участник")}</div>`
                }

                <div class="message-bubble">${escapeMessageHtml(message.content || "")}</div>

                <time
                    class="message-time"
                    datetime="${escapeMessageHtml(message.createdAt || "")}"
                >${formatMessageTime(message.createdAt)}</time>
            </article>
        `;
    }).join("");

    const lastMessage = messages[messages.length - 1];

    MessagesApp.lastMessageId = lastMessage?.id ?? null;

    if (wasNearBottom || messages.length <= 1) {
        container.scrollTop = container.scrollHeight;
    } else {
        container.scrollTop = previousScrollTop;
    }
}

async function sendMessage(event) {
    event.preventDefault();

    if (MessagesApp.sending) return;

    const input = document.getElementById("messageInput");
    const button = document.getElementById("sendMessageButton");

    const content = input?.value.trim();
    const conversationId = MessagesApp.currentConversationId;

    if (!conversationId) {
        showMessagesNotice("Сначала выберите диалог.", "error");
        return;
    }

    if (!content) {
        input?.focus();
        return;
    }

    if (content.length > 10000) {
        showMessagesNotice("Сообщение не должно превышать 10 000 символов.", "error");
        return;
    }

    MessagesApp.sending = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Отправка...";
    }

    try {
        await messagesRequest(`/conversations/${conversationId}`, {
            method: "POST",
            body: JSON.stringify({ content })
        });

        if (input) {
            input.value = "";
            input.style.height = "";
            input.focus();
        }

        await loadConversationMessages(conversationId);
        await loadConversations();

        showMessagesNotice("Сообщение отправлено.", "success");
    } catch (error) {
        showMessagesNotice(error.message || "Не удалось отправить сообщение", "error");
    } finally {
        MessagesApp.sending = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Отправить";
        }
    }
}

async function markConversationRead(conversationId) {
    try {
        await messagesRequest(
            `/conversations/${Number(conversationId)}/read`,
            { method: "PATCH" }
        );
    } catch (error) {
        console.warn("Не удалось отметить диалог прочитанным:", error.message);
    }
}

async function openConversationModal() {
    const modal = document.getElementById("conversationModal");
    const select = document.getElementById("participantSelect");

    if (!modal || !select) return;

    modal.hidden = false;
    document.body.style.overflow = "hidden";

    select.innerHTML = '<option value="">Загрузка пользователей...</option>';

    try {
        const data = await messagesRequest("/users");
        const currentUserId = getCurrentUserId();

        MessagesApp.users = (Array.isArray(data.users) ? data.users : [])
            .filter((user) => Number(user.id) !== currentUserId);

        if (MessagesApp.users.length === 0) {
            select.innerHTML = '<option value="">Нет других пользователей</option>';
            showMessagesNotice("Для переписки нужен другой зарегистрированный пользователь.", "error");
            return;
        }

        select.innerHTML = `
            <option value="">Выберите собеседника</option>
            ${MessagesApp.users.map((user) => `
                <option value="${Number(user.id)}">
                    ${escapeMessageHtml(user.name)} — ${escapeMessageHtml(getRoleLabel(user.role))}
                </option>
            `).join("")}
        `;

        select.focus();
    } catch (error) {
        select.innerHTML = '<option value="">Не удалось загрузить пользователей</option>';
        showMessagesNotice(error.message || "Не удалось загрузить пользователей", "error");
    }
}

function closeConversationModal() {
    const modal = document.getElementById("conversationModal");

    if (modal) modal.hidden = true;

    document.body.style.overflow = "";

    document.getElementById("conversationForm")?.reset();
}

async function createConversation(event) {
    event.preventDefault();

    const select = document.getElementById("participantSelect");
    const titleInput = document.getElementById("conversationTitleInput");
    const messageInput = document.getElementById("firstMessageInput");
    const button = document.getElementById("createConversationButton");

    const participantId = Number(select?.value);
    const title = titleInput?.value.trim() || null;
    const firstMessage = messageInput?.value.trim() || null;

    if (!Number.isInteger(participantId) || participantId <= 0) {
        showMessagesNotice("Выберите собеседника.", "error");
        return;
    }

    button.disabled = true;
    button.textContent = "Создание...";

    try {
        const data = await messagesRequest("/conversations", {
            method: "POST",
            body: JSON.stringify({
                participantIds: [participantId],
                title,
                firstMessage
            })
        });

        closeConversationModal();

        await loadConversations();

        const conversationId =
            data.conversation?.id ??
            data.id;

        if (conversationId) {
            await loadConversations();
            await openConversation(Number(conversationId));
        }

        showMessagesNotice("Диалог создан.", "success");
    } catch (error) {
        showMessagesNotice(error.message || "Не удалось создать диалог", "error");
    } finally {
        button.disabled = false;
        button.textContent = "Создать диалог";
    }
}

function renderChatDetails(conversation) {
    const details = document.getElementById("chatDetails");

    if (!details) return;

    const participants = getConversationParticipants(conversation);

    details.innerHTML = `
        <h3 class="chat-details-title">Участники</h3>

        ${
            participants.length === 0
                ? '<p class="conversation-empty">Участники не найдены.</p>'
                : participants.map((participant) => `
                    <div class="details-participant">
                        <div class="avatar">
                            ${escapeMessageHtml(getInitials(participant.name))}
                        </div>

                        <div class="details-participant-info">
                            <div class="details-participant-name">
                                ${escapeMessageHtml(participant.name || "Пользователь")}
                            </div>

                            <div class="details-participant-role">
                                ${escapeMessageHtml(getRoleLabel(participant.role))}
                            </div>
                        </div>
                    </div>
                `).join("")
        }
    `;
}

function startMessageRefresh() {
    if (MessagesApp.refreshTimer) {
        clearInterval(MessagesApp.refreshTimer);
    }

    MessagesApp.refreshTimer = setInterval(async () => {
        if (document.hidden) return;

        await loadConversations();

        if (MessagesApp.currentConversationId !== null) {
            await loadConversationMessages(MessagesApp.currentConversationId);
        }
    }, MESSAGE_REFRESH_INTERVAL);

    document.addEventListener("visibilitychange", async () => {
        if (
            !document.hidden &&
            MessagesApp.currentConversationId !== null
        ) {
            await loadConversations();
            await loadConversationMessages(MessagesApp.currentConversationId);
        }
    });
}

function showMessagesNotice(message, type = "info") {
    const notice = document.getElementById("messagesNotice");

    if (!notice) {
        console.log(`[Messages: ${type}]`, message);
        return;
    }

    notice.textContent = message;
    notice.className = `messages-notice ${type}`;
    notice.hidden = false;
}

function formatMessageTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit"
    });
}

function formatMessageDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return "Сегодня";
    }

    if (date.toDateString() === yesterday.toDateString()) {
        return "Вчера";
    }

    return date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function escapeMessageHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}
