// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.static(path.join(__dirname, "public"))); // serve frontend

// 🔹 Search endpoint
app.get("/api/search", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Query required" });

  try {
    const apiRes = await fetch(
      `https://my-rest-apis-six.vercel.app/yts?query=${encodeURIComponent(query)}`
    );
    const data = await apiRes.json();
    res.json(data);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🔹 Download endpoint
app.get("/api/download", async (req, res) => {
  const { url, type } = req.query;
  if (!url || !type) return res.status(400).json({ error: "URL and type required" });

  const endpoint =
    type === "audio"
      ? `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(url)}`
      : `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(url)}`;

  try {
    const apiRes = await fetch(endpoint);
    const data = await apiRes.json();
    res.json(data);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
