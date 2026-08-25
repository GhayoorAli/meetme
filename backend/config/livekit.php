<?php

return [

    'url' => env('LIVEKIT_URL', 'ws://localhost:7880'),

    'api_key' => env('LIVEKIT_API_KEY', 'devkey'),

    'api_secret' => env('LIVEKIT_API_SECRET', 'secret'),

    'token_ttl' => (int) env('LIVEKIT_TOKEN_TTL', 86400),

];
