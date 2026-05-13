-- Social Connect Platform - RLS complet

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(cid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM public.conversation_participants WHERE conversation_id = cid AND user_id = auth.uid());
$$;

DROP POLICY IF EXISTS "profiles_read_public" ON public.profiles;
CREATE POLICY "profiles_read_public" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_update_owner_admin" ON public.profiles;
CREATE POLICY "profiles_update_owner_admin" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "posts_read_public" ON public.posts;
CREATE POLICY "posts_read_public" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "posts_insert_owner" ON public.posts;
CREATE POLICY "posts_insert_owner" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "posts_update_owner" ON public.posts;
CREATE POLICY "posts_update_owner" ON public.posts FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "posts_delete_owner" ON public.posts;
CREATE POLICY "posts_delete_owner" ON public.posts FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "comments_read_public" ON public.comments;
CREATE POLICY "comments_read_public" ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "comments_insert_auth" ON public.comments;
CREATE POLICY "comments_insert_auth" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comments_delete_owner_admin" ON public.comments;
CREATE POLICY "comments_delete_owner_admin" ON public.comments FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "likes_read_public" ON public.likes;
CREATE POLICY "likes_read_public" ON public.likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "likes_insert_auth" ON public.likes;
CREATE POLICY "likes_insert_auth" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes_delete_owner" ON public.likes;
CREATE POLICY "likes_delete_owner" ON public.likes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shares_read_public" ON public.shares;
CREATE POLICY "shares_read_public" ON public.shares FOR SELECT USING (true);
DROP POLICY IF EXISTS "shares_insert_owner" ON public.shares;
CREATE POLICY "shares_insert_owner" ON public.shares FOR INSERT WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "stories_read_public" ON public.stories;
CREATE POLICY "stories_read_public" ON public.stories FOR SELECT USING (expires_at > now());
DROP POLICY IF EXISTS "stories_insert_owner" ON public.stories;
CREATE POLICY "stories_insert_owner" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "stories_delete_owner" ON public.stories;
CREATE POLICY "stories_delete_owner" ON public.stories FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "friendships_read_related" ON public.friendships;
CREATE POLICY "friendships_read_related" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id OR public.is_admin());
DROP POLICY IF EXISTS "friendships_insert_owner" ON public.friendships;
CREATE POLICY "friendships_insert_owner" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "friendships_update_related" ON public.friendships;
CREATE POLICY "friendships_update_related" ON public.friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id OR public.is_admin());

DROP POLICY IF EXISTS "conversations_read_participants" ON public.conversations;
CREATE POLICY "conversations_read_participants" ON public.conversations FOR SELECT USING (public.is_conversation_participant(id) OR public.is_admin());
DROP POLICY IF EXISTS "conversations_insert_auth" ON public.conversations;
CREATE POLICY "conversations_insert_auth" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "conversation_participants_read_related" ON public.conversation_participants;
CREATE POLICY "conversation_participants_read_related" ON public.conversation_participants FOR SELECT USING (user_id = auth.uid() OR public.is_conversation_participant(conversation_id) OR public.is_admin());
DROP POLICY IF EXISTS "conversation_participants_insert_auth" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert_auth" ON public.conversation_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "messages_read_participants" ON public.messages;
CREATE POLICY "messages_read_participants" ON public.messages FOR SELECT USING (public.is_conversation_participant(conversation_id) OR public.is_admin());
DROP POLICY IF EXISTS "messages_insert_participants" ON public.messages;
CREATE POLICY "messages_insert_participants" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id));
DROP POLICY IF EXISTS "messages_update_participants" ON public.messages;
CREATE POLICY "messages_update_participants" ON public.messages FOR UPDATE USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "notifications_read_owner" ON public.notifications;
CREATE POLICY "notifications_read_owner" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "notifications_update_owner" ON public.notifications;
CREATE POLICY "notifications_update_owner" ON public.notifications FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
CREATE POLICY "notifications_insert_system" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "groups_read_public_or_member" ON public.groups;
CREATE POLICY "groups_read_public_or_member" ON public.groups FOR SELECT USING (
  is_private = false OR creator_id = auth.uid() OR EXISTS(SELECT 1 FROM public.group_members WHERE group_id = groups.id AND user_id = auth.uid()) OR public.is_admin()
);
DROP POLICY IF EXISTS "groups_insert_auth" ON public.groups;
CREATE POLICY "groups_insert_auth" ON public.groups FOR INSERT WITH CHECK (creator_id = auth.uid());
DROP POLICY IF EXISTS "groups_update_creator_admin" ON public.groups;
CREATE POLICY "groups_update_creator_admin" ON public.groups FOR UPDATE USING (creator_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "group_members_read_related" ON public.group_members;
CREATE POLICY "group_members_read_related" ON public.group_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
CREATE POLICY "group_members_insert_self" ON public.group_members FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "group_members_delete_self_admin" ON public.group_members;
CREATE POLICY "group_members_delete_self_admin" ON public.group_members FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "group_posts_read_members_public" ON public.group_posts;
CREATE POLICY "group_posts_read_members_public" ON public.group_posts FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.is_private = false OR EXISTS(SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id AND gm.user_id = auth.uid())))
);
DROP POLICY IF EXISTS "group_posts_insert_member" ON public.group_posts;
CREATE POLICY "group_posts_insert_member" ON public.group_posts FOR INSERT WITH CHECK (
  user_id = auth.uid() AND EXISTS(SELECT 1 FROM public.group_members WHERE group_id = group_posts.group_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "calls_read_related" ON public.calls;
CREATE POLICY "calls_read_related" ON public.calls FOR SELECT USING (caller_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "calls_insert_caller" ON public.calls;
CREATE POLICY "calls_insert_caller" ON public.calls FOR INSERT WITH CHECK (caller_id = auth.uid());
DROP POLICY IF EXISTS "calls_update_related" ON public.calls;
CREATE POLICY "calls_update_related" ON public.calls FOR UPDATE USING (caller_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "storage_media_public_read" ON storage.objects;
CREATE POLICY "storage_media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
DROP POLICY IF EXISTS "storage_media_auth_insert" ON storage.objects;
CREATE POLICY "storage_media_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "storage_media_owner_delete" ON storage.objects;
CREATE POLICY "storage_media_owner_delete" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND auth.uid() IS NOT NULL);
