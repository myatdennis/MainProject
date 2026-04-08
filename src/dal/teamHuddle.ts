import { request } from './http';

export type TeamHuddleReactionType = 'like' | 'dislike' | 'love';

export interface TeamHuddleComment {
  id: string;
  post_id: string;
  organization_id: string;
  parent_comment_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface TeamHuddlePost {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  body: string;
  topics: string[];
  created_at: string;
  updated_at: string;
  hidden_at?: string | null;
  locked_at?: string | null;
  pinned_at?: string | null;
  deleted_at?: string | null;
  commentCount?: number;
  comments?: TeamHuddleComment[];
  reactionSummary?: Record<TeamHuddleReactionType, number>;
  viewerReaction?: TeamHuddleReactionType | null;
}

export interface TeamHuddleReport {
  id: string;
  post_id: string;
  organization_id: string;
  reporter_user_id: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
  post?: TeamHuddlePost | null;
}

export const listTeamHuddlePosts = async (params: { search?: string; topic?: string } = {}): Promise<TeamHuddlePost[]> => {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.topic) query.set('topic', params.topic);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await request<{ data: TeamHuddlePost[] }>(`/api/team-huddle/posts${suffix}`);
  return Array.isArray(response?.data) ? response.data : [];
};

export const createTeamHuddlePost = async (payload: {
  title: string;
  body: string;
  topics?: string[];
}): Promise<TeamHuddlePost> => {
  const response = await request<{ data: TeamHuddlePost }>('/api/team-huddle/posts', {
    method: 'POST',
    body: payload,
  });
  return response.data;
};

export const getTeamHuddlePost = async (postId: string): Promise<TeamHuddlePost> => {
  const response = await request<{ data: TeamHuddlePost }>(`/api/team-huddle/posts/${encodeURIComponent(postId)}`);
  return response.data;
};

export const addTeamHuddleComment = async (
  postId: string,
  payload: { body: string; parentCommentId?: string | null },
): Promise<TeamHuddleComment> => {
  const response = await request<{ data: TeamHuddleComment }>(`/api/team-huddle/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    body: payload,
  });
  return response.data;
};

export const reactToTeamHuddlePost = async (
  postId: string,
  reactionType: TeamHuddleReactionType,
): Promise<{ reactionSummary: Record<TeamHuddleReactionType, number>; viewerReaction: TeamHuddleReactionType | null }> => {
  const response = await request<{
    data: { reactionSummary: Record<TeamHuddleReactionType, number>; viewerReaction: TeamHuddleReactionType | null };
  }>(`/api/team-huddle/posts/${encodeURIComponent(postId)}/reactions`, {
    method: 'POST',
    body: { reactionType },
  });
  return response.data;
};

export const reportTeamHuddlePost = async (postId: string, reason: string): Promise<void> => {
  await request(`/api/team-huddle/posts/${encodeURIComponent(postId)}/report`, {
    method: 'POST',
    body: { reason },
  });
};

export const listTeamHuddleReports = async (): Promise<TeamHuddleReport[]> => {
  const response = await request<{ data: TeamHuddleReport[] }>('/api/admin/team-huddle/reports');
  return Array.isArray(response?.data) ? response.data : [];
};

export const moderateTeamHuddlePost = async (
  postId: string,
  action: 'hide' | 'unhide' | 'lock' | 'unlock' | 'pin' | 'unpin' | 'remove',
): Promise<TeamHuddlePost> => {
  const response = await request<{ data: TeamHuddlePost }>(`/api/admin/team-huddle/posts/${encodeURIComponent(postId)}/moderate`, {
    method: 'POST',
    body: { action },
  });
  return response.data;
};
