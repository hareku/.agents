import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import readline from "node:readline";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(new URL("./windows-playwright-mcp.mjs", import.meta.url));
const secret = "synthetic-secret/+for-tests";
async function fixture(
  t,
  {
    gateway = false,
    hang = false,
    missingToken = false,
    node = process.execPath,
    fail = false,
    defaultOutput = false,
  } = {},
) {
  const dir = await mkdtemp(join(tmpdir(), "windows-playwright-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const project = join(dir, "unrelated-project");
  const cacheHome = join(dir, "cache");
  await mkdir(project);
  const entry = join(dir, "server.cjs");
  const marker = join(dir, "closed");
  const tokenFile = join(dir, "token.txt");
  if (!missingToken) await writeFile(tokenFile, secret);
  await writeFile(
    entry,
    `
const fs=require('node:fs');
const readline=require('node:readline');
const token=process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN;
console.error('Sensitive URL ?token='+token);
if(${fail}) process.exit(7);
const input=readline.createInterface({input:process.stdin});
input.on('close',()=>{fs.writeFileSync(${JSON.stringify(marker)},'closed');process.exit(0)});
input.on('line',line=>{
 const msg=JSON.parse(line);
 if(!('id' in msg)||${hang}||msg.params?.name==='hang') return;
 const result=msg.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{},serverInfo:{name:'fake',version:'1'}}:
 {method:msg.method,params:msg.params,tokenReceived:token===${JSON.stringify(secret)},args:process.argv.slice(2)};
 if(msg.method==='leak') result.leak=token+' '+encodeURIComponent(token);
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result})+'\\n');
});`,
  );
  if (defaultOutput) {
    const fakeWslpath = join(dir, "wslpath");
    await writeFile(fakeWslpath, '#!/bin/sh\nprintf "%s" "$2"\n');
    await chmod(fakeWslpath, 0o755);
  }
  const args = [
    helper,
    `--windows-node=${node}`,
    `--mcp-entry=${entry}`,
    `--token-file=${tokenFile}`,
    ...(defaultOutput ? [] : ["--output-dir=C:\\synthetic-output"]),
    ...(gateway ? ["--gateway"] : []),
  ];
  const child = spawn(process.execPath, args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: project,
    env: {
      ...process.env,
      PATH: defaultOutput ? `${dir}:${process.env.PATH}` : process.env.PATH,
      XDG_CACHE_HOME: cacheHome,
    },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data) => {
    stdout += data;
  });
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  const lines = readline.createInterface({ input: child.stdout });
  const iterator = lines[Symbol.asyncIterator]();
  const completion = once(child, "close");
  t.after(() => {
    child.kill();
    lines.close();
  });
  return {
    child,
    cacheHome,
    marker,
    args,
    next: async () => JSON.parse((await iterator.next()).value),
    completion,
    output: () => stdout + stderr,
  };
}

test("stdio forwards JSON-RPC and Windows-only token without leaking output", {
  timeout: 8000,
}, async (t) => {
  const f = await fixture(t);
  f.child.stdin.write(
    `${JSON.stringify({ jsonrpc: "2.0", id: 42, method: "leak", params: {} })}\n`,
  );
  const response = await f.next();
  assert.equal(response.id, 42);
  assert.equal(response.result.tokenReceived, true);
  assert.deepEqual(response.result.args, [
    "--extension",
    "--browser=chrome",
    "--profile-dir-name=Default",
    "--output-dir=C:\\synthetic-output",
  ]);
  assert.equal(response.result.leak, "[REDACTED] [REDACTED]");
  f.child.stdin.end();
  assert.equal((await f.completion)[0], 0);
  assert.equal(await readFile(f.marker, "utf8"), "closed");
  assert.ok(!f.output().includes(secret));
  assert.ok(!f.args.join(" ").includes(secret));
});

test("gateway initializes and serves tools/list and tool calls then closes on EOF", {
  timeout: 8000,
}, async (t) => {
  const f = await fixture(t, { gateway: true });
  assert.deepEqual(await f.next(), { ready: true });
  f.child.stdin.write('{"method":"tools/list"}\n');
  assert.equal((await f.next()).result.method, "tools/list");
  f.child.stdin.write('{"name":"browser_tabs","arguments":{"action":"list"}}\n');
  assert.deepEqual((await f.next()).result.params, {
    name: "browser_tabs",
    arguments: { action: "list" },
  });
  f.child.stdin.end();
  assert.equal((await f.completion)[0], 0);
  assert.equal(await readFile(f.marker, "utf8"), "closed");
  assert.ok(!f.output().includes(secret));
});

test("gateway EOF cancels pending initialization", { timeout: 8000 }, async (t) => {
  const f = await fixture(t, { gateway: true, hang: true });
  f.child.stdin.end();
  assert.equal((await f.completion)[0], 0);
  assert.equal(await readFile(f.marker, "utf8"), "closed");
});

test("gateway exit disconnects without waiting on a pending request", {
  timeout: 8000,
}, async (t) => {
  const f = await fixture(t, { gateway: true, hang: true });
  f.child.stdin.write("exit\n");
  assert.equal((await f.completion)[0], 0);
});

test("SIGTERM cleans up Windows wrapper and MCP", { timeout: 8000 }, async (t) => {
  const f = await fixture(t, { gateway: true });
  await f.next();
  f.child.kill("SIGTERM");
  assert.equal((await f.completion)[0], 143);
  assert.equal(await readFile(f.marker, "utf8"), "closed");
});

for (const [name, options] of Object.entries({
  missingToken: { missingToken: true },
  missingNode: { node: "/nonexistent/windows/node.exe" },
  serverFailure: { fail: true },
})) {
  test(`${name} returns a nonzero exit without secrets`, { timeout: 8000 }, async (t) => {
    const f = await fixture(t, { gateway: true, ...options });
    assert.notEqual((await f.completion)[0], 0);
    assert.ok(!f.output().includes(secret));
  });
}

test("gateway retains commands received before initialization", { timeout: 8000 }, async (t) => {
  const f = await fixture(t, { gateway: true });
  f.child.stdin.write('{"method":"tools/list"}\n');
  assert.deepEqual(await f.next(), { ready: true });
  assert.equal((await f.next()).result.method, "tools/list");
  f.child.stdin.end();
  assert.equal((await f.completion)[0], 0);
});

test("gateway EOF closes a pending tool call", { timeout: 8000 }, async (t) => {
  const f = await fixture(t, { gateway: true });
  await f.next();
  f.child.stdin.write('{"name":"hang"}\n');
  f.child.stdin.end();
  assert.equal((await f.completion)[0], 0);
  assert.equal(await readFile(f.marker, "utf8"), "closed");
});

test("default output uses a separate run directory in the user cache from any project", {
  timeout: 8000,
}, async (t) => {
  const f = await fixture(t, { defaultOutput: true });
  f.child.stdin.write('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
  const result = (await f.next()).result;
  const output = result.args.find((arg) => arg.startsWith("--output-dir=")).slice(13);
  assert.equal(dirname(output), join(f.cacheHome, "playwright-mcp"));
  assert.match(basename(output), /^run-/);
  assert.equal((await stat(output)).isDirectory(), true);
  f.child.stdin.end();
  assert.equal((await f.completion)[0], 0);
});
