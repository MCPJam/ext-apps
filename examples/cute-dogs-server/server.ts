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
  const [randomDogHtml] = await Promise.all([loadHtml("random-dog")]);

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

  {
    // Tool 1: UI widget tool - loads the interactive UI
    const randomDogResource = registerResource(
      {
        name: "random-dog-template",
        uri: "ui://random-dog",
        title: "Random Dog Template",
        description: "A random dog UI",
        mimeType: "text/html+mcp",
      },
      randomDogHtml,
    );

    server.registerTool(
      "show-random-dog-ui",
      {
        title: "Show Random Dog UI",
        description:
          "Loads an interactive UI widget for browsing random dog images",
        _meta: {
          [RESOURCE_URI_META_KEY]: randomDogResource.uri,
        },
      },
      async (): Promise<CallToolResult> => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({ message: "Random dog UI loaded" }),
          },
        ],
        structuredContent: { message: "Random dog UI loaded" },
      }),
    );
  }

  {
    // Tool 2: Standalone dog image fetcher - no UI, just returns the image data
    server.registerTool(
      "get-dog-image",
      {
        title: "Get Dog Image",
        description:
          "Get a random dog image or a random image from a specific breed. Returns the image URL and metadata.",
        inputSchema: {
          breed: z
            .string()
            .optional()
            .describe(
              "Optional dog breed (e.g., 'hound', 'retriever'). If not provided, returns a random dog from any breed.",
            ),
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

          if (data.status === "success" && data.message) {
            return {
              content: [{ type: "text", text: JSON.stringify(data) }],
              structuredContent: data,
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
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                }),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

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
