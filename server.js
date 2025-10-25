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

const SEARCH_HOST = "https://my-rest-apis-six.vercel.app";
const GOODNESS_API = "https://api.goodnesstechhost.xyz/download/youtube/audio?url=";

// Helper to parse JSON safely
async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

// 🎵 Search Endpoint
app.get("/api/search", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Query required" });

  try {
    // If user entered a direct YouTube link
    if (query.includes("youtube.com") || query.includes("youtu.be")) {
      console.log("🎯 Direct YouTube URL detected, hitting GoodnessTech...");
      const apiRes = await fetch(`${GOODNESS_API}${encodeURIComponent(query)}`);
      const data = await safeJson(apiRes);

      if (!data?.result?.download_url) {
        throw new Error("No direct download link found for that video.");
      }

      return res.json({
        success: true,
        results: [
          {
            title: data.result.title || "Audio",
            url: query,
            downloadUrl: data.result.download_url,
            thumbnail: data.result.thumbnail || "",
          },
        ],
      });
    }

    // Otherwise, normal search first
    const searchRes = await fetch(`${SEARCH_HOST}/yts?query=${encodeURIComponent(query)}`);
    const searchData = await safeJson(searchRes);

    if (!searchData?.results?.length) {
      throw new Error("No results found for that search.");
    }

    const firstVideo = searchData.results[0];
    const videoUrl = firstVideo.url;

    console.log(`🎬 Found video: ${firstVideo.title}`);

    // Now call GoodnessTech directly for download link
    const downloadRes = await fetch(`${GOODNESS_API}${encodeURIComponent(videoUrl)}`);
    const downloadData = await safeJson(downloadRes);

    if (!downloadData?.result?.download_url) {
      throw new Error("Download link not available.");
    }

    // Merge both results nicely
    return res.json({
      success: true,
      results: [
        {
          title: firstVideo.title,
          url: videoUrl,
          thumbnail: firstVideo.thumbnail,
          downloadUrl: downloadData.result.download_url,
        },
      ],
    });
  } catch (err) {
    console.error("❌ Search/Download error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Simple download endpoint for consistency (optional)
app.get("/api/download", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const apiRes = await fetch(`${GOODNESS_API}${encodeURIComponent(url)}`);
    const data = await safeJson(apiRes);

    if (!data?.result?.download_url) {
      throw new Error("No downloadable link found.");
    }

    res.json({
      success: true,
      downloads: [
        {
          type: "mp3",
          title: data.result.title,
          url: data.result.download_url,
        },
      ],
    });
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Makamesco Downloader running at http://localhost:${PORT}`);
});
