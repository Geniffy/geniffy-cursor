// Every hook the plugin gives Cursor, run the way Cursor runs them (a child process, the hook's JSON on stdin,
// JSON back on stdout) against a stand-in Geniffy: the Geniffy commands typed in the chat, signing in,
// recall at the start of a chat, each turn saved in the background with secrets and code left out, pausing,
// reading only, and signing out.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { startFake } from "./fake-geniffy.mjs";

const SCRIPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts");
const project = path.join(os.tmpdir(), "demo-app");

function run(script, { input = {}, env, onStdout } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(SCRIPTS, script)], { env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; onStdout?.(out); });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (code) => resolve({ code, out, err, json: () => JSON.parse(out || "{}") }));
    child.stdin.end(JSON.stringify(input));
  });
}

// What Cursor sends every hook, plus the event's own fields.
const hook = (fields) => ({ conversation_id: "c1", generation_id: "g1", hook_event_name: "x", workspace_roots: [project], ...fields });

async function setup(opts) {
  const fake = await startFake(opts);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "geniffy-cursor-"));
  const env = { ...process.env, GENIFFY_API_URL: fake.base, GENIFFY_PLUGIN_HOME: home, GENIFFY_NO_BROWSER: "1" };
  const creds = () => JSON.parse(fs.readFileSync(path.join(home, "credentials.json"), "utf8"));
  return { fake, home, env, creds };
}

// Signs in as a person would: login prints the address, the "browser" follows it, Geniffy answers the
// listener on 127.0.0.1, and login exchanges the code.
async function login(env) {
  let opened = false;
  return run("login.mjs", {
    env,
    onStdout: (out) => {
      const m = out.match(/https?:\/\/\S+\/oauth\/authorize\S+/);
      if (m && !opened) {
        opened = true;
        fetch(m[0]).catch(() => {});
      }
    },
  });
}

async function until(check, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return check();
}

const turn = async (env, prompt, answer, id = "c1") => {
  const sent = await run("prompt.mjs", { env, input: hook({ conversation_id: id, prompt }) });
  if (answer !== undefined) await run("reply.mjs", { env, input: hook({ conversation_id: id, text: "Let me look." }) });
  if (answer !== undefined) await run("reply.mjs", { env, input: hook({ conversation_id: id, text: answer }) });
  await run("stop.mjs", { env, input: hook({ conversation_id: id, status: "completed", loop_count: 0 }) });
  return sent.json();
};

