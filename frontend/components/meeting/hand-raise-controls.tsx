"use client";

import { MeetingDockButton } from "@/components/meeting/meeting-dock-button";
import { useHandRaise } from "@/components/meeting/hand-raise-sync";
import { Hand } from "lucide-react";

export function HandRaiseControls() {
  const { isHandRaised, toggleHandRaise } = useHandRaise();

  return (
    <MeetingDockButton
      title={isHandRaised ? "Lower hand" : "Raise hand"}
      active={isHandRaised}
      onClick={() => toggleHandRaise()}
    >
      <Hand className="h-4 w-4" />
    </MeetingDockButton>
  );
}
