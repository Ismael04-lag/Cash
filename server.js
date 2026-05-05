const express = require("express");
const cors = require("cors");
const { kv } = require("@vercel/kv");

const app = express();
app.use(cors());
app.use(express.json());

const CASH_PREFIX = "cash:";

function extractCash(raw) {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Number(parsed.cash) || 0;
        } catch (e) {
            return Number(raw) || 0;
        }
    }
    if (typeof raw === 'object' && raw !== null) {
        return Number(raw.cash) || 0;
    }
    return 0;
}

app.get("/", (req, res) => {
    res.json({ message: "Cash API opérationnelle", version: "stable-1.0" });
});

app.get("/api/cash/top", async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    try {
        const keys = await kv.keys(`${CASH_PREFIX}*`);
        const users = [];
        for (const key of keys) {
            const userId = key.replace(CASH_PREFIX, "");
            const raw = await kv.get(key);
            const cash = extractCash(raw);
            users.push({ userId, cash });
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
        const cash = extractCash(raw);
        res.json({ success: true, data: { userId, cash } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/cash/:userId", async (req, res) => {
    const { userId } = req.params;
    const { cash } = req.body;
    if (cash === undefined || isNaN(Number(cash))) {
        return res.status(400).json({ success: false, error: "Montant cash invalide" });
    }
    try {
        await kv.set(`${CASH_PREFIX}${userId}`, Number(cash));
        res.json({ success: true, data: { userId, cash: Number(cash) } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/cash/:userId/add", async (req, res) => {
    const { userId } = req.params;
    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: "Montant invalide" });
    }
    try {
        const raw = await kv.get(`${CASH_PREFIX}${userId}`);
        const current = extractCash(raw);
        const newCash = current + Number(amount);
        await kv.set(`${CASH_PREFIX}${userId}`, newCash);
        res.json({ success: true, data: { userId, cash: newCash } });
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
        const current = extractCash(raw);
        if (current < Number(amount)) {
            return res.status(400).json({ success: false, error: "Solde insuffisant" });
        }
        const newCash = current - Number(amount);
        await kv.set(`${CASH_PREFIX}${userId}`, newCash);
        res.json({ success: true, data: { userId, cash: newCash } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;