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
app.use(express.static(path.join(__dirname, "public"))); // Serve frontend files

// ✅ SEARCH ENDPOINT (uses your working search API)
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

// 🎵 DOWNLOAD ENDPOINT (uses GoodnessTech + Noobs APIs)
app.get("/api/download", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  const endpoints = [
    `https://api.goodnesstechhost.xyz/download/youtube/audio?url=${encodeURIComponent(url)}`,
    `https://noobs-api.top/dipto/ytDl3?link=${encodeURIComponent(url)}&format=mp3`
  ];

  try {
    const results = await Promise.all(
      endpoints.map(async (api) => {
        try {
          const resp = await fetch(api, { timeout: 25000 });
          const data = await resp.json();

          // ✅ GoodnessTech API structure
          if (data?.result?.url) {
            return {
              type: "mp3",
              title: data.result.title || "Audio Track",
              url: data.result.url
            };
          }

          // ✅ Noobs API structure
          if (data?.downloadUrl || data?.downloadLink || data?.url) {
            return {
              type: "mp3",
              title: data.title || "Audio Track",
              url: data.downloadUrl || data.downloadLink || data.url
            };
          }

          return null;
        } catch (error) {
          console.error(`Error from ${api}:`, error.message);
          return null;
        }
      })
    );

    const valid = results.filter(Boolean);

    if (!valid.length) {
      return res.status(404).json({ error: "No downloadable links found" });
    }

    res.json({ success: true, downloads: valid });
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Makamesco Downloader running at http://localhost:${PORT}`);
});
