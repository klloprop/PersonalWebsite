import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(file, import.meta.url), "utf8");
const port = 47922;
const liveStyles = `
  const styles = document.getElementById("nimble-live-styles");
  document.documentElement.classList.add("tavern-reference");
  document.documentElement.classList.toggle("dark", new URLSearchParams(location.search).get("theme") !== "light");
  async function refreshStyles() {
    try {
      const response = await fetch("/styles.css", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not read preview stylesheet");
      const css = await response.text();
      if (styles.textContent !== css) styles.textContent = css;
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(refreshStyles, 600);
    }
  }
  refreshStyles();
`;

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, `http://127.0.0.1:${port}`);
  try {
    const headers = { "Cache-Control": "no-store" };
    if (pathname === "/styles.css") {
      const css = await read("styles.css");
      response.writeHead(200, { ...headers, "Content-Type": "text/css; charset=utf-8" }).end(css);
    } else if (pathname === "/") {
      const [bundle, css, tavern] = await Promise.all([
        read("Nimble-Spellbook-Offline.html"), read("styles.css"),
        read("../adorable-accretion/src/styles/nimble-frame.css"),
      ]);
      const bundledStyles = /<style>[\s\S]*?(?=\n:root \{--image-)/;
      if (!bundledStyles.test(bundle)) throw new Error("Could not find the stylesheet in the Nimble bundle");
      const html = bundle
        .replace(bundledStyles, () => `<style id="nimble-live-styles">${css}</style>\n<style>`)
        .replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*)"/, "$1; connect-src 'self'\"")
        .replace("</head>", () => `<style>${tavern}</style>\n<script>${liveStyles}</script>\n</head>`);
      response.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8" }).end(html);
    } else {
      response.writeHead(404).end();
    }
  } catch (error) {
    console.error(error);
    response.writeHead(500).end("Could not open Nimble preview. Check the terminal for details.");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Nimble live CSS preview: http://127.0.0.1:${port}/#character`);
});
