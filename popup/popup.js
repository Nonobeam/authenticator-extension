import { generateHotp, generateTotp, groupOtp } from "../src/otp.js";
import {
  addAccount,
  deleteAccountById,
  getAccounts,
  getTheme,
  incrementHotpCounter,
  saveTheme,
  updateAccount
} from "../src/storage.js";
import { validateAccountInput } from "../src/validation.js";
import { parseOtpAuthUri } from "../src/otpauth.js";

const addAccountButton = document.querySelector("#add-account-btn");
const themeToggleButton = document.querySelector("#theme-toggle-btn");
const accountsContainer = document.querySelector("#accounts-container");
const messageElement = document.querySelector("#message");

const addMethodDialog = document.querySelector("#add-method-dialog");
const addNewButton = document.querySelector("#add-new-btn");
const addUriButton = document.querySelector("#add-uri-btn");
const addMethodCancelButton = document.querySelector("#add-method-cancel-btn");

const accountDialog = document.querySelector("#account-dialog");
const accountForm = document.querySelector("#account-form");
const dialogTitle = document.querySelector("#dialog-title");
const accountIdInput = document.querySelector("#account-id");
const accountLabelInput = document.querySelector("#account-label");
const accountSecretInput = document.querySelector("#account-secret");
const accountTypeInput = document.querySelector("#account-type");
const accountDigitsInput = document.querySelector("#account-digits");
const accountDigitsLabel = document.querySelector('label[for="account-digits"]');
const accountPeriodInput = document.querySelector("#account-period");
const accountCounterInput = document.querySelector("#account-counter");
const totpFieldGroup = document.querySelector("#totp-field-group");
const hotpFieldGroup = document.querySelector("#hotp-field-group");
const formError = document.querySelector("#form-error");
const cancelButton = document.querySelector("#cancel-btn");

const uriDialog = document.querySelector("#uri-dialog");
const uriForm = document.querySelector("#uri-form");
const uriInput = document.querySelector("#uri-input");
const uriFormError = document.querySelector("#uri-form-error");
const uriCancelButton = document.querySelector("#uri-cancel-btn");

let accounts = [];
const hotpDisplayCodes = new Map();
let messageTimeoutId = null;
let tickerId = null;
let isRendering = false;
let renderAgain = false;
let openMenuAccountId = null;
let currentTheme = "light";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getErrorMessage(error, fallback = "Unexpected error.") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function showMessage(text, isError = false) {
  messageElement.textContent = text;
  messageElement.classList.remove("hidden", "error");

  if (isError) {
    messageElement.classList.add("error");
  }

  if (messageTimeoutId) {
    clearTimeout(messageTimeoutId);
  }

  messageTimeoutId = setTimeout(() => {
    messageElement.classList.add("hidden");
    messageElement.classList.remove("error");
    messageElement.textContent = "";
  }, 3000);
}

function setFormError(text) {
  formError.textContent = text;
  formError.classList.remove("hidden");
}

function clearFormError() {
  formError.textContent = "";
  formError.classList.add("hidden");
}

function setUriFormError(text) {
  uriFormError.textContent = text;
  uriFormError.classList.remove("hidden");
}

function clearUriFormError() {
  uriFormError.textContent = "";
  uriFormError.classList.add("hidden");
}

function applyTheme(theme) {
  currentTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", currentTheme);

  if (themeToggleButton) {
    const isDark = currentTheme === "dark";
    themeToggleButton.setAttribute("aria-checked", isDark ? "true" : "false");
    themeToggleButton.setAttribute("aria-label", "Toggle dark mode");
    themeToggleButton.setAttribute("title", isDark ? "Dark mode" : "Light mode");
  }
}

async function initTheme() {
  const storedTheme = await getTheme();
  applyTheme(storedTheme);
}

async function handleToggleTheme() {
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  await saveTheme(nextTheme);
}

function toggleTypeFields() {
  const isTotp = accountTypeInput.value === "totp";
  totpFieldGroup.classList.toggle("hidden", !isTotp);
  hotpFieldGroup.classList.toggle("hidden", isTotp);

  if (isTotp) {
    accountDigitsInput.value = "6";
    accountDigitsInput.disabled = true;
    accountPeriodInput.value = "30";

    if (accountDigitsLabel) {
      accountDigitsLabel.textContent = "Digits (fixed to 6 for TOTP)";
    }
  } else {
    accountDigitsInput.disabled = false;

    if (accountDigitsLabel) {
      accountDigitsLabel.textContent = "Digits";
    }

    if (accountDigitsInput.value !== "6" && accountDigitsInput.value !== "8") {
      accountDigitsInput.value = "6";
    }
  }
}

