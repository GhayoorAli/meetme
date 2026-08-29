<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Meeting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait AuthorizesMeetingHost
{
    protected function hostTokenFromRequest(Request $request): ?string
    {
        $token = $request->input('host_token') ?? $request->query('host_token');

        return is_string($token) && $token !== '' ? $token : null;
    }

    protected function isRequestHost(Meeting $meeting, Request $request): bool
    {
        $user = $request->user();
        if ($user && $meeting->isHostedBy($user)) {
            return true;
        }

        return $meeting->isGuestHost($this->hostTokenFromRequest($request));
    }

    protected function denyUnlessHost(Meeting $meeting, Request $request): ?JsonResponse
    {
        if ($this->isRequestHost($meeting, $request)) {
            return null;
        }

        return response()->json(['message' => 'Only the host can perform this action.'], 403);
    }
}
