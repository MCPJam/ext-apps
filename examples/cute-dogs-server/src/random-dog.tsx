/**
 * @file App that displays a random dog image from the Dog CEO API.
 */
import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";

interface DogApiResponse {
  message: string;
  status: string;
}

export function RandomDogApp() {
  const [dogImageUrl, setDogImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRandomDog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("https://dog.ceo/api/breeds/image/random");
      const data: DogApiResponse = await response.json();

      if (data.status === "success" && data.message) {
        setDogImageUrl(data.message);
      } else {
        setError("Failed to fetch dog image");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch dog image");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRandomDog();
  }, [fetchRandomDog]);

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Random Dog</h1>

      <button
        onClick={fetchRandomDog}
        disabled={loading}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          marginBottom: "20px",
          cursor: loading ? "not-allowed" : "pointer",
          backgroundColor: loading ? "#ccc" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
        }}
      >
        {loading ? "Loading..." : "Get Random Dog"}
      </button>

      {error && (
        <div style={{ color: "red", marginBottom: "20px" }}>Error: {error}</div>
      )}

      {dogImageUrl && (
        <div>
          <img
            src={dogImageUrl}
            alt="Random dog"
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
