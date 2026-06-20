"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function getMessageText(formData: FormData) {
  const raw = formData.get("message_body");
  if (typeof raw !== "string") {
    return "";
  }

  return raw.trim();
}

export async function sendChatMessage(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const threadId = formData.get("thread_id");
  const threadType = formData.get("thread_type");
  const messageBody = getMessageText(formData);

  if (typeof threadId !== "string" || typeof threadType !== "string") {
    return { success: false, error: "Invalid chat thread." };
  }

  if (!messageBody) {
    return { success: false, error: "Write a message before sending." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "You must be logged in." };
  }

  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select("id, thread_type, mentor_id, mentee_id, group_id")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    return { success: false, error: threadError.message };
  }

  if (!thread || thread.thread_type !== threadType) {
    return { success: false, error: "Chat thread not found." };
  }

  const { error: insertError } = await supabase.from("chat_messages").insert({
    thread_id: thread.id,
    sender_id: user.id,
    body: messageBody,
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  if (thread.thread_type === "direct" && thread.mentee_id) {
    const directPath = `/protected/discussions/direct/${thread.mentor_id}/${thread.mentee_id}`;
    revalidatePath("/protected/discussions");
    revalidatePath(directPath);
  }

  if (thread.thread_type === "group" && thread.group_id) {
    const groupPath = `/protected/mentor-rooms/group/${thread.group_id}`;
    revalidatePath("/protected/mentor-rooms");
    revalidatePath(groupPath);
  }

  return { success: true };
}
