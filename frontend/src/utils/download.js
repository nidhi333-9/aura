export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

export const localDateStamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const readableSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const errorMessageOf = async (err, fallback) => {
  const body = err.response?.data;
  try {
    const text =
      body instanceof Blob
        ? await body.text()
        : typeof body === "string"
          ? body
          : "";
    const message = text ? JSON.parse(text).error : null;
    if (typeof message === "string" && message) return message;
  } catch {
    // not JSON: use the fallback
  }
  return fallback;
};
