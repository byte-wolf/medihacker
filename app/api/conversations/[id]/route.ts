import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { getConversation, listMessages } from "@/lib/repo";

export async function GET(_request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const conv = getConversation(Number(id), user.id);
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ conversation: conv, messages: listMessages(conv.id) });
}
