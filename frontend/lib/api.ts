export type ChatPayload = {
  repo_id: string;
  query: string;
};

export async function sendChat(payload: ChatPayload) {
  const res = await fetch(`/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to call backend.");
  }

  return res.json();
}
