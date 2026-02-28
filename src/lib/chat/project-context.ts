import { create } from "zustand";

interface ChatProjectState {
  projectId: string;
  setProjectId: (id: string) => void;
}

export const useChatProject = create<ChatProjectState>((set) => ({
  projectId: "",
  setProjectId: (id) => set({ projectId: id }),
}));
