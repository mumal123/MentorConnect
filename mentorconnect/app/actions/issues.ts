"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleVote(issueId: string, voteType: 1 | -1) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to vote.");
  }

  // Check if a vote already exists
  const { data: existingVote } = await supabase
    .from("issue_votes")
    .select("vote_type")
    .eq("issue_id", issueId)
    .eq("user_id", user.id)
    .single();

  if (existingVote) {
    if (existingVote.vote_type === voteType) {
      // Un-vote
      const { error } = await supabase
        .from("issue_votes")
        .delete()
        .eq("issue_id", issueId)
        .eq("user_id", user.id);

      if (error) throw new Error("Failed to remove vote: " + error.message);
    } else {
      // Change vote
      const { error } = await supabase
        .from("issue_votes")
        .update({ vote_type: voteType })
        .eq("issue_id", issueId)
        .eq("user_id", user.id);

      if (error) throw new Error("Failed to change vote: " + error.message);
    }
  } else {
    // New vote
    const { error } = await supabase.from("issue_votes").insert({
      issue_id: issueId,
      user_id: user.id,
      vote_type: voteType,
    });

    if (error) throw new Error("Failed to add vote: " + error.message);
  }

  revalidatePath("/issues");
}
