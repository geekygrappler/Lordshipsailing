# Simple GitHub Pages article

A tiny, responsive site for publishing one Markdown article with GitHub Pages.

## Publish it

1. Create a GitHub repository and push these files to its `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`, then click **Save**.

GitHub will publish the site and rebuild it after every push to `main`. The first deployment may take a few minutes. Its URL will normally be:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

## Write the article

Edit [`index.md`](index.md). The lines between `---` markers configure the browser title and search description; the content below them is the article.

The page supports standard Markdown, including headings, links, lists, quotes, images, and code blocks. Put local images in `assets/images/`.

### Browser editor

Open `/admin/` on the published site for a distraction-free Markdown editor. It includes browser spellcheck, formatting buttons, automatic list continuation, live preview, local draft autosave, Markdown import, and Jekyll-ready Markdown export.

Drafts are stored only in the current browser. To publish a downloaded post, add the `.md` file to the repository (use `_posts/` for dated Jekyll posts, or replace `index.md` for the home-page article) and push it to `main`.

## Customize it

- Change the site name and description in `_config.yml`.
- Change colors or typography in `assets/css/style.css`.
- For a user or organization site named `YOUR-USERNAME.github.io`, the same setup works at the root URL.

No local build tools are required. GitHub Pages uses its built-in Jekyll builder.
