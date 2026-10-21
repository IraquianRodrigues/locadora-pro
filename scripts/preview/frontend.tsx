import { renderToString } from "react-dom/server";
import { PreviewApp } from "./app";
export function renderDesignPreview(location = "/") {
  return (
    "<!doctype html>" +
    renderToString(
      <html
        lang="pt-BR"
        style={{ "--font-ui": "Manrope" } as React.CSSProperties}
      >
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Apex · Prévia visual do painel</title>
          <link rel="stylesheet" href="/style.css" />
          <style>
            {
              "@font-face{font-family:Manrope;src:url('/font.ttf');font-weight:200 800;font-display:swap}.preview-notice{padding:8px 20px;background:#f5e9ed;color:#6b1528;font-size:12px;text-align:center}.preview-notice a{font-weight:bold;text-decoration:underline;margin-left:15px}.admin-sidebar{height:calc(100svh - 35px)}"
            }
          </style>
        </head>
        <body>
          <div id="preview-root">
            <PreviewApp location={location} />
          </div>
          <script type="module" src="/preview.js" />
        </body>
      </html>,
    )
  );
}
