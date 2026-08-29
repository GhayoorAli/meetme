"use client";

import { Button } from "@/components/ui/button";
import { useHandRaise } from "@/components/meeting/hand-raise-sync";
import { Hand } from "lucide-react";

export function HandRaiseControls() {
  const { isHandRaised, toggleHandRaise } = useHandRaise();

  return (
    <Button
      size="sm"
      variant={isHandRaised ? "primary" : "secondary"}
      onClick={() => toggleHandRaise()}
    >
      <Hand className="h-4 w-4" />
      {isHandRaised ? "Lower hand" : "Raise hand"}
    </Button>
  );
}
