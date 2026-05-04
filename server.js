const express = require("express");
const cors = require("cors");
const { kv } = require("@vercel/kv");

const app = express();
app.use(cors());
app.use(express.json());

const CASH_PREFIX = "cash:";

app.get("/", (req, res) => {
    res.json({ message: "Cash API opérationnelle", version: "3.1.0" });
});

app.get("/api/cash/top", async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    try {
        const keys = await kv.keys(`${CASH_PREFIX}*`);
        const users = [];
        for (const key of keys) {
            const userId = key.replace(CASH_PREFIX, "");
            const raw = await kv.get(key);
            let cash = 0;
            let name = null;
            if (raw !== null && raw !== undefined) {
                if (typeof raw === "number") {
                    cash = raw;
                } else if (typeof raw === "string") {
                    try {
                        const parsed = JSON.parse(raw);
                        cash = Number(parsed.cash) || 0;
                        name = parsed.name || null;
                    } catch {
                        cash = Number(raw) || 0;
                    }
                } else if (typeof raw === "object") {
                    cash = Number(raw.cash) || 0;
                    name = raw.name || null;
                }
            }
            users.push({ userId, cash, name });
        }
        users.sort((a, b) => b.cash - a.cash);
        res.json({ success: true, data: users.slice(0, limit) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/cash/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const raw = await kv.get(`${CASH_PREFIX}${userId}`);
        let data;
        if (raw === null || raw === undefined) {
            data = { userId, cash: 0, name: null };
        } else if (typeof raw === "number") {
            data = { userId, cash: raw, name: null };
        } else if (typeof raw === "string") {
            try {
                const parsed = JSON.parse(raw);
                data = { userId, cash: Number(parsed.cash) || 0, name: parsed.name || null };
            } catch {
                data = { userId, cash: Number(raw) || 0, name: null };
            }
        } else if (typeof raw === "object") {
            data = { userId, cash: Number(raw.cash) || 0, name: raw.name || null };
        } else {
            data = { userId, cash: 0, name: null };
        }
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/cash/:userId", async (req, res) => {
    const { userId } = req.params;
    const { cash, name } = req.body;
    if (cash === undefined || isNaN(Number(cash))) {
        return res.status(400).json({ success: false, error: "Montant cash invalide" });
    }
    try {
        const data = { cash: String(cash) };
        if (name !== undefined && name !== null) data.name = name;
        await kv.set(`${CASH_PREFIX}${userId}`, JSON.stringify(data));
        const saved = JSON.parse(await kv.get(`${CASH_PREFIX}${userId}`));
        res.json({ success: true, data: { userId, cash: Number(saved.cash), name: saved.name || null } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/cash/:userId/add", async (req, res) => {
    const { userId } = req.params;
    const { amount, name } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: "Montant invalide" });
    }
    try {
        const raw = await kv.get(`${CASH_PREFIX}${userId}`);
        let currentCash = 0;
        let currentName = null;
        if (raw !== null && raw !== undefined) {
            if (typeof raw === "number") {
                currentCash = raw;
            } else if (typeof raw === "string") {
                try {
                    const parsed = JSON.parse(raw);
                    currentCash = Number(parsed.cash) || 0;
                    currentName = parsed.name || null;
                } catch {
                    currentCash = Number(raw) || 0;
                }
            } else if (typeof raw === "object") {
                currentCash = Number(raw.cash) || 0;
                currentName = raw.name || null;
            }
        }
        const newCash = currentCash + Number(amount);
        const data = { cash: String(newCash) };
        if (name !== undefined && name !== null) data.name = name;
        else if (currentName) data.name = currentName;
        await kv.set(`${CASH_PREFIX}${userId}`, JSON.stringify(data));
        res.json({ success: true, data: { userId, cash: newCash, name: data.name || null } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/cash/:userId/subtract", async (req, res) => {
    const { userId } = req.params;
    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: "Montant invalide" });
    }
    try {
        const raw = await kv.get(`${CASH_PREFIX}${userId}`);
        let currentCash = 0;
        let currentName = null;
        if (raw !== null && raw !== undefined) {
            if (typeof raw === "number") {
                currentCash = raw;
            } else if (typeof raw === "string") {
                try {
                    const parsed = JSON.parse(raw);
                    currentCash = Number(parsed.cash) || 0;
                    currentName = parsed.name || null;
                } catch {
                    currentCash = Number(raw) || 0;
                }
            } else if (typeof raw === "object") {
                currentCash = Number(raw.cash) || 0;
                currentName = raw.name || null;
            }
        }
        if (currentCash < Number(amount)) {
            return res.status(400).json({ success: false, error: "Solde insuffisant" });
        }
        const newCash = currentCash - Number(amount);
        const data = { cash: String(newCash) };
        if (currentName) data.name = currentName;
        await kv.set(`${CASH_PREFIX}${userId}`, JSON.stringify(data));
        res.json({ success: true, data: { userId, cash: newCash, name: data.name || null } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;