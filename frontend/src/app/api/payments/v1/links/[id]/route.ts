import type { NextRequest } from "next/server";
import { authError, store, withCors } from "../../_lib";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = authError(req);
  if (auth) return withCors(Response.json(auth.body, { status: auth.code }));
  const { id } = await ctx.params;
  const link = store.links.get(id);
  if (!link) {
    return withCors(
      Response.json(
        { error: { type: "not_found", message: `No link with id ${id}.` } },
        { status: 404 }
      )
    );
  }
  return withCors(Response.json(link));
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
