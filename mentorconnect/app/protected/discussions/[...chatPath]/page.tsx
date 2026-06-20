import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatThreadView } from "@/components/chat/chat-thread-view";
import { loadDirectThreadPage } from "@/lib/chat";

export default async function DiscussionThreadPage({
  params,
}: {
  params: Promise<{ chatPath: string[] }>;
}) {
  const { chatPath } = await params;

  if (chatPath.length !== 3 || chatPath[0] !== "direct") {
    notFound();
  }

  const mentorId = chatPath[1];
  const menteeId = chatPath[2];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const thread = await loadDirectThreadPage(supabase, user.id, mentorId, menteeId);

  return (
    <ChatThreadView
      backHref={thread.backHref}
      title={thread.threadTitle}
      subtitle={thread.threadSubtitle}
      threadId={thread.thread.id}
      threadType={thread.thread.thread_type}
      currentUserId={user.id}
      messages={thread.messages}
      emptyLabel="Start this direct conversation by sending the first message."
    />
  );
}
