type StorageUploadResponse = {
  url?: unknown;
};

function isHttpUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("http://") || value.startsWith("https://"))
  );
}

function sanitizeFileName(fileName: string | undefined): string | undefined {
  if (!fileName) {
    return undefined;
  }

  const trimmed = fileName.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function uploadBufferToExternalStorage(
  buffer: Buffer,
  options: {
    contentType: string;
    fileName?: string;
  },
): Promise<string | null> {
  const storageUrl = process.env.STORAGE_UPLOAD_URL;
  if (!storageUrl) {
    return null;
  }

  const headers: Record<string, string> = {
    "Content-Type": options.contentType || "application/octet-stream",
  };
  const requestBody = new Uint8Array(buffer);
  const sanitizedFileName = sanitizeFileName(options.fileName);
  if (sanitizedFileName) {
    headers["X-File-Name"] = sanitizedFileName;
  }

  const maxAttempts = 4;
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(storageUrl, {
        method: "POST",
        headers,
        body: requestBody,
      });

      if (!response.ok) {
        lastError = new Error(`Upload failed, status=${response.status}`);
        if (response.status >= 500 && response.status < 600) {
          throw lastError;
        }
        return null;
      }

      const json = (await response.json().catch(() => null)) as
        | StorageUploadResponse
        | null;
      if (isHttpUrl(json?.url)) {
        return json.url;
      }

      lastError = new Error("Storage did not return a valid public URL");
      return null;
    } catch (error) {
      lastError = error;
      attempt += 1;
    }
  }

  console.error("Upload failed after retries", lastError);
  return null;
}