/**
 * @file App that displays a random dog image from the Dog CEO API via MCP tool.
 */
import { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { Implementation } from "@modelcontextprotocol/sdk/types.js";

const APP_INFO: Implementation = {
  name: "Show Dog Image App",
  version: "1.0.0",
};

export function ShowDogImageApp() {
  const [dogImageUrl, setDogImageUrl] = useState<string | null>(null);
  const [dogBreed, setDogBreed] = useState<string | null>(null);
  const [moreImages, setMoreImages] = useState<string[]>([]);
  const [loadingMoreImages, setLoadingMoreImages] = useState<boolean>(false);
  const [hasFetchedMoreImages, setHasFetchedMoreImages] =
    useState<boolean>(false);
  const [imageCount, setImageCount] = useState<number>(0);

  const { app } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (toolResult) => {
        const toolResultData = toolResult.structuredContent as {
          message: string;
          breed: string;
        };
        setDogImageUrl(toolResultData.message);
        setDogBreed(toolResultData.breed);
        setMoreImages([]);
        setHasFetchedMoreImages(false);
        setImageCount(0);
      };
    },
  });

  const openDogBreedLink = useCallback(async () => {
    if (!app) return;
    await app.sendOpenLink({
      url: `https://www.google.com/search?q=${dogBreed}`,
    });
  }, [app, dogBreed]);

  const handleGetMoreImages = useCallback(
    async (breed: string) => {
      if (!app || !breed) return;

      setLoadingMoreImages(true);
      try {
        const result = await app.callServerTool({
          name: "get-more-images",
          arguments: { breed, count: 3 },
        });

        if (result.isError) {
          setLoadingMoreImages(false);
          setHasFetchedMoreImages(true);
          return;
        }

        // Extract images from structuredContent or content
        let imagesData: string[] = [];
        if (
          result.structuredContent &&
          typeof result.structuredContent === "object"
        ) {
          const data = result.structuredContent as { images?: string[] };
          imagesData = data.images || [];
        } else if (result.content && result.content.length > 0) {
          const textContent = result.content.find((c) => c.type === "text");
          if (textContent && typeof textContent.text === "string") {
            const parsed = JSON.parse(textContent.text) as {
              images?: string[];
            };
            imagesData = parsed.images || [];
          }
        }

        // Append new images to existing ones
        setMoreImages((prev) => [...prev, ...imagesData]);
        setImageCount((prev) => prev + imagesData.length);
        setLoadingMoreImages(false);
        setHasFetchedMoreImages(true);
      } catch (e) {
        console.error("Failed to fetch more images:", e);
        setLoadingMoreImages(false);
        setHasFetchedMoreImages(true);
      }
    },
    [app],
  );

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Show Dog Image</h1>
      {dogImageUrl && dogBreed && (
        <div>
          <img
            src={dogImageUrl}
            alt={dogBreed}
            style={{
              maxWidth: "100%",
              height: "auto",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              marginBottom: "15px",
            }}
          />
          <p style={{ fontSize: "18px", marginBottom: "15px" }}>
            <strong>Breed:</strong> {dogBreed}
          </p>
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "15px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={openDogBreedLink}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                cursor: "pointer",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Open Dog Breed Link
            </button>
            <button
              onClick={() => handleGetMoreImages(dogBreed)}
              disabled={loadingMoreImages}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                cursor: loadingMoreImages ? "not-allowed" : "pointer",
                backgroundColor: loadingMoreImages ? "#ccc" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                textTransform: "capitalize",
              }}
            >
              {loadingMoreImages
                ? "Loading more images..."
                : imageCount > 0
                  ? `Load 3 More ${dogBreed} Images (${imageCount} shown)`
                  : `Show More ${dogBreed} Images`}
            </button>
          </div>
          {moreImages.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <strong style={{ display: "block", marginBottom: "15px" }}>
                More {dogBreed} Images ({imageCount} total):
              </strong>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "15px",
                }}
              >
                {moreImages.map((imageUrl, index) => (
                  <img
                    key={`${imageUrl}-${index}`}
                    src={imageUrl}
                    alt={`${dogBreed} ${index + 1}`}
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: "8px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      objectFit: "cover",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {hasFetchedMoreImages && moreImages.length === 0 && (
            <div style={{ marginTop: "15px", fontSize: "13px", color: "#666" }}>
              Failed to load more images.
            </div>
          )}
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

  createRoot(root).render(<ShowDogImageApp />);
});
