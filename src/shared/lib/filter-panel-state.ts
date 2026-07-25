const FILTER_PANEL_OPEN = "open";
const FILTER_PANEL_CLOSED = "closed";
const FILTER_PANEL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function parseFilterPanelState(value: string | null | undefined) {
  if (value === FILTER_PANEL_OPEN) return true;
  if (value === FILTER_PANEL_CLOSED) return false;
  return undefined;
}

function readCookieValue(cookie: string | undefined, name: string) {
  if (!cookie) return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined;
}

export function readFilterPanelOpenState(
  storage: Pick<Storage, "getItem"> | undefined,
  storageKey: string,
  cookie?: string,
) {
  try {
    const savedState = parseFilterPanelState(storage?.getItem(storageKey));
    if (savedState !== undefined) return savedState;
  } catch {
    // Ignore storage access errors in private mode or restricted browsers.
  }

  return parseFilterPanelState(readCookieValue(cookie, storageKey));
}

export function writeFilterPanelOpenState(
  storage: Pick<Storage, "setItem"> | undefined,
  storageKey: string,
  isOpen: boolean,
  writeCookie?: (cookie: string) => void,
) {
  const value = isOpen ? FILTER_PANEL_OPEN : FILTER_PANEL_CLOSED;
  try {
    storage?.setItem(storageKey, value);
  } catch {
    // Ignore storage access errors in private mode or restricted browsers.
  }

  try {
    writeCookie?.(
      `${encodeURIComponent(storageKey)}=${encodeURIComponent(value)}; Path=/; Max-Age=${FILTER_PANEL_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`,
    );
  } catch {
    // Ignore cookie write issues.
  }
}

export function getFilterPanelInitialState({
  hasActiveFilters,
  storage,
  storageKey,
}: {
  hasActiveFilters: boolean;
  storage: Pick<Storage, "getItem"> | undefined;
  storageKey: string;
}) {
  return readFilterPanelOpenState(storage, storageKey) ?? hasActiveFilters;
}
