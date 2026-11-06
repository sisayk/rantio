// Regression tests for the notifications switch (src/state/pushSwitch.ts): the phone's saved
// choice and the server must never disagree once a change has settled, whatever fails.
// Run: npm run test:push   (Node 22.18+ runs the TypeScript file directly)
import assert from "node:assert/strict";
import { test } from "node:test";

import { createPushSwitch, OFF_KEY, PushSyncError } from "../src/state/pushSwitch.ts";

const TOKEN = "ExponentPushToken[phone]";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The server's AppDevice.push_token, reachable or not, with a delay per request. */
function fakeServer({ token = TOKEN } = {}) {
  const s = {
    token,
    online: true,
    calls: [],
    delays: [],
    async send(t) {
      s.calls.push(t);
      await sleep(s.delays.shift() ?? 1);
      if (!s.online) throw new Error("Network request failed");
      s.token = t;
      return { ok: true };
    },
  };
  return s;
}

/** AsyncStorage, whose writes can be made to fail. */
function fakeStore() {
  const data = new Map();
  const st = {
    data,
    failWrites: false,
    async getItem(k) {
      return data.has(k) ? data.get(k) : null;
    },
    async setItem(k, v) {
      if (st.failWrites) throw new Error("storage full");
      data.set(k, v);
    },
    async removeItem(k) {
      if (st.failWrites) throw new Error("storage full");
      data.delete(k);
    },
  };
  return st;
}

function setup(opts) {
  const server = fakeServer(opts);
  const store = fakeStore();
  const sw = createPushSwitch(store, (t) => server.send(t));
  const granted = async () => TOKEN;
  /** What the switch shows agrees with what the server does. */
  const agree = async () => assert.equal(await sw.isOff(), server.token === "", "phone and server disagree");
  return { server, store, sw, granted, agree };
}

test("switching off stops the server pushing, then saves it on the phone", async () => {
  const { server, store, sw, agree } = setup();
  assert.equal(await sw.turnOff(), "off");
  assert.equal(server.token, "");
  assert.equal(store.data.get(OFF_KEY), "1");
  await agree();
});

test("a failed switch-off changes nothing, and reopening the page still shows on (the reported bug)", async () => {
  const { server, store, sw, agree } = setup();
  server.online = false;
  await assert.rejects(sw.turnOff(), (err) => err instanceof PushSyncError && err.wanted === "off");
  assert.equal(server.token, TOKEN); // the server still pushes...
  assert.equal(store.data.has(OFF_KEY), false); // ...and the phone says so
  assert.equal(await sw.isOff(), false);
  await agree();
});

test("switching on again registers the token, then forgets off", async () => {
  const { server, store, sw, granted, agree } = setup();
  await sw.turnOff();
  assert.equal(await sw.turnOn(granted), "on");
  assert.equal(server.token, TOKEN);
  assert.equal(store.data.has(OFF_KEY), false);
  await agree();
});

test("a failed switch-on leaves notifications off on both sides", async () => {
  const { server, sw, granted, agree } = setup();
  await sw.turnOff();
  server.online = false;
  await assert.rejects(sw.turnOn(granted), (err) => err instanceof PushSyncError && err.wanted === "on");
  assert.equal(await sw.isOff(), true);
  await agree();
});

test("switching on without the system's permission sends nothing", async () => {
  const { server, sw, agree } = setup();
  await sw.turnOff();
  server.calls.length = 0;
  assert.equal(await sw.turnOn(async () => null), "off");
  assert.deepEqual(server.calls, []);
  await agree();
});

test("quick switching runs the changes in order and ends where the last one did", async () => {
  const { server, store, sw, granted, agree } = setup();
  server.delays = [30, 1, 15]; // the first request is the slowest
  const results = await Promise.all([sw.turnOff(), sw.turnOn(granted), sw.turnOff()]);
  assert.deepEqual(results, ["off", "on", "off"]);
  assert.deepEqual(server.calls, ["", TOKEN, ""]);
  assert.equal(server.token, "");
  assert.equal(store.data.get(OFF_KEY), "1");
  await agree();
});

test("quick switching with a failure in the middle still settles in agreement", async () => {
  const { server, sw, granted, agree } = setup();
  const off = sw.turnOff();
  const on = sw.turnOn(async () => {
    server.online = false; // the connection drops just before this request
    return TOKEN;
  });
  await off;
  await assert.rejects(on, PushSyncError);
  await agree(); // off on both sides
  server.online = true;
  assert.equal(await sw.turnOn(granted), "on");
  await agree();
});

test("the page reads the choice only after a change still running has finished", async () => {
  const { server, sw } = setup();
  server.delays = [20];
  const off = sw.turnOff();
  assert.equal(await sw.isOff(), true);
  await off;
});

test("off reached the server but couldn't be saved: the next start puts both back to on", async () => {
  const { server, store, sw, granted, agree } = setup();
  store.failWrites = true;
  assert.equal(await sw.turnOff(), "off");
  assert.equal(server.token, ""); // server off, phone still on: until...
  store.failWrites = false;
  assert.equal(await sw.resume(granted), "on"); // ...the next app start
  await agree();
});

test("on reached the server but off couldn't be forgotten: the next start puts the server back to off", async () => {
  const { server, store, sw, granted, agree } = setup();
  await sw.turnOff();
  store.failWrites = true;
  assert.equal(await sw.turnOn(granted), "on");
  store.failWrites = false;
  assert.equal(await sw.resume(granted), "off");
  assert.equal(server.token, "");
  await agree();
});

test("each start tells the server the saved choice, and retries after a failed one", async () => {
  const { server, sw, granted, agree } = setup({ token: "" });
  assert.equal(await sw.resume(granted), "on"); // e.g. a switch-on whose request was lost
  assert.equal(server.token, TOKEN);
  await sw.turnOff();
  server.token = TOKEN; // the server somehow still has it
  server.online = false;
  await assert.rejects(sw.resume(granted)); // offline at start: left for the next one
  server.online = true;
  assert.equal(await sw.resume(granted), "off");
  await agree();
});

test("permission taken away in the phone's settings: the start removes the token", async () => {
  const { server, sw } = setup();
  assert.equal(await sw.resume(async () => null), "off");
  assert.equal(server.token, "");
});
