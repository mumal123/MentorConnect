import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const ROLE_MENTEE = 1;
const MENTOR_ROLE_IDS = new Set([2, 3, 4, 5, 6, 7]);

export type ChatThreadType = "direct" | "group";

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ChatMessageView = Omit<ChatMessage, "body"> & {
  sender_name: string;
  sender_email: string | null;
  message_body: string;
};

export type ChatThreadRow = {
  id: string;
  thread_type: ChatThreadType;
  mentor_id: string;
  mentee_id: string | null;
  group_id: string | null;
  title: string | null;
};

export type ChatPreview = {
  href: string;
  threadId: string;
  title: string;
  subtitle: string;
  badge: string;
  lastMessageAt: string | null;
  participantCount: number;
};

export type ChatHubData = {
  userName: string;
  userRoleLabel: string;
  directChats: ChatPreview[];
  emptyState: string;
};

export type GroupChatHubData = {
  userName: string;
  userRoleLabel: string;
  groupChats: ChatPreview[];
  emptyState: string;
};

export type ThreadPageData = {
  thread: ChatThreadRow;
  threadTitle: string;
  threadSubtitle: string;
  backHref: string;
  messages: ChatMessageView[];
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  college_email: string | null;
};

type ActiveMembershipRow = {
  group_id: string;
  mentee_id: string;
  joined_at: string;
};

type MentorGroupRow = {
  id: string;
  mentor_id: string;
  group_name: string | null;
};

type UserRoleRow = {
  role_id: number;
};

function getDisplayName(profile?: ProfileRow | null, fallback = "Unknown") {
  return profile?.full_name?.trim() || fallback;
}

function getRoleLabel(roleIds: number[]) {
  if (roleIds.includes(ROLE_MENTEE) && roleIds.some((roleId) => MENTOR_ROLE_IDS.has(roleId))) {
    return "Mentor + Mentee";
  }

  if (roleIds.some((roleId) => MENTOR_ROLE_IDS.has(roleId))) {
    return "Mentor";
  }

  if (roleIds.includes(ROLE_MENTEE)) {
    return "Mentee";
  }

  return "Member";
}

async function getActiveRoleIds(supabase: SupabaseServerClient, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load roles: ${error.message}`);
  }

  return ((data || []) as UserRoleRow[]).map((row) => row.role_id);
}

async function getProfilesByUserIds(supabase: SupabaseServerClient, userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, full_name, college_email")
    .in("user_id", userIds);

  if (error) {
    throw new Error(`Failed to load profiles: ${error.message}`);
  }

  return new Map<string, ProfileRow>((data || []).map((row) => [row.user_id, row as ProfileRow]));
}

async function getUserName(supabase: SupabaseServerClient, userId: string) {
  const profiles = await getProfilesByUserIds(supabase, [userId]);
  return getDisplayName(profiles.get(userId), "Unknown user");
}

export async function ensureDirectThread(
  supabase: SupabaseServerClient,
  actorId: string,
  mentorId: string,
  menteeId: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("chat_threads")
    .select("id, thread_type, mentor_id, mentee_id, group_id, title")
    .eq("thread_type", "direct")
    .eq("mentor_id", mentorId)
    .eq("mentee_id", menteeId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load direct chat: ${existingError.message}`);
  }

  if (existing) {
    return existing as ChatThreadRow;
  }

  throw new Error("Direct chat thread is not provisioned yet. Rerun the chat migration.");
}

