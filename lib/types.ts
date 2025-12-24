export type Photo = {
  id: string;
  title: string;
  url: string;
  takenAt?: string;
  tags?: string[];
  isLive?: boolean;
};

export type ApiHealth = {
  status: "ok";
  timestamp: string;
  note?: string;
};
