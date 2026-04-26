import { list, put } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env";
function localPath(name) {
    return path.join(process.cwd(), "api", "_localdata", name);
}
class LocalStore {
    async recordOrder(o) {
        const dir = localPath("orders");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${o.orderId}.json`), JSON.stringify(o, null, 2));
    }
    async getOrder(orderId) {
        try {
            const p = path.join(localPath("orders"), `${orderId}.json`);
            return JSON.parse(fs.readFileSync(p, "utf-8"));
        }
        catch {
            return null;
        }
    }
    async markEventProcessed(eventId) {
        const p = localPath("events.json");
        let set = new Set();
        if (fs.existsSync(p))
            set = new Set(JSON.parse(fs.readFileSync(p, "utf-8")));
        if (set.has(eventId))
            return false;
        set.add(eventId);
        fs.mkdirSync(localPath(""), { recursive: true });
        fs.writeFileSync(p, JSON.stringify([...set], null, 2));
        return true;
    }
    async decrementInventory(_items) {
        return;
    }
}
class BlobStore {
    async recordOrder(o) {
        await put(`orders/${o.orderId}.json`, JSON.stringify(o), {
            access: "public",
            contentType: "application/json",
            token: ENV.VERCEL_BLOB_RW_TOKEN,
        });
    }
    async getOrder(_orderId) {
        return null; // add a GET endpoint later
    }
    async markEventProcessed(eventId) {
        const prefix = `events/${eventId}`;
        const lst = await list({ prefix, token: ENV.VERCEL_BLOB_RW_TOKEN });
        if (lst.blobs.length)
            return false;
        await put(prefix, "1", { access: "public", contentType: "text/plain", token: ENV.VERCEL_BLOB_RW_TOKEN });
        return true;
    }
    async decrementInventory(_items) {
        return;
    }
}
export function getStore() {
    if (ENV.STORE_BACKEND === "local" || (ENV.STORE_BACKEND === "auto" && ENV.NODE_ENV !== "production")) {
        return new LocalStore();
    }
    return new BlobStore();
}
