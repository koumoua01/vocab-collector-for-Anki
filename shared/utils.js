export function sanitizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
