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

// 🔹 Search endpoint (YouTube search)
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

// 🔹 MP3/Audio download endpoint supporting multiple Keith endpoints
app.get("/api/download", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  const endpoints = [
    "audio",
    "ytmp3",
    "dlmp3",
    "yta",
    "ytv",
    "ytv2"
  ];

  try {
    // Fetch all endpoints in parallel
    const results = await Promise.all(
      endpoints.map(async (type) => {
        const apiRes = await fetch(`https://apis-keith.vercel.app/download/${type}?url=${encodeURIComponent(url)}`);
        const data = await apiRes.json();
        if (!data?.result?.url) return null;
        return {
          type,
          title: data.result.title || "audio",
          url: data.result.url
        };
      })
    );

    // Filter out failed results
    const validResults = results.filter(r => r !== null);

    if (!validResults.length) {
      return res.status(500).json({ error: "No downloadable links found" });
    }

    // Return all available links
    res.json({
      success: true,
      downloads: validResults
    });
  } catch (err) {
    console.error("MP3 download error:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

