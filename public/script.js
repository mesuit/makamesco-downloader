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
    const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.results || data.results.length === 0)
      throw new Error("No results found.");

    const video = data.results[0];
    const videoUrl = video.url;

    resultContainer.innerHTML = `
      <div class="result">
        <img class="thumbnail" src="${video.thumbnail}" alt="Thumbnail"/>
        <h2>${video.title}</h2>
        <div id="downloadButtons"></div>
        <div id="audioPlayer" style="margin-top:10px;"></div>
      </div>
    `;

    await fetchDownloads(videoUrl);
    addShareOption(video.title, videoUrl);

  } catch (err) {
    console.error(err);
    errorMsg.textContent = "❌ " + err.message;
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "🔍 Search";
  }
}

// ✅ Fetch Download Links
async function fetchDownloads(videoUrl) {
  const buttons = document.getElementById("downloadButtons");
  const player = document.getElementById("audioPlayer");
  const errorMsg = document.getElementById("errorMsg");

  buttons.innerHTML = "";
  player.innerHTML = "";

  try {
    const res = await fetch(`/api/download?url=${encodeURIComponent(videoUrl)}`);
    const data = await res.json();

    if (!data.success) throw new Error("No download links found.");

    const downloads = data.downloads || [data]; // support single / many

    downloads.forEach(d => {
      const link = d.url;
      if (!link) return;

      // 🔥 Guess file type
      let label = "Download";
      if (link.includes(".mp3") || link.includes("audio")) label = "MP3";
      if (link.includes(".mp4") || link.includes("video")) label = "MP4";

      const dlBtn = document.createElement("button");
      dlBtn.textContent = `⬇ ${label}`;
      dlBtn.onclick = () => window.open(link, "_blank");

      const playBtn = document.createElement("button");
      playBtn.textContent = "▶ Play";
      playBtn.onclick = () => {
        player.innerHTML = `
          <audio controls autoplay>
            <source src="${link}" type="audio/mp3">
          </audio>`;
      };

      buttons.appendChild(dlBtn);
      buttons.appendChild(playBtn);
    });

  } catch (err) {
    console.error(err);
    errorMsg.textContent = "❌ " + err.message;
  }
}

// 🔥 Trending Suggestions
const trendingSongs = [
  "Not Like Us - Kendrick Lamar","Water - Tyla","Calm Down - Rema",
  "Flowers - Miley Cyrus","Perfect - Ed Sheeran","Husn - Anuv Jain",
  "Unavailable - Davido","People - Libianca","Rush - Ayra Starr"
];

window.onload = () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  const t = document.getElementById("trendingContainer");
  trendingSongs.forEach(song => {
    let div = document.createElement("div");
    div.textContent = song;
    div.className = "trending-item";
    div.onclick = () => searchVideo(song);
    t.appendChild(div);
  });
};

// 📤 Share
function addShareOption(title, url) {
  const box = document.getElementById("resultContainer");
  const btn = document.createElement("button");
  btn.textContent = "🔗 Share";
  btn.onclick = async () => {
    if (navigator.share) {
      return navigator.share({ title, text: `Listen to ${title}`, url });
    }
    navigator.clipboard.writeText(url);
    alert("🔗 Link copied!");
  };
  box.appendChild(btn);
}
