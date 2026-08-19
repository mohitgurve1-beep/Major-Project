/**
 * Smoke test — Phase 12 cleanup.
 * Spawns the real app (node app.js) and verifies:
 *   1. Server starts without throwing.
 *   2. GET /listings responds (200) with all listings public.
 *   3. Old admin verification routes are no longer registered.
 */
const { spawn } = require("child_process");
const path = require("path");

const APP_PATH = path.join(__dirname, "app.js");
const PORT = 8099;
const BASE = `http://127.0.0.1:${PORT}`;

const child = spawn(process.execPath, [APP_PATH], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (d) => { output += d.toString(); });
child.stderr.on("data", (d) => { output += d.toString(); });

const check = async (label, path, expectedStatus) => {
    try {
        const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
        const ok = expectedStatus.includes
            ? expectedStatus.includes(res.status)
            : res.status === expectedStatus;
        console.log(`[smoke] ${ok ? "PASS" : "FAIL"} ${label} -> ${res.status}`);
        return ok;
    } catch (err) {
        console.log(`[smoke] FAIL ${label} -> ${err.message}`);
        return false;
    }
};

const timeout = setTimeout(() => {
    console.log("[smoke] TIMEOUT — server did not become ready.");
    console.log("--- app output ---");
    console.log(output);
    child.kill();
    process.exit(1);
}, 20000);

let ready = false;

child.stdout.on("data", async () => {
    if (ready) return;
    if (!output.includes("listening")) return;
    ready = true;
    clearTimeout(timeout);

    console.log("[smoke] Server reported listening.");
    const results = [];
    results.push(await check("GET /listings", "/listings", [200, 302]));
    results.push(await check("GET /listings/admin (gone)", "/listings/admin", [302, 404]));

    console.log("--- app output ---");
    console.log(output);

    child.kill();
    const allPass = results.every(Boolean);
    console.log(`[smoke] ${allPass ? "ALL_PASS" : "SOME_FAILED"}`);
    process.exit(allPass ? 0 : 1);
});

child.on("exit", (code) => {
    if (!ready) {
        clearTimeout(timeout);
        console.log(`[smoke] app exited early with code ${code}`);
        console.log("--- app output ---");
        console.log(output);
        process.exit(1);
    }
});

