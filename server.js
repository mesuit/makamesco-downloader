// server.js - defensive version to prevent `toUpperCase` on undefined
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const SEARCH_HOST = "https://my-rest-apis-six.vercel.app";

// --- Basic middleware
app.use((req, res, next) => {
  // Defensive: ensure method/header strings exist to avoid .toUpperCase errors
  try {
    req.method = (typeof req.method === "string") ? req.method : String(req.method || "");
    // Normalize header keys to strings (but keep original headers)
    const rawHeaders = req.headers || {};
    Object.keys(rawHeaders).forEach(k => {
      if (typeof k !== "string") {
        // ensure keys are string (shouldn't be needed typically)
        rawHeaders[String(k)] = rawHeaders[k];
        delete rawHeaders[k];
      }
    });
    req.headers = rawHeaders;
  } catch (e) {
    // continue anyway
    console.error("Middleware normalization error:", e && e.stack ? e.stack : e);
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// --- Global error handlers (prevent crashing, log stack)
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err && err.stack ? err.stack : err);
});
process.on("unhandledRejection", (reason, p) => {
  console.error("UNHANDLED REJECTION at Promise:", p, "reason:", reason && reason.stack ? reason.stack : reason);
});

// --- Helper: safe JSON parser for fetch responses
async function safeJson(resp) {
  if (!resp) return null;
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

// --- Validate an endpoint URL string before fetching
function isValidHttpUrl(u) {
  if (!u || typeof u !== "string") return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// --- SEARCH (unchanged behavior but defensive)
app.get("/api/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "Query required" });

    const target = `${SEARCH_HOST}/yts?query=${encodeURIComponent(query)}`;
    if (!isValidHttpUrl(target)) {
      return res.status(500).json({ error: "Search host invalid" });
    }

    const resp = await Promise.race([
      fetch(target),
      new Promise(resolve => setTimeout(() => resolve(null), 10000))
    ]);

    if (!resp) return res.status(504).json({ error: "Search timeout" });

    const data = await safeJson(resp);
    return res.json(data);
  } catch (err) {
    console.error("Search endpoint error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Search failed", detail: String(err) });
  }
});

// --- Helper to extract download link safely
function getDownload(data) {
  if (!data || typeof data !== "object") return null;

  // collect candidate fields that may contain a URL or URL-like response
  const candidates = [
    data.url,
    data.download,
    data.downloadUrl,
    data?.result?.download_url,
    data?.result?.downloadUrl,
    data?.result?.url,
    data?.raw
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "string" && (c.startsWith("http://") || c.startsWith("https://"))) {
      return { title: data?.result?.title || data?.title || "Media", url: c };
    }
    // if c is an object with url or link property
    if (typeof c === "object") {
      const u = c.url || c.link || c.href;
      if (typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://"))) {
        return { title: data?.result?.title || data?.title || "Media", url: u };
      }
    }
  }

  return null;
}

// --- DOWNLOAD (defensive)
app.get("/api/download", async (req, res) => {
  try {
    const rawUrl = req.query?.url;
    if (!rawUrl) return res.status(400).json({ error: "URL required" });

    // build youtube url if only id provided
    const yt = (typeof rawUrl === "string" && (rawUrl.includes("youtube") || rawUrl.includes("youtu.be")))
      ? rawUrl
      : `https://www.youtube.com/watch?v=${rawUrl}`;

    // endpoints you specified (encoded)
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

    // filter only valid URLs (defensive)
    const endpoints = [...apiskeith, ...backup].filter(isValidHttpUrl);

    if (!endpoints.length) return res.status(500).json({ error: "No valid endpoints configured" });

    // fetch with timeout and defensive checks
    const fetchWithTimeout = async (endpoint, timeoutMs = 12_000) => {
      if (!isValidHttpUrl(endpoint)) return { ok: false, endpoint, reason: "invalid-url" };
      try {
        const resp = await Promise.race([
          fetch(endpoint),
          new Promise(resolve => setTimeout(() => resolve(null), timeoutMs))
        ]);
        if (!resp) return { ok: false, endpoint, reason: "timeout" };

        const data = await safeJson(resp);
        return { ok: true, endpoint, status: resp.status, data };
      } catch (err) {
        return { ok: false, endpoint, reason: "fetch-error", error: String(err) };
      }
    };

    // run all probes in parallel but safely
    const fetchPromises = endpoints.map(ep => fetchWithTimeout(ep));
    const probeResults = await Promise.all(fetchPromises);

    // parse results defensively
    const found = [];
    for (const r of probeResults) {
      try {
        if (!r || !r.ok || !r.data) continue;
        const media = getDownload(r.data);
        if (!media) continue;
        // ensure url is string
        if (typeof media.url !== "string") continue;
        found.push({ title: media.title, url: media.url, source: r.endpoint });
      } catch (e) {
        // ignore this endpoint but log for debug
        console.warn("Parsing probe result failed for", r?.endpoint, "err:", e && e.stack ? e.stack : e);
      }
    }

    // dedupe by url
    const unique = [];
    const seen = new Set();
    for (const f of found) {
      if (!f || !f.url) continue;
      if (seen.has(f.url)) continue;
      seen.add(f.url);
      unique.push(f);
    }

    if (unique.length) return res.json({ success: true, downloads: unique });

    // no usable links: return probe debug (trimmed)
    const debug = probeResults.map(p => {
      return {
        endpoint: p?.endpoint || null,
        ok: !!p?.ok,
        reason: p?.reason || null,
        status: p?.status || null,
        short: p?.data ? (typeof p.data === "string" ? p.data.slice(0,200) : JSON.stringify(p.data).slice(0,200)) : null
      };
    });

    return res.status(404).json({ error: "No downloadable links found", probes: debug });

  } catch (err) {
    console.error("Download route error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Download failed", detail: String(err) });
  }
});

// serve UI fallback
app.get("/", (req, res) => {
  try {
    return res.sendFile(path.join(__dirname, "public", "index.html"));
  } catch (e) {
    return res.status(500).send("UI not available");
  }
});

// final express error handler (last resort)
app.use((err, req, res, next) => {
  console.error("EXPRESS ERROR HANDLER:", err && err.stack ? err.stack : err);
  res.status(500).json({ error: "Server error", detail: String(err) });
});

app.listen(PORT, () => console.log(`✅ Makamesco Downloader running on http://localhost:${PORT}`));
