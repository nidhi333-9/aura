// Helpers for "Download my data". The download can't be a plain link, because the API wants the
// login token in a header, so the page fetches the file itself and then hands it to the browser.

// Hands data to the browser as a file download.
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers need the address to stay valid for a moment after the click.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

// Today's date as 2026-10-05, in the person's own time zone (not UTC), for a file name.
export const localDateStamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// 34504458 -> "32.9 MB"
export const readableSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// With responseType "blob", an error answer's body is a Blob too, so the server's message has to be
// read out of it. Falls back to `fallback` when the server did not answer or said nothing useful.
export const errorMessageOf = async (err, fallback) => {
  const body = err.response?.data;
  try {
    const text = body instanceof Blob ? await body.text() : typeof body === "string" ? body : "";
    const message = text ? JSON.parse(text).error : null;
    if (typeof message === "string" && message) return message;
  } catch {
    // not JSON: use the fallback
  }
  return fallback;
};
