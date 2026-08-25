<?php

use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\MeetingController;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', fn (Request $request) => new UserResource($request->user()));

    Route::get('/meetings', [MeetingController::class, 'index']);
    Route::post('/meetings', [MeetingController::class, 'store']);
    Route::post('/meetings/{code}/end', [MeetingController::class, 'end']);
    Route::get('/meetings/{code}/waiting', [MeetingController::class, 'waiting']);
    Route::post('/meetings/{code}/participants/{participant}/admit', [MeetingController::class, 'admit']);
    Route::post('/meetings/{code}/participants/{participant}/deny', [MeetingController::class, 'deny']);
});

Route::get('/meetings/{code}', [MeetingController::class, 'show']);
Route::post('/meetings/{code}/join', [MeetingController::class, 'join']);
Route::get('/meetings/{code}/join-status', [MeetingController::class, 'joinStatus']);
Route::post('/meetings/{code}/leave', [MeetingController::class, 'leave']);

Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/stats', [DashboardController::class, 'stats']);
    Route::get('/users', [DashboardController::class, 'users']);
    Route::patch('/users/{user}', [DashboardController::class, 'updateUser']);
    Route::get('/meetings', [DashboardController::class, 'meetings']);
    Route::delete('/meetings/{meeting}', [DashboardController::class, 'destroyMeeting']);
});
