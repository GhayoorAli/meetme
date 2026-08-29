<?php

namespace App\Enums;

enum RecordingPermissionStatus: string
{
    case None = 'none';
    case Pending = 'pending';
    case Approved = 'approved';
    case Denied = 'denied';

    public function canRecord(): bool
    {
        return $this === self::Approved;
    }
}
