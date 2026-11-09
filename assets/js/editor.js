(() => {
  "use strict";

  const STORAGE_KEY = "lordship-articles-v1";
  const LEGACY_KEY = "lordship-editor-draft-v1";
  const PUBLISHED_ARTICLES = [
    {
      id: "published-customs-case",
      title: "Lordship: How a Rigging Emergency Became a Fiji Customs Prosecution",
      description: "How a damaged forestay, an emergency diversion to Fiji and a missing Tongan clearance led to a Customs prosecution—and an acquittal.",
      slug: "",
      body: "",
      status: "published",
      publishedUrl: "/",
      publishedAt: "2026-10-28T00:00:00+12:00",
      updatedAt: "2026-10-28T00:00:00+12:00"
    },
    {
      id: "published-neverending-journey",
      title: "The neverending journey",
      description: "",
      slug: "the-neverending-journey",
      body: "",
      status: "published",
      publishedUrl: "/the-neverending-journey/",
      publishedAt: "2026-11-09T00:00:00+12:00",
      updatedAt: "2026-11-09T00:00:00+12:00"
    }
  ];

  const fields = {
    title: document.querySelector("#post-title"),
    description: document.querySelector("#post-description"),
    slug: document.querySelector("#post-slug"),
    body: document.querySelector("#post-body"),
    status: document.querySelector("#post-status")
  };

  const dashboardView = document.querySelector("#dashboard-view");
  const editorView = document.querySelector("#editor-view");
  const articleList = document.querySelector("#article-list");
  const emptyLibrary = document.querySelector("#empty-library");
  const preview = document.querySelector("#preview");
  const wordCount = document.querySelector("#word-count");
  const saveState = document.querySelector("#save-state");
  const toast = document.querySelector("#toast");
  const liveLink = document.querySelector("#live-link");
  const deleteButton = document.querySelector("#delete-post");
  let articles = [];
  let currentId = null;
  let activeFilter = "all";
  let slugWasEdited = false;
  let saveTimer;
  let toastTimer;

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = value || "";
    return node.innerHTML;
  }

  function slugify(value) {
    return value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function newId() {
    return window.crypto?.randomUUID?.() || `article-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function inlineMarkdown(value) {
    let output = escapeHtml(value);
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<img src="$2" alt="$1">');
    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    output = output.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    output = output.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
    return output;
  }

  function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let listType = null;
    let quote = [];
    let code = [];
    let inCode = false;

    const flushParagraph = () => {
      if (paragraph.length) {
        html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    };
    const closeList = () => {
      if (listType) {
        html.push(`</${listType}>`);
        listType = null;
      }
    };
    const flushQuote = () => {
      if (quote.length) {
        html.push(`<blockquote><p>${inlineMarkdown(quote.join(" "))}</p></blockquote>`);
        quote = [];
      }
    };

    lines.forEach((line) => {
      if (/^```/.test(line)) {
        flushParagraph();
        closeList();
        flushQuote();
        if (inCode) {
          html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
          code = [];
          inCode = false;
        } else {
          inCode = true;
        }
        return;
      }

      if (inCode) {
        code.push(line);
        return;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      const blockquote = line.match(/^>\s?(.*)$/);

      if (heading) {
        flushParagraph();
        closeList();
        flushQuote();
        const level = heading[1].length;
        html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      } else if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        flushParagraph();
        closeList();
        flushQuote();
        html.push("<hr>");
      } else if (unordered || ordered) {
        flushParagraph();
        flushQuote();
        const nextType = unordered ? "ul" : "ol";
        if (listType !== nextType) {
          closeList();
          listType = nextType;
          html.push(`<${listType}>`);
        }
        html.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
      } else if (blockquote) {
        flushParagraph();
        closeList();
        quote.push(blockquote[1]);
      } else if (!line.trim()) {
        flushParagraph();
        closeList();
        flushQuote();
      } else {
        closeList();
        flushQuote();
        paragraph.push(line.trim());
      }
    });

    flushParagraph();
    closeList();
    flushQuote();
    if (inCode && code.length) {
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    }
    return html.join("\n");
  }

  function normalizeArticle(article) {
    return {
      id: article.id || newId(),
      title: article.title || "",
      description: article.description || "",
      slug: article.slug || "",
      body: article.body || "",
      status: article.status === "published" ? "published" : "draft",
      publishedUrl: article.publishedUrl || "",
      publishedAt: article.publishedAt || "",
      createdAt: article.createdAt || article.updatedAt || new Date().toISOString(),
      updatedAt: article.updatedAt || new Date().toISOString()
    };
  }

  function loadArticles() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      articles = Array.isArray(saved) ? saved.map(normalizeArticle) : [];
    } catch (error) {
      articles = [];
    }

    PUBLISHED_ARTICLES.forEach((published) => {
      const existing = articles.find((article) => article.id === published.id || (
        article.slug === published.slug && article.status === "published"
      ));
      if (existing) {
        Object.assign(existing, published, {
          body: existing.body || published.body,
          createdAt: existing.createdAt || published.publishedAt,
          updatedAt: existing.updatedAt || published.updatedAt
        });
      } else {
        articles.push(normalizeArticle(published));
      }
    });

    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (legacy && (legacy.title || legacy.body)) {
        const legacySlug = slugify(legacy.slug || legacy.title);
        const match = articles.find((article) => article.slug === legacySlug);
        if (match) {
          match.title = legacy.title || match.title;
          match.description = legacy.description || match.description;
          match.body = legacy.body || match.body;
          match.updatedAt = legacy.savedAt ? new Date(legacy.savedAt).toISOString() : match.updatedAt;
        } else {
          articles.push(normalizeArticle({
            ...legacy,
            slug: legacySlug,
            status: "draft",
            updatedAt: legacy.savedAt ? new Date(legacy.savedAt).toISOString() : new Date().toISOString()
          }));
        }
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch (error) {
      // Leave an unreadable legacy value untouched so it can still be recovered manually.
    }

    saveArticles();
  }

  function saveArticles() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
      saveState.textContent = "Saved on this computer";
    } catch (error) {
      saveState.textContent = "Could not save";
    }
  }

  function currentArticle() {
    return articles.find((article) => article.id === currentId);
  }

  function state() {
    return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]));
  }

  function saveCurrent() {
    const article = currentArticle();
    if (!article) return;
    Object.assign(article, state(), { updatedAt: new Date().toISOString() });
    saveArticles();
    updateEditorMeta();
  }

  function queueSave() {
    saveState.textContent = "Saving…";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveCurrent, 350);
  }

  function formatDate(value) {
    if (!value) return "Not yet saved";
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(new Date(value));
  }

  function renderDashboard() {
    const drafts = articles.filter((article) => article.status === "draft");
    const published = articles.filter((article) => article.status === "published");
    document.querySelector("#draft-count").textContent = drafts.length;
    document.querySelector("#published-count").textContent = published.length;

    const visible = articles
      .filter((article) => activeFilter === "all" || article.status === activeFilter)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    articleList.innerHTML = visible.map((article) => {
      const title = article.title.trim() || "Untitled article";
      const description = article.description.trim() || (
        article.body.trim() ? article.body.trim().replace(/^#+\s*/m, "").slice(0, 150) : "No summary yet."
      );
      const hasEditableCopy = article.status === "draft" || Boolean(article.body);
      return `
        <article class="article-card">
          <button class="article-card-main" type="button" data-open-id="${escapeHtml(article.id)}" ${hasEditableCopy ? "" : "disabled"}>
            <span class="status-badge ${article.status}">${article.status}</span>
            <span class="article-card-copy">
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(description)}</span>
            </span>
            <span class="article-date">${article.status === "published" ? "Published" : "Updated"} ${escapeHtml(formatDate(article.publishedAt || article.updatedAt))}</span>
          </button>
          <div class="article-card-actions">
            ${hasEditableCopy ? `<button type="button" data-open-id="${escapeHtml(article.id)}">Edit</button>` : ""}
            ${article.publishedUrl ? `<a href="${escapeHtml(article.publishedUrl)}" target="_blank" rel="noopener">View live ↗</a>` : ""}
          </div>
        </article>
      `;
    }).join("");

    emptyLibrary.hidden = visible.length > 0;
  }

  function showDashboard() {
    window.clearTimeout(saveTimer);
    saveCurrent();
    currentId = null;
    editorView.hidden = true;
    dashboardView.hidden = false;
    document.querySelectorAll(".editor-only").forEach((element) => { element.hidden = true; });
    document.querySelectorAll(".dashboard-only").forEach((element) => { element.hidden = false; });
    document.title = "Articles · Lordship";
    renderDashboard();
  }

  function openArticle(id) {
    const article = articles.find((item) => item.id === id);
    if (!article) return;
    currentId = article.id;
    fields.title.value = article.title;
    fields.description.value = article.description;
    fields.slug.value = article.slug;
    fields.body.value = article.body;
    fields.status.value = article.status;
    slugWasEdited = Boolean(article.slug);
    dashboardView.hidden = true;
    editorView.hidden = false;
    document.querySelectorAll(".editor-only").forEach((element) => { element.hidden = false; });
    document.querySelectorAll(".dashboard-only").forEach((element) => { element.hidden = true; });
    document.title = `${article.title || "Untitled article"} · Lordship`;
    updatePreview();
    updateEditorMeta();
    fields.title.focus();
  }

  function createArticle(seed = {}) {
    const article = normalizeArticle({
      id: newId(),
      title: "",
      description: "",
      slug: "",
      body: "",
      status: "draft",
      ...seed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    articles.push(article);
    saveArticles();
    openArticle(article.id);
  }

  function updateEditorMeta() {
    const article = currentArticle();
    if (!article) return;
    liveLink.hidden = !article.publishedUrl;
    liveLink.href = article.publishedUrl || "#";
    deleteButton.hidden = article.status !== "draft";
  }

  function updatePreview() {
    const data = state();
    const title = data.title.trim();
    const description = data.description.trim();
    const body = data.body.trim();

    if (!title && !description && !body) {
      preview.innerHTML = '<p class="empty-preview">Your formatted article will appear here.</p>';
    } else {
      preview.innerHTML = [
        title ? `<h1>${escapeHtml(title)}</h1>` : "",
        description ? `<p class="description">${escapeHtml(description)}</p>` : "",
        renderMarkdown(body)
      ].join("");
    }

    const words = data.body.trim() ? data.body.trim().split(/\s+/).length : 0;
    wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
  }

  function yamlString(value) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
  }

  function markdownDocument() {
    const data = state();
    const title = data.title.trim() || "Untitled article";
    const frontMatter = [
      "---",
      "layout: default",
      `title: ${yamlString(title)}`,
      `description: ${yamlString(data.description.trim())}`,
      "---",
      "",
      `# ${title}`,
      ""
    ];
    return `${frontMatter.join("\n")}${data.body.trim()}\n`;
  }

  function localDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function downloadMarkdown() {
    const data = markdownDocument();
    const slug = slugify(fields.slug.value || fields.title.value) || "untitled-article";
    const blob = new Blob([data], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${localDate()}-${slug}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Markdown exported");
  }

  function replaceSelection(before, after = before, placeholder = "text") {
    const input = fields.body;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selection = input.value.slice(start, end) || placeholder;
    input.setRangeText(`${before}${selection}${after}`, start, end, "end");
    if (start === end) {
      input.setSelectionRange(start + before.length, start + before.length + placeholder.length);
    }
    input.focus();
    updatePreview();
    queueSave();
  }

  function prefixLines(prefix) {
    const input = fields.body;
    const value = input.value;
    const start = value.lastIndexOf("\n", input.selectionStart - 1) + 1;
    const nextLine = value.indexOf("\n", input.selectionEnd);
    const end = nextLine === -1 ? value.length : nextLine;
    const selectedLines = value.slice(start, end).split("\n");
    let counter = 1;
    const result = selectedLines.map((line) => {
      const linePrefix = prefix === "1. " ? `${counter++}. ` : prefix;
      return `${linePrefix}${line}`;
    }).join("\n");
    input.setRangeText(result, start, end, "select");
    input.focus();
    updatePreview();
    queueSave();
  }

  function continueList(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    const input = fields.body;
    const lineStart = input.value.lastIndexOf("\n", input.selectionStart - 1) + 1;
    const currentLine = input.value.slice(lineStart, input.selectionStart);
    const match = currentLine.match(/^(\s*)([-*+]|(\d+)[.)])\s+(.*)$/);
    if (!match) return;

    event.preventDefault();
    if (!match[4]) {
      input.setRangeText("", lineStart, input.selectionStart, "end");
    } else {
      const marker = match[3] ? `${Number(match[3]) + 1}.` : match[2];
      input.setRangeText(`\n${match[1]}${marker} `, input.selectionStart, input.selectionEnd, "end");
    }
    updatePreview();
    queueSave();
  }

  function parseFile(contents, filename) {
    let body = contents.replace(/\r\n?/g, "\n");
    let title = "";
    let description = "";
    const frontMatter = body.match(/^---\n([\s\S]*?)\n---\n?/);

    if (frontMatter) {
      frontMatter[1].split("\n").forEach((line) => {
        const match = line.match(/^(title|description):\s*(.*)$/);
        if (!match) return;
        const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
        if (match[1] === "title") title = value;
        if (match[1] === "description") description = value;
      });
      body = body.slice(frontMatter[0].length);
    }

    if (!title) {
      const firstHeading = body.match(/^#\s+(.+)$/m);
      if (firstHeading) title = firstHeading[1].trim();
    }
    if (title) {
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      body = body.replace(new RegExp(`^#\\s+${escapedTitle}\\s*\\n?`, "m"), "").replace(/^\s+/, "");
    }

    createArticle({
      title,
      description,
      slug: filename.replace(/\.markdown?$|^\d{4}-\d{2}-\d{2}-/gi, ""),
      body: body.trim()
    });
    showToast("Markdown imported as a draft");
  }

  Object.values(fields).forEach((field) => {
    field.addEventListener("input", () => {
      if (field === fields.title && !slugWasEdited) {
        fields.slug.value = slugify(fields.title.value);
      }
      if (field === fields.slug) slugWasEdited = true;
      updatePreview();
      queueSave();
    });
  });

  fields.status.addEventListener("change", () => {
    saveCurrent();
    if (fields.status.value === "published" && !currentArticle()?.publishedUrl) {
      showToast("Status saved locally — export the Markdown to put it on the website");
    }
  });

  fields.body.addEventListener("keydown", (event) => {
    continueList(event);
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      replaceSelection("**");
    } else if (key === "i") {
      event.preventDefault();
      replaceSelection("*");
    } else if (key === "k") {
      event.preventDefault();
      replaceSelection("[", "](https://)", "link text");
    } else if (key === "s") {
      event.preventDefault();
      saveCurrent();
      showToast("Article saved in this browser");
    }
  });

  document.querySelector(".toolbar").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.wrap) replaceSelection(button.dataset.wrap);
    if (button.dataset.prefix !== undefined) prefixLines(button.dataset.prefix);
    if (button.hasAttribute("data-link")) replaceSelection("[", "](https://)", "link text");
  });

  document.querySelector("#download").addEventListener("click", downloadMarkdown);
  document.querySelector("#show-dashboard").addEventListener("click", showDashboard);
  document.querySelector("#new-post").addEventListener("click", () => createArticle());

  document.querySelector("#copy-markdown").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(markdownDocument());
      showToast("Markdown copied");
    } catch (error) {
      showToast("Could not access the clipboard");
    }
  });

  document.querySelector("#file-input").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => parseFile(String(reader.result), file.name));
    reader.readAsText(file);
    event.target.value = "";
  });

  document.querySelector("#delete-post").addEventListener("click", () => {
    const article = currentArticle();
    if (!article || article.status !== "draft") return;
    const title = article.title.trim() || "this untitled draft";
    if (!window.confirm(`Delete ${title}? This cannot be undone.`)) return;
    articles = articles.filter((item) => item.id !== article.id);
    saveArticles();
    showDashboard();
    showToast("Draft deleted");
  });

  articleList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-open-id]");
    if (target && !target.disabled) openArticle(target.dataset.openId);
  });

  document.querySelectorAll(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter").forEach((filter) => filter.classList.toggle("active", filter === button));
      renderDashboard();
    });
  });

  loadArticles();
  showDashboard();
})();
