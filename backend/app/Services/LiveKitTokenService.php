<?php

namespace App\Services;

class LiveKitTokenService
{
    public function createAccessToken(
        string $roomName,
        string $identity,
        string $displayName,
        bool $isHost = false,
        ?int $ttl = null,
    ): string {
        $apiKey = config('livekit.api_key');
        $apiSecret = config('livekit.api_secret');
        $ttl ??= config('livekit.token_ttl');

        $now = time();
        $payload = [
            'iss' => $apiKey,
            'sub' => $identity,
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + $ttl,
            'name' => $displayName,
            'video' => [
                'roomJoin' => true,
                'room' => $roomName,
                'canPublish' => true,
                'canSubscribe' => true,
                'canPublishData' => true,
                'roomAdmin' => $isHost,
                'roomCreate' => $isHost,
            ],
        ];

        return $this->encodeJwt($payload, $apiSecret);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function encodeJwt(array $payload, string $secret): string
    {
        $header = $this->base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $body = $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = $this->base64UrlEncode(
            hash_hmac('sha256', "{$header}.{$body}", $secret, true)
        );

        return "{$header}.{$body}.{$signature}";
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public function getServerUrl(): string
    {
        return config('livekit.url');
    }
}
