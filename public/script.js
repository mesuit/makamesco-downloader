async function searchVideo(queryParam) {
  const queryInput = document.getElementById("ytQuery");
  const query = queryParam || queryInput.value.trim();
  const resultContainer = document.getElementById("resultContainer");
  const errorMsg = document.getElementById("errorMsg");
  const searchBtn = document.getElementById("searchBtn");

  resultContainer.innerHTML = "";
  errorMsg.textContent = "";

  if (!query) {
    errorMsg.textContent = "❌ Please enter a search term.";
    return;
  }

  searchBtn.disabled = true;
  searchBtn.textContent = "⏳ Searching...";

  try {
    const searchRes = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const searchJson = await searchRes.json();

    if (!searchJson.results || searchJson.results.length === 0) {
      throw new Error("No results found.");
    }

    const video = searchJson.results[0];
    const videoUrl = video.url;

    resultContainer.innerHTML = `
      <div class="result">
        <img class="thumbnail" src="${video.thumbnail}" alt="Thumbnail"/>
        <h2>${video.title}</h2>
        <div class="download-buttons" id="downloadButtons"></div>
        <div class="audio-player" id="audioPlayer" style="margin-top:10px;"></div>
      </div>
    `;

    // Fetch download links
    await fetchDownloads(videoUrl);

    // Add Share Option
    addShareOption(video.title, videoUrl);
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "❌ " + err.message;
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "🔍 Search";
  }
}

// 🔹 Fetch Downloads (same logic)
async function fetchDownloads(videoUrl) {
  const downloadButtonsDiv = document.getElementById("downloadButtons");
  const audioPlayerDiv = document.getElementById("audioPlayer");
  const errorMsg = document.getElementById("errorMsg");

  downloadButtonsDiv.innerHTML = "";
  audioPlayerDiv.innerHTML = "";

  try {
    const downloadRes = await fetch(`/api/download?url=${encodeURIComponent(videoUrl)}`);
    const downloadJson = await downloadRes.json();

    if (!downloadJson.success || !downloadJson.downloads?.length) {
      throw new Error("No downloadable links found.");
    }

    downloadJson.downloads.forEach(d => {
      const downloadBtn = document.createElement("button");
      downloadBtn.textContent = `⬇ ${d.type.toUpperCase()}`;
      downloadBtn.onclick = () => window.open(d.url, "_blank");

      const playBtn = document.createElement("button");
      playBtn.textContent = "▶ Play";
      playBtn.onclick = () => {
        audioPlayerDiv.innerHTML = `
          <audio controls autoplay>
            <source src="${d.url}" type="audio/mp3">
          </audio>`;
      };

      downloadButtonsDiv.appendChild(downloadBtn);
      downloadButtonsDiv.appendChild(playBtn);
    });

  } catch (err) {
    console.error(err);
    errorMsg.textContent = "❌ " + err.message;
  }
}

// 🎁 Trending Suggestions
const trendingSongs = [
  "Not Like Us - Kendrick Lamar",
  "Water - Tyla",
  "Calm Down - Rema",
  "Flowers - Miley Cyrus",
  "Perfect - Ed Sheeran",
  "Husn - Anuv Jain",
  "Unavailable - Davido",
  "People - Libianca",
  "Rush - Ayra Starr"
];

window.onload = () => {
  const year = new Date().getFullYear();
  document.getElementById("year").textContent = year;

  const trendingContainer = document.getElementById("trendingContainer");
  trendingSongs.forEach(song => {
    const div = document.createElement("div");
    div.textContent = song;
    div.className = "trending-item";
    div.onclick = () => searchVideo(song);
    trendingContainer.appendChild(div);
  });
};

// 📤 Share Option
function addShareOption(title, url) {
  const resultContainer = document.getElementById("resultContainer");
  const shareBtn = document.createElement("button");
  shareBtn.textContent = "🔗 Share";
  shareBtn.onclick = async () => {
    if (navigator.share) {
      await navigator.share({
        title: title,
        text: `Listen to ${title}`,
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      alert("🔗 Link copied to clipboard!");
    }
  };
  resultContainer.appendChild(shareBtn);
}
