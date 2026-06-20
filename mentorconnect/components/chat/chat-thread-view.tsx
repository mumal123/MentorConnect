import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { sendChatMessage } from "@/app/actions/chat";
import { ArrowLeft, Send } from "lucide-react";

type ChatMessageView = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_email: string | null;
  message_body: string;
  created_at: string;
};

type ChatThreadViewProps = {
  backHref: string;
  title: string;
  subtitle: string;
  threadId: string;
  threadType: "direct" | "group";
  currentUserId: string;
  messages: ChatMessageView[];
  emptyLabel: string;
};

function formatMessageTime(createdAt: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(createdAt));
}

export function ChatThreadView({
  backHref,
  title,
  subtitle,
  threadId,
  threadType,
  currentUserId,
  messages,
  emptyLabel,
}: ChatThreadViewProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Badge variant="outline">{threadType === "direct" ? "Direct" : "Group"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-sm">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="max-h-[64vh] space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{emptyLabel}</div>
            ) : (
              messages.map((message) => {
                const isMine = message.sender_id === currentUserId;

                return (
                  <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-2xl border px-4 py-3 ${isMine ? "border-primary/30 bg-primary/10" : "bg-card"}`}>
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{message.sender_name}</span>
                        <span>{formatMessageTime(message.created_at)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.message_body}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form action={sendChatMessage} className="space-y-3 rounded-2xl border bg-background p-3">
            <input type="hidden" name="thread_id" value={threadId} />
            <input type="hidden" name="thread_type" value={threadType} />
            <Textarea name="message_body" rows={3} placeholder="Write a message..." className="resize-none" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Only the assigned mentor, mentee, or group members can post here.</p>
              <Button type="submit" className="gap-2">
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
