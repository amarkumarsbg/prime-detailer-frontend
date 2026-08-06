"use client";

import { create } from "zustand";
import type { CustomerMessage } from "@/types";

interface CommunicationStore {
  messages: CustomerMessage[];
  addMessage: (msg: CustomerMessage) => void;
}

export const useCommunicationStore = create<CommunicationStore>((set) => ({
  messages: [],
  addMessage: (msg) => {
    set((s) => {
      // Avoid duplicate adds if any
      if (s.messages.some((m) => m.id === msg.id)) return s;
      return {
        messages: [msg, ...s.messages],
      };
    });
  },
}));
