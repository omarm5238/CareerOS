export function parseJsonContent<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(content.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}
