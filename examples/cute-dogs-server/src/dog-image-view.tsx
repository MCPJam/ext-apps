/**
 * @file App that displays a random dog image from the Dog CEO API via MCP tool.
 */
import "./styles.css";
import { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Loader2 } from "lucide-react";

const APP_INFO: Implementation = {
  name: "Show Dog Image App",
  version: "1.0.0",
};

/**
 * Extract images from tool result (structuredContent or content)
 */
const extractImages = (result: {
  structuredContent?: unknown;
  content?: Array<{ type: string; text?: string }>;
}): string[] => {
  if (
    result.structuredContent &&
    typeof result.structuredContent === "object"
  ) {
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
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        {dogImageUrl && dogBreed ? (
          <div className="space-y-6">
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl capitalize">
                    {dogBreed}
                  </CardTitle>
                  <Button
                    onClick={openDogBreedLink}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Learn More
                  </Button>
                </div>
              </CardHeader>
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={dogImageUrl}
                  alt={dogBreed}
                  className="h-full w-full object-cover"
                />
              </div>
              <CardContent className="pt-4">
                <Button
                  onClick={() => handleGetMoreImages(dogBreed)}
                  disabled={loadingMoreImages}
                  variant="default"
                  size="sm"
                  className="w-full gap-2 capitalize"
                >
                  {loadingMoreImages ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : imageCount > 0 ? (
                    `Load 3 More (${imageCount})`
                  ) : (
                    "Load More Images"
                  )}
                </Button>

                {hasFetchedMoreImages && moreImages.length === 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertDescription>
                      Failed to load more images.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {moreImages.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    More {dogBreed} Images
                  </h2>
                  <Badge variant="secondary">{imageCount} total</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {moreImages.map((imageUrl, index) => (
                    <Card
                      key={`${imageUrl}-${index}`}
                      className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow"
                    >
                      <div className="aspect-square w-full overflow-hidden bg-muted">
                        <img
                          src={imageUrl}
                          alt={`${dogBreed} ${index + 1}`}
                          className="h-full w-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Waiting for dog image...</p>
            </CardContent>
          </Card>
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

  createRoot(root).render(<DogImageViewApp />);
});
