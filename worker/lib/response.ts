export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function error(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function notFound(message = "Not found"): Response {
  return error(message, 404);
}

export function methodNotAllowed(): Response {
  return error("Method not allowed", 405);
}

export async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function parseId(pathname: string, prefix: string): number | null {
  const match = pathname.match(new RegExp(`^${prefix.replace(/\//g, "\\/")}/(\\d+)$`));
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