function resetFormDefaults() {
  accountIdInput.value = "";
  accountForm.reset();
  accountTypeInput.value = "totp";
  accountDigitsInput.value = "6";
  accountPeriodInput.value = "30";
  accountCounterInput.value = "0";
  clearFormError();
  toggleTypeFields();
}

function resetUriFormDefaults() {
  uriForm.reset();
  clearUriFormError();
}

function openAddMethodDialog() {
  hideAllMenus();

  if (!addMethodDialog) {
    openAddDialog();
    return;
  }

  addMethodDialog.showModal();
}

function openAddDialog() {
  hideAllMenus();
  dialogTitle.textContent = "Add key";
  resetFormDefaults();
  accountDialog.showModal();
  accountLabelInput.focus();
}

function openUriDialog() {
  hideAllMenus();

  if (!uriDialog) {
    return;
  }

  resetUriFormDefaults();
  uriDialog.showModal();
  uriInput.focus();
}

function openEditDialog(accountId) {
  const account = accounts.find((item) => item.id === accountId);

  if (!account) {
    showMessage("Account not found.", true);
    return;
  }

  hideAllMenus();
  dialogTitle.textContent = "Edit key";
  clearFormError();
  accountIdInput.value = account.id;
  accountLabelInput.value = account.label;
  accountSecretInput.value = account.secretBase32;
  accountTypeInput.value = account.type;
  accountDigitsInput.value = String(account.digits);
  accountPeriodInput.value = "30";
  accountCounterInput.value = String(account.counter);
  toggleTypeFields();
  accountDialog.showModal();
  accountLabelInput.focus();
}

async function copyCode(rawCode) {
  if (!rawCode) {
    showMessage("No code available to copy.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(rawCode);
    showMessage("Code copied.");
  } catch {
    showMessage("Unable to copy code. Please copy it manually.", true);
  }
}

function normalizeAccount(account) {
  const type = account?.type === "hotp" ? "hotp" : "totp";
  const digitsInput = Number(account?.digits);
  const digits = type === "totp" ? 6 : digitsInput === 8 ? 8 : 6;
  const counterInput = Number(account?.counter);
  const counter = Number.isInteger(counterInput) && counterInput >= 0 ? counterInput : 0;

  return {
    id: String(account.id),
    label: String(account.label || ""),
    secretBase32: String(account.secretBase32 || ""),
    type,
    digits,
    period: 30,
    counter,
    algorithm: "SHA-1",
    createdAt: Number(account.createdAt || Date.now()),
    updatedAt: Number(account.updatedAt || Date.now())
  };
}

async function reloadAccounts() {
  const stored = await getAccounts();
  accounts = stored.map(normalizeAccount);
  accounts.sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
  );

  if (openMenuAccountId && !accounts.some((account) => account.id === openMenuAccountId)) {
    openMenuAccountId = null;
  }
}

function renderMenu(accountId) {
  const escapedId = escapeHtml(accountId);
  const isOpen = openMenuAccountId === accountId;

  return `
    <div class="menu-wrap menu-top">
      <button class="btn menu-btn" type="button" data-action="toggle-menu" data-id="${escapedId}" aria-expanded="${
    isOpen ? "true" : "false"
  }" aria-haspopup="true">⋯</button>
      <div class="menu${isOpen ? "" : " hidden"}" data-menu="${escapedId}">
        <button class="menu-item" type="button" data-action="edit" data-id="${escapedId}">Edit</button>
        <button class="menu-item menu-item-danger" type="button" data-action="delete" data-id="${escapedId}">Delete</button>
      </div>
    </div>
  `;
}

function renderHeader(label, typeLabel, accountId) {
  return `
    <div class="account-header">
      <h3 class="account-label">${label}</h3>
      <div class="header-right">
        <span class="account-type">${typeLabel}</span>
        ${renderMenu(accountId)}
      </div>
    </div>
  `;
}

