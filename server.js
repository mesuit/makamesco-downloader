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

const SEARCH_API_1 = "https://my-rest-apis-six.vercel.app/yts";
const SEARCH_API_2 = "https://piped.video/api/v1/search"; // ✅ new clean backup search

// Safe responder
async function safeFetchJson(url) {
  try {
    const res = await fetch(url);
    try { return await res.json(); }
    catch { return { raw: await res.text() }; }
  } catch { return null; }
}

// ✅ SEARCH (NEW FALLBACK LOGIC)
app.get("/api/search", async (req, res) => {
  const q = (req.query?.query || "").trim();
  if (!q) return res.status(400).json({ error: "Query required" });

  const qEncoded = encodeURIComponent(q);

  // Clean API calls
  const tries = [
    `${SEARCH_API_1}?query=${qEncoded}`,
    `${SEARCH_API_2}?q=${qEncoded}` // ✅ piped search fallback
  ];

  for (const url of tries) {
    const data = await safeFetchJson(url);
    if (data && Object.keys(data).length) {
      return res.json(data);
    }
  }

  return res.status(500).json({ error: "Search failed — try another query" });
});

// ✅ PARSE LINKS SAFELY
function extractUrl(obj) {
  if (!obj) return null;
  return [
    obj.url, obj.download, obj.downloadUrl,
    obj?.result?.url, obj?.result?.download,
    obj.raw
  ].find(v => typeof v === "string" && v.startsWith("http"));
}

// ✅ DOWNLOAD
app.get("/api/download", async (req, res) => {
  const rawUrl = (req.query?.url || "").trim();
  if (!rawUrl) return res.status(400).json({ error: "URL required" });

  const yt = rawUrl.includes("youtube")
    ? rawUrl
    : `https://www.youtube.com/watch?v=${rawUrl}`;

  const enc = encodeURIComponent(yt);

  const engines = [
    `https://apiskeith.vercel.app/download/ytmp3?url=${enc}`,
    `https://apiskeith.vercel.app/download/audio?url=${enc}`,
    `https://apiskeith.vercel.app/download/ytv?url=${enc}`,
    `https://my-rest-apis-six.vercel.app/download?url=${enc}`,
    `https://my-rest-apis-six.vercel.app/ytmp3?url=${enc}`
  ];

  for (const ep of engines) {
    const data = await safeFetchJson(ep);

    const url = extractUrl(data);
    if (url) {
      return res.json({
        success: true,
        title: data?.title || data?.result?.title || "Video",
        url,
        source: ep
      });
    }
  }

  return res.status(404).json({ error: "No download link found" });
});

// ✅ Serve UI
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.listen(PORT, () =>
  console.log(`✅ Makamesco downloader running @ :${PORT}`)
);
