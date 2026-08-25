<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Meeting */
class MeetingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'title' => $this->title,
            'status' => $this->status->value,
            'waiting_room_enabled' => (bool) $this->waiting_room_enabled,
            'host' => new UserResource($this->whenLoaded('host')),
            'host_id' => $this->host_id,
            'participant_count' => $this->whenCounted('activeParticipants'),
            'started_at' => $this->started_at?->toIso8601String(),
            'ended_at' => $this->ended_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'join_url' => config('app.frontend_url').'/m/'.$this->code,
        ];
    }
}
