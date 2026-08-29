<?php

namespace App\Models;

use App\Enums\ParticipantRole;
use App\Enums\ParticipantStatus;
use App\Enums\RecordingPermissionStatus;
use App\Enums\ScreenSharePermissionStatus;
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
        'recording_permission',
        'screen_share_permission',
        'hand_raised',
        'admit_token',
        'joined_at',
        'left_at',
    ];

    protected function casts(): array
    {
        return [
            'role' => ParticipantRole::class,
            'status' => ParticipantStatus::class,
            'recording_permission' => RecordingPermissionStatus::class,
            'screen_share_permission' => ScreenSharePermissionStatus::class,
            'hand_raised' => 'boolean',
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

    public function canRecord(): bool
    {
        return $this->recording_permission === RecordingPermissionStatus::Approved;
    }

    public function canShareScreen(): bool
    {
        return $this->screen_share_permission === ScreenSharePermissionStatus::Approved;
    }
}
