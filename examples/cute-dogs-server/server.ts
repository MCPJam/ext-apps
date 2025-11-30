import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import cors from "cors";
import { RESOURCE_URI_META_KEY } from "@modelcontextprotocol/ext-apps";
import {
  loadHtml,
  registerResource,
  fetchRandomDogImage,
  fetchAllBreeds,
  fetchBreedImages,
  createErrorResult,
} from "./helpers.js";

// ============================================================================
// Server Setup
// ============================================================================

/**
 * Create and configure the MCP server
 */
const getServer = async () => {
  const server = new McpServer(
    {
      name: "cute-dogs-mcp-server",
      version: "1.0.0",
      icons: [
        {
          src: "https://dog.ceo/img/dog-api-logo.svg",
          mimeType: "image/svg+xml",
        },
      ],
    },
    {
      capabilities: { logging: {} },
      instructions:
        "This server shows images of dogs. View all dog breeds with the `show-all-breeds` tool and widget. The show-dog-image tool and widget shows the image. The show-dog-image widget can call the `get-more-images` tool to get more images of the same breed.",
    },
  );

  // Load HTML files
  const [showDogImageHtml, showAllBreedsHtml] = await Promise.all([
    loadHtml("show-dog-image"),
    loadHtml("show-all-breeds"),
  ]);

  // Register resources
  const randomDogResource = registerResource(
    server,
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
    server,
    {
      name: "show-all-breeds-template",
      uri: "ui://show-all-breeds",
      title: "Show All Breeds Template",
      description: "A show all breeds UI",
      mimeType: "text/html+mcp",
    },
    showAllBreedsHtml,
  );

  // Register tools
  server.registerTool(
    "show-random-dog-image",
    {
      title: "Show Dog Image",
      description: "Show a dog image in an interactive UI widget. Do not show the image in the text response. The image will be shown in the UI widget.",
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
    async ({ breed }) => {
      try {
        const result = await fetchRandomDogImage(breed);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                message: `Successfully fetched ${breed} image`,
                status: "success",
              }),
            },
          ],
          structuredContent: { ...result, status: "success" },
        };
      } catch (error) {
        return createErrorResult(error, "Failed to fetch dog image");
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
    async () => {
      try {
        const breeds = await fetchAllBreeds();
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ breeds }) }],
          structuredContent: { breeds },
        };
      } catch (error) {
        return createErrorResult(error, "Failed to fetch breeds");
      }
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
          .max(30)
          .optional()
          .default(3)
          .describe(
            "Number of images to fetch (1-30). Defaults to 3 if not provided.",
          ),
      },
    },
    async ({ breed, count = 3 }) => {
      try {
        const images = await fetchBreedImages(breed, count);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ breed, images }),
            },
          ],
          structuredContent: { breed, images },
        };
      } catch (error) {
        return createErrorResult(error, "Failed to fetch images");
      }
    },
  );

  return server;
};

// ============================================================================
// Express Server Setup
// ============================================================================

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
