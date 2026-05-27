package com.perform.training

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DirectWatchSyncReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        DirectWatchSyncCoordinator.handleBroadcast(context, intent)
    }
}
