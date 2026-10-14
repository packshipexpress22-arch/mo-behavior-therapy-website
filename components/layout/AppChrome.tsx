"use client";

import { useState } from "react";
import MobileStickyBar from "./MobileStickyBar";
import ChatWidget from "@/components/chat/ChatWidget";
import MiloLauncher from "@/components/mascot/MiloLauncher";

export default function AppChrome() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <MiloLauncher chatOpen={chatOpen} onToggleChat={() => setChatOpen((o) => !o)} />

      <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />

      <MobileStickyBar onChatClick={() => setChatOpen(true)} />
    </>
  );
}
