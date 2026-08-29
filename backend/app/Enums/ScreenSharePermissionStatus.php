<?php

namespace App\Enums;

enum ScreenSharePermissionStatus: string
{
    case None = 'none';
    case Pending = 'pending';
    case Approved = 'approved';
    case Denied = 'denied';

    public function canShareScreen(): bool
    {
        return $this === self::Approved;
    }
}
