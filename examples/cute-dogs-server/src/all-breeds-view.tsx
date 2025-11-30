/**
 * @file App that displays all dog breeds and allows selecting one to show in chat.
 */
import "./styles.css";
import { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const APP_INFO: Implementation = {
  name: "Show All Breeds App",
  version: "1.0.0",
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
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Dog Breeds</h1>
          <p className="text-muted-foreground">
            Select a breed to view in chat
          </p>
        </div>

        {selectedBreed && (
          <Alert className="mb-6 border-primary/50 bg-primary/5">
            <AlertDescription className="flex items-center gap-2">
              <Badge variant="default" className="capitalize">
                {selectedBreed}
              </Badge>
              <span className="text-sm">Message sent to chat</span>
            </AlertDescription>
          </Alert>
        )}

        {breeds.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Loading breeds...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {breeds.map((breed) => (
              <Button
                key={breed}
                onClick={() => handleBreedClick(breed)}
                variant={selectedBreed === breed ? "default" : "outline"}
                className="h-auto py-3 px-4 capitalize font-normal transition-all hover:scale-105"
              >
                {breed}
              </Button>
            ))}
          </div>
        )}
      </div>
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
