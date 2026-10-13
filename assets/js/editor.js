(() => {
  "use strict";

  const STORAGE_KEY = "lordship-editor-draft-v1";
  const fields = {
    title: document.querySelector("#post-title"),
    description: document.querySelector("#post-description"),
    slug: document.querySelector("#post-slug"),
    body: document.querySelector("#post-body")
  };

  const preview = document.querySelector("#preview");
  const wordCount = document.querySelector("#word-count");
  const saveState = document.querySelector("#save-state");
  const toast = document.querySelector("#toast");
  let slugWasEdited = false;
  let saveTimer;
  let toastTimer;

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = value;
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

  function state() {
    return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]));
  }

  function updatePreview() {
    const data = state();
    const title = data.title.trim();
    const description = data.description.trim();
    const body = data.body.trim();

    if (!title && !description && !body) {
      preview.innerHTML = '<p class="empty-preview">Your formatted post will appear here.</p>';
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

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state(), savedAt: Date.now() }));
      saveState.textContent = "Saved locally";
    } catch (error) {
      saveState.textContent = "Could not save";
    }
  }

  function queueSave() {
    saveState.textContent = "Saving…";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 350);
  }

  function loadDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;
      Object.entries(fields).forEach(([key, field]) => {
        field.value = saved[key] || "";
      });
      slugWasEdited = Boolean(saved.slug);
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2200);
  }

  function yamlString(value) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
  }

  function markdownDocument() {
    const data = state();
    const title = data.title.trim() || "Untitled post";
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
    const slug = slugify(fields.slug.value || fields.title.value) || "untitled-post";
    const date = localDate();
    const blob = new Blob([data], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${date}-${slug}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Markdown downloaded");
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
        const value = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
        if (match[1] === "title") title = value;
        if (match[1] === "description") description = value;
      });
      body = body.slice(frontMatter[0].length);
    }

    if (!title) {
      const firstHeading = body.match(/^#\s+(.+)$/m);
      if (firstHeading) {
        title = firstHeading[1].trim();
        body = body.replace(firstHeading[0], "").replace(/^\s+/, "");
      }
    }

    fields.title.value = title;
    fields.description.value = description;
    fields.slug.value = filename.replace(/\.markdown?$|^\d{4}-\d{2}-\d{2}-/gi, "");
    fields.body.value = body.trim();
    slugWasEdited = true;
    updatePreview();
    saveDraft();
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
      saveDraft();
      showToast("Draft saved in this browser");
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

  document.querySelector("#new-post").addEventListener("click", () => {
    const hasContent = Object.values(fields).some((field) => field.value.trim());
    if (hasContent && !window.confirm("Clear this draft and start a new post?")) return;
    Object.values(fields).forEach((field) => { field.value = ""; });
    slugWasEdited = false;
    localStorage.removeItem(STORAGE_KEY);
    updatePreview();
    saveDraft();
    fields.title.focus();
  });

  loadDraft();
  updatePreview();
})();
