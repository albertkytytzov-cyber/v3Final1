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
import android.content.Context
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

    override fun handleOnDestroy() {
        stopActiveScan()
        stopActiveGatt()
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
        devicesByAddress[address] = ScannedWatchDevice(
            id = address,
            name = name,
            rssi = result.rssi,
            isLikelyWatch = isLikelyWatchName(name),
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
        response.put("hasHeartRateService", serviceUuids.contains(HEART_RATE_SERVICE_UUID))
        response.put("hasBatteryService", serviceUuids.contains(BATTERY_SERVICE_UUID))
        response.put("hasDeviceInfoService", serviceUuids.contains(DEVICE_INFO_SERVICE_UUID))
        response.put("serviceCount", services.size)
        response.put("services", JSArray(serviceItems))
        response.put("inspectedAt", java.time.Instant.now().toString())
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

    private data class ScannedWatchDevice(
        val id: String,
        val name: String?,
        val rssi: Int,
        val isLikelyWatch: Boolean,
    ) {
        fun toJson(): JSObject {
            val item = JSObject()
            item.put("id", id)
            item.put("name", name)
            item.put("rssi", rssi)
            item.put("isLikelyWatch", isLikelyWatch)
            return item
        }
    }

    companion object {
        private const val DEFAULT_SCAN_DURATION_MS = 6_000
        private const val INSPECT_TIMEOUT_MS = 10_000
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
