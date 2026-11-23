(() => {
  "use strict";

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = value || "";
    return node.innerHTML;
  }

  function inlineMarkdown(value) {
    const escapedAsterisk = "\uE000";
    const superscriptAsterisk = "\uE001";
    let output = escapeHtml(String(value || "")
      .replace(/\^\\?\*\^|<sup>\s*\^?\\?\*\^?\s*<\/sup>/gi, superscriptAsterisk)
      .replace(/\\\*/g, escapedAsterisk));
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<img src="$2" alt="$1">');
    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    output = output.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    output = output.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
    output = output.replaceAll(escapedAsterisk, "&#42;");
    output = output.replaceAll(superscriptAsterisk, "<sup>&#42;</sup>");
    return output;
  }

  function render(markdown) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let listType = null;
    let quote = [];
    let code = [];
    let inCode = false;

    const flushParagraph = (className = "") => {
      if (paragraph.length) {
        const classAttribute = className ? ` class="${className}"` : "";
        html.push(`<p${classAttribute}>${inlineMarkdown(paragraph.join(" "))}</p>`);
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
      const blockClass = line.match(/^\{:\s+\.([a-z][a-z0-9-]*)\s*\}$/i);

      if (blockClass && paragraph.length) {
        flushParagraph(blockClass[1]);
      } else if (heading) {
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

  window.LordshipMarkdown = { escapeHtml, render };
})();
