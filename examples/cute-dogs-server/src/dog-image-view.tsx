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

const styles = {
  container: { padding: "20px", fontFamily: "system-ui, sans-serif" },
  image: {
    maxWidth: "100%",
    height: "auto",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    marginBottom: "15px",
  },
  breedLabel: { fontSize: "18px", marginBottom: "15px" },
  buttonRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "15px",
    flexWrap: "wrap" as const,
  },
  button: (disabled = false) => ({
    padding: "10px 20px",
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    backgroundColor: disabled ? "#ccc" : "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
  }),
  buttonSuccess: (disabled = false) => ({
    padding: "10px 20px",
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    backgroundColor: disabled ? "#ccc" : "#28a745",
    color: "white",
    border: "none",
    borderRadius: "4px",
    textTransform: "capitalize" as const,
  }),
  imagesSection: { marginTop: "20px" },
  imagesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "15px",
  },
  thumbnailImage: {
    width: "100%",
    height: "auto",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    objectFit: "cover" as const,
  },
  errorMessage: { marginTop: "15px", fontSize: "13px", color: "#666" },
};

/**
 * Extract images from tool result (structuredContent or content)
 */
const extractImages = (result: {
  structuredContent?: unknown;
  content?: Array<{ type: string; text?: string }>;
}): string[] => {
  if (result.structuredContent && typeof result.structuredContent === "object") {
    const data = result.structuredContent as { images?: string[] };
    return data.images || [];
  }
  const textContent = result.content?.find((c) => c.type === "text");
  if (textContent?.text) {
    try {
      const parsed = JSON.parse(textContent.text) as { images?: string[] };
      return parsed.images || [];
    } catch {
      return [];
    }
  }
  return [];
};

export function DogImageViewApp() {
  const [dogImageUrl, setDogImageUrl] = useState<string | null>(null);
  const [dogBreed, setDogBreed] = useState<string | null>(null);
  const [moreImages, setMoreImages] = useState<string[]>([]);
  const [loadingMoreImages, setLoadingMoreImages] = useState(false);
  const [hasFetchedMoreImages, setHasFetchedMoreImages] = useState(false);

  const { app } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (toolResult) => {
        const data = toolResult.structuredContent as {
          message?: string;
          breed?: string;
        };
        if (data.message && data.breed) {
          setDogImageUrl(data.message);
          setDogBreed(data.breed);
          setMoreImages([]);
          setHasFetchedMoreImages(false);
        }
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
          setHasFetchedMoreImages(true);
          return;
        }

        const newImages = extractImages(result);
        setMoreImages((prev) => [...prev, ...newImages]);
        setHasFetchedMoreImages(true);
      } catch (e) {
        console.error("Failed to fetch more images:", e);
        setHasFetchedMoreImages(true);
      } finally {
        setLoadingMoreImages(false);
      }
    },
    [app],
  );

  const imageCount = moreImages.length;

  return (
    <div style={styles.container}>
      <h1>Show Dog Image</h1>
      {dogImageUrl && dogBreed && (
        <div>
          <img src={dogImageUrl} alt={dogBreed} style={styles.image} />
          <p style={styles.breedLabel}>
            <strong>Breed:</strong> {dogBreed}
          </p>
          <div style={styles.buttonRow}>
            <button
              onClick={openDogBreedLink}
              style={styles.button()}
            >
              Open Dog Breed Link
            </button>
            <button
              onClick={() => handleGetMoreImages(dogBreed)}
              disabled={loadingMoreImages}
              style={styles.buttonSuccess(loadingMoreImages)}
            >
              {loadingMoreImages
                ? "Loading more images..."
                : imageCount > 0
                  ? `Load 3 More ${dogBreed} Images (${imageCount} shown)`
                  : `Show More ${dogBreed} Images`}
            </button>
          </div>
          {moreImages.length > 0 && (
            <div style={styles.imagesSection}>
              <strong style={{ display: "block", marginBottom: "15px" }}>
                More {dogBreed} Images ({imageCount} total):
              </strong>
              <div style={styles.imagesGrid}>
                {moreImages.map((imageUrl, index) => (
                  <img
                    key={`${imageUrl}-${index}`}
                    src={imageUrl}
                    alt={`${dogBreed} ${index + 1}`}
                    style={styles.thumbnailImage}
                  />
                ))}
              </div>
            </div>
          )}
          {hasFetchedMoreImages && moreImages.length === 0 && (
            <div style={styles.errorMessage}>Failed to load more images.</div>
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

  createRoot(root).render(<DogImageViewApp />);
});
