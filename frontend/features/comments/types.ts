export interface CommentAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface TournamentComment {
  id: string;
  content: string;
  isHidden: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  tournamentId: string;
  parentId: string | null;
  replyToUserId: string | null;
  author: CommentAuthor;
  replyToUser: CommentAuthor | null;
}

export interface TournamentCommentThread extends TournamentComment {
  replyCount: number;
  replies: TournamentComment[];
}

export interface CommentReplyTarget {
  commentId: string;
  rootId: string;
  displayName: string;
}

export interface CommentPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TournamentCommentsResponse {
  data: TournamentCommentThread[];
  discussionTotal: number;
  pagination: CommentPagination;
}

export interface DeleteCommentResponse {
  message: string;
  commentId: string;
  tombstoned: boolean;
  comment?: TournamentComment;
}
