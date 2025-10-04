async function searchVideo() {
  const query = document.getElementById("ytQuery").value.trim();
  const resultContainer = document.getElementById("resultContainer");
  const errorMsg = document.getElementById("errorMsg");

  resultContainer.innerHTML = "";
  errorMsg.textContent = "";

  if (!query) {
    errorMsg.textContent = "❌ Please enter a search term.";
    return;
  }

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
        <div class="info">
          <h2>${video.title}</h2>
          <div class="download-buttons" id="downloadButtons"></div>
          <div class="audio-player" id="audioPlayer" style="margin-top:10px;"></div>
        </div>
      </div>
    `;

    // Fetch available download options from backend
    await fetchDownloads(videoUrl);
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "❌ " + err.message;
  }
}

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
      // Download button
      const downloadBtn = document.createElement("button");
      downloadBtn.textContent = `⬇ ${d.type.toUpperCase()}`;
      downloadBtn.onclick = () => {
        window.open(d.url, "_blank");
      };

      // Play button (only for audio)
      const playBtn = document.createElement("button");
      playBtn.textContent = "▶ Play";
      playBtn.onclick = () => {
        audioPlayerDiv.innerHTML = `
          <audio controls autoplay>
            <source src="${d.url}" type="audio/mp3">
            Your browser does not support the audio element.
          </audio>
        `;
      };

      downloadButtonsDiv.appendChild(downloadBtn);
      downloadButtonsDiv.appendChild(playBtn);
    });

  } catch (err) {
    console.error(err);
    errorMsg.textContent = "❌ " + err.message;
  }
}
