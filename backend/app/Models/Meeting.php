<?php

namespace App\Models;

use App\Enums\MeetingStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Meeting extends Model
{
    protected $fillable = [
        'host_id',
        'code',
        'title',
        'livekit_room',
        'status',
        'waiting_room_enabled',
        'started_at',
        'ended_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => MeetingStatus::class,
            'waiting_room_enabled' => 'boolean',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(MeetingParticipant::class);
    }

    public function activeParticipants(): HasMany
    {
        return $this->participants()
            ->where('status', 'admitted')
            ->whereNull('left_at');
    }

    public function waitingParticipants(): HasMany
    {
        return $this->participants()->where('status', 'waiting');
    }

    public function isJoinable(): bool
    {
        return $this->status->isJoinable();
    }

    public function isHostedBy(User $user): bool
    {
        return $this->host_id === $user->id;
    }
}
