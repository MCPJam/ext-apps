/**
 * @file App that displays a random dog image from the Dog CEO API via MCP tool.
 */
import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type {
  CallToolResult,
  Implementation,
} from "@modelcontextprotocol/sdk/types.js";

const APP_INFO: Implementation = {
  name: "Show Dog Image App",
  version: "1.0.0",
};

export function ShowDogImageApp() {
  const [dogImageUrl, setDogImageUrl] = useState<string | null>(null);
  const [dogBreed, setDogBreed] = useState<string | null>(null);

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
      };
    },
  });

  const openDogBreedLink = useCallback(async () => {
    if (!app) return;
    await app.sendOpenLink({
      url: `https://www.google.com/search?q=${dogBreed}`,
    });
  }, [app, dogBreed]);

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Show Dog Image</h1>
      {dogImageUrl && dogBreed && (
        <div>
          <img src={dogImageUrl} alt={dogBreed} />
          <p>Breed: {dogBreed}</p>
          <button onClick={openDogBreedLink}>Open Dog Breed Link</button>
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
