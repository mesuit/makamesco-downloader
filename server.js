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

// ✅ Safe JSON parser
async function safeJson(r) {
  try { return await r.json(); }
  catch {
    try { return { raw: await r.text() }; }
    catch { return null; }
  }
}

// ✅ SEARCH - Works Perfectly
app.get("/api/search", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Query required" });

  try {
    const resp = await fetch(`${SEARCH_HOST}/yts?query=${encodeURIComponent(query)}`);
    const data = await safeJson(resp);
    return res.json(data);
  } catch (err) {
    console.error("Search Error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

// ✅ Extract valid download URL safely
function getDownload(data) {
  if (!data) return null;

  const links = [
    data?.url,
    data?.download,
    data?.downloadUrl,
    data?.result?.url,
    data?.result?.download,
    data?.raw
  ];

  const link = links.find(l => typeof l === "string" && l.startsWith("http"));
  if (!link) return null;

  return {
    title: data?.title || data?.result?.title || "Audio / Video",
    url: link
  };
}

// ✅ DOWNLOAD
app.get("/api/download", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  const yt = url.includes("youtube") || url.includes("youtu.be")
    ? url
    : `https://www.youtube.com/watch?v=${url}`;

  const enc = encodeURIComponent(yt);

  // APIS YOU ASKED FOR ✅
  const apiskeith = [
    `https://apiskeith.vercel.app/download/audio?url=${enc}`,
    `https://apiskeith.vercel.app/download/ytmp3?url=${enc}`,
    `https://apiskeith.vercel.app/download/mp3?url=${enc}`,
    `https://apiskeith.vercel.app/download/ytv?url=${enc}`,
    `https://apiskeith.vercel.app/download/ytv?url=${enc}`
  ];

  // Little backup fail-safe
  const backup = [
    `${SEARCH_HOST}/download?url=${enc}`,
    `${SEARCH_HOST}/ytmp3?url=${enc}`
  ];

  const endpoints = [...apiskeith, ...backup];

  const callEndpoint = async (u) => {
    try {
      const resp = await Promise.race([
        fetch(u).then(r => safeJson(r).then(data => ({ ok: true, ep: u, data }))),
        new Promise(res => setTimeout(() => res({ ok: false, ep: u, timeout: true }), 12000))
      ]);

      if (!resp.ok || !resp.data) return null;

      const media = getDownload(resp.data);
      if (!media) return null;

      return { ...media, source: resp.ep };

    } catch {
      return null;
    }
  };

  try {
    const results = await Promise.all(endpoints.map(callEndpoint));
    const valid = results.filter(Boolean);
    const unique = [...new Map(valid.map(x => [x.url, x])).values()];

    if (!unique.length) return res.status(404).json({ error: "No download links found" });

    return res.json({ success: true, downloads: unique });

  } catch (e) {
    console.error("Download Error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Serve UI
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.listen(PORT, () =>
  console.log(`✅ Makamesco Downloader running on http://localhost:${PORT}`)
);
