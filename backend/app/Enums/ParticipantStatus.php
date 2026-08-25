<?php

namespace App\Enums;

enum ParticipantStatus: string
{
    case Waiting = 'waiting';
    case Admitted = 'admitted';
    case Denied = 'denied';
    case Left = 'left';

    public function isInCall(): bool
    {
        return $this === self::Admitted;
    }
}
