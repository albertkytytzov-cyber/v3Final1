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
import java.util.Locale
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.math.roundToInt

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
            strings = [Manifest.permission.ACCESS_FINE_LOCATION],
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
    private var activeSession: DirectWatchSession? = null
    private val sessionSubscribeQueue = java.util.ArrayDeque<NotifyCharacteristicSubscription>()
    private var pendingSessionSubscribe: NotifyCharacteristicSubscription? = null

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val response = JSObject()
        val adapter = bluetoothAdapter()
        response.put("available", adapter != null && context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE))
        response.put("bluetoothEnabled", adapter?.isEnabled == true)
        response.put("requiresLocationPermission", Build.VERSION.SDK_INT < Build.VERSION_CODES.S)
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
    fun probeClassicSession(call: PluginCall) {
        val address = call.getString("deviceId")
        val authStep1 = call.getBoolean("authStep1") ?: false
        val postAuthProbe = call.getBoolean("postAuthProbe") ?: false
        val authKeyHex = call.getString("authKeyHex")?.trim()?.takeIf { it.isNotBlank() }
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

                socket = try {
                    device.createRfcommSocketToServiceRecord(SPP_SERVICE_UUID)
                } catch (error: IOException) {
                    throw IOException("Android не смог создать SPP-сокет для часов.", error)
                }

                activeClassicSocket = socket
                socket.connect()
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

                    errorMessage = readClassicPackets(socket, packets, combined, CLASSIC_PROBE_READ_MS) ?: errorMessage

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
                        errorMessage = readClassicPackets(socket, packets, combined, CLASSIC_PROBE_READ_MS) ?: errorMessage

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
                            buildClassicPostAuthProbeCommands().forEachIndexed { index, command ->
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
                            errorMessage = readClassicPackets(socket, packets, combined, CLASSIC_POST_AUTH_READ_MS) ?: errorMessage

                            val activityFileIds = classicActivityFileIds(combined.toByteArray(), authStep2.decryptionKey)
                                .take(CLASSIC_ACTIVITY_FILE_PROBE_LIMIT)
                            if (activityFileIds.isNotEmpty()) {
                                activityFileIds.forEachIndexed { index, fileId ->
                                    socket.outputStream.write(
                                        buildClassicV2EncryptedCommandPacket(
                                            command = buildActivityFetchRequestCommand(fileId),
                                            sequenceNumber = 2 + buildClassicPostAuthProbeCommands().size + index,
                                            encryptionKey = authStep2.encryptionKey,
                                        ),
                                    )
                                    Thread.sleep(CLASSIC_POST_AUTH_COMMAND_DELAY_MS)
                                }
                                socket.outputStream.flush()
                                sentActivityFileProbe = true
                                activityFileProbeCount = activityFileIds.size
                                errorMessage = readClassicPackets(socket, packets, combined, CLASSIC_ACTIVITY_FILE_READ_MS) ?: errorMessage
                            }
                        }
                    }
                } else {
                    errorMessage = readClassicPackets(socket, packets, combined, CLASSIC_PROBE_READ_MS) ?: errorMessage
                }
            } catch (error: IOException) {
                errorMessage = safeMessage(error)
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
        stopActiveClassicSocket()
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
            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    private fun requiredPermissionAliases(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf("bluetoothScan", "bluetoothConnect")
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
            return ClassicAuthKeyCheck(status = "no-watch-nonce", error = "Часы ещё не отдали watch nonce для проверки ключа.")
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
            return ClassicAuthStep2Material(status = "no-watch-nonce", error = "Часы ещё не отдали watch nonce для проверки ключа.", authStep3Command = null)
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
                                var file = if (chunk?.number == 1) {
                                    parseClassicActivityFilePayload(chunkData, isComplete = chunk.total == 1)
                                } else {
                                    null
                                }
                                if (chunk?.number == 1) {
                                    activityAssembly = java.io.ByteArrayOutputStream()
                                    activityAssemblyTotal = chunk.total
                                }
                                if (chunk != null && activityAssembly != null && activityAssemblyTotal == chunk.total) {
                                    activityAssembly?.write(chunkData)
                                    if (chunk.number == chunk.total) {
                                        file = parseClassicActivityFilePayload(activityAssembly!!.toByteArray(), isComplete = true) ?: file
                                        activityAssembly = null
                                        activityAssemblyTotal = null
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
                                item.put("activityFileCrcValid", file?.crcValid)
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
            else -> null
        }
    }

    private fun buildClassicPostAuthProbeCommands(): List<ClassicPostAuthProbeCommand> {
        return listOf(
            ClassicPostAuthProbeCommand("state", buildSimpleCommand(2, 78)),
            ClassicPostAuthProbeCommand("battery", buildSimpleCommand(2, 1)),
            ClassicPostAuthProbeCommand("device-info", buildSimpleCommand(2, 2)),
            ClassicPostAuthProbeCommand("activity-today", buildActivityFetchTodayCommand()),
            ClassicPostAuthProbeCommand("heart-rate-config", buildSimpleCommand(8, 10)),
            ClassicPostAuthProbeCommand("spo2-config", buildSimpleCommand(8, 8)),
            ClassicPostAuthProbeCommand("stress-config", buildSimpleCommand(8, 14)),
            ClassicPostAuthProbeCommand("vitality-config", buildSimpleCommand(8, 35)),
        )
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
        val summary = parseClassicDailySummary(bytes, file, dataEnd)

        return ClassicActivityFileContent(
            file = file,
            fileKind = file.kind,
            padding = padding,
            payloadBytes = payloadBytes,
            crcValid = crcValid,
            sampleCount = daily?.sampleCount,
            steps = daily?.steps ?: summary?.steps,
            heartRateAvg = daily?.heartRateAvg ?: summary?.heartRateAvg,
            heartRateMin = daily?.heartRateMin ?: summary?.heartRateMin,
            heartRateMax = daily?.heartRateMax ?: summary?.heartRateMax,
            heartRateResting = summary?.heartRateResting,
            spo2Avg = daily?.spo2Avg ?: summary?.spo2Avg,
            spo2Min = summary?.spo2Min,
            spo2Max = summary?.spo2Max,
            stressAvg = daily?.stressAvg ?: summary?.stressAvg,
            stressMin = summary?.stressMin,
            stressMax = summary?.stressMax,
            calories = summary?.calories,
            trainingLoadDay = summary?.trainingLoadDay,
            trainingLoadWeek = summary?.trainingLoadWeek,
            vitality = summary?.vitality,
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

        while (offset < dataEnd) {
            val parsed = parseClassicDailyDetailsSample(bytes, offset, dataEnd, header, file.version) ?: break
            offset = parsed.nextOffset
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
        }

        return ClassicDailyDetailsSummary(
            sampleCount = sampleCount,
            steps = stepsTotal.takeIf { sampleCount > 0 },
            heartRateAvg = averageInt(heartRates),
            heartRateMin = heartRates.minOrNull(),
            heartRateMax = heartRates.maxOrNull(),
            spo2Avg = averageInt(spo2Values),
            stressAvg = averageInt(stressValues),
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

    private fun classicActivityFileKind(type: Int, subtype: Int, detailType: Int): String {
        return when {
            type == 0 && subtype == 0 && detailType == 0 -> "Активность по минутам"
            type == 0 && subtype == 0 && detailType == 1 -> "Итоги дня"
            type == 0 && subtype == 3 -> "Фазы сна"
            type == 0 && subtype == 6 -> "Ручные замеры"
            type == 0 && subtype == 8 -> "Сон"
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

    private fun buildActivityFetchTodayCommand(): ByteArray {
        val requestToday = java.io.ByteArrayOutputStream()
        writeProtoVarintField(requestToday, 1, 0)

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
        val majorHex = versionHex?.take(2) ?: return false
        return majorHex.toIntOrNull(16)?.let { it >= 2 } == true
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

    private fun writeProtoVarintField(output: java.io.ByteArrayOutputStream, fieldNumber: Int, value: Int) {
        writeProtoVarint(output, (fieldNumber shl 3) or 0)
        writeProtoVarint(output, value)
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

    private fun writeProtoVarint(output: java.io.ByteArrayOutputStream, value: Int) {
        var remaining = value
        while (remaining >= 0x80) {
            output.write((remaining and 0x7f) or 0x80)
            remaining = remaining ushr 7
        }
        output.write(remaining)
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
    )

    private data class ClassicDailyDetailsSample(
        val nextOffset: Int,
        val steps: Int?,
        val heartRate: Int?,
        val spo2: Int?,
        val stress: Int?,
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
        private const val CLASSIC_POST_AUTH_READ_MS = 10_000L
        private const val CLASSIC_ACTIVITY_FILE_READ_MS = 15_000L
        private const val CLASSIC_ACTIVITY_FILE_PROBE_LIMIT = 10
        private const val CLASSIC_POST_AUTH_COMMAND_DELAY_MS = 120L
        private const val CLASSIC_VERSION_READ_MS = 1_200L
        private const val CLASSIC_SESSION_CONFIG_READ_MS = 1_200L
        private const val CLASSIC_PROBE_POLL_MS = 120L
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
    }
}
