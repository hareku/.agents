import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { homedir } from "node:os";
import { join, win32 } from "node:path";
import readline from "node:readline";

// Only the Windows process reads the token. Neither argv nor WSL contains its value.
const WINDOWS_RUNNER = String.raw`
const {spawn}=require('node:child_process');
const {readFileSync}=require('node:fs');
const readline=require('node:readline');
const [entry,tokenFile,...args]=process.argv.slice(1);
let token;
try { token=readFileSync(tokenFile,'utf8').trim(); if(!token) throw Error(); }
catch { console.error('Cannot read a nonempty Playwright extension token file'); process.exit(1); }
const child=spawn(process.execPath,[entry,...args],{
  stdio:['pipe','pipe','ignore'],
  env:{...process.env,PLAYWRIGHT_MCP_EXTENSION_TOKEN:token}
});
// Redact exact and URL-encoded tokens, including when output arrives in split chunks.
const output=readline.createInterface({input:child.stdout});
output.on('line',line=>process.stdout.write(line.split(token).join('[REDACTED]').split(encodeURIComponent(token)).join('[REDACTED]')+'\n'));
let timer;
function stop() {
  if(timer) return;
  child.stdin.end();
  timer=setTimeout(()=>child.kill(),1000);
  timer.unref();
}
process.stdin.pipe(child.stdin);
process.stdin.on('end',stop);
process.stdin.on('error',stop);
child.stdin.on('error',stop);
process.on('SIGINT',stop);
process.on('SIGTERM',stop);
child.on('error',()=>{console.error('Cannot launch Windows Playwright MCP');process.exit(1)});
child.on('close',(code,signal)=>{clearTimeout(timer);process.exit(code??(signal?1:0))});
`;