test("geniffy commands are answered by the plugin, and never reach the model", async () => {
  const { fake, home, env } = await setup();
  try {
    for (const typed of ["geniffy status", "/geniffy-status", "Geniffy: status", "geniffy_status."]) {
      const r = (await run("prompt.mjs", { env, input: hook({ prompt: typed }) })).json();
      assert.equal(r.continue, false, typed);
      assert.match(r.user_message, /Not signed in to Geniffy: type "geniffy login" in the chat\./);
    }
    const plain = (await run("prompt.mjs", { env, input: hook({ prompt: "how does geniffy status work here?" }) })).json();
    assert.deepEqual(plain, { continue: true }, "a question that mentions a command is just a question");

    // "geniffy login" opens the sign-in on its own and lets the chat go on: Geniffy sees Cursor register.
    const started = (await run("prompt.mjs", { env: { ...env, GENIFFY_LOGIN_WAIT_MS: "1500" }, input: hook({ prompt: "geniffy login" }) })).json();
    assert.equal(started.continue, false);
    assert.match(started.user_message, /Opening your browser to sign in to Geniffy/);
    assert.ok(await until(() => [...fake.s.clients.values()].some((c) => c.client_name === "Geniffy for Cursor")),
      "the sign-in started, named for Cursor on Geniffy's approval screen");
  } finally {
    await new Promise((r) => setTimeout(r, 1700)); // the sign-in gives up waiting for a browser
    await fake.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("signing in, recalling, saving each turn, pausing and signing out", async () => {
  const { fake, home, env, creds } = await setup();
  try {
    // Signed out: the chat is told how to sign in, and nothing is kept.
    const out = (await run("session-start.mjs", { env, input: hook({ session_id: "s1" }) })).json();
    assert.match(out.additional_context, /not signed in.*type "geniffy login"/s);
    assert.deepEqual(await turn(env, "We use pnpm here, never npm.", "Noted."), { continue: true });
    assert.equal(fake.s.remembered.length, 0);
    assert.ok(!fs.existsSync(path.join(home, "turns")) || fs.readdirSync(path.join(home, "turns")).length === 0);

    const signed = await login(env);
    assert.equal(signed.code, 0, signed.out);
    assert.match(signed.out, /Signed in to Geniffy\. New chats in Cursor start with what Geniffy remembers/);
    assert.ok(creds().access_token.startsWith("gnf_at_"));
    if (process.platform !== "win32") assert.equal(fs.statSync(path.join(home, "credentials.json")).mode & 0o777, 0o600);

    // The chat starts knowing the person and this project, and nothing from elsewhere.
    const ctx = (await run("session-start.mjs", { env, input: hook({ session_id: "s2" }) })).json().additional_context;
    assert.match(ctx, /Prefers pnpm to npm\./);
    assert.match(ctx, /From earlier work on demo-app:\n- The demo-app API is written in Go\.  \(2026-10-01\)/);
    assert.doesNotMatch(ctx, /Lunch is at one/, "a search hit that is not about this project stays out");

    // A turn: the prompt, the agent's messages (only the last is kept), then the turn ends and saves.
    await turn(env, "We always deploy on Tuesdays. Use key " + "sk-" + "ant-abcdefghijklmnop1234" + " and password: hunter2hunter2",
      "Noted, Tuesday deploys.\n```js\nconsole.log('deploy')\n```\nDone.");
    assert.ok(await until(() => fake.s.remembered.length === 1), "saved in the background");
    const saved = fake.s.remembered[0];
    assert.equal(saved.title, "Cursor: demo-app");
    assert.match(saved.messages[0].content, /We always deploy on Tuesdays\./);
    assert.match(saved.messages[0].content, /\[secret removed\].*password: \[secret removed\]/);
    assert.doesNotMatch(JSON.stringify(saved), /sk-ant-|hunter2|Let me look/);
    assert.equal(saved.messages[1].content, "Noted, Tuesday deploys.\n[code left out]\nDone.");
    assert.ok(await until(() => fs.readdirSync(path.join(home, "turns")).length === 0), "a saved turn leaves nothing behind");

    // Commands are never saved, and a turn with nothing in it is not either.
    await turn(env, "geniffy status");
    await turn(env, "ok", "Okay.");
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(fake.s.remembered.length, 1);

    // Paused: recall goes on, saving stops; resumed, it saves again.
    assert.match((await run("prompt.mjs", { env, input: hook({ prompt: "geniffy pause" }) })).json().user_message, /paused/);
    await turn(env, "Our staging database is in Pune.", "Got it.");
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(fake.s.remembered.length, 1);
    const status = (await run("prompt.mjs", { env, input: hook({ prompt: "geniffy status" }) })).json().user_message;
    assert.match(status, /Signed in to Geniffy since \d{4}-\d{2}-\d{2}, reading and saving\.\nSaving: paused/);
    assert.match(status, /Last saved: .* from demo-app\./);
    await run("prompt.mjs", { env, input: hook({ prompt: "geniffy resume" }) });
    await turn(env, "Our staging database is in Pune.", "Got it.");
    assert.ok(await until(() => fake.s.remembered.length === 2));

    // Reading memory runs without asking; saving still asks; another server is left alone.
    const allow = async (fields) => (await run("allow-reads.mjs", { env, input: hook(fields) })).json();
    assert.deepEqual(await allow({ mcp_server_name: "geniffy", tool_name: "search" }), { permission: "allow" });
    assert.deepEqual(await allow({ mcp_server_name: "geniffy", tool_name: "remember" }), {});
    assert.deepEqual(await allow({ mcp_server_name: "other", tool_name: "search" }), {});

    // Signing out ends the sign-in at Geniffy and deletes it here.
    const { refresh_token: refreshToken, client_id: clientId } = creds();
    assert.match((await run("prompt.mjs", { env, input: hook({ prompt: "geniffy logout" }) })).json().user_message, /Signed out of Geniffy/);
    assert.deepEqual(fake.s.revoked.at(-1), { token: refreshToken, token_type_hint: "refresh_token", client_id: clientId });
    assert.ok(!fs.existsSync(path.join(home, "credentials.json")));
  } finally {
    await fake.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("reading only, and saying no", async () => {
  const { fake, home, env } = await setup({ scope: "memory:read" });
  try {
    assert.match((await login(env)).out, /reading only/);
    await turn(env, "Remember that I like tea.", "Noted.");
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(fake.s.remembered.length, 0, "a read-only sign-in never saves");
    fs.rmSync(path.join(home, "credentials.json"));
    fake.s.deny = true;
    const denied = await login(env);
    assert.equal(denied.code, 1);
    assert.match(denied.out, /You chose not to connect/);
  } finally {
    await fake.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
