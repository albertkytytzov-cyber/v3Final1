package com.perform.training

import java.time.Instant

object DirectWatchBluetoothSyncLock {
    private val monitor = Any()
    private var owner: String? = null
    private var acquiredAt: String? = null

    fun tryAcquire(nextOwner: String): Boolean {
        synchronized(monitor) {
            if (owner != null) {
                return false
            }
            owner = nextOwner
            acquiredAt = Instant.now().toString()
            return true
        }
    }

    fun release(currentOwner: String) {
        synchronized(monitor) {
            if (owner == currentOwner) {
                owner = null
                acquiredAt = null
            }
        }
    }

    fun isBusy(): Boolean {
        synchronized(monitor) {
            return owner != null
        }
    }

    fun status(): String? {
        synchronized(monitor) {
            return owner?.let { activeOwner ->
                val activeSince = acquiredAt
                if (activeSince.isNullOrBlank()) activeOwner else "$activeOwner since $activeSince"
            }
        }
    }
}
