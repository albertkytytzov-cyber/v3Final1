package com.perform.training

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothSocket
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.IOException
import java.security.SecureRandom
import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.math.roundToInt
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(
    name = "DirectWatch",
    permissions = [
        Permission(
            alias = "bluetoothScan",
            strings = [Manifest.permission.BLUETOOTH_SCAN],
        ),
        Permission(
            alias = "bluetoothConnect",
            strings = [Manifest.permission.BLUETOOTH_CONNECT],
        ),
        Permission(
            alias = "location",
            strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION],
        ),
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS],
        ),
    ],
)
class DirectWatchPlugin : Plugin() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val devicesByAddress = linkedMapOf<String, ScannedWatchDevice>()
    private var activeScanCallback: ScanCallback? = null
    private var activeGatt: BluetoothGatt? = null
    private var activeBondReceiver: BroadcastReceiver? = null
    private var activeClassicSocket: BluetoothSocket? = null
    private var activeClassicThread: Thread? = null
    private var activeClassicForegroundBridge = false
    private var activeSession: DirectWatchSession? = null
    private val sessionSubscribeQueue = java.util.ArrayDeque<NotifyCharacteristicSubscription>()
    private var pendingSessionSubscribe: NotifyCharacteristicSubscription? = null

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val response = JSObject()
        val adapter = bluetoothAdapter()
        response.put("available", adapter != null && context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE))
        response.put("bluetoothEnabled", adapter?.isEnabled == true)
        response.put("requiresLocationPermission", true)
        response.put("reason", if (adapter == null) "Bluetooth LE недоступен на этом телефоне." else null)
        call.resolve(response)
    }

    @PluginMethod
    fun requestAuthorization(call: PluginCall) {
        if (hasRequiredRuntimePermissions()) {
            call.resolve(permissionResponse(true))
            return
        }

        requestPermissionForAliases(requiredPermissionAliases(), call, "handlePermissionResult")
    }

    @PermissionCallback
    private fun handlePermissionResult(call: PluginCall) {
        call.resolve(permissionResponse(hasRequiredRuntimePermissions()))
    }

    @PluginMethod
    fun scanDevices(call: PluginCall) {
        val adapter = bluetoothAdapter()
        if (adapter == null || !context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)) {
            call.reject("Bluetooth LE недоступен на этом телефоне.")
            return
        }

        if (!adapter.isEnabled) {
            call.reject("Включите Bluetooth на телефоне и повторите поиск часов.")
            return
        }

        if (!hasRequiredRuntimePermissions()) {
            call.reject("Нужно разрешить PERFORM поиск и подключение Bluetooth-устройств.")
            return
        }

        val scanner = adapter.bluetoothLeScanner
        if (scanner == null) {
            call.reject("Сканер Bluetooth LE недоступен. Проверьте Bluetooth и геолокацию.")
            return
        }

        stopActiveScan()
        devicesByAddress.clear()

        val durationMs = call.getInt("durationMs") ?: DEFAULT_SCAN_DURATION_MS
        var didFinish = false
        fun finishScan(onFinish: () -> Unit) {
            if (didFinish) {
                return
            }
            didFinish = true
            stopActiveScan()
            onFinish()
        }
        val scanCallback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                recordScanResult(result)
            }

            override fun onBatchScanResults(results: MutableList<ScanResult>) {
                for (result in results) {
                    recordScanResult(result)
                }
            }

            override fun onScanFailed(errorCode: Int) {
                finishScan {
                    call.reject("Не удалось выполнить поиск часов: Bluetooth scan error $errorCode.")
                }
            }
        }

        activeScanCallback = scanCallback
        try {
            scanner.startScan(scanCallback)
        } catch (error: SecurityException) {
            finishScan {
                call.reject("Нет разрешения Bluetooth для поиска часов.", error)
            }
            return
        }

        mainHandler.postDelayed({
            finishScan {
                recordBondedDevices(adapter)
                val response = JSObject()
                response.put("devices", JSArray(devicesByAddress.values.map { it.toJson() }))
                response.put("scannedAt", java.time.Instant.now().toString())
                call.resolve(response)
            }
        }, durationMs.coerceIn(1_500, 12_000).toLong())
    }

    @PluginMethod
    fun inspectDevice(call: PluginCall) {
        val address = call.getString("deviceId")
        if (address.isNullOrBlank()) {
            call.reject("deviceId is required")
            return
        }

        val adapter = bluetoothAdapter()
        if (adapter == null || !adapter.isEnabled) {
            call.reject("Включите Bluetooth на телефоне и повторите проверку часов.")
            return
        }

        if (!hasRequiredRuntimePermissions()) {
            call.reject("Нужно разрешить PERFORM подключение к Bluetooth-устройствам.")
            return
        }

        stopActiveGatt()
        val device = try {
            adapter.getRemoteDevice(address)
        } catch (error: IllegalArgumentException) {
            call.reject("Некорректный идентификатор Bluetooth-устройства.", error)
            return
        }

        var didFinish = false
        fun finishInspection(onFinish: () -> Unit) {
            if (didFinish) {
                return
            }
            didFinish = true
            stopActiveGatt()
            onFinish()
        }
        val timeout = Runnable {
            finishInspection {
                call.reject("Часы не ответили на запрос сервисов. Держите их рядом и повторите.")
            }
        }

        val standardReadings = mutableListOf<JSObject>()
        val standardReadQueue = java.util.ArrayDeque<StandardCharacteristicRead>()
        var pendingStandardRead: StandardCharacteristicRead? = null
        var inspectionResponse: JSObject? = null

        fun finishWithInspectionResponse() {
            mainHandler.removeCallbacks(timeout)
            val response = inspectionResponse ?: JSObject()
            response.put("standardReadings", JSArray(standardReadings))
            finishInspection {
                call.resolve(response)
            }
        }

        fun readNextStandardCharacteristic(gatt: BluetoothGatt) {
            if (didFinish) {
                return
            }

            if (standardReadQueue.isEmpty()) {
                finishWithInspectionResponse()
                return
            }

            val request = standardReadQueue.removeFirst()
            if (!isReadableCharacteristic(request.characteristic)) {
                standardReadings.add(buildStandardReadingResponse(request, null, "not-readable", null))
                readNextStandardCharacteristic(gatt)
                return
            }

            pendingStandardRead = request
            val started = try {
                @Suppress("DEPRECATION")
                gatt.readCharacteristic(request.characteristic)
            } catch (error: SecurityException) {
                pendingStandardRead = null
                standardReadings.add(buildStandardReadingResponse(request, null, "error", "Нет разрешения Bluetooth для чтения характеристики."))
                readNextStandardCharacteristic(gatt)
                return
            }

            if (!started) {
                pendingStandardRead = null
                standardReadings.add(buildStandardReadingResponse(request, null, "error", "Android не начал чтение характеристики."))
                readNextStandardCharacteristic(gatt)
            }
        }

        fun handleStandardCharacteristicRead(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray?,
            status: Int,
        ) {
            val request = pendingStandardRead ?: return
            if (request.characteristic.uuid != characteristic.uuid) {
                return
            }

            pendingStandardRead = null
            val statusLabel = if (status == BluetoothGatt.GATT_SUCCESS) "read" else "error"
            val error = if (status == BluetoothGatt.GATT_SUCCESS) null else "Bluetooth status $status"
            standardReadings.add(buildStandardReadingResponse(request, value, statusLabel, error))
            readNextStandardCharacteristic(gatt)
        }

        val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    mainHandler.removeCallbacks(timeout)
                    finishInspection {
                        call.reject(gattStatusMessage(status))
                    }
                    return
                }

                if (newState == android.bluetooth.BluetoothProfile.STATE_CONNECTED) {
                    try {
                        gatt.discoverServices()
                    } catch (error: SecurityException) {
                        mainHandler.removeCallbacks(timeout)
                        finishInspection {
                            call.reject("Нет разрешения Bluetooth для чтения сервисов часов.", error)
                        }
                    }
                }
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    mainHandler.removeCallbacks(timeout)
                    finishInspection {
                        call.reject("Часы подключились, но не отдали список BLE-сервисов: Bluetooth status $status.")
                    }
                    return
                }

                inspectionResponse = buildInspectionResponse(device, gatt.services)
                standardReadQueue.addAll(standardCharacteristicReads(gatt.services))
                readNextStandardCharacteristic(gatt)
            }

            @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
            @Deprecated("Android keeps this callback for older Bluetooth stacks.")
            override fun onCharacteristicRead(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                status: Int,
            ) {
                handleStandardCharacteristicRead(gatt, characteristic, characteristic.value, status)
            }

            override fun onCharacteristicRead(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                value: ByteArray,
                status: Int,
            ) {
                handleStandardCharacteristicRead(gatt, characteristic, value, status)
            }
        }

        try {
            activeGatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            } else {
                device.connectGatt(context, false, callback)
            }
        } catch (error: SecurityException) {
            finishInspection {
                call.reject("Нет разрешения Bluetooth для подключения к часам.", error)
            }
            return
        }

        mainHandler.postDelayed(timeout, INSPECT_TIMEOUT_MS.toLong())
    }

    @PluginMethod
    fun startSession(call: PluginCall) {
        val address = call.getString("deviceId")
        if (address.isNullOrBlank()) {
            call.reject("deviceId is required")
            return
        }

        val adapter = bluetoothAdapter()
        if (adapter == null || !adapter.isEnabled) {
            call.reject("Включите Bluetooth на телефоне и повторите подключение часов.")
            return
        }

        if (!hasRequiredRuntimePermissions()) {
            call.reject("Нужно разрешить PERFORM подключение к Bluetooth-устройствам.")
            return
        }

        stopActiveGatt()
        val device = try {
            adapter.getRemoteDevice(address)
        } catch (error: IllegalArgumentException) {
            call.reject("Некорректный идентификатор Bluetooth-устройства.", error)
            return
        }

        val session = DirectWatchSession(
            deviceId = device.address,
            deviceName = devicesByAddress[device.address]?.name ?: scanResultNameFallback(device),
            startedAt = java.time.Instant.now().toString(),
        )
        activeSession = session

        var didFinish = false
        fun finishStart(onFinish: () -> Unit) {
            if (didFinish) {
                return
            }
            didFinish = true
            mainHandler.removeCallbacksAndMessages(SESSION_TIMEOUT_TOKEN)
            onFinish()
        }

        fun resolveWithSession() {
            finishStart {
                call.resolve(buildSessionStatus(session))
            }
        }

        fun failStart(message: String, error: Exception? = null) {
            finishStart {
                stopActiveGatt()
                if (error == null) {
                    call.reject(message)
                } else {
                    call.reject(message, error)
                }
            }
        }

        fun subscribeNext(gatt: BluetoothGatt) {
            val request = sessionSubscribeQueue.pollFirst()
            if (request == null) {
                pendingSessionSubscribe = null
                notifySessionStatus()
                resolveWithSession()
                return
            }

            val characteristic = request.characteristic
            val descriptor = characteristic.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_UUID)
            if (descriptor == null) {
                session.subscribed.add(buildSubscriptionStatus(request, "no-cccd", "Характеристика не отдала CCCD-дескриптор."))
                subscribeNext(gatt)
                return
            }

            val notificationEnabled = try {
                gatt.setCharacteristicNotification(characteristic, true)
            } catch (error: SecurityException) {
                session.subscribed.add(buildSubscriptionStatus(request, "error", "Нет разрешения Bluetooth для подписки."))
                subscribeNext(gatt)
                return
            }

            if (!notificationEnabled) {
                session.subscribed.add(buildSubscriptionStatus(request, "error", "Android не включил уведомления характеристики."))
                subscribeNext(gatt)
                return
            }

            pendingSessionSubscribe = request
            val descriptorValue = if (isIndicatableCharacteristic(characteristic)) {
                BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
            } else {
                BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            }
            val writeStarted = try {
                writeDescriptorCompat(gatt, descriptor, descriptorValue)
            } catch (error: SecurityException) {
                pendingSessionSubscribe = null
                session.subscribed.add(buildSubscriptionStatus(request, "error", "Нет разрешения Bluetooth для записи CCCD."))
                subscribeNext(gatt)
                return
            }

            if (!writeStarted) {
                pendingSessionSubscribe = null
                session.subscribed.add(buildSubscriptionStatus(request, "error", "Android не начал запись CCCD."))
                subscribeNext(gatt)
            }
        }

        fun handleDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            val request = pendingSessionSubscribe ?: return
            if (request.characteristic.uuid != descriptor.characteristic.uuid) {
                return
            }

            pendingSessionSubscribe = null
            if (status == BluetoothGatt.GATT_SUCCESS) {
                session.subscribed.add(buildSubscriptionStatus(request, "subscribed", null))
            } else {
                session.subscribed.add(buildSubscriptionStatus(request, "error", "Bluetooth status $status"))
            }
            subscribeNext(gatt)
        }

        fun handleCharacteristicChanged(characteristic: BluetoothGattCharacteristic, value: ByteArray?) {
            val currentSession = activeSession ?: return
            if (currentSession.deviceId != session.deviceId || value == null) {
                return
            }

            val packet = buildSessionPacket(currentSession, characteristic, value)
            currentSession.packetCount += 1
            currentSession.packets.addFirst(packet)
            while (currentSession.packets.size > MAX_SESSION_PACKETS) {
                currentSession.packets.removeLast()
            }
            notifyListeners("directWatchPacket", packet)
            notifySessionStatus()
        }

        val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    session.connected = false
                    notifySessionStatus()
                    failStart(gattStatusMessage(status))
                    return
                }

                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    session.connected = true
                    notifySessionStatus()
                    try {
                        gatt.discoverServices()
                    } catch (error: SecurityException) {
                        failStart("Нет разрешения Bluetooth для чтения сервисов часов.", error)
                    }
                    return
                }

                if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    session.connected = false
                    notifySessionStatus()
                    if (!didFinish) {
                        failStart("Часы отключились до завершения PERFORM Sync-сессии.")
                    }
                }
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    failStart("Часы подключились, но не отдали список BLE-сервисов: Bluetooth status $status.")
                    return
                }

                session.serviceCount = gatt.services.size
                sessionSubscribeQueue.clear()
                sessionSubscribeQueue.addAll(notificationCharacteristicSubscriptions(gatt.services))
                subscribeNext(gatt)
            }

            override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
                handleDescriptorWrite(gatt, descriptor, status)
            }

            @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
            @Deprecated("Android keeps this callback for older Bluetooth stacks.")
            override fun onCharacteristicChanged(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
            ) {
                handleCharacteristicChanged(characteristic, characteristic.value)
            }

            override fun onCharacteristicChanged(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                value: ByteArray,
            ) {
                handleCharacteristicChanged(characteristic, value)
            }
        }

        try {
            activeGatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            } else {
                device.connectGatt(context, false, callback)
            }
        } catch (error: SecurityException) {
            failStart("Нет разрешения Bluetooth для подключения к часам.", error)
            return
        }

        mainHandler.postAtTime({
            failStart("Часы не ответили на PERFORM Sync-сессию. Держите их рядом и повторите подключение.")
        }, SESSION_TIMEOUT_TOKEN, android.os.SystemClock.uptimeMillis() + SESSION_CONNECT_TIMEOUT_MS.toLong())
    }

    @PluginMethod
    fun stopSession(call: PluginCall) {
        val session = activeSession
        stopActiveGatt()
        val response = buildSessionStatus(session, connectedOverride = false)
        notifyListeners("directWatchSession", response)
        call.resolve(response)
    }

    @PluginMethod
    fun getSessionStatus(call: PluginCall) {
        call.resolve(buildSessionStatus(activeSession))
    }

    @PluginMethod
    fun getSyncServiceStatus(call: PluginCall) {
        call.resolve(DirectWatchForegroundService.status(context))
    }

    @PluginMethod
    fun stopSyncService(call: PluginCall) {
        stopActiveClassicSocket()
        DirectWatchForegroundService.stop(context.applicationContext)
        call.resolve(DirectWatchForegroundService.status(context))
    }

    @PluginMethod
    fun ackActivityFiles(call: PluginCall) {
        val address = call.getString("deviceId")
        val authKeyHex = call.getString("authKeyHex")?.trim()?.takeIf { it.isNotBlank() }
        val fileIdsJson = call.data.optJSONArray("fileIds")
        val fileIds = mutableListOf<ByteArray>()
        val seenFileIds = mutableSetOf<String>()
        if (fileIdsJson != null) {
            for (index in 0 until fileIdsJson.length()) {
                val fileId = parseHexBytes(fileIdsJson.optString(index, "").trim())
                if (fileId != null && fileId.size == CLASSIC_ACTIVITY_FILE_ID_BYTES) {
                    val idHex = fullHex(fileId)
                    if (idHex != null && seenFileIds.add(idHex)) {
                        fileIds.add(fileId)
                    }
                }
            }
        }

        if (address.isNullOrBlank()) {
            call.reject("deviceId is required")
            return
        }

        if (authKeyHex.isNullOrBlank()) {
            call.reject("Auth Key должен быть сохранён перед подтверждением файлов часов.")
            return
        }

        if (fileIds.isEmpty()) {
            call.reject("Нет корректных файлов часов для подтверждения.")
            return
        }

        val adapter = bluetoothAdapter()
        if (adapter == null || !adapter.isEnabled) {
            call.reject("Включите Bluetooth на телефоне и повторите подтверждение файлов часов.")
            return
        }

        if (!hasRequiredRuntimePermissions()) {
            call.reject("Нужно разрешить PERFORM подключение к Bluetooth-устройствам.")
            return
        }

        val device = try {
            adapter.getRemoteDevice(address)
        } catch (error: IllegalArgumentException) {
            call.reject("Некорректный идентификатор Bluetooth-устройства.", error)
            return
        }

        if (safeBondState(device) != BluetoothDevice.BOND_BONDED) {
            call.reject("Для подтверждения файлов часы должны быть в системном сопряжении.")
            return
        }

        stopActiveGatt()
        stopActiveClassicSocket()

        val worker = Thread {
            var socket: BluetoothSocket? = null
            val packets = mutableListOf<JSObject>()
            val acknowledgedFileIds = mutableListOf<String>()
            var connected = false
            var sentVersionRequest = false
            var sentSessionConfig = false
            var sentAuthStep1 = false
            var sentAuthStep2 = false
            var phoneNonce: ByteArray? = null
            var postAuthDecryptionKey: ByteArray? = null
            var errorMessage: String? = null
            val combined = java.io.ByteArrayOutputStream()

            try {
                try {
                    adapter.cancelDiscovery()
                } catch (_: SecurityException) {
                    // Discovery cancellation is best-effort.
                }

                socket = openClassicSocketWithRetry(device, "activity-ack")
                connected = true

                socket.outputStream.write(CLASSIC_SPP_V1_VERSION_REQUEST)
                socket.outputStream.flush()
                sentVersionRequest = true
                readClassicPackets(socket, packets, combined, CLASSIC_VERSION_READ_MS)

                val versionProbe = parseClassicProbeBytes(combined.toByteArray())
                val useSppV2 = shouldUseClassicSppV2(versionProbe.versionHex)
                if (useSppV2) {
                    socket.outputStream.write(buildClassicV2SessionConfigPacket(0))
                    socket.outputStream.flush()
                    sentSessionConfig = true
                    readClassicPackets(socket, packets, combined, CLASSIC_SESSION_CONFIG_READ_MS)
                }

                phoneNonce = ByteArray(16)
                SecureRandom().nextBytes(phoneNonce)
                socket.outputStream.write(
                    if (useSppV2) {
                        buildClassicV2AuthStep1Packet(phoneNonce, 0)
                    } else {
                        buildClassicAuthStep1Packet(phoneNonce)
                    },
                )
                socket.outputStream.flush()
                sentAuthStep1 = true
                errorMessage = readClassicPacketsUntilAuthStage(
                    socket,
                    packets,
                    combined,
                    "watch-nonce",
                    CLASSIC_PROBE_READ_MS,
                ) ?: errorMessage

                val parsedAuthStep1 = parseClassicProbeBytes(combined.toByteArray())
                val authStep2 = buildClassicAuthStep2Material(authKeyHex, phoneNonce, parsedAuthStep1)
                if (authStep2.status != "valid" || authStep2.authStep3Command == null) {
                    errorMessage = authStep2.error ?: "PERFORM Sync не смог авторизоваться для подтверждения файлов часов."
                } else {
                    if (useSppV2 && parsedAuthStep1.authPacketSequenceNumber != null) {
                        socket.outputStream.write(buildClassicV2AckPacket(parsedAuthStep1.authPacketSequenceNumber))
                        socket.outputStream.flush()
                    }
                    socket.outputStream.write(
                        if (useSppV2) {
                            buildClassicV2AuthStep2Packet(authStep2.authStep3Command, 1)
                        } else {
                            buildClassicAuthStep2Packet(authStep2.authStep3Command)
                        },
                    )
                    socket.outputStream.flush()
                    sentAuthStep2 = true
                    postAuthDecryptionKey = authStep2.decryptionKey
                    errorMessage = readClassicPacketsUntilAuthStage(
                        socket,
                        packets,
                        combined,
                        "authenticated",
                        CLASSIC_PROBE_READ_MS,
                    ) ?: errorMessage

                    val parsedAuthStep2 = parseClassicProbeBytes(combined.toByteArray())
                    if (!useSppV2 || parsedAuthStep2.authStage != "authenticated" || authStep2.encryptionKey == null) {
                        errorMessage = "Часы авторизовались не полностью: ACK файлов доступен только в SPP v2 после auth."
                    } else {
                        if (parsedAuthStep2.authPacketSequenceNumber != null) {
                            socket.outputStream.write(buildClassicV2AckPacket(parsedAuthStep2.authPacketSequenceNumber))
                            socket.outputStream.flush()
                        }

                        fileIds.forEachIndexed { index, fileId ->
                            val idHex = fullHex(fileId)
                            socket.outputStream.write(
                                buildClassicV2EncryptedCommandPacket(
                                    command = buildActivityFetchAckCommand(fileId),
                                    sequenceNumber = 2 + index,
                                    encryptionKey = authStep2.encryptionKey,
                                ),
                            )
                            if (idHex != null) {
                                acknowledgedFileIds.add(idHex)
                            }
                            Thread.sleep(CLASSIC_POST_AUTH_COMMAND_DELAY_MS)
                        }
                        socket.outputStream.flush()
                        errorMessage = readClassicPackets(socket, packets, combined, CLASSIC_ACTIVITY_ACK_READ_MS) ?: errorMessage
                    }
                }
            } catch (error: IOException) {
                errorMessage = classicSocketUserMessage(error)
            } catch (error: SecurityException) {
                errorMessage = "Нет разрешения Bluetooth для Classic/SPP-подключения."
            } catch (error: InterruptedException) {
                Thread.currentThread().interrupt()
                errorMessage = "Подтверждение файлов часов было остановлено."
            } finally {
                try {
                    socket?.close()
                } catch (_: IOException) {
                    // Socket is already closed.
                }
                if (activeClassicSocket == socket) {
                    activeClassicSocket = null
                }
                if (activeClassicThread == Thread.currentThread()) {
                    activeClassicThread = null
                }
            }

            val response = buildActivityAckResponse(
                device = device,
                connected = connected,
                sentVersionRequest = sentVersionRequest,
                sentSessionConfig = sentSessionConfig,
                sentAuthStep1 = sentAuthStep1,
                sentAuthStep2 = sentAuthStep2,
                acknowledgedFileIds = acknowledgedFileIds,
                phoneNonce = phoneNonce,
                authKeyHex = authKeyHex,
                postAuthDecryptionKey = postAuthDecryptionKey,
                packets = packets,
                combinedBytes = combined.toByteArray(),
                error = errorMessage,
            )
            mainHandler.post {
                call.resolve(response)
            }
        }
        activeClassicThread = worker
        worker.start()
    }

    @PluginMethod
    fun probeClassicSession(call: PluginCall) {
        val address = call.getString("deviceId")
        val authStep1 = call.getBoolean("authStep1") ?: false
        val postAuthProbe = call.getBoolean("postAuthProbe") ?: false
        val includeHistory = call.getBoolean("includeHistory") ?: true
        val includeSleep = call.getBoolean("includeSleep") ?: true
        val authKeyHex = call.getString("authKeyHex")?.trim()?.takeIf { it.isNotBlank() }
        val entryDate = call.getString("entryDate")?.trim()?.takeIf { isClassicEntryDate(it) }
        if (address.isNullOrBlank()) {
            call.reject("deviceId is required")
            return
        }

        val adapter = bluetoothAdapter()
        if (adapter == null || !adapter.isEnabled) {
            call.reject("Включите Bluetooth на телефоне и повторите проверку Classic/SPP.")
            return
        }

        if (!hasRequiredRuntimePermissions()) {
            call.reject("Нужно разрешить PERFORM подключение к Bluetooth-устройствам.")
            return
        }

        val device = try {
            adapter.getRemoteDevice(address)
        } catch (error: IllegalArgumentException) {
            call.reject("Некорректный идентификатор Bluetooth-устройства.", error)
            return
        }

        if (safeBondState(device) != BluetoothDevice.BOND_BONDED) {
            call.reject("Для проверки Classic/SPP часы должны быть в системном сопряжении. Нажмите “Сопрячь” и повторите проверку.")
            return
        }

        stopActiveGatt()
        stopActiveClassicSocket()

        val worker = Thread {
            var socket: BluetoothSocket? = null
            val packets = mutableListOf<JSObject>()
            var connected = false
            var sentVersionRequest = false
            var sentSessionConfig = false
            var sentAuthStep1 = false
            var sentAuthStep2 = false
            var sentPostAuthProbe = false
            var sentActivityFileProbe = false
            var activityFileProbeCount = 0
            var activityFileProbeCompletedCount = 0
            var activityFileProbeFailedCount = 0
            val activityFileProbeRequests = mutableListOf<JSObject>()
            var phoneNonce: ByteArray? = null
            var postAuthDecryptionKey: ByteArray? = null
            var errorMessage: String? = null
            val combined = java.io.ByteArrayOutputStream()

            try {
                try {
                    adapter.cancelDiscovery()
                } catch (_: SecurityException) {
                    // Discovery cancellation is best-effort; connection will report a clearer error if permission is gone.
                }

                socket = openClassicSocketWithRetry(device, "activity-probe")
                connected = true

                val versionRequest = CLASSIC_SPP_V1_VERSION_REQUEST
                socket.outputStream.write(versionRequest)
                socket.outputStream.flush()
                sentVersionRequest = true
                readClassicPackets(socket, packets, combined, CLASSIC_VERSION_READ_MS)

                if (authStep1) {
                    val versionProbe = parseClassicProbeBytes(combined.toByteArray())
                    val useSppV2 = shouldUseClassicSppV2(versionProbe.versionHex)
                    if (useSppV2) {
                        socket.outputStream.write(buildClassicV2SessionConfigPacket(0))
                        socket.outputStream.flush()
                        sentSessionConfig = true
                        readClassicPackets(socket, packets, combined, CLASSIC_SESSION_CONFIG_READ_MS)
                    }

                    phoneNonce = ByteArray(16)
                    SecureRandom().nextBytes(phoneNonce)
                    socket.outputStream.write(
                        if (useSppV2) {
                            buildClassicV2AuthStep1Packet(phoneNonce, 0)
                        } else {
                            buildClassicAuthStep1Packet(phoneNonce)
                        },
                    )
                    socket.outputStream.flush()
                    sentAuthStep1 = true

                    errorMessage = readClassicPacketsUntilAuthStage(
                        socket,
                        packets,
                        combined,
                        "watch-nonce",
                        CLASSIC_PROBE_READ_MS,
                    ) ?: errorMessage

                    val parsedAuthStep1 = parseClassicProbeBytes(combined.toByteArray())
                    val authStep2 = buildClassicAuthStep2Material(authKeyHex, phoneNonce, parsedAuthStep1)
                    if (authStep2.status == "valid" && authStep2.authStep3Command != null) {
                        if (useSppV2 && parsedAuthStep1.authPacketSequenceNumber != null) {
                            socket.outputStream.write(buildClassicV2AckPacket(parsedAuthStep1.authPacketSequenceNumber))
                            socket.outputStream.flush()
                        }
                        socket.outputStream.write(
                            if (useSppV2) {
                                buildClassicV2AuthStep2Packet(authStep2.authStep3Command, 1)
                            } else {
                                buildClassicAuthStep2Packet(authStep2.authStep3Command)
                            },
                        )
                        socket.outputStream.flush()
                        sentAuthStep2 = true
                        postAuthDecryptionKey = authStep2.decryptionKey
                        errorMessage = readClassicPacketsUntilAuthStage(
                            socket,
                            packets,
                            combined,
                            "authenticated",
                            CLASSIC_PROBE_READ_MS,
                        ) ?: errorMessage

                        val parsedAuthStep2 = parseClassicProbeBytes(combined.toByteArray())
                        if (postAuthProbe &&
                            useSppV2 &&
                            parsedAuthStep2.authStage == "authenticated" &&
                            authStep2.encryptionKey != null
                        ) {
                            if (parsedAuthStep2.authPacketSequenceNumber != null) {
                                socket.outputStream.write(buildClassicV2AckPacket(parsedAuthStep2.authPacketSequenceNumber))
                                socket.outputStream.flush()
                            }
                            val postAuthCommands = buildClassicPostAuthProbeCommands(includeHistory)
                            postAuthCommands.forEachIndexed { index, command ->
                                socket.outputStream.write(
                                    buildClassicV2EncryptedCommandPacket(
                                        command = command.payload,
                                        sequenceNumber = 2 + index,
                                        encryptionKey = authStep2.encryptionKey,
                                    ),
                                )
                                Thread.sleep(CLASSIC_POST_AUTH_COMMAND_DELAY_MS)
                            }
                            socket.outputStream.flush()
                            sentPostAuthProbe = true
                            val postAuthReadMs = if (includeHistory) {
                                CLASSIC_POST_AUTH_HISTORY_READ_MS
                            } else {
                                CLASSIC_POST_AUTH_READ_MS
                            }
                            errorMessage = if (includeHistory) {
                                readClassicPackets(socket, packets, combined, postAuthReadMs)
                            } else {
                                readClassicPacketsUntilActivitySelection(
                                    socket,
                                    packets,
                                    combined,
                                    authStep2.decryptionKey,
                                    entryDate,
                                    includeSleep,
                                    postAuthReadMs,
                                )
                            } ?: errorMessage

                            val allActivityFileIds = classicActivityFileIds(combined.toByteArray(), authStep2.decryptionKey)
                            val activityFileIds = selectClassicActivityFileIdsForEntryDate(allActivityFileIds, entryDate, includeSleep)
                            val allActivityFiles = allActivityFileIds.mapNotNull { parseClassicActivityFileIds(it).firstOrNull() }
                            val selectedActivityFiles = activityFileIds.mapNotNull { parseClassicActivityFileIds(it).firstOrNull() }
                            Log.i(
                                TAG,
                                "classic activity inventory entryDate=$entryDate total=${allActivityFileIds.size} " +
                                    "selected=${activityFileIds.size} breakdown=${describeClassicActivityInventoryFiles(allActivityFiles)} " +
                                    "selectedBreakdown=${describeClassicActivityInventoryFiles(selectedActivityFiles)} " +
                                    "ids=${activityFileIds.take(12).joinToString(",") { fullHex(it) ?: "-" }}",
                            )
                            if (activityFileIds.isNotEmpty()) {
                                val fetchResult = requestClassicActivityFilesSequentially(
                                    socket = socket,
                                    packets = packets,
                                    combined = combined,
                                    fileIds = activityFileIds,
                                    entryDate = entryDate,
                                    encryptionKey = authStep2.encryptionKey,
                                    decryptionKey = authStep2.decryptionKey,
                                    initialSequenceNumber = 2 + postAuthCommands.size,
                                )
                                sentActivityFileProbe = true
                                activityFileProbeCount = fetchResult.requestedCount
                                activityFileProbeCompletedCount = fetchResult.completedCount
                                activityFileProbeFailedCount = fetchResult.failedCount
                                activityFileProbeRequests.addAll(fetchResult.requests)
                                if (fetchResult.completedCount == 0) {
                                    errorMessage = fetchResult.error ?: errorMessage
                                }
                            }
                        }
                    }
                } else {
                    errorMessage = readClassicPackets(socket, packets, combined, CLASSIC_PROBE_READ_MS) ?: errorMessage
                }
            } catch (error: IOException) {
                errorMessage = classicSocketUserMessage(error)
            } catch (error: SecurityException) {
                errorMessage = "Нет разрешения Bluetooth для Classic/SPP-подключения."
            } catch (error: InterruptedException) {
                Thread.currentThread().interrupt()
                errorMessage = "Проверка Classic/SPP была остановлена."
            } finally {
                try {
                    socket?.close()
                } catch (_: IOException) {
                    // Socket is already closed.
                }
                if (activeClassicSocket == socket) {
                    activeClassicSocket = null
                }
                if (activeClassicThread == Thread.currentThread()) {
                    activeClassicThread = null
                }
            }

            val response = buildClassicProbeResponse(
                device = device,
                connected = connected,
                sentVersionRequest = sentVersionRequest,
                sentSessionConfig = sentSessionConfig,
                sentAuthStep1 = sentAuthStep1,
                sentAuthStep2 = sentAuthStep2,
                sentPostAuthProbe = sentPostAuthProbe,
                sentActivityFileProbe = sentActivityFileProbe,
                activityFileProbeCount = activityFileProbeCount,
                activityFileProbeCompletedCount = activityFileProbeCompletedCount,
                activityFileProbeFailedCount = activityFileProbeFailedCount,
                activityFileProbeRequests = activityFileProbeRequests,
                phoneNonce = phoneNonce,
                authKeyHex = authKeyHex,
                postAuthDecryptionKey = postAuthDecryptionKey,
                packets = packets,
                combinedBytes = combined.toByteArray(),
                error = errorMessage,
            )
            mainHandler.post {
                call.resolve(response)
            }
        }
        activeClassicThread = worker
        worker.start()
    }

    @PluginMethod
    fun syncService(call: PluginCall) {
        val address = call.getString("deviceId")
        val authKeyHex = call.getString("authKeyHex")?.trim()?.takeIf { it.isNotBlank() }
        val weatherPayload = call.data.optJSONObject("weather")
        val entryDate = call.getString("entryDate")?.trim()?.takeIf { it.isNotBlank() }
        val fetchActivity = call.getBoolean("fetchActivity") ?: false
        val includeHistory = call.getBoolean("includeHistory") ?: true
        val includeSleep = call.getBoolean("includeSleep") ?: true
        val keepAliveMs = (call.getInt("keepAliveMs") ?: 0).coerceIn(0, CLASSIC_SERVICE_BRIDGE_MAX_MS)
        val timeOffsetMinutes = (call.getInt("timeOffsetMinutes") ?: 0).coerceIn(-720, 720)
        if (address.isNullOrBlank()) {
            call.reject("deviceId is required")
            return
        }

        val adapter = bluetoothAdapter()
        if (adapter == null || !adapter.isEnabled) {
            call.reject("Включите Bluetooth на телефоне и повторите служебную синхронизацию.")
            return
        }

        if (!hasRequiredRuntimePermissions()) {
            call.reject("Нужно разрешить PERFORM подключение к Bluetooth-устройствам.")
            return
        }

        if (authKeyHex.isNullOrBlank()) {
            call.reject("Auth Key должен быть сохранён перед служебной синхронизацией.")
            return
        }

        val device = try {
            adapter.getRemoteDevice(address)
        } catch (error: IllegalArgumentException) {
            call.reject("Некорректный идентификатор Bluetooth-устройства.", error)
            return
        }

        if (safeBondState(device) != BluetoothDevice.BOND_BONDED) {
            call.reject("Для служебной синхронизации часы должны быть в системном сопряжении.")
            return
        }

        stopActiveGatt()
        stopActiveClassicSocket()

        val worker = Thread {
            var socket: BluetoothSocket? = null
            val packets = mutableListOf<JSObject>()
            val serviceCommands = mutableListOf<String>()
            var connected = false
            var sentVersionRequest = false
            var sentSessionConfig = false
            var sentAuthStep1 = false
            var sentAuthStep2 = false
            var phoneNonce: ByteArray? = null
            var postAuthDecryptionKey: ByteArray? = null
            var errorMessage: String? = null
            var resolved = false
            var nextServiceSequence = 2
            var foregroundServiceStarted = false
            var sentActivityFileProbe = false
            var activityFileProbeCount = 0
            var activityFileProbeCompletedCount = 0
            var activityFileProbeFailedCount = 0
            val activityFileProbeRequests = mutableListOf<JSObject>()
            val combined = java.io.ByteArrayOutputStream()
            val resolvedWeatherPayload = resolveClassicWeatherPayload(weatherPayload)

            fun resolveNow() {
                if (resolved) {
                    return
                }
                resolved = true
                val response = buildServiceSyncResponse(
                    device = device,
                    connected = connected,
                    sentVersionRequest = sentVersionRequest,
                    sentSessionConfig = sentSessionConfig,
                    sentAuthStep1 = sentAuthStep1,
                    sentAuthStep2 = sentAuthStep2,
                    sentServiceCommands = serviceCommands,
                    keepAliveMs = keepAliveMs,
                    phoneNonce = phoneNonce,
                    authKeyHex = authKeyHex,
                    postAuthDecryptionKey = postAuthDecryptionKey,
                    packets = packets,
                    combinedBytes = combined.toByteArray(),
                    error = errorMessage,
                    sentActivityFileProbe = sentActivityFileProbe,
                    activityFileProbeCount = activityFileProbeCount,
                    activityFileProbeCompletedCount = activityFileProbeCompletedCount,
                    activityFileProbeFailedCount = activityFileProbeFailedCount,
                    activityFileProbeRequests = activityFileProbeRequests,
                )
                mainHandler.post {
                    call.resolve(response)
                }
            }

            try {
                try {
                    adapter.cancelDiscovery()
                } catch (_: SecurityException) {
                    // Discovery cancellation is best-effort.
                }

                socket = openClassicSocketWithRetry(device, "service-sync")
                connected = true

                socket.outputStream.write(CLASSIC_SPP_V1_VERSION_REQUEST)
                socket.outputStream.flush()
                sentVersionRequest = true
                readClassicPackets(socket, packets, combined, CLASSIC_VERSION_READ_MS)

                val versionProbe = parseClassicProbeBytes(combined.toByteArray())
                val useSppV2 = shouldUseClassicSppV2(versionProbe.versionHex)
                if (useSppV2) {
                    socket.outputStream.write(buildClassicV2SessionConfigPacket(0))
                    socket.outputStream.flush()
                    sentSessionConfig = true
                    readClassicPackets(socket, packets, combined, CLASSIC_SESSION_CONFIG_READ_MS)
                }

                phoneNonce = ByteArray(16)
                SecureRandom().nextBytes(phoneNonce)
                socket.outputStream.write(
                    if (useSppV2) {
                        buildClassicV2AuthStep1Packet(phoneNonce, 0)
                    } else {
                        buildClassicAuthStep1Packet(phoneNonce)
                    },
                )
                socket.outputStream.flush()
                sentAuthStep1 = true
                errorMessage = readClassicPacketsUntilAuthStage(
                    socket,
                    packets,
                    combined,
                    "watch-nonce",
                    CLASSIC_PROBE_READ_MS,
                ) ?: errorMessage

                val parsedAuthStep1 = parseClassicProbeBytes(combined.toByteArray())
                val authStep2 = buildClassicAuthStep2Material(authKeyHex, phoneNonce, parsedAuthStep1)
                if (authStep2.status != "valid" || authStep2.authStep3Command == null) {
                    errorMessage = authStep2.error ?: "PERFORM Sync не смог авторизоваться для служебной синхронизации."
                } else {
                    if (useSppV2 && parsedAuthStep1.authPacketSequenceNumber != null) {
                        socket.outputStream.write(buildClassicV2AckPacket(parsedAuthStep1.authPacketSequenceNumber))
                        socket.outputStream.flush()
                    }
                    socket.outputStream.write(
                        if (useSppV2) {
                            buildClassicV2AuthStep2Packet(authStep2.authStep3Command, 1)
                        } else {
                            buildClassicAuthStep2Packet(authStep2.authStep3Command)
                        },
                    )
                    socket.outputStream.flush()
                    sentAuthStep2 = true
                    postAuthDecryptionKey = authStep2.decryptionKey
                    errorMessage = readClassicPacketsUntilAuthStage(
                        socket,
                        packets,
                        combined,
                        "authenticated",
                        CLASSIC_PROBE_READ_MS,
                    ) ?: errorMessage

                    val parsedAuthStep2 = parseClassicProbeBytes(combined.toByteArray())
                    if (!useSppV2 || parsedAuthStep2.authStage != "authenticated" || authStep2.encryptionKey == null) {
                        errorMessage = "Часы авторизовались не полностью: служебные команды доступны только в SPP v2 после auth."
                    } else {
                        if (parsedAuthStep2.authPacketSequenceNumber != null) {
                            socket.outputStream.write(buildClassicV2AckPacket(parsedAuthStep2.authPacketSequenceNumber))
                            socket.outputStream.flush()
                        }

                        if (fetchActivity) {
                            val postAuthCommands = buildClassicPostAuthProbeCommands(includeHistory)
                            postAuthCommands.forEach { command ->
                                socket.outputStream.write(
                                    buildClassicV2EncryptedCommandPacket(
                                        command = command.payload,
                                        sequenceNumber = nextServiceSequence++,
                                        encryptionKey = authStep2.encryptionKey,
                                    ),
                                )
                                Thread.sleep(CLASSIC_POST_AUTH_COMMAND_DELAY_MS)
                            }
                            socket.outputStream.flush()
                            val postAuthReadMs = if (includeHistory) {
                                CLASSIC_POST_AUTH_HISTORY_READ_MS
                            } else {
                                CLASSIC_POST_AUTH_READ_MS
                            }
                            val inventoryError = if (includeHistory) {
                                readClassicPackets(socket, packets, combined, postAuthReadMs)
                            } else {
                                readClassicPacketsUntilActivitySelection(
                                    socket,
                                    packets,
                                    combined,
                                    authStep2.decryptionKey,
                                    entryDate,
                                    includeSleep,
                                    postAuthReadMs,
                                )
                            }
                            if (inventoryError != null) {
                                Log.w(TAG, "classic service activity inventory warning: $inventoryError")
                            }

                            val allActivityFileIds = classicActivityFileIds(combined.toByteArray(), authStep2.decryptionKey)
                            val activityFileIds = selectClassicActivityFileIdsForEntryDate(allActivityFileIds, entryDate, includeSleep)
                            val allActivityFiles = allActivityFileIds.mapNotNull { parseClassicActivityFileIds(it).firstOrNull() }
                            val selectedActivityFiles = activityFileIds.mapNotNull { parseClassicActivityFileIds(it).firstOrNull() }
                            Log.i(
                                TAG,
                                "classic service activity inventory entryDate=$entryDate total=${allActivityFileIds.size} " +
                                    "selected=${activityFileIds.size} breakdown=${describeClassicActivityInventoryFiles(allActivityFiles)} " +
                                    "selectedBreakdown=${describeClassicActivityInventoryFiles(selectedActivityFiles)} " +
                                    "ids=${activityFileIds.take(12).joinToString(",") { fullHex(it) ?: "-" }}",
                            )
                            if (activityFileIds.isNotEmpty()) {
                                val fetchResult = requestClassicActivityFilesSequentially(
                                    socket = socket,
                                    packets = packets,
                                    combined = combined,
                                    fileIds = activityFileIds,
                                    entryDate = entryDate,
                                    encryptionKey = authStep2.encryptionKey,
                                    decryptionKey = authStep2.decryptionKey,
                                    initialSequenceNumber = nextServiceSequence,
                                )
                                nextServiceSequence = fetchResult.nextSequenceNumber
                                sentActivityFileProbe = true
                                activityFileProbeCount = fetchResult.requestedCount
                                activityFileProbeCompletedCount = fetchResult.completedCount
                                activityFileProbeFailedCount = fetchResult.failedCount
                                activityFileProbeRequests.addAll(fetchResult.requests)
                                if (fetchResult.completedCount == 0 && fetchResult.error != null) {
                                    Log.w(TAG, "classic service activity fetch warning: ${fetchResult.error}")
                                }
                            }
                        }

                        val serviceSyncCommands = buildClassicServiceSyncCommands(resolvedWeatherPayload, timeOffsetMinutes)
                        serviceSyncCommands.forEach { command ->
                            socket.outputStream.write(
                                buildClassicV2EncryptedCommandPacket(
                                    command = command.payload,
                                    sequenceNumber = nextServiceSequence++,
                                    encryptionKey = authStep2.encryptionKey,
                                ),
                            )
                            serviceCommands.add(command.label)
                            Thread.sleep(CLASSIC_POST_AUTH_COMMAND_DELAY_MS)
                        }
                        socket.outputStream.flush()
                        errorMessage = readClassicPackets(socket, packets, combined, CLASSIC_SERVICE_SYNC_READ_MS) ?: errorMessage
                        if (keepAliveMs > 0 && errorMessage == null) {
                            DirectWatchForegroundService.start(
                                context.applicationContext,
                                device.address,
                                devicesByAddress[device.address]?.name ?: scanResultNameFallback(device),
                                keepAliveMs.toLong(),
                            )
                            foregroundServiceStarted = true
                            activeClassicForegroundBridge = true
                            serviceCommands.add("bluetooth-bridge")
                            resolveNow()
                            keepAliveClassicServiceBridge(
                                socket = socket,
                                packets = packets,
                                combined = combined,
                                encryptionKey = authStep2.encryptionKey,
                                decryptionKey = authStep2.decryptionKey,
                                weatherPayload = resolvedWeatherPayload,
                                initialSequenceNumber = nextServiceSequence,
                                durationMs = keepAliveMs.toLong(),
                            )
                        }
                    }
                }
            } catch (error: IOException) {
                errorMessage = classicSocketUserMessage(error)
            } catch (error: SecurityException) {
                errorMessage = "Нет разрешения Bluetooth для Classic/SPP-подключения."
            } catch (error: InterruptedException) {
                Thread.currentThread().interrupt()
                errorMessage = "Служебная синхронизация была остановлена."
            } finally {
                try {
                    socket?.close()
                } catch (_: IOException) {
                    // Socket is already closed.
                }
                if (activeClassicSocket == socket) {
                    activeClassicSocket = null
                }
                if (activeClassicThread == Thread.currentThread()) {
                    activeClassicThread = null
                }
                if (foregroundServiceStarted) {
                    activeClassicForegroundBridge = false
                    DirectWatchForegroundService.stop(context.applicationContext)
                }
            }

            resolveNow()
        }
        activeClassicThread = worker
        worker.start()
    }

    @PluginMethod
    fun pairDevice(call: PluginCall) {
        val address = call.getString("deviceId")
        if (address.isNullOrBlank()) {
            call.reject("deviceId is required")
            return
        }

        val adapter = bluetoothAdapter()
        if (adapter == null || !adapter.isEnabled) {
            call.reject("Включите Bluetooth на телефоне и повторите сопряжение часов.")
            return
        }

        if (!hasRequiredRuntimePermissions()) {
            call.reject("Нужно разрешить PERFORM подключение к Bluetooth-устройствам.")
            return
        }

        val device = try {
            adapter.getRemoteDevice(address)
        } catch (error: IllegalArgumentException) {
            call.reject("Некорректный идентификатор Bluetooth-устройства.", error)
            return
        }

        val initialBondState = safeBondState(device)
        if (initialBondState == BluetoothDevice.BOND_BONDED) {
            call.resolve(buildPairingResponse(device, pairingStarted = false, status = "already-bonded"))
            return
        }

        stopActiveBondReceiver()

        var didFinish = false
        fun finishPairing(onFinish: () -> Unit) {
            if (didFinish) {
                return
            }
            didFinish = true
            mainHandler.removeCallbacksAndMessages(PAIRING_TIMEOUT_TOKEN)
            stopActiveBondReceiver()
            onFinish()
        }

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != BluetoothDevice.ACTION_BOND_STATE_CHANGED) {
                    return
                }

                val changedDevice = intentBluetoothDevice(intent)
                if (changedDevice?.address != device.address) {
                    return
                }

                val state = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR)
                if (state == BluetoothDevice.BOND_BONDED) {
                    finishPairing {
                        call.resolve(buildPairingResponse(device, pairingStarted = true, status = "bonded"))
                    }
                } else if (state == BluetoothDevice.BOND_NONE) {
                    finishPairing {
                        call.resolve(buildPairingResponse(device, pairingStarted = true, status = "not-bonded"))
                    }
                }
            }
        }

        activeBondReceiver = receiver
        try {
            val filter = IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                context.registerReceiver(receiver, filter)
            }
        } catch (error: RuntimeException) {
            activeBondReceiver = null
            call.reject("Не удалось подготовить системное сопряжение часов.", error)
            return
        }

        val pairingStarted = try {
            device.createBond()
        } catch (error: SecurityException) {
            finishPairing {
                call.reject("Нет разрешения Bluetooth для сопряжения с часами.", error)
            }
            return
        }

        if (!pairingStarted) {
            finishPairing {
                call.resolve(buildPairingResponse(device, pairingStarted = false, status = "not-started"))
            }
            return
        }

        mainHandler.postAtTime({
            finishPairing {
                call.resolve(buildPairingResponse(device, pairingStarted = true, status = "timeout"))
            }
        }, PAIRING_TIMEOUT_TOKEN, android.os.SystemClock.uptimeMillis() + PAIR_TIMEOUT_MS.toLong())
    }

    @PluginMethod
    fun unpairDevice(call: PluginCall) {
        val address = call.getString("deviceId")
        if (address.isNullOrBlank()) {
            call.reject("deviceId is required")
            return
        }

        val adapter = bluetoothAdapter()
        if (adapter == null || !adapter.isEnabled) {
            call.reject("Включите Bluetooth на телефоне и повторите отвязку часов.")
            return
        }

        if (!hasRequiredRuntimePermissions()) {
            call.reject("Нужно разрешить PERFORM подключение к Bluetooth-устройствам.")
            return
        }

        val device = try {
            adapter.getRemoteDevice(address)
        } catch (error: IllegalArgumentException) {
            call.reject("Некорректный идентификатор Bluetooth-устройства.", error)
            return
        }

        val initialBondState = safeBondState(device)
        if (initialBondState == BluetoothDevice.BOND_NONE) {
            call.resolve(buildPairingResponse(device, pairingStarted = false, status = "already-unpaired"))
            return
        }

        stopActiveBondReceiver()

        var didFinish = false
        fun finishUnpairing(onFinish: () -> Unit) {
            if (didFinish) {
                return
            }
            didFinish = true
            mainHandler.removeCallbacksAndMessages(PAIRING_TIMEOUT_TOKEN)
            stopActiveBondReceiver()
            onFinish()
        }

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != BluetoothDevice.ACTION_BOND_STATE_CHANGED) {
                    return
                }

                val changedDevice = intentBluetoothDevice(intent)
                if (changedDevice?.address != device.address) {
                    return
                }

                val state = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR)
                if (state == BluetoothDevice.BOND_NONE) {
                    finishUnpairing {
                        call.resolve(buildPairingResponse(device, pairingStarted = true, status = "unpaired"))
                    }
                } else if (state == BluetoothDevice.BOND_BONDED) {
                    finishUnpairing {
                        call.resolve(buildPairingResponse(device, pairingStarted = true, status = "still-bonded"))
                    }
                }
            }
        }

        activeBondReceiver = receiver
        try {
            val filter = IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                context.registerReceiver(receiver, filter)
            }
        } catch (error: RuntimeException) {
            activeBondReceiver = null
            call.reject("Не удалось подготовить сброс системного сопряжения часов.", error)
            return
        }

        if (initialBondState == BluetoothDevice.BOND_BONDING) {
            try {
                val cancelMethod = device.javaClass.getMethod("cancelBondProcess")
                cancelMethod.invoke(device)
            } catch (_: ReflectiveOperationException) {
                // Some Android builds hide cancelBondProcess; removeBond below is still the main reset path.
            } catch (_: SecurityException) {
                // removeBond will report a permission error if Bluetooth access is gone.
            }
        }

        val unpairStarted = try {
            val method = device.javaClass.getMethod("removeBond")
            method.invoke(device) as? Boolean ?: false
        } catch (error: ReflectiveOperationException) {
            finishUnpairing {
                call.reject("Android не дал программно удалить системное сопряжение часов.", error)
            }
            return
        } catch (error: SecurityException) {
            finishUnpairing {
                call.reject("Нет разрешения Bluetooth для удаления сопряжения часов.", error)
            }
            return
        }

        if (!unpairStarted) {
            finishUnpairing {
                call.resolve(buildPairingResponse(device, pairingStarted = false, status = "not-started"))
            }
            return
        }

        if (safeBondState(device) == BluetoothDevice.BOND_NONE) {
            finishUnpairing {
                call.resolve(buildPairingResponse(device, pairingStarted = true, status = "unpaired"))
            }
            return
        }

        mainHandler.postAtTime({
            finishUnpairing {
                call.resolve(buildPairingResponse(device, pairingStarted = true, status = "timeout"))
            }
        }, PAIRING_TIMEOUT_TOKEN, android.os.SystemClock.uptimeMillis() + PAIR_TIMEOUT_MS.toLong())
    }

    override fun handleOnDestroy() {
        stopActiveScan()
        stopActiveGatt()
        if (!activeClassicForegroundBridge) {
            stopActiveClassicSocket()
        }
        stopActiveBondReceiver()
        super.handleOnDestroy()
    }

    private fun bluetoothAdapter(): BluetoothAdapter? {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return manager?.adapter
    }

    private fun hasRequiredRuntimePermissions(): Boolean {
        return requiredPermissions().all { permission ->
            ActivityCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requiredPermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            )
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    private fun requiredPermissionAliases(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf("bluetoothScan", "bluetoothConnect", "location", "notifications")
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf("bluetoothScan", "bluetoothConnect", "location")
        } else {
            arrayOf("location")
        }
    }

    private fun permissionResponse(granted: Boolean): JSObject {
        val response = JSObject()
        response.put("granted", granted)
        response.put(
            "reason",
            if (granted) null else "Нужно разрешить PERFORM поиск и подключение Bluetooth-устройств.",
        )
        return response
    }

    private fun recordScanResult(result: ScanResult) {
        val device = result.device ?: return
        val address = device.address ?: return
        val name = scanResultName(result, device)
        val previous = devicesByAddress[address]
        val bondState = safeBondState(device)
        val deviceType = safeDeviceType(device)
        devicesByAddress[address] = ScannedWatchDevice(
            id = address,
            name = name ?: previous?.name,
            rssi = maxOf(result.rssi, previous?.rssi ?: result.rssi),
            isLikelyWatch = isLikelyWatchName(name),
            bondState = bondState,
            bondStateLabel = bondStateLabel(bondState),
            deviceType = deviceType,
            deviceTypeLabel = deviceTypeLabel(deviceType),
            isConnectable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) result.isConnectable else null,
            serviceUuids = result.scanRecord?.serviceUuids?.map { it.uuid.toString() }.orEmpty(),
            manufacturerData = manufacturerData(result),
            serviceData = serviceData(result),
            txPowerLevel = result.scanRecord?.txPowerLevel?.takeIf { it != Int.MIN_VALUE },
        )
    }

    private fun recordBondedDevices(adapter: BluetoothAdapter) {
        val bondedDevices = try {
            adapter.bondedDevices
        } catch (_: SecurityException) {
            emptySet<BluetoothDevice>()
        }

        for (device in bondedDevices) {
            val address = device.address ?: continue
            val name = scanResultNameFallback(device)
            val previous = devicesByAddress[address]
            val isLikelyWatch = isLikelyWatchName(name) || previous?.isLikelyWatch == true
            if (!isLikelyWatch && previous == null) {
                continue
            }

            val bondState = safeBondState(device)
            val deviceType = safeDeviceType(device)
            devicesByAddress[address] = ScannedWatchDevice(
                id = address,
                name = name ?: previous?.name,
                rssi = previous?.rssi,
                isLikelyWatch = isLikelyWatch,
                bondState = bondState,
                bondStateLabel = bondStateLabel(bondState),
                deviceType = deviceType,
                deviceTypeLabel = deviceTypeLabel(deviceType),
                isConnectable = previous?.isConnectable,
                serviceUuids = safeDeviceUuids(device).ifEmpty { previous?.serviceUuids.orEmpty() },
                manufacturerData = previous?.manufacturerData ?: JSArray(),
                serviceData = previous?.serviceData ?: JSArray(),
                txPowerLevel = previous?.txPowerLevel,
            )
        }
    }

    private fun scanResultName(result: ScanResult, device: BluetoothDevice): String? {
        result.scanRecord?.deviceName?.takeIf { it.isNotBlank() }?.let { return it }
        return try {
            device.name?.takeIf { it.isNotBlank() }
        } catch (_: SecurityException) {
            null
        }
    }

    private fun isLikelyWatchName(name: String?): Boolean {
        val normalized = name?.lowercase(Locale.ROOT) ?: return false
        return WATCH_NAME_HINTS.any { hint -> normalized.contains(hint) }
    }

    private fun buildInspectionResponse(device: BluetoothDevice, services: List<BluetoothGattService>): JSObject {
        val serviceItems = services.map { service ->
            val item = JSObject()
            item.put("uuid", service.uuid.toString())
            item.put("name", knownServiceName(service.uuid))
            item.put("characteristics", JSArray(service.characteristics.map { characteristic ->
                val characteristicItem = JSObject()
                characteristicItem.put("uuid", characteristic.uuid.toString())
                characteristicItem.put("name", knownCharacteristicName(characteristic.uuid))
                characteristicItem.put("properties", characteristicProperties(characteristic))
                characteristicItem
            }))
            item
        }

        val serviceUuids = services.map { it.uuid }
        val heartRateMeasurement = findCharacteristic(services, HEART_RATE_SERVICE_UUID, HEART_RATE_MEASUREMENT_UUID)
        val batteryLevel = findCharacteristic(services, BATTERY_SERVICE_UUID, BATTERY_LEVEL_UUID)
        val readableDeviceInfo = DEVICE_INFO_CHARACTERISTIC_UUIDS
            .mapNotNull { uuid -> findCharacteristic(services, DEVICE_INFO_SERVICE_UUID, uuid) }
            .any { characteristic -> isReadableCharacteristic(characteristic) }
        val unknownServices = services.filter { service -> knownServiceName(service.uuid) == "Unknown" }
        val response = JSObject()
        response.put("deviceId", device.address)
        response.put("deviceName", devicesByAddress[device.address]?.name ?: scanResultNameFallback(device))
        response.put("bondState", bondStateLabel(safeBondState(device)))
        response.put("bondStateCode", safeBondState(device))
        response.put("deviceType", deviceTypeLabel(safeDeviceType(device)))
        response.put("deviceTypeCode", safeDeviceType(device))
        response.put("hasHeartRateService", serviceUuids.contains(HEART_RATE_SERVICE_UUID))
        response.put("hasBatteryService", serviceUuids.contains(BATTERY_SERVICE_UUID))
        response.put("hasDeviceInfoService", serviceUuids.contains(DEVICE_INFO_SERVICE_UUID))
        response.put("canSubscribeHeartRate", heartRateMeasurement?.let { canNotifyCharacteristic(it) } == true)
        response.put("canReadBatteryLevel", batteryLevel?.let { isReadableCharacteristic(it) } == true)
        response.put("canReadDeviceInfo", readableDeviceInfo)
        response.put("serviceCount", services.size)
        response.put("unknownServiceCount", unknownServices.size)
        response.put("proprietaryServiceCount", unknownServices.count { service -> !isBluetoothSigUuid(service.uuid) })
        response.put("services", JSArray(serviceItems))
        response.put("inspectedAt", java.time.Instant.now().toString())
        return response
    }

    private fun buildPairingResponse(device: BluetoothDevice, pairingStarted: Boolean, status: String): JSObject {
        val response = JSObject()
        val bondState = safeBondState(device)
        response.put("deviceId", device.address)
        response.put("deviceName", devicesByAddress[device.address]?.name ?: scanResultNameFallback(device))
        response.put("pairingStarted", pairingStarted)
        response.put("status", status)
        response.put("bondState", bondStateLabel(bondState))
        response.put("bondStateCode", bondState)
        response.put("pairedAt", java.time.Instant.now().toString())
        return response
    }

    private fun gattStatusMessage(status: Int): String {
        if (status == 133) {
            return "Часы найдены, но не открыли прямое BLE-подключение. " +
                "Обычно это значит, что канал занят Mi Fitness, часы не рекламируют GATT-сервисы или здоровье закрыто протоколом Xiaomi."
        }

        return "Не удалось подключиться к часам: Bluetooth status $status."
    }

    private fun safeMessage(error: Exception): String {
        return error.message ?: error.javaClass.simpleName
    }

    private fun scanResultNameFallback(device: BluetoothDevice): String? {
        return try {
            device.name
        } catch (_: SecurityException) {
            null
        }
    }

    private fun characteristicProperties(characteristic: BluetoothGattCharacteristic): JSArray {
        val properties = mutableListOf<String>()
        val value = characteristic.properties
        if (value and BluetoothGattCharacteristic.PROPERTY_READ != 0) properties.add("read")
        if (value and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) properties.add("notify")
        if (value and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0) properties.add("indicate")
        if (value and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) properties.add("write")
        if (value and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0) properties.add("write-no-response")
        return JSArray(properties)
    }

    private fun isReadableCharacteristic(characteristic: BluetoothGattCharacteristic): Boolean {
        return characteristic.properties and BluetoothGattCharacteristic.PROPERTY_READ != 0
    }

    private fun canNotifyCharacteristic(characteristic: BluetoothGattCharacteristic): Boolean {
        val properties = characteristic.properties
        return properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0 ||
            properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0
    }

    private fun standardCharacteristicReads(services: List<BluetoothGattService>): List<StandardCharacteristicRead> {
        val requests = mutableListOf<StandardCharacteristicRead>()
        val seenCharacteristics = mutableSetOf<String>()

        fun addRequest(request: StandardCharacteristicRead?) {
            if (request == null) {
                return
            }

            val key = "${request.serviceUuid}:${request.characteristic.uuid}"
            if (seenCharacteristics.add(key)) {
                requests.add(request)
            }
        }

        listOfNotNull(
            standardReadRequest(services, BATTERY_SERVICE_UUID, BATTERY_LEVEL_UUID, "battery", "Battery Level"),
            standardReadRequest(services, DEVICE_INFO_SERVICE_UUID, MANUFACTURER_NAME_UUID, "manufacturer", "Manufacturer Name"),
            standardReadRequest(services, DEVICE_INFO_SERVICE_UUID, MODEL_NUMBER_UUID, "model", "Model Number"),
            standardReadRequest(services, DEVICE_INFO_SERVICE_UUID, SERIAL_NUMBER_UUID, "serial", "Serial Number"),
            standardReadRequest(services, DEVICE_INFO_SERVICE_UUID, FIRMWARE_REVISION_UUID, "firmware", "Firmware Revision"),
            standardReadRequest(services, DEVICE_INFO_SERVICE_UUID, HARDWARE_REVISION_UUID, "hardware", "Hardware Revision"),
            standardReadRequest(services, DEVICE_INFO_SERVICE_UUID, SOFTWARE_REVISION_UUID, "software", "Software Revision"),
            standardReadRequest(services, HEART_RATE_SERVICE_UUID, BODY_SENSOR_LOCATION_UUID, "body-sensor", "Body Sensor Location"),
        ).forEach(::addRequest)

        for (service in services) {
            for (characteristic in service.characteristics) {
                if (!isReadableCharacteristic(characteristic)) {
                    continue
                }

                val knownName = knownCharacteristicName(characteristic.uuid)
                addRequest(
                    StandardCharacteristicRead(
                        serviceUuid = service.uuid,
                        characteristic = characteristic,
                        kind = "unknown",
                        name = if (knownName != "Unknown") knownName else "Readable ${shortUuid(characteristic.uuid)}",
                    ),
                )
            }
        }

        return requests.take(MAX_STANDARD_READS)
    }

    private fun standardReadRequest(
        services: List<BluetoothGattService>,
        serviceUuid: UUID,
        characteristicUuid: UUID,
        kind: String,
        name: String,
    ): StandardCharacteristicRead? {
        val characteristic = findCharacteristic(services, serviceUuid, characteristicUuid) ?: return null
        return StandardCharacteristicRead(serviceUuid, characteristic, kind, name)
    }

    private fun findCharacteristic(
        services: List<BluetoothGattService>,
        serviceUuid: UUID,
        characteristicUuid: UUID,
    ): BluetoothGattCharacteristic? {
        return services
            .firstOrNull { service -> service.uuid == serviceUuid }
            ?.characteristics
            ?.firstOrNull { characteristic -> characteristic.uuid == characteristicUuid }
    }

    private fun buildStandardReadingResponse(
        request: StandardCharacteristicRead,
        value: ByteArray?,
        status: String,
        error: String?,
    ): JSObject {
        val item = JSObject()
        item.put("serviceUuid", request.serviceUuid.toString())
        item.put("uuid", request.characteristic.uuid.toString())
        item.put("kind", request.kind)
        item.put("name", request.name)
        item.put("status", status)
        item.put("error", error)
        item.put("rawHex", bytePreviewHex(value, 24))

        if (status == "read" && value != null) {
            when (request.kind) {
                "battery" -> item.put("numericValue", value.firstOrNull()?.toInt()?.and(0xff))
                "body-sensor" -> item.put("numericValue", value.firstOrNull()?.toInt()?.and(0xff))
                else -> item.put("textValue", value.toString(Charsets.UTF_8).trim().takeIf { it.isNotBlank() })
            }
        }

        return item
    }

    private fun manufacturerData(result: ScanResult): JSArray {
        val data = result.scanRecord?.manufacturerSpecificData ?: return JSArray()
        return JSArray((0 until data.size()).map { index ->
            val item = JSObject()
            val bytes = data.valueAt(index)
            item.put("companyId", data.keyAt(index))
            item.put("byteLength", bytes?.size ?: 0)
            item.put("previewHex", bytePreviewHex(bytes))
            item
        })
    }

    private fun serviceData(result: ScanResult): JSArray {
        val data = result.scanRecord?.serviceData ?: return JSArray()
        return JSArray(data.map { (uuid, bytes) ->
            val item = JSObject()
            item.put("uuid", uuid.uuid.toString())
            item.put("byteLength", bytes?.size ?: 0)
            item.put("previewHex", bytePreviewHex(bytes))
            item
        })
    }

    private fun bytePreviewHex(bytes: ByteArray?, maxBytes: Int = 12): String? {
        if (bytes == null || bytes.isEmpty()) {
            return null
        }

        return bytes.take(maxBytes).joinToString("") { byte -> "%02X".format(byte.toInt() and 0xff) }
    }

    private fun isBluetoothSigUuid(uuid: UUID): Boolean {
        val value = uuid.toString().lowercase(Locale.ROOT)
        return value.startsWith("0000") && value.endsWith("-0000-1000-8000-00805f9b34fb")
    }

    private fun shortUuid(uuid: UUID): String {
        val value = uuid.toString().lowercase(Locale.ROOT)
        return if (isBluetoothSigUuid(uuid)) value.substring(4, 8) else value.take(8)
    }

    private fun knownServiceName(uuid: UUID): String {
        return when (uuid) {
            HEART_RATE_SERVICE_UUID -> "Heart Rate"
            BATTERY_SERVICE_UUID -> "Battery"
            DEVICE_INFO_SERVICE_UUID -> "Device Information"
            GENERIC_ACCESS_SERVICE_UUID -> "Generic Access"
            GENERIC_ATTRIBUTE_SERVICE_UUID -> "Generic Attribute"
            XIAOMI_FE95_SERVICE_UUID -> "Xiaomi FE95"
            XIAOMI_FDAB_SERVICE_UUID -> "Xiaomi FDAB"
            XIAOMI_CUSTOM_SERVICE_UUID -> "Xiaomi Private"
            else -> "Unknown"
        }
    }

    private fun knownCharacteristicName(uuid: UUID): String {
        return when (uuid) {
            HEART_RATE_MEASUREMENT_UUID -> "Heart Rate Measurement"
            BATTERY_LEVEL_UUID -> "Battery Level"
            MANUFACTURER_NAME_UUID -> "Manufacturer Name"
            MODEL_NUMBER_UUID -> "Model Number"
            SERIAL_NUMBER_UUID -> "Serial Number"
            FIRMWARE_REVISION_UUID -> "Firmware Revision"
            HARDWARE_REVISION_UUID -> "Hardware Revision"
            SOFTWARE_REVISION_UUID -> "Software Revision"
            BODY_SENSOR_LOCATION_UUID -> "Body Sensor Location"
            XIAOMI_FE95_READ_UUID -> "Xiaomi FE95 Read"
            XIAOMI_FE95_NOTIFY_A_UUID -> "Xiaomi FE95 Notify A"
            XIAOMI_FE95_NOTIFY_B_UUID -> "Xiaomi FE95 Notify B"
            XIAOMI_FDAB_READ_UUID -> "Xiaomi FDAB Read"
            XIAOMI_FDAB_NOTIFY_A_UUID -> "Xiaomi FDAB Notify A"
            XIAOMI_FDAB_NOTIFY_B_UUID -> "Xiaomi FDAB Notify B"
            XIAOMI_PRIVATE_NOTIFY_UUID -> "Xiaomi Private Notify"
            else -> "Unknown"
        }
    }

    private fun notificationCharacteristicSubscriptions(
        services: List<BluetoothGattService>,
    ): List<NotifyCharacteristicSubscription> {
        return services
            .flatMap { service ->
                service.characteristics
                    .filter { characteristic -> canNotifyCharacteristic(characteristic) }
                    .map { characteristic ->
                        val knownName = knownCharacteristicName(characteristic.uuid)
                        NotifyCharacteristicSubscription(
                            serviceUuid = service.uuid,
                            characteristic = characteristic,
                            name = if (knownName != "Unknown") knownName else "Notify ${shortUuid(characteristic.uuid)}",
                        )
                    }
            }
            .sortedWith(
                compareBy<NotifyCharacteristicSubscription> { subscriptionPriority(it) }
                    .thenBy { it.serviceUuid.toString() }
                    .thenBy { it.characteristic.uuid.toString() },
            )
            .take(MAX_SESSION_SUBSCRIPTIONS)
    }

    private fun subscriptionPriority(subscription: NotifyCharacteristicSubscription): Int {
        return when {
            subscription.serviceUuid == XIAOMI_FE95_SERVICE_UUID &&
                XIAOMI_FE95_NOTIFY_CHARACTERISTIC_UUIDS.contains(subscription.characteristic.uuid) -> 0
            subscription.serviceUuid == XIAOMI_FDAB_SERVICE_UUID &&
                XIAOMI_FDAB_NOTIFY_CHARACTERISTIC_UUIDS.contains(subscription.characteristic.uuid) -> 1
            subscription.serviceUuid == XIAOMI_CUSTOM_SERVICE_UUID -> 2
            subscription.serviceUuid == HEART_RATE_SERVICE_UUID -> 3
            subscription.serviceUuid == BATTERY_SERVICE_UUID -> 4
            else -> 10
        }
    }

    private fun buildSubscriptionStatus(
        request: NotifyCharacteristicSubscription,
        status: String,
        error: String?,
    ): JSObject {
        val item = JSObject()
        item.put("serviceUuid", request.serviceUuid.toString())
        item.put("uuid", request.characteristic.uuid.toString())
        item.put("name", request.name)
        item.put("properties", characteristicProperties(request.characteristic))
        item.put("status", status)
        item.put("error", error)
        return item
    }

    private fun buildSessionPacket(
        session: DirectWatchSession,
        characteristic: BluetoothGattCharacteristic,
        value: ByteArray,
    ): JSObject {
        val packet = JSObject()
        val serviceUuid = characteristic.service?.uuid?.toString()
        packet.put("deviceId", session.deviceId)
        packet.put("deviceName", session.deviceName)
        packet.put("serviceUuid", serviceUuid)
        packet.put("characteristicUuid", characteristic.uuid.toString())
        packet.put("name", knownCharacteristicName(characteristic.uuid).takeIf { it != "Unknown" } ?: "Notify ${shortUuid(characteristic.uuid)}")
        packet.put("packetIndex", session.packetCount + 1)
        packet.put("byteLength", value.size)
        packet.put("rawHex", bytePreviewHex(value, MAX_PACKET_PREVIEW_BYTES))
        packet.put("receivedAt", java.time.Instant.now().toString())
        return packet
    }

    private fun buildSessionStatus(
        session: DirectWatchSession?,
        connectedOverride: Boolean? = null,
    ): JSObject {
        val response = JSObject()
        val connected = connectedOverride ?: session?.connected ?: false
        response.put("connected", connected)
        response.put("deviceId", session?.deviceId)
        response.put("deviceName", session?.deviceName)
        response.put("startedAt", session?.startedAt)
        response.put("serviceCount", session?.serviceCount ?: 0)
        response.put("subscribed", JSArray(session?.subscribed ?: emptyList<JSObject>()))
        response.put("subscribedCount", session?.subscribed?.count { item -> item.optString("status") == "subscribed" } ?: 0)
        response.put("packetCount", session?.packetCount ?: 0)
        response.put("lastPacket", session?.packets?.peekFirst())
        response.put("packets", JSArray(session?.packets?.toList() ?: emptyList<JSObject>()))
        response.put("updatedAt", java.time.Instant.now().toString())
        return response
    }

    private fun notifySessionStatus() {
        notifyListeners("directWatchSession", buildSessionStatus(activeSession))
    }

    private fun buildClassicPacket(bytes: ByteArray, packetIndex: Int): JSObject {
        val packet = JSObject()
        packet.put("packetIndex", packetIndex)
        packet.put("byteLength", bytes.size)
        packet.put("rawHex", bytePreviewHex(bytes, MAX_CLASSIC_PACKET_PREVIEW_BYTES))
        packet.put("receivedAt", java.time.Instant.now().toString())
        return packet
    }

    private fun buildClassicProbeResponse(
        device: BluetoothDevice,
        connected: Boolean,
        sentVersionRequest: Boolean,
        sentSessionConfig: Boolean,
        sentAuthStep1: Boolean,
        sentAuthStep2: Boolean,
        sentPostAuthProbe: Boolean,
        sentActivityFileProbe: Boolean,
        activityFileProbeCount: Int,
        activityFileProbeCompletedCount: Int,
        activityFileProbeFailedCount: Int,
        activityFileProbeRequests: List<JSObject>,
        phoneNonce: ByteArray?,
        authKeyHex: String?,
        postAuthDecryptionKey: ByteArray?,
        packets: List<JSObject>,
        combinedBytes: ByteArray,
        error: String?,
    ): JSObject {
        val response = JSObject()
        val parsed = parseClassicProbeBytes(combinedBytes)
        val keyCheck = checkClassicAuthKey(authKeyHex, phoneNonce, parsed)
        response.put("deviceId", device.address)
        response.put("deviceName", devicesByAddress[device.address]?.name ?: scanResultNameFallback(device))
        response.put("bondState", bondStateLabel(safeBondState(device)))
        response.put("bondStateCode", safeBondState(device))
        response.put("connected", connected)
        response.put("sentVersionRequest", sentVersionRequest)
        response.put("sentSessionConfig", sentSessionConfig)
        response.put("sentAuthStep1", sentAuthStep1)
        response.put("sentAuthStep2", sentAuthStep2)
        response.put("sentPostAuthProbe", sentPostAuthProbe)
        response.put("sentActivityFileProbe", sentActivityFileProbe)
        response.put("activityFileProbeCount", activityFileProbeCount)
        response.put("activityFileProbeCompletedCount", activityFileProbeCompletedCount)
        response.put("activityFileProbeFailedCount", activityFileProbeFailedCount)
        response.put("activityFileProbeRequests", JSArray(activityFileProbeRequests))
        response.put("phoneNonceHex", fullHex(phoneNonce))
        response.put("packetCount", packets.size)
        response.put("packets", JSArray(packets))
        response.put("decryptedPackets", JSArray(collectClassicDecryptedPackets(combinedBytes, postAuthDecryptionKey)))
        response.put("rawHex", bytePreviewHex(combinedBytes, MAX_CLASSIC_PACKET_PREVIEW_BYTES))
        response.put("detectedProtocol", parsed.detectedProtocol)
        response.put("versionHex", parsed.versionHex)
        response.put("packetType", parsed.packetType)
        response.put("authSubtype", parsed.authSubtype)
        response.put("authStatus", parsed.authStatus)
        response.put("authKeyStatus", keyCheck.status)
        response.put("authKeyError", keyCheck.error)
        response.put("watchNonceHex", parsed.watchNonceHex)
        response.put("watchHmacHex", parsed.watchHmacHex)
        response.put("authStage", parsed.authStage)
        response.put("error", error)
        response.put("probedAt", java.time.Instant.now().toString())
        return response
    }

    private fun buildServiceSyncResponse(
        device: BluetoothDevice,
        connected: Boolean,
        sentVersionRequest: Boolean,
        sentSessionConfig: Boolean,
        sentAuthStep1: Boolean,
        sentAuthStep2: Boolean,
        sentServiceCommands: List<String>,
        keepAliveMs: Int,
        phoneNonce: ByteArray?,
        authKeyHex: String?,
        postAuthDecryptionKey: ByteArray?,
        packets: List<JSObject>,
        combinedBytes: ByteArray,
        error: String?,
        sentActivityFileProbe: Boolean,
        activityFileProbeCount: Int,
        activityFileProbeCompletedCount: Int,
        activityFileProbeFailedCount: Int,
        activityFileProbeRequests: List<JSObject>,
    ): JSObject {
        val response = buildClassicProbeResponse(
            device = device,
            connected = connected,
            sentVersionRequest = sentVersionRequest,
            sentSessionConfig = sentSessionConfig,
            sentAuthStep1 = sentAuthStep1,
            sentAuthStep2 = sentAuthStep2,
            sentPostAuthProbe = sentServiceCommands.isNotEmpty() || sentActivityFileProbe,
            sentActivityFileProbe = sentActivityFileProbe,
            activityFileProbeCount = activityFileProbeCount,
            activityFileProbeCompletedCount = activityFileProbeCompletedCount,
            activityFileProbeFailedCount = activityFileProbeFailedCount,
            activityFileProbeRequests = activityFileProbeRequests,
            phoneNonce = phoneNonce,
            authKeyHex = authKeyHex,
            postAuthDecryptionKey = postAuthDecryptionKey,
            packets = packets,
            combinedBytes = combinedBytes,
            error = error,
        )
        response.put("sentServiceSync", sentServiceCommands.isNotEmpty())
        response.put("sentTime", sentServiceCommands.contains("time"))
        response.put("sentPhoneLocation", sentServiceCommands.contains("phone-location"))
        response.put(
            "sentWeatherPrefsRead",
            sentServiceCommands.any { it == "weather-prefs-read" || it == "weather-prefs-read-confirm" },
        )
        response.put(
            "sentWeatherPrefs",
            sentServiceCommands.any {
                it == "weather-prefs" ||
                    it == "weather-enable" ||
                    it == "weather-temp-unit" ||
                    it == "weather-alerts"
            },
        )
        response.put(
            "sentWeatherLocationsRead",
            sentServiceCommands.any { it == "weather-locations-read" || it == "weather-locations-read-confirm" },
        )
        response.put("sentWeatherLocation", sentServiceCommands.any { it == "weather-location" || it == "weather-location-add" })
        response.put("sentWeatherLocationsOrder", sentServiceCommands.contains("weather-locations-order"))
        response.put("sentWeatherCurrent", sentServiceCommands.contains("weather-current"))
        response.put("sentWeatherDaily", sentServiceCommands.contains("weather-daily"))
        response.put("sentWeatherHourly", sentServiceCommands.contains("weather-hourly"))
        val keptBluetoothBridge = sentServiceCommands.contains("bluetooth-bridge")
        response.put("keptBluetoothBridge", keptBluetoothBridge)
        response.put("keepAliveMs", keepAliveMs)
        response.put(
            "bridgeUntil",
            if (keptBluetoothBridge && keepAliveMs > 0) {
                java.time.Instant.now().plusMillis(keepAliveMs.toLong()).toString()
            } else {
                null
            },
        )
        response.put("serviceCommands", JSArray(sentServiceCommands))
        response.put("syncedAt", java.time.Instant.now().toString())
        return response
    }

    private fun buildActivityAckResponse(
        device: BluetoothDevice,
        connected: Boolean,
        sentVersionRequest: Boolean,
        sentSessionConfig: Boolean,
        sentAuthStep1: Boolean,
        sentAuthStep2: Boolean,
        acknowledgedFileIds: List<String>,
        phoneNonce: ByteArray?,
        authKeyHex: String?,
        postAuthDecryptionKey: ByteArray?,
        packets: List<JSObject>,
        combinedBytes: ByteArray,
        error: String?,
    ): JSObject {
        val response = buildClassicProbeResponse(
            device = device,
            connected = connected,
            sentVersionRequest = sentVersionRequest,
            sentSessionConfig = sentSessionConfig,
            sentAuthStep1 = sentAuthStep1,
            sentAuthStep2 = sentAuthStep2,
            sentPostAuthProbe = acknowledgedFileIds.isNotEmpty(),
            sentActivityFileProbe = false,
            activityFileProbeCount = 0,
            activityFileProbeCompletedCount = 0,
            activityFileProbeFailedCount = 0,
            activityFileProbeRequests = emptyList(),
            phoneNonce = phoneNonce,
            authKeyHex = authKeyHex,
            postAuthDecryptionKey = postAuthDecryptionKey,
            packets = packets,
            combinedBytes = combinedBytes,
            error = error,
        )
        response.put("sentActivityFileAck", acknowledgedFileIds.isNotEmpty())
        response.put("activityFileAckCount", acknowledgedFileIds.size)
        response.put("activityFileAckIds", JSArray(acknowledgedFileIds))
        response.put("ackedAt", java.time.Instant.now().toString())
        return response
    }

    private fun checkClassicAuthKey(
        authKeyHex: String?,
        phoneNonce: ByteArray?,
        parsed: ClassicProbeParse,
    ): ClassicAuthKeyCheck {
        if (authKeyHex == null) {
            return ClassicAuthKeyCheck(status = "not-provided", error = null)
        }

        val authKey = parseHexBytes(authKeyHex)
            ?: return ClassicAuthKeyCheck(status = "invalid-format", error = "Auth Key должен быть 16 байт: 32 hex-символа.")
        if (authKey.size != 16) {
            return ClassicAuthKeyCheck(status = "invalid-format", error = "Auth Key должен быть 16 байт: 32 hex-символа.")
        }

        if (phoneNonce == null || parsed.watchNonceHex == null || parsed.watchHmacHex == null) {
            return ClassicAuthKeyCheck(status = "no-watch-nonce", error = CLASSIC_WATCH_NONCE_MISSING_MESSAGE)
        }

        val watchNonce = parseHexBytes(parsed.watchNonceHex)
            ?: return ClassicAuthKeyCheck(status = "invalid-watch-nonce", error = "Watch nonce пришёл в неожиданном формате.")
        val watchHmac = parseHexBytes(parsed.watchHmacHex)
            ?: return ClassicAuthKeyCheck(status = "invalid-watch-hmac", error = "Watch HMAC пришёл в неожиданном формате.")

        return if (isClassicAuthKeyValid(authKey, phoneNonce, watchNonce, watchHmac)) {
            ClassicAuthKeyCheck(status = "valid", error = null)
        } else {
            ClassicAuthKeyCheck(status = "invalid", error = "Auth Key не совпал с ответом часов.")
        }
    }

    private fun buildClassicAuthStep2Material(
        authKeyHex: String?,
        phoneNonce: ByteArray?,
        parsed: ClassicProbeParse,
    ): ClassicAuthStep2Material {
        if (authKeyHex == null) {
            return ClassicAuthStep2Material(status = "not-provided", error = null, authStep3Command = null)
        }

        val authKey = parseHexBytes(authKeyHex)
            ?: return ClassicAuthStep2Material(status = "invalid-format", error = "Auth Key должен быть 16 байт: 32 hex-символа.", authStep3Command = null)
        if (authKey.size != 16) {
            return ClassicAuthStep2Material(status = "invalid-format", error = "Auth Key должен быть 16 байт: 32 hex-символа.", authStep3Command = null)
        }

        if (phoneNonce == null || parsed.watchNonceHex == null || parsed.watchHmacHex == null) {
            return ClassicAuthStep2Material(status = "no-watch-nonce", error = CLASSIC_WATCH_NONCE_MISSING_MESSAGE, authStep3Command = null)
        }

        val watchNonce = parseHexBytes(parsed.watchNonceHex)
            ?: return ClassicAuthStep2Material(status = "invalid-watch-nonce", error = "Watch nonce пришёл в неожиданном формате.", authStep3Command = null)
        val watchHmac = parseHexBytes(parsed.watchHmacHex)
            ?: return ClassicAuthStep2Material(status = "invalid-watch-hmac", error = "Watch HMAC пришёл в неожиданном формате.", authStep3Command = null)

        if (!isClassicAuthKeyValid(authKey, phoneNonce, watchNonce, watchHmac)) {
            return ClassicAuthStep2Material(status = "invalid", error = "Auth Key не совпал с ответом часов.", authStep3Command = null)
        }

        val stepHmac = computeClassicAuthStepHmac(authKey, phoneNonce, watchNonce)
        val decryptionKey = stepHmac.copyOfRange(0, 16)
        val encryptionKey = stepHmac.copyOfRange(16, 32)
        val encryptionNonce = stepHmac.copyOfRange(36, 40)
        val packetNonce = java.io.ByteArrayOutputStream()
        packetNonce.write(encryptionNonce)
        writeLittleEndianUInt32(packetNonce, 0)
        writeLittleEndianUInt32(packetNonce, 0)

        val encryptedNonces = hmacSha256(encryptionKey, phoneNonce + watchNonce)
        val encryptedDeviceInfo = encryptAesCcm4(encryptionKey, packetNonce.toByteArray(), buildClassicAuthDeviceInfo())
        return ClassicAuthStep2Material(
            status = "valid",
            error = null,
            authStep3Command = buildAuthStep3Command(encryptedNonces, encryptedDeviceInfo),
            encryptionKey = encryptionKey,
            decryptionKey = decryptionKey,
        )
    }

    private fun isClassicAuthKeyValid(
        authKey: ByteArray,
        phoneNonce: ByteArray,
        watchNonce: ByteArray,
        watchHmac: ByteArray,
    ): Boolean {
        val stepHmac = computeClassicAuthStepHmac(authKey, phoneNonce, watchNonce)
        val decryptionKey = stepHmac.copyOfRange(0, 16)
        val expectedWatchHmac = hmacSha256(decryptionKey, watchNonce + phoneNonce)
        return expectedWatchHmac.contentEquals(watchHmac)
    }

    private fun parseClassicProbeBytes(bytes: ByteArray): ClassicProbeParse {
        val auth = parseClassicAuthProbe(bytes)
        val versionHex = classicSppV1VersionHex(bytes)
        val sppV2Offset = classicSppV2Offset(bytes)
        if (sppV2Offset != null) {
            val packetType = if (bytes.size >= sppV2Offset + 3) (bytes[sppV2Offset + 2].toInt() and 0x0f).toString() else null
            return ClassicProbeParse(
                detectedProtocol = "spp-v2",
                versionHex = versionHex,
                packetType = packetType,
                authSubtype = auth.authSubtype,
                authStatus = auth.authStatus,
                watchNonceHex = auth.watchNonceHex,
                watchHmacHex = auth.watchHmacHex,
                authStage = auth.authStage,
                authPacketSequenceNumber = auth.authPacketSequenceNumber,
            )
        }

        if (bytes.size >= 11 &&
            bytes[0] == 0xBA.toByte() &&
            bytes[1] == 0xDC.toByte() &&
            bytes[2] == 0xFE.toByte()
        ) {
            return ClassicProbeParse(
                detectedProtocol = "spp-v1",
                versionHex = versionHex,
                packetType = (bytes.getOrNull(7)?.toInt()?.and(0xff))?.toString(),
                authSubtype = auth.authSubtype,
                authStatus = auth.authStatus,
                watchNonceHex = auth.watchNonceHex,
                watchHmacHex = auth.watchHmacHex,
                authStage = auth.authStage,
                authPacketSequenceNumber = auth.authPacketSequenceNumber,
            )
        }

        return ClassicProbeParse(
            detectedProtocol = if (bytes.isEmpty()) null else "unknown",
            versionHex = null,
            packetType = null,
            authSubtype = auth.authSubtype,
            authStatus = auth.authStatus,
            watchNonceHex = auth.watchNonceHex,
            watchHmacHex = auth.watchHmacHex,
            authStage = auth.authStage,
            authPacketSequenceNumber = auth.authPacketSequenceNumber,
        )
    }

    private fun classicSppV2Offset(bytes: ByteArray): Int? {
        var offset = 0
        while (offset <= bytes.size - 2) {
            if (bytes[offset] == 0xA5.toByte() && bytes[offset + 1] == 0xA5.toByte()) {
                return offset
            }
            offset += 1
        }
        return null
    }

    private fun classicSppV1VersionHex(bytes: ByteArray): String? {
        var offset = 0
        while (offset <= bytes.size - 11) {
            if (bytes[offset] == 0xBA.toByte() &&
                bytes[offset + 1] == 0xDC.toByte() &&
                bytes[offset + 2] == 0xFE.toByte()
            ) {
                val payloadHeaderLength = littleEndianUInt16(bytes, offset + 5)
                val payloadLength = (payloadHeaderLength - 3).coerceAtLeast(0)
                val payloadStart = offset + 10
                val payloadEnd = minOf(bytes.size, payloadStart + payloadLength)
                val versionBytes = if (payloadEnd > payloadStart) {
                    bytes.copyOfRange(payloadStart, payloadEnd)
                } else {
                    byteArrayOf()
                }
                return bytePreviewHex(versionBytes, 16)
            }
            offset += 1
        }
        return null
    }

    private fun parseClassicAuthProbe(bytes: ByteArray): ClassicAuthProbeParse {
        var offset = 0
        var result = ClassicAuthProbeParse()
        while (offset <= bytes.size - 8) {
            if (offset <= bytes.size - 11 &&
                bytes[offset] == 0xBA.toByte() &&
                bytes[offset + 1] == 0xDC.toByte() &&
                bytes[offset + 2] == 0xFE.toByte()
            ) {
                val payloadHeaderLength = littleEndianUInt16(bytes, offset + 5)
                val payloadLength = payloadHeaderLength - 3
                val packetSize = 11 + payloadLength
                if (payloadLength >= 0 && offset + packetSize <= bytes.size) {
                    val dataType = bytes[offset + 9].toInt() and 0xff
                    if (dataType == 2) {
                        val payloadStart = offset + 10
                        val payloadEnd = payloadStart + payloadLength
                        val parsed = parseAuthCommand(bytes.copyOfRange(payloadStart, payloadEnd))
                        if (parsed.authStage != null) {
                            result = mergeClassicAuthProbe(result, parsed)
                        }
                    }
                    offset += packetSize.coerceAtLeast(1)
                    continue
                }
            }

            if (bytes[offset] == 0xA5.toByte() && bytes[offset + 1] == 0xA5.toByte()) {
                val packetType = bytes[offset + 2].toInt() and 0x0f
                val payloadLength = littleEndianUInt16(bytes, offset + 4)
                val packetSize = 8 + payloadLength
                if (payloadLength >= 0 && offset + packetSize <= bytes.size) {
                    if (packetType == 3 && payloadLength >= 2) {
                        val payloadStart = offset + 8
                        val rawChannel = bytes[payloadStart].toInt() and 0x0f
                        val opCode = bytes[payloadStart + 1].toInt() and 0xff
                        if (rawChannel == 1 && opCode == 1) {
                            val sequenceNumber = bytes[offset + 3].toInt() and 0xff
                            val parsed = parseAuthCommand(bytes.copyOfRange(payloadStart + 2, payloadStart + payloadLength))
                            if (parsed.authStage != null) {
                                result = mergeClassicAuthProbe(result, parsed.copy(authPacketSequenceNumber = sequenceNumber))
                            }
                        }
                    }
                    offset += packetSize.coerceAtLeast(1)
                    continue
                }
            }

            offset += 1
        }

        return result
    }

    private fun mergeClassicAuthProbe(
        previous: ClassicAuthProbeParse,
        next: ClassicAuthProbeParse,
    ): ClassicAuthProbeParse {
        return ClassicAuthProbeParse(
            authSubtype = next.authSubtype ?: previous.authSubtype,
            authStatus = next.authStatus ?: previous.authStatus,
            watchNonceHex = next.watchNonceHex ?: previous.watchNonceHex,
            watchHmacHex = next.watchHmacHex ?: previous.watchHmacHex,
            authStage = next.authStage ?: previous.authStage,
            authPacketSequenceNumber = next.authPacketSequenceNumber ?: previous.authPacketSequenceNumber,
        )
    }

    private fun collectClassicDecryptedPackets(
        bytes: ByteArray,
        decryptionKey: ByteArray?,
    ): List<JSObject> {
        if (decryptionKey == null) {
            return emptyList()
        }

        val decryptedPackets = mutableListOf<JSObject>()
        val seenPackets = mutableSetOf<String>()
        val seenCompleteActivityFiles = mutableSetOf<String>()
        var activityAssembly: java.io.ByteArrayOutputStream? = null
        var activityAssemblyTotal: Int? = null
        var activityAssemblyFile: ClassicActivityFileContent? = null
        var offset = 0
        while (offset <= bytes.size - 8) {
            if (bytes[offset] == 0xA5.toByte() && bytes[offset + 1] == 0xA5.toByte()) {
                val packetType = bytes[offset + 2].toInt() and 0x0f
                val sequenceNumber = bytes[offset + 3].toInt() and 0xff
                val payloadLength = littleEndianUInt16(bytes, offset + 4)
                val packetSize = 8 + payloadLength
                if (payloadLength >= 2 && offset + packetSize <= bytes.size && packetType == 3) {
                    val payloadStart = offset + 8
                    val rawChannel = bytes[payloadStart].toInt() and 0x0f
                    val opCode = bytes[payloadStart + 1].toInt() and 0xff
                    if ((rawChannel == 1 || rawChannel == 5) && opCode == 2) {
                        val encryptedPayload = bytes.copyOfRange(payloadStart + 2, payloadStart + payloadLength)
                        val decryptedPayload = try {
                            aesCtrCrypt(decryptionKey, decryptionKey, encryptedPayload)
                        } catch (_: Exception) {
                            null
                        }
                        if (decryptedPayload != null) {
                            val packetKey = "${sequenceNumber}:${fullHex(decryptedPayload)}"
                            if (!seenPackets.add(packetKey)) {
                                offset += packetSize.coerceAtLeast(1)
                                continue
                            }
                            val command = parseClassicCommandHeader(decryptedPayload)
                            val item = JSObject()
                            item.put("sequenceNumber", sequenceNumber)
                            item.put("byteLength", decryptedPayload.size)
                            item.put("rawHex", bytePreviewHex(decryptedPayload, MAX_CLASSIC_PACKET_PREVIEW_BYTES))
                            item.put("channel", if (rawChannel == 5) "activity" else "command")
                            if (rawChannel == 5) {
                                val chunk = parseClassicActivityChunk(decryptedPayload)
                                val chunkData = if (decryptedPayload.size > 4) {
                                    decryptedPayload.copyOfRange(4, decryptedPayload.size)
                                } else {
                                    byteArrayOf()
                                }
                                var activityFileRawHex: String? = null
                                var file = if (chunk?.number == 1) {
                                    if (chunk.total == 1) {
                                        activityFileRawHex = fullHex(chunkData)
                                    }
                                    parseClassicActivityFilePayload(chunkData, isComplete = chunk.total == 1)
                                } else {
                                    null
                                }
                                if (chunk?.number == 1) {
                                    activityAssembly = java.io.ByteArrayOutputStream()
                                    activityAssemblyTotal = chunk.total
                                    activityAssemblyFile = file
                                }
                                if (chunk != null && activityAssembly != null && activityAssemblyTotal == chunk.total) {
                                    activityAssembly?.write(chunkData)
                                    if (file == null) {
                                        file = activityAssemblyFile
                                    }
                                    if (chunk.number == chunk.total) {
                                        val assembledFileBytes = activityAssembly!!.toByteArray()
                                        activityFileRawHex = fullHex(assembledFileBytes)
                                        file = parseClassicActivityFilePayload(assembledFileBytes, isComplete = true) ?: file
                                        activityAssembly = null
                                        activityAssemblyTotal = null
                                        activityAssemblyFile = null
                                    }
                                }
                                if (file?.crcValid != null && !seenCompleteActivityFiles.add(file.file.idHex)) {
                                    offset += packetSize.coerceAtLeast(1)
                                    continue
                                }
                                item.put("label", file?.let { "${it.fileKind} ${chunk?.number ?: "-"}/${chunk?.total ?: "-"}" } ?: chunk?.label ?: "Файл активности")
                                item.put("activityChunkNumber", chunk?.number)
                                item.put("activityChunkTotal", chunk?.total)
                                item.put("activityChunkPayloadBytes", chunk?.payloadBytes)
                                item.put("activityFile", file?.file?.toJson())
                                item.put("activityFileKind", file?.fileKind)
                                item.put("activityFilePadding", file?.padding)
                                item.put("activityFilePayloadBytes", file?.payloadBytes)
                                item.put("activityFileRawHex", activityFileRawHex)
                                item.put("activityFileCrcValid", file?.crcValid)
                                item.put("activityFileParsed", file?.parsed)
                                item.put("activitySampleCount", file?.sampleCount)
                                item.put("activitySteps", file?.steps)
                                item.put("activityHeartRateAvg", file?.heartRateAvg)
                                item.put("activityHeartRateMin", file?.heartRateMin)
                                item.put("activityHeartRateMax", file?.heartRateMax)
                                item.put("activityHeartRateResting", file?.heartRateResting)
                                item.put("activitySpo2Avg", file?.spo2Avg)
                                item.put("activitySpo2Min", file?.spo2Min)
                                item.put("activitySpo2Max", file?.spo2Max)
                                item.put("activityStressAvg", file?.stressAvg)
                                item.put("activityStressMin", file?.stressMin)
                                item.put("activityStressMax", file?.stressMax)
                                item.put("activityCalories", file?.calories)
                                item.put("activityTrainingLoadDay", file?.trainingLoadDay)
                                item.put("activityTrainingLoadWeek", file?.trainingLoadWeek)
                                item.put("activityVitality", file?.vitality)
                                item.put("activityWorkoutStartTime", file?.workoutStartTime)
                                item.put("activityWorkoutEndTime", file?.workoutEndTime)
                                item.put("activityWorkoutDurationMinutes", file?.workoutDurationMinutes)
                                item.put("activityWorkoutDistanceMeters", file?.workoutDistanceMeters)
                                item.put("activityWorkoutSteps", file?.workoutSteps)
                                item.put("activityWorkoutType", file?.workoutType)
                                item.put("activityWorkoutTypeCode", file?.workoutTypeCode)
                                item.put("activityWorkoutPaceAvgSecondsPerKm", file?.workoutPaceAvgSecondsPerKm)
                                item.put("activityWorkoutPaceMaxSecondsPerKm", file?.workoutPaceMaxSecondsPerKm)
                                item.put("activityWorkoutPaceMinSecondsPerKm", file?.workoutPaceMinSecondsPerKm)
                                item.put("activityWorkoutSpeedAvgKmh", file?.workoutSpeedAvgKmh)
                                item.put("activityWorkoutSpeedMaxKmh", file?.workoutSpeedMaxKmh)
                                item.put("activityWorkoutCadenceAvg", file?.workoutCadenceAvg)
                                item.put("activityWorkoutCadenceMax", file?.workoutCadenceMax)
                                item.put("activityWorkoutStepLengthAvgCm", file?.workoutStepLengthAvgCm)
                                item.put("activityWorkoutStepRateAvg", file?.workoutStepRateAvg)
                                item.put("activityWorkoutStepRateMax", file?.workoutStepRateMax)
                                item.put("activityWorkoutStrokes", file?.workoutStrokes)
                                item.put("activityWorkoutStrokeRateAvg", file?.workoutStrokeRateAvg)
                                item.put("activityWorkoutJumps", file?.workoutJumps)
                                item.put("activityWorkoutJumpRateAvg", file?.workoutJumpRateAvg)
                                item.put("activityWorkoutJumpRateMax", file?.workoutJumpRateMax)
                                item.put("activityWorkoutLaps", file?.workoutLaps)
                                item.put("activityWorkoutSwolfAvg", file?.workoutSwolfAvg)
                                item.put("activityWorkoutSwimStyle", file?.workoutSwimStyle)
                                item.put("activityWorkoutElevationGainMeters", file?.workoutElevationGainMeters)
                                item.put("activityWorkoutElevationLossMeters", file?.workoutElevationLossMeters)
                                item.put("activityWorkoutAltitudeAvgMeters", file?.workoutAltitudeAvgMeters)
                                item.put("activityWorkoutAltitudeMaxMeters", file?.workoutAltitudeMaxMeters)
                                item.put("activityWorkoutAltitudeMinMeters", file?.workoutAltitudeMinMeters)
                                item.put("activityWorkoutTrainingEffectAerobic", file?.workoutTrainingEffectAerobic)
                                item.put("activityWorkoutTrainingEffectAnaerobic", file?.workoutTrainingEffectAnaerobic)
                                item.put("activityWorkoutLoad", file?.workoutLoad)
                                item.put("activityWorkoutRecoveryTimeHours", file?.workoutRecoveryTimeHours)
                                item.put("activityWorkoutVo2Max", file?.workoutVo2Max)
                                item.put("activityWorkoutVitalityGain", file?.workoutVitalityGain)
                                item.put("activityWorkoutHeartRateZoneExtremeSeconds", file?.workoutHeartRateZoneExtremeSeconds)
                                item.put("activityWorkoutHeartRateZoneAnaerobicSeconds", file?.workoutHeartRateZoneAnaerobicSeconds)
                                item.put("activityWorkoutHeartRateZoneAerobicSeconds", file?.workoutHeartRateZoneAerobicSeconds)
                                item.put("activityWorkoutHeartRateZoneFatBurnSeconds", file?.workoutHeartRateZoneFatBurnSeconds)
                                item.put("activityWorkoutHeartRateZoneWarmUpSeconds", file?.workoutHeartRateZoneWarmUpSeconds)
                                item.put("activityWorkoutGpsSampleCount", file?.workoutGpsSampleCount)
                                item.put("activityWorkoutGpsSamples", JSArray(file?.workoutGpsSamples?.map { sample -> sample.toJson() } ?: emptyList<JSObject>()))
                                item.put("activitySamples", JSArray(file?.activitySamples?.map { sample -> sample.toJson() } ?: emptyList<JSObject>()))
                                item.put("sleepStartTime", file?.sleepStartTime)
                                item.put("sleepEndTime", file?.sleepEndTime)
                                item.put("sleepDurationMinutes", file?.sleepDurationMinutes)
                                item.put("sleepDeepMinutes", file?.sleepDeepMinutes)
                                item.put("sleepLightMinutes", file?.sleepLightMinutes)
                                item.put("sleepRemMinutes", file?.sleepRemMinutes)
                                item.put("sleepAwakeMinutes", file?.sleepAwakeMinutes)
                                item.put("sleepScore", file?.sleepScore)
                                item.put("sleepStageCount", file?.sleepStageCount)
                                item.put("sleepIsAwake", file?.sleepIsAwake)
                                decryptedPackets.add(item)
                                offset += packetSize.coerceAtLeast(1)
                                continue
                            }
                            item.put("commandType", command.commandType)
                            item.put("commandSubtype", command.commandSubtype)
                            item.put("commandStatus", command.commandStatus)
                            item.put("label", command.label)
                            item.put("batteryLevel", command.batteryLevel)
                            item.put("batteryState", command.batteryState)
                            item.put("isCharging", command.isCharging)
                            item.put("isWorn", command.isWorn)
                            item.put("isUserAsleep", command.isUserAsleep)
                            item.put("deviceModel", command.deviceModel)
                            item.put("firmware", command.firmware)
                            item.put("serialNumber", command.serialNumber)
                            item.put("activityFileCount", command.activityFileCount)
                            item.put("activityFileIdsHex", command.activityFileIdsHex)
                            item.put("heartRateInterval", command.heartRateInterval)
                            item.put("heartRateDisabled", command.heartRateDisabled)
                            item.put("steps", command.steps)
                            item.put("heartRate", command.heartRate)
                            item.put("calories", command.calories)
                            item.put("activityFiles", JSArray(command.activityFiles.map { file -> file.toJson() }))
                            decryptedPackets.add(item)
                        }
                    }
                    offset += packetSize.coerceAtLeast(1)
                    continue
                }
            }
            offset += 1
        }

        return decryptedPackets
    }

    private fun parseClassicCommandHeader(payload: ByteArray): ClassicCommandHeader {
        var commandType: Int? = null
        var commandSubtype: Int? = null
        var commandStatus: Int? = null
        var systemBytes: ByteArray? = null
        var healthBytes: ByteArray? = null
        walkProtoFields(payload) { fieldNumber, wireType, value ->
            when {
                fieldNumber == 1 && wireType == 0 -> commandType = value.intValue
                fieldNumber == 2 && wireType == 0 -> commandSubtype = value.intValue
                fieldNumber == 4 && wireType == 2 -> systemBytes = value.bytes
                fieldNumber == 10 && wireType == 2 -> healthBytes = value.bytes
                fieldNumber == 100 && wireType == 0 -> commandStatus = value.intValue
            }
        }
        val system = parseClassicSystemPayload(systemBytes)
        val health = parseClassicHealthPayload(healthBytes)
        return ClassicCommandHeader(
            commandType = commandType,
            commandSubtype = commandSubtype,
            commandStatus = commandStatus,
            label = classicCommandLabel(commandType, commandSubtype),
            batteryLevel = system.batteryLevel,
            batteryState = system.batteryState,
            isCharging = system.isCharging,
            isWorn = system.isWorn,
            isUserAsleep = system.isUserAsleep,
            deviceModel = system.deviceModel,
            firmware = system.firmware,
            serialNumber = system.serialNumber,
            activityFileCount = health.activityFileCount,
            activityFileIdsHex = health.activityFileIdsHex,
            heartRateInterval = health.heartRateInterval,
            heartRateDisabled = health.heartRateDisabled,
            steps = health.steps,
            heartRate = health.heartRate,
            calories = health.calories,
            activityFiles = health.activityFiles,
        )
    }

    private fun parseClassicSystemPayload(systemBytes: ByteArray?): ClassicSystemPayload {
        val parsed = ClassicSystemPayload()
        if (systemBytes == null) {
            return parsed
        }

        walkProtoFields(systemBytes) { fieldNumber, wireType, value ->
            when {
                fieldNumber == 2 && wireType == 2 && value.bytes != null -> {
                    parseClassicPowerPayload(value.bytes, parsed)
                }
                fieldNumber == 3 && wireType == 2 && value.bytes != null -> {
                    parseClassicDeviceInfoPayload(value.bytes, parsed)
                }
                fieldNumber == 48 && wireType == 2 && value.bytes != null -> {
                    parseClassicBasicDeviceStatePayload(value.bytes, parsed)
                }
            }
        }

        return parsed
    }

    private fun parseClassicPowerPayload(powerBytes: ByteArray, parsed: ClassicSystemPayload) {
        walkProtoFields(powerBytes) { fieldNumber, wireType, value ->
            if (fieldNumber == 1 && wireType == 2 && value.bytes != null) {
                walkProtoFields(value.bytes) { batteryField, batteryWireType, batteryValue ->
                    when {
                        batteryField == 1 && batteryWireType == 0 -> parsed.batteryLevel = batteryValue.intValue
                        batteryField == 2 && batteryWireType == 0 -> parsed.batteryState = batteryValue.intValue
                    }
                }
            }
        }
    }

    private fun parseClassicDeviceInfoPayload(deviceInfoBytes: ByteArray, parsed: ClassicSystemPayload) {
        walkProtoFields(deviceInfoBytes) { fieldNumber, wireType, value ->
            if (wireType == 2 && value.bytes != null) {
                when (fieldNumber) {
                    1 -> parsed.serialNumber = value.bytes.toString(Charsets.UTF_8)
                    2 -> parsed.firmware = value.bytes.toString(Charsets.UTF_8)
                    4 -> parsed.deviceModel = value.bytes.toString(Charsets.UTF_8)
                }
            }
        }
    }

    private fun parseClassicBasicDeviceStatePayload(deviceStateBytes: ByteArray, parsed: ClassicSystemPayload) {
        walkProtoFields(deviceStateBytes) { fieldNumber, wireType, value ->
            if (wireType == 0) {
                when (fieldNumber) {
                    1 -> parsed.isCharging = value.intValue == 1
                    2 -> parsed.batteryLevel = value.intValue
                    3 -> parsed.isWorn = value.intValue == 1
                    4 -> parsed.isUserAsleep = value.intValue == 1
                }
            }
        }
    }

    private fun parseClassicHealthPayload(healthBytes: ByteArray?): ClassicHealthPayload {
        val parsed = ClassicHealthPayload()
        if (healthBytes == null) {
            return parsed
        }

        walkProtoFields(healthBytes) { fieldNumber, wireType, value ->
            when {
                fieldNumber == 2 && wireType == 2 && value.bytes != null -> {
                    parsed.activityFileIdsHex = fullHex(value.bytes)
                    parsed.activityFileCount = if (value.bytes.isNotEmpty()) value.bytes.size / 7 else 0
                    parsed.activityFiles = parseClassicActivityFileIds(value.bytes)
                }
                fieldNumber == 8 && wireType == 2 && value.bytes != null -> {
                    parseClassicHeartRateConfig(value.bytes, parsed)
                }
                fieldNumber == 39 && wireType == 2 && value.bytes != null -> {
                    parseClassicRealTimeStats(value.bytes, parsed)
                }
            }
        }

        return parsed
    }

    private fun parseClassicHeartRateConfig(heartRateBytes: ByteArray, parsed: ClassicHealthPayload) {
        walkProtoFields(heartRateBytes) { fieldNumber, wireType, value ->
            if (wireType == 0) {
                when (fieldNumber) {
                    1 -> parsed.heartRateDisabled = value.intValue == 1
                    2 -> parsed.heartRateInterval = value.intValue
                }
            }
        }
    }

    private fun parseClassicRealTimeStats(statsBytes: ByteArray, parsed: ClassicHealthPayload) {
        walkProtoFields(statsBytes) { fieldNumber, wireType, value ->
            if (wireType == 0) {
                when (fieldNumber) {
                    1 -> parsed.steps = value.intValue
                    2 -> parsed.calories = value.intValue
                    4 -> parsed.heartRate = value.intValue
                }
            }
        }
    }

    private fun classicCommandLabel(commandType: Int?, commandSubtype: Int?): String? {
        return when ("${commandType ?: "-"}:${commandSubtype ?: "-"}") {
            "2:1" -> "Батарея часов"
            "2:2" -> "Модель и прошивка"
            "2:78" -> "Состояние часов"
            "8:1" -> "Файлы активности за сегодня"
            "8:2" -> "Файлы активности из истории"
            "8:8" -> "Настройки SpO2"
            "8:10" -> "Настройки пульса"
            "8:14" -> "Настройки стресса"
            "8:35" -> "Настройки Vitality"
            "8:42" -> "Цели активности"
            "8:45", "8:46", "8:47" -> "Онлайн-показатели"
            "10:0" -> "Погода сейчас"
            "10:1" -> "Прогноз погоды на дни"
            "10:2" -> "Почасовой прогноз погоды"
            "10:3" -> "Запрос погоды"
            "10:5" -> "Список локаций погоды"
            "10:6" -> "Порядок локаций погоды"
            "10:7" -> "Локация погоды"
            "10:9" -> "Запрос настроек погоды"
            "10:10" -> "Настройки погоды"
            else -> null
        }
    }

    private fun buildClassicPostAuthProbeCommands(includeHistory: Boolean = true): List<ClassicPostAuthProbeCommand> {
        val commands = mutableListOf(
            ClassicPostAuthProbeCommand("state", buildSimpleCommand(2, 78)),
            ClassicPostAuthProbeCommand("battery", buildSimpleCommand(2, 1)),
            ClassicPostAuthProbeCommand("device-info", buildSimpleCommand(2, 2)),
            ClassicPostAuthProbeCommand("activity-today", buildActivityFetchTodayCommand(0)),
            ClassicPostAuthProbeCommand("activity-today-alt", buildActivityFetchTodayCommand(1)),
            ClassicPostAuthProbeCommand("heart-rate-config", buildSimpleCommand(8, 10)),
            ClassicPostAuthProbeCommand("spo2-config", buildSimpleCommand(8, 8)),
            ClassicPostAuthProbeCommand("stress-config", buildSimpleCommand(8, 14)),
            ClassicPostAuthProbeCommand("vitality-config", buildSimpleCommand(8, 35)),
        )
        if (includeHistory) {
            commands.add(5, ClassicPostAuthProbeCommand("activity-history", buildSimpleCommand(8, 2)))
        }
        return commands
    }

    private fun buildClassicServiceSyncCommands(
        weatherPayload: JSONObject?,
        timeOffsetMinutes: Int = 0,
    ): List<ClassicPostAuthProbeCommand> {
        val commands = mutableListOf(
            ClassicPostAuthProbeCommand("time", buildSetCurrentTimeCommand(timeOffsetMinutes)),
        )

        if (weatherPayload != null) {
            Log.i(TAG, "classic service weather sync ${describeWeatherPayload(weatherPayload)}")
            buildPostLocationCommand(weatherPayload)?.let {
                commands.add(ClassicPostAuthProbeCommand("phone-location", it))
            }
            commands.add(ClassicPostAuthProbeCommand("weather-locations-read", buildGetWeatherLocationsCommand()))
            commands.add(ClassicPostAuthProbeCommand("weather-location-add", buildAddWeatherLocationCommand(weatherPayload)))
            commands.add(ClassicPostAuthProbeCommand("weather-locations-order", buildSetWeatherLocationsOrderCommand(weatherPayload)))
            commands.add(ClassicPostAuthProbeCommand("weather-temp-unit", buildSetWeatherTempUnitCommand()))
            commands.add(ClassicPostAuthProbeCommand("weather-alerts", buildSetWeatherAlertsCommand()))
            buildSetCurrentWeatherCommand(weatherPayload)?.let {
                commands.add(ClassicPostAuthProbeCommand("weather-current", it))
            }
            buildSetDailyWeatherForecastCommand(weatherPayload)?.let {
                commands.add(ClassicPostAuthProbeCommand("weather-daily", it))
            }
            buildSetHourlyWeatherForecastCommand(weatherPayload)?.let {
                commands.add(ClassicPostAuthProbeCommand("weather-hourly", it))
            }
        }

        return commands
    }

    private fun buildPostLocationCommand(weatherPayload: JSONObject): ByteArray? {
        val latitude = weatherPayload.optNullableDouble("latitude") ?: 47.0105
        val longitude = weatherPayload.optNullableDouble("longitude") ?: 28.8638
        val altitude = weatherPayload.optNullableDouble("altitude") ?: 0.0
        if (latitude == 0.0 && longitude == 0.0) {
            return null
        }

        val location = java.io.ByteArrayOutputStream()
        writeProtoInt32Field(location, 1, (System.currentTimeMillis() / 1000L).toInt())
        writeProtoDoubleField(location, 2, longitude)
        writeProtoDoubleField(location, 3, latitude)
        writeProtoDoubleField(location, 4, altitude)

        val locationEnvelope = java.io.ByteArrayOutputStream()
        writeProtoBytesField(locationEnvelope, 3, location.toByteArray())

        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 16)
        writeProtoVarintField(command, 2, 2)
        writeProtoBytesField(command, 18, locationEnvelope.toByteArray())
        return command.toByteArray()
    }

    private fun buildClassicWeatherRefreshCommands(weatherPayload: JSONObject): List<ClassicPostAuthProbeCommand> {
        Log.i(TAG, "classic bridge weather payload ${describeWeatherPayload(weatherPayload)}")
        val commands = mutableListOf<ClassicPostAuthProbeCommand>()
        buildPostLocationCommand(weatherPayload)?.let {
            commands.add(ClassicPostAuthProbeCommand("phone-location-refresh", it))
        }
        commands.add(ClassicPostAuthProbeCommand("weather-locations-read-refresh", buildGetWeatherLocationsCommand()))
        commands.add(ClassicPostAuthProbeCommand("weather-location-add-refresh", buildAddWeatherLocationCommand(weatherPayload)))
        commands.add(ClassicPostAuthProbeCommand("weather-locations-order-refresh", buildSetWeatherLocationsOrderCommand(weatherPayload)))
        commands.add(ClassicPostAuthProbeCommand("weather-temp-unit-refresh", buildSetWeatherTempUnitCommand()))
        commands.add(ClassicPostAuthProbeCommand("weather-alerts-refresh", buildSetWeatherAlertsCommand()))
        buildSetCurrentWeatherCommand(weatherPayload)?.let {
            commands.add(ClassicPostAuthProbeCommand("weather-current-refresh", it))
        }
        buildSetDailyWeatherForecastCommand(weatherPayload)?.let {
            commands.add(ClassicPostAuthProbeCommand("weather-daily-refresh", it))
        }
        buildSetHourlyWeatherForecastCommand(weatherPayload)?.let {
            commands.add(ClassicPostAuthProbeCommand("weather-hourly-refresh", it))
        }
        return commands
    }

    private fun describeWeatherPayload(weatherPayload: JSONObject): String {
        val current = weatherPayload.optJSONObject("current")
        val dailyCount = weatherPayload.optJSONArray("daily")?.length() ?: 0
        val hourlyCount = weatherPayload.optJSONArray("hourly")?.length() ?: 0
        val firstDaily = weatherPayload.optJSONArray("daily")?.optJSONObject(0)
        val firstHourly = weatherPayload.optJSONArray("hourly")?.optJSONObject(0)
        return "location=${weatherPayload.optString("locationKey", "-")} " +
            "name=${weatherPayload.optString("locationName", "-")} " +
            "published=${weatherPayload.optString("publicationTimestamp", "-")} " +
            "current=${current != null} temp=${current?.optString("temperatureC", "-") ?: "-"} " +
            "humidity=${current?.optString("humidity", "-") ?: "-"} " +
            "wind=${current?.optString("windSpeedBeaufort", "-") ?: "-"}/${current?.optString("windDirection", "-") ?: "-"} " +
            "uv=${current?.optString("uvIndex", "-") ?: "-"} " +
            "aqi=${current?.optString("aqi", "-") ?: "-"} " +
            "pressure=${current?.optString("pressureHpa", "-") ?: "-"} " +
            "daily=$dailyCount today=${firstDaily?.optString("temperatureMinC", "-") ?: "-"}.." +
            "${firstDaily?.optString("temperatureMaxC", "-") ?: "-"} sunrise=${firstDaily?.optString("sunrise", "-") ?: "-"} " +
            "sunset=${firstDaily?.optString("sunset", "-") ?: "-"} " +
            "hourly=$hourlyCount next=${firstHourly?.optString("temperatureC", "-") ?: "-"}"
    }

    private fun resolveClassicWeatherPayload(seed: JSONObject?): JSONObject? {
        if (seed == null) {
            return null
        }

        val locationResolution = resolveWeatherPayloadPhoneLocation(seed)
        val locatedPayload = locationResolution.payload
        val hasForecast = locatedPayload.optJSONObject("current") != null &&
            (locatedPayload.optJSONArray("daily")?.length() ?: 0) > 0 &&
            (locatedPayload.optJSONArray("hourly")?.length() ?: 0) > 0

        if (hasForecast && !locationResolution.changed) {
            return locatedPayload
        }

        return fetchOpenMeteoWeatherPayload(locatedPayload) ?: locatedPayload
    }

    private fun resolveWeatherPayloadPhoneLocation(seed: JSONObject): WeatherLocationResolution {
        val payload = JSONObject(seed.toString())
        val location = bestPhoneWeatherLocation()
            ?: return WeatherLocationResolution(payload, changed = false)

        val latitude = location.latitude
        val longitude = location.longitude
        val previousLatitude = payload.optNullableDouble("latitude")
        val previousLongitude = payload.optNullableDouble("longitude")
        val changed = previousLatitude == null ||
            previousLongitude == null ||
            kotlin.math.abs(previousLatitude - latitude) > 0.01 ||
            kotlin.math.abs(previousLongitude - longitude) > 0.01

        if (!changed) {
            return WeatherLocationResolution(payload, changed = false)
        }

        val locationName = resolveWeatherLocationName(latitude, longitude)
        payload.put("cityName", locationName)
        payload.put("locationName", locationName)
        payload.put("locationKey", buildPhoneWeatherLocationKey(latitude, longitude, locationName))
        payload.put("latitude", latitude)
        payload.put("longitude", longitude)
        payload.put("altitude", location.altitude.takeIf { location.hasAltitude() } ?: 0.0)
        payload.put("isCurrentLocation", true)
        payload.put("publicationTimestamp", formatWeatherPublicationTimestamp())
        payload.remove("current")
        payload.put("daily", JSONArray())
        payload.put("hourly", JSONArray())

        Log.i(
            TAG,
            "classic weather location resolved from phone name=$locationName " +
                "lat=${"%.5f".format(Locale.US, latitude)} lon=${"%.5f".format(Locale.US, longitude)} " +
                "ageMs=${System.currentTimeMillis() - location.time}",
        )
        return WeatherLocationResolution(payload, changed = true)
    }

    private fun bestPhoneWeatherLocation(): android.location.Location? {
        val hasFine = ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) {
            Log.w(TAG, "classic weather phone location unavailable: location permission is not granted")
            return null
        }

        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
            ?: return null
        val providers = listOf(
            android.location.LocationManager.GPS_PROVIDER,
            android.location.LocationManager.NETWORK_PROVIDER,
            android.location.LocationManager.PASSIVE_PROVIDER,
        )

        val lastKnown = providers.mapNotNull { provider ->
            try {
                manager.getLastKnownLocation(provider)
            } catch (_: SecurityException) {
                null
            } catch (_: IllegalArgumentException) {
                null
            }
        }.maxWithOrNull(compareBy<android.location.Location> { it.time }.thenBy { it.accuracy * -1 })

        val fresh = requestFreshPhoneWeatherLocation(manager, providers)
        return listOfNotNull(fresh, lastKnown)
            .maxWithOrNull(compareBy<android.location.Location> { it.time }.thenBy { it.accuracy * -1 })
    }

    private fun requestFreshPhoneWeatherLocation(
        manager: android.location.LocationManager,
        providers: List<String>,
    ): android.location.Location? {
        val provider = providers.firstOrNull { name ->
            try {
                manager.isProviderEnabled(name)
            } catch (_: Exception) {
                false
            }
        } ?: return null

        val latch = java.util.concurrent.CountDownLatch(1)
        val result = java.util.concurrent.atomic.AtomicReference<android.location.Location?>()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val cancellation = android.os.CancellationSignal()
                manager.getCurrentLocation(provider, cancellation, context.mainExecutor) { location ->
                    result.set(location)
                    latch.countDown()
                }
                val completed = latch.await(4, java.util.concurrent.TimeUnit.SECONDS)
                if (!completed) {
                    cancellation.cancel()
                }
            } else {
                @Suppress("DEPRECATION")
                val listener = object : android.location.LocationListener {
                    override fun onLocationChanged(location: android.location.Location) {
                        result.set(location)
                        latch.countDown()
                    }

                    @Deprecated("Deprecated in Android API")
                    override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) = Unit

                    override fun onProviderEnabled(provider: String) = Unit
                    override fun onProviderDisabled(provider: String) = Unit
                }
                mainHandler.post {
                    try {
                        @Suppress("DEPRECATION")
                        manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
                    } catch (_: SecurityException) {
                        latch.countDown()
                    } catch (_: IllegalArgumentException) {
                        latch.countDown()
                    }
                }
                latch.await(4, java.util.concurrent.TimeUnit.SECONDS)
                mainHandler.post {
                    try {
                        manager.removeUpdates(listener)
                    } catch (_: SecurityException) {
                        // The listener may already be detached.
                    }
                }
            }
        } catch (_: SecurityException) {
            return null
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            return null
        }

        return result.get()
    }

    private fun resolveWeatherLocationName(latitude: Double, longitude: Double): String {
        return try {
            @Suppress("DEPRECATION")
            val address = android.location.Geocoder(context, Locale("ru"))
                .getFromLocation(latitude, longitude, 1)
                ?.firstOrNull()
            listOfNotNull(
                address?.locality,
                address?.subAdminArea?.takeIf { it != address.locality },
                address?.countryName,
            ).filter { it.isNotBlank() }.joinToString(", ").ifBlank { "Текущее местоположение" }
        } catch (_: Exception) {
            "Текущее местоположение"
        }
    }

    private fun buildPhoneWeatherLocationKey(latitude: Double, longitude: Double, locationName: String): String {
        val rounded = "%.3f,%.3f:%s".format(Locale.US, latitude, longitude, locationName)
        return "gps:${kotlin.math.abs(rounded.hashCode()) % 1_000_000}"
    }

    private fun fetchOpenMeteoWeatherPayload(seed: JSONObject): JSONObject? {
        val latitude = seed.optNullableDouble("latitude") ?: return null
        val longitude = seed.optNullableDouble("longitude") ?: return null
        val url = buildOpenMeteoForecastUrl(latitude, longitude)

        return try {
            val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
            connection.connectTimeout = 5_000
            connection.readTimeout = 5_000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")

            val status = connection.responseCode
            if (status !in 200..299) {
                throw IOException("Open-Meteo HTTP $status")
            }

            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val data = JSONObject(body)
            val airQuality = fetchOpenMeteoAirQuality(latitude, longitude)
            val payload = JSONObject(seed.toString())
            payload.put("current", buildOpenMeteoCurrentWeather(data, airQuality))
            payload.put("daily", buildOpenMeteoDailyWeather(data, airQuality))
            payload.put("hourly", buildOpenMeteoHourlyWeather(data, airQuality))
            payload.put(
                "publicationTimestamp",
                formatWeatherPublicationTimestamp(
                    data.optJSONObject("current")?.optString("time", ""),
                    data.optNullableInt("utc_offset_seconds"),
                ),
            )
            Log.i(TAG, "classic native weather fetched ${describeWeatherPayload(payload)}")
            payload
        } catch (error: Exception) {
            Log.w(TAG, "classic native weather fetch failed: ${error.message}")
            null
        }
    }

    private fun buildOpenMeteoForecastUrl(latitude: Double, longitude: Double): String {
        return "https://api.open-meteo.com/v1/forecast" +
            "?latitude=${"%.6f".format(Locale.US, latitude)}" +
            "&longitude=${"%.6f".format(Locale.US, longitude)}" +
            "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl" +
            "&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset" +
            "&timezone=auto&forecast_days=7"
    }

    private fun fetchOpenMeteoAirQuality(latitude: Double, longitude: Double): JSONObject? {
        val url = "https://air-quality-api.open-meteo.com/v1/air-quality" +
            "?latitude=${"%.6f".format(Locale.US, latitude)}" +
            "&longitude=${"%.6f".format(Locale.US, longitude)}" +
            "&current=european_aqi,uv_index" +
            "&hourly=european_aqi,uv_index" +
            "&timezone=auto&forecast_days=7"

        return try {
            val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
            connection.connectTimeout = 5_000
            connection.readTimeout = 5_000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")

            val status = connection.responseCode
            if (status !in 200..299) {
                throw IOException("Open-Meteo Air Quality HTTP $status")
            }

            val body = connection.inputStream.bufferedReader().use { it.readText() }
            JSONObject(body)
        } catch (error: Exception) {
            Log.w(TAG, "classic native weather air-quality fetch failed: ${error.message}")
            null
        }
    }

    private fun buildOpenMeteoCurrentWeather(data: JSONObject, airQuality: JSONObject?): JSONObject? {
        val current = data.optJSONObject("current") ?: return null
        val temperature = current.optNullableDouble("temperature_2m") ?: return null
        val airCurrent = airQuality?.optJSONObject("current")
        val aqi = airCurrent?.optNullableInt("european_aqi")
        val uvIndex = airCurrent?.optNullableDouble("uv_index")
        val item = JSONObject()
        item.put("conditionCode", mapOpenMeteoCodeToXiaomi(current.optNullableInt("weather_code")))
        item.put("humidity", current.optNullableInt("relative_humidity_2m"))
        item.put("pressureHpa", current.optNullableDouble("pressure_msl"))
        item.put("temperatureC", temperature.roundToInt())
        item.put("uvIndex", uvIndex?.roundToInt())
        item.put("aqi", aqi)
        item.put("aqiLabel", formatEuropeanAqiLabel(aqi))
        item.put("windDirection", current.optNullableInt("wind_direction_10m"))
        item.put("windSpeedBeaufort", kmhToBeaufort(current.optNullableDouble("wind_speed_10m")))
        return item
    }

    private fun buildOpenMeteoDailyWeather(data: JSONObject, airQuality: JSONObject?): JSONArray {
        val daily = data.optJSONObject("daily") ?: return JSONArray()
        val times = daily.optJSONArray("time") ?: return JSONArray()
        val weatherCodes = daily.optJSONArray("weather_code")
        val maxTemperatures = daily.optJSONArray("temperature_2m_max")
        val minTemperatures = daily.optJSONArray("temperature_2m_min")
        val sunrises = daily.optJSONArray("sunrise")
        val sunsets = daily.optJSONArray("sunset")
        val dailyAqi = aggregateOpenMeteoHourlyDailyMax(airQuality, "european_aqi")
        val dailyUv = aggregateOpenMeteoHourlyDailyMax(airQuality, "uv_index")
        val utcOffsetSeconds = data.optNullableInt("utc_offset_seconds")
        val result = JSONArray()
        val count = minOf(times.length(), 7)

        for (index in 0 until count) {
            val date = times.optNullableString(index)
            val aqi = date?.let { dailyAqi[it] }
            val item = JSONObject()
            item.put("conditionCode", mapOpenMeteoCodeToXiaomi(weatherCodes.optNullableInt(index)))
            item.put("sunrise", formatOptionalWeatherTimestamp(sunrises.optNullableString(index), utcOffsetSeconds))
            item.put("sunset", formatOptionalWeatherTimestamp(sunsets.optNullableString(index), utcOffsetSeconds))
            item.put("temperatureMaxC", maxTemperatures.optNullableDouble(index)?.roundToInt() ?: 0)
            item.put("temperatureMinC", minTemperatures.optNullableDouble(index)?.roundToInt() ?: 0)
            item.put("uvIndex", date?.let { dailyUv[it] }?.roundToInt())
            item.put("aqi", aqi?.roundToInt())
            item.put("aqiLabel", formatEuropeanAqiLabel(aqi?.roundToInt()))
            result.put(item)
        }
        return result
    }

    private fun buildOpenMeteoHourlyWeather(data: JSONObject, airQuality: JSONObject?): JSONArray {
        val hourly = data.optJSONObject("hourly") ?: return JSONArray()
        val times = hourly.optJSONArray("time") ?: return JSONArray()
        val temperatures = hourly.optJSONArray("temperature_2m")
        val weatherCodes = hourly.optJSONArray("weather_code")
        val windSpeeds = hourly.optJSONArray("wind_speed_10m")
        val windDirections = hourly.optJSONArray("wind_direction_10m")
        val airHourly = airQuality?.optJSONObject("hourly")
        val airTimes = airHourly?.optJSONArray("time")
        val hourlyAqi = airHourly?.optJSONArray("european_aqi")
        val hourlyUv = airHourly?.optJSONArray("uv_index")
        val utcOffsetSeconds = data.optNullableInt("utc_offset_seconds")
        val result = JSONArray()
        val now = System.currentTimeMillis() - 60 * 60 * 1000L
        var start = 0

        for (index in 0 until times.length()) {
            val timeMs = parseOpenMeteoLocalTimeMillis(times.optNullableString(index), utcOffsetSeconds)
            if (timeMs != null && timeMs >= now) {
                start = index
                break
            }
        }

        val count = minOf(times.length() - start, 24)
        for (offset in 0 until count) {
            val index = start + offset
            val item = JSONObject()
            item.put("conditionCode", mapOpenMeteoCodeToXiaomi(weatherCodes.optNullableInt(index)))
            item.put("temperatureC", temperatures.optNullableDouble(index)?.roundToInt() ?: 0)
            item.put("windDirection", windDirections.optNullableInt(index))
            item.put("windSpeedBeaufort", kmhToBeaufort(windSpeeds.optNullableDouble(index)))
            val airIndex = findOpenMeteoTimeIndex(airTimes, times.optNullableString(index))
            val aqi = if (airIndex >= 0) hourlyAqi.optNullableInt(airIndex) else null
            item.put("uvIndex", if (airIndex >= 0) hourlyUv.optNullableDouble(airIndex)?.roundToInt() else null)
            item.put("aqi", aqi)
            item.put("aqiLabel", formatEuropeanAqiLabel(aqi))
            result.put(item)
        }
        return result
    }

    private fun aggregateOpenMeteoHourlyDailyMax(data: JSONObject?, key: String): Map<String, Double> {
        val hourly = data?.optJSONObject("hourly") ?: return emptyMap()
        val times = hourly.optJSONArray("time") ?: return emptyMap()
        val values = hourly.optJSONArray(key) ?: return emptyMap()
        val result = mutableMapOf<String, Double>()

        for (index in 0 until times.length()) {
            val time = times.optNullableString(index) ?: continue
            val date = time.substringBefore("T").takeIf { it.length == 10 } ?: continue
            val value = values.optNullableDouble(index) ?: continue
            val previous = result[date]
            if (previous == null || value > previous) {
                result[date] = value
            }
        }

        return result
    }

    private fun findOpenMeteoTimeIndex(times: JSONArray?, target: String?): Int {
        if (times == null || target.isNullOrBlank()) {
            return -1
        }

        for (index in 0 until times.length()) {
            if (times.optNullableString(index) == target) {
                return index
            }
        }

        return -1
    }

    private fun parseOpenMeteoLocalTimeMillis(value: String?, utcOffsetSeconds: Int? = null): Long? {
        if (value.isNullOrBlank()) {
            return null
        }
        return try {
            val localDateTime = java.time.LocalDateTime.parse(value)
            val instant = if (utcOffsetSeconds != null) {
                localDateTime.atOffset(java.time.ZoneOffset.ofTotalSeconds(utcOffsetSeconds)).toInstant()
            } else {
                localDateTime.atZone(java.time.ZoneId.systemDefault()).toInstant()
            }
            instant
                .toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }

    private fun formatWeatherPublicationTimestamp(value: String? = null, utcOffsetSeconds: Int? = null): String {
        val openMeteoTimestamp = formatOpenMeteoLocalTimestamp(value, utcOffsetSeconds)
        if (openMeteoTimestamp != null) {
            return openMeteoTimestamp
        }

        val zonedDateTime = try {
            if (value.isNullOrBlank()) {
                java.time.ZonedDateTime.now()
            } else {
                java.time.LocalDateTime.parse(value).atZone(java.time.ZoneId.systemDefault())
            }
        } catch (_: Exception) {
            java.time.ZonedDateTime.now()
        }
        return zonedDateTime.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME)
    }

    private fun formatOptionalWeatherTimestamp(value: String?, utcOffsetSeconds: Int? = null): String {
        return if (value.isNullOrBlank()) "" else formatWeatherPublicationTimestamp(value, utcOffsetSeconds)
    }

    private fun formatOpenMeteoLocalTimestamp(value: String?, utcOffsetSeconds: Int?): String? {
        if (value.isNullOrBlank() || utcOffsetSeconds == null) {
            return null
        }

        return try {
            val localDateTime = java.time.LocalDateTime.parse(value)
            localDateTime
                .atOffset(java.time.ZoneOffset.ofTotalSeconds(utcOffsetSeconds))
                .format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        } catch (_: Exception) {
            null
        }
    }

    private fun formatEuropeanAqiLabel(value: Int?): String {
        return when (value) {
            null -> "Нет данных"
            in 0..20 -> "Хорошо"
            in 21..40 -> "Норма"
            in 41..60 -> "Средне"
            in 61..80 -> "Плохо"
            in 81..100 -> "Очень плохо"
            else -> "Опасно"
        }
    }

    private fun mapOpenMeteoCodeToXiaomi(code: Int?): Int {
        return when (code) {
            0 -> 0
            1, 2 -> 1
            3 -> 2
            45, 48 -> 18
            51, 53, 56, 61 -> 7
            55, 63 -> 8
            57, 66, 67 -> 19
            65 -> 10
            71 -> 14
            73, 77 -> 15
            75 -> 16
            80 -> 3
            81 -> 8
            82 -> 9
            85 -> 13
            86 -> 16
            95 -> 4
            96, 99 -> 5
            else -> XIAOMI_WEATHER_CLEAR_SKY
        }
    }

    private fun kmhToBeaufort(value: Double?): Int? {
        val speed = value ?: return null
        return when {
            speed < 1 -> 0
            speed < 6 -> 1
            speed < 12 -> 2
            speed < 20 -> 3
            speed < 29 -> 4
            speed < 39 -> 5
            speed < 50 -> 6
            speed < 62 -> 7
            speed < 75 -> 8
            speed < 89 -> 9
            speed < 103 -> 10
            speed < 118 -> 11
            else -> 12
        }
    }

    private fun buildSetCurrentTimeCommand(timeOffsetMinutes: Int = 0): ByteArray {
        val now = GregorianCalendar.getInstance().apply {
            if (timeOffsetMinutes != 0) {
                add(Calendar.MINUTE, timeOffsetMinutes)
            }
        }
        val timezone = TimeZone.getDefault()

        val date = java.io.ByteArrayOutputStream()
        writeProtoVarintField(date, 1, now.get(Calendar.YEAR))
        writeProtoVarintField(date, 2, now.get(Calendar.MONTH) + 1)
        writeProtoVarintField(date, 3, now.get(Calendar.DATE))

        val time = java.io.ByteArrayOutputStream()
        writeProtoVarintField(time, 1, now.get(Calendar.HOUR_OF_DAY))
        writeProtoVarintField(time, 2, now.get(Calendar.MINUTE))
        writeProtoVarintField(time, 3, now.get(Calendar.SECOND))
        writeProtoVarintField(time, 4, now.get(Calendar.MILLISECOND))

        val zoneOffsetBlocks = ((now.get(Calendar.ZONE_OFFSET) / 1000) / 60) / 15
        val dstOffsetBlocks = ((now.get(Calendar.DST_OFFSET) / 1000) / 60) / 15
        val timeZone = java.io.ByteArrayOutputStream()
        writeProtoSInt32Field(timeZone, 1, zoneOffsetBlocks)
        writeProtoSInt32Field(timeZone, 2, dstOffsetBlocks)
        writeProtoStringField(timeZone, 3, timezone.id)

        Log.i(
            TAG,
            "classic service time sync " +
                "local=${now.get(Calendar.YEAR)}-${(now.get(Calendar.MONTH) + 1).toString().padStart(2, '0')}-${now.get(Calendar.DATE).toString().padStart(2, '0')} " +
                "${now.get(Calendar.HOUR_OF_DAY).toString().padStart(2, '0')}:${now.get(Calendar.MINUTE).toString().padStart(2, '0')}:${now.get(Calendar.SECOND).toString().padStart(2, '0')} " +
                "zone=${timezone.id} zoneBlocks=$zoneOffsetBlocks dstBlocks=$dstOffsetBlocks " +
                "is24h=${android.text.format.DateFormat.is24HourFormat(context)}",
        )

        val clock = java.io.ByteArrayOutputStream()
        writeProtoBytesField(clock, 1, date.toByteArray())
        writeProtoBytesField(clock, 2, time.toByteArray())
        writeProtoBytesField(clock, 3, timeZone.toByteArray())
        writeProtoVarintField(clock, 4, if (android.text.format.DateFormat.is24HourFormat(context)) 0 else 1)

        val system = java.io.ByteArrayOutputStream()
        writeProtoBytesField(system, 4, clock.toByteArray())

        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 2)
        writeProtoVarintField(command, 2, 3)
        writeProtoBytesField(command, 4, system.toByteArray())
        return command.toByteArray()
    }

    private fun buildSetWeatherTempUnitCommand(): ByteArray {
        val prefs = java.io.ByteArrayOutputStream()
        writeProtoVarintField(prefs, 1, 1) // Celsius.

        val weather = java.io.ByteArrayOutputStream()
        writeProtoBytesField(weather, 6, prefs.toByteArray())

        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 10)
        writeProtoVarintField(command, 2, 10)
        writeProtoBytesField(command, 12, weather.toByteArray())
        return command.toByteArray()
    }

    private fun buildSetWeatherAlertsCommand(): ByteArray {
        val prefs = java.io.ByteArrayOutputStream()
        writeProtoVarintField(prefs, 2, 1) // Weather alerts enabled.

        val weather = java.io.ByteArrayOutputStream()
        writeProtoBytesField(weather, 6, prefs.toByteArray())

        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 10)
        writeProtoVarintField(command, 2, 10)
        writeProtoBytesField(command, 12, weather.toByteArray())
        return command.toByteArray()
    }

    private fun buildGetWeatherPrefsCommand(): ByteArray {
        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 10)
        writeProtoVarintField(command, 2, 9)
        return command.toByteArray()
    }

    private fun buildGetWeatherLocationsCommand(): ByteArray {
        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 10)
        writeProtoVarintField(command, 2, 5)
        return command.toByteArray()
    }

    private fun buildAddWeatherLocationCommand(weatherPayload: JSONObject): ByteArray {
        val weather = java.io.ByteArrayOutputStream()
        writeProtoBytesField(weather, 5, buildWeatherLocation(weatherPayload))
        return buildWeatherCommand(7, weather.toByteArray())
    }

    private fun buildSetWeatherLocationsOrderCommand(weatherPayload: JSONObject): ByteArray {
        val locations = java.io.ByteArrayOutputStream()
        writeProtoBytesField(locations, 1, buildWeatherLocation(weatherPayload))

        val weather = java.io.ByteArrayOutputStream()
        writeProtoBytesField(weather, 4, locations.toByteArray())
        return buildWeatherCommand(6, weather.toByteArray())
    }

    private fun buildSetCurrentWeatherCommand(weatherPayload: JSONObject): ByteArray? {
        val current = weatherPayload.optJSONObject("current") ?: return null

        val currentWeather = java.io.ByteArrayOutputStream()
        writeProtoBytesField(currentWeather, 1, buildWeatherMetadata(weatherPayload))
        writeProtoVarintField(currentWeather, 2, current.optInt("conditionCode", XIAOMI_WEATHER_CLEAR_SKY))
        writeProtoBytesField(currentWeather, 3, buildWeatherUnitValue(current.optInt("temperatureC", 0), "℃"))
        val humidity = current.optNullableInt("humidity")
        writeProtoBytesField(currentWeather, 4, buildWeatherUnitValue(humidity ?: 0, if (humidity != null) "%" else ""))
        val windSpeed = current.optNullableInt("windSpeedBeaufort")
        writeProtoBytesField(currentWeather, 5, buildWeatherUnitValue(windSpeed ?: 0, if (windSpeed != null) current.optInt("windDirection", 0).toString() else ""))
        writeProtoBytesField(currentWeather, 6, buildWeatherUnitValue(current.optNullableInt("uvIndex") ?: 0, ""))
        writeProtoBytesField(currentWeather, 7, buildWeatherAqiUnitValue(current))
        writeProtoBytesField(currentWeather, 8, buildEmptyWeatherAlertsList())
        current.optNullableFloat("pressureHpa")?.let {
            writeProtoFloatField(currentWeather, 9, it * 100f)
        }

        val weather = java.io.ByteArrayOutputStream()
        writeProtoBytesField(weather, 1, currentWeather.toByteArray())

        return buildWeatherCommand(0, weather.toByteArray())
    }

    private fun buildSetDailyWeatherForecastCommand(weatherPayload: JSONObject): ByteArray? {
        val daily = weatherPayload.optJSONArray("daily") ?: return null
        if (daily.length() == 0) {
            return null
        }

        val entries = java.io.ByteArrayOutputStream()
        val count = minOf(daily.length(), 7)
        for (index in 0 until count) {
            val day = daily.optJSONObject(index) ?: continue
            val entry = java.io.ByteArrayOutputStream()
            writeProtoBytesField(entry, 1, buildWeatherAqiUnitValue(day))
            writeProtoBytesField(entry, 2, buildWeatherRange(day.optInt("conditionCode", XIAOMI_WEATHER_CLEAR_SKY), day.optInt("conditionCode", XIAOMI_WEATHER_CLEAR_SKY)))
            writeProtoBytesField(entry, 3, buildWeatherRange(day.optInt("temperatureMaxC", 0), day.optInt("temperatureMinC", 0)))
            writeProtoStringField(entry, 4, "℃")
            val sunrise = day.optString("sunrise", "")
            val sunset = day.optString("sunset", "")
            if (sunrise.isNotBlank() || sunset.isNotBlank()) {
                writeProtoBytesField(entry, 5, buildWeatherSunriseSunset(sunrise, sunset))
            }
            writeProtoBytesField(entries, 1, entry.toByteArray())
        }

        val forecast = java.io.ByteArrayOutputStream()
        writeProtoBytesField(forecast, 1, buildWeatherMetadata(weatherPayload))
        writeProtoBytesField(forecast, 2, entries.toByteArray())

        val weather = java.io.ByteArrayOutputStream()
        writeProtoBytesField(weather, 2, forecast.toByteArray())

        return buildWeatherCommand(1, weather.toByteArray())
    }

    private fun buildSetHourlyWeatherForecastCommand(weatherPayload: JSONObject): ByteArray? {
        val hourly = weatherPayload.optJSONArray("hourly") ?: return null
        if (hourly.length() == 0) {
            return null
        }

        val entries = java.io.ByteArrayOutputStream()
        val count = minOf(hourly.length(), 23)
        for (index in 0 until count) {
            val hour = hourly.optJSONObject(index) ?: continue
            val entry = java.io.ByteArrayOutputStream()
            writeProtoBytesField(entry, 1, buildWeatherAqiUnitValue(hour))
            writeProtoBytesField(entry, 2, buildWeatherRange(0, hour.optInt("conditionCode", XIAOMI_WEATHER_CLEAR_SKY)))
            writeProtoBytesField(entry, 3, buildWeatherRange(0, hour.optInt("temperatureC", 0)))
            hour.optNullableInt("windSpeedBeaufort")?.let { speed ->
                writeProtoBytesField(entry, 6, buildWeatherUnitValue(speed, hour.optInt("windDirection", 0).toString()))
            }
            writeProtoBytesField(entries, 1, entry.toByteArray())
        }

        val forecast = java.io.ByteArrayOutputStream()
        writeProtoBytesField(forecast, 1, buildWeatherMetadata(weatherPayload))
        writeProtoBytesField(forecast, 2, entries.toByteArray())

        val weather = java.io.ByteArrayOutputStream()
        writeProtoBytesField(weather, 2, forecast.toByteArray())

        return buildWeatherCommand(2, weather.toByteArray())
    }

    private fun buildWeatherCommand(subtype: Int, weatherPayload: ByteArray): ByteArray {
        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 10)
        writeProtoVarintField(command, 2, subtype)
        writeProtoBytesField(command, 12, weatherPayload)
        return command.toByteArray()
    }

    private fun buildWeatherMetadata(weatherPayload: JSONObject): ByteArray {
        val locationName = weatherPayload.optString("locationName", "Chisinau").ifBlank { "Chisinau" }
        val cityName = weatherPayload.optString("cityName", "").ifBlank { locationName }
        val locationKey = weatherPayload.optString("locationKey", "").ifBlank {
            "accu:${kotlin.math.abs(locationName.hashCode()) % 1_000_000}"
        }
        val publicationTimestamp = weatherPayload.optString("publicationTimestamp", java.time.Instant.now().toString())

        val metadata = java.io.ByteArrayOutputStream()
        writeProtoStringField(metadata, 1, publicationTimestamp)
        writeProtoStringField(metadata, 2, cityName)
        writeProtoStringField(metadata, 3, locationName)
        writeProtoStringField(metadata, 4, locationKey)
        writeProtoVarintField(metadata, 5, if (weatherPayload.optBoolean("isCurrentLocation", true)) 1 else 0)
        return metadata.toByteArray()
    }

    private fun buildWeatherLocation(weatherPayload: JSONObject): ByteArray {
        val locationName = weatherPayload.optString("locationName", "Chisinau").ifBlank { "Chisinau" }
        val locationKey = weatherPayload.optString("locationKey", "").ifBlank {
            "accu:${kotlin.math.abs(locationName.hashCode()) % 1_000_000}"
        }

        val location = java.io.ByteArrayOutputStream()
        writeProtoStringField(location, 1, locationKey)
        writeProtoStringField(location, 2, locationName)
        return location.toByteArray()
    }

    private fun buildWeatherUnitValue(value: Int, unit: String): ByteArray {
        val unitValue = java.io.ByteArrayOutputStream()
        writeProtoStringField(unitValue, 1, unit)
        writeProtoSInt32Field(unitValue, 2, value)
        return unitValue.toByteArray()
    }

    private fun buildWeatherAqiUnitValue(item: JSONObject): ByteArray {
        val value = item.optNullableInt("aqi") ?: 0
        val label = item.optString("aqiLabel", "").ifBlank { "Unknown" }
        return buildWeatherUnitValue(value, label)
    }

    private fun buildWeatherRange(from: Int, to: Int): ByteArray {
        val range = java.io.ByteArrayOutputStream()
        writeProtoSInt32Field(range, 1, from)
        writeProtoSInt32Field(range, 2, to)
        return range.toByteArray()
    }

    private fun buildEmptyWeatherAlertsList(): ByteArray {
        return java.io.ByteArrayOutputStream().toByteArray()
    }

    private fun buildWeatherSunriseSunset(sunrise: String, sunset: String): ByteArray {
        val value = java.io.ByteArrayOutputStream()
        writeProtoStringField(value, 1, sunrise)
        writeProtoStringField(value, 2, sunset)
        return value.toByteArray()
    }

    private fun JSONObject.optNullableInt(key: String): Int? {
        return if (has(key) && !isNull(key)) optInt(key) else null
    }

    private fun JSONObject.optNullableFloat(key: String): Float? {
        return if (has(key) && !isNull(key)) optDouble(key).toFloat() else null
    }

    private fun JSONObject.optNullableDouble(key: String): Double? {
        return if (has(key) && !isNull(key)) optDouble(key) else null
    }

    private fun JSONArray?.optNullableInt(index: Int): Int? {
        val array = this ?: return null
        return if (index in 0 until array.length() && !array.isNull(index)) array.optInt(index) else null
    }

    private fun JSONArray?.optNullableDouble(index: Int): Double? {
        val array = this ?: return null
        return if (index in 0 until array.length() && !array.isNull(index)) array.optDouble(index) else null
    }

    private fun JSONArray?.optNullableString(index: Int): String? {
        val array = this ?: return null
        return if (index in 0 until array.length() && !array.isNull(index)) array.optString(index).takeIf { it.isNotBlank() } else null
    }

    private fun classicActivityFileIds(bytes: ByteArray, decryptionKey: ByteArray?): List<ByteArray> {
        if (decryptionKey == null) {
            return emptyList()
        }

        val fileIds = mutableListOf<ByteArray>()
        var offset = 0
        while (offset <= bytes.size - 8) {
            if (bytes[offset] == 0xA5.toByte() && bytes[offset + 1] == 0xA5.toByte()) {
                val packetType = bytes[offset + 2].toInt() and 0x0f
                val payloadLength = littleEndianUInt16(bytes, offset + 4)
                val packetSize = 8 + payloadLength
                if (payloadLength >= 2 && offset + packetSize <= bytes.size && packetType == 3) {
                    val payloadStart = offset + 8
                    val rawChannel = bytes[payloadStart].toInt() and 0x0f
                    val opCode = bytes[payloadStart + 1].toInt() and 0xff
                    if (rawChannel == 1 && opCode == 2) {
                        val encryptedPayload = bytes.copyOfRange(payloadStart + 2, payloadStart + payloadLength)
                        val decryptedPayload = try {
                            aesCtrCrypt(decryptionKey, decryptionKey, encryptedPayload)
                        } catch (_: Exception) {
                            null
                        }
                        if (decryptedPayload != null) {
                            fileIds.addAll(extractClassicActivityFileIdByteList(decryptedPayload))
                        }
                    }
                    offset += packetSize.coerceAtLeast(1)
                    continue
                }
            }
            offset += 1
        }

        return fileIds.distinctBy { fullHex(it) }
    }

    private fun describeClassicActivityInventoryFiles(files: List<ClassicActivityFileSummary>): String {
        if (files.isEmpty()) {
            return "-"
        }

        return files
            .groupingBy { file -> "${file.type}/${file.subtype}/${file.detailType}/v${file.version}" }
            .eachCount()
            .entries
            .sortedBy { it.key }
            .joinToString(";") { (key, count) -> "$key:$count" }
            .take(320)
    }

    private fun extractClassicActivityFileIdByteList(commandPayload: ByteArray): List<ByteArray> {
        var commandType: Int? = null
        var commandSubtype: Int? = null
        var healthBytes: ByteArray? = null
        walkProtoFields(commandPayload) { fieldNumber, wireType, value ->
            when {
                fieldNumber == 1 && wireType == 0 -> commandType = value.intValue
                fieldNumber == 2 && wireType == 0 -> commandSubtype = value.intValue
                fieldNumber == 10 && wireType == 2 -> healthBytes = value.bytes
            }
        }
        if (commandType != 8 || (commandSubtype != 1 && commandSubtype != 2) || healthBytes == null) {
            return emptyList()
        }

        val activityFileIds = mutableListOf<ByteArray>()
        walkProtoFields(healthBytes!!) { fieldNumber, wireType, value ->
            if (fieldNumber == 2 && wireType == 2 && value.bytes != null && value.bytes.size >= 7) {
                var offset = 0
                while (offset + 7 <= value.bytes.size) {
                    activityFileIds.add(value.bytes.copyOfRange(offset, offset + 7))
                    offset += 7
                }
            }
        }
        return activityFileIds
    }

    private fun parseClassicActivityFileIds(bytes: ByteArray): List<ClassicActivityFileSummary> {
        if (bytes.size < 7) {
            return emptyList()
        }

        val files = mutableListOf<ClassicActivityFileSummary>()
        var offset = 0
        while (offset + 7 <= bytes.size) {
            val fileBytes = bytes.copyOfRange(offset, offset + 7)
            val timestampSeconds = littleEndianUInt32(fileBytes, 0)
            val timezone = fileBytes[4].toInt()
            val version = fileBytes[5].toInt() and 0xff
            val flags = fileBytes[6].toInt() and 0xff
            val type = (flags ushr 7) and 1
            val subtype = (flags and 127) ushr 2
            val detailType = flags and 3
            files.add(
                ClassicActivityFileSummary(
                    idHex = fullHex(fileBytes) ?: "",
                    timestamp = java.time.Instant.ofEpochSecond(timestampSeconds.toLong()).toString(),
                    timezone = timezone,
                    type = type,
                    subtype = subtype,
                    detailType = detailType,
                    version = version,
                    kind = classicActivityFileKind(type, subtype, detailType),
                ),
            )
            offset += 7
        }
        return files
    }

    private fun selectClassicActivityFileIdsForEntryDate(
        fileIds: List<ByteArray>,
        entryDate: String?,
        includeSleep: Boolean = true,
    ): List<ByteArray> {
        val fetchable = fileIds
            .distinctBy { fullHex(it) ?: "" }
            .mapNotNull { fileId ->
                val file = parseClassicActivityFileIds(fileId).firstOrNull() ?: return@mapNotNull null
                if (isClassicFetchableActivityFile(file)) fileId to file else null
            }

        if (entryDate.isNullOrBlank()) {
            return fetchable
                .filter { (_, file) -> includeSleep || !isClassicSleepActivityFile(file) }
                .map { it.first }
        }

        val targetDate = try {
            java.time.LocalDate.parse(entryDate)
        } catch (_: Exception) {
            null
        } ?: return fetchable.map { it.first }
        val previousEntryDate = targetDate.minusDays(1)
        val selected = fetchable.filter { (_, file) ->
            val fileEntryDate = classicActivityFileEntryLocalDate(file) ?: return@filter false
            val isSleep = isClassicSleepActivityFile(file)
            if (isSleep) {
                includeSleep && (fileEntryDate == targetDate || fileEntryDate == previousEntryDate)
            } else {
                fileEntryDate == targetDate
            }
        }

        if (selected.isNotEmpty()) {
            return selected.map { it.first }
        }

        return emptyList()
    }

    private fun sortClassicActivityFileIdsForFetch(fileIds: List<ByteArray>, entryDate: String?): List<ByteArray> {
        val targetDate = entryDate?.let {
            try {
                java.time.LocalDate.parse(it)
            } catch (_: Exception) {
                null
            }
        }
        return fileIds
            .distinctBy { fullHex(it) ?: "" }
            .sortedWith(
                compareBy<ByteArray> { fileId ->
                    parseClassicActivityFileIds(fileId).firstOrNull()?.let { file ->
                        classicActivityDateDistance(file, targetDate)
                    } ?: Int.MAX_VALUE
                }.thenBy { fileId ->
                    parseClassicActivityFileIds(fileId).firstOrNull()?.let { classicActivityFetchOrder(it) } ?: 100
                }.thenByDescending { fileId ->
                    parseClassicActivityFileIds(fileId).firstOrNull()?.timestamp ?: ""
                }.thenBy { fileId ->
                    fullHex(fileId) ?: ""
                },
            )
    }

    private fun classicActivityDateDistance(file: ClassicActivityFileSummary, targetDate: java.time.LocalDate?): Int {
        if (targetDate == null) {
            return 0
        }
        val fileDate = classicActivityFileEntryLocalDate(file) ?: return Int.MAX_VALUE
        return kotlin.math.abs(java.time.temporal.ChronoUnit.DAYS.between(targetDate, fileDate)).toInt()
    }

    private fun classicActivityFetchOrder(file: ClassicActivityFileSummary): Int {
        return when {
            file.type == 0 && file.subtype == 0 && file.detailType == 1 -> 0
            file.type == 0 && file.subtype == 0 && file.detailType == 0 -> 1
            isClassicSleepActivityFile(file) -> 2
            isClassicManualSampleActivityFile(file) -> 3
            file.type == 1 && file.detailType == 1 -> 10
            file.type == 1 && file.detailType == 0 -> 11
            file.type == 1 && file.detailType == 2 -> 12
            else -> 50
        }
    }

    private fun classicActivityFileEntryDate(file: ClassicActivityFileSummary): String? {
        return classicActivityFileEntryLocalDate(file)?.toString()
    }

    private fun classicActivityFileEntryLocalDate(file: ClassicActivityFileSummary): java.time.LocalDate? {
        return try {
            java.time.Instant.parse(file.timestamp)
                .plusSeconds(file.timezone.toLong() * 15L * 60L)
                .atOffset(java.time.ZoneOffset.UTC)
                .toLocalDate()
        } catch (_: Exception) {
            null
        }
    }

    private fun isClassicSleepActivityFile(file: ClassicActivityFileSummary): Boolean {
        return file.type == 0 && (file.subtype == 8 || file.subtype == 3)
    }

    private fun isClassicManualSampleActivityFile(file: ClassicActivityFileSummary): Boolean {
        return file.type == 0 && file.subtype == 6 && file.detailType == 0
    }

    private fun isClassicFetchableActivityFile(file: ClassicActivityFileSummary): Boolean {
        return when {
            file.type == 0 && file.subtype == 0 -> true
            isClassicSleepActivityFile(file) -> true
            isClassicManualSampleActivityFile(file) -> true
            file.type == 1 && file.detailType == 0 -> true
            file.type == 1 && file.detailType == 1 -> true
            file.type == 1 && file.detailType == 2 -> true
            else -> false
        }
    }

    private fun isClassicEntryDate(value: String): Boolean {
        return try {
            java.time.LocalDate.parse(value)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun parseClassicActivityChunk(payload: ByteArray): ClassicActivityChunk? {
        if (payload.size < 4) {
            return null
        }

        val total = littleEndianUInt16(payload, 0)
        val number = littleEndianUInt16(payload, 2)
        return ClassicActivityChunk(
            total = total,
            number = number,
            payloadBytes = payload.size - 4,
            label = "Файл активности ${number}/${total}",
        )
    }

    private fun parseClassicActivityFilePayload(bytes: ByteArray, isComplete: Boolean): ClassicActivityFileContent? {
        if (bytes.size < 8) {
            return null
        }

        val file = parseClassicActivityFileIds(bytes.copyOfRange(0, 7)).firstOrNull() ?: return null
        val padding = bytes[7].toInt() and 0xff
        val crcValid = if (isComplete) classicActivityCrcValid(bytes) else null
        val dataEnd = if (isComplete && crcValid != null && bytes.size >= 4) bytes.size - 4 else bytes.size
        val payloadBytes = (dataEnd - 8).coerceAtLeast(0)
        val daily = parseClassicDailyDetails(bytes, file, dataEnd)
        val manual = parseClassicManualSamples(bytes, file, dataEnd)
        val summary = parseClassicDailySummary(bytes, file, dataEnd)
        val sleep = parseClassicSleepDetails(bytes, file, dataEnd) ?: parseClassicSleepStages(bytes, file, dataEnd)
        val workout = parseClassicWorkoutSummary(bytes, file, dataEnd)
        val workoutDetails = parseClassicWorkoutDetails(bytes, file, dataEnd)
        val workoutGps = parseClassicWorkoutGps(bytes, file, dataEnd)
        val parsed = daily != null || manual != null || summary != null || sleep != null || workout != null || workoutDetails != null || workoutGps != null
        val samples = daily?.samples ?: manual?.samples ?: sleep?.samples ?: workoutDetails?.samples ?: emptyList()

        return ClassicActivityFileContent(
            file = file,
            fileKind = file.kind,
            padding = padding,
            payloadBytes = payloadBytes,
            crcValid = crcValid,
            parsed = parsed,
            sampleCount = daily?.sampleCount ?: manual?.sampleCount ?: sleep?.sampleCount ?: workoutDetails?.sampleCount,
            steps = daily?.steps ?: summary?.steps ?: workout?.steps,
            heartRateAvg = daily?.heartRateAvg ?: manual?.heartRateAvg ?: summary?.heartRateAvg ?: sleep?.heartRateAvg ?: workout?.heartRateAvg ?: workoutDetails?.heartRateAvg,
            heartRateMin = daily?.heartRateMin ?: manual?.heartRateMin ?: summary?.heartRateMin ?: sleep?.heartRateMin ?: workout?.heartRateMin ?: workoutDetails?.heartRateMin,
            heartRateMax = daily?.heartRateMax ?: manual?.heartRateMax ?: summary?.heartRateMax ?: sleep?.heartRateMax ?: workout?.heartRateMax ?: workoutDetails?.heartRateMax,
            heartRateResting = summary?.heartRateResting,
            spo2Avg = daily?.spo2Avg ?: manual?.spo2Avg ?: summary?.spo2Avg ?: sleep?.spo2Avg,
            spo2Min = summary?.spo2Min ?: sleep?.spo2Min,
            spo2Max = summary?.spo2Max ?: sleep?.spo2Max,
            stressAvg = daily?.stressAvg ?: manual?.stressAvg ?: summary?.stressAvg,
            stressMin = summary?.stressMin,
            stressMax = summary?.stressMax,
            calories = summary?.calories ?: workout?.calories,
            trainingLoadDay = summary?.trainingLoadDay,
            trainingLoadWeek = summary?.trainingLoadWeek,
            vitality = summary?.vitality,
            sleepStartTime = sleep?.startTime,
            sleepEndTime = sleep?.endTime,
            sleepDurationMinutes = sleep?.durationMinutes,
            sleepDeepMinutes = sleep?.deepMinutes,
            sleepLightMinutes = sleep?.lightMinutes,
            sleepRemMinutes = sleep?.remMinutes,
            sleepAwakeMinutes = sleep?.awakeMinutes,
            sleepScore = sleep?.score,
            sleepStageCount = sleep?.stageCount,
            sleepIsAwake = sleep?.isAwake,
            workoutStartTime = workout?.startTime,
            workoutEndTime = workout?.endTime,
            workoutDurationMinutes = workout?.durationMinutes,
            workoutDistanceMeters = workout?.distanceMeters,
            workoutSteps = workout?.steps,
            workoutType = workout?.workoutType,
            workoutTypeCode = workout?.workoutTypeCode,
            workoutPaceAvgSecondsPerKm = workout?.paceAvgSecondsPerKm,
            workoutPaceMaxSecondsPerKm = workout?.paceMaxSecondsPerKm,
            workoutPaceMinSecondsPerKm = workout?.paceMinSecondsPerKm,
            workoutSpeedAvgKmh = workout?.speedAvgKmh,
            workoutSpeedMaxKmh = workout?.speedMaxKmh,
            workoutCadenceAvg = workout?.cadenceAvg,
            workoutCadenceMax = workout?.cadenceMax,
            workoutStepLengthAvgCm = workout?.stepLengthAvgCm,
            workoutStepRateAvg = workout?.stepRateAvg,
            workoutStepRateMax = workout?.stepRateMax,
            workoutStrokes = workout?.strokes,
            workoutStrokeRateAvg = workout?.strokeRateAvg,
            workoutJumps = workout?.jumps,
            workoutJumpRateAvg = workout?.jumpRateAvg,
            workoutJumpRateMax = workout?.jumpRateMax,
            workoutLaps = workout?.laps,
            workoutSwolfAvg = workout?.swolfAvg,
            workoutSwimStyle = workout?.swimStyle,
            workoutElevationGainMeters = workout?.elevationGainMeters,
            workoutElevationLossMeters = workout?.elevationLossMeters,
            workoutAltitudeAvgMeters = workout?.altitudeAvgMeters,
            workoutAltitudeMaxMeters = workout?.altitudeMaxMeters,
            workoutAltitudeMinMeters = workout?.altitudeMinMeters,
            workoutTrainingEffectAerobic = workout?.trainingEffectAerobic,
            workoutTrainingEffectAnaerobic = workout?.trainingEffectAnaerobic,
            workoutLoad = workout?.workoutLoad,
            workoutRecoveryTimeHours = workout?.recoveryTimeHours,
            workoutVo2Max = workout?.vo2Max,
            workoutVitalityGain = workout?.vitalityGain,
            workoutHeartRateZoneExtremeSeconds = workout?.zoneExtremeSeconds,
            workoutHeartRateZoneAnaerobicSeconds = workout?.zoneAnaerobicSeconds,
            workoutHeartRateZoneAerobicSeconds = workout?.zoneAerobicSeconds,
            workoutHeartRateZoneFatBurnSeconds = workout?.zoneFatBurnSeconds,
            workoutHeartRateZoneWarmUpSeconds = workout?.zoneWarmUpSeconds,
            workoutGpsSampleCount = workoutGps?.sampleCount,
            workoutGpsSamples = workoutGps?.samples ?: emptyList(),
            activitySamples = samples,
        )
    }

    private fun parseClassicWorkoutSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        if (file.type != 1 || file.detailType != 1 || dataEnd <= 20) {
            return null
        }

        parseClassicKnownWorkoutSummary(bytes, file, dataEnd)?.let {
            return it
        }

        val timing = findClassicWorkoutTiming(bytes, file, dataEnd)
        if (timing == null) {
            Log.i(TAG, "unsupported workout summary timing subtype=${file.subtype} version=${file.version} file=${file.idHex}")
            return null
        }

        val scanStart = timing.afterActiveOffset
        val scanEnd = minOf(dataEnd, scanStart + 96)
        val heartRate = findClassicWorkoutHeartRateTriplet(bytes, scanStart, scanEnd)
        val zones = findClassicWorkoutHeartRateZones(bytes, scanStart, dataEnd, timing.activeSeconds)
        val distanceMeters = findClassicWorkoutDistanceMeters(bytes, file, scanStart, scanEnd)
        val calories = findClassicWorkoutCalories(bytes, file, scanStart, scanEnd)
        val steps = findClassicWorkoutSteps(bytes, file, scanStart, scanEnd, distanceMeters)

        return ClassicWorkoutSummary(
            startTime = epochSecondsIso(timing.startSeconds),
            endTime = epochSecondsIso(timing.endSeconds),
            durationMinutes = (timing.activeSeconds / 60).toInt().coerceAtLeast(1),
            distanceMeters = distanceMeters,
            calories = calories,
            steps = steps,
            heartRateAvg = heartRate?.first,
            heartRateMin = heartRate?.third,
            heartRateMax = heartRate?.second,
            workoutType = classicWorkoutTypeLabel(file.subtype),
            zoneExtremeSeconds = zones?.getOrNull(0),
            zoneAnaerobicSeconds = zones?.getOrNull(1),
            zoneAerobicSeconds = zones?.getOrNull(2),
            zoneFatBurnSeconds = zones?.getOrNull(3),
            zoneWarmUpSeconds = zones?.getOrNull(4),
        )
    }

    private fun parseClassicKnownWorkoutSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        return when (file.subtype) {
            1, 2 -> parseClassicOutdoorWalkingV1Summary(bytes, file, dataEnd)
            3 -> parseClassicTreadmillSummary(bytes, file, dataEnd)
            6 -> parseClassicOutdoorCyclingSummary(bytes, file, dataEnd)
            7 -> parseClassicIndoorCyclingSummary(bytes, file, dataEnd)
            8 -> parseClassicFreestyleSummary(bytes, file, dataEnd)
            9 -> parseClassicPoolSwimmingSummary(bytes, file, dataEnd)
            11 -> parseClassicEllipticalSummary(bytes, file, dataEnd)
            13 -> parseClassicRowingSummary(bytes, file, dataEnd)
            14 -> parseClassicJumpRopingSummary(bytes, file, dataEnd)
            16 -> parseClassicHiitSummary(bytes, file, dataEnd)
            22 -> parseClassicOutdoorWalkingV2Summary(bytes, file, dataEnd)
            23 -> parseClassicOutdoorCyclingV2Summary(bytes, file, dataEnd)
            else -> null
        }
    }

    private fun parseClassicFreestyleSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            5 -> 3
            7 -> 5
            8, 9, 10 -> 6
            else -> return null
        }
        val minDataSize = if (file.version == 5) 64 else if (file.version > 7) 76 else 75
        val dataStart = 8 + headerSize
        if (dataEnd < dataStart + minDataSize) {
            return null
        }

        var offset = dataStart
        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2

        val heartRateAvg = (bytes.getOrNull(offset)?.toInt() ?: 0) and 0xff
        offset += 1
        val heartRateMax = (bytes.getOrNull(offset)?.toInt() ?: 0) and 0xff
        offset += 1
        val heartRateMin = (bytes.getOrNull(offset)?.toInt() ?: 0) and 0xff
        offset += 1
        if (file.version > 5) {
            offset += 6
        }
        val trainingEffectAerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
        offset += 4 // aerobic training effect
        if (file.version > 6) {
            offset += 1
        }
        offset += 1
        val recoveryTimeHours = littleEndianUInt16(bytes, offset).takeIf { it in 0..240 }
        offset += 2 // recovery time

        val zoneOffset = offset
        val zones = (0 until 5).map { index -> littleEndianUInt32(bytes, zoneOffset + index * 4).toInt() }
            .takeIf { values ->
                values.all { it in 0..(24 * 60 * 60) } &&
                    values.sum() > 0 &&
                    values.sum() in (activeSeconds / 3).toInt()..(activeSeconds * 2).toInt()
            }
        offset += 20

        var workoutTypeCode: Int? = null
        var trainingEffectAnaerobic: Double? = null
        var workoutLoad: Int? = null
        var vitalityGain: Int? = null
        if (file.version == 5) {
            offset += 10
            workoutTypeCode = littleEndianUInt16(bytes, offset).takeIf { it > 0 }
            offset += 2 // Xiaomi workout type code
            offset += 2
            offset += 4 // configured time goal
            offset += 2 // configured calories goal
        } else {
            offset += 2
            offset += 4 // active seconds repeated
            trainingEffectAnaerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
            offset += 4 // anaerobic training effect
            offset += 1
            workoutTypeCode = littleEndianUInt16(bytes, offset).takeIf { it > 0 }
            offset += 2 // Xiaomi workout type code
            offset += 2
            offset += 4 // configured time goal
            offset += 2 // configured calories goal
            workoutLoad = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
            offset += 2 // workout load
            offset += 1
            if (file.version > 7) {
                vitalityGain = byteAt(bytes, offset).takeIf { it in 0..200 }
                offset += 1 // vitality gain
            }
        }

        if (!isClassicWorkoutEpochSeconds(startSeconds) ||
            !isClassicWorkoutEpochSeconds(endSeconds) ||
            endSeconds <= startSeconds ||
            activeSeconds <= 0L ||
            activeSeconds > 24L * 60L * 60L ||
            offset > dataEnd
        ) {
            return null
        }

        return ClassicWorkoutSummary(
            startTime = epochSecondsIso(startSeconds),
            endTime = epochSecondsIso(endSeconds),
            durationMinutes = (activeSeconds / 60).toInt().coerceAtLeast(1),
            distanceMeters = null,
            calories = calories,
            steps = null,
            heartRateAvg = heartRateAvg.takeIf { it in 35..230 },
            heartRateMin = heartRateMin.takeIf { it in 30..230 },
            heartRateMax = heartRateMax.takeIf { it in 35..254 },
            workoutType = classicWorkoutTypeLabel(file.subtype, workoutTypeCode),
            zoneExtremeSeconds = zones?.getOrNull(0),
            zoneAnaerobicSeconds = zones?.getOrNull(1),
            zoneAerobicSeconds = zones?.getOrNull(2),
            zoneFatBurnSeconds = zones?.getOrNull(3),
            zoneWarmUpSeconds = zones?.getOrNull(4),
            workoutTypeCode = workoutTypeCode,
            trainingEffectAerobic = trainingEffectAerobic,
            trainingEffectAnaerobic = trainingEffectAnaerobic,
            workoutLoad = workoutLoad,
            recoveryTimeHours = recoveryTimeHours,
            vitalityGain = vitalityGain,
        )
    }

    private fun parseClassicOutdoorWalkingV1Summary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            4 -> 4
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 65) return null

        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val distanceMeters = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..500_000 }
        offset += 4
        val calories = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..20_000 }
        offset += 4
        val paceMaxSecondsPerKm = normalizeClassicPaceSecondsPerMeter(littleEndianUInt32(bytes, offset).toInt())
        offset += 4 // max pace
        val paceMinSecondsPerKm = normalizeClassicPaceSecondsPerMeter(littleEndianUInt32(bytes, offset).toInt())
        offset += 4 // min pace
        offset += 4
        val steps = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..200_000 }
        offset += 4
        offset += 2
        val heartRateAvg = byteAt(bytes, offset)
        offset += 1
        val heartRateMax = byteAt(bytes, offset)
        offset += 1
        val heartRateMin = byteAt(bytes, offset)
        offset += 1
        offset += 20
        offset += 4
        offset += 9
        offset += 1
        offset += 2
        val zones = readClassicWorkoutHeartRateZonesAt(bytes, offset, dataEnd, activeSeconds)

        return buildClassicWorkoutSummary(
            file = file,
            startSeconds = startSeconds,
            endSeconds = endSeconds,
            activeSeconds = activeSeconds,
            distanceMeters = distanceMeters,
            calories = calories,
            steps = steps,
            heartRateAvg = heartRateAvg,
            heartRateMin = heartRateMin,
            heartRateMax = heartRateMax,
            zones = zones,
            paceMaxSecondsPerKm = paceMaxSecondsPerKm,
            paceMinSecondsPerKm = paceMinSecondsPerKm,
        )
    }

    private fun parseClassicOutdoorWalkingV2Summary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            1 -> 5
            4 -> 7
            5, 6 -> 9
            9 -> 13
            else -> return null
        }
        val dataStart = 8 + headerSize
        if (dataEnd < dataStart + 59) {
            return null
        }

        var offset = dataStart
        val workoutTypeCode = littleEndianUInt16(bytes, offset).takeIf { it > 0 }
        offset += 2 // Xiaomi workout type code
        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        offset += 4 // unknown
        val distanceMeters = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..500_000 }
        offset += 4
        val totalCalories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        val activeCalories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 } ?: totalCalories
        offset += 2
        var paceAvgSecondsPerKm: Int? = null
        var speedAvgKmh: Double? = null
        var stepLengthAvgCm: Int? = null
        var stepRateAvg: Int? = null
        var trainingEffectAerobic: Double? = null
        var trainingEffectAnaerobic: Double? = null
        var recoveryTimeHours: Int? = null
        var vo2Max: Int? = null
        if (file.version >= 5) {
            paceAvgSecondsPerKm = normalizeClassicPaceSecondsPerKm(littleEndianUInt32(bytes, offset).toInt())
            offset += 4 // average pace
        }
        val paceMaxSecondsPerKm = normalizeClassicPaceSecondsPerKm(littleEndianUInt32(bytes, offset).toInt())
        offset += 4 // max pace
        val paceMinSecondsPerKm = normalizeClassicPaceSecondsPerKm(littleEndianUInt32(bytes, offset).toInt())
        offset += 4 // min pace
        if (file.version >= 5) {
            speedAvgKmh = normalizeClassicSpeedKmh(littleEndianFloat(bytes, offset))
            offset += 4 // average speed
        }
        val speedMaxKmh = normalizeClassicSpeedKmh(littleEndianFloat(bytes, offset))
        offset += 4 // max speed
        val steps = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..200_000 }
        offset += 4
        if (file.version >= 5) {
            stepLengthAvgCm = littleEndianUInt16(bytes, offset).takeIf { it in 1..300 }
            offset += 2 // average step length
            stepRateAvg = normalizeClassicCadence(littleEndianUInt16(bytes, offset))
            offset += 2 // average step rate
        }
        val stepRateMax = normalizeClassicCadence(littleEndianUInt16(bytes, offset))
        offset += 2 // max step rate

        val heartRateAvg = (bytes.getOrNull(offset)?.toInt() ?: 0) and 0xff
        offset += 1
        val heartRateMax = (bytes.getOrNull(offset)?.toInt() ?: 0) and 0xff
        offset += 1
        val heartRateMin = (bytes.getOrNull(offset)?.toInt() ?: 0) and 0xff
        offset += 1
        val normalizedHeartRateAvg = heartRateAvg.takeIf { it in 35..230 }
        val normalizedHeartRateMax = heartRateMax.takeIf { it in 35..254 }
        val normalizedHeartRateMin = heartRateMin.takeIf { it in 30..230 }

        val zoneOffset = if (file.version == 1) {
            offset + 33
        } else {
            offset += 20
            trainingEffectAerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
            offset += 4 // aerobic training effect
            offset += 1
            trainingEffectAnaerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
            offset += 4 // anaerobic training effect
            offset += if (file.version >= 9) {
                vo2Max = byteAt(bytes, offset + 6).takeIf { it in 10..100 }
                6 + 1 + 2
            } else {
                4
            }
            recoveryTimeHours = littleEndianUInt16(bytes, offset).takeIf { it in 0..240 }
            offset += 2 // recovery time
            offset + 1
        }
        val zones = if (zoneOffset + 20 <= dataEnd) {
            (0 until 5).map { index -> littleEndianUInt32(bytes, zoneOffset + index * 4).toInt() }
                .takeIf { values ->
                    values.all { it in 0..(24 * 60 * 60) } &&
                        values.sum() > 0 &&
                        values.sum() in (activeSeconds / 3).toInt()..(activeSeconds * 2).toInt()
                }
        } else {
            null
        }

        if (!isClassicWorkoutEpochSeconds(startSeconds) ||
            !isClassicWorkoutEpochSeconds(endSeconds) ||
            endSeconds <= startSeconds ||
            activeSeconds <= 0L ||
            activeSeconds > 24L * 60L * 60L
        ) {
            return null
        }

        return ClassicWorkoutSummary(
            startTime = epochSecondsIso(startSeconds),
            endTime = epochSecondsIso(endSeconds),
            durationMinutes = (activeSeconds / 60).toInt().coerceAtLeast(1),
            distanceMeters = distanceMeters,
            calories = activeCalories,
            steps = steps,
            heartRateAvg = normalizedHeartRateAvg,
            heartRateMin = normalizedHeartRateMin,
            heartRateMax = normalizedHeartRateMax,
            workoutType = classicWorkoutTypeLabel(file.subtype, workoutTypeCode),
            zoneExtremeSeconds = zones?.getOrNull(0),
            zoneAnaerobicSeconds = zones?.getOrNull(1),
            zoneAerobicSeconds = zones?.getOrNull(2),
            zoneFatBurnSeconds = zones?.getOrNull(3),
            zoneWarmUpSeconds = zones?.getOrNull(4),
            workoutTypeCode = workoutTypeCode,
            paceAvgSecondsPerKm = paceAvgSecondsPerKm,
            paceMaxSecondsPerKm = paceMaxSecondsPerKm,
            paceMinSecondsPerKm = paceMinSecondsPerKm,
            speedAvgKmh = speedAvgKmh,
            speedMaxKmh = speedMaxKmh,
            stepLengthAvgCm = stepLengthAvgCm,
            stepRateAvg = stepRateAvg,
            stepRateMax = stepRateMax,
            trainingEffectAerobic = trainingEffectAerobic,
            trainingEffectAnaerobic = trainingEffectAnaerobic,
            recoveryTimeHours = recoveryTimeHours,
            vo2Max = vo2Max,
        )
    }

    private fun parseClassicTreadmillSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            5 -> 4
            10 -> 8
            11 -> 9
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 43) return null

        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val distanceMeters = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..500_000 }
        offset += 4
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        var paceAvgSecondsPerKm: Int? = null
        var cadenceAvg: Int? = null
        if (file.version >= 10) {
            paceAvgSecondsPerKm = normalizeClassicPaceSecondsPerKm(littleEndianUInt32(bytes, offset).toInt())
            offset += 4
        }
        val paceMaxSecondsPerKm = normalizeClassicPaceSecondsPerKm(littleEndianUInt32(bytes, offset).toInt())
        offset += 4
        val paceMinSecondsPerKm = normalizeClassicPaceSecondsPerKm(littleEndianUInt32(bytes, offset).toInt())
        offset += 4
        val steps = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..200_000 }
        offset += 4
        if (file.version >= 10) {
            offset += 2
            cadenceAvg = normalizeClassicCadence(littleEndianUInt16(bytes, offset))
            offset += 2
        }
        val cadenceMax = normalizeClassicCadence(littleEndianUInt16(bytes, offset))
        offset += 2
        val heartRateAvg = byteAt(bytes, offset)
        offset += 1
        val heartRateMax = byteAt(bytes, offset)
        offset += 1
        val heartRateMin = byteAt(bytes, offset)
        offset += 1
        val trainingEffectAerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
        offset += 4
        if (file.version >= 10) offset += 1
        val vo2Max = byteAt(bytes, offset).takeIf { it in 10..100 }
        offset += 1
        if (file.version >= 10) offset += 1
        offset += 1
        val recoveryTimeHours = littleEndianUInt16(bytes, offset).takeIf { it in 0..240 }
        offset += 2
        val zones = readClassicWorkoutHeartRateZonesAt(bytes, offset, dataEnd, activeSeconds)

        return buildClassicWorkoutSummary(
            file,
            startSeconds,
            endSeconds,
            activeSeconds,
            distanceMeters,
            calories,
            steps,
            heartRateAvg,
            heartRateMin,
            heartRateMax,
            zones,
            paceAvgSecondsPerKm = paceAvgSecondsPerKm,
            paceMaxSecondsPerKm = paceMaxSecondsPerKm,
            paceMinSecondsPerKm = paceMinSecondsPerKm,
            cadenceAvg = cadenceAvg,
            cadenceMax = cadenceMax,
            trainingEffectAerobic = trainingEffectAerobic,
            recoveryTimeHours = recoveryTimeHours,
            vo2Max = vo2Max,
        )
    }

    private fun parseClassicOutdoorCyclingSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            4, 5 -> 6
            6 -> 7
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 62) return null

        val workoutTypeCode = littleEndianUInt16(bytes, offset).takeIf { it > 0 }
        offset += 2
        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        offset += 4
        val distanceMeters = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..500_000 }
        offset += 4
        offset += 2
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        offset += 4
        offset += 4
        var speedAvgKmh: Double? = null
        if (file.version >= 5) {
            speedAvgKmh = normalizeClassicSpeedKmh(littleEndianFloat(bytes, offset))
            offset += 4
        }
        val speedMaxKmh = normalizeClassicSpeedKmh(littleEndianFloat(bytes, offset))
        offset += 4
        val heartRateAvg = byteAt(bytes, offset)
        offset += 1
        val heartRateMax = byteAt(bytes, offset)
        offset += 1
        val heartRateMin = byteAt(bytes, offset)
        offset += 1
        val elevationGainMeters = normalizeClassicAltitude(littleEndianFloat(bytes, offset))
        offset += 4
        val elevationLossMeters = normalizeClassicAltitude(littleEndianFloat(bytes, offset))
        offset += 4
        val altitudeAvgMeters = normalizeClassicAltitude(littleEndianFloat(bytes, offset))
        offset += 4
        val altitudeMaxMeters = normalizeClassicAltitude(littleEndianFloat(bytes, offset))
        offset += 4
        val altitudeMinMeters = normalizeClassicAltitude(littleEndianFloat(bytes, offset))
        offset += 4
        val trainingEffectAerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
        offset += 4
        offset += 1
        val trainingEffectAnaerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
        offset += 4
        offset += 1
        val vo2Max = byteAt(bytes, offset).takeIf { it in 10..100 }
        offset += 1
        offset += 1
        offset += 1
        val recoveryTimeHours = littleEndianUInt16(bytes, offset).takeIf { it in 0..240 }
        offset += 2
        offset += 1
        val zones = readClassicWorkoutHeartRateZonesAt(bytes, offset, dataEnd, activeSeconds)

        return buildClassicWorkoutSummary(
            file,
            startSeconds,
            endSeconds,
            activeSeconds,
            distanceMeters,
            calories,
            null,
            heartRateAvg,
            heartRateMin,
            heartRateMax,
            zones,
            workoutTypeCode = workoutTypeCode,
            speedAvgKmh = speedAvgKmh,
            speedMaxKmh = speedMaxKmh,
            elevationGainMeters = elevationGainMeters,
            elevationLossMeters = elevationLossMeters,
            altitudeAvgMeters = altitudeAvgMeters,
            altitudeMaxMeters = altitudeMaxMeters,
            altitudeMinMeters = altitudeMinMeters,
            trainingEffectAerobic = trainingEffectAerobic,
            trainingEffectAnaerobic = trainingEffectAnaerobic,
            recoveryTimeHours = recoveryTimeHours,
            vo2Max = vo2Max,
        )
    }

    private fun parseClassicOutdoorCyclingV2Summary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            4 -> 5
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 60) return null

        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val distanceMeters = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..500_000 }
        offset += 4
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        offset += 8
        val speedMaxKmh = normalizeClassicSpeedKmh(littleEndianFloat(bytes, offset))
        offset += 4
        val heartRateAvg = byteAt(bytes, offset)
        offset += 1
        val heartRateMax = byteAt(bytes, offset)
        offset += 1
        val heartRateMin = byteAt(bytes, offset)
        offset += 1
        offset += 28
        val zones = readClassicWorkoutHeartRateZonesAt(bytes, offset, dataEnd, activeSeconds)

        return buildClassicWorkoutSummary(
            file,
            startSeconds,
            endSeconds,
            activeSeconds,
            distanceMeters,
            calories,
            null,
            heartRateAvg,
            heartRateMin,
            heartRateMax,
            zones,
            speedMaxKmh = speedMaxKmh,
        )
    }

    private fun parseClassicIndoorCyclingSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            8 -> 7
            9 -> 8
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 54) return null

        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        offset += 4
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        offset += 8
        val heartRateAvg = byteAt(bytes, offset)
        offset += 1
        val heartRateMax = byteAt(bytes, offset)
        offset += 1
        val heartRateMin = byteAt(bytes, offset)
        offset += 1
        val trainingEffectAerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
        offset += 4
        offset += 1
        offset += 1
        val recoveryTimeHours = littleEndianUInt16(bytes, offset).takeIf { it in 0..240 }
        offset += 2
        val zones = readClassicWorkoutHeartRateZonesAt(bytes, offset, dataEnd, activeSeconds)

        return buildClassicWorkoutSummary(
            file,
            startSeconds,
            endSeconds,
            activeSeconds,
            null,
            calories,
            null,
            heartRateAvg,
            heartRateMin,
            heartRateMax,
            zones,
            trainingEffectAerobic = trainingEffectAerobic,
            recoveryTimeHours = recoveryTimeHours,
        )
    }

    private fun parseClassicHiitSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            5 -> 4
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 35) return null

        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        val heartRateAvg = byteAt(bytes, offset)
        offset += 1
        val heartRateMax = byteAt(bytes, offset)
        offset += 1
        val heartRateMin = byteAt(bytes, offset)
        offset += 1
        val trainingEffectAerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
        offset += 4
        offset += 1
        offset += 1
        val recoveryTimeHours = littleEndianUInt16(bytes, offset).takeIf { it in 0..240 }
        offset += 2
        val zones = readClassicWorkoutHeartRateZonesAt(bytes, offset, dataEnd, activeSeconds)

        return buildClassicWorkoutSummary(
            file,
            startSeconds,
            endSeconds,
            activeSeconds,
            null,
            calories,
            null,
            heartRateAvg,
            heartRateMin,
            heartRateMax,
            zones,
            trainingEffectAerobic = trainingEffectAerobic,
            recoveryTimeHours = recoveryTimeHours,
        )
    }

    private fun parseClassicEllipticalSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            3, 4, 5, 6 -> 4
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 40) return null

        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        val steps = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..200_000 }
        offset += 4
        var cadenceAvg: Int? = null
        if (file.version >= 6) {
            cadenceAvg = normalizeClassicCadence(littleEndianUInt16(bytes, offset))
            offset += 2
        }
        val cadenceMax = normalizeClassicCadence(littleEndianUInt16(bytes, offset))
        offset += 2
        val heartRateAvg = byteAt(bytes, offset)
        offset += 1
        val heartRateMax = byteAt(bytes, offset)
        offset += 1
        val heartRateMin = byteAt(bytes, offset)
        offset += 1
        offset += 7
        if (file.version >= 4) offset += 1
        val zones = readClassicWorkoutHeartRateZonesAt(bytes, offset, dataEnd, activeSeconds)

        return buildClassicWorkoutSummary(
            file,
            startSeconds,
            endSeconds,
            activeSeconds,
            null,
            calories,
            steps,
            heartRateAvg,
            heartRateMin,
            heartRateMax,
            zones,
            cadenceAvg = cadenceAvg,
            cadenceMax = cadenceMax,
        )
    }

    private fun parseClassicRowingSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            4 -> 4
            6, 7 -> 5
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 40) return null

        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        val heartRateAvg = byteAt(bytes, offset)
        offset += 1
        val heartRateMax = byteAt(bytes, offset)
        offset += 1
        val heartRateMin = byteAt(bytes, offset)
        offset += 1
        offset += 7
        if (file.version > 4) offset += 1
        val zones = readClassicWorkoutHeartRateZonesAt(bytes, offset, dataEnd, activeSeconds)
        offset += 20
        offset += 2
        val strokes = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..200_000 }
        offset += 4
        val strokeRateAvg = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..300 }

        return buildClassicWorkoutSummary(
            file,
            startSeconds,
            endSeconds,
            activeSeconds,
            null,
            calories,
            null,
            heartRateAvg,
            heartRateMin,
            heartRateMax,
            zones,
            strokes = strokes,
            strokeRateAvg = strokeRateAvg,
        )
    }

    private fun parseClassicJumpRopingSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            3, 5 -> 5
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 39) return null

        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        val heartRateAvg = byteAt(bytes, offset)
        offset += 1
        val heartRateMax = byteAt(bytes, offset)
        offset += 1
        val heartRateMin = byteAt(bytes, offset)
        offset += 1
        val trainingEffectAerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
        offset += 4
        var recoveryTimeHours: Int? = null
        offset += if (file.version == 3) 3 else 4
        if (file.version == 5) {
            recoveryTimeHours = littleEndianUInt16(bytes, offset - 2).takeIf { it in 0..240 }
        }
        val zones = readClassicWorkoutHeartRateZonesAt(bytes, offset, dataEnd, activeSeconds)
        offset += 20
        offset += 2
        val jumps = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..500_000 }
        offset += 4
        val jumpRateAvg = littleEndianUInt16(bytes, offset).takeIf { it in 1..500 }
        offset += 2
        offset += 2
        val jumpRateMax = littleEndianUInt16(bytes, offset).takeIf { it in 1..500 }
        offset += 2
        var trainingEffectAnaerobic: Double? = null
        var workoutLoad: Int? = null
        var vitalityGain: Int? = null
        if (file.version == 3) {
            offset += 43
            offset += 2
            offset += 2
        } else {
            offset += 27
            offset += 4
            trainingEffectAnaerobic = normalizeClassicTrainingEffect(littleEndianFloat(bytes, offset))
            offset += 4
            offset += 3
            offset += 4
            offset += 2
            offset += 4
            workoutLoad = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
            offset += 2
            offset += 1
            vitalityGain = byteAt(bytes, offset).takeIf { it in 0..200 }
        }

        return buildClassicWorkoutSummary(
            file,
            startSeconds,
            endSeconds,
            activeSeconds,
            null,
            calories,
            null,
            heartRateAvg,
            heartRateMin,
            heartRateMax,
            zones,
            jumps = jumps,
            jumpRateAvg = jumpRateAvg,
            jumpRateMax = jumpRateMax,
            trainingEffectAerobic = trainingEffectAerobic,
            trainingEffectAnaerobic = trainingEffectAnaerobic,
            workoutLoad = workoutLoad,
            recoveryTimeHours = recoveryTimeHours,
            vitalityGain = vitalityGain,
        )
    }

    private fun parseClassicPoolSwimmingSummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutSummary? {
        val headerSize = when (file.version) {
            6 -> 4
            7 -> 5
            8 -> 8
            else -> return null
        }
        var offset = 8 + headerSize
        if (dataEnd < offset + 18) return null

        val startSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val endSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val activeSeconds = littleEndianUInt32(bytes, offset)
        offset += 4
        val distanceMeters = littleEndianUInt32(bytes, offset).toInt().takeIf { it in 1..500_000 }
        offset += 4
        val calories = littleEndianUInt16(bytes, offset).takeIf { it in 1..20_000 }
        offset += 2
        if (file.version >= 7) offset += 4
        offset += 11
        val strokes = littleEndianUInt16(bytes, offset).takeIf { it in 1..200_000 }
        offset += 2
        val swimStyle = byteAt(bytes, offset).takeIf { it in 0..20 }
        offset += 1
        if (file.version >= 7) offset += 1
        offset += 1
        val laps = littleEndianUInt16(bytes, offset).takeIf { it in 1..10_000 }
        offset += 2
        val swolfAvg = littleEndianUInt16(bytes, offset).takeIf { it in 1..500 }

        return buildClassicWorkoutSummary(
            file,
            startSeconds,
            endSeconds,
            activeSeconds,
            distanceMeters,
            calories,
            null,
            null,
            null,
            null,
            null,
            strokes = strokes,
            laps = laps,
            swolfAvg = swolfAvg,
            swimStyle = swimStyle,
        )
    }

    private fun buildClassicWorkoutSummary(
        file: ClassicActivityFileSummary,
        startSeconds: Long,
        endSeconds: Long,
        activeSeconds: Long,
        distanceMeters: Int?,
        calories: Int?,
        steps: Int?,
        heartRateAvg: Int?,
        heartRateMin: Int?,
        heartRateMax: Int?,
        zones: List<Int>?,
        workoutTypeCode: Int? = null,
        paceAvgSecondsPerKm: Int? = null,
        paceMaxSecondsPerKm: Int? = null,
        paceMinSecondsPerKm: Int? = null,
        speedAvgKmh: Double? = null,
        speedMaxKmh: Double? = null,
        cadenceAvg: Int? = null,
        cadenceMax: Int? = null,
        stepLengthAvgCm: Int? = null,
        stepRateAvg: Int? = null,
        stepRateMax: Int? = null,
        strokes: Int? = null,
        strokeRateAvg: Int? = null,
        jumps: Int? = null,
        jumpRateAvg: Int? = null,
        jumpRateMax: Int? = null,
        laps: Int? = null,
        swolfAvg: Int? = null,
        swimStyle: Int? = null,
        elevationGainMeters: Double? = null,
        elevationLossMeters: Double? = null,
        altitudeAvgMeters: Double? = null,
        altitudeMaxMeters: Double? = null,
        altitudeMinMeters: Double? = null,
        trainingEffectAerobic: Double? = null,
        trainingEffectAnaerobic: Double? = null,
        workoutLoad: Int? = null,
        recoveryTimeHours: Int? = null,
        vo2Max: Int? = null,
        vitalityGain: Int? = null,
    ): ClassicWorkoutSummary? {
        if (!isClassicWorkoutEpochSeconds(startSeconds) ||
            !isClassicWorkoutEpochSeconds(endSeconds) ||
            endSeconds <= startSeconds ||
            activeSeconds <= 0L ||
            activeSeconds > 24L * 60L * 60L
        ) {
            return null
        }

        return ClassicWorkoutSummary(
            startTime = epochSecondsIso(startSeconds),
            endTime = epochSecondsIso(endSeconds),
            durationMinutes = (activeSeconds / 60).toInt().coerceAtLeast(1),
            distanceMeters = distanceMeters,
            calories = calories,
            steps = steps,
            heartRateAvg = heartRateAvg?.takeIf { it in 35..230 },
            heartRateMin = heartRateMin?.takeIf { it in 30..230 },
            heartRateMax = heartRateMax?.takeIf { it in 35..254 },
            workoutType = classicWorkoutTypeLabel(file.subtype, workoutTypeCode),
            zoneExtremeSeconds = zones?.getOrNull(0),
            zoneAnaerobicSeconds = zones?.getOrNull(1),
            zoneAerobicSeconds = zones?.getOrNull(2),
            zoneFatBurnSeconds = zones?.getOrNull(3),
            zoneWarmUpSeconds = zones?.getOrNull(4),
            workoutTypeCode = workoutTypeCode,
            paceAvgSecondsPerKm = paceAvgSecondsPerKm,
            paceMaxSecondsPerKm = paceMaxSecondsPerKm,
            paceMinSecondsPerKm = paceMinSecondsPerKm,
            speedAvgKmh = speedAvgKmh,
            speedMaxKmh = speedMaxKmh,
            cadenceAvg = cadenceAvg,
            cadenceMax = cadenceMax,
            stepLengthAvgCm = stepLengthAvgCm,
            stepRateAvg = stepRateAvg,
            stepRateMax = stepRateMax,
            strokes = strokes,
            strokeRateAvg = strokeRateAvg,
            jumps = jumps,
            jumpRateAvg = jumpRateAvg,
            jumpRateMax = jumpRateMax,
            laps = laps,
            swolfAvg = swolfAvg,
            swimStyle = swimStyle,
            elevationGainMeters = elevationGainMeters,
            elevationLossMeters = elevationLossMeters,
            altitudeAvgMeters = altitudeAvgMeters,
            altitudeMaxMeters = altitudeMaxMeters,
            altitudeMinMeters = altitudeMinMeters,
            trainingEffectAerobic = trainingEffectAerobic,
            trainingEffectAnaerobic = trainingEffectAnaerobic,
            workoutLoad = workoutLoad,
            recoveryTimeHours = recoveryTimeHours,
            vo2Max = vo2Max,
            vitalityGain = vitalityGain,
        )
    }

    private fun readClassicWorkoutHeartRateZonesAt(
        bytes: ByteArray,
        offset: Int,
        dataEnd: Int,
        activeSeconds: Long,
    ): List<Int>? {
        if (activeSeconds <= 0L || offset < 0 || offset + 20 > dataEnd || offset + 20 > bytes.size) {
            return null
        }
        val zones = (0 until 5).map { index -> littleEndianUInt32(bytes, offset + index * 4).toInt() }
        val total = zones.sum()
        return zones.takeIf { values ->
            values.all { it in 0..(24 * 60 * 60) } &&
                total > 0 &&
                total in (activeSeconds / 3).toInt()..(activeSeconds * 2).toInt()
        }
    }

    private fun byteAt(bytes: ByteArray, offset: Int): Int? {
        return bytes.getOrNull(offset)?.toInt()?.and(0xff)
    }

    private fun findClassicWorkoutTiming(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutTiming? {
        val fileTimestamp = try {
            java.time.Instant.parse(file.timestamp).epochSecond
        } catch (_: Exception) {
            null
        }
        var best: ClassicWorkoutTiming? = null
        var bestScore = Int.MIN_VALUE
        val maxOffset = minOf(dataEnd - 12, 40)
        for (offset in 8..maxOffset) {
            val startSeconds = littleEndianUInt32(bytes, offset)
            val endSeconds = littleEndianUInt32(bytes, offset + 4)
            val activeSeconds = littleEndianUInt32(bytes, offset + 8)
            if (!isClassicWorkoutEpochSeconds(startSeconds) || !isClassicWorkoutEpochSeconds(endSeconds)) {
                continue
            }
            if (endSeconds <= startSeconds || activeSeconds <= 0L || activeSeconds > 24L * 60L * 60L) {
                continue
            }
            val totalSeconds = endSeconds - startSeconds
            if (activeSeconds > totalSeconds + 60L * 60L) {
                continue
            }

            var score = 100 - (offset - 8)
            if (fileTimestamp != null) {
                val distanceFromFileTimestamp = kotlin.math.abs(startSeconds - fileTimestamp)
                when {
                    distanceFromFileTimestamp <= 60L -> score += 80
                    distanceFromFileTimestamp <= 60L * 60L -> score += 40
                    distanceFromFileTimestamp <= 24L * 60L * 60L -> score += 10
                    else -> score -= 20
                }
            }
            if (activeSeconds <= totalSeconds) {
                score += 20
            }

            if (score > bestScore) {
                bestScore = score
                best = ClassicWorkoutTiming(
                    startSeconds = startSeconds,
                    endSeconds = endSeconds,
                    activeSeconds = activeSeconds,
                    afterActiveOffset = offset + 12,
                )
            }
        }
        return best
    }

    private fun isClassicWorkoutEpochSeconds(value: Long): Boolean {
        return value in 1_577_836_800L..4_102_444_800L
    }

    private fun findClassicWorkoutHeartRateTriplet(
        bytes: ByteArray,
        start: Int,
        end: Int,
    ): Triple<Int, Int, Int>? {
        val scanEnd = minOf(end, bytes.size)
        for (offset in start until (scanEnd - 2)) {
            val average = bytes[offset].toInt() and 0xff
            val max = bytes[offset + 1].toInt() and 0xff
            val min = bytes[offset + 2].toInt() and 0xff
            if (average in 35..230 && min in 30..230 && max in 35..254 && min <= average && average <= max) {
                return Triple(average, max, min)
            }
        }
        return null
    }

    private fun findClassicWorkoutHeartRateZones(
        bytes: ByteArray,
        start: Int,
        dataEnd: Int,
        activeSeconds: Long,
    ): List<Int>? {
        val scanEnd = minOf(dataEnd, start + 128)
        if (activeSeconds <= 0L) {
            return null
        }

        for (offset in start..(scanEnd - 20)) {
            val zones = (0 until 5).map { index -> littleEndianUInt32(bytes, offset + index * 4).toInt() }
            if (zones.any { it < 0 || it > 24 * 60 * 60 }) {
                continue
            }
            val total = zones.sum()
            if (total > 0 && total in (activeSeconds / 3).toInt()..(activeSeconds * 2).toInt()) {
                return zones
            }
        }
        return null
    }

    private fun findClassicWorkoutDistanceMeters(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        start: Int,
        end: Int,
    ): Int? {
        if (!isClassicDistanceWorkout(file.subtype)) {
            return null
        }

        val scanEnd = minOf(end, bytes.size - 4)
        for (offset in start..scanEnd) {
            val value = littleEndianUInt32(bytes, offset)
            if (value in 1L..500_000L) {
                return value.toInt()
            }
        }
        return null
    }

    private fun findClassicWorkoutCalories(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        start: Int,
        end: Int,
    ): Int? {
        val scanEnd = minOf(end, bytes.size - 2)
        val preferredOffset = if (isClassicDistanceWorkout(file.subtype)) start + 4 else start
        if (preferredOffset + 2 <= bytes.size) {
            val preferred = littleEndianUInt16(bytes, preferredOffset)
            if (preferred in 1..20_000) {
                return preferred
            }
        }

        for (offset in start..scanEnd) {
            val value = littleEndianUInt16(bytes, offset)
            if (value in 1..20_000) {
                return value
            }
        }
        return null
    }

    private fun findClassicWorkoutSteps(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        start: Int,
        end: Int,
        distanceMeters: Int?,
    ): Int? {
        if (!isClassicStepWorkout(file.subtype)) {
            return null
        }

        val scanEnd = minOf(end, bytes.size - 4)
        for (offset in start..scanEnd) {
            val value = littleEndianUInt32(bytes, offset)
            if (value in 1L..200_000L && value.toInt() != distanceMeters) {
                return value.toInt()
            }
        }
        return null
    }

    private fun isClassicDistanceWorkout(subtype: Int): Boolean {
        return subtype in setOf(1, 2, 3, 6, 9, 16, 22, 23)
    }

    private fun isClassicStepWorkout(subtype: Int): Boolean {
        return subtype in setOf(1, 2, 3, 11, 22)
    }

    private fun normalizeClassicPaceSecondsPerKm(value: Int): Int? {
        return value.takeIf { it in 120..7_200 }
    }

    private fun normalizeClassicPaceSecondsPerMeter(value: Int): Int? {
        val secondsPerKm = value * 1000
        return secondsPerKm.takeIf { it in 120..7_200 }
    }

    private fun normalizeClassicSpeedKmh(value: Float): Double? {
        val normalized = value.toDouble()
        return normalized.takeIf { it.isFinite() && it in 0.1..250.0 }
    }

    private fun normalizeClassicAltitude(value: Float): Double? {
        val normalized = value.toDouble()
        return normalized.takeIf { it.isFinite() && it in -1_000.0..10_000.0 }
    }

    private fun normalizeClassicTrainingEffect(value: Float): Double? {
        val normalized = value.toDouble()
        return normalized.takeIf { it.isFinite() && it in 0.0..10.0 }
    }

    private fun normalizeClassicCadence(value: Int): Int? {
        return value.takeIf { it in 1..300 }
    }

    private fun classicWorkoutTypeLabel(subtype: Int, workoutTypeCode: Int? = null): String {
        if (workoutTypeCode != null) {
            classicWorkoutTypeCodeLabel(workoutTypeCode)?.let { return it }
        }

        return when (subtype) {
            1 -> "outdoor-run"
            2 -> "outdoor-walk"
            3 -> "treadmill"
            6 -> "outdoor-cycling"
            7 -> "indoor-cycling"
            8 -> "freestyle"
            9 -> "pool-swim"
            11 -> "elliptical"
            13 -> "rowing"
            14 -> "jump-rope"
            16 -> "hiit"
            22 -> "walking"
            23 -> "cycling"
            else -> "workout-$subtype"
        }
    }

    private fun classicWorkoutTypeCodeLabel(code: Int): String? {
        return when (code) {
            1 -> "outdoor-run"
            2, 15, 207 -> "outdoor-walk"
            3, 4, 5 -> "hiking"
            6 -> "outdoor-cycling"
            7, 324 -> "indoor-cycling"
            8 -> "freestyle"
            9 -> "pool-swim"
            10, 100, 101, 103, 105, 106, 107, 109, 112, 113, 115 -> "water-sport"
            11, 300, 301, 302, 325 -> "elliptical"
            12 -> "yoga"
            13 -> "rowing"
            14 -> "jump-rope"
            16 -> "hiit"
            17 -> "triathlon"
            102 -> "water-polo"
            104, 108, 110, 111, 114 -> "water-sport"
            200, 201, 202, 203, 204, 205, 206 -> "outdoor-sport"
            in 303..323, in 326..333, 399 -> "strength"
            in 400..499 -> "dance"
            500 -> "boxing"
            501 -> "wrestling"
            502 -> "martial-arts"
            in 503..511 -> "combat"
            in 600..627 -> "field-sport"
            in 700..709 -> "winter-sport"
            800, 801, 806, 811, in 900..904 -> "static"
            802, 10000, 10002 -> "outdoor-sport"
            803, 804, 805, 807, 808, 809, 810 -> "freestyle"
            10001 -> "athletics"
            else -> null
        }
    }

    private fun parseClassicSleepDetails(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicSleepSummary? {
        if (file.type != 0 || file.subtype != 8 || file.version > 5) {
            if (file.type == 0 && file.subtype == 8) {
                Log.i(TAG, "unsupported sleep detail file version=${file.version} detailType=${file.detailType} file=${file.idHex}")
            }
            return null
        }

        var offset = 8
        val headerSize = if (file.version >= 5) 2 else 1
        fun takeByte(): Int? {
            if (offset + 1 > dataEnd) return null
            return bytes[offset++].toInt() and 0xff
        }
        fun takeShort(): Int? {
            if (offset + 2 > dataEnd) return null
            val value = littleEndianUInt16(bytes, offset)
            offset += 2
            return value
        }
        fun takeInt(): Long? {
            if (offset + 4 > dataEnd) return null
            val value = littleEndianUInt32(bytes, offset)
            offset += 4
            return value
        }
        fun skip(count: Int): Boolean {
            if (offset + count > dataEnd) return false
            offset += count
            return true
        }

        val header = ByteArray(headerSize)
        for (index in header.indices) {
            header[index] = (takeByte() ?: return null).toByte()
        }
        val isAwake = takeByte()?.let { it == 1 }
        val bedTime = takeInt() ?: return null
        val wakeupTime = takeInt() ?: return null
        var headerIndex = 3

        fun hasSection(bitIndex: Int): Boolean {
            val headerByte = header.getOrNull(bitIndex / 8)?.toInt() ?: return false
            return (headerByte and (1 shl (7 - (bitIndex % 8)))) != 0
        }

        val score = if (file.version >= 4 && hasSection(headerIndex)) takeByte() else null
        if (file.version >= 4) {
            headerIndex += 1
        }

        if (file.version >= 5) {
            if (!skip(9)) return null
            if (takeInt() == null) return null
            if (takeInt() == null) return null
            headerIndex += 5
        }

        val sleepSamples = linkedMapOf<String, ClassicActivitySample>()
        val heartRateValues = mutableListOf<Int>()
        val spo2Values = mutableListOf<Int>()

        fun putSleepMetricSample(sampleTime: String, heartRate: Int? = null, spo2: Int? = null) {
            val existing = sleepSamples[sampleTime]
            sleepSamples[sampleTime] = ClassicActivitySample(
                sampleTime = sampleTime,
                heartRate = heartRate ?: existing?.heartRate,
                spo2 = spo2 ?: existing?.spo2,
                stress = existing?.stress,
                steps = existing?.steps,
            )
        }

        fun readMetricSampleSeries(metric: String): Boolean {
            val unitSeconds = takeShort() ?: return false
            val count = takeShort() ?: return false
            val firstRecordTime = if (count > 0 && file.version >= 2) {
                takeInt() ?: return false
            } else {
                bedTime
            }
            if (count <= 0) {
                return true
            }
            if (offset + count > dataEnd) {
                return false
            }
            repeat(count) { index ->
                val value = bytes[offset++].toInt() and 0xff
                val sampleSeconds = firstRecordTime + unitSeconds.toLong() * index.toLong()
                val sampleTime = epochSecondsIso(sampleSeconds) ?: return@repeat
                when (metric) {
                    "heart-rate" -> {
                        val heartRate = value.takeIf { it in 30..240 }
                        if (heartRate != null) {
                            heartRateValues.add(heartRate)
                            putSleepMetricSample(sampleTime, heartRate = heartRate)
                        }
                    }
                    "spo2" -> {
                        val spo2 = value.takeIf { it in 50..100 }
                        if (spo2 != null) {
                            spo2Values.add(spo2)
                            putSleepMetricSample(sampleTime, spo2 = spo2)
                        }
                    }
                }
            }
            return true
        }

        if (hasSection(headerIndex)) {
            if (!readMetricSampleSeries("heart-rate")) return null
        }
        headerIndex += 1
        if (hasSection(headerIndex)) {
            if (!readMetricSampleSeries("spo2")) return null
        }
        headerIndex += 1
        if (file.version >= 3 && hasSection(headerIndex)) {
            val unitSeconds = takeShort() ?: return null
            val count = takeShort() ?: return null
            if (count > 0 && file.version >= 2 && !skip(4)) return null
            if (!skip(count * 4)) return null
        }

        var summary: ClassicSleepSummary? = null
        var stageCount = 0
        while (offset + 17 <= dataEnd) {
            val headerOffset = findClassicSleepPacketHeader(bytes, offset, dataEnd) ?: break
            offset = headerOffset + 4
            if (offset + 13 > dataEnd) break

            offset += 1 // packet header length
            offset += 8 // packet timestamp
            offset += 1 // parity
            val packetType = bytes[offset++].toInt() and 0xff
            val dataLength = bigEndianUInt16(bytes, offset)
            offset += 2

            if (packetType in CLASSIC_SLEEP_HEADER_ONLY_PACKET_TYPES) {
                continue
            }

            if (offset + dataLength > dataEnd) {
                break
            }

            val dataOffset = offset
            offset += dataLength

            if (packetType == 16 && dataLength >= 13) {
                summary = ClassicSleepSummary(
                    startTime = epochSecondsIso(bedTime),
                    endTime = epochSecondsIso(wakeupTime),
                    durationMinutes = bigEndianUInt16(bytes, dataOffset + 1).takeIf { it > 0 },
                    deepMinutes = bigEndianUInt16(bytes, dataOffset + 9).takeIf { it > 0 },
                    lightMinutes = bigEndianUInt16(bytes, dataOffset + 5).takeIf { it > 0 },
                    remMinutes = bigEndianUInt16(bytes, dataOffset + 7).takeIf { it > 0 },
                    awakeMinutes = bigEndianUInt16(bytes, dataOffset + 3).takeIf { it > 0 },
                    score = score?.takeIf { it > 0 },
                    stageCount = stageCount,
                    isAwake = isAwake,
                    sampleCount = sleepSamples.size.takeIf { it > 0 },
                    heartRateAvg = averageInt(heartRateValues),
                    heartRateMin = heartRateValues.minOrNull(),
                    heartRateMax = heartRateValues.maxOrNull(),
                    spo2Avg = averageInt(spo2Values),
                    spo2Min = spo2Values.minOrNull(),
                    spo2Max = spo2Values.maxOrNull(),
                    samples = sleepSamples.values.toList(),
                )
            } else if (packetType == 17) {
                stageCount += dataLength / 2
            }
        }

        val fallbackDuration = durationMinutesBetweenEpochSeconds(bedTime, wakeupTime)
        return summary?.copy(stageCount = maxOf(summary.stageCount ?: 0, stageCount)) ?: ClassicSleepSummary(
            startTime = epochSecondsIso(bedTime),
            endTime = epochSecondsIso(wakeupTime),
            durationMinutes = fallbackDuration,
            deepMinutes = null,
            lightMinutes = null,
            remMinutes = null,
            awakeMinutes = null,
            score = score?.takeIf { it > 0 },
            stageCount = stageCount.takeIf { it > 0 },
            isAwake = isAwake,
            sampleCount = sleepSamples.size.takeIf { it > 0 },
            heartRateAvg = averageInt(heartRateValues),
            heartRateMin = heartRateValues.minOrNull(),
            heartRateMax = heartRateValues.maxOrNull(),
            spo2Avg = averageInt(spo2Values),
            spo2Min = spo2Values.minOrNull(),
            spo2Max = spo2Values.maxOrNull(),
            samples = sleepSamples.values.toList(),
        )
    }

    private fun parseClassicSleepStages(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicSleepSummary? {
        if (file.type != 0 || file.subtype != 3 || file.detailType != 0 || file.version != 2) {
            if (file.type == 0 && file.subtype == 3) {
                Log.i(TAG, "unsupported sleep stage file version=${file.version} detailType=${file.detailType} file=${file.idHex}")
            }
            return null
        }

        var offset = 8
        fun skip(count: Int): Boolean {
            if (offset + count > dataEnd) return false
            offset += count
            return true
        }
        fun takeShort(): Int? {
            if (offset + 2 > dataEnd) return null
            val value = littleEndianUInt16(bytes, offset)
            offset += 2
            return value
        }
        fun takeInt(): Long? {
            if (offset + 4 > dataEnd) return null
            val value = littleEndianUInt32(bytes, offset)
            offset += 4
            return value
        }

        if (!skip(7)) return null
        val duration = takeShort()?.takeIf { it > 0 }
        val bedTime = takeInt() ?: return null
        val wakeupTime = takeInt() ?: return null
        if (!skip(3)) return null
        val deep = takeShort()?.takeIf { it > 0 }
        val light = takeShort()?.takeIf { it > 0 }
        val rem = takeShort()?.takeIf { it > 0 }
        val awake = takeShort()?.takeIf { it > 0 }
        if (!skip(1)) return null
        val stageCount = ((dataEnd - offset).coerceAtLeast(0) / 5).takeIf { it > 0 }

        return ClassicSleepSummary(
            startTime = epochSecondsIso(bedTime),
            endTime = epochSecondsIso(wakeupTime),
            durationMinutes = duration ?: durationMinutesBetweenEpochSeconds(bedTime, wakeupTime),
            deepMinutes = deep,
            lightMinutes = light,
            remMinutes = rem,
            awakeMinutes = awake,
            score = null,
            stageCount = stageCount,
            isAwake = false,
        )
    }

    private fun parseClassicDailySummary(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicDailySummary? {
        if (file.type != 0 || file.subtype != 0 || file.detailType != 1 || file.version != 5) {
            return null
        }

        var offset = 12 // 7 bytes file id + 1 padding + 4 bytes validity header.
        fun takeByte(): Int? {
            if (offset + 1 > dataEnd) return null
            return bytes[offset++].toInt() and 0xff
        }
        fun takeShort(): Int? {
            if (offset + 2 > dataEnd) return null
            val value = littleEndianUInt16(bytes, offset)
            offset += 2
            return value
        }
        fun takeInt(): Long? {
            if (offset + 4 > dataEnd) return null
            val value = littleEndianUInt32(bytes, offset)
            offset += 4
            return value
        }
        fun skip(count: Int): Boolean {
            if (offset + count > dataEnd) return false
            offset += count
            return true
        }

        val steps = takeInt()?.toInt() ?: return null
        if (!skip(3)) return null
        val heartRateResting = takeByte() ?: return null
        val heartRateMax = takeByte() ?: return null
        if (takeInt() == null) return null
        val heartRateMin = takeByte() ?: return null
        if (takeInt() == null) return null
        val heartRateAvg = takeByte() ?: return null
        val stressAvg = takeByte() ?: return null
        val stressMax = takeByte() ?: return null
        val stressMin = takeByte() ?: return null
        if (!skip(3)) return null
        val calories = takeShort() ?: return null
        if (!skip(3)) return null
        val spo2Max = takeByte() ?: return null
        if (takeInt() == null) return null
        val spo2Min = takeByte() ?: return null
        if (takeInt() == null) return null
        val spo2Avg = takeByte() ?: return null
        val trainingLoadDay = takeShort() ?: return null
        val trainingLoadWeek = takeShort() ?: return null
        if (takeByte() == null) return null
        if (takeByte() == null) return null
        if (takeByte() == null) return null
        if (takeByte() == null) return null
        val vitality = takeShort()

        return ClassicDailySummary(
            steps = steps,
            calories = calories,
            heartRateResting = heartRateResting.takeIf { it in 1..254 },
            heartRateAvg = heartRateAvg.takeIf { it in 1..254 },
            heartRateMin = heartRateMin.takeIf { it in 1..254 },
            heartRateMax = heartRateMax.takeIf { it in 1..254 },
            spo2Avg = spo2Avg.takeIf { it in 1..100 },
            spo2Min = spo2Min.takeIf { it in 1..100 },
            spo2Max = spo2Max.takeIf { it in 1..100 },
            stressAvg = stressAvg.takeIf { it in 0..100 },
            stressMin = stressMin.takeIf { it in 0..100 },
            stressMax = stressMax.takeIf { it in 0..100 },
            trainingLoadDay = trainingLoadDay,
            trainingLoadWeek = trainingLoadWeek,
            vitality = vitality,
        )
    }

    private fun parseClassicDailyDetails(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicDailyDetailsSummary? {
        if (file.type != 0 || file.subtype != 0 || file.detailType != 0) {
            return null
        }

        val headerSize = when (file.version) {
            1, 2 -> 4
            3 -> 5
            4 -> 6
            else -> return null
        }
        val headerStart = 8
        val dataStart = headerStart + headerSize
        if (bytes.size < dataStart || dataEnd <= dataStart) {
            return null
        }

        val header = bytes.copyOfRange(headerStart, dataStart)
        var offset = dataStart
        var sampleCount = 0
        var stepsTotal = 0
        val heartRates = mutableListOf<Int>()
        val spo2Values = mutableListOf<Int>()
        val stressValues = mutableListOf<Int>()
        val samples = mutableListOf<ClassicActivitySample>()
        val sampleStart = try {
            java.time.Instant.parse(file.timestamp)
        } catch (_: Exception) {
            null
        }

        while (offset < dataEnd) {
            val parsed = parseClassicDailyDetailsSample(bytes, offset, dataEnd, header, file.version) ?: break
            offset = parsed.nextOffset
            val sampleTime = sampleStart?.plusSeconds(sampleCount.toLong() * 60L)?.toString()
            sampleCount += 1
            stepsTotal += parsed.steps ?: 0
            if (parsed.heartRate != null && parsed.heartRate in 1..254) {
                heartRates.add(parsed.heartRate)
            }
            if (parsed.spo2 != null && parsed.spo2 in 1..100) {
                spo2Values.add(parsed.spo2)
            }
            if (parsed.stress != null && parsed.stress in 0..100) {
                stressValues.add(parsed.stress)
            }
            if (
                sampleTime != null &&
                (
                    parsed.heartRate?.let { it in 1..254 } == true ||
                        parsed.spo2?.let { it in 1..100 } == true ||
                        parsed.stress?.let { it in 0..100 } == true
                    )
            ) {
                samples.add(
                    ClassicActivitySample(
                        sampleTime = sampleTime,
                        heartRate = parsed.heartRate?.takeIf { it in 1..254 },
                        spo2 = parsed.spo2?.takeIf { it in 1..100 },
                        stress = parsed.stress?.takeIf { it in 0..100 },
                        steps = parsed.steps,
                    ),
                )
            }
        }

        return ClassicDailyDetailsSummary(
            sampleCount = sampleCount,
            steps = stepsTotal.takeIf { sampleCount > 0 },
            heartRateAvg = averageInt(heartRates),
            heartRateMin = heartRates.minOrNull(),
            heartRateMax = heartRates.maxOrNull(),
            spo2Avg = averageInt(spo2Values),
            stressAvg = averageInt(stressValues),
            samples = samples,
        )
    }

    private fun parseClassicManualSamples(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicDailyDetailsSummary? {
        if (!isClassicManualSampleActivityFile(file) || file.version != 2 || dataEnd <= 8) {
            return null
        }

        var offset = 8
        val samples = mutableListOf<ClassicActivitySample>()
        val heartRates = mutableListOf<Int>()
        val spo2Values = mutableListOf<Int>()
        val stressValues = mutableListOf<Int>()
        var sawUnsupportedType = false

        while (offset + 5 <= dataEnd) {
            val timestampSeconds = littleEndianUInt32(bytes, offset)
            offset += 4
            val sampleType = bytes[offset].toInt() and 0xff
            offset += 1

            var heartRate: Int? = null
            var spo2: Int? = null
            var stress: Int? = null

            when (sampleType) {
                CLASSIC_MANUAL_SAMPLE_HR,
                CLASSIC_MANUAL_SAMPLE_SPO2,
                CLASSIC_MANUAL_SAMPLE_STRESS
                -> {
                    if (offset >= dataEnd) {
                        return null
                    }
                    val value = bytes[offset].toInt() and 0xff
                    offset += 1
                    when (sampleType) {
                        CLASSIC_MANUAL_SAMPLE_HR -> heartRate = value.takeIf { it in 30..240 }
                        CLASSIC_MANUAL_SAMPLE_SPO2 -> spo2 = value.takeIf { it in 50..100 }
                        CLASSIC_MANUAL_SAMPLE_STRESS -> stress = value.takeIf { it in 0..100 }
                    }
                }

                CLASSIC_MANUAL_SAMPLE_TEMPERATURE -> {
                    if (offset + 4 > dataEnd) {
                        return null
                    }
                    offset += 4
                }

                else -> {
                    sawUnsupportedType = true
                    break
                }
            }

            val sampleTime = epochSecondsIso(timestampSeconds)
            if (sampleTime != null && (heartRate != null || spo2 != null || stress != null)) {
                heartRate?.let { heartRates.add(it) }
                spo2?.let { spo2Values.add(it) }
                stress?.let { stressValues.add(it) }
                samples.add(
                    ClassicActivitySample(
                        sampleTime = sampleTime,
                        heartRate = heartRate,
                        spo2 = spo2,
                        stress = stress,
                        steps = null,
                    ),
                )
            }
        }

        if (sawUnsupportedType) {
            Log.i(TAG, "unsupported classic manual sample type file=${file.idHex}")
            return null
        }

        if (samples.isEmpty()) {
            return null
        }

        return ClassicDailyDetailsSummary(
            sampleCount = samples.size,
            steps = null,
            heartRateAvg = averageInt(heartRates),
            heartRateMin = heartRates.minOrNull(),
            heartRateMax = heartRates.maxOrNull(),
            spo2Avg = averageInt(spo2Values),
            stressAvg = averageInt(stressValues),
            samples = samples,
        )
    }

    private fun parseClassicWorkoutDetails(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutDetailsSummary? {
        if (file.type != 1 || file.detailType != 0) {
            return null
        }

        return when {
            file.subtype == 22 && file.version == 5 -> parseClassicOutdoorWalkingV2Details(bytes, file, dataEnd)
            file.subtype == 8 && file.version == 3 -> parseClassicFreestyleV3Details(bytes, file, dataEnd)
            else -> {
                Log.i(TAG, "unsupported workout details subtype=${file.subtype} version=${file.version} file=${file.idHex}")
                null
            }
        }
    }

    private fun parseClassicOutdoorWalkingV2Details(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutDetailsSummary? {
        val startSeconds = try {
            java.time.Instant.parse(file.timestamp).epochSecond
        } catch (_: Exception) {
            return null
        }
        val recordSize = 13
        val recordStart = findClassicOutdoorWalkingV2DetailsRecordStart(dataEnd) ?: return null
        if (recordStart + recordSize > dataEnd) {
            return null
        }

        val samples = mutableListOf<ClassicActivitySample>()
        val heartRates = mutableListOf<Int>()
        var offset = recordStart
        var recordIndex = 0

        while (offset + recordSize <= dataEnd) {
            val primaryHeartRate = (bytes[offset + 11].toInt() and 0xff).takeIf { it in 30..240 }
            val fallbackHeartRate = (bytes[offset + 2].toInt() and 0xff).takeIf { it in 30..240 }
            val heartRate = primaryHeartRate ?: fallbackHeartRate
            val sampleTime = epochSecondsIso(startSeconds + recordIndex.toLong())
            if (sampleTime != null && heartRate != null) {
                heartRates.add(heartRate)
                samples.add(
                    ClassicActivitySample(
                        sampleTime = sampleTime,
                        heartRate = heartRate,
                        spo2 = null,
                        stress = null,
                        steps = null,
                    ),
                )
            }

            offset += recordSize
            recordIndex += 1
        }

        if (samples.size < 10) {
            Log.i(TAG, "workout details parsed too few samples=${samples.size} file=${file.idHex}")
            return null
        }

        return ClassicWorkoutDetailsSummary(
            sampleCount = samples.size,
            heartRateAvg = averageInt(heartRates),
            heartRateMin = heartRates.minOrNull(),
            heartRateMax = heartRates.maxOrNull(),
            samples = samples,
        )
    }

    private fun findClassicOutdoorWalkingV2DetailsRecordStart(dataEnd: Int): Int? {
        val recordStart = 124
        val recordSize = 13
        return recordStart.takeIf { dataEnd >= it + recordSize }
    }

    private fun parseClassicFreestyleV3Details(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutDetailsSummary? {
        val startSeconds = try {
            java.time.Instant.parse(file.timestamp).epochSecond
        } catch (_: Exception) {
            return null
        }
        val recordSize = 4
        val recordStart = findClassicFreestyleV3DetailsRecordStart(bytes, dataEnd) ?: return null
        if (recordStart + recordSize > dataEnd) {
            return null
        }

        val samples = mutableListOf<ClassicActivitySample>()
        val heartRates = mutableListOf<Int>()
        var offset = recordStart
        var recordIndex = 0

        while (offset + recordSize <= dataEnd) {
            val heartRate = (bytes[offset].toInt() and 0xff).takeIf { it in 30..240 }
            val sampleTime = epochSecondsIso(startSeconds + recordIndex.toLong())
            if (sampleTime != null && heartRate != null) {
                heartRates.add(heartRate)
                samples.add(
                    ClassicActivitySample(
                        sampleTime = sampleTime,
                        heartRate = heartRate,
                        spo2 = null,
                        stress = null,
                        steps = null,
                    ),
                )
            }

            offset += recordSize
            recordIndex += 1
        }

        if (samples.size < 10) {
            Log.i(TAG, "freestyle workout details parsed too few samples=${samples.size} file=${file.idHex}")
            return null
        }

        return ClassicWorkoutDetailsSummary(
            sampleCount = samples.size,
            heartRateAvg = averageInt(heartRates),
            heartRateMin = heartRates.minOrNull(),
            heartRateMax = heartRates.maxOrNull(),
            samples = samples,
        )
    }

    private fun findClassicFreestyleV3DetailsRecordStart(bytes: ByteArray, dataEnd: Int): Int? {
        val recordSize = 4
        var bestStart: Int? = null
        var bestValidCount = 0

        for (recordStart in 52..64) {
            if (recordStart + recordSize > dataEnd) {
                continue
            }

            var offset = recordStart
            var totalCount = 0
            var validHeartRateCount = 0
            var validTrailingByteCount = 0

            while (offset + recordSize <= dataEnd) {
                val heartRate = bytes[offset].toInt() and 0xff
                val second = bytes[offset + 1].toInt() and 0xff
                val third = bytes[offset + 2].toInt() and 0xff
                val fourth = bytes[offset + 3].toInt() and 0xff
                if (heartRate in 30..240) {
                    validHeartRateCount += 1
                }
                if (second in 0..3 && third == 0 && fourth == 0) {
                    validTrailingByteCount += 1
                }
                totalCount += 1
                offset += recordSize
            }

            if (
                totalCount >= 10 &&
                validHeartRateCount >= maxOf(10, (totalCount * 85) / 100) &&
                validTrailingByteCount >= maxOf(10, (totalCount * 85) / 100) &&
                validHeartRateCount > bestValidCount
            ) {
                bestStart = recordStart
                bestValidCount = validHeartRateCount
            }
        }

        return bestStart
    }

    private fun parseClassicWorkoutGps(
        bytes: ByteArray,
        file: ClassicActivityFileSummary,
        dataEnd: Int,
    ): ClassicWorkoutGpsSummary? {
        if (file.type != 1 || file.detailType != 2) {
            return null
        }

        val headerSize: Int
        val sampleSize: Int
        when (file.version) {
            1 -> {
                headerSize = 1
                sampleSize = 12
            }

            2 -> {
                headerSize = 1
                sampleSize = 18
            }

            else -> {
                Log.i(TAG, "unsupported workout gps version=${file.version} file=${file.idHex}")
                return null
            }
        }

        val dataStart = 8 + headerSize
        if (dataEnd <= dataStart) {
            return null
        }

        val samples = mutableListOf<ClassicWorkoutGpsSample>()
        var offset = dataStart
        var lastLatitude: Double? = null
        var lastLongitude: Double? = null
        var cumulativeDistanceMeters = 0.0

        while (offset + sampleSize <= dataEnd) {
            val timestampSeconds = littleEndianUInt32(bytes, offset)
            offset += 4
            val longitude = littleEndianFloat(bytes, offset)
            offset += 4
            val latitude = littleEndianFloat(bytes, offset)
            offset += 4
            var hdop: Double? = null
            var speedMetersPerSecond: Double? = null

            if (file.version >= 2) {
                hdop = (littleEndianFloat(bytes, offset) / 4.8f).toDouble().takeIf { it.isFinite() && it >= 0.0 }
                offset += 4
                speedMetersPerSecond = ((littleEndianInt16(bytes, offset) shr 2) / 10.0).takeIf { it.isFinite() && it >= 0.0 }
                offset += 2
            }

            val sampleTime = epochSecondsIso(timestampSeconds)
            val normalizedLatitude = latitude.toDouble().takeIf { it.isFinite() && it in -90.0..90.0 }
            val normalizedLongitude = longitude.toDouble().takeIf { it.isFinite() && it in -180.0..180.0 }
            if (sampleTime == null || normalizedLatitude == null || normalizedLongitude == null) {
                continue
            }

            val previousLatitude = lastLatitude
            val previousLongitude = lastLongitude
            if (previousLatitude != null && previousLongitude != null) {
                val deltaMeters = haversineMeters(previousLatitude, previousLongitude, normalizedLatitude, normalizedLongitude)
                if (deltaMeters.isFinite() && deltaMeters in 0.0..200.0) {
                    cumulativeDistanceMeters += deltaMeters
                }
            }
            lastLatitude = normalizedLatitude
            lastLongitude = normalizedLongitude

            samples.add(
                ClassicWorkoutGpsSample(
                    sampleTime = sampleTime,
                    latitude = normalizedLatitude,
                    longitude = normalizedLongitude,
                    hdop = hdop,
                    speedMetersPerSecond = speedMetersPerSecond,
                    distanceMeters = cumulativeDistanceMeters.takeIf { it > 0.0 },
                ),
            )
        }

        if (samples.isEmpty()) {
            return null
        }

        return ClassicWorkoutGpsSummary(
            sampleCount = samples.size,
            samples = samples,
        )
    }

    private fun parseClassicDailyDetailsSample(
        bytes: ByteArray,
        startOffset: Int,
        dataEnd: Int,
        header: ByteArray,
        version: Int,
    ): ClassicDailyDetailsSample? {
        var offset = startOffset
        var group = -1
        var includeExtraEntry = 0
        var steps: Int? = null
        var heartRate: Int? = null
        var spo2: Int? = null
        var stress: Int? = null

        fun consumeGroup(nBits: Int): Int? {
            group += 1
            val nibble = classicDailyDetailsNibble(header, group) ?: return null
            if ((nibble and 8) == 0) {
                return null
            }
            val byteCount = nBits / 8
            if (offset + byteCount > dataEnd) {
                return Int.MIN_VALUE
            }
            val value = when (nBits) {
                8 -> bytes[offset].toInt() and 0xff
                16 -> littleEndianUInt16(bytes, offset)
                else -> return Int.MIN_VALUE
            }
            offset += byteCount
            return value
        }

        fun hasFlag(idx: Int): Boolean {
            val nibble = classicDailyDetailsNibble(header, group) ?: return false
            return (nibble and (1 shl (2 - idx))) != 0
        }

        fun extract(value: Int, idx: Int, nBits: Int, groupBits: Int): Int {
            val shift = groupBits - idx - nBits
            return (value and (((1 shl nBits) - 1) shl shift)) ushr shift
        }

        val stepsGroup = consumeGroup(16)
        if (stepsGroup == Int.MIN_VALUE) return null
        if (stepsGroup != null) {
            if (hasFlag(1)) {
                includeExtraEntry = extract(stepsGroup, 1, 1, 16)
            }
            if (hasFlag(2)) {
                steps = extract(stepsGroup, 2, 14, 16)
            }
        }

        val caloriesGroup = consumeGroup(8)
        if (caloriesGroup == Int.MIN_VALUE) return null
        val unknown1 = consumeGroup(8)
        if (unknown1 == Int.MIN_VALUE) return null
        val distanceGroup = consumeGroup(16)
        if (distanceGroup == Int.MIN_VALUE) return null

        val heartRateGroup = consumeGroup(8)
        if (heartRateGroup == Int.MIN_VALUE) return null
        if (heartRateGroup != null && hasFlag(0)) {
            heartRate = heartRateGroup
        }

        val energyGroup = consumeGroup(8)
        if (energyGroup == Int.MIN_VALUE) return null
        val unknown2 = consumeGroup(16)
        if (unknown2 == Int.MIN_VALUE) return null

        if (version >= 3) {
            val spo2Group = consumeGroup(8)
            if (spo2Group == Int.MIN_VALUE) return null
            if (spo2Group != null && hasFlag(0)) {
                spo2 = spo2Group
            }
            val stressGroup = consumeGroup(8)
            if (stressGroup == Int.MIN_VALUE) return null
            if (stressGroup != null && hasFlag(0) && stressGroup != 255) {
                stress = stressGroup
            }
        }

        if (includeExtraEntry == 1) {
            val extra = consumeGroup(8)
            if (extra == Int.MIN_VALUE) return null
        }

        if (version >= 4) {
            val light = consumeGroup(16)
            if (light == Int.MIN_VALUE) return null
            val momentum = consumeGroup(16)
            if (momentum == Int.MIN_VALUE) return null
        }

        if (offset <= startOffset) {
            return null
        }

        return ClassicDailyDetailsSample(
            nextOffset = offset,
            steps = steps,
            heartRate = heartRate,
            spo2 = spo2,
            stress = stress,
        )
    }

    private fun classicDailyDetailsNibble(header: ByteArray, group: Int): Int? {
        if (group < 0 || group >= header.size * 2) {
            return null
        }
        val value = header[group / 2].toInt() and 0xff
        return if (group % 2 == 0) {
            (value ushr 4) and 0x0f
        } else {
            value and 0x0f
        }
    }

    private fun classicActivityCrcValid(bytes: ByteArray): Boolean? {
        if (bytes.size < 12) {
            return null
        }

        val crc = java.util.zip.CRC32()
        crc.update(bytes, 0, bytes.size - 4)
        val actual = crc.value and 0xffffffffL
        val expected = littleEndianUInt32(bytes, bytes.size - 4) and 0xffffffffL
        return actual == expected
    }

    private fun findClassicSleepPacketHeader(bytes: ByteArray, startOffset: Int, dataEnd: Int): Int? {
        var offset = startOffset
        while (offset + 4 <= dataEnd) {
            if (littleEndianUInt32(bytes, offset) == CLASSIC_SLEEP_PACKET_HEADER) {
                return offset
            }
            offset += 1
        }
        return null
    }

    private fun epochSecondsIso(seconds: Long): String? {
        if (seconds <= 0) {
            return null
        }
        return try {
            java.time.Instant.ofEpochSecond(seconds).toString()
        } catch (_: Exception) {
            null
        }
    }

    private fun durationMinutesBetweenEpochSeconds(startSeconds: Long, endSeconds: Long): Int? {
        if (startSeconds <= 0 || endSeconds <= startSeconds) {
            return null
        }
        val minutes = ((endSeconds - startSeconds) / 60).toInt()
        return minutes.takeIf { it in 1..(24 * 60) }
    }

    private fun classicActivityFileKind(type: Int, subtype: Int, detailType: Int): String {
        return when {
            type == 0 && subtype == 0 && detailType == 0 -> "Активность по минутам"
            type == 0 && subtype == 0 && detailType == 1 -> "Итоги дня"
            type == 0 && subtype == 3 -> "Фазы сна"
            type == 0 && subtype == 6 -> "Ручные замеры"
            type == 0 && subtype == 8 -> "Сон"
            type == 1 && detailType == 0 -> "Детали тренировки"
            type == 1 && detailType == 1 -> "Итог тренировки"
            type == 1 && detailType == 2 -> "GPS тренировки"
            else -> "Файл активности"
        }
    }

    private fun averageInt(values: List<Int>): Int? {
        if (values.isEmpty()) {
            return null
        }
        return (values.sum().toDouble() / values.size).roundToInt()
    }

    private fun parseAuthCommand(payload: ByteArray): ClassicAuthProbeParse {
        var commandSubtype: Int? = null
        var commandStatus: Int? = null
        var authStatus: Int? = null
        var watchNonceHex: String? = null
        var watchHmacHex: String? = null
        var hasAuthStep3 = false
        var hasAuthStep4 = false

        walkProtoFields(payload) { fieldNumber, wireType, value ->
            when {
                fieldNumber == 2 && wireType == 0 -> commandSubtype = value.intValue
                fieldNumber == 100 && wireType == 0 -> commandStatus = value.intValue
                fieldNumber == 3 && wireType == 2 && value.bytes != null -> {
                    walkProtoFields(value.bytes) { authField, authWireType, authValue ->
                        when {
                            authField == 8 && authWireType == 0 -> authStatus = authValue.intValue
                            authField == 31 && authWireType == 2 && authValue.bytes != null -> {
                                walkProtoFields(authValue.bytes) { nonceField, nonceWireType, nonceValue ->
                                    if (nonceField == 1 && nonceWireType == 2) {
                                        watchNonceHex = fullHex(nonceValue.bytes)
                                    } else if (nonceField == 2 && nonceWireType == 2) {
                                        watchHmacHex = fullHex(nonceValue.bytes)
                                    }
                                }
                            }
                            authField == 32 && authWireType == 2 -> hasAuthStep3 = true
                            authField == 33 && authWireType == 2 -> hasAuthStep4 = true
                        }
                    }
                }
            }
        }

        val stage = when {
            commandSubtype == 27 || hasAuthStep4 -> "authenticated"
            watchNonceHex != null && watchHmacHex != null -> "watch-nonce"
            hasAuthStep3 || commandSubtype != null || commandStatus != null || authStatus != null -> "auth-response"
            else -> null
        }

        return ClassicAuthProbeParse(
            authSubtype = commandSubtype,
            authStatus = authStatus ?: commandStatus,
            watchNonceHex = watchNonceHex,
            watchHmacHex = watchHmacHex,
            authStage = stage,
            authPacketSequenceNumber = null,
        )
    }

    private fun walkProtoFields(bytes: ByteArray, visitor: (Int, Int, ProtoValue) -> Unit) {
        var offset = 0
        while (offset < bytes.size) {
            val key = readProtoVarint(bytes, offset) ?: return
            offset = key.nextOffset
            val fieldNumber = key.value.toInt() ushr 3
            val wireType = key.value.toInt() and 0x07
            when (wireType) {
                0 -> {
                    val value = readProtoVarint(bytes, offset) ?: return
                    offset = value.nextOffset
                    visitor(fieldNumber, wireType, ProtoValue(value.value.toInt(), null))
                }
                2 -> {
                    val length = readProtoVarint(bytes, offset) ?: return
                    offset = length.nextOffset
                    val end = offset + length.value.toInt()
                    if (end > bytes.size) {
                        return
                    }
                    visitor(fieldNumber, wireType, ProtoValue(null, bytes.copyOfRange(offset, end)))
                    offset = end
                }
                5 -> {
                    if (offset + 4 > bytes.size) return
                    offset += 4
                }
                1 -> {
                    if (offset + 8 > bytes.size) return
                    offset += 8
                }
                else -> return
            }
        }
    }

    private fun readProtoVarint(bytes: ByteArray, startOffset: Int): ProtoVarint? {
        var result = 0L
        var shift = 0
        var offset = startOffset
        while (offset < bytes.size && shift < 64) {
            val value = bytes[offset].toInt() and 0xff
            result = result or ((value and 0x7f).toLong() shl shift)
            offset += 1
            if (value and 0x80 == 0) {
                return ProtoVarint(result, offset)
            }
            shift += 7
        }
        return null
    }

    private fun buildClassicAuthStep1Packet(phoneNonce: ByteArray): ByteArray {
        return buildClassicSppV1Packet(
            channel = 0x02,
            flags = 0x80,
            opCode = 0x02,
            frameSerial = 0x00,
            dataType = 0x02,
            payload = buildAuthStep1Command(phoneNonce),
        )
    }

    private fun buildAuthStep1Command(phoneNonce: ByteArray): ByteArray {
        val phoneNonceMessage = java.io.ByteArrayOutputStream()
        writeProtoBytesField(phoneNonceMessage, 1, phoneNonce)

        val authMessage = java.io.ByteArrayOutputStream()
        writeProtoBytesField(authMessage, 30, phoneNonceMessage.toByteArray())

        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 1)
        writeProtoVarintField(command, 2, 26)
        writeProtoBytesField(command, 3, authMessage.toByteArray())
        return command.toByteArray()
    }

    private fun buildClassicAuthStep2Packet(command: ByteArray): ByteArray {
        return buildClassicSppV1Packet(
            channel = 0x02,
            flags = 0x80,
            opCode = 0x02,
            frameSerial = 0x01,
            dataType = 0x02,
            payload = command,
        )
    }

    private fun buildAuthStep3Command(encryptedNonces: ByteArray, encryptedDeviceInfo: ByteArray): ByteArray {
        val authStep3Message = java.io.ByteArrayOutputStream()
        writeProtoBytesField(authStep3Message, 1, encryptedNonces)
        writeProtoBytesField(authStep3Message, 2, encryptedDeviceInfo)

        val authMessage = java.io.ByteArrayOutputStream()
        writeProtoBytesField(authMessage, 32, authStep3Message.toByteArray())

        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 1)
        writeProtoVarintField(command, 2, 27)
        writeProtoBytesField(command, 3, authMessage.toByteArray())
        return command.toByteArray()
    }

    private fun buildSimpleCommand(type: Int, subtype: Int): ByteArray {
        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, type)
        writeProtoVarintField(command, 2, subtype)
        return command.toByteArray()
    }

    private fun buildActivityFetchTodayCommand(unknown1: Int): ByteArray {
        val requestToday = java.io.ByteArrayOutputStream()
        writeProtoVarintField(requestToday, 1, unknown1)

        val health = java.io.ByteArrayOutputStream()
        writeProtoBytesField(health, 5, requestToday.toByteArray())

        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 8)
        writeProtoVarintField(command, 2, 1)
        writeProtoBytesField(command, 10, health.toByteArray())
        return command.toByteArray()
    }

    private fun buildActivityFetchRequestCommand(fileId: ByteArray): ByteArray {
        val health = java.io.ByteArrayOutputStream()
        writeProtoBytesField(health, 2, fileId)

        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 8)
        writeProtoVarintField(command, 2, 3)
        writeProtoBytesField(command, 10, health.toByteArray())
        return command.toByteArray()
    }

    private fun buildActivityFetchAckCommand(fileId: ByteArray): ByteArray {
        val health = java.io.ByteArrayOutputStream()
        writeProtoBytesField(health, 3, fileId)

        val command = java.io.ByteArrayOutputStream()
        writeProtoVarintField(command, 1, 8)
        writeProtoVarintField(command, 2, 5)
        writeProtoBytesField(command, 10, health.toByteArray())
        return command.toByteArray()
    }

    private fun buildClassicAuthDeviceInfo(): ByteArray {
        val region = Locale.getDefault().language
            .take(2)
            .uppercase(Locale.ROOT)
            .ifBlank { "US" }
        val info = java.io.ByteArrayOutputStream()
        writeProtoVarintField(info, 1, 0)
        writeProtoFloatField(info, 2, Build.VERSION.SDK_INT.toFloat())
        writeProtoStringField(info, 3, Build.MODEL ?: "Android")
        writeProtoVarintField(info, 4, 224)
        writeProtoStringField(info, 5, region)
        return info.toByteArray()
    }

    private fun buildClassicSppV1Packet(
        channel: Int,
        flags: Int,
        opCode: Int,
        frameSerial: Int,
        dataType: Int,
        payload: ByteArray,
    ): ByteArray {
        val packet = java.io.ByteArrayOutputStream()
        packet.write(CLASSIC_SPP_PREAMBLE)
        packet.write(channel and 0xff)
        packet.write(flags and 0xff)
        writeLittleEndianUInt16(packet, payload.size + 3)
        packet.write(opCode and 0xff)
        packet.write(frameSerial and 0xff)
        packet.write(dataType and 0xff)
        packet.write(payload)
        packet.write(0xEF)
        return packet.toByteArray()
    }

    private fun buildClassicV2SessionConfigPacket(sequenceNumber: Int): ByteArray {
        return buildClassicSppV2Packet(
            packetType = 2,
            sequenceNumber = sequenceNumber,
            payload = byteArrayOf(
                0x01,
                0x01, 0x03, 0x00, 0x01, 0x00, 0x00,
                0x02, 0x02, 0x00, 0x00, 0xFC.toByte(),
                0x03, 0x02, 0x00, 0x20, 0x00,
                0x04, 0x02, 0x10, 0x27,
            ),
        )
    }

    private fun buildClassicV2AuthStep1Packet(phoneNonce: ByteArray, sequenceNumber: Int): ByteArray {
        val command = buildAuthStep1Command(phoneNonce)
        val payload = java.io.ByteArrayOutputStream()
        payload.write(0x01)
        payload.write(0x01)
        payload.write(command)
        return buildClassicSppV2Packet(packetType = 3, sequenceNumber = sequenceNumber, payload = payload.toByteArray())
    }

    private fun buildClassicV2AuthStep2Packet(command: ByteArray, sequenceNumber: Int): ByteArray {
        val payload = java.io.ByteArrayOutputStream()
        payload.write(0x01)
        payload.write(0x01)
        payload.write(command)
        return buildClassicSppV2Packet(packetType = 3, sequenceNumber = sequenceNumber, payload = payload.toByteArray())
    }

    private fun buildClassicV2AckPacket(sequenceNumber: Int): ByteArray {
        return buildClassicSppV2Packet(packetType = 1, sequenceNumber = sequenceNumber, payload = byteArrayOf())
    }

    private fun buildClassicV2EncryptedCommandPacket(
        command: ByteArray,
        sequenceNumber: Int,
        encryptionKey: ByteArray,
    ): ByteArray {
        val payload = java.io.ByteArrayOutputStream()
        payload.write(0x01)
        payload.write(0x02)
        payload.write(aesCtrCrypt(encryptionKey, encryptionKey, command))
        return buildClassicSppV2Packet(packetType = 3, sequenceNumber = sequenceNumber, payload = payload.toByteArray())
    }

    private fun buildClassicSppV2Packet(packetType: Int, sequenceNumber: Int, payload: ByteArray): ByteArray {
        val packet = java.io.ByteArrayOutputStream()
        packet.write(0xA5)
        packet.write(0xA5)
        packet.write(packetType and 0x0f)
        packet.write(sequenceNumber and 0xff)
        writeLittleEndianUInt16(packet, payload.size)
        writeLittleEndianUInt16(packet, classicSppV2Checksum(payload))
        packet.write(payload)
        return packet.toByteArray()
    }

    private fun classicSppV2Checksum(payload: ByteArray): Int {
        var crc = 0
        for (byte in payload) {
            val unsigned = byte.toInt() and 0xff
            for (bit in 0 until 8) {
                crc = crc shl 1
                if ((((crc ushr 16) and 1) xor ((unsigned ushr bit) and 1)) == 1) {
                    crc = crc xor 0x8005
                }
            }
        }

        return Integer.reverse(crc) ushr 16
    }

    private fun shouldUseClassicSppV2(versionHex: String?): Boolean {
        val dottedMajor = versionHex
            ?.split(".")
            ?.firstOrNull()
            ?.toIntOrNull()
        if (dottedMajor != null) {
            return dottedMajor >= 2
        }
        val majorHex = versionHex?.take(2) ?: return true
        return majorHex.toIntOrNull(16)?.let { it >= 2 } == true
    }

    private fun openClassicSocketWithRetry(device: BluetoothDevice, label: String): BluetoothSocket {
        var lastError: IOException? = null
        for (attempt in 1..CLASSIC_SOCKET_CONNECT_ATTEMPTS) {
            if (Thread.currentThread().isInterrupted) {
                throw InterruptedException()
            }

            val socket = try {
                createClassicSocketForAttempt(device, attempt)
            } catch (error: IOException) {
                lastError = error
                Log.w(TAG, "classic spp socket create failed label=$label attempt=$attempt: ${safeMessage(error)}")
                sleepBeforeClassicReconnect(attempt)
                continue
            }

            activeClassicSocket = socket
            try {
                Log.i(TAG, "classic spp connect start label=$label attempt=$attempt")
                socket.connect()
                Log.i(TAG, "classic spp connect ok label=$label attempt=$attempt connected=${socket.isConnected}")
                return socket
            } catch (error: IOException) {
                lastError = error
                Log.w(TAG, "classic spp connect failed label=$label attempt=$attempt: ${safeMessage(error)}")
                if (activeClassicSocket == socket) {
                    activeClassicSocket = null
                }
                try {
                    socket.close()
                } catch (_: IOException) {
                    // Socket already failed.
                }
                sleepBeforeClassicReconnect(attempt)
            }
        }

        val message = lastError?.let { safeMessage(it) } ?: "unknown"
        throw IOException("Не удалось открыть SPP-соединение с часами после $CLASSIC_SOCKET_CONNECT_ATTEMPTS попыток: $message", lastError)
    }

    private fun createClassicSocketForAttempt(device: BluetoothDevice, attempt: Int): BluetoothSocket {
        if (attempt >= CLASSIC_SOCKET_DIRECT_CHANNEL_ATTEMPT) {
            val directSocket = createClassicSocketForChannel(device, CLASSIC_SPP_RFCOMM_CHANNEL)
            if (directSocket != null) {
                Log.i(TAG, "classic spp using direct RFCOMM channel $CLASSIC_SPP_RFCOMM_CHANNEL attempt=$attempt")
                return directSocket
            }
        }

        return device.createRfcommSocketToServiceRecord(SPP_SERVICE_UUID)
    }

    private fun createClassicSocketForChannel(device: BluetoothDevice, channel: Int): BluetoothSocket? {
        return try {
            val method = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
            method.invoke(device, channel) as? BluetoothSocket
        } catch (error: ReflectiveOperationException) {
            Log.w(TAG, "classic spp direct RFCOMM channel unavailable: ${safeMessage(error)}")
            null
        } catch (error: RuntimeException) {
            Log.w(TAG, "classic spp direct RFCOMM channel failed: ${safeMessage(error)}")
            null
        }
    }

    private fun sleepBeforeClassicReconnect(attempt: Int) {
        if (attempt >= CLASSIC_SOCKET_CONNECT_ATTEMPTS) {
            return
        }
        Thread.sleep(CLASSIC_SOCKET_RETRY_DELAY_MS * attempt)
    }

    private fun computeClassicAuthStepHmac(secretKey: ByteArray, phoneNonce: ByteArray, watchNonce: ByteArray): ByteArray {
        val seed = phoneNonce + watchNonce
        val hmacKey = hmacSha256(seed, secretKey)
        val output = ByteArray(64)
        val label = "miwear-auth".toByteArray(Charsets.UTF_8)
        var previous = ByteArray(0)
        var counter = 1
        var offset = 0
        while (offset < output.size) {
            val chunk = hmacSha256(hmacKey, previous + label + byteArrayOf(counter.toByte()))
            val copyLength = minOf(chunk.size, output.size - offset)
            System.arraycopy(chunk, 0, output, offset, copyLength)
            previous = chunk
            counter += 1
            offset += copyLength
        }
        return output
    }

    private fun hmacSha256(key: ByteArray, input: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(input)
    }

    private fun encryptAesCcm4(key: ByteArray, nonce: ByteArray, payload: ByteArray): ByteArray {
        val macLength = 4
        val lengthFieldSize = 15 - nonce.size
        require(lengthFieldSize in 2..8) { "AES-CCM nonce must be 7..13 bytes." }

        val macBlocks = mutableListOf<ByteArray>()
        val b0 = ByteArray(16)
        b0[0] = ((((macLength - 2) / 2) shl 3) or (lengthFieldSize - 1)).toByte()
        System.arraycopy(nonce, 0, b0, 1, nonce.size)
        writeBigEndianLength(b0, 16 - lengthFieldSize, lengthFieldSize, payload.size)
        macBlocks.add(b0)
        macBlocks.addAll(blocks16(payload))

        var x = ByteArray(16)
        for (block in macBlocks) {
            x = aesEncryptBlock(key, xorBlocks(x, block))
        }
        val tag = x.copyOfRange(0, macLength)

        val output = ByteArray(payload.size + macLength)
        var payloadOffset = 0
        var counter = 1
        while (payloadOffset < payload.size) {
            val s = aesEncryptBlock(key, ccmCounterBlock(nonce, lengthFieldSize, counter))
            val chunkSize = minOf(16, payload.size - payloadOffset)
            for (index in 0 until chunkSize) {
                output[payloadOffset + index] = (payload[payloadOffset + index].toInt() xor s[index].toInt()).toByte()
            }
            payloadOffset += chunkSize
            counter += 1
        }

        val s0 = aesEncryptBlock(key, ccmCounterBlock(nonce, lengthFieldSize, 0))
        for (index in 0 until macLength) {
            output[payload.size + index] = (tag[index].toInt() xor s0[index].toInt()).toByte()
        }

        return output
    }

    private fun ccmCounterBlock(nonce: ByteArray, lengthFieldSize: Int, counter: Int): ByteArray {
        val block = ByteArray(16)
        block[0] = (lengthFieldSize - 1).toByte()
        System.arraycopy(nonce, 0, block, 1, nonce.size)
        writeBigEndianLength(block, 16 - lengthFieldSize, lengthFieldSize, counter)
        return block
    }

    private fun blocks16(payload: ByteArray): List<ByteArray> {
        if (payload.isEmpty()) {
            return emptyList()
        }

        val blocks = mutableListOf<ByteArray>()
        var offset = 0
        while (offset < payload.size) {
            val block = ByteArray(16)
            val chunkSize = minOf(16, payload.size - offset)
            System.arraycopy(payload, offset, block, 0, chunkSize)
            blocks.add(block)
            offset += chunkSize
        }
        return blocks
    }

    private fun aesEncryptBlock(key: ByteArray, block: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/ECB/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"))
        return cipher.doFinal(block)
    }

    private fun aesCtrCrypt(key: ByteArray, iv: ByteArray, payload: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/CTR/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
        return cipher.doFinal(payload)
    }

    private fun xorBlocks(left: ByteArray, right: ByteArray): ByteArray {
        val output = ByteArray(16)
        for (index in 0 until 16) {
            output[index] = (left[index].toInt() xor right[index].toInt()).toByte()
        }
        return output
    }

    private fun writeBigEndianLength(target: ByteArray, offset: Int, length: Int, value: Int) {
        for (index in 0 until length) {
            target[offset + length - 1 - index] = ((value ushr (8 * index)) and 0xff).toByte()
        }
    }

    private fun readClassicPackets(
        socket: BluetoothSocket,
        packets: MutableList<JSObject>,
        combined: java.io.ByteArrayOutputStream,
        durationMs: Long,
    ): String? {
        val startedAt = android.os.SystemClock.uptimeMillis()
        val readBuffer = ByteArray(512)
        while (android.os.SystemClock.uptimeMillis() - startedAt < durationMs) {
            val available = try {
                socket.inputStream.available()
            } catch (error: IOException) {
                return "SPP-сокет закрылся во время чтения: ${safeMessage(error)}"
            }

            if (available > 0) {
                val bytesToRead = minOf(readBuffer.size, available)
                val count = socket.inputStream.read(readBuffer, 0, bytesToRead)
                if (count > 0) {
                    val bytes = readBuffer.copyOfRange(0, count)
                    combined.write(bytes)
                    packets.add(buildClassicPacket(bytes, packets.size + 1))
                }
            } else {
                Thread.sleep(CLASSIC_PROBE_POLL_MS)
            }
        }
        return null
    }

    private fun readClassicPacketsUntilAuthStage(
        socket: BluetoothSocket,
        packets: MutableList<JSObject>,
        combined: java.io.ByteArrayOutputStream,
        targetStage: String,
        durationMs: Long,
    ): String? {
        val startedAt = android.os.SystemClock.uptimeMillis()
        var lastError: String? = null
        while (android.os.SystemClock.uptimeMillis() - startedAt < durationMs) {
            lastError = readClassicPackets(socket, packets, combined, CLASSIC_FAST_READ_POLL_MS) ?: lastError
            val parsed = parseClassicProbeBytes(combined.toByteArray())
            if (parsed.authStage == targetStage) {
                return lastError
            }
            if (targetStage == "watch-nonce" && parsed.watchNonceHex != null && parsed.watchHmacHex != null) {
                return lastError
            }
            if (targetStage == "authenticated" && parsed.authStage == "authenticated") {
                return lastError
            }
            if (lastError != null) {
                return lastError
            }
        }
        return lastError ?: classicAuthStageTimeoutMessage(targetStage)
    }

    private fun classicAuthStageTimeoutMessage(targetStage: String): String {
        return when (targetStage) {
            "watch-nonce" ->
                CLASSIC_WATCH_NONCE_MISSING_MESSAGE
            "authenticated" ->
                "Часы не завершили auth. Проверьте Auth Key и что SPP-канал не занят другим приложением."
            else ->
                "Часы не ответили на SPP-запрос за отведенное время."
        }
    }

    private fun classicSocketUserMessage(error: IOException): String {
        val message = safeMessage(error)
        return if (
            message.contains("Broken pipe", ignoreCase = true) ||
            message.contains("socket closed", ignoreCase = true) ||
            message.contains("bt socket closed", ignoreCase = true)
        ) {
            CLASSIC_WATCH_NONCE_MISSING_MESSAGE
        } else {
            message
        }
    }

    private fun readClassicPacketsUntilActivitySelection(
        socket: BluetoothSocket,
        packets: MutableList<JSObject>,
        combined: java.io.ByteArrayOutputStream,
        decryptionKey: ByteArray?,
        entryDate: String?,
        includeSleep: Boolean,
        durationMs: Long,
    ): String? {
        val startedAt = android.os.SystemClock.uptimeMillis()
        var lastError: String? = null
        var lastSelectionSignature: String? = null
        var lastSelectionChangedAt = startedAt
        while (android.os.SystemClock.uptimeMillis() - startedAt < durationMs) {
            lastError = readClassicPackets(socket, packets, combined, CLASSIC_FAST_READ_POLL_MS) ?: lastError
            val now = android.os.SystemClock.uptimeMillis()
            val selectedFileIds = selectClassicActivityFileIdsForEntryDate(
                classicActivityFileIds(combined.toByteArray(), decryptionKey),
                entryDate,
                includeSleep,
            )
            val selectionSignature = selectedFileIds.joinToString("|") { fullHex(it) ?: "" }
            if (selectionSignature != lastSelectionSignature) {
                lastSelectionSignature = selectionSignature
                lastSelectionChangedAt = now
            }
            if (selectedFileIds.isNotEmpty() && now - lastSelectionChangedAt >= CLASSIC_ACTIVITY_SELECTION_QUIET_MS) {
                return lastError
            }
            if (lastError != null) {
                return lastError
            }
        }
        return lastError
    }

    private fun requestClassicActivityFilesSequentially(
        socket: BluetoothSocket,
        packets: MutableList<JSObject>,
        combined: java.io.ByteArrayOutputStream,
        fileIds: List<ByteArray>,
        entryDate: String?,
        encryptionKey: ByteArray,
        decryptionKey: ByteArray?,
        initialSequenceNumber: Int,
    ): ClassicActivityFetchQueueResult {
        val requests = mutableListOf<JSObject>()
        var nextSequenceNumber = initialSequenceNumber
        var firstError: String? = null
        var completedCount = 0
        var failedCount = 0
        val selectedFileIds = dedupeClassicActivityFileIdsForFetch(
            sortClassicActivityFileIdsForFetch(fileIds, entryDate),
        ).take(CLASSIC_ACTIVITY_FILE_PROBE_LIMIT)

        for (fileId in selectedFileIds) {
            if (Thread.currentThread().isInterrupted) {
                throw InterruptedException()
            }

            val file = parseClassicActivityFileIds(fileId).firstOrNull()
            val idHex = fullHex(fileId)
            val request = JSObject()
            request.put("idHex", idHex)
            request.put("activityFile", file?.toJson())
            request.put("kind", file?.kind)
            request.put("timestamp", file?.timestamp)
            request.put("type", file?.type)
            request.put("subtype", file?.subtype)
            request.put("detailType", file?.detailType)
            request.put("version", file?.version)
            request.put("sequenceNumber", nextSequenceNumber)
            Log.i(TAG, "classic activity request file=${idHex ?: "-"} kind=${file?.kind ?: "-"} timestamp=${file?.timestamp ?: "-"} seq=$nextSequenceNumber")

            try {
                socket.outputStream.write(
                    buildClassicV2EncryptedCommandPacket(
                        command = buildActivityFetchRequestCommand(fileId),
                        sequenceNumber = nextSequenceNumber++,
                        encryptionKey = encryptionKey,
                    ),
                )
                socket.outputStream.flush()
            } catch (error: IOException) {
                val message = "Не удалось запросить файл часов ${idHex ?: "-"}: ${safeMessage(error)}"
                request.put("status", "write-error")
                request.put("error", message)
                requests.add(request)
                failedCount += 1
                firstError = firstError ?: message
                break
            }

            Thread.sleep(CLASSIC_POST_AUTH_COMMAND_DELAY_MS)
            val readResult = readClassicActivityFileUntil(
                socket = socket,
                packets = packets,
                combined = combined,
                decryptionKey = decryptionKey,
                targetFileIdHex = idHex,
                targetFile = file,
            )
            request.put("status", readResult.status)
            request.put("error", readResult.error)
            request.put("crcValid", readResult.crcValid)
            request.put("parsed", readResult.parsed)
            request.put("chunkNumber", readResult.chunkNumber)
            request.put("chunkTotal", readResult.chunkTotal)
            request.put("payloadBytes", readResult.payloadBytes)
            request.put("durationMs", readResult.durationMs)
            requests.add(request)
            Log.i(
                TAG,
                "classic activity result file=${idHex ?: "-"} status=${readResult.status} " +
                    "crc=${readResult.crcValid} chunk=${readResult.chunkNumber}/${readResult.chunkTotal} " +
                    "parsed=${readResult.parsed} bytes=${readResult.payloadBytes} durationMs=${readResult.durationMs}",
            )

            if (readResult.status == "complete") {
                completedCount += 1
            } else {
                failedCount += 1
                firstError = firstError ?: readResult.error
            }
        }

        return ClassicActivityFetchQueueResult(
            requestedCount = selectedFileIds.size,
            completedCount = completedCount,
            failedCount = failedCount,
            requests = requests,
            nextSequenceNumber = nextSequenceNumber,
            error = if (completedCount == 0) firstError else null,
        )
    }

    private fun readClassicActivityFileUntil(
        socket: BluetoothSocket,
        packets: MutableList<JSObject>,
        combined: java.io.ByteArrayOutputStream,
        decryptionKey: ByteArray?,
        targetFileIdHex: String?,
        targetFile: ClassicActivityFileSummary?,
    ): ClassicActivityFileReadResult {
        val startedAt = android.os.SystemClock.uptimeMillis()
        val readLimitMs = classicActivityFileReadLimitMs(targetFile)
        val noProgressLimitMs = classicActivityFileNoProgressLimitMs(targetFile)
        var lastError: String? = null
        var lastChunkNumber: Int? = null
        var lastChunkTotal: Int? = null
        var lastPayloadBytes: Int? = null
        var lastCrcValid: Boolean? = null
        var lastParsed: Boolean? = null
        var lastTargetProgressAt: Long? = null
        var lastTargetSignature: String? = null

        while (android.os.SystemClock.uptimeMillis() - startedAt < readLimitMs) {
            lastError = readClassicPackets(socket, packets, combined, CLASSIC_ACTIVITY_FILE_QUEUE_POLL_MS) ?: lastError
            val now = android.os.SystemClock.uptimeMillis()
            val targetPacket = findClassicActivityFilePacket(
                packets = collectClassicDecryptedPackets(combined.toByteArray(), decryptionKey),
                targetFileIdHex = targetFileIdHex,
            )
            if (targetPacket != null) {
                lastChunkNumber = nullableInt(targetPacket, "activityChunkNumber")
                lastChunkTotal = nullableInt(targetPacket, "activityChunkTotal")
                lastPayloadBytes = nullableInt(targetPacket, "activityFilePayloadBytes")
                lastCrcValid = nullableBoolean(targetPacket, "activityFileCrcValid")
                lastParsed = nullableBoolean(targetPacket, "activityFileParsed")
                val targetSignature = listOf(lastChunkNumber, lastChunkTotal, lastPayloadBytes, lastCrcValid, lastParsed).joinToString(":")
                if (targetSignature != lastTargetSignature) {
                    lastTargetSignature = targetSignature
                    lastTargetProgressAt = now
                }
                if (lastCrcValid == true) {
                    return ClassicActivityFileReadResult(
                        status = "complete",
                        error = null,
                        crcValid = true,
                        parsed = lastParsed == true,
                        chunkNumber = lastChunkNumber,
                        chunkTotal = lastChunkTotal,
                        payloadBytes = lastPayloadBytes,
                        durationMs = android.os.SystemClock.uptimeMillis() - startedAt,
                    )
                }
                if (lastCrcValid == false) {
                    return ClassicActivityFileReadResult(
                        status = "crc-error",
                        error = "Файл часов прочитан, но CRC не совпал.",
                        crcValid = false,
                        parsed = lastParsed == true,
                        chunkNumber = lastChunkNumber,
                        chunkTotal = lastChunkTotal,
                        payloadBytes = lastPayloadBytes,
                        durationMs = android.os.SystemClock.uptimeMillis() - startedAt,
                    )
                }
            }
            val targetProgressAt = lastTargetProgressAt
            if (targetProgressAt != null && now - targetProgressAt >= noProgressLimitMs) {
                val hasPartialTarget = lastChunkNumber != null || lastChunkTotal != null
                return ClassicActivityFileReadResult(
                    status = if (hasPartialTarget) "partial-timeout" else "timeout",
                    error = if (hasPartialTarget) {
                        "Часы начали отдавать файл активности, но не завершили передачу."
                    } else {
                        "Часы не начали отдавать файл активности."
                    },
                    crcValid = lastCrcValid,
                    parsed = lastParsed,
                    chunkNumber = lastChunkNumber,
                    chunkTotal = lastChunkTotal,
                    payloadBytes = lastPayloadBytes,
                    durationMs = now - startedAt,
                )
            }
            if (lastError != null) {
                return ClassicActivityFileReadResult(
                    status = "read-error",
                    error = lastError,
                    crcValid = lastCrcValid,
                    parsed = lastParsed,
                    chunkNumber = lastChunkNumber,
                    chunkTotal = lastChunkTotal,
                    payloadBytes = lastPayloadBytes,
                    durationMs = android.os.SystemClock.uptimeMillis() - startedAt,
                )
            }
        }

        return ClassicActivityFileReadResult(
            status = "timeout",
            error = "Часы не отдали файл активности за отведенное время.",
            crcValid = lastCrcValid,
            parsed = lastParsed,
            chunkNumber = lastChunkNumber,
            chunkTotal = lastChunkTotal,
            payloadBytes = lastPayloadBytes,
            durationMs = android.os.SystemClock.uptimeMillis() - startedAt,
        )
    }

    private fun classicActivityFileReadLimitMs(file: ClassicActivityFileSummary?): Long {
        return if (isClassicWorkoutDetailFile(file)) {
            CLASSIC_ACTIVITY_WORKOUT_DETAIL_READ_MS
        } else {
            CLASSIC_ACTIVITY_FILE_READ_MS
        }
    }

    private fun classicActivityFileNoProgressLimitMs(file: ClassicActivityFileSummary?): Long {
        return if (isClassicWorkoutDetailFile(file)) {
            CLASSIC_ACTIVITY_WORKOUT_DETAIL_NO_PROGRESS_MS
        } else {
            CLASSIC_ACTIVITY_FILE_NO_PROGRESS_MS
        }
    }

    private fun isClassicWorkoutDetailFile(file: ClassicActivityFileSummary?): Boolean {
        return file?.type == 1 && file.detailType == 0
    }

    private fun dedupeClassicActivityFileIdsForFetch(fileIds: List<ByteArray>): List<ByteArray> {
        val seen = mutableSetOf<String>()
        return fileIds.filter { fileId ->
            val file = parseClassicActivityFileIds(fileId).firstOrNull()
            val key = file?.let { classicActivityFileLogicalKey(it) } ?: (fullHex(fileId) ?: "")
            key.isNotBlank() && seen.add(key)
        }
    }

    private fun classicActivityFileLogicalKey(file: ClassicActivityFileSummary): String {
        return listOf(
            file.timestamp,
            file.type,
            file.subtype,
            file.detailType,
            file.version,
        ).joinToString(":")
    }

    private fun findClassicActivityFilePacket(
        packets: List<JSObject>,
        targetFileIdHex: String?,
    ): JSObject? {
        return packets.lastOrNull { packet ->
            if (packet.optString("channel") != "activity") {
                return@lastOrNull false
            }
            val activityFile = packet.optJSONObject("activityFile")
            if (targetFileIdHex.isNullOrBlank()) {
                activityFile != null && !activityFile.optString("idHex").isNullOrBlank()
            } else {
                activityFile?.optString("idHex") == targetFileIdHex
            }
        }
    }

    private fun nullableInt(item: JSObject, key: String): Int? {
        return if (item.has(key) && !item.isNull(key)) item.optInt(key) else null
    }

    private fun nullableBoolean(item: JSObject, key: String): Boolean? {
        return if (item.has(key) && !item.isNull(key)) item.optBoolean(key) else null
    }

    private fun keepAliveClassicServiceBridge(
        socket: BluetoothSocket,
        packets: MutableList<JSObject>,
        combined: java.io.ByteArrayOutputStream,
        encryptionKey: ByteArray,
        decryptionKey: ByteArray?,
        weatherPayload: JSONObject?,
        initialSequenceNumber: Int,
        durationMs: Long,
    ) {
        val startedAt = android.os.SystemClock.uptimeMillis()
        var nextSequenceNumber = initialSequenceNumber
        var nextWeatherRefreshAt = startedAt + CLASSIC_SERVICE_BRIDGE_REFRESH_MS
        var processedDecryptedPacketCount = collectClassicDecryptedPackets(
            combined.toByteArray(),
            decryptionKey,
        ).size

        while (
            !Thread.currentThread().isInterrupted &&
            android.os.SystemClock.uptimeMillis() - startedAt < durationMs
        ) {
            readClassicPackets(socket, packets, combined, CLASSIC_SERVICE_BRIDGE_POLL_MS)

            val now = android.os.SystemClock.uptimeMillis()
            val decryptedPackets = collectClassicDecryptedPackets(combined.toByteArray(), decryptionKey)
            var hasWeatherRequest = false
            var hasLocationRequest = false
            if (decryptedPackets.size > processedDecryptedPacketCount) {
                for (index in processedDecryptedPacketCount until decryptedPackets.size) {
                    val packet = decryptedPackets[index]
                    Log.i(
                        TAG,
                        "classic bridge incoming command type=${packet.optInt("commandType", -1)} subtype=${packet.optInt("commandSubtype", -1)} status=${packet.optInt("commandStatus", -1)} raw=${packet.optString("rawHex")}",
                    )
                    if (
                        packet.optString("channel") == "command" &&
                        packet.optInt("commandType", -1) == 10 &&
                        packet.optInt("commandSubtype", -1) == 3
                    ) {
                        hasWeatherRequest = true
                    }
                    if (
                        packet.optString("channel") == "command" &&
                        packet.optInt("commandType", -1) == 16 &&
                        packet.optInt("commandSubtype", -1) in listOf(1, 3)
                    ) {
                        hasLocationRequest = true
                    }
                }
                processedDecryptedPacketCount = decryptedPackets.size
            }

            if (weatherPayload != null && hasLocationRequest) {
                buildPostLocationCommand(weatherPayload)?.let { payload ->
                    Log.i(TAG, "classic bridge send phone-location-watch-request")
                    socket.outputStream.write(
                        buildClassicV2EncryptedCommandPacket(
                            command = payload,
                            sequenceNumber = nextSequenceNumber++,
                            encryptionKey = encryptionKey,
                        ),
                    )
                    socket.outputStream.flush()
                    Thread.sleep(CLASSIC_POST_AUTH_COMMAND_DELAY_MS)
                }
            }

            if (weatherPayload != null && (hasWeatherRequest || hasLocationRequest || now >= nextWeatherRefreshAt)) {
                val refreshReason = when {
                    hasWeatherRequest -> "watch-request"
                    hasLocationRequest -> "location-request"
                    else -> "timer"
                }
                Log.i(TAG, "classic bridge weather refresh reason=$refreshReason")
                buildClassicWeatherRefreshCommands(weatherPayload).forEach { command ->
                    Log.i(TAG, "classic bridge send ${command.label}")
                    socket.outputStream.write(
                        buildClassicV2EncryptedCommandPacket(
                            command = command.payload,
                            sequenceNumber = nextSequenceNumber++,
                            encryptionKey = encryptionKey,
                        ),
                    )
                    Thread.sleep(CLASSIC_POST_AUTH_COMMAND_DELAY_MS)
                }
                socket.outputStream.flush()
                nextWeatherRefreshAt = now + CLASSIC_SERVICE_BRIDGE_REFRESH_MS
            }
        }
    }

    private fun writeProtoVarintField(output: java.io.ByteArrayOutputStream, fieldNumber: Int, value: Int) {
        writeProtoVarint(output, (fieldNumber shl 3) or 0)
        writeProtoVarint(output, value)
    }

    private fun writeProtoSInt32Field(output: java.io.ByteArrayOutputStream, fieldNumber: Int, value: Int) {
        writeProtoVarint(output, (fieldNumber shl 3) or 0)
        writeProtoVarint(output, (value shl 1) xor (value shr 31))
    }

    private fun writeProtoInt32Field(output: java.io.ByteArrayOutputStream, fieldNumber: Int, value: Int) {
        writeProtoVarint(output, (fieldNumber shl 3) or 0)
        if (value >= 0) {
            writeProtoVarint(output, value)
        } else {
            writeProtoVarint64(output, value.toLong())
        }
    }

    private fun writeProtoBytesField(output: java.io.ByteArrayOutputStream, fieldNumber: Int, bytes: ByteArray) {
        writeProtoVarint(output, (fieldNumber shl 3) or 2)
        writeProtoVarint(output, bytes.size)
        output.write(bytes)
    }

    private fun writeProtoStringField(output: java.io.ByteArrayOutputStream, fieldNumber: Int, value: String) {
        writeProtoBytesField(output, fieldNumber, value.toByteArray(Charsets.UTF_8))
    }

    private fun writeProtoFloatField(output: java.io.ByteArrayOutputStream, fieldNumber: Int, value: Float) {
        writeProtoVarint(output, (fieldNumber shl 3) or 5)
        writeLittleEndianUInt32(output, java.lang.Float.floatToIntBits(value))
    }

    private fun writeProtoDoubleField(output: java.io.ByteArrayOutputStream, fieldNumber: Int, value: Double) {
        writeProtoVarint(output, (fieldNumber shl 3) or 1)
        writeLittleEndianUInt64(output, java.lang.Double.doubleToLongBits(value))
    }

    private fun writeProtoVarint(output: java.io.ByteArrayOutputStream, value: Int) {
        var remaining = value
        while (remaining >= 0x80) {
            output.write((remaining and 0x7f) or 0x80)
            remaining = remaining ushr 7
        }
        output.write(remaining)
    }

    private fun writeProtoVarint64(output: java.io.ByteArrayOutputStream, value: Long) {
        var remaining = value
        while ((remaining and -128L) != 0L) {
            output.write(((remaining and 0x7fL) or 0x80L).toInt())
            remaining = remaining ushr 7
        }
        output.write(remaining.toInt())
    }

    private fun writeLittleEndianUInt16(output: java.io.ByteArrayOutputStream, value: Int) {
        output.write(value and 0xff)
        output.write((value ushr 8) and 0xff)
    }

    private fun writeLittleEndianUInt32(output: java.io.ByteArrayOutputStream, value: Int) {
        output.write(value and 0xff)
        output.write((value ushr 8) and 0xff)
        output.write((value ushr 16) and 0xff)
        output.write((value ushr 24) and 0xff)
    }

    private fun writeLittleEndianUInt64(output: java.io.ByteArrayOutputStream, value: Long) {
        output.write((value and 0xffL).toInt())
        output.write(((value ushr 8) and 0xffL).toInt())
        output.write(((value ushr 16) and 0xffL).toInt())
        output.write(((value ushr 24) and 0xffL).toInt())
        output.write(((value ushr 32) and 0xffL).toInt())
        output.write(((value ushr 40) and 0xffL).toInt())
        output.write(((value ushr 48) and 0xffL).toInt())
        output.write(((value ushr 56) and 0xffL).toInt())
    }

    private fun littleEndianUInt16(bytes: ByteArray, offset: Int): Int {
        if (bytes.size < offset + 2) {
            return 0
        }
        return (bytes[offset].toInt() and 0xff) or ((bytes[offset + 1].toInt() and 0xff) shl 8)
    }

    private fun littleEndianUInt32(bytes: ByteArray, offset: Int): Long {
        if (bytes.size < offset + 4) {
            return 0
        }
        return (bytes[offset].toLong() and 0xffL) or
            ((bytes[offset + 1].toLong() and 0xffL) shl 8) or
            ((bytes[offset + 2].toLong() and 0xffL) shl 16) or
            ((bytes[offset + 3].toLong() and 0xffL) shl 24)
    }

    private fun littleEndianInt16(bytes: ByteArray, offset: Int): Int {
        val unsigned = littleEndianUInt16(bytes, offset)
        return if ((unsigned and 0x8000) != 0) unsigned - 0x10000 else unsigned
    }

    private fun littleEndianFloat(bytes: ByteArray, offset: Int): Float {
        return java.lang.Float.intBitsToFloat(littleEndianUInt32(bytes, offset).toInt())
    }

    private fun haversineMeters(
        fromLatitude: Double,
        fromLongitude: Double,
        toLatitude: Double,
        toLongitude: Double,
    ): Double {
        val radiusMeters = 6_371_000.0
        val dLat = Math.toRadians(toLatitude - fromLatitude)
        val dLon = Math.toRadians(toLongitude - fromLongitude)
        val lat1 = Math.toRadians(fromLatitude)
        val lat2 = Math.toRadians(toLatitude)
        val a = kotlin.math.sin(dLat / 2) * kotlin.math.sin(dLat / 2) +
            kotlin.math.cos(lat1) * kotlin.math.cos(lat2) *
            kotlin.math.sin(dLon / 2) * kotlin.math.sin(dLon / 2)
        val c = 2 * kotlin.math.atan2(kotlin.math.sqrt(a), kotlin.math.sqrt(1 - a))
        return radiusMeters * c
    }

    private fun bigEndianUInt16(bytes: ByteArray, offset: Int): Int {
        if (bytes.size < offset + 2) {
            return 0
        }
        return ((bytes[offset].toInt() and 0xff) shl 8) or (bytes[offset + 1].toInt() and 0xff)
    }

    private fun fullHex(bytes: ByteArray?): String? {
        if (bytes == null || bytes.isEmpty()) {
            return null
        }

        return bytes.joinToString("") { byte -> "%02X".format(byte.toInt() and 0xff) }
    }

    private fun parseHexBytes(value: String): ByteArray? {
        val normalized = value
            .removePrefix("0x")
            .removePrefix("0X")
            .filterNot { it == ':' || it == '-' || it == ' ' }
        if (normalized.length % 2 != 0) {
            return null
        }

        return try {
            ByteArray(normalized.length / 2) { index ->
                normalized.substring(index * 2, index * 2 + 2).toInt(16).toByte()
            }
        } catch (_: NumberFormatException) {
            null
        }
    }

    private fun writeDescriptorCompat(
        gatt: BluetoothGatt,
        descriptor: BluetoothGattDescriptor,
        value: ByteArray,
    ): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            gatt.writeDescriptor(descriptor, value) == BluetoothStatusCodes.SUCCESS
        } else {
            @Suppress("DEPRECATION")
            descriptor.value = value
            @Suppress("DEPRECATION")
            gatt.writeDescriptor(descriptor)
        }
    }

    private fun isIndicatableCharacteristic(characteristic: BluetoothGattCharacteristic): Boolean {
        return characteristic.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0
    }

    private fun stopActiveScan() {
        val scanner = bluetoothAdapter()?.bluetoothLeScanner
        val callback = activeScanCallback
        if (scanner != null && callback != null && hasRequiredRuntimePermissions()) {
            try {
                scanner.stopScan(callback)
            } catch (_: SecurityException) {
                // Nothing to clean up if Android revoked Bluetooth permission during the scan.
            }
        }
        activeScanCallback = null
    }

    private fun stopActiveGatt() {
        val gatt = activeGatt
        activeSession?.connected = false
        sessionSubscribeQueue.clear()
        pendingSessionSubscribe = null
        if (gatt != null) {
            try {
                gatt.disconnect()
                gatt.close()
            } catch (_: SecurityException) {
                // Nothing to clean up if Android revoked Bluetooth permission during inspection.
            }
        }
        activeGatt = null
        activeSession = null
    }

    private fun stopActiveClassicSocket() {
        activeClassicForegroundBridge = false
        val thread = activeClassicThread
        activeClassicThread = null
        if (thread != null && thread.isAlive) {
            thread.interrupt()
        }

        val socket = activeClassicSocket
        activeClassicSocket = null
        if (socket != null) {
            try {
                socket.close()
            } catch (_: IOException) {
                // Socket is already closed.
            }
        }
        DirectWatchForegroundService.stop(context.applicationContext)
    }

    private fun stopActiveBondReceiver() {
        val receiver = activeBondReceiver ?: return
        try {
            context.unregisterReceiver(receiver)
        } catch (_: RuntimeException) {
            // Receiver may already be unregistered if Android completed the pairing flow.
        }
        activeBondReceiver = null
    }

    private fun intentBluetoothDevice(intent: Intent): BluetoothDevice? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
        }
    }

    private fun safeBondState(device: BluetoothDevice): Int {
        return try {
            device.bondState
        } catch (_: SecurityException) {
            BluetoothDevice.ERROR
        }
    }

    private fun safeDeviceType(device: BluetoothDevice): Int {
        return try {
            device.type
        } catch (_: SecurityException) {
            BluetoothDevice.DEVICE_TYPE_UNKNOWN
        }
    }

    private fun safeDeviceUuids(device: BluetoothDevice): List<String> {
        return try {
            device.uuids?.map { it.uuid.toString() }.orEmpty()
        } catch (_: SecurityException) {
            emptyList()
        }
    }

    private fun bondStateLabel(state: Int): String {
        return when (state) {
            BluetoothDevice.BOND_BONDED -> "bonded"
            BluetoothDevice.BOND_BONDING -> "bonding"
            BluetoothDevice.BOND_NONE -> "not-bonded"
            else -> "unknown"
        }
    }

    private fun deviceTypeLabel(type: Int): String {
        return when (type) {
            BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
            BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
            BluetoothDevice.DEVICE_TYPE_LE -> "le"
            else -> "unknown"
        }
    }

    private data class StandardCharacteristicRead(
        val serviceUuid: UUID,
        val characteristic: BluetoothGattCharacteristic,
        val kind: String,
        val name: String,
    )

    private data class NotifyCharacteristicSubscription(
        val serviceUuid: UUID,
        val characteristic: BluetoothGattCharacteristic,
        val name: String,
    )

    private data class DirectWatchSession(
        val deviceId: String,
        val deviceName: String?,
        val startedAt: String,
        var connected: Boolean = false,
        var serviceCount: Int = 0,
        var packetCount: Int = 0,
        val subscribed: MutableList<JSObject> = mutableListOf(),
        val packets: java.util.ArrayDeque<JSObject> = java.util.ArrayDeque(),
    )

    private data class WeatherLocationResolution(
        val payload: JSONObject,
        val changed: Boolean,
    )

    private data class ClassicProbeParse(
        val detectedProtocol: String?,
        val versionHex: String?,
        val packetType: String?,
        val authSubtype: Int?,
        val authStatus: Int?,
        val watchNonceHex: String?,
        val watchHmacHex: String?,
        val authStage: String?,
        val authPacketSequenceNumber: Int?,
    )

    private data class ClassicAuthProbeParse(
        val authSubtype: Int? = null,
        val authStatus: Int? = null,
        val watchNonceHex: String? = null,
        val watchHmacHex: String? = null,
        val authStage: String? = null,
        val authPacketSequenceNumber: Int? = null,
    )

    private data class ClassicAuthKeyCheck(
        val status: String,
        val error: String?,
    )

    private data class ClassicAuthStep2Material(
        val status: String,
        val error: String?,
        val authStep3Command: ByteArray?,
        val encryptionKey: ByteArray? = null,
        val decryptionKey: ByteArray? = null,
    )

    private data class ClassicCommandHeader(
        val commandType: Int?,
        val commandSubtype: Int?,
        val commandStatus: Int?,
        val label: String?,
        val batteryLevel: Int? = null,
        val batteryState: Int? = null,
        val isCharging: Boolean? = null,
        val isWorn: Boolean? = null,
        val isUserAsleep: Boolean? = null,
        val deviceModel: String? = null,
        val firmware: String? = null,
        val serialNumber: String? = null,
        val activityFileCount: Int? = null,
        val activityFileIdsHex: String? = null,
        val heartRateInterval: Int? = null,
        val heartRateDisabled: Boolean? = null,
        val steps: Int? = null,
        val heartRate: Int? = null,
        val calories: Int? = null,
        val activityFiles: List<ClassicActivityFileSummary> = emptyList(),
    )

    private data class ClassicPostAuthProbeCommand(
        val label: String,
        val payload: ByteArray,
    )

    private data class ClassicActivityFetchQueueResult(
        val requestedCount: Int,
        val completedCount: Int,
        val failedCount: Int,
        val requests: List<JSObject>,
        val nextSequenceNumber: Int,
        val error: String?,
    )

    private data class ClassicActivityFileReadResult(
        val status: String,
        val error: String?,
        val crcValid: Boolean?,
        val parsed: Boolean?,
        val chunkNumber: Int?,
        val chunkTotal: Int?,
        val payloadBytes: Int?,
        val durationMs: Long,
    )

    private data class ClassicSystemPayload(
        var batteryLevel: Int? = null,
        var batteryState: Int? = null,
        var isCharging: Boolean? = null,
        var isWorn: Boolean? = null,
        var isUserAsleep: Boolean? = null,
        var deviceModel: String? = null,
        var firmware: String? = null,
        var serialNumber: String? = null,
    )

    private data class ClassicHealthPayload(
        var activityFileCount: Int? = null,
        var activityFileIdsHex: String? = null,
        var heartRateInterval: Int? = null,
        var heartRateDisabled: Boolean? = null,
        var steps: Int? = null,
        var heartRate: Int? = null,
        var calories: Int? = null,
        var activityFiles: List<ClassicActivityFileSummary> = emptyList(),
    )

    private data class ClassicActivityFileSummary(
        val idHex: String,
        val timestamp: String,
        val timezone: Int,
        val type: Int,
        val subtype: Int,
        val detailType: Int,
        val version: Int,
        val kind: String,
    ) {
        fun toJson(): JSObject {
            val item = JSObject()
            item.put("idHex", idHex)
            item.put("timestamp", timestamp)
            item.put("timezone", timezone)
            item.put("type", type)
            item.put("subtype", subtype)
            item.put("detailType", detailType)
            item.put("version", version)
            item.put("kind", kind)
            return item
        }
    }

    private data class ClassicActivityFileContent(
        val file: ClassicActivityFileSummary,
        val fileKind: String,
        val padding: Int,
        val payloadBytes: Int,
        val crcValid: Boolean?,
        val parsed: Boolean,
        val sampleCount: Int?,
        val steps: Int?,
        val heartRateAvg: Int?,
        val heartRateMin: Int?,
        val heartRateMax: Int?,
        val heartRateResting: Int?,
        val spo2Avg: Int?,
        val spo2Min: Int?,
        val spo2Max: Int?,
        val stressAvg: Int?,
        val stressMin: Int?,
        val stressMax: Int?,
        val calories: Int?,
        val trainingLoadDay: Int?,
        val trainingLoadWeek: Int?,
        val vitality: Int?,
        val sleepStartTime: String?,
        val sleepEndTime: String?,
        val sleepDurationMinutes: Int?,
        val sleepDeepMinutes: Int?,
        val sleepLightMinutes: Int?,
        val sleepRemMinutes: Int?,
        val sleepAwakeMinutes: Int?,
        val sleepScore: Int?,
        val sleepStageCount: Int?,
        val sleepIsAwake: Boolean?,
        val workoutStartTime: String?,
        val workoutEndTime: String?,
        val workoutDurationMinutes: Int?,
        val workoutDistanceMeters: Int?,
        val workoutSteps: Int?,
        val workoutType: String?,
        val workoutTypeCode: Int?,
        val workoutPaceAvgSecondsPerKm: Int?,
        val workoutPaceMaxSecondsPerKm: Int?,
        val workoutPaceMinSecondsPerKm: Int?,
        val workoutSpeedAvgKmh: Double?,
        val workoutSpeedMaxKmh: Double?,
        val workoutCadenceAvg: Int?,
        val workoutCadenceMax: Int?,
        val workoutStepLengthAvgCm: Int?,
        val workoutStepRateAvg: Int?,
        val workoutStepRateMax: Int?,
        val workoutStrokes: Int?,
        val workoutStrokeRateAvg: Int?,
        val workoutJumps: Int?,
        val workoutJumpRateAvg: Int?,
        val workoutJumpRateMax: Int?,
        val workoutLaps: Int?,
        val workoutSwolfAvg: Int?,
        val workoutSwimStyle: Int?,
        val workoutElevationGainMeters: Double?,
        val workoutElevationLossMeters: Double?,
        val workoutAltitudeAvgMeters: Double?,
        val workoutAltitudeMaxMeters: Double?,
        val workoutAltitudeMinMeters: Double?,
        val workoutTrainingEffectAerobic: Double?,
        val workoutTrainingEffectAnaerobic: Double?,
        val workoutLoad: Int?,
        val workoutRecoveryTimeHours: Int?,
        val workoutVo2Max: Int?,
        val workoutVitalityGain: Int?,
        val workoutHeartRateZoneExtremeSeconds: Int?,
        val workoutHeartRateZoneAnaerobicSeconds: Int?,
        val workoutHeartRateZoneAerobicSeconds: Int?,
        val workoutHeartRateZoneFatBurnSeconds: Int?,
        val workoutHeartRateZoneWarmUpSeconds: Int?,
        val workoutGpsSampleCount: Int?,
        val workoutGpsSamples: List<ClassicWorkoutGpsSample>,
        val activitySamples: List<ClassicActivitySample>,
    )

    private data class ClassicDailySummary(
        val steps: Int?,
        val calories: Int?,
        val heartRateResting: Int?,
        val heartRateAvg: Int?,
        val heartRateMin: Int?,
        val heartRateMax: Int?,
        val spo2Avg: Int?,
        val spo2Min: Int?,
        val spo2Max: Int?,
        val stressAvg: Int?,
        val stressMin: Int?,
        val stressMax: Int?,
        val trainingLoadDay: Int?,
        val trainingLoadWeek: Int?,
        val vitality: Int?,
    )

    private data class ClassicDailyDetailsSummary(
        val sampleCount: Int,
        val steps: Int?,
        val heartRateAvg: Int?,
        val heartRateMin: Int?,
        val heartRateMax: Int?,
        val spo2Avg: Int?,
        val stressAvg: Int?,
        val samples: List<ClassicActivitySample>,
    )

    private data class ClassicDailyDetailsSample(
        val nextOffset: Int,
        val steps: Int?,
        val heartRate: Int?,
        val spo2: Int?,
        val stress: Int?,
    )

    private data class ClassicWorkoutSummary(
        val startTime: String?,
        val endTime: String?,
        val durationMinutes: Int?,
        val distanceMeters: Int?,
        val calories: Int?,
        val steps: Int?,
        val heartRateAvg: Int?,
        val heartRateMin: Int?,
        val heartRateMax: Int?,
        val workoutType: String?,
        val zoneExtremeSeconds: Int?,
        val zoneAnaerobicSeconds: Int?,
        val zoneAerobicSeconds: Int?,
        val zoneFatBurnSeconds: Int?,
        val zoneWarmUpSeconds: Int?,
        val workoutTypeCode: Int? = null,
        val paceAvgSecondsPerKm: Int? = null,
        val paceMaxSecondsPerKm: Int? = null,
        val paceMinSecondsPerKm: Int? = null,
        val speedAvgKmh: Double? = null,
        val speedMaxKmh: Double? = null,
        val cadenceAvg: Int? = null,
        val cadenceMax: Int? = null,
        val stepLengthAvgCm: Int? = null,
        val stepRateAvg: Int? = null,
        val stepRateMax: Int? = null,
        val strokes: Int? = null,
        val strokeRateAvg: Int? = null,
        val jumps: Int? = null,
        val jumpRateAvg: Int? = null,
        val jumpRateMax: Int? = null,
        val laps: Int? = null,
        val swolfAvg: Int? = null,
        val swimStyle: Int? = null,
        val elevationGainMeters: Double? = null,
        val elevationLossMeters: Double? = null,
        val altitudeAvgMeters: Double? = null,
        val altitudeMaxMeters: Double? = null,
        val altitudeMinMeters: Double? = null,
        val trainingEffectAerobic: Double? = null,
        val trainingEffectAnaerobic: Double? = null,
        val workoutLoad: Int? = null,
        val recoveryTimeHours: Int? = null,
        val vo2Max: Int? = null,
        val vitalityGain: Int? = null,
    )

    private data class ClassicWorkoutTiming(
        val startSeconds: Long,
        val endSeconds: Long,
        val activeSeconds: Long,
        val afterActiveOffset: Int,
    )

    private data class ClassicWorkoutDetailsSummary(
        val sampleCount: Int,
        val heartRateAvg: Int?,
        val heartRateMin: Int?,
        val heartRateMax: Int?,
        val samples: List<ClassicActivitySample>,
    )

    private data class ClassicWorkoutGpsSummary(
        val sampleCount: Int,
        val samples: List<ClassicWorkoutGpsSample>,
    )

    private data class ClassicWorkoutGpsSample(
        val sampleTime: String,
        val latitude: Double,
        val longitude: Double,
        val hdop: Double?,
        val speedMetersPerSecond: Double?,
        val distanceMeters: Double?,
    ) {
        fun toJson(): JSObject {
            val item = JSObject()
            item.put("sampleTime", sampleTime)
            item.put("latitude", latitude)
            item.put("longitude", longitude)
            item.put("hdop", hdop)
            item.put("speedMetersPerSecond", speedMetersPerSecond)
            item.put("distanceMeters", distanceMeters)
            return item
        }
    }

    private data class ClassicActivitySample(
        val sampleTime: String,
        val heartRate: Int?,
        val spo2: Int?,
        val stress: Int?,
        val steps: Int?,
    ) {
        fun toJson(): JSObject {
            val item = JSObject()
            item.put("sampleTime", sampleTime)
            item.put("heartRate", heartRate)
            item.put("spo2", spo2)
            item.put("stress", stress)
            item.put("steps", steps)
            return item
        }
    }

    private data class ClassicSleepSummary(
        val startTime: String?,
        val endTime: String?,
        val durationMinutes: Int?,
        val deepMinutes: Int?,
        val lightMinutes: Int?,
        val remMinutes: Int?,
        val awakeMinutes: Int?,
        val score: Int?,
        val stageCount: Int?,
        val isAwake: Boolean?,
        val sampleCount: Int? = null,
        val heartRateAvg: Int? = null,
        val heartRateMin: Int? = null,
        val heartRateMax: Int? = null,
        val spo2Avg: Int? = null,
        val spo2Min: Int? = null,
        val spo2Max: Int? = null,
        val samples: List<ClassicActivitySample> = emptyList(),
    )

    private data class ClassicActivityChunk(
        val total: Int,
        val number: Int,
        val payloadBytes: Int,
        val label: String,
    )

    private data class ProtoValue(
        val intValue: Int?,
        val bytes: ByteArray?,
    )

    private data class ProtoVarint(
        val value: Long,
        val nextOffset: Int,
    )

    private data class ScannedWatchDevice(
        val id: String,
        val name: String?,
        val rssi: Int?,
        val isLikelyWatch: Boolean,
        val bondState: Int,
        val bondStateLabel: String,
        val deviceType: Int,
        val deviceTypeLabel: String,
        val isConnectable: Boolean?,
        val serviceUuids: List<String>,
        val manufacturerData: JSArray,
        val serviceData: JSArray,
        val txPowerLevel: Int?,
    ) {
        fun toJson(): JSObject {
            val item = JSObject()
            item.put("id", id)
            item.put("name", name)
            item.put("rssi", rssi)
            item.put("isLikelyWatch", isLikelyWatch)
            item.put("bondState", bondStateLabel)
            item.put("bondStateCode", bondState)
            item.put("deviceType", deviceTypeLabel)
            item.put("deviceTypeCode", deviceType)
            item.put("isConnectable", isConnectable)
            item.put("serviceUuids", JSArray(serviceUuids))
            item.put("manufacturerData", manufacturerData)
            item.put("serviceData", serviceData)
            item.put("txPowerLevel", txPowerLevel)
            return item
        }
    }

    companion object {
        private const val TAG = "DirectWatch"
        private const val DEFAULT_SCAN_DURATION_MS = 6_000
        private const val INSPECT_TIMEOUT_MS = 10_000
        private const val SESSION_CONNECT_TIMEOUT_MS = 15_000
        private const val PAIR_TIMEOUT_MS = 30_000
        private const val MAX_STANDARD_READS = 18
        private const val MAX_SESSION_SUBSCRIPTIONS = 10
        private const val MAX_SESSION_PACKETS = 16
        private const val MAX_PACKET_PREVIEW_BYTES = 96
        private const val MAX_CLASSIC_PACKET_PREVIEW_BYTES = 160
        private const val CLASSIC_PROBE_READ_MS = 6_000L
        private const val CLASSIC_POST_AUTH_READ_MS = 4_000L
        private const val CLASSIC_POST_AUTH_HISTORY_READ_MS = 10_000L
        private const val CLASSIC_SERVICE_SYNC_READ_MS = 4_000L
        private const val CLASSIC_ACTIVITY_ACK_READ_MS = 1_500L
        private const val CLASSIC_ACTIVITY_FILE_READ_MS = 45_000L
        private const val CLASSIC_ACTIVITY_FILE_NO_PROGRESS_MS = 12_000L
        private const val CLASSIC_ACTIVITY_WORKOUT_DETAIL_READ_MS = 120_000L
        private const val CLASSIC_ACTIVITY_WORKOUT_DETAIL_NO_PROGRESS_MS = 30_000L
        private const val CLASSIC_ACTIVITY_FILE_QUEUE_POLL_MS = 250L
        private const val CLASSIC_ACTIVITY_FILE_PROBE_LIMIT = 512
        private const val CLASSIC_ACTIVITY_FILE_ID_BYTES = 7
        private const val CLASSIC_MANUAL_SAMPLE_HR = 0x11
        private const val CLASSIC_MANUAL_SAMPLE_SPO2 = 0x12
        private const val CLASSIC_MANUAL_SAMPLE_STRESS = 0x13
        private const val CLASSIC_MANUAL_SAMPLE_TEMPERATURE = 0x44
        private const val CLASSIC_POST_AUTH_COMMAND_DELAY_MS = 120L
        private const val CLASSIC_FAST_READ_POLL_MS = 120L
        private const val CLASSIC_ACTIVITY_SELECTION_QUIET_MS = 650L
        private const val CLASSIC_SLEEP_PACKET_HEADER = 0xfffcfafbL
        private const val CLASSIC_VERSION_READ_MS = 1_200L
        private const val CLASSIC_SESSION_CONFIG_READ_MS = 1_200L
        private const val CLASSIC_PROBE_POLL_MS = 120L
        private const val CLASSIC_WATCH_NONCE_MISSING_MESSAGE =
            "Часы не ответили на auth-запрос: SPP-канал занят Mi Fitness или системным Xiaomi Mi Connect. Для прямого PERFORM Sync нужен телефон без активного Xiaomi Mi Connect либо отключение этого системного companion-сервиса."
        private const val CLASSIC_SOCKET_CONNECT_ATTEMPTS = 4
        private const val CLASSIC_SOCKET_RETRY_DELAY_MS = 1_500L
        private const val CLASSIC_SOCKET_DIRECT_CHANNEL_ATTEMPT = 3
        private const val CLASSIC_SPP_RFCOMM_CHANNEL = 5
        private const val CLASSIC_SERVICE_BRIDGE_MAX_MS = 2 * 60 * 60 * 1000
        private const val CLASSIC_SERVICE_BRIDGE_POLL_MS = 1_000L
        private const val CLASSIC_SERVICE_BRIDGE_REFRESH_MS = 15 * 60 * 1000L
        private const val XIAOMI_WEATHER_CLEAR_SKY = 0
        private val PAIRING_TIMEOUT_TOKEN = Any()
        private val SESSION_TIMEOUT_TOKEN = Any()
        private val SPP_SERVICE_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb")
        private val CLASSIC_SPP_PREAMBLE = byteArrayOf(0xBA.toByte(), 0xDC.toByte(), 0xFE.toByte())
        private val CLASSIC_SPP_V1_VERSION_REQUEST = byteArrayOf(
            0xBA.toByte(),
            0xDC.toByte(),
            0xFE.toByte(),
            0x00,
            0xC0.toByte(),
            0x03,
            0x00,
            0x00,
            0x00,
            0x00,
            0xEF.toByte(),
        )
        private val CLIENT_CHARACTERISTIC_CONFIG_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private val HEART_RATE_SERVICE_UUID: UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        private val HEART_RATE_MEASUREMENT_UUID: UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        private val BATTERY_SERVICE_UUID: UUID = UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb")
        private val BATTERY_LEVEL_UUID: UUID = UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb")
        private val DEVICE_INFO_SERVICE_UUID: UUID = UUID.fromString("0000180a-0000-1000-8000-00805f9b34fb")
        private val MANUFACTURER_NAME_UUID: UUID = UUID.fromString("00002a29-0000-1000-8000-00805f9b34fb")
        private val MODEL_NUMBER_UUID: UUID = UUID.fromString("00002a24-0000-1000-8000-00805f9b34fb")
        private val SERIAL_NUMBER_UUID: UUID = UUID.fromString("00002a25-0000-1000-8000-00805f9b34fb")
        private val FIRMWARE_REVISION_UUID: UUID = UUID.fromString("00002a26-0000-1000-8000-00805f9b34fb")
        private val HARDWARE_REVISION_UUID: UUID = UUID.fromString("00002a27-0000-1000-8000-00805f9b34fb")
        private val SOFTWARE_REVISION_UUID: UUID = UUID.fromString("00002a28-0000-1000-8000-00805f9b34fb")
        private val BODY_SENSOR_LOCATION_UUID: UUID = UUID.fromString("00002a38-0000-1000-8000-00805f9b34fb")
        private val GENERIC_ACCESS_SERVICE_UUID: UUID = UUID.fromString("00001800-0000-1000-8000-00805f9b34fb")
        private val GENERIC_ATTRIBUTE_SERVICE_UUID: UUID = UUID.fromString("00001801-0000-1000-8000-00805f9b34fb")
        private val XIAOMI_FE95_SERVICE_UUID: UUID = UUID.fromString("0000fe95-0000-1000-8000-00805f9b34fb")
        private val XIAOMI_FE95_READ_UUID: UUID = UUID.fromString("00000050-0000-1000-8000-00805f9b34fb")
        private val XIAOMI_FE95_NOTIFY_A_UUID: UUID = UUID.fromString("0000005e-0000-1000-8000-00805f9b34fb")
        private val XIAOMI_FE95_NOTIFY_B_UUID: UUID = UUID.fromString("0000005f-0000-1000-8000-00805f9b34fb")
        private val XIAOMI_FDAB_SERVICE_UUID: UUID = UUID.fromString("0000fdab-0000-1000-8000-00805f9b34fb")
        private val XIAOMI_FDAB_READ_UUID: UUID = UUID.fromString("00000001-0000-1000-8000-00805f9b34fb")
        private val XIAOMI_FDAB_NOTIFY_A_UUID: UUID = UUID.fromString("00000002-0000-1000-8000-00805f9b34fb")
        private val XIAOMI_FDAB_NOTIFY_B_UUID: UUID = UUID.fromString("00000003-0000-1000-8000-00805f9b34fb")
        private val XIAOMI_CUSTOM_SERVICE_UUID: UUID = UUID.fromString("1b7e8251-2877-41c3-b46e-cf057c562023")
        private val XIAOMI_PRIVATE_NOTIFY_UUID: UUID = UUID.fromString("8ac32d3f-5cb9-4d44-bec2-ee689169f626")
        private val XIAOMI_FE95_NOTIFY_CHARACTERISTIC_UUIDS = setOf(
            XIAOMI_FE95_NOTIFY_A_UUID,
            XIAOMI_FE95_NOTIFY_B_UUID,
        )
        private val XIAOMI_FDAB_NOTIFY_CHARACTERISTIC_UUIDS = setOf(
            XIAOMI_FDAB_NOTIFY_A_UUID,
            XIAOMI_FDAB_NOTIFY_B_UUID,
        )
        private val DEVICE_INFO_CHARACTERISTIC_UUIDS = listOf(
            MANUFACTURER_NAME_UUID,
            MODEL_NUMBER_UUID,
            SERIAL_NUMBER_UUID,
            FIRMWARE_REVISION_UUID,
            HARDWARE_REVISION_UUID,
            SOFTWARE_REVISION_UUID,
        )
        private val WATCH_NAME_HINTS = listOf("redmi", "watch", "xiaomi", "mi ", "band")
        private val CLASSIC_SLEEP_HEADER_ONLY_PACKET_TYPES = setOf(0x2, 0x3, 0x9, 0xc, 0xd, 0xe, 0xf)
    }
}
