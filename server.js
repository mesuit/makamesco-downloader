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
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SEARCH_HOST = "https://my-rest-apis-six.vercel.app";

// safe json
async function safeJson(r) {
  try { return await r.json(); }
  catch {
    try { return { raw: await r.text() }; }
    catch { return null; }
  }
}

// SEARCH
app.get("/api/search", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Query required" });

  try {
    const data = await safeJson(await fetch(`${SEARCH_HOST}/yts?query=${encodeURIComponent(query)}`));
    return res.json(data);
  } catch (err) {
    console.error("Search Error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

// normalize extracted media link
function getDownload(data) {
  const url =
    data?.url ||
    data?.download ||
    data?.downloadUrl ||
    data?.result?.url ||
    data?.result?.download ||
    data?.raw;

  if (!url) return null;
  if (typeof url === "string" && url.startsWith("http")) {
    return { title: data?.title || data?.result?.title || "Media", url };
  }
  return null;
}

// DOWNLOAD
app.get("/api/download", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  let yt = url.includes("youtube") ? url : `https://www.youtube.com/watch?v=${url}`;
  const enc = encodeURIComponent(yt);

  const apiskeith = [
    `https://apiskeith.vercel.app/download/audio?url=${enc}`,
    `https://apiskeith.vercel.app/download/ytmp3?url=${enc}`,
    `https://apiskeith.vercel.app/download/mp3?url=${enc}`,
    `https://apiskeith.vercel.app/download/ytv?url=${enc}`,
    `https://apiskeith.vercel.app/download/ytv?url=${enc}`
  ];

  const backup = [
    `${SEARCH_HOST}/download?url=${enc}`,
    `${SEARCH_HOST}/ytmp3?url=${enc}`
  ];

  const endpoints = [...apiskeith, ...backup];

  const api = async (u) => {
    return Promise.race([
      fetch(u).then(async r => ({ ok: true, ep: u, data: await safeJson(r) })),
      new Promise(res => setTimeout(() => res({ ok: false, ep: u, timeout: true }), 12000))
    ]);
  };

  try {
    const results = await Promise.all(endpoints.map(api));

    const found = [];
    for (const r of results) {
      if (!r.ok || !r.data) continue;
      const item = getDownload(r.data);
      if (item) { item.source = r.ep; found.push(item); }
    }

    const unique = [...new Map(found.map(x => [x.url, x])).values()];

    if (unique.length) return res.json({ success: true, downloads: unique });

    return res.status(404).json({ error: "No links found" });
  } catch (e) {
    console.error("DL Error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.listen(PORT, () =>
  console.log(`✅ Makamesco Downloader running on port ${PORT}`)
);
