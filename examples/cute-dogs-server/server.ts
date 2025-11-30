import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolResult,
  isInitializeRequest,
  ReadResourceResult,
  Resource,
} from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import cors from "cors";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { RESOURCE_URI_META_KEY } from "@modelcontextprotocol/ext-apps";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load both UI HTML files from dist/
const distDir = path.join(__dirname, "dist");
const loadHtml = async (name: string) => {
  const htmlPath = path.join(distDir, `${name}.html`);
  return fs.readFile(htmlPath, "utf-8");
};

// Create an MCP server with both UI tools
const getServer = async () => {
  const server = new McpServer(
    {
      name: "cute-dogs-mcp-server",
      version: "1.0.0",
    },
    { capabilities: { logging: {} } },
  );

  // Load HTML for both UIs
  const [showDogImageHtml, showAllBreedsHtml] = await Promise.all([
    loadHtml("show-dog-image"),
    loadHtml("show-all-breeds"),
  ]);

  const registerResource = (resource: Resource, htmlContent: string) => {
    server.registerResource(
      resource.name,
      resource.uri,
      resource,
      async (): Promise<ReadResourceResult> => ({
        contents: [
          {
            uri: resource.uri,
            mimeType: resource.mimeType,
            text: htmlContent,
          },
        ],
      }),
    );
    return resource;
  };

  const randomDogResource = registerResource(
    {
      name: "show-random-dog-image-template",
      uri: "ui://show-random-dog-image",
      title: "Show Dog Image Template",
      description: "A show dog image UI",
      mimeType: "text/html+mcp",
    },
    showDogImageHtml,
  );

  const showAllBreedsResource = registerResource(
    {
      name: "show-all-breeds-template",
      uri: "ui://show-all-breeds",
      title: "Show All Breeds Template",
      description: "A show all breeds UI",
      mimeType: "text/html+mcp",
    },
    showAllBreedsHtml,
  );

  server.registerTool(
    "show-random-dog-image",
    {
      title: "Show Dog Image",
      description: "Show a dog image in an interactive UI widget.",
      inputSchema: {
        breed: z
          .string()
          .optional()
          .describe(
            "Optional dog breed (e.g., 'hound', 'retriever'). If not provided, returns a random dog from any breed.",
          ),
      },
      _meta: {
        [RESOURCE_URI_META_KEY]: randomDogResource.uri,
      },
    },
    async ({ breed }): Promise<CallToolResult> => {
      try {
        let apiUrl: string;
        if (breed) {
          // Get random image from specific breed
          apiUrl = `https://dog.ceo/api/breed/${encodeURIComponent(breed)}/images/random`;
        } else {
          // Get completely random dog image
          apiUrl = "https://dog.ceo/api/breeds/image/random";
        }

        const response = await fetch(apiUrl);
        const data = await response.json();
        const dogBreed = data.message.split("/")[4];

        if (data.status === "success" && data.message) {
          return {
            content: [{ type: "text", text: JSON.stringify(data) }],
            structuredContent: { ...data, breed: dogBreed },
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Failed to fetch dog image",
                  status: data.status,
                }),
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "show-all-breeds",
    {
      title: "Show All Breeds",
      description: "Show all breeds in an interactive UI widget.",
      _meta: {
        [RESOURCE_URI_META_KEY]: showAllBreedsResource.uri,
      },
    },
    async (): Promise<CallToolResult> => {
      const response = await fetch("https://dog.ceo/api/breeds/list/all");
      const data = await response.json();
      const breeds = Object.keys(data.message);
      return {
        content: [{ type: "text", text: JSON.stringify({ breeds }) }],
        structuredContent: { breeds },
      };
    },
  );

  server.registerTool(
    "get-more-images",
    {
      title: "Get More Images",
      description:
        "Get multiple random dog images from a specific breed. Returns an array of image URLs.",
      inputSchema: {
        breed: z
          .string()
          .describe(
            "The dog breed name (e.g., 'hound', 'retriever'). Required parameter.",
          ),
        count: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .default(3)
          .describe(
            "Number of images to fetch (1-10). Defaults to 3 if not provided.",
          ),
      },
    },
    async ({ breed, count = 3 }): Promise<CallToolResult> => {
      try {
        const apiUrl = `https://dog.ceo/api/breed/${encodeURIComponent(breed)}/images/random/${count}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status === "success" && Array.isArray(data.message)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ breed, images: data.message }),
              },
            ],
            structuredContent: {
              breed,
              images: data.message,
            },
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Failed to fetch images",
                  status: data.status,
                  message: data.message,
                }),
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
};

const MCP_PORT = process.env.MCP_PORT
  ? parseInt(process.env.MCP_PORT, 10)
  : 3001;

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id"],
  }),
);

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

const mcpPostHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (sessionId) => {
          console.log(`Session initialized: ${sessionId}`);
          transports[sessionId] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Session closed: ${sid}`);
          delete transports[sid];
        }
      };

      const server = await getServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
};

app.post("/mcp", mcpPostHandler);

app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error handling session termination:", error);
    if (!res.headersSent) {
      res.status(500).send("Error processing session termination");
    }
  }
});

app.listen(MCP_PORT, () => {
  console.log(`MCP Server listening on http://localhost:${MCP_PORT}/mcp`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  for (const sessionId in transports) {
    try {
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  process.exit(0);
});
