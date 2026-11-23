(() => {
  "use strict";

  const STORAGE_KEY = "lordship-articles-v1";
  const articleId = new URLSearchParams(window.location.search).get("id");
  const preview = document.querySelector("#draft-preview");
  const previewState = document.querySelector("#preview-state");
  const publishedLink = document.querySelector("#published-link");
  const { escapeHtml, render } = window.LordshipMarkdown;

  function getArticle() {
    try {
      const articles = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(articles) ? articles.find((article) => article.id === articleId) : null;
    } catch (error) {
      return null;
    }
  }

  function draw() {
    const article = getArticle();
    if (!article) {
      preview.innerHTML = "<h1>Draft not found</h1><p>Return to the editor and open the preview again.</p>";
      previewState.textContent = "Draft unavailable";
      publishedLink.hidden = true;
      return;
    }

    const title = String(article.title || "").trim();
    const description = String(article.description || "").trim();
    const body = String(article.body || "").trim();
    preview.innerHTML = [
      title ? `<h1>${escapeHtml(title)}</h1>` : "",
      description ? `<p>${escapeHtml(description)}</p>` : "",
      render(body)
    ].join("") || "<p>This draft is empty.</p>";
    document.title = `${title || "Draft preview"} · Preview`;
    previewState.textContent = `Autosaved ${new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(article.updatedAt || Date.now()))}`;
    publishedLink.hidden = !article.publishedUrl;
    publishedLink.href = article.publishedUrl || "#";
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) draw();
  });
  draw();
})();
