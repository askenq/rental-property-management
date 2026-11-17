(function () {
    const STORAGE_KEY = "rm_theme";

    function getApiBase() {
        try {
            const override = localStorage.getItem("rm_api_url");
            if (override) return override.replace(/\/+$/, "");
        } catch (e) {}
        if (window.RM_CONFIG && window.RM_CONFIG.API_URL) {
            return String(window.RM_CONFIG.API_URL).replace(/\/+$/, "");
        }
        return "";
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        const apiBase = getApiBase();
        if (apiBase && typeof input === "string" && input.startsWith("/api/")) {
            return originalFetch(apiBase + input, init);
        }
        return originalFetch(input, init);
    };

    function getSavedTheme() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === "light" || saved === "dark") return saved;
        } catch (e) {}
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return "dark";
        }
        return "light";
    }

    function applyTheme(theme, animate = false) {
        const next = theme === "dark" ? "dark" : "light";
        if (animate) {
            document.documentElement.classList.add("theme-transitioning");
            window.setTimeout(() => {
                document.documentElement.classList.remove("theme-transitioning");
            }, 320);
        }
        document.documentElement.setAttribute("data-theme", next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch (e) {}

        document.querySelectorAll("[data-theme-option]").forEach((btn) => {
            const isActive = btn.getAttribute("data-theme-option") === next;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", String(isActive));
        });

        const toggleBtn = document.getElementById("themeToggle");
        if (toggleBtn) {
            toggleBtn.setAttribute(
                "aria-label",
                next === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
            );
            toggleBtn.setAttribute(
                "title",
                next === "dark" ? "Светлая тема" : "Тёмная тема"
            );
        }
    }

    applyTheme(getSavedTheme(), false);

    window.RMTheme = {
        get: getSavedTheme,
        set: (theme) => applyTheme(theme, true),
        toggle: function () {
            const current = document.documentElement.getAttribute("data-theme") || "light";
            applyTheme(current === "dark" ? "light" : "dark", true);
        }
    };

    function getUserInfo() {
        try {
            const raw = localStorage.getItem("user");
            if (!raw) return null;
            const user = JSON.parse(raw);
            const name = user.name || user.fullName || user.email || "Пользователь";
            const parts = String(name).trim().split(/\s+/).filter(Boolean);
            const initials = parts.length > 1
                ? (parts[0][0] + parts[1][0]).toUpperCase()
                : String(name).slice(0, 2).toUpperCase() || "RM";
            const roles = {
                OWNER: "Владелец",
                MANAGER: "Управляющий",
                TENANT: "Арендатор"
            };
            return {
                name,
                initials,
                role: roles[user.role] || "Пользователь"
            };
        } catch (e) {
            return null;
        }
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str ?? "";
        return div.innerHTML;
    }

    document.addEventListener("DOMContentLoaded", () => {
        applyTheme(getSavedTheme(), false);

        document.querySelectorAll("[data-theme-option]").forEach((btn) => {
            btn.addEventListener("click", () => {
                applyTheme(btn.getAttribute("data-theme-option"), true);
            });
        });

        const sidebarBottom = document.querySelector(".sidebar-bottom");
        if (sidebarBottom && !sidebarBottom.querySelector('a[href*="settings.html"]')) {
            const isSubPage = window.location.pathname.includes("/pages/");
            const settingsHref = isSubPage ? "settings.html" : "pages/settings.html";
            const isSettingsActive = window.location.pathname.endsWith("settings.html");

            const settingsLink = document.createElement("a");
            settingsLink.href = settingsHref;
            settingsLink.className = "nav-item" + (isSettingsActive ? " active" : "");
            settingsLink.innerHTML = `
                <span class="nav-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </span>
                <span>Настройки</span>
            `;
            sidebarBottom.insertBefore(settingsLink, sidebarBottom.firstChild);
        }

        const main = document.querySelector(".main-content");
        if (main && !main.querySelector(".topbar")) {
            const h1 = main.querySelector("h1");
            const pageTitle = h1
                ? h1.textContent.trim().replace(/\s+/g, " ")
                : document.title.replace(/\s*[—-]\s*Rental Manager\s*/i, "").trim();

            const user = getUserInfo();
            const userHtml = user
                ? `
                    <div class="topbar-user">
                        <span class="topbar-avatar">${escapeHtml(user.initials)}</span>
                        <span class="topbar-name">${escapeHtml(user.name)}</span>
                        <span class="topbar-role">${escapeHtml(user.role)}</span>
                    </div>
                `
                : "";

            const topbar = document.createElement("div");
            topbar.className = "topbar";
            topbar.innerHTML = `
                <div class="topbar-crumbs">
                    <span>Rental Manager</span>
                    <span class="sep">/</span>
                    <strong>${escapeHtml(pageTitle || "Панель управления")}</strong>
                </div>
                <div class="topbar-actions">
                    <button type="button" class="theme-toggle" id="themeToggle" aria-label="Переключить тему" title="Переключить тему">
                        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    </button>
                    ${userHtml}
                </div>
            `;
            main.insertBefore(topbar, main.firstChild);

            const toggleBtn = document.getElementById("themeToggle");
            if (toggleBtn) {
                toggleBtn.addEventListener("click", () => window.RMTheme.toggle());
            }
            applyTheme(getSavedTheme(), false);
        }

        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[href]");
            if (!link) return;
            const href = link.getAttribute("href");
            if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("javascript:") ||
                link.target === "_blank" ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey
            ) {
                return;
            }
            const mainContent = document.querySelector(".main-content");
            if (!mainContent) return;

            event.preventDefault();
            mainContent.classList.add("page-leaving");
            window.setTimeout(() => {
                window.location.href = link.href;
            }, 130);
        });
    });
})();
