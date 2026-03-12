import { BACKEND_API_PREFIX, BACKEND_BASE_URL } from "@/server/constants";

export function buildBackendUrl(path: string, search: string) {
  const url = new URL(`${BACKEND_API_PREFIX}${path}`, BACKEND_BASE_URL);
  if (search) {
    url.search = search;
  }
  return url.toString();
}
