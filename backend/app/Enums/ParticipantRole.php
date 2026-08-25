<?php

namespace App\Enums;

enum ParticipantRole: string
{
    case Host = 'host';
    case Guest = 'guest';

    public function isHost(): bool
    {
        return $this === self::Host;
    }
}