async function renderAccounts() {
  if (isRendering) {
    renderAgain = true;
    return;
  }

  isRendering = true;

  try {
    if (accounts.length === 0) {
      accountsContainer.innerHTML = '<div class="empty-state">No keys saved. Select "Add Key" to begin.</div>';
      return;
    }

    const cardHtml = await Promise.all(
      accounts.map(async (account) => {
        const escapedLabel = escapeHtml(account.label || "Unnamed key");
        const typeLabel = account.type === "totp" ? "TOTP" : "HOTP";

        if (account.type === "totp") {
          try {
            const result = await generateTotp(account);
            const code = result.code;
            const groupedCode = groupOtp(code);
            const progress = Math.min(100, Math.max(0, Math.round((result.remaining / result.period) * 100)));

            return `
              <article class="account-card">
                ${renderHeader(escapedLabel, typeLabel, account.id)}
                <p class="code code-clickable" role="button" tabindex="0" data-action="copy" data-id="${escapeHtml(
                  account.id
                )}" data-code="${code}">${escapeHtml(groupedCode)}</p>
                <div class="meta-row">
                  <p class="meta">Refresh in ${result.remaining}s • 6 digits</p>
                  <div class="pie" style="--progress: ${progress}%;" aria-hidden="true"></div>
                </div>
              </article>
            `;
          } catch (error) {
            return `
              <article class="account-card">
                ${renderHeader(escapedLabel, typeLabel, account.id)}
                <p class="meta">${escapeHtml(getErrorMessage(error, "Unable to generate TOTP code."))}</p>
              </article>
            `;
          }
        }

        const hotpRawCode = hotpDisplayCodes.get(account.id) || "";
        const hotpGroupedCode = hotpRawCode ? groupOtp(hotpRawCode) : "------";

        return `
          <article class="account-card">
            ${renderHeader(escapedLabel, typeLabel, account.id)}
            <p class="code code-clickable" role="button" tabindex="0" data-action="copy" data-id="${escapeHtml(
              account.id
            )}" data-code="${escapeHtml(hotpRawCode)}">${escapeHtml(hotpGroupedCode)}</p>
            <p class="meta">Counter: ${account.counter} • ${account.digits} digits</p>
            <div class="actions">
              <button class="btn btn-primary" type="button" data-action="generate-hotp" data-id="${escapeHtml(
                account.id
              )}">Generate</button>
            </div>
          </article>
        `;
      })
    );

    accountsContainer.innerHTML = cardHtml.join("");
  } finally {
    isRendering = false;

    if (renderAgain) {
      renderAgain = false;
      renderAccounts();
    }
  }
}

function buildRawInputFromForm() {
  return {
    label: accountLabelInput.value,
    secretBase32: accountSecretInput.value,
    type: accountTypeInput.value,
    digits: accountDigitsInput.value,
    period: accountPeriodInput.value,
    counter: accountCounterInput.value
  };
}

function buildRawInputFromUri(parsed) {
  return {
    label: parsed.label,
    secretBase32: parsed.secretBase32,
    type: parsed.type,
    digits: String(parsed.digits),
    period: String(parsed.period),
    counter: String(parsed.counter)
  };
}

async function handleSaveAccount(event) {
  event.preventDefault();
  clearFormError();

  const accountId = accountIdInput.value.trim();

  try {
    const rawInput = buildRawInputFromForm();
    const validated = validateAccountInput(rawInput);
    const now = Date.now();

    if (accountId) {
      const existing = accounts.find((item) => item.id === accountId);

      if (!existing) {
        throw new Error("Account not found.");
      }

      const updated = {
        ...existing,
        ...validated,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now
      };

      await updateAccount(updated);
      hotpDisplayCodes.delete(updated.id);
      showMessage("Key updated.");
    } else {
      const created = {
        id: crypto.randomUUID(),
        ...validated,
        createdAt: now,
        updatedAt: now
      };

      await addAccount(created);
      showMessage("Key added.");
    }

    accountDialog.close();
    await reloadAccounts();
    await renderAccounts();
  } catch (error) {
    setFormError(getErrorMessage(error, "Unable to save key."));
  }
}

async function handleSaveUriAccount(event) {
  event.preventDefault();
  clearUriFormError();

  try {
    const parsedUri = parseOtpAuthUri(uriInput.value);
    const rawInput = buildRawInputFromUri(parsedUri);
    const validated = validateAccountInput(rawInput);
    const now = Date.now();

    const created = {
      id: crypto.randomUUID(),
      ...validated,
      createdAt: now,
      updatedAt: now
    };

    await addAccount(created);
    uriDialog.close();
    showMessage("Key added.");
    await reloadAccounts();
    await renderAccounts();
  } catch (error) {
    setUriFormError(getErrorMessage(error, "Unable to save key."));
  }
}

