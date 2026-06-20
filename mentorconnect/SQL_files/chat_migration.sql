-- ============================================================
--  CHAT SYSTEM MIGRATION
--  Direct mentor <-> mentee chats and mentor-group chats
-- ============================================================

DO $$
BEGIN
    CREATE TYPE chat_thread_type AS ENUM ('direct', 'group');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS chat_threads (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_type chat_thread_type NOT NULL,
    mentor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentee_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id    UUID REFERENCES mentor_groups(id) ON DELETE CASCADE,
    title       VARCHAR(200),
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chat_threads_direct_check CHECK (
        (thread_type = 'direct' AND mentee_id IS NOT NULL AND group_id IS NULL)
        OR
        (thread_type = 'group' AND mentee_id IS NULL AND group_id IS NOT NULL)
    ),
    CONSTRAINT chat_threads_direct_unique UNIQUE (thread_type, mentor_id, mentee_id),
    CONSTRAINT chat_threads_group_unique UNIQUE (thread_type, group_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id   UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_mentor      ON chat_threads(mentor_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_mentee      ON chat_threads(mentee_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_group       ON chat_threads(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread     ON chat_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender     ON chat_messages(sender_id);

CREATE OR REPLACE FUNCTION is_active_mentee(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = p_user_id
          AND role_id = 1
          AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION is_active_mentor(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = p_user_id
          AND role_id > 1
          AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION can_access_chat_thread(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM chat_threads ct
        WHERE ct.id = p_thread_id
          AND (
              (
                  ct.thread_type = 'direct'
                  AND (
                      (ct.mentor_id = p_user_id AND is_active_mentor(p_user_id))
                      OR
                      (ct.mentee_id = p_user_id AND is_active_mentee(p_user_id))
                  )
              )
              OR
              (
                  ct.thread_type = 'group'
                  AND (
                      (ct.mentor_id = p_user_id AND is_active_mentor(p_user_id))
                      OR
                      EXISTS (
                          SELECT 1
                          FROM mentor_group_members mgm
                          WHERE mgm.group_id = ct.group_id
                            AND mgm.mentee_id = p_user_id
                            AND mgm.status = 'active'
                      )
                  )
              )
          )
    );
$$;

CREATE OR REPLACE FUNCTION can_post_chat_message(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM chat_threads ct
        WHERE ct.id = p_thread_id
          AND (
              (
                  ct.thread_type = 'direct'
                  AND (
                      (ct.mentor_id = p_user_id AND is_active_mentor(p_user_id))
                      OR
                      (ct.mentee_id = p_user_id AND is_active_mentee(p_user_id))
                  )
              )
              OR
              (
                  ct.thread_type = 'group'
                  AND (
                      (ct.mentor_id = p_user_id AND is_active_mentor(p_user_id))
                      OR
                      EXISTS (
                          SELECT 1
                          FROM mentor_group_members mgm
                          WHERE mgm.group_id = ct.group_id
                            AND mgm.mentee_id = p_user_id
                            AND mgm.status = 'active'
                      )
                  )
              )
          )
    );
$$;

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow participants to read chat threads" ON chat_threads;
CREATE POLICY "Allow participants to read chat threads"
ON chat_threads FOR SELECT
TO authenticated
USING (can_access_chat_thread(id, auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated users to create valid chat threads" ON chat_threads;
CREATE POLICY "Allow authenticated users to create valid chat threads"
ON chat_threads FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND (
        (
            thread_type = 'direct'
            AND mentee_id IS NOT NULL
            AND group_id IS NULL
            AND is_active_mentor(mentor_id)
            AND is_active_mentee(mentee_id)
            AND (auth.uid() = mentor_id OR auth.uid() = mentee_id)
        )
        OR
        (
            thread_type = 'group'
            AND mentee_id IS NULL
            AND group_id IS NOT NULL
            AND is_active_mentor(mentor_id)
            AND EXISTS (
                SELECT 1
                FROM mentor_groups mg
                WHERE mg.id = group_id
                  AND mg.mentor_id = mentor_id
                  AND mg.is_active = TRUE
            )
            AND (
                auth.uid() = mentor_id
                OR EXISTS (
                    SELECT 1
                    FROM mentor_group_members mgm
                    WHERE mgm.group_id = group_id
                      AND mgm.mentee_id = auth.uid()
                      AND mgm.status = 'active'
                )
            )
        )
    )
);

DROP POLICY IF EXISTS "Allow participants to read chat messages" ON chat_messages;
CREATE POLICY "Allow participants to read chat messages"
ON chat_messages FOR SELECT
TO authenticated
USING (can_access_chat_thread(thread_id, auth.uid()));

DROP POLICY IF EXISTS "Allow participants to send chat messages" ON chat_messages;
CREATE POLICY "Allow participants to send chat messages"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND can_post_chat_message(thread_id, auth.uid())
);

INSERT INTO chat_threads (
    thread_type,
    mentor_id,
    mentee_id,
    group_id,
    title,
    created_by
)
SELECT
    'group'::chat_thread_type,
    mg.mentor_id,
    NULL,
    mg.id,
    mg.group_name,
    COALESCE(mg.created_by, mg.mentor_id)
FROM mentor_groups mg
WHERE mg.is_active = TRUE
ON CONFLICT (thread_type, group_id) DO UPDATE SET
    mentor_id = EXCLUDED.mentor_id,
    title = EXCLUDED.title,
    created_by = COALESCE(chat_threads.created_by, EXCLUDED.created_by),
    updated_at = NOW();

INSERT INTO chat_threads (
    thread_type,
    mentor_id,
    mentee_id,
    group_id,
    title,
    created_by
)
SELECT
    'direct'::chat_thread_type,
    mg.mentor_id,
    mgm.mentee_id,
    NULL,
    NULL,
    COALESCE(mg.created_by, mg.mentor_id)
FROM mentor_group_members mgm
JOIN mentor_groups mg ON mg.id = mgm.group_id
WHERE mg.is_active = TRUE
  AND mgm.status = 'active'
ON CONFLICT (thread_type, mentor_id, mentee_id) DO UPDATE SET
    created_by = COALESCE(chat_threads.created_by, EXCLUDED.created_by),
    updated_at = NOW();

CREATE OR REPLACE FUNCTION create_group_chat_thread_for_mentor_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.is_active THEN
        INSERT INTO chat_threads (
            thread_type,
            mentor_id,
            mentee_id,
            group_id,
            title,
            created_by
        )
        VALUES (
            'group'::chat_thread_type,
            NEW.mentor_id,
            NULL,
            NEW.id,
            NEW.group_name,
            COALESCE(NEW.created_by, NEW.mentor_id)
        )
        ON CONFLICT (thread_type, group_id) DO UPDATE SET
            mentor_id = EXCLUDED.mentor_id,
            title = EXCLUDED.title,
            created_by = COALESCE(chat_threads.created_by, EXCLUDED.created_by),
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION create_direct_chat_thread_for_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    mentor_group_row mentor_groups%ROWTYPE;
BEGIN
    IF NEW.status = 'active' THEN
        SELECT *
        INTO mentor_group_row
        FROM mentor_groups
        WHERE id = NEW.group_id
          AND is_active = TRUE;

        IF FOUND THEN
            INSERT INTO chat_threads (
                thread_type,
                mentor_id,
                mentee_id,
                group_id,
                title,
                created_by
            )
            VALUES (
                'direct'::chat_thread_type,
                mentor_group_row.mentor_id,
                NEW.mentee_id,
                NULL,
                NULL,
                COALESCE(mentor_group_row.created_by, mentor_group_row.mentor_id)
            )
            ON CONFLICT (thread_type, mentor_id, mentee_id) DO UPDATE SET
                created_by = COALESCE(chat_threads.created_by, EXCLUDED.created_by),
                updated_at = NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_group_chat_thread ON mentor_groups;
CREATE TRIGGER trg_create_group_chat_thread
AFTER INSERT ON mentor_groups
FOR EACH ROW
EXECUTE FUNCTION create_group_chat_thread_for_mentor_group();

DROP TRIGGER IF EXISTS trg_create_direct_chat_thread ON mentor_group_members;
CREATE TRIGGER trg_create_direct_chat_thread
AFTER INSERT OR UPDATE OF status ON mentor_group_members
FOR EACH ROW
EXECUTE FUNCTION create_direct_chat_thread_for_membership();

DROP TRIGGER IF EXISTS trg_chat_threads_updated ON chat_threads;
CREATE TRIGGER trg_chat_threads_updated
BEFORE UPDATE ON chat_threads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
