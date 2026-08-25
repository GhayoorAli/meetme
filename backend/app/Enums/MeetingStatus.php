<?php

namespace App\Enums;

enum MeetingStatus: string
{
    case Active = 'active';
    case Ended = 'ended';

    public function isJoinable(): bool
    {
        return $this === self::Active;
    }
}
