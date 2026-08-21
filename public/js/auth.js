/* Auth helpers: password visibility toggle + Bootstrap validation styling.
   Loaded on every page via boilerplate; both features are no-ops elsewhere. */
(function () {
    "use strict";

    // Password show/hide
    document.addEventListener("click", function (e) {
        const btn = e.target.closest("[data-toggle-password]");
        if (!btn) return;
        const input = document.querySelector(btn.getAttribute("data-toggle-password"));
        if (!input) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        const icon = btn.querySelector("i");
        if (icon) icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
        input.focus();
    });

    // Bootstrap "was-validated" feedback on submit
    document.addEventListener("submit", function (e) {
        const form = e.target.closest("form.needs-validation");
        if (!form) return;
        if (!form.checkValidity()) {
            e.preventDefault();
            e.stopPropagation();
            const firstInvalid = form.querySelector(":invalid");
            if (firstInvalid) firstInvalid.focus();
        }
        form.classList.add("was-validated");
    });
})();
