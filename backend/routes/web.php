<?php

use App\Http\Controllers\CsrfTokenController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return ['Laravel' => app()->version()];
});

Route::get('/csrf-token', CsrfTokenController::class);

require __DIR__.'/auth.php';
