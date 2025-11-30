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

export function ShowAllBreedsApp() {
  const [breeds, setBreeds] = useState<string[]>([]);
  const [selectedBreed, setSelectedBreed] = useState<string | null>(null);

  const { app } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (toolResult) => {
        const toolResultData = toolResult.structuredContent as {
          breeds?: string[];
        };
        if (toolResultData.breeds) {
          setBreeds(toolResultData.breeds);
        }
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
          content: [
            {
              type: "text",
              text: `Show me a ${breed}`,
            },
          ],
        });
      } catch (e) {
        console.error("Failed to send message:", e);
      }
    },
    [app],
  );

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>All Dog Breeds</h1>
      <p style={{ marginBottom: "20px", color: "#666" }}>
        Click on a breed to show it in the chat
      </p>
      {selectedBreed && (
        <div
          style={{
            padding: "10px",
            marginBottom: "20px",
            backgroundColor: "#e3f2fd",
            borderRadius: "4px",
            color: "#1976d2",
          }}
        >
          Selected: <strong>{selectedBreed}</strong> - Message sent to chat!
        </div>
      )}
      {breeds.length === 0 ? (
        <div style={{ padding: "20px", color: "#666" }}>
          Waiting for breeds data...
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: "10px",
            maxHeight: "600px",
            overflowY: "auto",
          }}
        >
          {breeds.map((breed) => (
            <button
              key={breed}
              onClick={() => handleBreedClick(breed)}
              style={{
                padding: "12px 16px",
                fontSize: "14px",
                cursor: "pointer",
                backgroundColor:
                  selectedBreed === breed ? "#1976d2" : "#f5f5f5",
                color: selectedBreed === breed ? "white" : "#333",
                border: "1px solid #ddd",
                borderRadius: "4px",
                textTransform: "capitalize",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (selectedBreed !== breed) {
                  e.currentTarget.style.backgroundColor = "#e0e0e0";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedBreed !== breed) {
                  e.currentTarget.style.backgroundColor = "#f5f5f5";
                }
              }}
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

  createRoot(root).render(<ShowAllBreedsApp />);
});
