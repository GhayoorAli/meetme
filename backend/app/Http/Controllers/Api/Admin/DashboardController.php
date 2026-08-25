<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\MeetingResource;
use App\Http\Resources\UserResource;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        return response()->json([
            'users' => User::query()->count(),
            'meetings' => Meeting::query()->count(),
            'active_meetings' => Meeting::query()->where('status', 'active')->count(),
            'total_participants' => Meeting::query()
                ->withCount('participants')
                ->get()
                ->sum('participants_count'),
        ]);
    }

    public function users(Request $request): AnonymousResourceCollection
    {
        $users = User::query()
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return UserResource::collection($users);
    }

    public function updateUser(Request $request, User $user): UserResource
    {
        $validated = $request->validate([
            'is_admin' => ['sometimes', 'boolean'],
            'name' => ['sometimes', 'string', 'max:255'],
        ]);

        $user->update($validated);

        return new UserResource($user->fresh());
    }

    public function meetings(Request $request): AnonymousResourceCollection
    {
        $meetings = Meeting::query()
            ->with('host')
            ->withCount('participants')
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return MeetingResource::collection($meetings);
    }

    public function destroyMeeting(Meeting $meeting): JsonResponse
    {
        $meeting->delete();

        return response()->json(['message' => 'Meeting deleted.']);
    }
}
