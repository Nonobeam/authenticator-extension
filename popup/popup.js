import { generateHotp, generateTotp, groupOtp } from "../src/otp.js";
import {
  addAccount,
  deleteAccountById,
  getAccounts,
  incrementHotpCounter,
  updateAccount
} from "../src/storage.js";
import { validateAccountInput } from "../src/validation.js";

const addAccountButton = document.querySelector("#add-account-btn");
const accountsContainer = document.querySelector("#accounts-container");
const messageElement = document.querySelector("#message");

const accountDialog = document.querySelector("#account-dialog");
const accountForm = document.querySelector("#account-form");
const dialogTitle = document.querySelector("#dialog-title");
const accountIdInput = document.querySelector("#account-id");
const accountLabelInput = document.querySelector("#account-label");
const accountSecretInput = document.querySelector("#account-secret");
const accountTypeInput = document.querySelector("#account-type");
const accountDigitsInput = document.querySelector("#account-digits");
const accountPeriodInput = document.querySelector("#account-period");
const accountCounterInput = document.querySelector("#account-counter");
const totpFieldGroup = document.querySelector("#totp-field-group");
const hotpFieldGroup = document.querySelector("#hotp-field-group");
const formError = document.querySelector("#form-error");
const cancelButton = document.querySelector("#cancel-btn");

let accounts = [];
const hotpDisplayCodes = new Map();
let messageTimeoutId = null;
let tickerId = null;
let isRendering = false;
let renderAgain = false;

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

function toggleTypeFields() {
  const isTotp = accountTypeInput.value === "totp";
  totpFieldGroup.classList.toggle("hidden", !isTotp);
  hotpFieldGroup.classList.toggle("hidden", isTotp);
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

function openAddDialog() {
  dialogTitle.textContent = "Add key";
  resetFormDefaults();
  accountDialog.showModal();
  accountLabelInput.focus();
}

function openEditDialog(accountId) {
  const account = accounts.find((item) => item.id === accountId);

  if (!account) {
    showMessage("Account not found.", true);
    return;
  }

  dialogTitle.textContent = "Edit key";
  clearFormError();
  accountIdInput.value = account.id;
  accountLabelInput.value = account.label;
  accountSecretInput.value = account.secretBase32;
  accountTypeInput.value = account.type;
  accountDigitsInput.value = String(account.digits);
  accountPeriodInput.value = String(account.period);
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
  const digits = Number.isInteger(Number(account?.digits)) ? Number(account.digits) : 6;
  const periodInput = Number(account?.period);
  const period = Number.isInteger(periodInput) && periodInput > 0 ? periodInput : 30;
  const counterInput = Number(account?.counter);
  const counter = Number.isInteger(counterInput) && counterInput >= 0 ? counterInput : 0;

  return {
    id: String(account.id),
    label: String(account.label || ""),
    secretBase32: String(account.secretBase32 || ""),
    type,
    digits: digits === 8 ? 8 : 6,
    period,
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
            const elapsed = result.period - result.remaining;
            const progress = Math.min(100, Math.max(0, Math.round((elapsed / result.period) * 100)));

            return `
              <article class="account-card">
                <div class="account-header">
                  <h3 class="account-label">${escapedLabel}</h3>
                  <span class="account-type">${typeLabel}</span>
                </div>
                <p class="code">${escapeHtml(groupedCode)}</p>
                <p class="meta">Refresh in ${result.remaining}s • ${account.digits} digits • ${result.period}s period</p>
                <div class="progress-track" aria-hidden="true">
                  <div class="progress-bar" style="width: ${progress}%;"></div>
                </div>
                <div class="actions">
                  <button class="btn" type="button" data-action="copy" data-id="${escapeHtml(account.id)}" data-code="${code}">Copy</button>
                  <button class="btn" type="button" data-action="edit" data-id="${escapeHtml(account.id)}">Edit</button>
                  <button class="btn btn-danger" type="button" data-action="delete" data-id="${escapeHtml(account.id)}">Delete</button>
                </div>
              </article>
            `;
          } catch (error) {
            return `
              <article class="account-card">
                <div class="account-header">
                  <h3 class="account-label">${escapedLabel}</h3>
                  <span class="account-type">${typeLabel}</span>
                </div>
                <p class="meta">${escapeHtml(getErrorMessage(error, "Unable to generate TOTP code."))}</p>
                <div class="actions">
                  <button class="btn" type="button" data-action="edit" data-id="${escapeHtml(account.id)}">Edit</button>
                  <button class="btn btn-danger" type="button" data-action="delete" data-id="${escapeHtml(account.id)}">Delete</button>
                </div>
              </article>
            `;
          }
        }

        const hotpRawCode = hotpDisplayCodes.get(account.id) || "";
        const hotpGroupedCode = hotpRawCode ? groupOtp(hotpRawCode) : "------";
        const copyDisabled = hotpRawCode ? "" : "disabled";

        return `
          <article class="account-card">
            <div class="account-header">
              <h3 class="account-label">${escapedLabel}</h3>
              <span class="account-type">${typeLabel}</span>
            </div>
            <p class="code">${escapeHtml(hotpGroupedCode)}</p>
            <p class="meta">Counter: ${account.counter} • ${account.digits} digits</p>
            <div class="actions">
              <button class="btn btn-primary" type="button" data-action="generate-hotp" data-id="${escapeHtml(account.id)}">Generate</button>
              <button class="btn" type="button" data-action="copy" data-id="${escapeHtml(account.id)}" data-code="${hotpRawCode}" ${copyDisabled}>Copy</button>
              <button class="btn" type="button" data-action="edit" data-id="${escapeHtml(account.id)}">Edit</button>
              <button class="btn btn-danger" type="button" data-action="delete" data-id="${escapeHtml(account.id)}">Delete</button>
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

async function handleSaveAccount(event) {
  event.preventDefault();
  clearFormError();

  const accountId = accountIdInput.value.trim();

  try {
    const validated = validateAccountInput({
      label: accountLabelInput.value,
      secretBase32: accountSecretInput.value,
      type: accountTypeInput.value,
      digits: accountDigitsInput.value,
      period: accountPeriodInput.value,
      counter: accountCounterInput.value
    });

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

async function handleAccountsAction(event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const accountId = button.dataset.id || "";

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
    await copyCode(button.dataset.code || "");
  }
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
  addAccountButton.addEventListener("click", openAddDialog);
  cancelButton.addEventListener("click", () => accountDialog.close());
  accountTypeInput.addEventListener("change", toggleTypeFields);
  accountForm.addEventListener("submit", handleSaveAccount);
  accountsContainer.addEventListener("click", handleAccountsAction);

  await reloadAccounts();
  await renderAccounts();
  startTicker();
}

window.addEventListener("unload", stopTicker);

init().catch((error) => {
  showMessage(getErrorMessage(error, "Initialization failed."), true);
});