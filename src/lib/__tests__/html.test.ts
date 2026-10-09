import { describe, expect, it } from "vitest";
import { escapeHtml } from "../html";

describe("escapeHtml", () => {
  it("escapes text before it is inserted into printable HTML", () => {
    expect(escapeHtml(`<img src=x onerror="alert('xss')"> & Co`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; Co");
  });

  it("handles missing values without rendering undefined", () => {
    expect(escapeHtml(undefined)).toBe("");
  });
});
