export type ImageChatState = {
  character?: string;
  hair?: string;
  outfit?: string;
  emotion?: string;
  scene?: string;
  timeOfDay?: string;
  atmosphere?: string;
  style?: string;
  composition?: string;
  detail?: string;
  turns: number;
  textLength: number;
  hq?: boolean;
  edit?: boolean;
};

export type ImageHistoryItem = {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  bp_used: number;
  type: "generate" | "edit" | "jacket";
  created_at: string;
};

export type ImagePreviewCost = {
  totalBp: number;
  breakdown: {
    base: number;
    turn: number;
    text: number;
    style: number;
    hq: number;
    edit: number;
  };
};
