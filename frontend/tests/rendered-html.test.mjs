import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: renderApp } = await import(workerUrl.href);
  return renderApp(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
  );
}

test("renders the RecycleHub login shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>RecycleHub \| ระบบจัดการศูนย์รีไซเคิล<\/title>/);
  assert.match(html, /ID/);
  assert.match(html, /Password/);
  assert.match(html, /Login/);
  assert.doesNotMatch(html, /codex-preview|Building your site/);
});
