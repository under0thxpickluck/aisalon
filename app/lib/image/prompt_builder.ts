import type { ImageChatState } from "./image_types";

export function buildPrompt(state: ImageChatState): string {
  return [
    state.character || "girl",
    state.hair ? `${state.hair} hair` : "",
    state.outfit || "",
    state.emotion || "neutral expression",
    state.scene || "simple background",
    state.timeOfDay || "",
    state.atmosphere || "",
    state.style || "anime style",
    state.composition || "",
    state.detail || "",
    state.hq ? "high quality, detailed, polished illustration" : "clean illustration",
  ]
    .filter(Boolean)
    .join(", ");
}
