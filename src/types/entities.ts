export type EntityId = string;
export type ISODateString = string;

// Supabase와 로컬 저장소가 공통으로 쓰는 동기화 가능 엔티티 기본 필드다.
export interface SyncableEntity {
  id: EntityId;
  updatedAt: ISODateString;
  deletedAt: ISODateString | null;
  deviceId: EntityId;
}

// 메모 본문 데이터. 삭제는 deletedAt tombstone으로 표현한다.
export interface Note extends SyncableEntity {
  title: string;
  content: string;
}

// 체크리스트 항목. orderIndex는 사용자가 보는 정렬 순서다.
export interface Task extends SyncableEntity {
  text: string;
  isDone: boolean;
  orderIndex: number;
  dueDate: string | null;
  dueTime: string | null;
}

// heartbeat와 활성 기기 표시를 위한 로컬/원격 기기 정보다.
export interface Device {
  id: EntityId;
  name: string;
  lastSeenAt: ISODateString;
  appVersion?: string | null;
}

// 앱이 저장하고 동기화하는 전체 데이터 묶음이다.
export interface LocalDataSnapshot {
  notes: Note[];
  tasks: Task[];
  devices: Device[];
}