export async function ensureGroupThread(supabase: SupabaseServerClient, actorId: string, groupId: string) {
  const { data: group, error: groupError } = await supabase
    .from("mentor_groups")
    .select("id, mentor_id, group_name")
    .eq("id", groupId)
    .eq("is_active", true)
    .maybeSingle();

  if (groupError) {
    throw new Error(`Failed to load mentor group: ${groupError.message}`);
  }

  if (!group) {
    throw new Error("Mentor group not found.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("chat_threads")
    .select("id, thread_type, mentor_id, mentee_id, group_id, title")
    .eq("thread_type", "group")
    .eq("group_id", groupId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load group chat: ${existingError.message}`);
  }

  if (existing) {
    return existing as ChatThreadRow;
  }

  throw new Error("Group chat thread is not provisioned yet. Rerun the chat migration.");
}

export async function loadDirectChatHub(supabase: SupabaseServerClient, userId: string): Promise<ChatHubData> {
  const roleIds = await getActiveRoleIds(supabase, userId);
  const userName = await getUserName(supabase, userId);

  if (roleIds.some((roleId) => MENTOR_ROLE_IDS.has(roleId))) {
    const { data: groupsData, error: groupsError } = await supabase
      .from("mentor_groups")
      .select("id, mentor_id, group_name")
      .eq("mentor_id", userId)
      .eq("is_active", true);

    if (groupsError) {
      throw new Error(`Failed to load mentor groups: ${groupsError.message}`);
    }

    const groupRows = (groupsData || []) as MentorGroupRow[];
    const groupIds = groupRows.map((group) => group.id);

    const { data: membershipData, error: membershipError } = groupIds.length
      ? await supabase
          .from("mentor_group_members")
          .select("group_id, mentee_id, joined_at")
          .in("group_id", groupIds)
          .eq("status", "active")
      : { data: [] as ActiveMembershipRow[] | null, error: null };

    if (membershipError) {
      throw new Error(`Failed to load group members: ${membershipError.message}`);
    }

    const membershipRows = (membershipData || []) as ActiveMembershipRow[];
    const menteeIds = Array.from(new Set(membershipRows.map((row) => row.mentee_id)));
    const profiles = await getProfilesByUserIds(supabase, menteeIds);
    const mentorProfiles = await getProfilesByUserIds(supabase, [userId]);

    const directChats: ChatPreview[] = [];

    for (const membership of membershipRows) {
      const menteeProfile = profiles.get(membership.mentee_id);
      const thread = await ensureDirectThread(supabase, userId, userId, membership.mentee_id);

      directChats.push({
        href: `/protected/discussions/direct/${userId}/${membership.mentee_id}`,
        threadId: thread.id,
        title: getDisplayName(menteeProfile, "Mentee"),
        subtitle: `${getDisplayName(mentorProfiles.get(userId), "Mentor")} · 1:1 direct chat`,
        badge: "Direct",
        lastMessageAt: null,
        participantCount: 2,
      });
    }

    return {
      userName,
      userRoleLabel: getRoleLabel(roleIds),
      directChats,
      emptyState: "No active mentee chats yet.",
    };
  }

  if (roleIds.includes(ROLE_MENTEE)) {
    const { data: membership, error: membershipError } = await supabase
      .from("mentor_group_members")
      .select("group_id, joined_at")
      .eq("mentee_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: false })
      .maybeSingle();

    if (membershipError) {
      throw new Error(`Failed to load mentor allocation: ${membershipError.message}`);
    }

    if (!membership?.group_id) {
      return {
        userName,
        userRoleLabel: getRoleLabel(roleIds),
        directChats: [],
        emptyState: "You will see your mentor chat here after allocation.",
      };
    }

    const { data: group, error: groupError } = await supabase
      .from("mentor_groups")
      .select("id, mentor_id, group_name")
      .eq("id", membership.group_id)
      .maybeSingle();

    if (groupError) {
      throw new Error(`Failed to load mentor group: ${groupError.message}`);
    }

    if (!group) {
      return {
        userName,
        userRoleLabel: getRoleLabel(roleIds),
        directChats: [],
        emptyState: "Your mentor group could not be found.",
      };
    }

    const profiles = await getProfilesByUserIds(supabase, [group.mentor_id, userId]);
    const thread = await ensureDirectThread(supabase, userId, group.mentor_id, userId);

    return {
      userName,
      userRoleLabel: getRoleLabel(roleIds),
      directChats: [
        {
          href: `/protected/discussions/direct/${group.mentor_id}/${userId}`,
          threadId: thread.id,
          title: getDisplayName(profiles.get(group.mentor_id), "Your mentor"),
          subtitle: `${group.group_name || "Assigned mentor"} · 1:1 direct chat`,
          badge: "Direct",
          lastMessageAt: null,
          participantCount: 2,
        },
      ],
      emptyState: "No active mentor chat yet.",
    };
  }

  return {
    userName,
    userRoleLabel: getRoleLabel(roleIds),
    directChats: [],
    emptyState: "This account does not have direct chat access.",
  };
}

export async function loadGroupChatHub(supabase: SupabaseServerClient, userId: string): Promise<GroupChatHubData> {
  const roleIds = await getActiveRoleIds(supabase, userId);
  const userName = await getUserName(supabase, userId);

  if (roleIds.some((roleId) => MENTOR_ROLE_IDS.has(roleId))) {
    const { data: groupRowsData, error: groupsError } = await supabase
      .from("mentor_groups")
      .select("id, mentor_id, group_name")
      .eq("mentor_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (groupsError) {
      throw new Error(`Failed to load mentor groups: ${groupsError.message}`);
    }

    const groupRows = (groupRowsData || []) as MentorGroupRow[];
    const groupIds = groupRows.map((group) => group.id);
    const { data: memberRowsData, error: memberError } = groupIds.length
      ? await supabase
          .from("mentor_group_members")
          .select("group_id, mentee_id, joined_at")
          .eq("status", "active")
          .in("group_id", groupIds)
      : { data: [] as ActiveMembershipRow[] | null, error: null };

    if (memberError) {
      throw new Error(`Failed to load mentor group members: ${memberError.message}`);
    }

    const members = (memberRowsData || []) as ActiveMembershipRow[];
    const groupChats: ChatPreview[] = [];

    for (const group of groupRows) {
      const groupMembers = members.filter((member) => member.group_id === group.id);
      const thread = await ensureGroupThread(supabase, userId, group.id);

      groupChats.push({
        href: `/protected/mentor-rooms/group/${group.id}`,
        threadId: thread.id,
        title: group.group_name || "Mentor group",
        subtitle: `${groupMembers.length} mentee${groupMembers.length === 1 ? "" : "s"} in this room`,
        badge: "Group",
        lastMessageAt: null,
        participantCount: groupMembers.length + 1,
      });
    }

    return {
      userName,
      userRoleLabel: getRoleLabel(roleIds),
      groupChats,
      emptyState: "Create a mentor room chat after your first allocation.",
    };
  }

  if (roleIds.includes(ROLE_MENTEE)) {
    const { data: membershipData, error: membershipError } = await supabase
      .from("mentor_group_members")
      .select("group_id, joined_at")
      .eq("mentee_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: false })
      .maybeSingle();

    if (membershipError) {
      throw new Error(`Failed to load active allocation: ${membershipError.message}`);
    }

    if (!membershipData?.group_id) {
      return {
        userName,
        userRoleLabel: getRoleLabel(roleIds),
        groupChats: [],
        emptyState: "Your group chat will appear once you are added to a mentor room.",
      };
    }

    const { data: group, error: groupError } = await supabase
      .from("mentor_groups")
      .select("id, mentor_id, group_name")
      .eq("id", membershipData.group_id)
      .maybeSingle();

    if (groupError) {
      throw new Error(`Failed to load mentor group: ${groupError.message}`);
    }

    if (!group) {
      return {
        userName,
        userRoleLabel: getRoleLabel(roleIds),
        groupChats: [],
        emptyState: "Your assigned group could not be found.",
      };
    }

    const thread = await ensureGroupThread(supabase, userId, group.id);
    const mentorProfile = await getProfilesByUserIds(supabase, [group.mentor_id]);

    return {
      userName,
      userRoleLabel: getRoleLabel(roleIds),
      groupChats: [
        {
          href: `/protected/mentor-rooms/group/${group.id}`,
          threadId: thread.id,
          title: group.group_name || getDisplayName(mentorProfile.get(group.mentor_id), "Mentor room"),
          subtitle: `1 mentor + group chat`,
          badge: "Group",
          lastMessageAt: null,
          participantCount: 2,
        },
      ],
      emptyState: "No group chat found yet.",
    };
  }

  return {
    userName,
    userRoleLabel: getRoleLabel(roleIds),
    groupChats: [],
    emptyState: "This account does not have group chat access.",
  };
}

export async function loadDirectThreadPage(
  supabase: SupabaseServerClient,
  userId: string,
  mentorId: string,
  menteeId: string,
): Promise<ThreadPageData> {
  const roleIds = await getActiveRoleIds(supabase, userId);
  const isParticipant = userId === mentorId || userId === menteeId;

  if (!isParticipant || (!roleIds.some((roleId) => MENTOR_ROLE_IDS.has(roleId)) && !roleIds.includes(ROLE_MENTEE))) {
    throw new Error("You do not have access to this direct chat.");
  }

  const thread = await ensureDirectThread(supabase, userId, mentorId, menteeId);
  const profiles = await getProfilesByUserIds(supabase, [mentorId, menteeId]);

  const { data: messageRows, error: messageError } = await supabase
    .from("chat_messages")
    .select("id, thread_id, sender_id, body, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });

  if (messageError) {
    throw new Error(`Failed to load chat messages: ${messageError.message}`);
  }

  const senderIds = Array.from(new Set(((messageRows || []) as ChatMessage[]).map((message) => message.sender_id)));
  const senderProfiles = await getProfilesByUserIds(supabase, senderIds);

  const messages = ((messageRows || []) as ChatMessage[]).map((message) => ({
    ...message,
    sender_name: getDisplayName(senderProfiles.get(message.sender_id), "Unknown user"),
    sender_email: senderProfiles.get(message.sender_id)?.college_email || null,
    message_body: message.body,
  }));

  const mentorName = getDisplayName(profiles.get(mentorId), "Mentor");
  const menteeName = getDisplayName(profiles.get(menteeId), "Mentee");

  return {
    thread,
    threadTitle: userId === mentorId ? menteeName : mentorName,
    threadSubtitle: "1:1 mentoring chat",
    backHref: "/protected/discussions",
    messages,
  };
}

export async function loadGroupThreadPage(
  supabase: SupabaseServerClient,
  userId: string,
  groupId: string,
): Promise<ThreadPageData> {
  const roleIds = await getActiveRoleIds(supabase, userId);
  const { data: group, error: groupError } = await supabase
    .from("mentor_groups")
    .select("id, mentor_id, group_name")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    throw new Error(`Failed to load mentor group: ${groupError.message}`);
  }

  if (!group) {
    throw new Error("Mentor group not found.");
  }

  const isMentorParticipant = userId === group.mentor_id;
  const { data: activeMembership } = await supabase
    .from("mentor_group_members")
    .select("group_id, mentee_id")
    .eq("group_id", groupId)
    .eq("mentee_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!isMentorParticipant && !activeMembership) {
    throw new Error("You do not have access to this group chat.");
  }

  if (!isMentorParticipant && !roleIds.includes(ROLE_MENTEE)) {
    throw new Error("You do not have access to this group chat.");
  }

  const thread = await ensureGroupThread(supabase, userId, group.id);
  const { data: groupMembersData } = await supabase
    .from("mentor_group_members")
    .select("mentee_id")
    .eq("group_id", group.id)
    .eq("status", "active");

  const menteeIds = ((groupMembersData || []) as Array<{ mentee_id: string }>).map((member) => member.mentee_id);
  const profiles = await getProfilesByUserIds(supabase, [group.mentor_id, ...menteeIds]);

  const { data: messageRows, error: messageError } = await supabase
    .from("chat_messages")
    .select("id, thread_id, sender_id, body, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });

  if (messageError) {
    throw new Error(`Failed to load chat messages: ${messageError.message}`);
  }

  const senderIds = Array.from(new Set(((messageRows || []) as ChatMessage[]).map((message) => message.sender_id)));
  const senderProfiles = await getProfilesByUserIds(supabase, senderIds);

  const messages = ((messageRows || []) as ChatMessage[]).map((message) => ({
    ...message,
    sender_name: getDisplayName(senderProfiles.get(message.sender_id), "Unknown user"),
    sender_email: senderProfiles.get(message.sender_id)?.college_email || null,
    message_body: message.body,
  }));

  return {
    thread,
    threadTitle: group.group_name || "Mentor room",
    threadSubtitle: `${getDisplayName(profiles.get(group.mentor_id), "Mentor")} · group chat`,
    backHref: "/protected/mentor-rooms",
    messages,
  };
}
