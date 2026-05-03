import { BACKEND_API_PREFIX, BACKEND_BASE_URL } from "@/server/constants";

export function buildBackendUrl(path: string, search: string) {
  const url = new URL(`${BACKEND_API_PREFIX}${path}`, BACKEND_BASE_URL);
  if (search) {
    url.search = search;
  }
  return url.toString();
}

const BACKEND_FALLBACK_BASE_URLS = [
  process.env.BASE_BACKEND_URL_FALLBACK,
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://host.docker.internal:8000",
].filter((value): value is string => Boolean(value));

export function buildBackendFallbackUrls(path: string, search: string) {
  const urls: string[] = [buildBackendUrl(path, search)];
  const seen = new Set(urls);

  for (const baseUrl of BACKEND_FALLBACK_BASE_URLS) {
    const url = new URL(`${BACKEND_API_PREFIX}${path}`, baseUrl);
    if (search) {
      url.search = search;
    }
    const href = url.toString();
    if (!seen.has(href)) {
      seen.add(href);
      urls.push(href);
    }
  }

  return urls;
}
