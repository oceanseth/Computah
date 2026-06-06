/**
 * Deepgram prerecorded transcription. We record an audio clip on-device and
 * POST the raw bytes to Deepgram's REST API. (The desktop app streams live;
 * chunked prerecorded is the pragmatic, reliable path on mobile.)
 */
export async function transcribe(audioUri: string, deepgramKey: string): Promise<string> {
  // Read the recorded file as a blob to send as the request body.
  const fileRes = await fetch(audioUri);
  const blob = await fileRes.blob();

  const params = new URLSearchParams({
    model: "nova-2",
    smart_format: "true",
    punctuate: "true",
  });

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${deepgramKey}`,
      "Content-Type": blob.type || "audio/m4a",
    },
    body: blob,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Deepgram ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const transcript: string =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return transcript.trim();
}
