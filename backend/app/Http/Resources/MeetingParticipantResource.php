<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\MeetingParticipant */
class MeetingParticipantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'display_name' => $this->display_name,
            'identity' => $this->identity,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'recording_permission' => $this->recording_permission->value,
            'screen_share_permission' => $this->screen_share_permission->value,
            'hand_raised' => $this->hand_raised,
            'joined_at' => $this->joined_at?->toIso8601String(),
            'left_at' => $this->left_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
