/**
 * @file App that displays a random dog image from the Dog CEO API via MCP tool.
 */
import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { Implementation } from "@modelcontextprotocol/sdk/types.js";

const APP_INFO: Implementation = {
  name: "Random Dog App",
  version: "1.0.0",
};

interface DogApiResponse {
  message: string;
  status: string;
}

export function RandomDogApp() {
  const [dogImageUrl, setDogImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [breed, setBreed] = useState<string>("");

  const { app, isConnected, error: appError } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
  });

  const fetchDog = useCallback(async (breedParam?: string) => {
    if (!app || !isConnected) return;

    setLoading(true);
    setError(null);
    try {
      const result = await app.callServerTool({
        name: "get-dog-image",
        arguments: breedParam ? { breed: breedParam } : {},
      });

      if (result.isError) {
        setError("Failed to fetch dog image");
        return;
      }

      // Extract the message from structuredContent or content
      let data: DogApiResponse | null = null;
      if (result.structuredContent && typeof result.structuredContent === "object") {
        data = result.structuredContent as unknown as DogApiResponse;
      } else if (result.content && result.content.length > 0) {
        const textContent = result.content.find((c) => c.type === "text");
        if (textContent && typeof textContent.text === "string") {
          data = JSON.parse(textContent.text) as DogApiResponse;
        }
      }

      if (data && data.status === "success" && data.message) {
        setDogImageUrl(data.message);
      } else {
        setError("Failed to fetch dog image");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch dog image");
    } finally {
      setLoading(false);
    }
  }, [app, isConnected]);

  useEffect(() => {
    if (isConnected && app) {
      fetchDog();
    }
  }, [isConnected, app, fetchDog]);

  if (appError) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        Error connecting: {appError.message}
      </div>
    );
  }

  if (!isConnected) {
    return <div style={{ padding: "20px" }}>Connecting...</div>;
  }

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Random Dog</h1>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Breed (optional):
        </label>
        <input
          type="text"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          placeholder="e.g., hound, retriever, husky"
          style={{
            padding: "8px",
            fontSize: "14px",
            width: "300px",
            marginRight: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <button
          onClick={() => fetchDog(breed.trim() || undefined)}
          disabled={loading}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            cursor: loading ? "not-allowed" : "pointer",
            backgroundColor: loading ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          {loading ? "Loading..." : breed.trim() ? `Get ${breed} Dog` : "Get Random Dog"}
        </button>
      </div>

      {error && (
        <div style={{ color: "red", marginBottom: "20px" }}>Error: {error}</div>
      )}

      {dogImageUrl && (
        <div>
          <img
            src={dogImageUrl}
            alt={breed.trim() ? `${breed} dog` : "Random dog"}
            style={{
              maxWidth: "100%",
              height: "auto",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          />
        </div>
      )}
    </div>
  );
}

window.addEventListener("load", () => {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found");
  }

  createRoot(root).render(<RandomDogApp />);
});
