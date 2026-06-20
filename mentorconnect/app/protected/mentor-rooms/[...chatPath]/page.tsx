import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatThreadView } from "@/components/chat/chat-thread-view";
import { loadGroupThreadPage } from "@/lib/chat";

export default async function GroupThreadPage({
  params,
}: {
  params: Promise<{ chatPath: string[] }>;
}) {
  const { chatPath } = await params;

  if (chatPath.length !== 2 || chatPath[0] !== "group") {
    notFound();
  }

  const groupId = chatPath[1];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const thread = await loadGroupThreadPage(supabase, user.id, groupId);

  return (
    <ChatThreadView
      backHref={thread.backHref}
      title={thread.threadTitle}
      subtitle={thread.threadSubtitle}
      threadId={thread.thread.id}
      threadType={thread.thread.thread_type}
      currentUserId={user.id}
      messages={thread.messages}
      emptyLabel="Start the group conversation by sending the first message."
    />
  );
}
