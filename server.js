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
app.use(express.static(path.join(__dirname, "public")));

const SEARCH_HOST = "https://my-rest-apis-six.vercel.app"; // your working search host

// Helper to safely parse JSON with fallback
async function safeJson(resp) {
  try {
    return await resp.json();
  } catch (e) {
    try {
      const txt = await resp.text();
      return { raw: txt };
    } catch {
      return null;
    }
  }
}

// Normalize a response object into { type, title, url } or null
function normalizePossibleResult(data) {
  if (!data) return null;

  // direct fields
  const maybeUrl =
    data?.result?.download_url ||
    data?.result?.downloadUrl ||
    data?.result?.url ||
    data?.downloadLink ||
    data?.downloadUrl ||
    data?.url ||
    data?.raw; // raw could be direct url string

  if (!maybeUrl) return null;

  // If raw is text and contains a URL, try to extract
  if (typeof maybeUrl === "string" && (maybeUrl.startsWith("http://") || maybeUrl.startsWith("https://"))) {
    return {
      type: "mp3",
      title: data?.result?.title || data?.title || "Audio Track",
      url: maybeUrl
    };
  }

  // If maybeUrl is an object with url property
  if (typeof maybeUrl === "object" && (maybeUrl.url || maybeUrl.link)) {
    return {
      type: "mp3",
      title: data?.result?.title || data?.title || "Audio Track",
      url: maybeUrl.url || maybeUrl.link
    };
  }

  return null;
}

// SEARCH endpoint (unchanged)
app.get("/api/search", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Query required" });

  try {
    const apiRes = await fetch(`${SEARCH_HOST}/yts?query=${encodeURIComponent(query)}`);
    const data = await safeJson(apiRes);
    return res.json(data);
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

// DOWNLOAD endpoint (tries GoodnessTech, Noobs, and probes my-rest-apis-six)
app.get("/api/download", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  // Build a full youtube url if user supplied an id
  let ytUrl = url;
  if (!ytUrl.includes("youtube.com") && !ytUrl.includes("youtu.be")) {
    // crude attempt to build: if they passed an id or v=ID
    const v = url.includes("v=") ? url.split("v=")[1].split("&")[0] : url;
    ytUrl = `https://www.youtube.com/watch?v=${v}`;
  }

  // Primary endpoints
  const endpoints = [
    { name: "GoodnessTech", url: `https://api.goodnesstechhost.xyz/download/youtube/audio?url=${encodeURIComponent(ytUrl)}` },
    { name: "Noobs", url: `https://noobs-api.top/dipto/ytDl3?link=${encodeURIComponent(ytUrl)}&format=mp3` }
  ];

  // Additional probes on your own host (try several plausible routes)
  const probePaths = ["/ytmp3", "/ytmp4", "/download", "/ytdl", "/download/audio", "/download?url="];
  probePaths.forEach(p => {
    // construct path carefully: some endpoints expect query param 'url'
    const pathUrl = p.includes("?") ? `${SEARCH_HOST}${p}${encodeURIComponent(ytUrl)}` : `${SEARCH_HOST}${p}?url=${encodeURIComponent(ytUrl)}`;
    endpoints.push({ name: `SearchHost:${p}`, url: pathUrl });
  });

  try {
    // Run all endpoints in parallel but map to { name, data } (use timeout via Promise.race)
    const fetchWithTimeout = (url, name, timeout = 25000) => {
      return Promise.race([
        fetch(url).then(async r => {
          const j = await safeJson(r);
          return { name, ok: true, data: j, status: r.status };
        }),
        new Promise(resolve => setTimeout(() => resolve({ name, ok: false, error: "timeout" }), timeout))
      ]);
    };

    const promises = endpoints.map(ep => fetchWithTimeout(ep.url, ep.name));
    const responses = await Promise.all(promises);

    // Normalize responses into possible results
    const possibleResults = responses.map(r => {
      if (!r || !r.ok) return null;
      const normalized = normalizePossibleResult(r.data);
      if (normalized) {
        normalized._source = r.name;
        normalized._status = r.status;
      }
      return normalized;
    }).filter(Boolean);

    // If we already have one or more results, respond
    if (possibleResults.length) {
      // deduplicate by URL
      const seen = new Set();
      const unique = possibleResults.filter(p => {
        if (seen.has(p.url)) return false;
        seen.add(p.url);
        return true;
      });

      return res.json({ success: true, downloads: unique });
    }

    // If not found, include the raw responses in logs and return 404 with useful debug hint
    console.log("Download probe responses (no usable url):");
    responses.forEach(r => console.log(r.name, r.ok ? r.status : "failed/timeout", r.data ? (JSON.stringify(r.data).slice(0,200)) : r.error));

    return res.status(404).json({ error: "No downloadable links found from probes. Check logs for details." });
  } catch (err) {
    console.error("Download endpoint error:", err);
    return res.status(500).json({ error: "Download failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Makamesco Downloader running at http://localhost:${PORT}`);
});