function optionsFrom(args) {
  const options = {};
  for (const arg of args) {
    if (arg === "--gateway") options.gateway = true;
    else {
      const match = arg.match(
        /^--(windows-node|mcp-entry|token-file|profile-dir-name|output-dir)=(.+)$/,
      );
      if (!match) throw new Error("Unknown option; use --help");
      options[match[1]] = match[2];
    }
  }
  if (!options["windows-node"] || !options["mcp-entry"] || !options["token-file"]) {
    const script =
      "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; @{node=(Get-Command node.exe).Source;localAppData=$env:LOCALAPPDATA} | ConvertTo-Json -Compress";
    let paths;
    try {
      paths = JSON.parse(
        execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      );
      options["windows-node"] ??= execFileSync("wslpath", ["-u", paths.node], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      throw new Error("Cannot discover Windows Node and LOCALAPPDATA; use explicit path options");
    }
    const root = win32.join(paths.localAppData, "PlaywrightMCP");
    options["mcp-entry"] ??= win32.join(root, "node_modules", "@playwright", "mcp", "cli.js");
    options["token-file"] ??= win32.join(root, "extension-token.txt");
  }
  if (!options["output-dir"]) {
    const cache = join(
      process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
      "playwright-mcp",
    );
    mkdirSync(cache, { recursive: true });
    const output = mkdtempSync(join(cache, "run-"));
    options["output-dir"] = execFileSync("wslpath", ["-w", output], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  }
  return options;
}

async function main(args) {
  if (args.includes("--help")) {
    process.stdout.write(
      'Usage: node windows-playwright-mcp.mjs [--gateway]\nOptions: --windows-node=<WSL path> --mcp-entry=<Windows path> --token-file=<Windows path> --profile-dir-name=Default --output-dir=<Windows path>\nOutput defaults to a new run directory under XDG_CACHE_HOME/playwright-mcp (or ~/.cache/playwright-mcp).\nDefault: MCP stdio. Gateway: JSON lines {name,arguments} or {method:"tools/list"}; exit/EOF disconnects, leaving Chrome open.\n',
    );
    return;
  }
  const options = optionsFrom(args);
  const serverArgs = [
    "--extension",
    "--browser=chrome",
    `--profile-dir-name=${options["profile-dir-name"] ?? "Default"}`,
  ];
  if (options["output-dir"]) serverArgs.push(`--output-dir=${options["output-dir"]}`);
  const child = spawn(
    options["windows-node"],
    ["-e", WINDOWS_RUNNER, options["mcp-entry"], options["token-file"], ...serverArgs],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  let stopping = false;
  let timer;
  let input;
  const pending = new Map();
  const rejectPending = () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Playwright MCP connection closed"));
    }
    pending.clear();
  };
  const stop = () => {
    if (stopping) return;
    stopping = true;
    rejectPending();
    input?.close();
    process.stdin.unpipe(child.stdin);
    process.stdin.destroy();
    child.stdin.end();
    timer = setTimeout(() => child.kill(), 3000);
    timer.unref();
  };
  const interrupt = () => {
    process.exitCode = 130;
    stop();
  };
  const terminate = () => {
    process.exitCode = 143;
    stop();
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  child.stdin.on("error", stop);
  const completion = new Promise((accept) => {
    child.once("error", () => {
      process.stderr.write("Cannot launch Windows Node for Playwright MCP\n");
      process.exitCode = 1;
      stop();
    });
    child.once("close", (code, signal) => {
      if (!stopping && (code || signal)) {
        process.stderr.write(
          "Windows Playwright MCP exited unexpectedly; check installation and token file\n",
        );
        process.exitCode = code || 1;
      }
      stop();
      clearTimeout(timer);
      accept();
    });
  });
  try {
    if (!options.gateway) {
      child.stdout.pipe(process.stdout);
      process.stdin.pipe(child.stdin);
      process.stdin.once("end", stop);
      await completion;
      return;
    }
    let sequence = 0;
    const output = readline.createInterface({ input: child.stdout });
    output.on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error)
        request.reject(new Error(message.error.message ?? "Playwright MCP request error"));
      else request.accept(message.result);
    });
    const notify = (method, params = {}) => {
      if (!stopping) child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    };
    const request = (method, params = {}) =>
      new Promise((accept, reject) => {
        if (stopping) return reject(new Error("Playwright MCP connection closed"));
        const id = ++sequence;
        const timeout = setTimeout(() => {
          pending.delete(id);
          notify("notifications/cancelled", { requestId: id, reason: "Request timed out" });
          reject(
            new Error("Playwright MCP request timed out; inspect browser state before retrying"),
          );
        }, 60_000);
        pending.set(id, { accept, reject, timer: timeout });
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    input = readline.createInterface({ input: process.stdin, terminal: false });
    input.once("close", stop);
    let queue = request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "windows-playwright", version: "1.0.0" },
    })
      .then(() => {
        if (stopping) return;
        notify("notifications/initialized");
        process.stdout.write('{"ready":true}\n');
      })
      .catch(() => {
        if (!stopping) {
          process.stderr.write("Cannot initialize Windows Playwright MCP\n");
          process.exitCode = 1;
          stop();
        }
      });
    input.on("line", (line) => {
      if (line.trim() === "exit") {
        stop();
        return;
      }
      if (!line.trim()) return;
      queue = queue.then(async () => {
        if (stopping) return;
        try {
          const command = JSON.parse(line);
          if (
            !command ||
            (command.method ? command.method !== "tools/list" : typeof command.name !== "string")
          )
            throw new Error("Use tools/list or a tool name");
          const result = await request(
            command.method ?? "tools/call",
            command.method ? {} : { name: command.name, arguments: command.arguments ?? {} },
          );
          if (!stopping) process.stdout.write(`${JSON.stringify({ result })}\n`);
        } catch (error) {
          if (!stopping) process.stdout.write(`${JSON.stringify({ error: error.message })}\n`);
        }
      });
    });
    await completion;
    await queue;
    output.close();
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", terminate);
  }
}

main(process.argv.slice(2)).catch(() => {
  process.stderr.write(
    "Cannot start Windows Playwright MCP; check options and Windows installation (--help)\n",
  );
  process.exitCode = 1;
});
