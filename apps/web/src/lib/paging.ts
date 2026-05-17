import { NextRequest } from "next/server";

// Parses ?limit & ?offset for paginated list endpoints.
// limit defaults to 20, clamped to 1–50; offset defaults to 0.
export function parsePaging(request: NextRequest) {
    const sp = request.nextUrl.searchParams;

    let limit = parseInt(sp.get('limit') ?? '20', 10);
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 50) limit = 50;

    let offset = parseInt(sp.get('offset') ?? '0', 10);
    if (isNaN(offset) || offset < 0) offset = 0;

    return { limit, offset };
}
