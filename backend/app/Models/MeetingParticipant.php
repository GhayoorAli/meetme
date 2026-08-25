<?php

namespace App\Models;

use App\Enums\ParticipantRole;
use App\Enums\ParticipantStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetingParticipant extends Model
{
    protected $fillable = [
        'meeting_id',
        'user_id',
        'display_name',
        'identity',
        'role',
        'status',
        'admit_token',
        'joined_at',
        'left_at',
    ];

    protected function casts(): array
    {
        return [
            'role' => ParticipantRole::class,
            'status' => ParticipantStatus::class,
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
        ];
    }

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->status === ParticipantStatus::Admitted && $this->left_at === null;
    }

    public function isWaiting(): bool
    {
        return $this->status === ParticipantStatus::Waiting;
    }
}
