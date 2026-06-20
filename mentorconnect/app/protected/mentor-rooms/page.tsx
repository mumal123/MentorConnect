import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { loadGroupChatHub } from "@/lib/chat";
import { Users } from "lucide-react";

function formatTime(value: string | null) {
  if (!value) return "No messages yet";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function MentorRoomsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const groupChats = await loadGroupChatHub(supabase, user.id);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-2xl font-semibold">Group Chats</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Group chats follow the mentor room structure. Only the mentor and mentees assigned to that room can post.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm">Your group chats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {groupChats.groupChats.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-muted-foreground">{groupChats.emptyState}</div>
            ) : (
              groupChats.groupChats.map((chat) => (
                <Link key={chat.threadId} href={chat.href} className="block rounded-xl border p-4 transition-colors hover:bg-accent/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{chat.title}</p>
                        <Badge variant="secondary">{chat.badge}</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{chat.subtitle}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{chat.participantCount} participants</p>
                      <p>{formatTime(chat.lastMessageAt)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm">Room rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-xl border p-3">
              <p className="font-medium text-foreground">Mentor control</p>
              <p className="mt-1">Each group chat belongs to a mentor room and inherits the active mentor assignment.</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="font-medium text-foreground">Mentee membership</p>
              <p className="mt-1">Only mentees in the active mentor group can view and post messages.</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="font-medium text-foreground">No peer DMs</p>
              <p className="mt-1">Mentees cannot open conversations with other mentees through this system.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
