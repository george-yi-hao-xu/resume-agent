import { API_BASE_URL } from "../constants";
import { getInitialApiBaseUrl } from "./SettingStore";

describe("SettingStore", () => {
  it("uses apiUrl from the page query string", () => {
    expect(getInitialApiBaseUrl("?apiUrl=http://172.28.123.45:8000")).toBe("http://172.28.123.45:8000");
  });

  it("falls back to backendUrl from the page query string", () => {
    expect(getInitialApiBaseUrl("?backendUrl=http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000");
  });

  it("uses the default API URL when no query param is present", () => {
    expect(getInitialApiBaseUrl("?x=1")).toBe(API_BASE_URL);
  });
});
