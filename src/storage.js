const STORAGE_KEY = "auth.accounts";
const THEME_KEY = "auth.theme";

export async function getAccounts() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const accounts = result[STORAGE_KEY];

  if (!Array.isArray(accounts)) {
    return [];
  }

  return accounts;
}

export async function saveAccounts(accounts) {
  await chrome.storage.local.set({ [STORAGE_KEY]: accounts });
}

export async function addAccount(account) {
  const accounts = await getAccounts();
  accounts.push(account);
  await saveAccounts(accounts);
}

export async function updateAccount(updatedAccount) {
  const accounts = await getAccounts();
  const next = accounts.map((account) => (account.id === updatedAccount.id ? updatedAccount : account));
  await saveAccounts(next);
}

export async function deleteAccountById(accountId) {
  const accounts = await getAccounts();
  const next = accounts.filter((account) => account.id !== accountId);
  await saveAccounts(next);
}

export async function incrementHotpCounter(accountId) {
  const accounts = await getAccounts();
  const next = accounts.map((account) => {
    if (account.id !== accountId || account.type !== "hotp") {
      return account;
    }

    return {
      ...account,
      counter: Number(account.counter || 0) + 1,
      updatedAt: Date.now()
    };
  });

  await saveAccounts(next);
}

export async function getTheme() {
  const result = await chrome.storage.local.get(THEME_KEY);
  const theme = result[THEME_KEY];

  if (theme === "dark" || theme === "light") {
    return theme;
  }

  return "light";
}

export async function saveTheme(theme) {
  const value = theme === "dark" ? "dark" : "light";
  await chrome.storage.local.set({ [THEME_KEY]: value });
}