<?php

namespace App\Services;

use App\Models\Meeting;
use Illuminate\Support\Str;

class MeetingCodeGenerator
{
    private const CHARS = 'abcdefghijklmnopqrstuvwxyz';

    public function generate(): string
    {
        do {
            $code = $this->buildCode();
        } while (Meeting::query()->where('code', $code)->exists());

        return $code;
    }

    private function buildCode(): string
    {
        $segments = [
            Str::lower(Str::random(3, self::CHARS)),
            Str::lower(Str::random(4, self::CHARS)),
            Str::lower(Str::random(3, self::CHARS)),
        ];

        return implode('-', $segments);
    }

    public function generateRoomName(): string
    {
        return 'room_'.Str::uuid()->toString();
    }
}
