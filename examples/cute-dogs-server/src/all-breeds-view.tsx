/**
 * @file App that displays all dog breeds and allows selecting one to show in chat.
 */
import { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { Implementation } from "@modelcontextprotocol/sdk/types.js";

const APP_INFO: Implementation = {
  name: "Show All Breeds App",
  version: "1.0.0",
};

const styles = {
  container: { padding: "20px", fontFamily: "system-ui, sans-serif" },
  subtitle: { marginBottom: "20px", color: "#666" },
  selectedBanner: {
    padding: "10px",
    marginBottom: "20px",
    backgroundColor: "#e3f2fd",
    borderRadius: "4px",
    color: "#1976d2",
  },
  waiting: { padding: "20px", color: "#666" },
  breedsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "10px",
    maxHeight: "600px",
    overflowY: "auto" as const,
  },
  breedButton: (isSelected: boolean) => ({
    padding: "12px 16px",
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: isSelected ? "#1976d2" : "#f5f5f5",
    color: isSelected ? "white" : "#333",
    border: "1px solid #ddd",
    borderRadius: "4px",
    textTransform: "capitalize" as const,
    transition: "all 0.2s",
  }),
};

export function AllBreedsViewApp() {
  const [breeds, setBreeds] = useState<string[]>([]);
  const [selectedBreed, setSelectedBreed] = useState<string | null>(null);

  const { app } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (toolResult) => {
        const breeds = (toolResult.structuredContent as { breeds?: string[] })
          ?.breeds;
        if (breeds) setBreeds(breeds);
      };
    },
  });

  const handleBreedClick = useCallback(
    async (breed: string) => {
      if (!app) return;
      setSelectedBreed(breed);
      try {
        await app.sendMessage({
          role: "user",
          content: [{ type: "text", text: `Show me a ${breed}` }],
        });
      } catch (e) {
        console.error("Failed to send message:", e);
      }
    },
    [app],
  );

  return (
    <div style={styles.container}>
      <h1>All Dog Breeds</h1>
      <p style={styles.subtitle}>Click on a breed to show it in the chat</p>
      {selectedBreed && (
        <div style={styles.selectedBanner}>
          Selected: <strong>{selectedBreed}</strong> - Message sent to chat!
        </div>
      )}
      {breeds.length === 0 ? (
        <div style={styles.waiting}>Waiting for breeds data...</div>
      ) : (
        <div style={styles.breedsGrid}>
          {breeds.map((breed) => (
            <button
              key={breed}
              onClick={() => handleBreedClick(breed)}
              style={styles.breedButton(selectedBreed === breed)}
            >
              {breed}
            </button>
          ))}
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

  createRoot(root).render(<AllBreedsViewApp />);
});
