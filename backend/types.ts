export interface State {
  currentRoomId: string | null;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'host' | 'editor' | 'viewer';
}
