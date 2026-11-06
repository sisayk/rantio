// The notifications switch (Account → Notifications), kept in step with the server.
//
// The rule: this phone's saved choice changes only after the server has accepted the change, and
// every app start sends the server what the saved choice says. So the switch never shows "off"
// while the server still pushes to the phone, a failed change leaves both sides as they were and
// says so, and anything left half done (the app closed mid-request, storage failing) is put right
// at the next start. Changes run one at a time, in the order they were made.
//
// No Expo or React Native imports: scripts/push-switch-test.mjs runs this file with Node.

/** Saved as "1" once the server has stopped pushing to this phone; absent means on. */
export const OFF_KEY = "rantio.pushOff";

export type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** The change didn't reach the server: nothing changed, on the phone or on the server. */
export class PushSyncError extends Error {
  readonly wanted: "on" | "off";
  constructor(wanted: "on" | "off", cause: unknown) {
    super(`Couldn't switch notifications ${wanted}`);
    this.name = "PushSyncError";
    this.wanted = wanted;
    this.cause = cause;
  }
}

/** The phone's push token, or null when the system's permission isn't (or wasn't) given. */
export type TokenSource = () => Promise<string | null>;

export function createPushSwitch(store: Store, sendToken: (token: string) => Promise<unknown>) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };
  const savedOff = () =>
    store
      .getItem(OFF_KEY)
      .then((v) => v === "1")
      .catch(() => false);

  return {
    /** The owner's choice as saved on this phone (after any change still running). */
    isOff: () => serial(savedOff),

    /** The switch, off: the server first, then this phone. Throws PushSyncError, changing nothing. */
    turnOff: () =>
      serial(async () => {
        try {
          await sendToken("");
        } catch (err) {
          throw new PushSyncError("off", err);
        }
        await store.setItem(OFF_KEY, "1").catch(() => undefined); // if this fails, the next start sends the token again: on
        return "off" as const;
      }),

    /** The switch, on: registers the token, then forgets "off". "off" if permission was refused. */
    turnOn: (token: TokenSource) =>
      serial(async () => {
        const t = await token();
        if (!t) return "off" as const;
        try {
          await sendToken(t);
        } catch (err) {
          throw new PushSyncError("on", err);
        }
        await store.removeItem(OFF_KEY).catch(() => undefined); // if this fails, the next start tells the server "off"
        return "on" as const;
      }),

    /**
     * Each app start: tells the server what this phone's saved choice is. Off: no token. On: the
     * current token, or none when the system's permission has been taken away since.
     * Network errors are left to the caller: the next start tries again.
     */
    resume: (token: TokenSource) =>
      serial(async () => {
        if (await savedOff()) {
          await sendToken("");
          return "off" as const;
        }
        const t = await token();
        await sendToken(t ?? "");
        return t ? ("on" as const) : ("off" as const);
      }),
  };
}
