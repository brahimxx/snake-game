import { config } from "dotenv";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Handle API routes
  if (url.pathname.startsWith("/api/")) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    try {
      const apiPath = url.pathname.replace("/api/", "");

      if (apiPath.startsWith("highscore/")) {
        const difficulty = apiPath.split("/")[1];
        const modulePath = join(__dirname, "api", "highscore", "difficulty.js");

        // Import the module with cache busting
        const moduleURL = pathToFileURL(modulePath).href + `?t=${Date.now()}`;
        const module = await import(moduleURL);

        // Parse request body if needed
        let body = "";
        if (req.method === "POST") {
          for await (const chunk of req) {
            body += chunk.toString();
          }
        }

        const mockReq = {
          method: req.method,
          body: body ? JSON.parse(body) : undefined,
          query: {
            difficulty,
            ...Object.fromEntries(url.searchParams),
          },
        };

        let responseSent = false;
        const mockRes = {
          status: (code) => ({
            json: (data) => {
              if (!responseSent) {
                responseSent = true;
                res.writeHead(code, {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                  "Access-Control-Allow-Headers": "Content-Type",
                });
                res.end(JSON.stringify(data));
              }
            },
          }),
          json: (data) => {
            if (!responseSent) {
              responseSent = true;
              res.writeHead(200, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
              });
              res.end(JSON.stringify(data));
            }
          },
        };

        await module.default(mockReq, mockRes);
        return;
      }

      // API endpoint not found
      res.writeHead(404, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ error: "API endpoint not found" }));
    } catch (error) {
      res.writeHead(500, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
    return;
  }

  // Serve static files
  const publicPath = join(__dirname, "public");
  const filePath =
    url.pathname === "/" ? join(publicPath, "index.html") : join(publicPath, url.pathname);

  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath);
      const ext = extname(filePath);

      const mimeTypes = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
      };

      const contentType = mimeTypes[ext] || "application/octet-stream";

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
      });
      res.end(content);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
    }
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal server error");
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});