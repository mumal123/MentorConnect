"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Updates the authenticated user's short bio in user_profiles.
 */
export async function updateBio(bio: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ short_bio: bio.trim() || null })
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

/**
 * Toggles the mentor's "is_accepting_mentees" flag.
 */
export async function toggleMentorAvailability(
  isAccepting: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("mentor_ug_pg_profiles")
    .update({ is_accepting_mentees: isAccepting })
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

/**
 * Updates the mentor's mentoring domains list in mentor_ug_pg_profiles.
 */
export async function updateMentoringDomains(
  domains: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "You must be logged in." };
  }

  const cleaned = domains.map((d) => d.trim()).filter(Boolean);

  const { error } = await supabase
    .from("mentor_ug_pg_profiles")
    .update({ mentoring_domains: cleaned })
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

/**
 * Updates the mentee's communication preference.
 */
export async function updateCommunicationPreference(
  preference: "chat" | "call" | "both"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("mentee_profiles")
    .update({ communication_preference: preference })
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

/**
 * Updates the mentee's preferred mentor background.
 * Note: always upserts so it works even if the row was not yet created.
 */
export async function updateMentorBackgroundPreference(
  background: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("mentee_profiles")
    .update({ preferred_mentor_background: background.trim() || null })
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}
