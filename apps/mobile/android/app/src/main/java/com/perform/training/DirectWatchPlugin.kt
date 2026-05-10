package com.perform.training

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
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
import java.util.Locale
import java.util.UUID

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

        val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    mainHandler.removeCallbacks(timeout)
                    finishInspection {
                        call.reject("Не удалось подключиться к часам: Bluetooth status $status.")
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
                mainHandler.removeCallbacks(timeout)
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    finishInspection {
                        call.reject("Часы подключились, но не отдали список сервисов: Bluetooth status $status.")
                    }
                    return
                }

                val response = buildInspectionResponse(device, gatt.services)
                finishInspection {
                    call.resolve(response)
                }
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

    override fun handleOnDestroy() {
        stopActiveScan()
        stopActiveGatt()
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
        response.put("serviceCount", services.size)
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

    private fun bytePreviewHex(bytes: ByteArray?): String? {
        if (bytes == null || bytes.isEmpty()) {
            return null
        }

        return bytes.take(12).joinToString("") { byte -> "%02X".format(byte.toInt() and 0xff) }
    }

    private fun knownServiceName(uuid: UUID): String {
        return when (uuid) {
            HEART_RATE_SERVICE_UUID -> "Heart Rate"
            BATTERY_SERVICE_UUID -> "Battery"
            DEVICE_INFO_SERVICE_UUID -> "Device Information"
            GENERIC_ACCESS_SERVICE_UUID -> "Generic Access"
            GENERIC_ATTRIBUTE_SERVICE_UUID -> "Generic Attribute"
            else -> "Unknown"
        }
    }

    private fun knownCharacteristicName(uuid: UUID): String {
        return when (uuid) {
            HEART_RATE_MEASUREMENT_UUID -> "Heart Rate Measurement"
            BATTERY_LEVEL_UUID -> "Battery Level"
            MANUFACTURER_NAME_UUID -> "Manufacturer Name"
            MODEL_NUMBER_UUID -> "Model Number"
            else -> "Unknown"
        }
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
        if (gatt != null) {
            try {
                gatt.disconnect()
                gatt.close()
            } catch (_: SecurityException) {
                // Nothing to clean up if Android revoked Bluetooth permission during inspection.
            }
        }
        activeGatt = null
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

    private data class ScannedWatchDevice(
        val id: String,
        val name: String?,
        val rssi: Int,
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
        private const val PAIR_TIMEOUT_MS = 30_000
        private val PAIRING_TIMEOUT_TOKEN = Any()
        private val HEART_RATE_SERVICE_UUID: UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        private val HEART_RATE_MEASUREMENT_UUID: UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        private val BATTERY_SERVICE_UUID: UUID = UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb")
        private val BATTERY_LEVEL_UUID: UUID = UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb")
        private val DEVICE_INFO_SERVICE_UUID: UUID = UUID.fromString("0000180a-0000-1000-8000-00805f9b34fb")
        private val MANUFACTURER_NAME_UUID: UUID = UUID.fromString("00002a29-0000-1000-8000-00805f9b34fb")
        private val MODEL_NUMBER_UUID: UUID = UUID.fromString("00002a24-0000-1000-8000-00805f9b34fb")
        private val GENERIC_ACCESS_SERVICE_UUID: UUID = UUID.fromString("00001800-0000-1000-8000-00805f9b34fb")
        private val GENERIC_ATTRIBUTE_SERVICE_UUID: UUID = UUID.fromString("00001801-0000-1000-8000-00805f9b34fb")
        private val WATCH_NAME_HINTS = listOf("redmi", "watch", "xiaomi", "mi ", "band")
    }
}
