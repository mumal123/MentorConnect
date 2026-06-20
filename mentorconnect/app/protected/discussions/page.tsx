import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { loadDirectChatHub } from "@/lib/chat";
import { MessageSquare } from "lucide-react";

function formatTime(value: string | null) {
  if (!value) return "No messages yet";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function DiscussionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const directChats = await loadDirectChatHub(supabase, user.id);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-2xl font-semibold">Direct Chats</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          One-to-one messaging between each mentee and their mentor. Mentee-to-mentee chat is blocked.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm">Your direct chats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {directChats.directChats.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-muted-foreground">{directChats.emptyState}</div>
            ) : (
              directChats.directChats.map((chat) => (
                <Link key={chat.threadId} href={chat.href} className="block rounded-xl border p-4 transition-colors hover:bg-accent/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{chat.title}</p>
                        <Badge variant="outline">{chat.badge}</Badge>
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
            <CardTitle className="font-mono text-sm">Access rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-xl border p-3">
              <p className="font-medium text-foreground">Mentee behavior</p>
              <p className="mt-1">A mentee only sees the assigned mentor thread. No separate mentee-to-mentee threads are exposed.</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="font-medium text-foreground">Mentor behavior</p>
              <p className="mt-1">Mentors see one direct chat per active mentee allocation.</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="font-medium text-foreground">Group chat</p>
              <p className="mt-1">Open the Group Chats section to talk inside each mentor room.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
