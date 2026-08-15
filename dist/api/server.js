import express from "express";
import crypto from "crypto";
const app = express();
app.use(express.json());
// temporary using in-memory instead postgres for registered endpoints
const registeredEndpoints = new Map();
const handleEndpoint = (req, res) => {
    const { url } = req.body ?? {};
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
    }
    const id = crypto.randomUUID();
    const signingSecret = crypto.randomBytes(32).toString('hex');
    const endpoint = {
        id: id,
        url,
        signingSecret: signingSecret,
        createdAt: new Date(),
        isActive: true
    };
    registeredEndpoints.set(id, endpoint);
    return res.status(201).json({ message: "Endpoint is created", endpoint });
};
app.post('/endpoints', handleEndpoint);
app.get('/', ((req, res) => {
    res.json({ message: "server is running" });
}));
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
//# sourceMappingURL=server.js.map