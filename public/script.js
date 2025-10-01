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

    // Show the first result
    const video = searchJson.results[0];
    const videoUrl = video.url;

    resultContainer.innerHTML = `
      <div class="result">
        <img class="thumbnail" src="${video.thumbnail}" alt="Thumbnail"/>
        <div class="info">
          <h2>${video.title}</h2>
          <div class="download-buttons">
            <button onclick="downloadMedia('${videoUrl}', 'audio')">⬇ Download MP3</button>
            <button onclick="downloadMedia('${videoUrl}', 'video')">⬇ Download MP4</button>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "❌ " + err.message;
  }
}

async function downloadMedia(videoUrl, type) {
  const resultContainer = document.getElementById("resultContainer");
  const errorMsg = document.getElementById("errorMsg");

  try {
    const downloadRes = await fetch(`/api/download?url=${encodeURIComponent(videoUrl)}&type=${type}`);
    const downloadJson = await downloadRes.json();

    if (!downloadJson.success || !downloadJson.result?.download_url) {
      throw new Error("Download not available.");
    }

    const d = downloadJson.result;

    resultContainer.innerHTML = `
      <div class="result">
        <img class="thumbnail" src="${d.thumbnail}" alt="Thumbnail"/>
        <div class="info">
          <h2>${d.title}</h2>
          <p><strong>Type:</strong> ${d.type}</p>
          <p><strong>Quality:</strong> ${d.quality}</p>
          <a class="download-link" href="${d.download_url}" target="_blank" download>
            ⬇ Download ${type === "audio" ? "MP3" : "MP4"}
          </a>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "❌ " + err.message;
  }
}
