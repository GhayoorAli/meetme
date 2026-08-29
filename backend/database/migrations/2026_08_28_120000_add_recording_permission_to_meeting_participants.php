<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meeting_participants', function (Blueprint $table) {
            $table->string('recording_permission', 20)->default('none')->after('status');
            $table->index(['meeting_id', 'recording_permission']);
        });
    }

    public function down(): void
    {
        Schema::table('meeting_participants', function (Blueprint $table) {
            $table->dropIndex(['meeting_id', 'recording_permission']);
            $table->dropColumn('recording_permission');
        });
    }
};