async function handleDeleteAccount(accountId) {
  const account = accounts.find((item) => item.id === accountId);

  if (!account) {
    showMessage("Account not found.", true);
    return;
  }

  const confirmed = window.confirm(`Delete key "${account.label}"?`);

  if (!confirmed) {
    return;
  }

  await deleteAccountById(accountId);
  hotpDisplayCodes.delete(accountId);
  await reloadAccounts();
  await renderAccounts();
  showMessage("Key deleted.");
}

async function handleGenerateHotp(accountId) {
  const account = accounts.find((item) => item.id === accountId);

  if (!account || account.type !== "hotp") {
    showMessage("HOTP account not found.", true);
    return;
  }

  try {
    const code = await generateHotp(account);
    hotpDisplayCodes.set(accountId, code);
    await incrementHotpCounter(accountId);
    await reloadAccounts();
    await renderAccounts();
    showMessage("HOTP generated. Counter incremented.");
  } catch (error) {
    showMessage(getErrorMessage(error, "Unable to generate HOTP code."), true);
  }
}

function hideAllMenus() {
  openMenuAccountId = null;

  const menus = accountsContainer.querySelectorAll("[data-menu]");
  menus.forEach((menu) => menu.classList.add("hidden"));

  const toggles = accountsContainer.querySelectorAll("[data-action='toggle-menu']");
  toggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
}

function toggleMenu(button, accountId) {
  const menuWrap = button.closest(".menu-wrap");
  const menu = menuWrap?.querySelector("[data-menu]");

  if (!menu) {
    return;
  }

  const willOpen = openMenuAccountId !== accountId;
  hideAllMenus();

  if (willOpen) {
    openMenuAccountId = accountId;
    menu.classList.remove("hidden");
    button.setAttribute("aria-expanded", "true");
  }
}

async function handleAccountsAction(event) {
  const actionElement = event.target.closest("[data-action]");

  if (!actionElement || !accountsContainer.contains(actionElement)) {
    hideAllMenus();
    return;
  }

  const action = actionElement.dataset.action;
  const accountId = actionElement.dataset.id || "";

  if (action !== "toggle-menu") {
    hideAllMenus();
  }

  if (action === "toggle-menu") {
    event.stopPropagation();
    toggleMenu(actionElement, accountId);
    return;
  }

  if (action === "edit") {
    openEditDialog(accountId);
    return;
  }

  if (action === "delete") {
    await handleDeleteAccount(accountId);
    return;
  }

  if (action === "generate-hotp") {
    await handleGenerateHotp(accountId);
    return;
  }

  if (action === "copy") {
    await copyCode(actionElement.dataset.code || "");
  }
}

async function handleAccountsKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const actionElement = event.target.closest("[data-action='copy']");

  if (!actionElement || !accountsContainer.contains(actionElement)) {
    return;
  }

  event.preventDefault();
  await copyCode(actionElement.dataset.code || "");
}

function startTicker() {
  if (tickerId) {
    clearInterval(tickerId);
  }

  tickerId = setInterval(() => {
    renderAccounts();
  }, 1000);
}

function stopTicker() {
  if (tickerId) {
    clearInterval(tickerId);
    tickerId = null;
  }
}

async function init() {
  await initTheme();

  themeToggleButton?.addEventListener("click", handleToggleTheme);
  addAccountButton.addEventListener("click", openAddMethodDialog);
  addMethodCancelButton?.addEventListener("click", () => addMethodDialog.close());
  addNewButton?.addEventListener("click", () => {
    addMethodDialog.close();
    openAddDialog();
  });
  addUriButton?.addEventListener("click", () => {
    addMethodDialog.close();
    openUriDialog();
  });
  cancelButton.addEventListener("click", () => accountDialog.close());
  uriCancelButton?.addEventListener("click", () => uriDialog.close());
  accountTypeInput.addEventListener("change", toggleTypeFields);
  accountForm.addEventListener("submit", handleSaveAccount);
  uriForm?.addEventListener("submit", handleSaveUriAccount);
  accountsContainer.addEventListener("click", handleAccountsAction);
  accountsContainer.addEventListener("keydown", handleAccountsKeydown);
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".menu-wrap")) {
      hideAllMenus();
    }
  });

  await reloadAccounts();
  await renderAccounts();
  startTicker();
}

window.addEventListener("unload", stopTicker);

init().catch((error) => {
  showMessage(getErrorMessage(error, "Initialization failed."), true);
});
