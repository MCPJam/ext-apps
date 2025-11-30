import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolResult,
  ReadResourceResult,
  Resource,
} from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load HTML file from dist directory
 */
export const loadHtml = async (name: string): Promise<string> => {
  const htmlPath = path.join(distDir, `${name}.html`);
  return fs.readFile(htmlPath, "utf-8");
};

/**
 * Create an error result for tool calls
 */
export const createErrorResult = (
  error: unknown,
  message: string,
): CallToolResult => {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: error instanceof Error ? error.message : message,
        }),
      },
    ],
    isError: true,
  };
};


// ============================================================================
// Dog CEO API Helpers
// ============================================================================

interface DogApiResponse {
  status: string;
  message: string | string[];
}

/**
 * Fetch a random dog image (optionally for a specific breed)
 */
export const fetchRandomDogImage = async (
  breed?: string,
): Promise<{ message: string; breed: string }> => {
  const apiUrl = breed
    ? `https://dog.ceo/api/breed/${encodeURIComponent(breed)}/images/random`
    : "https://dog.ceo/api/breeds/image/random";

  const response = await fetch(apiUrl);
  const data = (await response.json()) as DogApiResponse;

  if (data.status !== "success" || !data.message) {
    throw new Error("Failed to fetch dog image");
  }

  const dogBreed = (data.message as string).split("/")[4];
  return { message: data.message as string, breed: dogBreed };
};

/**
 * Fetch all dog breeds
 */
export const fetchAllBreeds = async (): Promise<string[]> => {
  const response = await fetch("https://dog.ceo/api/breeds/list/all");
  const data = (await response.json()) as DogApiResponse;

  if (data.status !== "success" || typeof data.message !== "object") {
    throw new Error("Failed to fetch breeds");
  }

  return Object.keys(data.message);
};

/**
 * Fetch multiple random images for a breed
 */
export const fetchBreedImages = async (
  breed: string,
  count: number,
): Promise<string[]> => {
  const apiUrl = `https://dog.ceo/api/breed/${encodeURIComponent(breed)}/images/random/${count}`;
  const response = await fetch(apiUrl);
  const data = (await response.json()) as DogApiResponse;

  if (data.status !== "success" || !Array.isArray(data.message)) {
    throw new Error("Failed to fetch images");
  }

  return data.message;
};

// ============================================================================
// Resource Registration
// ============================================================================

/**
 * Register a UI resource with the server
 */
export const registerResource = (
  server: McpServer,
  resource: Resource,
  htmlContent: string,
): Resource => {
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


